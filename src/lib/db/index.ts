import 'server-only';
import { cache } from 'react';
import { getServerEnv } from '@/lib/env';
import { getViewer } from '@/lib/auth/viewer';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { getLocalPg, localRpc, type LocalIdentity } from './local-pg';
import { toDbError } from './errors';
import type { Db, RpcArgs } from './types';

function supabaseDb(client: Awaited<ReturnType<typeof createSupabaseServerClient>>): Db {
  return {
    kind: 'supabase',
    async rpc(fn: string, args: RpcArgs = {}) {
      const { data, error } = await client.rpc(fn, args);
      if (error) throw toDbError(error);
      return data ?? null;
    },
  };
}

function localDb(who: LocalIdentity): Db {
  return {
    kind: 'local',
    async rpc(fn: string, args: RpcArgs = {}) {
      return localRpc(await getLocalPg(), who, fn, args);
    },
  };
}

/** Accès aux données avec les droits de la personne qui consulte (RLS). */
export const getDb = cache(async (): Promise<Db> => {
  const env = getServerEnv();
  if (env.backend === 'local') {
    const viewer = await getViewer();
    return localDb({ pgRole: viewer.signedIn ? 'authenticated' : 'anon', userId: viewer.userId });
  }
  return supabaseDb(await createSupabaseServerClient());
});

/** Accès « service » (synchronisation planifiée uniquement). Contourne la RLS. */
export function getServiceDb(): Db {
  const env = getServerEnv();
  if (env.backend === 'local') return localDb({ pgRole: 'service_role', userId: null });
  return supabaseDb(createSupabaseServiceClient());
}

export { call } from './types';
export type { Db } from './types';
export { DbError } from './errors';
