'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { call, getDb } from '@/lib/db';
import { failure, type ActionResult } from '@/lib/actions/result';
import { deleteMedia, MAX_IMAGE_BYTES, putMedia, sniffImage } from '@/lib/storage';

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Identifiant : lettres minuscules, chiffres et tirets.').max(30);
const pct = z.number().min(0).max(100).transform((v) => Math.round(v * 100) / 100);

function revalidateMaps(mapSlug?: string) {
  revalidatePath('/stuffs', 'layout');
  revalidatePath('/admin/maps', 'layout');
  revalidatePath('/admin/stuffs', 'layout');
  revalidatePath('/');
  if (mapSlug) revalidatePath(`/stuffs/${mapSlug}`, 'layout');
}

function invalid(err: unknown): ActionResult<never> | null {
  return err instanceof z.ZodError ? { ok: false, code: 'invalid', message: err.issues[0]?.message ?? 'Saisie invalide.' } : null;
}

/** Nouvelle map : masquée tant que l'admin ne l'a pas rendue visible (le temps d'ajouter ses images). */
export async function createMapAction(input: { slug: string; name: string }): Promise<ActionResult<{ slug: string }>> {
  try {
    await requireAdmin();
    const d = z
      .object({ slug: slugSchema, name: z.string().trim().min(2, 'Nom : 2 caractères minimum.').max(40) })
      .parse(input);
    await (await getDb()).rpc('admin_save_map', { p: { slug: d.slug, name: d.name, active: false, create: true } });
    revalidateMaps();
    return { ok: true, message: `${d.name} ajoutée (masquée). Ajoute sa capture puis rends-la visible.`, data: { slug: d.slug } };
  } catch (err) {
    return invalid(err) ?? failure(err, { duplicate: 'Une map utilise déjà cet identifiant.' });
  }
}

export async function updateMapAction(input: { slug: string; name?: string; active?: boolean }): Promise<ActionResult> {
  try {
    await requireAdmin();
    const d = z
      .object({ slug: slugSchema, name: z.string().trim().min(2).max(40).optional(), active: z.boolean().optional() })
      .parse(input);
    await (await getDb()).rpc('admin_save_map', { p: d });
    revalidateMaps(d.slug);
    const message = d.active === undefined ? 'Map enregistrée.' : d.active ? 'Map visible sur le site.' : 'Map masquée du site.';
    return { ok: true, message };
  } catch (err) {
    return invalid(err) ?? failure(err);
  }
}

export async function moveMapAction(slug: string, direction: -1 | 1): Promise<ActionResult> {
  try {
    await requireAdmin();
    await (await getDb()).rpc('admin_move_map', { p_slug: slugSchema.parse(slug), p_direction: direction < 0 ? -1 : 1 });
    revalidateMaps();
    return { ok: true, message: 'Ordre mis à jour.' };
  } catch (err) {
    return invalid(err) ?? failure(err);
  }
}

export async function deleteMapAction(slug: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const res = await call(
      await getDb(),
      'admin_delete_map',
      { p_slug: slugSchema.parse(slug) },
      z.object({ paths: z.array(z.string()) }),
    );
    await Promise.all(res.paths.map((p) => deleteMedia(p)));
    revalidateMaps();
    return { ok: true, message: 'Map supprimée.' };
  } catch (err) {
    return (
      invalid(err) ??
      failure(err, { in_use: 'Cette map a encore des fiches : supprime-les ou masque la map à la place.' })
    );
  }
}

