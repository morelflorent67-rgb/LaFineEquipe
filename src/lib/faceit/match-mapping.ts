import { z } from 'zod';
import type { MatchStatus } from '@/lib/domain/schemas';

/**
 * Conversion des statuts FACEIT vers les statuts du site.
 * ⚠ Liste PROVISOIRE : la spécification ne publie pas les valeurs possibles. Elle doit être
 * confirmée par le spike (docs/faceit-feasibility.md). Toute valeur inconnue → « unknown ».
 * Tant qu'aucune source n'est validée pour le « en cours », ces statuts ne déclenchent aucun LIVE.
 */
const STATUS_MAP: Record<string, MatchStatus> = {
  FINISHED: 'finished',
  CANCELLED: 'cancelled',
  ABORTED: 'aborted',
  ONGOING: 'ongoing',
  READY: 'ready',
  SCHEDULED: 'scheduled',
  CONFIGURING: 'scheduled',
  VOTING: 'scheduled',
  CHECK_IN: 'scheduled',
  SUBSTITUTION: 'scheduled',
  CAPTAIN_PICK: 'scheduled',
};

export function mapMatchStatus(raw: string | null | undefined): MatchStatus {
  if (!raw) return 'unknown';
  return STATUS_MAP[raw.trim().toUpperCase()] ?? 'unknown';
}

export const unixToIso = (s: number | null | undefined) =>
  typeof s === 'number' && Number.isFinite(s) && s > 0 ? new Date(s * 1000).toISOString() : null;

/** Lien de salle FACEIT : la réponse contient « {lang} » à remplacer. Seul www.faceit.com est accepté. */
export function matchRoomUrl(raw: string | null | undefined, matchId: string): string {
  const fallback = `https://www.faceit.com/fr/cs2/room/${encodeURIComponent(matchId)}`;
  if (!raw) return fallback;
  const url = raw.replace('{lang}', 'fr');
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'www.faceit.com' ? u.toString() : fallback;
  } catch {
    return fallback;
  }
}

const votingSchema = z.object({
  map: z
    .object({
      pick: z.array(z.string()).optional(),
      entities: z
        .array(
          z.object({
            game_map_id: z.string().optional(),
            class_name: z.string().optional(),
            guid: z.string().optional(),
            name: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

/** Map jouée, lue de façon défensive dans « voting » (champ non décrit par la spécification). */
export function mapFromVoting(voting: unknown): { mapKey: string; mapName: string | null } | null {
  const parsed = votingSchema.safeParse(voting);
  if (!parsed.success) return null;
  const pick = parsed.data.map?.pick?.[0];
  if (!pick || !/^[a-z0-9_]{2,40}$/.test(pick)) return null;
  const entity = parsed.data.map?.entities?.find((e) => e.game_map_id === pick || e.class_name === pick || e.guid === pick);
  const name = entity?.name && entity.name.length <= 40 ? entity.name : null;
  return { mapKey: pick, mapName: name };
}

const statsSchema = z.object({
  rounds: z
    .array(
      z.object({
        teams: z
          .array(
            z.object({
              team_id: z.string(),
              team_stats: z.record(z.string(), z.unknown()).optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

/**
 * Score en manches fourni par l'historique (`results.score`). Constaté le 13/10/2026 sur
 * 1 000 matchs réels : valeurs en manches (ex. 13–6). Toute forme inattendue → aucun score.
 */
export function roundScoreFromHistory(score: Record<string, number> | null | undefined): { faction1: number; faction2: number } | null {
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 99;
  const a = score?.faction1;
  const b = score?.faction2;
  return ok(a) && ok(b) ? { faction1: a, faction2: b } : null;
}

/**
 * Score en manches d'un BO1, à partir de /matches/{id}/stats (« Final Score » par équipe).
 * Les clés ne sont pas documentées : si la forme diffère, aucun score n'est affiché.
 */
export function roundScoreFromStats(
  stats: unknown,
  factionIds: { faction1: string | null; faction2: string | null },
): { faction1: number; faction2: number } | null {
  const parsed = statsSchema.safeParse(stats);
  if (!parsed.success || !factionIds.faction1 || !factionIds.faction2) return null;
  const rounds = parsed.data.rounds ?? [];
  if (rounds.length !== 1) return null;
  const teams = rounds[0]!.teams ?? [];
  const score = (id: string) => {
    const raw = teams.find((t) => t.team_id === id)?.team_stats?.['Final Score'];
    const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
    return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
  };
  const a = score(factionIds.faction1);
  const b = score(factionIds.faction2);
  return a === null || b === null ? null : { faction1: a, faction2: b };
}

export type PlayerMatchStats = {
  faceitPlayerId: string;
  kills: number;
  deaths: number;
  headshotsPct: number;
  adr: number | null;
  won: boolean | null;
};

const playerStatsSchema = z.object({
  rounds: z.array(
    z.object({
      teams: z.array(
        z.object({
          players: z
            .array(z.object({ player_id: z.string(), player_stats: z.record(z.string(), z.unknown()).optional() }))
            .optional(),
        }),
      ),
    }),
  ),
});

const num = (raw: unknown, min: number, max: number): number | null => {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/**
 * Stats individuelles d'un BO1 (/matches/{id}/stats), pour les joueurs demandés uniquement.
 * Clés constatées le 14/10/2026 sur un vrai match CS2 : « Kills », « Deaths », « Headshots % »,
 * « ADR », « Result » (« 1 » = victoire), toutes en texte. Un joueur dont Kills, Deaths ou
 * Headshots % manquent est ignoré : aucune valeur n'est devinée.
 */
export function playerStatsFromMatchStats(stats: unknown, faceitPlayerIds: ReadonlySet<string>): PlayerMatchStats[] {
  const parsed = playerStatsSchema.safeParse(stats);
  if (!parsed.success || parsed.data.rounds.length !== 1) return [];
  const out: PlayerMatchStats[] = [];
  for (const team of parsed.data.rounds[0]!.teams) {
    for (const p of team.players ?? []) {
      const id = p.player_id.toLowerCase();
      if (!faceitPlayerIds.has(id)) continue;
      const s = p.player_stats ?? {};
      const kills = num(s['Kills'], 0, 200);
      const deaths = num(s['Deaths'], 0, 200);
      const headshotsPct = num(s['Headshots %'], 0, 100);
      if (kills === null || deaths === null || headshotsPct === null || !Number.isInteger(kills) || !Number.isInteger(deaths)) continue;
      const result = s['Result'];
      out.push({
        faceitPlayerId: id,
        kills,
        deaths,
        headshotsPct,
        adr: num(s['ADR'], 0, 1000),
        won: result === '1' ? true : result === '0' ? false : null,
      });
    }
  }
  return out;
}
