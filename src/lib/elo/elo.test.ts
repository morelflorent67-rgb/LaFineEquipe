import { describe, expect, it } from 'vitest';
import type { Player } from '@/lib/domain/schemas';
import { progressionOf, rankingRows } from './board';
import { chartPoints, eloBounds } from './history';
import { barScale, computeDelta, rankMoves, rankPlayers } from './ranking';

const p = (playerId: string, addedElo: number | null, currentElo: number | null) => ({
  playerId,
  nickname: playerId,
  addedElo,
  currentElo,
});

const player = (id: string, over: Partial<Player> & { elo?: number | null } = {}): Player => ({
  id,
  group: 'team',
  active: true,
  displayOrder: 10,
  isDemo: false,
  createdAt: '2026-10-01T10:00:00Z',
  addedAt: '2026-10-01T10:00:00Z',
  addedElo: 2000,
  ...over,
  profile: {
    faceitPlayerId: `f-${id}`,
    nickname: id,
    avatarUrl: null,
    country: 'fr',
    cs2Level: 10,
    cs2Elo: over.elo === undefined ? 2000 : over.elo,
    fetchedAt: '2026-10-13T10:00:00Z',
    lastAttemptAt: null,
    lastError: null,
    isDemo: false,
  },
});

describe('progression', () => {
  it('= ELO actuel − ELO d’ajout', () => {
    expect(computeDelta(1500, 1560)).toBe(60);
    expect(computeDelta(1500, 1430)).toBe(-70);
    expect(computeDelta(1500, 1500)).toBe(0);
  });
  it('reste vide si une des deux valeurs manque (jamais 0 par défaut)', () => {
    expect(computeDelta(null, 1500)).toBeNull();
    expect(computeDelta(1500, null)).toBeNull();
  });
  it('vaut 0 pour un joueur qui vient d’être ajouté', () => {
    expect(progressionOf(player('new', { addedElo: 2312, elo: 2312 }))).toBe(0);
  });
});

describe('classement permanent', () => {
  it('trie par ELO actuel décroissant', () => {
    const ranked = rankPlayers([p('a', 1000, 1010), p('b', 1000, 1050), p('c', 2000, 2010)], 'elo');
    expect(ranked.map((r) => [r.playerId, r.rank])).toEqual([
      ['c', 1],
      ['b', 2],
      ['a', 3],
    ]);
  });
  it('trie par progression avec rangs ex æquo (1, 2, 2, 4), l’ELO départageant l’ordre', () => {
    const ranked = rankPlayers([p('a', 1000, 1010), p('b', 1000, 1050), p('c', 2000, 2010), p('d', 1000, 990)], 'delta');
    expect(ranked.map((r) => [r.playerId, r.rank, r.delta])).toEqual([
      ['b', 1, 50],
      ['c', 2, 10],
      ['a', 2, 10],
      ['d', 4, -10],
    ]);
  });
  it('met les joueurs sans valeur en fin de liste, non classés', () => {
    const ranked = rankPlayers([p('z', null, null), p('a', 1000, 1010), p('m', null, 1500)], 'delta');
    expect(ranked.map((r) => [r.playerId, r.rank])).toEqual([
      ['a', 1],
      ['m', null],
      ['z', null],
    ]);
    // Par ELO, un joueur sans ELO d'ajout mais avec un ELO actuel est classé.
    expect(rankPlayers([p('m', null, 1500), p('a', 1000, 1010)], 'elo').map((r) => r.rank)).toEqual([1, 2]);
  });
  it('gère une liste vide', () => {
    expect(rankPlayers([], 'elo')).toEqual([]);
  });
  it('exclut les joueurs inactifs et filtre par groupe', () => {
    const players = [player('a', { elo: 2500 }), player('b', { elo: 2400, group: 'guest' }), player('c', { elo: 2600, active: false })];
    expect(rankingRows(players, 'elo').map((r) => r.playerId)).toEqual(['a', 'b']);
    expect(rankingRows(players, 'elo', 'guest').map((r) => [r.playerId, r.rank])).toEqual([['b', 1]]);
  });
  it('calcule les déplacements de rang après une synchro', () => {
    const before = new Map<string, number | null>([['a', 1], ['b', 2], ['c', 3]]);
    const moves = rankMoves(before, [
      { playerId: 'b', rank: 1 },
      { playerId: 'a', rank: 2 },
      { playerId: 'c', rank: 3 },
      { playerId: 'new', rank: 4 },
    ]);
    expect([...moves]).toEqual([
      ['b', 1],
      ['a', -1],
    ]);
  });
});

describe('barres de progression', () => {
  it('toutes à 0 quand toutes les progressions valent 0 (pas de NaN)', () => {
    const scale = barScale([0, 0, 0]);
    expect([scale(0), scale(0)]).toEqual([0, 0]);
    expect(Number.isNaN(scale(0))).toBe(false);
  });
  it('à 0 quand aucune progression n’existe', () => {
    expect(barScale([null, null])(null)).toBe(0);
    expect(barScale([])(5)).toBe(0);
  });
  it('proportionnelles à la plus grande valeur absolue', () => {
    const scale = barScale([40, -20, null, 10]);
    expect(scale(40)).toBe(1);
    expect(scale(-20)).toBe(-0.5);
    expect(scale(null)).toBe(0);
  });
});

describe('graphique depuis l’ajout', () => {
  const history = {
    addedAt: '2026-10-01T10:00:00Z',
    points: [
      { elo: 2000, level: 10, measuredAt: '2026-10-01T10:00:00Z' },
      { elo: 2025, level: 10, measuredAt: '2026-10-02T20:00:00Z' },
    ],
  };
  it('ne contient que des relevés réels et prolonge jusqu’au dernier ELO connu', () => {
    const pts = chartPoints(history, { elo: 2025, at: '2026-10-05T08:00:00Z' });
    expect(pts.map((x) => [x.elo, x.kind])).toEqual([
      [2000, 'added'],
      [2025, 'reading'],
      [2025, 'current'],
    ]);
  });
  it('n’ajoute rien si le profil n’est pas plus récent que le dernier relevé', () => {
    expect(chartPoints(history, { elo: 2025, at: '2026-10-02T20:00:00Z' })).toHaveLength(2);
    expect(chartPoints({ ...history, points: [] }, { elo: 2025, at: '2026-10-05T08:00:00Z' })).toEqual([]);
  });
  it('calcule des bornes avec marge, même pour une courbe plate', () => {
    expect(eloBounds([2000, 2000])).toEqual({ lo: 1980, hi: 2020 });
    expect(eloBounds([])).toEqual({ lo: 0, hi: 100 });
  });
});
