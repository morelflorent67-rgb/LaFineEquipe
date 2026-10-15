import { z } from 'zod';
import { flightText, objectsStartingWith, rscDate } from './parse';

/**
 * Format des données csnades.gg tel que constaté sur leurs pages le 15/10/2026.
 * Les valeurs énumérées (type, camp, mouvement…) restent des chaînes ici : elles ne sont
 * converties vers nos valeurs qu'après vérification, dans normalize.ts.
 */

/** Médias hébergés par csnades (affichés depuis leur serveur, avec leur accord). */
const assetUrl = z.url().refine((u) => u.startsWith('https://assets.csnades.gg/'), 'Média hors assets.csnades.gg');
const videoPair = z.object({ webm: assetUrl, mp4: assetUrl });

export const csAssetsSchema = z.object({
  id: z.string(),
  videoHq: videoPair,
  videoLq: videoPair,
  thumbnail: assetUrl,
  thumbnailSmall: assetUrl.optional(),
  lineup: assetUrl.nullish(),
});

export const csPointSchema = z.object({ x: z.number(), y: z.number(), levels: z.array(z.number().int().nullable()).nullable() });

/** Un stuff tel qu'il apparaît dans la liste d'une map (avec ses coordonnées sur la vue aérienne). */
export const csListNadeSchema = z.object({
  id: z.string().regex(/^nade_[0-9a-f]+$/),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  assets: csAssetsSchema,
  team: z.string(),
  type: z.string(),
  technique: z.string(),
  movement: z.string(),
  precision: z.string(),
  throwFrom: csPointSchema,
  titleFrom: z.string(),
  throwTo: csPointSchema,
  titleTo: z.string(),
  bounces: z.array(csPointSchema),
  beginner: z.boolean(),
});
export type CsListNade = z.infer<typeof csListNadeSchema>;

/** La fiche détaillée d'un stuff (commande console, sous-titres, dates…). */
export const csDetailNadeSchema = z.object({
  uid: z.string().regex(/^nade_[0-9a-f]+$/),
  slug: z.string(),
  titleTo: z.string(),
  titleFrom: z.string(),
  assets: csAssetsSchema,
  timings: z.object({ popTime: z.number(), throwTime: z.number(), airTime: z.number() }).partial().nullish(),
  description: z.string().nullish(),
  console: z.string().nullish(),
  team: z.string(),
  type: z.string(),
  movement: z.string(),
  technique: z.string(),
  precision: z.string(),
  attribution: z.string().nullish(),
  videoVtt: z.string().nullish(),
  publishedAt: z.string().transform(rscDate),
  updatedAt: z.string().transform(rscDate),
  aliases: z.array(z.unknown()).nullish(),
});
export type CsDetailNade = z.infer<typeof csDetailNadeSchema>;

const csImageSchema = z.object({ url: assetUrl, width: z.number().int(), height: z.number().int() });

export const csMapSchema = z.object({
  name: z.string(),
  slug: z.string(),
  radars: z.array(
    // « callouts » est parfois une référence RSC (« $… ») vers un autre objet : traitée comme absente.
    z.object({
      type: z.string(),
      image: csImageSchema,
      callouts: z.union([csImageSchema, z.string().transform(() => null)]).nullish(),
      level: z.number().int().nullable(),
    }),
  ),
});
export type CsMap = z.infer<typeof csMapSchema>;

/** Page d'une map (un type de grenade) : la map et ses stuffs officiels. */
export function parseMapPage(html: string): { map: CsMap; nades: CsListNade[] } {
  const text = flightText(html);
  const maps = objectsStartingWith(text, '{"name":').filter(
    (o) => typeof o === 'object' && o !== null && 'radars' in o,
  );
  if (maps.length === 0) throw new Error('Page de map : données de la map introuvables');
  const map = csMapSchema.parse(maps[0]);
  const seen = new Set<string>();
  const nades: CsListNade[] = [];
  for (const raw of objectsStartingWith(text, '{"id":"nade_')) {
    if (!(typeof raw === 'object' && raw !== null && 'throwTo' in raw)) continue;
    const nade = csListNadeSchema.parse(raw);
    if (seen.has(nade.id)) continue;
    seen.add(nade.id);
    nades.push(nade);
  }
  return { map, nades };
}

/** Page d'un stuff : sa fiche détaillée (les « stuffs similaires » de la page sont ignorés). */
export function parseNadePage(html: string, uid: string): CsDetailNade {
  const text = flightText(html);
  for (const raw of objectsStartingWith(text, '{"uid":"' + uid + '"')) {
    if (typeof raw === 'object' && raw !== null && 'videoVtt' in raw) return csDetailNadeSchema.parse(raw);
  }
  throw new Error(`Fiche ${uid} introuvable dans la page`);
}

/** Chemins des pages csnades par type de grenade. */
export const CS_TYPE_PATHS = ['smokes', 'molotovs', 'flashbangs', 'hegrenades'] as const;
export type CsTypePath = (typeof CS_TYPE_PATHS)[number];

export function csMapPageUrl(mapSlug: string, typePath: CsTypePath): string {
  return `https://csnades.gg/${mapSlug}${typePath === 'smokes' ? '' : `/${typePath}`}`;
}

export function csNadePageUrl(mapSlug: string, typePath: CsTypePath, slug: string): string {
  return `https://csnades.gg/${mapSlug}/${typePath}/${slug}`;
}
