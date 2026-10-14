/** Liens de vidéos uniquement : aucune requête réseau, aucun HTML fourni par un tiers. */
export type ClipProvider = 'youtube' | 'twitch' | 'allstar';
export type ClipSource = { provider: ClipProvider; externalId: string; sourceUrl: string };
export const PROVIDER_LABELS: Record<ClipProvider, string> = {
  youtube: 'YouTube',
  twitch: 'Twitch',
  allstar: 'Allstar',
};

export function parseClipSource(input: string): ClipSource | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    const host = u.hostname;
    let id: string | null = null;
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
      id =
        host === 'youtu.be'
          ? u.pathname.slice(1)
          : u.pathname === '/watch'
            ? u.searchParams.get('v')
            : (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)\/?$/)?.[1] ?? null);
      if (id && /^[\w-]{11}$/.test(id))
        return { provider: 'youtube', externalId: id, sourceUrl: `https://www.youtube.com/watch?v=${id}` };
    }
    if (host === 'clips.twitch.tv') id = u.pathname.match(/^\/([\w-]{1,100})\/?$/)?.[1] ?? null;
    if (['twitch.tv', 'www.twitch.tv', 'm.twitch.tv'].includes(host)) {
      id = u.pathname.match(/^\/\w+\/clip\/([\w-]{1,100})\/?$/)?.[1] ?? null;
      const video = u.pathname.match(/^\/videos\/([0-9]{1,20})\/?$/)?.[1];
      if (video)
        return {
          provider: 'twitch',
          externalId: `video:${video}`,
          sourceUrl: `https://www.twitch.tv/videos/${video}`,
        };
    }
    if (id && host.endsWith('twitch.tv') && id !== 'embed')
      return { provider: 'twitch', externalId: id, sourceUrl: `https://clips.twitch.tv/${id}` };
    // Allstar : ancien format « /clip?clip=<id> » et format actuel « /clip/<id> » (constaté le 14/10/2026).
    // Les « vidéos » d'un profil FACEIT (faceit.com/<langue>/players/<pseudo>/videos/<id>) sont des clips
    // Allstar : même identifiant, lu par le lecteur Allstar (vérifié le 14/10/2026 sur un clip de la team).
    if (['allstar.gg', 'www.allstar.gg'].includes(host)) {
      id = /^\/clip\/?$/.test(u.pathname) ? u.searchParams.get('clip') : (u.pathname.match(/^\/clip\/([a-fA-F0-9]{24})\/?$/)?.[1] ?? null);
    }
    if (['faceit.com', 'www.faceit.com'].includes(host)) {
      id = u.pathname.match(/^\/[a-z]{2}(?:-[a-z]{2})?\/players\/[^/]{1,64}\/videos\/([a-fA-F0-9]{24})\/?$/)?.[1] ?? null;
    }
    if (['allstar.gg', 'www.allstar.gg', 'faceit.com', 'www.faceit.com'].includes(host)) {
      if (id && /^[a-fA-F0-9]{24}$/.test(id)) {
        id = id.toLowerCase();
        return { provider: 'allstar', externalId: id, sourceUrl: `https://allstar.gg/clip/${id}` };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Le parent Twitch est calculé dans le navigateur à l'ouverture, jamais fourni par le formulaire. */
export function clipEmbedUrl(sourceUrl: string, parent: string): string | null {
  const s = parseClipSource(sourceUrl);
  if (!s) return null;
  if (s.provider === 'youtube') return `https://www.youtube.com/embed/${s.externalId}?autoplay=0`;
  // Lecteur intégrable d'Allstar (exposé par Allstar pour l'oEmbed), vérifié le 14/10/2026 avec un vrai clip.
  // Il affiche d'abord sa propre demande de consentement aux cookies.
  if (s.provider === 'allstar') return `https://allstar.gg/iframe?clip=${s.externalId}`;
  if (s.provider !== 'twitch' || !/^[a-zA-Z0-9.-]+$/.test(parent)) return null;
  const video = s.externalId.startsWith('video:');
  const u = new URL(video ? 'https://player.twitch.tv/' : 'https://clips.twitch.tv/embed');
  u.searchParams.set(video ? 'video' : 'clip', video ? `v${s.externalId.slice(6)}` : s.externalId);
  u.searchParams.set('parent', parent);
  u.searchParams.set('autoplay', 'false');
  return u.toString();
}
