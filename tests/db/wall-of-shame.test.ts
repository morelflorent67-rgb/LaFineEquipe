import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { wallOfShameSchema } from '@/lib/domain/schemas';
import { as, errorCode, freshDb, profile, rpc, sqlAs } from '../helpers/pg';

/** Wall of Shame : calculé en base à partir des stats de match enregistrées par la synchro. */
let pg: PGlite;
beforeEach(async () => {
  pg = await freshDb();
});

type Line = { kills: number; deaths: number; hs: number; adr: number | null; won: boolean | null };
let matchN = 0;

/** Enregistre un match terminé il y a `daysAgo` jours avec les stats données (comme la synchro). */
async function playMatch(daysAgo: number, lines: { faceitPlayerId: string; stats: Line }[]) {
  matchN += 1;
  const id = `wos-match-${matchN.toString().padStart(4, '0')}`;
  const finished = new Date(Date.now() - daysAgo * 86400_000).toISOString();
  await rpc(pg, as.service, 'sync_upsert_match', {
    p: {
      faceitMatchId: id,
      status: 'finished',
      startedAt: finished,
      finishedAt: finished,
      mapName: 'Mirage',
      faceitUrl: `https://www.faceit.com/fr/cs2/room/${id}`,
      source: 'faceit_match',
      players: lines.map((l) => ({ faceit_player_id: l.faceitPlayerId, faction: 'faction1' })),
    },
  });
  return rpc(pg, as.service, 'sync_save_player_stats', {
    p_faceit_match_id: id,
    p_stats: lines.map((l) => ({
      faceitPlayerId: l.faceitPlayerId,
      kills: l.stats.kills,
      deaths: l.stats.deaths,
      headshotsPct: l.stats.hs,
      adr: l.stats.adr,
      won: l.stats.won,
    })),
  });
}

const s = (kills: number, deaths: number, hs: number, adr: number | null, won: boolean | null): Line => ({ kills, deaths, hs, adr, won });

describe('Wall of Shame', () => {
  it('classe les 5 catégories sur 30 jours, joueurs « team » seulement, 3 matchs minimum pour les moyennes', async () => {
    const a = profile({ nickname: 'alpha' });
    const b = profile({ nickname: 'bravo' });
    const g = profile({ nickname: 'invite' });
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: a, p_group: 'team' });
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: b, p_group: 'team' });
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: g, p_group: 'guest' });

    // alpha : 3 matchs ; bravo : 2 matchs (exclu des moyennes) ; l'invité est pire partout mais exclu.
    await playMatch(1, [
      { faceitPlayerId: a.faceitPlayerId, stats: s(10, 15, 40, 70.5, false) },
      { faceitPlayerId: b.faceitPlayerId, stats: s(2, 20, 10, 30, false) },
      { faceitPlayerId: g.faceitPlayerId, stats: s(0, 30, 0, 5, false) },
    ]);
    await playMatch(5, [
      { faceitPlayerId: a.faceitPlayerId, stats: s(20, 10, 50, 90.5, true) },
      { faceitPlayerId: b.faceitPlayerId, stats: s(15, 12, 20, 60, true) },
    ]);
    await playMatch(10, [{ faceitPlayerId: a.faceitPlayerId, stats: s(5, 18, 30, 50, false) }]);
    // Hors fenêtre : ignoré, même s'il serait un « record ».
    await playMatch(40, [{ faceitPlayerId: a.faceitPlayerId, stats: s(0, 40, 0, 1, false) }]);

    const wall = wallOfShameSchema.parse(await rpc(pg, as.anon, 'wall_of_shame', { p_days: 30 }));
    expect(wall.days).toBe(30);
    expect(wall.matchesCounted).toBe(3);
    expect(wall.playersCounted).toBe(2);
    const c = wall.categories;
    // Le Touriste : moins de kills sur un match.
    expect(c.touriste.map((r) => [r.player.nickname, r.value])).toEqual([
      ['bravo', 2],
      ['alpha', 5],
    ]);
    expect(c.touriste[0]!.match?.faceitUrl).toMatch(/^https:\/\/www\.faceit\.com\//);
    // La Passoire : plus de morts sur un match.
    expect(c.passoire.map((r) => [r.player.nickname, r.value])).toEqual([
      ['bravo', 20],
      ['alpha', 18],
    ]);
    // Moyennes : seul alpha a 3 matchs.
    expect(c.myope).toEqual([expect.objectContaining({ value: 40, matches: 3 })]);
    expect(c.pacifiste).toEqual([expect.objectContaining({ value: 70.3, matches: 3 })]);
    expect(c.chatNoir).toEqual([expect.objectContaining({ value: 33, matches: 3 })]);
    expect(JSON.stringify(wall)).not.toContain('invite');
  });

  it('sans stats enregistrées : catégories vides, jamais de valeur inventée', async () => {
    const wall = wallOfShameSchema.parse(await rpc(pg, as.anon, 'wall_of_shame'));
    expect(wall.matchesCounted).toBe(0);
    expect(Object.values(wall.categories).every((rows) => rows.length === 0)).toBe(true);
  });

  it('seule la synchro écrit les stats ; un joueur hors roster est ignoré ; le match est marqué lu', async () => {
    const a = profile();
    await rpc(pg, as.admin, 'admin_add_player', { p_profile: a, p_group: 'team' });
    const saved = await playMatch(2, [
      { faceitPlayerId: a.faceitPlayerId, stats: s(8, 9, 30, 60, true) },
      { faceitPlayerId: '99999999-9999-4999-8999-999999999999', stats: s(30, 2, 70, 150, true) },
    ]);
    expect(saved).toBe(1);
    expect(await rpc(pg, as.service, 'sync_matches_needing_player_stats', {})).toEqual([]);
    for (const who of [as.anon, as.noRole, as.admin]) {
      expect(await errorCode(rpc(pg, who, 'sync_save_player_stats', { p_faceit_match_id: 'x', p_stats: [] }))).toBe('forbidden');
    }
    await sqlAs(pg, as.admin, 'delete from match_player_stats').catch(() => null);
    expect(await sqlAs(pg, as.service, 'select count(*)::int as n from match_player_stats')).toEqual([{ n: 1 }]);
  });
});
