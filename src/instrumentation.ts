/**
 * Synchronisation planifiée en DÉVELOPPEMENT LOCAL uniquement (base .data + vraie API FACEIT).
 * En ligne, c'est Supabase Cron (supabase/cron.sql) qui appelle /api/cron/sync toutes les 5 min ;
 * en local il n'y a pas de Supabase Cron, donc le serveur de dev lance lui-même la même synchro.
 */
declare global {
  var __lfeLocalCron: ReturnType<typeof setInterval> | undefined;
}

const EVERY_MS = 5 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.LFE_HOSTED === '1') return;
  if (process.env.LFE_DATA_BACKEND !== 'local' || process.env.FACEIT_MODE !== 'live') return;
  if (process.env.LFE_LOCAL_CRON === 'off' || globalThis.__lfeLocalCron) return;

  const { getServiceDb } = await import('@/lib/db');
  const { runAllSyncs } = await import('@/lib/sync/run-sync');
  const tick = async () => {
    try {
      const reports = await runAllSyncs(getServiceDb(), 'cron');
      console.log(`[synchro locale] ${reports.map((r) => `${r.job} : ${r.status} (${r.ok} ok, ${r.failed} échec)`).join(' · ')}`);
    } catch (err) {
      // Synchro déjà en cours ou base occupée : on réessaiera au prochain passage.
      console.warn('[synchro locale] passage ignoré :', err instanceof Error ? err.message : err);
    }
  };
  globalThis.__lfeLocalCron = setInterval(tick, EVERY_MS);
  setTimeout(tick, 20_000); // premier passage peu après le démarrage
  console.log('[synchro locale] FACEIT toutes les 5 min (désactivable : LFE_LOCAL_CRON=off)');
}
