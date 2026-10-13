import type { EloHistory } from '@/lib/domain/schemas';

export type ChartPoint = { elo: number; at: string; kind: 'added' | 'reading' | 'current' };

/**
 * Points du graphique d'un joueur : uniquement des relevés réels, à partir de son ajout.
 * Les relevés identiques ne sont pas dupliqués en base : on ajoute donc le dernier ELO connu
 * (profil, daté de la dernière réponse FACEIT) pour prolonger la courbe jusqu'à aujourd'hui.
 */
export function chartPoints(history: Pick<EloHistory, 'points' | 'addedAt'>, current: { elo: number | null; at: string }): ChartPoint[] {
  const pts: ChartPoint[] = history.points.map((p, i) => ({ elo: p.elo, at: p.measuredAt, kind: i === 0 ? 'added' : 'reading' }));
  const last = pts.at(-1);
  if (current.elo !== null && last && Date.parse(current.at) > Date.parse(last.at)) {
    pts.push({ elo: current.elo, at: current.at, kind: 'current' });
  }
  return pts;
}

/** Bornes verticales du graphique, avec une marge, arrondies à la dizaine (jamais un écart nul). */
export function eloBounds(values: number[]): { lo: number; hi: number } {
  if (values.length === 0) return { lo: 0, hi: 100 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(20, (max - min) * 0.15);
  return { lo: Math.floor((min - pad) / 10) * 10, hi: Math.ceil((max + pad) / 10) * 10 };
}
