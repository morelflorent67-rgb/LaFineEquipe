import type { PGlite } from '@electric-sql/pglite';
import { buildDemoSql, RESET_SQL } from './demo-seed';

/**
 * Réinitialise la base LOCALE : vide les données (comptes locaux conservés) et, si demandé,
 * charge le jeu de démonstration fictif. Ne concerne jamais Supabase.
 */
export async function resetLocalData(pg: PGlite, options: { demo: boolean; now?: Date }): Promise<void> {
  await pg.transaction(async (tx) => {
    await tx.exec(RESET_SQL);
    if (options.demo) await tx.exec(buildDemoSql(options.now ?? new Date()));
  });
}
