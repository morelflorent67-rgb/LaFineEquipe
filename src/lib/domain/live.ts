import type { LiveStateRow, Match } from './schemas';

/**
 * État « matchs en cours » affiché par le site.
 * - unavailable : aucune source fiable n'a été validée (réglage par défaut) → « Statut indisponible ».
 * - uncertain   : source validée mais dernier contrôle en échec ou trop ancien.
 *                 Une panne ne devient JAMAIS « personne en game ».
 * - none        : contrôle récent et réussi, aucun match en cours.
 * - live        : contrôle récent et réussi, au moins un match en cours.
 */
export type LiveState =
  | { kind: 'unavailable' }
  | { kind: 'uncertain'; lastOkAt: string | null }
  | { kind: 'none'; checkedAt: string }
  | { kind: 'live'; checkedAt: string; matches: Match[] };

export const LIVE_MAX_AGE_MS = 10 * 60 * 1000;

export function deriveLiveState(row: LiveStateRow | null, now: Date = new Date()): LiveState {
  if (!row || row.source === 'none') return { kind: 'unavailable' };
  const okAt = row.lastMatchesSyncOkAt;
  const lastFailed = row.lastMatchesSyncStatus === 'error';
  if (!okAt || lastFailed || now.getTime() - Date.parse(okAt) > LIVE_MAX_AGE_MS) {
    return { kind: 'uncertain', lastOkAt: okAt };
  }
  return row.ongoing.length > 0 ? { kind: 'live', checkedAt: okAt, matches: row.ongoing } : { kind: 'none', checkedAt: okAt };
}
