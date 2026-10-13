import 'server-only';
import { z } from 'zod';
import { call, type Db } from '@/lib/db/types';
import { DbError } from '@/lib/db/errors';
import { createFaceitClient, type FaceitClient } from '@/lib/faceit/client';
import { FaceitError } from '@/lib/faceit/errors';
import { toProfileInput } from '@/lib/faceit/profile';
import {
  mapFromVoting,
  mapMatchStatus,
  matchRoomUrl,
  roundScoreFromHistory,
  roundScoreFromStats,
  unixToIso,
} from '@/lib/faceit/match-mapping';
import type { FaceitHistoryItem } from '@/lib/faceit/schemas';

/**
 * Synchronisation FACEIT mutualisée : UN appel par profil suivi et par passage, quel que soit
 * le nombre d'affichages (les pages lisent la base, jamais FACEIT directement).
 * - profils : roster actif à chaque passage (+ relevé ELO si la valeur a changé), Mur au plus une fois par 20 h ;
 * - matchs : historique récent des joueurs actifs, dédoublonné par identifiant de match.
 * Une erreur FACEIT n'efface jamais les dernières données valides : elle est journalisée.
 */
/** `public` : bouton « Actualiser » du site, limité côté base à un passage toutes les 2 minutes. */
export type Trigger = 'cron' | 'admin' | 'script' | 'public';
export type JobReport = {
  job: 'profiles' | 'matches';
  status: 'ok' | 'partial' | 'error' | 'skipped';
  ok: number;
  failed: number;
  message: string;
};

const PAUSE_MS = 150;
const DETAILS_PER_PASS = 30;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const targetsSchema = z.array(
  z.object({ faceitPlayerId: z.string(), nickname: z.string(), inRoster: z.boolean(), rosterActive: z.boolean(), inAvoid: z.boolean() }),
);

async function begin(db: Db, job: 'profiles' | 'matches', trigger: Trigger): Promise<string | null> {
  try {
    return await call(db, 'sync_begin', { p_job: job, p_trigger: trigger }, z.string());
  } catch (err) {
    if (err instanceof DbError && err.code === 'busy' && trigger !== 'public') return null;
    throw err;
  }
}

function errorCode(err: unknown): string {
  return err instanceof FaceitError ? err.kind : 'invalid_response';
}

export async function syncProfiles(db: Db, trigger: Trigger, client: FaceitClient = createFaceitClient()): Promise<JobReport> {
  const runId = await begin(db, 'profiles', trigger);
  if (!runId) return { job: 'profiles', status: 'skipped', ok: 0, failed: 0, message: 'Une synchronisation des profils est déjà en cours.' };
  let ok = 0;
  let failed = 0;
  let fatal: string | null = null;
  try {
    const targets = await call(db, 'sync_profile_targets', {}, targetsSchema);
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]!;
      try {
        const raw = await client.playerById(t.faceitPlayerId);
        const profile = toProfileInput(raw, new Date(), client.mode === 'fixtures');
        if (profile.faceitPlayerId !== t.faceitPlayerId.toLowerCase()) throw new FaceitError('invalid_response', 'Identifiant différent');
        await db.rpc('sync_save_profile', {
          p_run_id: runId,
          p_profile: {
            faceitPlayerId: profile.faceitPlayerId,
            nickname: profile.nickname,
            avatarUrl: profile.avatarUrl,
            country: profile.country,
            cs2Level: profile.cs2Level,
            cs2Elo: profile.cs2Elo,
            fetchedAt: profile.fetchedAt,
          },
        });
        ok++;
      } catch (err) {
        if (err instanceof DbError) throw err;
        failed++;
        await db.rpc('sync_fail', { p_run_id: runId, p_faceit_player_id: t.faceitPlayerId, p_code: errorCode(err) });
        if (err instanceof FaceitError && ['rate_limited', 'unauthorized', 'config_missing'].includes(err.kind)) {
          // Inutile d'insister : on note l'échec pour les profils restants et on s'arrête.
          for (const rest of targets.slice(i + 1)) {
            failed++;
            await db.rpc('sync_fail', { p_run_id: runId, p_faceit_player_id: rest.faceitPlayerId, p_code: err.kind });
          }
          fatal = err.kind;
          break;
        }
      }
      await pause(client.mode === 'fixtures' ? 0 : PAUSE_MS);
    }
    // Joueurs ajoutés sans ELO CS2 ou réactivés : premier relevé réel = ELO d'ajout.
    await db.rpc('sync_fill_baselines', {});
  } catch (err) {
    fatal = fatal ?? (err instanceof DbError ? `db_${err.code}` : 'unknown');
    console.error('[sync] profils', err instanceof Error ? err.message : err);
  }
  const status = fatal && ok === 0 ? 'error' : failed > 0 || fatal ? 'partial' : 'ok';
  await db.rpc('sync_end', { p_run_id: runId, p_status: status, p_stats: { ok, failed }, p_error_code: fatal });
  return {
    job: 'profiles',
    status,
    ok,
    failed,
    message: `Profils : ${ok} mis à jour, ${failed} en échec${fatal ? ` (${fatal})` : ''}.`,
  };
}

type Collected = { item: FaceitHistoryItem; players: Map<string, string | null> };

function factionOf(item: FaceitHistoryItem, faceitPlayerId: string): string | null {
  for (const [faction, team] of Object.entries(item.teams ?? {})) {
    if ((faction === 'faction1' || faction === 'faction2') && team.players?.some((p) => p.player_id.toLowerCase() === faceitPlayerId)) {
      return faction;
    }
  }
  return null;
}

