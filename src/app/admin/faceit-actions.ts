'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { call, getDb } from '@/lib/db';
import { faceitUsageSchema, type FaceitUsage } from '@/lib/domain/schemas';
import { FACEIT_ID, faceitProfileUrl, parseFaceitInput, shortFaceitId } from '@/lib/faceit/input';
import { FaceitError } from '@/lib/faceit/errors';
import { fetchProfileById, resolveFaceitPlayer, type FaceitSuggestion } from '@/lib/faceit/resolve';
import type { FaceitProfileInput } from '@/lib/faceit/profile';
import { getServerEnv } from '@/lib/env';
import { failure, type ActionResult } from '@/lib/actions/result';

/** Aperçu présenté à l'admin AVANT toute confirmation. */
export type FaceitPreview = {
  faceitPlayerId: string;
  shortId: string;
  nickname: string;
  avatarUrl: string | null;
  avatarRejected: boolean;
  country: string | null;
  cs2Level: number | null;
  cs2Elo: number | null;
  hasCs2: boolean;
  faceitUrl: string;
  fetchedAt: string;
  via: 'nickname' | 'id' | 'search';
  source: 'faceit' | 'fixtures';
};

export type LookupResult =
  | { kind: 'found'; preview: FaceitPreview; usage: FaceitUsage }
  | { kind: 'not_found'; query: string; suggestions: FaceitSuggestion[] }
  | { kind: 'error'; message: string; code: string };

function toPreview(p: FaceitProfileInput, via: FaceitPreview['via']): FaceitPreview {
  return {
    faceitPlayerId: p.faceitPlayerId,
    shortId: shortFaceitId(p.faceitPlayerId),
    nickname: p.nickname,
    avatarUrl: p.avatarUrl,
    avatarRejected: p.avatarRejected,
    country: p.country,
    cs2Level: p.cs2Level,
    cs2Elo: p.cs2Elo,
    hasCs2: p.hasCs2,
    faceitUrl: faceitProfileUrl(p.nickname),
    fetchedAt: p.fetchedAt,
    via,
    source: getServerEnv().faceit.mode === 'fixtures' ? 'fixtures' : 'faceit',
  };
}

/** Champs transmis aux fonctions SQL (le profil revient TOUJOURS d'un appel FACEIT côté serveur). */
const toDbProfile = (p: FaceitProfileInput) => ({
  faceitPlayerId: p.faceitPlayerId,
  nickname: p.nickname,
  avatarUrl: p.avatarUrl,
  country: p.country,
  cs2Level: p.cs2Level,
  cs2Elo: p.cs2Elo,
  fetchedAt: p.fetchedAt,
});

/** Étape 1 : pseudo, lien ou identifiant → profil FACEIT vérifié + doublons éventuels. */
export async function lookupFaceitAction(raw: string): Promise<LookupResult> {
  try {
    await requireAdmin();
    const parsed = parseFaceitInput(String(raw ?? ''));
    if (!parsed.ok) return { kind: 'error', code: 'invalid_input', message: parsed.reason };
    const res = await resolveFaceitPlayer(parsed.input);
    if (res.status === 'not_found') return { kind: 'not_found', query: parsed.input.value, suggestions: res.suggestions };
    const usage = await call(
      await getDb(),
      'admin_faceit_usage',
      { p_faceit_player_id: res.profile.faceitPlayerId },
      faceitUsageSchema,
    );
    return { kind: 'found', preview: toPreview(res.profile, res.via), usage };
  } catch (err) {
    const f = failure(err);
    return { kind: 'error', code: f.ok ? 'unknown' : f.code, message: f.message };
  }
}

const idSchema = z.string().regex(FACEIT_ID, 'Identifiant FACEIT invalide');

/** Recharge le profil depuis FACEIT par son identifiant complet : on ne fait jamais confiance au navigateur. */
async function freshProfile(faceitPlayerId: string) {
  return fetchProfileById(idSchema.parse(faceitPlayerId).toLowerCase());
}

const addPlayerSchema = z.object({ faceitPlayerId: idSchema, group: z.enum(['team', 'guest']) });

export async function addPlayerAction(input: z.input<typeof addPlayerSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const data = addPlayerSchema.parse(input);
    const profile = await freshProfile(data.faceitPlayerId);
    // Profil, joueur et premier relevé ELO enregistrés ensemble : le joueur entre tout de
    // suite au classement à son ELO actuel, avec une progression de 0.
    const res = await call(
      await getDb(),
      'admin_add_player',
      { p_profile: toDbProfile(profile), p_group: data.group },
      z.object({ id: z.string() }),
    );
    revalidatePath('/', 'layout');
    return {
      ok: true,
      message:
        profile.cs2Elo !== null
          ? `${profile.nickname} ajouté au classement à ${profile.cs2Elo} ELO.`
          : `${profile.nickname} ajouté (pas d’ELO CS2 sur FACEIT pour l’instant).`,
      data: res,
    };
  } catch (err) {
    return failure(err, { duplicate: 'Ce profil FACEIT est déjà dans le roster.' });
  }
}

