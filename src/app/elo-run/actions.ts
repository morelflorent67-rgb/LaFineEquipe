'use server';

import { revalidatePath } from 'next/cache';
import { getServiceDb } from '@/lib/db';
import { DbError } from '@/lib/db/errors';
import { createFaceitClient } from '@/lib/faceit/client';
import { failure, type ActionResult } from '@/lib/actions/result';
import { syncMatches, syncProfiles } from '@/lib/sync/run-sync';

/**
 * Bouton « Actualiser » du classement, ouvert à tous. La base refuse (LFE_TOO_SOON) tout
 * passage à moins de 2 minutes du précédent, pour tout le site : le nombre d'appels FACEIT
 * reste borné quel que soit le nombre de visiteurs. Les pages ne lisent toujours que la base.
 */
export async function publicRefreshAction(): Promise<ActionResult<{ retryAt?: string }>> {
  try {
    const db = getServiceDb();
    const client = createFaceitClient();
    const profiles = await syncProfiles(db, 'public', client);
    try {
      await syncMatches(db, 'public', client);
    } catch (err) {
      // Les matchs ont pu être synchronisés juste avant : le classement, lui, est à jour.
      if (!(err instanceof DbError && (err.code === 'busy' || err.code === 'too_soon'))) throw err;
    }
    revalidatePath('/elo-run');
    revalidatePath('/');
    if (profiles.status === 'error') {
      return { ok: false, code: 'faceit', message: 'FACEIT ne répond pas : les dernières valeurs valides sont conservées.' };
    }
    return { ok: true, message: `Classement actualisé (${profiles.ok} profil${profiles.ok > 1 ? 's' : ''} relu${profiles.ok > 1 ? 's' : ''}).` };
  } catch (err) {
    if (err instanceof DbError && err.code === 'too_soon') {
      const retryAt = typeof err.detail?.retryAt === 'string' ? err.detail.retryAt : undefined;
      return { ok: false, code: 'too_soon', message: 'Le classement vient d’être actualisé : réessaie dans un instant.', detail: { retryAt } };
    }
    return failure(err, { busy: 'Une actualisation est déjà en cours.' });
  }
}
