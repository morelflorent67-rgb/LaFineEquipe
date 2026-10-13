import 'server-only';
import type { z } from 'zod';
import { getServerEnv } from '@/lib/env';
import { FaceitError } from './errors';
import { fixtureRequest } from './fixtures';
import { historySchema, matchSchema, matchStatsSchema, playerSchema, searchPlayersSchema } from './schemas';

/**
 * Client FACEIT Data API v4 — SERVEUR UNIQUEMENT (« server-only » empêche tout import
 * depuis un composant client). La clé est lue dans l'environnement et envoyée seulement
 * dans l'en-tête Authorization : elle n'apparaît ni dans les URL ni dans les journaux.
 */
const BASE = 'https://open.faceit.com/data/v4';
const TIMEOUT_MS = 8000;

type Query = Record<string, string | number | undefined>;
type RawResponse = { status: number; body: unknown; retryAfter: number | null };

export type FaceitClient = ReturnType<typeof createFaceitClient>;

function cleanQuery(query: Query): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
}

async function liveRequest(apiKey: string, path: string, query: Record<string, string>): Promise<RawResponse> {
  const url = `${BASE}${path}${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    throw new FaceitError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network', 'FACEIT injoignable');
  }
  const retry = Number(res.headers.get('retry-after'));
  let body: unknown = null;
  try {
    body = res.status === 204 ? null : await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, retryAfter: Number.isFinite(retry) && retry > 0 ? retry : null };
}

export function createFaceitClient() {
  const env = getServerEnv();
  const mode = env.faceit.mode;

  async function get<T>(path: string, query: Query, schema: z.ZodType<T>): Promise<T> {
    const q = cleanQuery(query);
    let res: RawResponse;
    if (mode === 'fixtures') {
      res = fixtureRequest(path, q);
    } else {
      if (!env.faceit.apiKey) throw new FaceitError('config_missing', 'FACEIT_API_KEY absente');
      res = await liveRequest(env.faceit.apiKey, path, q);
    }
    if (res.status === 200) {
      const parsed = schema.safeParse(res.body);
      if (!parsed.success) {
        console.warn(`[faceit] réponse non conforme pour ${path}`, parsed.error.issues.slice(0, 3));
        throw new FaceitError('invalid_response', 'Réponse FACEIT non conforme');
      }
      return parsed.data;
    }
    console.warn(`[faceit] ${path} → HTTP ${res.status}`);
    if (res.status === 404) throw new FaceitError('not_found', 'Introuvable');
    if (res.status === 401 || res.status === 403) throw new FaceitError('unauthorized', 'Clé refusée');
    if (res.status === 429) throw new FaceitError('rate_limited', 'Quota dépassé', res.retryAfter);
    if (res.status === 400) throw new FaceitError('bad_request', 'Requête invalide');
    throw new FaceitError('unavailable', `HTTP ${res.status}`);
  }

  return {
    mode,
    playerByNickname: (nickname: string) => get('/players', { nickname }, playerSchema),
    playerById: (playerId: string) => get(`/players/${encodeURIComponent(playerId)}`, {}, playerSchema),
    searchPlayers: (nickname: string, limit = 5) =>
      get('/search/players', { nickname, game: 'cs2', offset: 0, limit }, searchPlayersSchema),
    playerHistory: (playerId: string, opts: { limit?: number; from?: number } = {}) =>
      get(
        `/players/${encodeURIComponent(playerId)}/history`,
        { game: 'cs2', offset: 0, limit: opts.limit ?? 10, from: opts.from },
        historySchema,
      ),
    match: (matchId: string) => get(`/matches/${encodeURIComponent(matchId)}`, {}, matchSchema),
    matchStats: (matchId: string) => get(`/matches/${encodeURIComponent(matchId)}/stats`, {}, matchStatsSchema),
  };
}
