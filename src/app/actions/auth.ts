'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env';
import { getLocalPg } from '@/lib/db/local-pg';
import { resolveAdminEmail } from '@/lib/auth/admin-login';
import { LOCAL_SESSION_COOKIE, signLocalSession } from '@/lib/auth/local-session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** N'accepte qu'un chemin interne (évite les redirections vers un autre site). */
function safeNext(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/';
}

export type SignInState = { error: string | null };

const credentials = z.object({
  identifier: z.string().trim().min(1, { error: 'Identifiant requis.' }).max(60),
  password: z.string().min(1, { error: 'Mot de passe requis.' }).max(200),
});

// Message volontairement générique : ne révèle ni l'identifiant attendu ni l'existence du compte.
const BAD_CREDENTIALS = 'Identifiant ou mot de passe incorrect.';

/** Connexion du compte unique « admin » (Supabase Auth, aucune inscription possible). */
export async function signInAction(_prev: SignInState, form: FormData): Promise<SignInState> {
  const env = getServerEnv();
  if (env.backend !== 'supabase') return { error: 'La connexion par mot de passe nécessite Supabase.' };
  if (!env.adminEmail) return { error: 'Connexion admin non configurée : LFE_ADMIN_EMAIL manquant côté serveur.' };
  const parsed = credentials.safeParse({ identifier: form.get('identifier'), password: form.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Saisie invalide.' };
  const email = resolveAdminEmail(parsed.data.identifier, env.adminEmail);
  if (!email) return { error: BAD_CREDENTIALS };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) return { error: BAD_CREDENTIALS };
  // Le rôle vient de la table profiles : un compte authentifié sans rôle admin est refusé.
  const { data: role } = await supabase.rpc('app_role');
  if (role !== 'admin') {
    await supabase.auth.signOut();
    return { error: 'Ce compte n’a pas le rôle administrateur (table profiles).' };
  }
  redirect(safeNext(form.get('suite')));
}

/** Connexion du mode LOCAL de développement (comptes de test, aucun mot de passe). */
export async function localSignInAction(form: FormData): Promise<void> {
  const env = getServerEnv();
  if (env.backend !== 'local') throw new Error('Connexion locale indisponible.');
  const userId = String(form.get('userId') ?? '');
  const pg = await getLocalPg();
  const found = await pg.query('select 1 from auth.users where id::text = $1', [userId]);
  if (found.rows.length === 0) throw new Error('Compte local inconnu.');
  const store = await cookies();
  store.set(LOCAL_SESSION_COOKIE, await signLocalSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(safeNext(form.get('suite')));
}

export async function signOutAction(): Promise<void> {
  const env = getServerEnv();
  if (env.backend === 'local') {
    (await cookies()).delete(LOCAL_SESSION_COOKIE);
  } else {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect('/');
}
