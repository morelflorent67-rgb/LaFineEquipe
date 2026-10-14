import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { localRpc } from '@/lib/db/local-pg';
import type { Db } from '@/lib/db/types';
import { createFaceitClient } from '@/lib/faceit/client';
import { FIXTURE_PLAYERS } from '@/lib/faceit/fixtures';
import { syncMatches, syncProfiles } from '@/lib/sync/run-sync';
import { as, freshDb, rpc, sqlAs } from '../helpers/pg';

/** Synchronisation complète contre le jeu d'essai FACEIT (FACEIT_MODE=fixtures, sans réseau). */
let pg: PGlite;
let db: Db;
const fixture = (nick: string) => FIXTURE_PLAYERS.find((p) => p.nickname === nick)!;

beforeAll(async () => {
  pg = await freshDb();
  db = { kind: 'local', rpc: (fn, args) => localRpc(pg, as.service, fn, args) };
  for (const nick of ['demo_alpha', 'demo_bravo', 'demo_delta', 'demo_panne', 'demo_sanscs2']) {
    const f = fixture(nick);
    await rpc(pg, as.admin, 'admin_add_player', {
      p_profile: { faceitPlayerId: f.id, nickname: f.nickname, avatarUrl: null, country: 'fr', cs2Level: null, cs2Elo: null, fetchedAt: '2026-10-01T00:00:00Z' },
      p_group: 'team',
    });
  }
});

describe('synchronisation des profils', () => {
  it('met à jour les profils, enregistre un relevé par joueur CS2 et journalise la panne', async () => {
    const report = await syncProfiles(db, 'script', createFaceitClient());
    expect(report).toMatchObject({ status: 'partial', ok: 4, failed: 1 });
    const roster = await rpc(pg, as.anon, 'list_roster');
    const alpha = roster.find((p: { profile: { nickname: string } }) => p.profile.nickname === 'demo_alpha');
    expect(alpha.profile.avatarUrl).toBe('/dev-fixtures/avatar-01.svg');
    expect(alpha.profile.cs2Level).toBe(10);
    const panne = roster.find((p: { profile: { nickname: string } }) => p.profile.nickname === 'demo_panne');
    expect(panne.profile.lastError).toBe('unavailable');
    expect(panne.profile.cs2Elo).toBeNull(); // dernières données valides conservées (aucune avant)
    const snaps = await sqlAs<{ n: number }>(pg, as.service, 'select count(*)::int as n from elo_snapshots');
    expect(snaps[0]!.n).toBe(3); // alpha, bravo, delta — pas sanscs2 (pas d'ELO), pas panne (erreur)
    const failures = await sqlAs(pg, as.service, 'select * from sync_failures');
    expect(failures).toHaveLength(1);
  });

  it('refuse un second passage simultané', async () => {
    const runId = await rpc(pg, as.service, 'sync_begin', { p_job: 'profiles', p_trigger: 'cron' });
    const report = await syncProfiles(db, 'script', createFaceitClient());
    expect(report.status).toBe('skipped');
    await rpc(pg, as.service, 'sync_end', { p_run_id: runId, p_status: 'ok' });
  });
});

describe('synchronisation des matchs', () => {
  it('dédoublonne les matchs partagés et récupère map et score', async () => {
    const report = await syncMatches(db, 'script', createFaceitClient());
    expect(report.status).toBe('partial'); // demo_panne en erreur
    const matches = await rpc(pg, as.anon, 'list_recent_matches', { p_limit: 50 });
    const ids = matches.map((m: { faceitMatchId: string }) => m.faceitMatchId);
    expect(new Set(ids).size).toBe(ids.length);
    const shared = matches.find((m: { players: unknown[] }) => m.players.length > 1);
    expect(shared).toBeDefined();
    const finished = matches.filter((m: { status: string }) => m.status === 'finished');
    expect(finished.length).toBeGreaterThan(0);
    expect(finished.every((m: { mapKey: string | null; score: unknown }) => m.mapKey && m.score)).toBe(true);
    const cancelled = matches.filter((m: { status: string }) => m.status === 'cancelled');
    expect(cancelled.every((m: { players: { result: string }[] }) => m.players.every((p) => p.result === 'cancelled'))).toBe(true);
    // Stats individuelles (Wall of Shame) : une ligne par joueur suivi et par match terminé détaillé.
    const [row] = await sqlAs<{ n: number }>(pg, as.service, 'select count(*)::int as n from match_player_stats');
    expect(row!.n).toBeGreaterThan(0);
    expect(await rpc(pg, as.service, 'sync_matches_needing_player_stats', {})).toEqual([]);
  });
});
