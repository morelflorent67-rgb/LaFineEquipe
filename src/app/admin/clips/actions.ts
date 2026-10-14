'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { failure, type ActionResult } from '@/lib/actions/result';
import { call, getDb } from '@/lib/db';
import { clipInputSchema, type ClipInput } from '@/lib/clips/schemas';
import { parseClipSource } from '@/lib/clips/providers';

function revalidate() {
  revalidatePath('/clips');
  revalidatePath('/');
  revalidatePath('/admin/clips', 'layout');
}

export async function saveClipAction(input: ClipInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const d = clipInputSchema.parse(input);
    const source = parseClipSource(d.sourceUrl)!;
    const result = await call(
      await getDb(),
      'admin_save_clip',
      { p: { ...d, ...source } },
      z.object({ id: z.uuid() }),
    );
    revalidate();
    return {
      ok: true,
      message: d.published ? 'Clip enregistré et publié.' : 'Clip enregistré en brouillon.',
      data: result,
    };
  } catch (err) {
    if (err instanceof z.ZodError)
      return { ok: false, code: 'invalid', message: err.issues[0]?.message ?? 'Saisie invalide.' };
    return failure(err, {
      duplicate: 'Cette vidéo est déjà dans la bibliothèque, éventuellement en brouillon.',
    });
  }
}

export async function deleteClipAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await (await getDb()).rpc('admin_delete_clip', { p_id: z.uuid().parse(id) });
    revalidate();
    return { ok: true, message: 'Clip supprimé de la bibliothèque.' };
  } catch (err) {
    return failure(err);
  }
}
