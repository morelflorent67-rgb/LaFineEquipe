import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { call, getDb } from '@/lib/db';
import { mapCoversByKey } from '@/lib/media';
import { clipSchema } from '@/lib/clips/schemas';
import {
  catalogSchema,
  crosshairSchema,
  mapSchema,
  utilityDetailSchema,
  utilitySchema,
  adminAvoidEntrySchema,
  avoidEntrySchema,
  wallOfShameSchema,
  liveStateSchema,
  matchSchema,
  playerSchema,
  eloHistorySchema,
  recentResultsSchema,
  refreshStatusSchema,
  syncRunSchema,
  syncStatusSchema,
  type AvoidStatus,
  type RecentResult,
} from '@/lib/domain/schemas';

/**
 * Couche d'accès aux données en lecture. Chaque fonction passe par la RLS avec les droits
 * de la personne connectée, et valide la forme de la réponse.
 */
export async function getRoster(includeInactive = false) {
  return call(await getDb(), 'list_roster', { p_include_inactive: includeInactive }, z.array(playerSchema));
}

export async function getPlayer(playerId: string) {
  return call(await getDb(), 'get_player', { p_player_id: playerId }, playerSchema.nullable());
}

/** Mur public : seules les entrées actives, jamais les notes internes. */
export async function getAvoidEntries(status: AvoidStatus | 'all' = 'active') {
  return call(await getDb(), 'list_avoid_entries', { p_status: status }, z.array(avoidEntrySchema));
}

/** Wall of Shame des joueurs « team » sur les N derniers jours (30 par défaut). */
export async function getWallOfShame(days = 30) {
  return call(await getDb(), 'wall_of_shame', { p_days: days }, wallOfShameSchema);
}

export async function adminGetAvoidEntries(status: AvoidStatus | 'all' = 'all') {
  return call(await getDb(), 'admin_list_avoid_entries', { p_status: status }, z.array(adminAvoidEntrySchema));
}

/** Relevés ELO d'un joueur depuis son ajout au classement. */
export async function getEloHistory(playerId: string) {
  return call(await getDb(), 'get_elo_history', { p_player_id: playerId }, eloHistorySchema);
}

/** Fraîcheur du classement et disponibilité du bouton « Actualiser ». */
export async function getRefreshStatus() {
  return call(await getDb(), 'refresh_status', {}, refreshStatusSchema);
}

export async function getRecentMatches(limit = 10, playerId?: string) {
  return call(
    await getDb(),
    'list_recent_matches',
    { p_limit: limit, p_player_id: playerId ?? null },
    z.array(matchSchema),
  );
}

export async function getRecentResults(playerIds: string[], n = 5): Promise<Map<string, RecentResult[]>> {
  if (playerIds.length === 0) return new Map();
  const rows = await call(await getDb(), 'recent_results', { p_player_ids: playerIds, p_n: n }, recentResultsSchema);
  return new Map(rows.map((r) => [r.playerId, r.results]));
}

export async function getLiveStateRow() {
  return call(await getDb(), 'get_live_state', {}, liveStateSchema);
}

export async function getSyncStatus() {
  return call(await getDb(), 'get_sync_status', {}, syncStatusSchema);
}

export async function adminGetSyncRuns(limit = 30) {
  return call(await getDb(), 'admin_list_sync_runs', { p_limit: limit }, z.array(syncRunSchema));
}

export async function getMaps(includeDrafts = false) {
  return call(await getDb(), 'list_maps', { p_include_drafts: includeDrafts }, z.array(mapSchema));
}

/** Captures des maps (y compris masquées) indexées par clé FACEIT, pour illustrer les matchs. */
export async function getMapCovers(): Promise<Record<string, string>> {
  const rows = await call(
    await getDb(),
    'list_map_covers',
    {},
    z.array(z.object({ faceitKey: z.string(), coverPath: z.string().nullable(), imagePath: z.string().nullable() })),
  );
  return mapCoversByKey(rows);
}

export async function getCatalog(mapSlug: string, includeDrafts = false) {
  return call(await getDb(), 'list_utilities', { p_map_slug: mapSlug, p_include_drafts: includeDrafts }, catalogSchema);
}

export async function getUtilityDetail(mapSlug: string, slug: string) {
  return call(await getDb(), 'get_utility', { p_map_slug: mapSlug, p_slug: slug }, utilityDetailSchema);
}

export async function getCrosshairs(includeDrafts = false) {
  return call(await getDb(), 'list_crosshairs', { p_include_drafts: includeDrafts }, z.array(crosshairSchema));
}

export async function getClips(includeDrafts = false) {
  return call(await getDb(), 'list_clips', { p_include_drafts: includeDrafts }, z.array(clipSchema));
}

export async function adminGetUtilities() {
  return call(await getDb(), 'admin_list_utilities', {}, z.array(utilitySchema));
}

export type Settled<T> = { ok: true; data: T } | { ok: false; error: unknown };

/** Exécute une requête sans faire échouer toute la page : la section affiche alors son état d'erreur. */
export async function settle<T>(promise: Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    // Les signaux internes de Next.js (rendu dynamique, redirection…) ne sont pas des erreurs de données.
    unstable_rethrow(error);
    console.error('[data]', error instanceof Error ? `${error.name}: ${error.message}` : error);
    return { ok: false, error };
  }
}
