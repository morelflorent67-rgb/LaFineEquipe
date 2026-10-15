/**
 * fetch utilisé par les clients Supabase côté serveur.
 *
 * Constaté le 15/10/2026 en production (Netlify → Supabase Paris) : environ une requête de page sur
 * quatre restait bloquée jusqu'à la coupure Netlify à 30 s (erreur 504), alors que Supabase répondait
 * en moins de 300 ms. Une connexion réseau peut rester « pendue » sans jamais répondre : sans délai
 * maximal, la page attend indéfiniment.
 *
 * Règles : toute requête a un délai maximal. Une LECTURE (fonctions list_/get_…, requêtes GET)
 * abandonnée est relancée une fois sur une nouvelle connexion ; une ÉCRITURE ne l'est jamais
 * (pas de risque de double enregistrement). Les lenteurs sont journalisées (journaux Netlify).
 */

export const READ_TIMEOUT_MS = 6_000;
export const WRITE_TIMEOUT_MS = 20_000;
const SLOW_MS = 2_000;

/** Fonctions SQL en lecture seule : sans effet de bord, on peut les relancer sans risque. */
const READ_RPC = /^(list_|get_|recent_|refresh_status$|wall_of_shame$|admin_list_|app_role$)/;

export function rpcName(url: string): string | null {
  const m = url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/);
  return m ? m[1]! : null;
}

/** Requête relançable sans risque : GET/HEAD, ou appel d'une fonction SQL de lecture. */
export function isRetryableRead(url: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD') return true;
  const fn = rpcName(url);
  return fn !== null && READ_RPC.test(fn);
}

type Fetch = typeof fetch;

export function makeResilientFetch(base: Fetch = fetch, opts: { readTimeoutMs?: number; writeTimeoutMs?: number } = {}): Fetch {
  const readTimeout = opts.readTimeoutMs ?? READ_TIMEOUT_MS;
  const writeTimeout = opts.writeTimeoutMs ?? WRITE_TIMEOUT_MS;
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const read = isRetryableRead(url, method);
    const label = rpcName(url) ?? new URL(url).pathname;
    const attempts = read ? 2 : 1;
    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      const timeout = AbortSignal.timeout(read ? readTimeout : writeTimeout);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      try {
        const res = await base(input, { ...init, signal });
        const ms = Date.now() - started;
        if (ms > SLOW_MS) console.warn(`[supabase] ${label} lent : ${ms} ms (essai ${attempt})`);
        return res;
      } catch (err) {
        const timedOut = timeout.aborted && !init?.signal?.aborted;
        console.warn(`[supabase] ${label} ${timedOut ? 'sans réponse' : 'en erreur'} après ${Date.now() - started} ms (essai ${attempt}/${attempts})`);
        if (attempt >= attempts || init?.signal?.aborted) throw err;
      }
    }
  };
}

export const resilientFetch = makeResilientFetch();
