'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { failure, type ActionResult } from '@/lib/actions/result';
import { isShareCode, normalizeShareCode } from '@/lib/crosshairs';
import { call, getDb } from '@/lib/db';
import { crosshairPreviewSchema } from '@/lib/domain/schemas';

const inputSchema = z.object({
  id: z.uuid().nullish(),
  label: z.string().trim().min(2, 'Nom : 2 caractères minimum.').max(40, 'Nom : 40 caractères maximum.'),
  shareCode: z
    .string()
    .transform(normalizeShareCode)
    .refine(isShareCode, 'Code de partage invalide : attendu CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx.'),
  playerId: z.uuid().nullish(),
  notes: z.string().trim().max(280, 'Notes : 280 caractères maximum.').optional(),
  preview: crosshairPreviewSchema.nullable(),
  mapSlug: z.string().regex(/^[a-z0-9-]{1,30}$/).nullish(),
  gameVersion: z.string().trim().max(40).optional(),
  verifiedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  published: z.boolean(),
});
export type CrosshairInput = z.input<typeof inputSchema>;

function revalidate() {
  revalidatePath('/crosshairs');
  revalidatePath('/admin/crosshairs', 'layout');
}

export async function saveCrosshairAction(input: CrosshairInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const d = inputSchema.parse(input);
    const res = await call(await getDb(), 'admin_save_crosshair', { p: d }, z.object({ id: z.string() }));
    revalidate();
    return { ok: true, message: d.published ? 'Crosshair enregistré et publié.' : 'Crosshair enregistré (brouillon).', data: res };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, code: 'invalid', message: err.issues[0]?.message ?? 'Saisie invalide.' };
    return failure(err);
  }
}

export async function verifyCrosshairAction(id: string, gameVersion: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await (await getDb()).rpc('admin_verify_crosshair', { p_id: z.uuid().parse(id), p_game_version: gameVersion.slice(0, 40) });
    revalidate();
    return { ok: true, message: 'Marqué « testé en jeu aujourd’hui ».' };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteCrosshairAction(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await (await getDb()).rpc('admin_delete_crosshair', { p_id: z.uuid().parse(id) });
    revalidate();
    return { ok: true, message: 'Crosshair supprimé.' };
  } catch (err) {
    return failure(err);
  }
}
