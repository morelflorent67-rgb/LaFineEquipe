/**
 * Règles du classement ELO permanent (testées dans elo.test.ts).
 * - Progression = ELO actuel − ELO d'ajout. Si l'une des deux valeurs manque : null (jamais 0 par défaut).
 * - Rang « compétition » : les ex æquo partagent le rang (1, 2, 2, 4).
 * - Un joueur sans valeur pour le critère choisi n'est pas classé (rang null), placé en fin de liste.
 */
export type RankMode = 'elo' | 'delta';

export type RankInput = {
  playerId: string;
  nickname: string;
  addedElo: number | null;
  currentElo: number | null;
};

export type Ranked<T extends RankInput> = T & { delta: number | null; rank: number | null };

export function computeDelta(addedElo: number | null, currentElo: number | null): number | null {
  if (addedElo === null || currentElo === null) return null;
  return currentElo - addedElo;
}

export function rankPlayers<T extends RankInput>(items: T[], mode: RankMode): Ranked<T>[] {
  const withDelta = items.map((it) => ({ ...it, delta: computeDelta(it.addedElo, it.currentElo), rank: null as number | null }));
  const valueOf = (it: (typeof withDelta)[number]) => (mode === 'delta' ? it.delta : it.currentElo);
  const byName = (a: { nickname: string }, b: { nickname: string }) =>
    a.nickname.localeCompare(b.nickname, 'fr', { sensitivity: 'base' });

  const ranked = withDelta
    .filter((it) => valueOf(it) !== null)
    // Départage : à progression égale, l'ELO le plus haut passe devant ; puis le pseudo.
    .sort((a, b) => valueOf(b)! - valueOf(a)! || (b.currentElo ?? 0) - (a.currentElo ?? 0) || byName(a, b));
  let previous: number | null = null;
  ranked.forEach((it, i) => {
    const value = valueOf(it)!;
    it.rank = previous !== null && value === previous ? ranked[i - 1]!.rank : i + 1;
    previous = value;
  });
  const unranked = withDelta.filter((it) => valueOf(it) === null).sort(byName);
  return [...ranked, ...unranked];
}

/**
 * Longueur relative d'une barre de progression, entre −1 et 1.
 * Si toutes les progressions valent 0 (ou aucune n'existe), toutes les barres valent 0 :
 * pas de division par zéro, pas de NaN.
 */
export function barScale(values: (number | null)[]): (value: number | null) => number {
  const maxAbs = values.reduce<number>((m, v) => (v === null ? m : Math.max(m, Math.abs(v))), 0);
  return (value) => (value === null || maxAbs === 0 ? 0 : value / maxAbs);
}

/** Déplacements de rang entre deux classements (clé = joueur ; > 0 = gagne des places). */
export function rankMoves(before: Map<string, number | null>, after: { playerId: string; rank: number | null }[]): Map<string, number> {
  const moves = new Map<string, number>();
  for (const row of after) {
    const prev = before.get(row.playerId);
    if (prev === undefined || prev === null || row.rank === null) continue;
    if (prev !== row.rank) moves.set(row.playerId, prev - row.rank);
  }
  return moves;
}
