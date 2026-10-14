import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getServerEnv } from '@/lib/env';
import { getLocalPg } from '@/lib/db/local-pg';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LOCAL_SESSION_COOKIE, verifyLocalSession } from './local-session';

export type Role = 'visitor' | 'admin';

/**
 * Qui consulte la page. Le rôle vient TOUJOURS de la base (table profiles), jamais du navigateur.
 * `signedIn` sans rôle = compte authentifié mais pas (encore) autorisé : traité comme un visiteur.
 */
export type Viewer = {
  role: Role;
  signedIn: boolean;
  userId: string | null;
  label: string | null;
};

export const VISITOR: Viewer = { role: 'visitor', signedIn: false, userId: null, label: null };

const asRole = (value: unknown): Role => (value === 'admin' ? value : 'visitor');

export const getViewer = cache(async (): Promise<Viewer> => {
  const env = getServerEnv();

  if (env.backend === 'local') {
    const store = await cookies();
    const userId = await verifyLocalSession(store.get(LOCAL_SESSION_COOKIE)?.value);
    if (!userId) return VISITOR;
    const pg = await getLocalPg();
    const res = await pg.query<{ email: string | null; role: string | null; display_name: string | null }>(
      `select u.email, p.role, p.display_name
         from auth.users u left join public.profiles p on p.user_id = u.id
        where u.id = $1`,
      [userId],
    );
    const row = res.rows[0];
    if (!row) return VISITOR;
    return { role: asRole(row.role), signedIn: true, userId, label: row.display_name ?? row.email };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return VISITOR;
  const { data: role } = await supabase.rpc('app_role');
  const email = typeof claims.email === 'string' ? claims.email : null;
  return { role: asRole(role), signedIn: true, userId: claims.sub, label: email };
});

export const isAdmin = (v: Viewer) => v.role === 'admin';
