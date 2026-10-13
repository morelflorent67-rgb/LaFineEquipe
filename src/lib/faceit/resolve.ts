import 'server-only';
import { acceptAvatarUrl } from './avatar';
import { createFaceitClient, type FaceitClient } from './client';
import { FaceitError } from './errors';
import type { FaceitInput } from './input';
import { toProfileInput, type FaceitProfileInput } from './profile';

export type FaceitSuggestion = {
  faceitPlayerId: string;
  nickname: string;
  avatarUrl: string | null;
  country: string | null;
  cs2Level: number | null;
};

export type ResolveResult =
  | { status: 'found'; profile: FaceitProfileInput; via: 'nickname' | 'id' | 'search' }
  | { status: 'not_found'; suggestions: FaceitSuggestion[] };

/** Récupère un profil complet par son identifiant FACEIT (référence stable). */
export async function fetchProfileById(id: string, client: FaceitClient = createFaceitClient()) {
  const raw = await client.playerById(id);
  return toProfileInput(raw, new Date(), client.mode === 'fixtures');
}

/**
 * Pseudo → recherche exacte ; si FACEIT ne trouve rien (la recherche exacte est sensible
 * à la casse), on interroge la recherche FACEIT et on propose des profils proches.
 * Un seul profil au pseudo identique (casse ignorée) est retenu automatiquement :
 * l'admin le vérifie dans l'aperçu avant toute confirmation.
 */
export async function resolveFaceitPlayer(input: FaceitInput): Promise<ResolveResult> {
  const client = createFaceitClient();
  const fixtures = client.mode === 'fixtures';
  try {
    if (input.kind === 'id') {
      return { status: 'found', profile: await fetchProfileById(input.value, client), via: 'id' };
    }
    const raw = await client.playerByNickname(input.value);
    return { status: 'found', profile: toProfileInput(raw, new Date(), fixtures), via: 'nickname' };
  } catch (err) {
    if (!(err instanceof FaceitError) || err.kind !== 'not_found') throw err;
  }
  if (input.kind === 'id') return { status: 'not_found', suggestions: [] };

  let items: Awaited<ReturnType<FaceitClient['searchPlayers']>>['items'] = [];
  try {
    items = (await client.searchPlayers(input.value, 6)).items;
  } catch (err) {
    if (err instanceof FaceitError && err.kind !== 'not_found' && err.kind !== 'bad_request') throw err;
  }
  const suggestions: FaceitSuggestion[] = items.map((it) => {
    const cs2 = it.games?.find((g) => g.name === 'cs2');
    const level = cs2?.skill_level == null ? NaN : Number(cs2.skill_level);
    return {
      faceitPlayerId: it.player_id.toLowerCase(),
      nickname: it.nickname,
      avatarUrl: acceptAvatarUrl(it.avatar, fixtures),
      country: it.country && /^[a-z]{2}$/i.test(it.country) ? it.country.toLowerCase() : null,
      cs2Level: Number.isInteger(level) && level >= 1 && level <= 10 ? level : null,
    };
  });
  const same = suggestions.filter((s) => s.nickname.toLowerCase() === input.value.toLowerCase());
  if (same.length === 1) {
    return { status: 'found', profile: await fetchProfileById(same[0]!.faceitPlayerId, client), via: 'search' };
  }
  return { status: 'not_found', suggestions };
}
