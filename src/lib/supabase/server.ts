import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ConfigError, getServerEnv } from '@/lib/env';

function supabaseConfig() {
  const env = getServerEnv();
  if (!env.supabase) throw new ConfigError('Supabase n’est pas configuré (LFE_DATA_BACKEND=supabase requis).');
  return env.supabase;
}

/**
 * Client lié à la session de l'utilisateur (cookies) : toutes les requêtes passent par la RLS
 * avec SES droits. À recréer pour chaque requête.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, publishableKey } = supabaseConfig();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Appelé depuis un Server Component : le proxy rafraîchit déjà la session.
        }
      },
    },
  });
}

/**
 * Client « service » (clé secrète) : contourne la RLS. Réservé à la synchronisation planifiée,
 * jamais utilisé pour une action déclenchée par un visiteur.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  const { url, secretKey } = supabaseConfig();
  if (!secretKey) throw new ConfigError('SUPABASE_SECRET_KEY manquante : nécessaire pour la synchronisation.');
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
