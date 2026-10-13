/**
 * Lance une synchronisation FACEIT complète depuis le terminal (profils + matchs).
 *   npm run sync
 * En mode local, arrête d'abord `npm run dev` (la base locale n'accepte qu'un processus) ;
 * sinon utilise le bouton Admin › Synchronisation.
 */
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

async function main() {
  const { getServiceDb } = await import('../src/lib/db');
  const { runAllSyncs } = await import('../src/lib/sync/run-sync');
  const reports = await runAllSyncs(getServiceDb(), 'script');
  for (const r of reports) console.log(`${r.status.padEnd(8)} ${r.message}`);
  if (reports.some((r) => r.status === 'error')) process.exit(2);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
