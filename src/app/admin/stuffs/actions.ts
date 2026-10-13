'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { call, getDb } from '@/lib/db';
import { failure, type ActionResult } from '@/lib/actions/result';
import { deleteMedia, MAX_IMAGE_BYTES, putMedia, sniffImage } from '@/lib/storage';
import { slugify } from '@/lib/stuffs';
import { utilityInputSchema, type UtilityInput } from '@/lib/stuffs-input';
import { utilitySchema } from '@/lib/domain/schemas';



function revalidateStuffs(mapSlug: string) {
  revalidatePath('/stuffs');
  revalidatePath(`/stuffs/${mapSlug}`, 'layout');
  revalidatePath('/admin/stuffs', 'layout');
  revalidatePath('/');
}

export async function saveUtilityAction(input: UtilityInput): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    await requireAdmin();
    const d = utilityInputSchema.parse(input);
    const slug = d.slug || slugify(d.title);
    if (!slug) return { ok: false, code: 'invalid', message: 'Impossible de créer l’identifiant d’URL à partir du titre.' };
    const res = await call(
      await getDb(),
      'admin_save_utility',
      {
        p: {
          ...d,
          slug,
          steps: d.steps.filter((s) => s.length > 0),
          tags: d.tags.filter((t) => t.length > 0),
        },
      },
      z.object({ id: z.string(), slug: z.string() }),
    );
    revalidateStuffs(d.mapSlug);
    return { ok: true, message: d.status === 'published' ? 'Fiche enregistrée et publiée.' : 'Brouillon enregistré.', data: res };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, code: 'invalid', message: err.issues[0]?.message ?? 'Saisie invalide.' };
    return failure(err, { duplicate: 'Une fiche de cette map utilise déjà cet identifiant d’URL.' });
  }
}

async function getUtility(id: string) {
  const all = await call(await getDb(), 'admin_list_utilities', {}, z.array(utilitySchema));
  return all.find((u) => u.id === id) ?? null;
}

/** Téléversement d'une capture : 5 Mo max, PNG/JPEG/WebP vérifiés par leur contenu. */
export async function uploadUtilityImageAction(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = z.uuid().parse(form.get('utilityId'));
    const kind = z.enum(['placement', 'aim']).parse(form.get('kind'));
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return { ok: false, code: 'invalid', message: 'Choisis une image.' };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, code: 'invalid', message: 'Image trop lourde (5 Mo maximum).' };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) return { ok: false, code: 'invalid', message: 'Format refusé : PNG, JPEG ou WebP uniquement.' };
    const u = await getUtility(id);
    if (!u) return { ok: false, code: 'not_found', message: 'Fiche introuvable.' };
    const path = `utilities/${id}/${kind}-${randomBytes(4).toString('hex')}.${type.ext}`;
    await putMedia(path, bytes, type.contentType);
    await (await getDb()).rpc('admin_set_utility_image', { p_utility_id: id, p_kind: kind, p_path: path });
    await deleteMedia(kind === 'placement' ? u.placementImage : u.aimImage);
    revalidateStuffs(u.mapSlug);
    return { ok: true, message: 'Capture enregistrée.' };
  } catch (err) {
    return failure(err);
  }
}

export async function removeUtilityImageAction(utilityId: string, kind: 'placement' | 'aim'): Promise<ActionResult> {
  try {
    await requireAdmin();
    const u = await getUtility(z.uuid().parse(utilityId));
    if (!u) return { ok: false, code: 'not_found', message: 'Fiche introuvable.' };
    await (await getDb()).rpc('admin_set_utility_image', { p_utility_id: u.id, p_kind: kind, p_path: null });
    await deleteMedia(kind === 'placement' ? u.placementImage : u.aimImage);
    revalidateStuffs(u.mapSlug);
    return { ok: true, message: 'Capture retirée.' };
  } catch (err) {
    return failure(err);
  }
}

export async function markUtilityVerifiedAction(utilityId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const u = await getUtility(z.uuid().parse(utilityId));
    if (!u) return { ok: false, code: 'not_found', message: 'Fiche introuvable.' };
    await (await getDb()).rpc('admin_mark_utility_verified', { p_utility_id: u.id });
    revalidateStuffs(u.mapSlug);
    return { ok: true, message: 'Fiche marquée « vérifiée aujourd’hui » ; signalements clôturés.' };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteUtilityAction(utilityId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const u = await getUtility(z.uuid().parse(utilityId));
    if (!u) return { ok: false, code: 'not_found', message: 'Fiche introuvable.' };
    const res = await call(
      await getDb(),
      'admin_delete_utility',
      { p_utility_id: u.id },
      z.object({ paths: z.array(z.string()) }),
    );
    await Promise.all(res.paths.map((p) => deleteMedia(p)));
    revalidateStuffs(u.mapSlug);
    return { ok: true, message: 'Fiche supprimée.' };
  } catch (err) {
    return failure(err);
  }
}
