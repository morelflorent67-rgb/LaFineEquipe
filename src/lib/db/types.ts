import type { z } from 'zod';
import { DbError } from './errors';

export type RpcArgs = Record<string, unknown>;

/** Accès aux fonctions SQL. Les droits sont ceux de l'utilisateur courant (RLS). */
export interface Db {
  readonly kind: 'local' | 'supabase';
  rpc(fn: string, args?: RpcArgs): Promise<unknown>;
}

/** Appelle une fonction SQL et valide sa réponse : une réponse inattendue n'est jamais affichée telle quelle. */
export async function call<T>(db: Db, fn: string, args: RpcArgs, schema: z.ZodType<T>): Promise<T> {
  const data = await db.rpc(fn, args);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    console.error(`[db] réponse inattendue de ${fn}`, parsed.error.issues.slice(0, 5));
    throw new DbError('invalid_response', `Réponse inattendue de ${fn}`);
  }
  return parsed.data;
}

export const RPC_NAME = /^[a-z_][a-z0-9_]{0,62}$/;
