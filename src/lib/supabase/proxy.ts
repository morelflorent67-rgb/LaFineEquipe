import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { resilientFetch } from './fetch';

/**
 * Rafraîchit la session Supabase à chaque requête (recommandation officielle @supabase/ssr).
 * Ne fait AUCUN contrôle d'accès : les pages et actions vérifient le rôle côté serveur.
 */
export async function updateSupabaseSession(request: NextRequest, url: string, key: string) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    global: { fetch: resilientFetch },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}
