/**
 * Erreurs d'accès aux données, normalisées quel que soit le moteur (Supabase ou base locale).
 * Les fonctions SQL lèvent des erreurs métier « LFE_* » (voir supabase/migrations/…_roles.sql).
 */
export type DbErrorCode =
  | 'forbidden'
  | 'duplicate'
  | 'not_found'
  | 'invalid'
  | 'in_use'
  | 'busy'
  | 'too_soon'
  | 'unavailable'
  | 'invalid_response'
  | 'unknown';

export class DbError extends Error {
  override name = 'DbError';
  constructor(
    public readonly code: DbErrorCode,
    message: string,
    public readonly detail: Record<string, unknown> | null = null,
  ) {
    super(message);
  }
}

const LFE_CODES: Record<string, DbErrorCode> = {
  LFE_FORBIDDEN: 'forbidden',
  LFE_DUPLICATE: 'duplicate',
  LFE_NOT_FOUND: 'not_found',
  LFE_INVALID: 'invalid',
  LFE_IN_USE: 'in_use',
  LFE_BUSY: 'busy',
  LFE_TOO_SOON: 'too_soon',
};

const SQLSTATE_CODES: Record<string, DbErrorCode> = {
  '23505': 'duplicate',
  '23503': 'in_use',
  '23514': 'invalid',
  '23502': 'invalid',
  '22P02': 'invalid',
  '22007': 'invalid',
  '22008': 'invalid',
  '42501': 'forbidden',
};

function parseDetail(detail: unknown): Record<string, unknown> | null {
  if (typeof detail !== 'string' || detail.trim() === '') return null;
  try {
    const value: unknown = JSON.parse(detail);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Convertit une erreur PostgreSQL / PostgREST en DbError. */
export function toDbError(err: unknown): DbError {
  if (err instanceof DbError) return err;
  const e = (err ?? {}) as { code?: unknown; message?: unknown; detail?: unknown; details?: unknown };
  const message = typeof e.message === 'string' ? e.message : 'Erreur inconnue';
  const code = typeof e.code === 'string' ? e.code : '';
  const detail = parseDetail(e.detail ?? e.details);
  if (code === 'P0001' && message in LFE_CODES) {
    return new DbError(LFE_CODES[message] ?? 'unknown', message, detail);
  }
  if (code in SQLSTATE_CODES) {
    return new DbError(SQLSTATE_CODES[code] ?? 'unknown', message, detail);
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|network|timeout/i.test(message)) {
    return new DbError('unavailable', message);
  }
  return new DbError('unknown', message, detail);
}