export async function syncMatches(db: Db, trigger: Trigger, client: FaceitClient = createFaceitClient()): Promise<JobReport> {
  const runId = await begin(db, 'matches', trigger);
  if (!runId) return { job: 'matches', status: 'skipped', ok: 0, failed: 0, message: 'Une synchronisation des matchs est déjà en cours.' };
  let ok = 0;
  let failed = 0;
  let fatal: string | null = null;
  try {
    const targets = await call(db, 'sync_match_targets', {}, z.array(z.object({ playerId: z.string(), faceitPlayerId: z.string() })));
    const from = Math.floor(Date.now() / 1000) - 14 * 86400;
    const collected = new Map<string, Collected>();
    for (const t of targets) {
      const fid = t.faceitPlayerId.toLowerCase();
      try {
        const history = await client.playerHistory(fid, { limit: 10, from });
        for (const item of history.items) {
          const entry = collected.get(item.match_id) ?? { item, players: new Map() };
          entry.players.set(fid, factionOf(item, fid));
          collected.set(item.match_id, entry);
        }
      } catch (err) {
        failed++;
        await db.rpc('sync_fail', { p_run_id: runId, p_faceit_player_id: fid, p_code: errorCode(err) });
        if (err instanceof FaceitError && ['rate_limited', 'unauthorized', 'config_missing'].includes(err.kind)) {
          fatal = err.kind;
          break;
        }
      }
      await pause(client.mode === 'fixtures' ? 0 : PAUSE_MS);
    }

    // Un match partagé par plusieurs joueurs suivis = une seule ligne (clé : identifiant FACEIT du match).
    for (const { item, players } of collected.values()) {
      const winner = item.results?.winner;
      await db.rpc('sync_upsert_match', {
        p: {
          faceitMatchId: item.match_id,
          status: mapMatchStatus(item.status),
          statusRaw: item.status ?? null,
          startedAt: unixToIso(item.started_at),
          finishedAt: unixToIso(item.finished_at),
          score: mapMatchStatus(item.status) === 'finished' ? roundScoreFromHistory(item.results?.score) : null,
          winnerFaction: winner === 'faction1' || winner === 'faction2' ? winner : null,
          factions: Object.fromEntries(
            Object.entries(item.teams ?? {})
              .filter(([k]) => k === 'faction1' || k === 'faction2')
              .map(([k, v]) => [k, { name: v.nickname ?? null }]),
          ),
          competitionName: item.competition_name ?? null,
          faceitUrl: matchRoomUrl(item.faceit_url, item.match_id),
          source: 'faceit_history',
          players: [...players.entries()].map(([faceitPlayerId, faction]) => ({ faceit_player_id: faceitPlayerId, faction })),
        },
      });
      ok++;
    }

    // Détails (map + score en manches) pour les matchs terminés qui n'en ont pas encore.
    // Débit constaté : 20 appels/s ; 30 matchs = 60 appels espacés, sans risque de quota.
    if (!fatal) {
      const pending = await call(db, 'sync_matches_needing_details', { p_limit: DETAILS_PER_PASS }, z.array(z.string()));
      for (const matchId of pending) {
        try {
          const match = await client.match(matchId);
          const map = mapFromVoting(match.voting);
          let score: { faction1: number; faction2: number } | null = null;
          if (mapMatchStatus(match.status) === 'finished') {
            try {
              score = roundScoreFromStats(await client.matchStats(matchId), {
                faction1: match.teams?.faction1?.faction_id ?? null,
                faction2: match.teams?.faction2?.faction_id ?? null,
              });
            } catch (err) {
              if (!(err instanceof FaceitError) || err.kind !== 'not_found') throw err;
            }
          }
          const winner = match.results?.winner;
          await db.rpc('sync_upsert_match', {
            p: {
              faceitMatchId: match.match_id,
              status: mapMatchStatus(match.status),
              statusRaw: match.status ?? null,
              mapKey: map?.mapKey ?? null,
              mapName: map?.mapName ?? null,
              startedAt: unixToIso(match.started_at),
              finishedAt: unixToIso(match.finished_at),
              score,
              winnerFaction: winner === 'faction1' || winner === 'faction2' ? winner : null,
              competitionName: match.competition_name ?? null,
              faceitUrl: matchRoomUrl(match.faceit_url, match.match_id),
              source: 'faceit_match',
              detailsFetched: true,
              players: [],
            },
          });
        } catch (err) {
          if (err instanceof DbError) throw err;
          console.warn(`[sync] détails du match ${matchId} indisponibles : ${errorCode(err)}`);
          if (err instanceof FaceitError && err.kind === 'rate_limited') break;
        }
        await pause(client.mode === 'fixtures' ? 0 : PAUSE_MS);
      }
    }
  } catch (err) {
    fatal = fatal ?? (err instanceof DbError ? `db_${err.code}` : 'unknown');
    console.error('[sync] matchs', err instanceof Error ? err.message : err);
  }
  const status = fatal && ok === 0 ? 'error' : failed > 0 || fatal ? 'partial' : 'ok';
  await db.rpc('sync_end', { p_run_id: runId, p_status: status, p_stats: { matches: ok, failed }, p_error_code: fatal });
  return { job: 'matches', status, ok, failed, message: `Matchs : ${ok} enregistrés, ${failed} joueur(s) en échec${fatal ? ` (${fatal})` : ''}.` };
}

export async function runAllSyncs(db: Db, trigger: Trigger): Promise<JobReport[]> {
  const client = createFaceitClient();
  return [await syncProfiles(db, trigger, client), await syncMatches(db, trigger, client)];
}
