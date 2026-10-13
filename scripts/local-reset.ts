/**
 * Réinitialise la base LOCALE de développement (.data/pglite).
 *   npm run local:reset            → base vide (comptes locaux conservés)
 *   npm run local:reset -- --demo  → base + jeu de démonstration fictif
 * Arrête d'abord `npm run dev` : la base locale ne supporte qu'un seul processus à la fois.
 * Pendant que le site tourne, utilise plutôt Admin › Synchronisation › Base locale.
 */
import { LOCAL_DATA_DIR, openLocalPg } from '../src/lib/db/local-pg';
import { resetLocalData } from '../src/lib/dev/local-reset';

async function main() {
  if (process.env.VERCEL) throw new Error('Interdit en production.');
  const demo = process.argv.includes('--demo');
  const pg = await openLocalPg(LOCAL_DATA_DIR);
  await resetLocalData(pg, { demo });
  const counts = await pg.query<{ t: string; n: number }>(
    `select 'joueurs' as t, count(*)::int as n from public.players
     union all select 'mur', count(*)::int from public.avoid_list_entries
     union all select 'relevés ELO', count(*)::int from public.elo_snapshots
     union all select 'matchs', count(*)::int from public.matches
     union all select 'stuffs', count(*)::int from public.utilities`,
  );
  await pg.close();
  console.log(`Base locale réinitialisée ${demo ? 'avec le jeu de démonstration' : '(vide)'} :`);
  for (const row of counts.rows) console.log(`  ${row.t} : ${row.n}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
