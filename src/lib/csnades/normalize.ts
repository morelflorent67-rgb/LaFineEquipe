import type { Difficulty, Grenade, Side, Technique } from '@/lib/domain/schemas';
import { techniqueFor } from '@/lib/stuffs';
import { parseVtt } from './parse';
import { csNadePageUrl, type CsDetailNade, type CsListNade, type CsMap, type CsTypePath } from './source';

/**
 * Conversion d'un stuff csnades vers notre modèle. Seules les valeurs constatées sur leurs
 * données (15/10/2026) sont acceptées : une valeur inconnue fait échouer l'import au lieu
 * d'être devinée.
 */

const SIDES: Record<string, Side> = { t: 'T', ct: 'CT', any: 'BOTH' };
const GRENADES: Record<string, Grenade> = { smoke: 'smoke', molotov: 'molotov', flashbang: 'flash', he: 'he' };
export const MOVEMENTS = ['stationary', 'walking', 'running', 'crouched_stationary', 'crouched_walking'] as const;
export type Movement = (typeof MOVEMENTS)[number];
export const CLICKS = ['left', 'right', 'both'] as const;
export type Click = (typeof CLICKS)[number];
export const PRECISIONS = ['loose', 'precise', 'very_precise'] as const;
export type Precision = (typeof PRECISIONS)[number];

export type Point = { x: number; y: number; level: number };

export type ImportItem = {
  sourceId: string;
  slug: string;
  title: string;
  side: Side;
  grenade: Grenade;
  originName: string;
  targetName: string;
  description: string | null;
  steps: string[];
  stepTimes: number[];
  technique: Technique;
  difficulty: Difficulty | null;
  tags: string[];
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  credit: string | null;
  movement: Movement;
  click: Click;
  jump: boolean;
  precision: Precision;
  throw: Point;
  landing: Point;
  bounces: Point[];
  media: {
    video: { mp4: string; webm: string };
    videoLq: { mp4: string; webm: string };
    poster: string;
    posterSmall: string | null;
    lineup: string | null;
  };
  consoleCmd: string | null;
  airTime: number | null;
};

export type ImportRadar = { level: number; imageUrl: string; calloutsUrl: string | null; width: number; height: number };

/** Traductions des étapes (anglais → français), voir data/csnades/steps.fr.json. */
export type Translations = Record<string, string>;

function known<T extends string>(value: string, allowed: readonly T[], what: string): T {
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`Valeur ${what} inconnue : « ${value} »`);
  return value as T;
}

function mapped<T>(table: Record<string, T>, value: string, what: string): T {
  const v = table[value];
  if (v === undefined) throw new Error(`Valeur ${what} inconnue : « ${value} »`);
  return v;
}

/** Le flux RSC note les valeurs absentes « $undefined ». */
function clean(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s && s !== '$undefined' ? s : null;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** csnades place ses points sur une grille 0–1000 de leur vue aérienne : on garde des %. */
export function toPoint(p: { x: number; y: number; levels: (number | null)[] | null }): Point {
  const pct = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 100));
  return { x: pct(p.x), y: pct(p.y), level: p.levels?.[0] ?? 1 };
}

/** Technique « clic + saut » de csnades → clic, saut. */
export function splitTechnique(technique: string): { click: Click; jump: boolean } {
  const jump = technique.endsWith('_jump');
  return { click: known(jump ? technique.slice(0, -5) : technique, CLICKS, 'de technique'), jump };
}

/** Notre technique simplifiée (filtres et anciennes fiches), déduite du mouvement et du saut. */
export const legacyTechnique = (movement: Movement, jump: boolean): Technique => techniqueFor(movement, jump);

const CONSOLE_RE = /^setpos [-0-9. ]+; ?setang [-0-9. ]+$/;

export function toImportItem(
  mapSlug: string,
  typePath: CsTypePath,
  list: CsListNade,
  detail: CsDetailNade | null,
  translations: Translations,
  missing: Set<string>,
): ImportItem {
  const grenade = mapped(GRENADES, list.type, 'de type');
  const movement = known(list.movement, MOVEMENTS, 'de mouvement');
  const { click, jump } = splitTechnique(list.technique);
  const cues = parseVtt(detail?.videoVtt ?? '').slice(0, 12);
  const tr = (s: string) => {
    const fr = translations[s];
    if (fr === undefined) missing.add(s);
    return clip(fr ?? s, 200);
  };
  const description = clean(detail?.description);
  const consoleCmd = clean(detail?.console);
  const airTime = detail?.timings?.airTime;
  const titleTo = clip(list.titleTo.trim(), 80);
  const titleFrom = clip(list.titleFrom.trim(), 80);
  return {
    sourceId: list.id,
    slug: `${grenade}-${list.slug}`.slice(0, 80).replace(/-+$/, ''),
    title: clip(`${titleTo} depuis ${titleFrom}`, 80),
    side: mapped(SIDES, list.team, 'de camp'),
    grenade,
    originName: titleFrom,
    targetName: titleTo,
    description: description ? clip(tr(description), 600) : null,
    steps: cues.map((c) => tr(c.text)),
    stepTimes: cues.map((c) => c.start),
    technique: legacyTechnique(movement, jump),
    difficulty: list.beginner ? 'easy' : null,
    tags: [],
    sourceUrl: csNadePageUrl(mapSlug, typePath, list.slug),
    sourceUpdatedAt: detail?.updatedAt ?? detail?.publishedAt ?? null,
    credit: clean(detail?.attribution) ? clip(clean(detail?.attribution)!, 80) : null,
    movement,
    click,
    jump,
    precision: known(list.precision, PRECISIONS, 'de précision'),
    throw: toPoint(list.throwFrom),
    landing: toPoint(list.throwTo),
    bounces: list.bounces.map(toPoint),
    media: {
      video: list.assets.videoHq,
      videoLq: list.assets.videoLq,
      poster: list.assets.thumbnail,
      posterSmall: list.assets.thumbnailSmall ?? null,
      lineup: list.assets.lineup ?? null,
    },
    consoleCmd: consoleCmd && consoleCmd.length <= 160 && CONSOLE_RE.test(consoleCmd) ? consoleCmd : null,
    airTime: typeof airTime === 'number' && airTime >= 0 && airTime <= 60 ? Math.round(airTime * 100) / 100 : null,
  };
}

/** Vues aériennes « game » de csnades (une par niveau). */
export function toRadars(map: CsMap): ImportRadar[] {
  return map.radars
    .filter((r) => r.type === 'game')
    .map((r) => ({
      level: r.level ?? 1,
      imageUrl: r.image.url,
      calloutsUrl: r.callouts?.url ?? null,
      width: r.image.width,
      height: r.image.height,
    }));
}
