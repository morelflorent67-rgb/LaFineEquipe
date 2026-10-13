'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMember } from '@/lib/auth/guards';
import { getDb } from '@/lib/db';
import { failure, type ActionResult } from '@/lib/actions/result';

const reportSchema = z.object({
  utilityId: z.uuid(),
  note: z.string().trim().max(280, 'Note limitée à 280 caractères.').default(''),
  path: z.string().regex(/^\/stuffs\/[a-z0-9-]+\/[a-z0-9-]+$/),
});

/** Un membre signale qu'une fiche ne fonctionne plus (ex. après une mise à jour CS2). */
export async function reportUtilityAction(input: z.input<typeof reportSchema>): Promise<ActionResult> {
  try {
    await requireMember();
    const d = reportSchema.parse(input);
    await (await getDb()).rpc('report_utility', { p_utility_id: d.utilityId, p_note: d.note || null });
    revalidatePath(d.path);
    revalidatePath(d.path.split('/').slice(0, 3).join('/'));
    return { ok: true, message: 'Merci : la fiche est signalée « à revérifier ».' };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, code: 'invalid', message: err.issues[0]?.message ?? 'Saisie invalide.' };
    return failure(err, { duplicate: 'Tu as déjà signalé cette fiche : un admin va la revérifier.' });
  }
}