const addAvoidSchema = z.object({
  faceitPlayerId: idSchema,
  reason: z.string().trim().max(280, 'Motif limité à 280 caractères.').optional().default(''),
  status: z.enum(['active', 'archived']).default('active'),
});

export async function addAvoidEntryAction(input: z.input<typeof addAvoidSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
    const data = addAvoidSchema.parse(input);
    const profile = await freshProfile(data.faceitPlayerId);
    const res = await call(
      await getDb(),
      'admin_add_avoid_entry',
      { p_profile: toDbProfile(profile), p_reason: data.reason || null, p_status: data.status },
      z.object({ id: z.string() }),
    );
    revalidatePath('/mur-des-lamentations');
    revalidatePath('/admin/mur');
    return { ok: true, message: `${profile.nickname} ajouté au Mur.`, data: res };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, code: 'invalid', message: err.issues[0]?.message ?? 'Saisie invalide.' };
    return failure(err, { duplicate: 'Ce profil FACEIT est déjà sur le Mur.' });
  }
}

const updateAvoidSchema = z.object({
  entryId: z.uuid(),
  reason: z.string().trim().max(280, 'Motif limité à 280 caractères.').default(''),
  status: z.enum(['active', 'archived']),
});

export async function updateAvoidEntryAction(input: z.input<typeof updateAvoidSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const data = updateAvoidSchema.parse(input);
    await (await getDb()).rpc('admin_update_avoid_entry', {
      p_entry_id: data.entryId,
      p_reason: data.reason || null,
      p_status: data.status,
    });
    revalidatePath('/mur-des-lamentations');
    revalidatePath('/admin/mur');
    return { ok: true, message: 'Entrée mise à jour.' };
  } catch (err) {
    if (err instanceof z.ZodError) return { ok: false, code: 'invalid', message: err.issues[0]?.message ?? 'Saisie invalide.' };
    return failure(err);
  }
}

export async function setAvoidStatusAction(entryId: string, status: 'active' | 'archived', reason: string | null) {
  return updateAvoidEntryAction({ entryId, status, reason: reason ?? '' });
}

export async function deleteAvoidEntryAction(entryId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await (await getDb()).rpc('admin_delete_avoid_entry', { p_entry_id: z.uuid().parse(entryId) });
    revalidatePath('/mur-des-lamentations');
    revalidatePath('/admin/mur');
    return { ok: true, message: 'Entrée retirée définitivement du Mur.' };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Rafraîchit un profil suivi. En cas d'échec FACEIT, les dernières données valides sont
 * conservées et l'échec est noté (date + code) pour l'affichage.
 */
export async function refreshProfileAction(faceitPlayerId: string, scope: 'roster' | 'avoid'): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = idSchema.parse(faceitPlayerId).toLowerCase();
    const db = await getDb();
    try {
      const profile = await fetchProfileById(id);
      await db.rpc(scope === 'roster' ? 'admin_record_profile' : 'admin_save_profile', { p_profile: toDbProfile(profile) });
    } catch (err) {
      if (err instanceof FaceitError) {
        await db.rpc('admin_mark_profile_error', { p_faceit_player_id: id, p_code: err.kind });
        revalidatePath('/', 'layout');
        return failure(err);
      }
      throw err;
    }
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Profil mis à jour depuis FACEIT.' };
  } catch (err) {
    return failure(err);
  }
}

const updatePlayerSchema = z.object({
  playerId: z.uuid(),
  group: z.enum(['team', 'guest']),
  active: z.boolean(),
  displayOrder: z.number().int().min(0).max(100000),
});

export async function updatePlayerAction(input: z.input<typeof updatePlayerSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const d = updatePlayerSchema.parse(input);
    const db = await getDb();
    const res = await call(
      db,
      'admin_update_player',
      { p_player_id: d.playerId, p_group: d.group, p_active: d.active, p_display_order: d.displayOrder },
      z.object({ reactivated: z.boolean() }),
    );
    if (res.reactivated) {
      // Retour au classement : nouvel ELO d'ajout = relevé pris maintenant.
      const player = await call(db, 'get_player', { p_player_id: d.playerId }, z.object({ profile: z.object({ faceitPlayerId: z.string() }) }));
      try {
        const profile = await fetchProfileById(player.profile.faceitPlayerId);
        await db.rpc('admin_record_profile', { p_profile: toDbProfile(profile) });
      } catch (err) {
        if (!(err instanceof FaceitError)) throw err;
        revalidatePath('/', 'layout');
        return { ok: true, message: 'Joueur réactivé. FACEIT ne répond pas : son ELO d’ajout sera pris à la prochaine synchro.' };
      }
    }
    revalidatePath('/', 'layout');
    return { ok: true, message: res.reactivated ? 'Joueur de retour au classement, progression remise à 0.' : 'Joueur mis à jour.' };
  } catch (err) {
    return failure(err);
  }
}

export async function deletePlayerAction(playerId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await (await getDb()).rpc('admin_delete_player', { p_player_id: z.uuid().parse(playerId) });
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Joueur supprimé du roster.' };
  } catch (err) {
    return failure(err, {
      in_use: 'Ce joueur a des matchs enregistrés : désactive-le plutôt (il sort du classement, son historique est gardé).',
    });
  }
}
