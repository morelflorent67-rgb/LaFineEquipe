import type { PGlite } from '@electric-sql/pglite';
import { localRpc, openLocalPg, type LocalIdentity } from '@/lib/db/local-pg';
import { DbError } from '@/lib/db/errors';

/** Base PostgreSQL en mémoire avec TOUTES les migrations du projet (comme sur Supabase). */
export async function freshDb(): Promise<PGlite> {
  return openLocalPg();
}

export const ADMIN = '00000000-0000-4000-8000-00000000a001';
export const NO_ROLE = '00000000-0000-4000-8000-00000000a003';

export const as = {
  anon: { pgRole: 'anon', userId: null } as LocalIdentity,
  admin: { pgRole: 'authenticated', userId: ADMIN } as LocalIdentity,
  noRole: { pgRole: 'authenticated', userId: NO_ROLE } as LocalIdentity,
  service: { pgRole: 'service_role', userId: null } as LocalIdentity,
};

export function rpc(pg: PGlite, who: LocalIdentity, fn: string, args: Record<string, unknown> = {}) {
  return localRpc(pg, who, fn, args) as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Code d'erreur normalisé d'un appel qui doit échouer. */
export async function errorCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    return err instanceof DbError ? err.code : 'not-a-db-error';
  }
  return 'no-error';
}

/** Requête SQL directe avec une identité donnée (pour vérifier la RLS au niveau des tables). */
export async function sqlAs<T = Record<string, unknown>>(pg: PGlite, who: LocalIdentity, sql: string, params: unknown[] = []) {
  return pg.transaction(async (tx) => {
    await tx.query(`select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [who.pgRole, who.userId ?? '']);
    return (await tx.query<T>(sql, params)).rows;
  });
}

let n = 0;
export function profile(over: Partial<Record<string, unknown>> = {}) {
  n += 1;
  return {
    faceitPlayerId: `11111111-1111-4111-8111-${n.toString().padStart(12, '0')}`,
    nickname: `joueur_${n}`,
    avatarUrl: `https://assets.faceit-cdn.net/avatars/${n}.jpg`,
    country: 'fr',
    cs2Level: 7,
    cs2Elo: 1500 + n,
    fetchedAt: new Date('2026-10-10T10:00:00Z').toISOString(),
    ...over,
  };
}