/** Vignette (vraie capture) ou vue aérienne : 5 Mo max, PNG/JPEG/WebP vérifiés par leur contenu. */
export async function uploadMapImageAction(form: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const slug = slugSchema.parse(form.get('mapSlug'));
    const kind = z.enum(['cover', 'aerial']).parse(form.get('kind'));
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return { ok: false, code: 'invalid', message: 'Choisis une image.' };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, code: 'invalid', message: 'Image trop lourde (5 Mo maximum).' };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) return { ok: false, code: 'invalid', message: 'Format refusé : PNG, JPEG ou WebP uniquement.' };
    const path = `maps/${slug}/${kind}-${randomBytes(4).toString('hex')}.${type.ext}`;
    await putMedia(path, bytes, type.contentType);
    let oldPath: string | null;
    try {
      ({ oldPath } = await call(
        await getDb(),
        'admin_set_map_image',
        { p_slug: slug, p_kind: kind, p_path: path },
        z.object({ oldPath: z.string().nullable() }),
      ));
    } catch (err) {
      await deleteMedia(path);
      throw err;
    }
    await deleteMedia(oldPath);
    revalidateMaps(slug);
    return { ok: true, message: kind === 'cover' ? 'Capture de la map enregistrée.' : 'Vue aérienne enregistrée.' };
  } catch (err) {
    return invalid(err) ?? failure(err);
  }
}

export async function removeMapImageAction(slug: string, kind: 'cover' | 'aerial'): Promise<ActionResult> {
  try {
    await requireAdmin();
    const res = await call(
      await getDb(),
      'admin_set_map_image',
      { p_slug: slugSchema.parse(slug), p_kind: z.enum(['cover', 'aerial']).parse(kind), p_path: null },
      z.object({ oldPath: z.string().nullable() }),
    );
    await deleteMedia(res.oldPath);
    revalidateMaps(slug);
    return { ok: true, message: 'Image retirée.' };
  } catch (err) {
    return invalid(err) ?? failure(err);
  }
}

/** Position de lancer placée à la main sur la vue aérienne (coordonnées en % de l'image carrée). */
export async function savePositionAction(input: {
  id?: string | null;
  mapSlug: string;
  name?: string;
  x?: number;
  y?: number;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const d = z
      .object({
        id: z.uuid().nullish(),
        mapSlug: slugSchema,
        name: z.string().trim().min(1, 'Donne un nom à la position.').max(40, 'Nom : 40 caractères maximum.').optional(),
        x: pct.optional(),
        y: pct.optional(),
      })
      .parse(input);
    if (!d.id && (d.name === undefined || d.x === undefined || d.y === undefined)) {
      return { ok: false, code: 'invalid', message: 'Nom et emplacement requis.' };
    }
    const res = await call(await getDb(), 'admin_save_position', { p: d }, z.object({ id: z.string() }));
    revalidateMaps(d.mapSlug);
    return { ok: true, message: d.id ? 'Position mise à jour.' : 'Position ajoutée.', data: res };
  } catch (err) {
    return invalid(err) ?? failure(err);
  }
}

export async function deletePositionAction(id: string, mapSlug: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await (await getDb()).rpc('admin_delete_position', { p_position_id: z.uuid().parse(id) });
    revalidateMaps(slugSchema.parse(mapSlug));
    return { ok: true, message: 'Position supprimée ; les fiches rattachées sont détachées.' };
  } catch (err) {
    return invalid(err) ?? failure(err);
  }
}

/** Rattache une fiche à une position de lancer et place (ou retire) son point d'impact. */
export async function linkUtilityAction(input: {
  utilityId: string;
  mapSlug: string;
  positionId: string | null;
  landing: { x: number; y: number } | null;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const d = z
      .object({
        utilityId: z.uuid(),
        mapSlug: slugSchema,
        positionId: z.uuid().nullable(),
        landing: z.object({ x: pct, y: pct }).nullable(),
      })
      .parse(input);
    await (await getDb()).rpc('admin_link_utility', {
      p_utility_id: d.utilityId,
      p_position_id: d.positionId,
      p_landing_x: d.landing?.x ?? null,
      p_landing_y: d.landing?.y ?? null,
    });
    revalidateMaps(d.mapSlug);
    return { ok: true, message: 'Fiche mise à jour sur la carte.' };
  } catch (err) {
    return invalid(err) ?? failure(err, { invalid: 'Cette position appartient à une autre map.' });
  }
}
