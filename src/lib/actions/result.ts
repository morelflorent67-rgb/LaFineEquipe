import { DbError } from '@/lib/db/errors';
import { FACEIT_ERROR_LABELS, FaceitError } from '@/lib/faceit/errors';
import { ConfigError } from '@/lib/env';

/** Résultat renvoyé par les actions serveur aux formulaires (jamais d'exception brute côté client). */
export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string; code: string; detail?: Record<string, unknown> | null };

const DB_MESSAGES: Record<string, string> = {
  forbidden: 'Action non autorisée pour ton compte.',
  duplicate: 'Cet élément existe déjà.',
  not_found: 'Élément introuvable (déjà supprimé ?).',
  invalid: 'Données invalides.',
  in_use: 'Impossible : cet élément est utilisé ailleurs.',
  busy: 'Une synchronisation est déjà en cours.',
  too_soon: 'Actualisation trop rapprochée : réessaie dans un instant.',
  unavailable: 'Base de données injoignable pour le moment.',
  invalid_response: 'Réponse inattendue de la base de données.',
  unknown: 'Erreur inattendue.',
};

export function failure(err: unknown, overrides: Partial<Record<string, string>> = {}): ActionResult<never> {
  if (err instanceof FaceitError) {
    return { ok: false, code: `faceit_${err.kind}`, message: overrides[err.kind] ?? FACEIT_ERROR_LABELS[err.kind] };
  }
  if (err instanceof DbError) {
    return { ok: false, code: err.code, message: overrides[err.code] ?? DB_MESSAGES[err.code] ?? DB_MESSAGES.unknown!, detail: err.detail };
  }
  if (err instanceof ConfigError) {
    return { ok: false, code: 'config', message: err.message };
  }
  console.error('[action]', err);
  return { ok: false, code: 'unknown', message: DB_MESSAGES.unknown! };
}
