import 'server-only';
import { getServerEnv } from '@/lib/env';

/** Chemins autorisés (identiques aux contraintes SQL) : captures des stuffs et images des maps. */
export const MEDIA_PATH = /^(utilities\/[0-9a-f-]{36}|maps\/[a-z0-9-]+)\/[a-z0-9-]+\.(webp|png|jpg|jpeg)$/;

/** URL publique d'une capture : Supabase Storage en ligne, route /media en local. */
export function mediaUrl(path: string | null): string | null {
  if (!path || !MEDIA_PATH.test(path)) return null;
  const env = getServerEnv();
  if (env.backend === 'local') return `/media/${path}`;
  return `${env.supabase!.url}/storage/v1/object/public/stuff-media/${path}`;
}

/** Image d'une map : vraie capture si l'admin en a ajouté une, sinon illustration maison. */
export function mapCoverUrl(m: { coverPath: string | null; imagePath: string | null }): string | null {
  return mediaUrl(m.coverPath) ?? m.imagePath;
}

/** Captures des maps indexées par clé FACEIT (de_mirage…), pour illustrer les matchs. */
export function mapCoversByKey(maps: { faceitKey: string | null; coverPath: string | null; imagePath: string | null }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of maps) {
    const url = mapCoverUrl(m);
    if (m.faceitKey && url) out[m.faceitKey] = url;
  }
  return out;
}
