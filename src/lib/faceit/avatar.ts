/**
 * Règle unique d'acceptation d'une image d'avatar. Identique à la contrainte SQL de
 * faceit_profiles.avatar_url : uniquement le CDN FACEIT en HTTPS (ou les avatars fictifs
 * locaux en mode « fixtures »). Toute autre adresse est ignorée → silhouette.
 */
const FACEIT_CDN = /^https:\/\/([a-z0-9-]+\.)*faceit-cdn\.net\/[^\s"<>]+$/;
const FIXTURE_AVATAR = /^\/dev-fixtures\/[a-z0-9-]+\.svg$/;

export function acceptAvatarUrl(raw: string | null | undefined, allowFixtures = false): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value === '' || value.length > 500) return null;
  if (allowFixtures && FIXTURE_AVATAR.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (url.hostname !== 'faceit-cdn.net' && !url.hostname.endsWith('.faceit-cdn.net')) return null;
  } catch {
    return null;
  }
  return FACEIT_CDN.test(value) ? value : null;
}
