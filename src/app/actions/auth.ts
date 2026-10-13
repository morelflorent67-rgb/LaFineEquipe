'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getServerEnv } from '@/lib/env';
import { getLocalPg } from '@/lib/db/local-pg';
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
  email: z.email({ error: 'Adresse e-mail invalide.' }).max(200),
  password: z.string().min(1, { error: 'Mot de passe requis.' }).max(200),
});

export async function signInAction(_prev: SignInState, form: FormData): Promise<SignInState> {
  const env = getServerEnv();
  if (env.backend !== 'supabase') return { error: 'La connexion par e-mail nécessite Supabase.' };
  const parsed = credentials.safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Saisie invalide.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Message volontairement générique : ne révèle pas si le compte existe.
    return { error: 'Identifiants incorrects ou compte non confirmé.' };
  }
  redirect(safeNext(form.get('suite')));
}

/** Connexion du mode LOCAL de développement (comptes fictifs, aucun mot de passe). */
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
