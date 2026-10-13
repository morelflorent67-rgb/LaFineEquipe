import { acceptAvatarUrl } from './avatar';
import { FaceitError } from './errors';
import { FACEIT_ID } from './input';
import type { FaceitRawPlayer } from './schemas';

/** Profil prêt à être enregistré (format attendu par les fonctions SQL). */
export type FaceitProfileInput = {
  faceitPlayerId: string;
  nickname: string;
  avatarUrl: string | null;
  country: string | null;
  cs2Level: number | null;
  cs2Elo: number | null;
  fetchedAt: string;
  /** FACEIT a-t-il renvoyé des données CS2 ? */
  hasCs2: boolean;
  /** Un avatar était fourni mais son adresse n'est pas autorisée. */
  avatarRejected: boolean;
};

export function toProfileInput(raw: FaceitRawPlayer, fetchedAt: Date, allowFixtureAvatars = false): FaceitProfileInput {
  if (!FACEIT_ID.test(raw.player_id)) {
    throw new FaceitError('invalid_response', 'Identifiant FACEIT inattendu.');
  }
  const cs2 = raw.games?.cs2 ?? null;
  const level = cs2?.skill_level;
  const elo = cs2?.faceit_elo;
  const cs2Level = typeof level === 'number' && level >= 1 && level <= 10 ? level : null;
  const cs2Elo = typeof elo === 'number' && elo >= 0 && elo <= 10000 ? elo : null;
  const avatarUrl = acceptAvatarUrl(raw.avatar, allowFixtureAvatars);
  const country = raw.country && /^[a-z]{2}$/i.test(raw.country) ? raw.country.toLowerCase() : null;
  return {
    faceitPlayerId: raw.player_id.toLowerCase(),
    nickname: raw.nickname.trim().slice(0, 64),
    avatarUrl,
    country,
    cs2Level,
    cs2Elo,
    fetchedAt: fetchedAt.toISOString(),
    hasCs2: cs2Level !== null || cs2Elo !== null,
    avatarRejected: Boolean(raw.avatar && raw.avatar.trim() !== '' && !avatarUrl),
  };
}
