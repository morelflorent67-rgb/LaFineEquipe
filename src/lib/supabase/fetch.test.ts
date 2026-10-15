import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRetryableRead, makeResilientFetch, rpcName } from './fetch';

const BASE = 'https://exemple.supabase.co/rest/v1/rpc/';

/** Faux réseau : chaque appel suit le scénario donné (« pendu » = ne répond jamais). */
function fakeNetwork(script: ('hang' | 'ok')[]) {
  const calls: string[] = [];
  const fn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    const step = script[calls.length - 1] ?? 'ok';
    if (step === 'ok') return Promise.resolve(new Response('[]', { status: 200 }));
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

afterEach(() => vi.restoreAllMocks());

describe('fetch Supabase avec délai maximal', () => {
  it('reconnaît les lectures relançables et les écritures', () => {
    expect(rpcName(`${BASE}list_maps`)).toBe('list_maps');
    expect(isRetryableRead(`${BASE}list_utilities`, 'POST')).toBe(true);
    expect(isRetryableRead(`${BASE}admin_list_utilities`, 'POST')).toBe(true);
    expect(isRetryableRead(`${BASE}admin_save_map`, 'POST')).toBe(false);
    expect(isRetryableRead(`${BASE}sync_upsert_match`, 'POST')).toBe(false);
    expect(isRetryableRead('https://exemple.supabase.co/auth/v1/user', 'GET')).toBe(true);
  });

  it('une lecture pendue est abandonnée puis relancée une fois', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const net = fakeNetwork(['hang', 'ok']);
    const f = makeResilientFetch(net.fn, { readTimeoutMs: 30 });
    const res = await f(`${BASE}list_maps`, { method: 'POST', body: '{}' });
    expect(res.status).toBe(200);
    expect(net.calls).toHaveLength(2);
  });

  it('une lecture pendue deux fois finit en erreur (pas d’attente infinie)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const net = fakeNetwork(['hang', 'hang']);
    const f = makeResilientFetch(net.fn, { readTimeoutMs: 30 });
    await expect(f(`${BASE}get_utility`, { method: 'POST', body: '{}' })).rejects.toBeDefined();
    expect(net.calls).toHaveLength(2);
  });

  it('une écriture n’est jamais relancée (pas de double enregistrement)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const net = fakeNetwork(['hang', 'ok']);
    const f = makeResilientFetch(net.fn, { writeTimeoutMs: 30 });
    await expect(f(`${BASE}admin_save_utility`, { method: 'POST', body: '{}' })).rejects.toBeDefined();
    expect(net.calls).toHaveLength(1);
  });
});
