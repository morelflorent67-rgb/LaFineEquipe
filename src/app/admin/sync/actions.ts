'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { getDb, getServiceDb } from '@/lib/db';
import { getLocalPg } from '@/lib/db/local-pg';
import { resetLocalData } from '@/lib/dev/local-reset';
import { getServerEnv } from '@/lib/env';
import { failure, type ActionResult } from '@/lib/actions/result';
import { runAllSyncs } from '@/lib/sync/run-sync';

/** Lancement manuel (bouton admin). Utilise le rôle service, comme la tâche planifiée. */
export async function runSyncNowAction(): Promise<ActionResult> {
  try {
    await requireAdmin();
    const reports = await runAllSyncs(getServiceDb(), 'admin');
    revalidatePath('/', 'layout');
    const bad = reports.some((r) => r.status === 'error');
    return bad
      ? { ok: false, code: 'sync', message: reports.map((r) => r.message).join(' ') }
      : { ok: true, message: reports.map((r) => r.message).join(' ') };
  } catch (err) {
    return failure(err);
  }
}

const liveSchema = z.object({
  source: z.enum(['none', 'history_polling', 'webhook']),
  note: z.string().trim().max(500).default(''),
});

/** À n'utiliser qu'après validation réelle d'une source par le spike (docs/faceit-feasibility.md). */
export async function setLiveDetectionAction(input: z.input<typeof liveSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const d = liveSchema.parse(input);
    if (d.source !== 'none' && d.note.length < 10) {
      return { ok: false, code: 'invalid', message: 'Décris le test réel qui valide cette source (10 caractères minimum).' };
    }
    await (await getDb()).rpc('admin_set_live_detection', { p_source: d.source, p_note: d.note });
    revalidatePath('/', 'layout');
    return { ok: true, message: d.source === 'none' ? 'Matchs en cours : « Statut indisponible ».' : 'Source enregistrée.' };
  } catch (err) {
    return failure(err);
  }
}

/** Mode LOCAL uniquement : vide la base de dev ou charge le jeu de démonstration fictif. */
export async function resetLocalDataAction(demo: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (getServerEnv().backend !== 'local') {
      return { ok: false, code: 'forbidden', message: 'Disponible uniquement avec la base locale de développement.' };
    }
    await resetLocalData(await getLocalPg(), { demo });
    revalidatePath('/', 'layout');
    return { ok: true, message: demo ? 'Jeu de démonstration chargé.' : 'Base locale vidée (comptes locaux conservés).' };
  } catch (err) {
    return failure(err);
  }
}
