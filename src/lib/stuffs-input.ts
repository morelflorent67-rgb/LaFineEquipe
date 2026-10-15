import { z } from 'zod';
import { youtubeId } from '@/lib/stuffs';

/** Validation serveur d'une fiche de stuff (assistant d'ajout admin). */
const text = (max: number) => z.string().trim().max(max);
/** Liste déroulante facultative : « » = non précisé. */
const optionalEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal('')])
    .default('')
    .transform((v): T[number] | null => (v === '' ? null : (v as T[number])));

/** Point placé sur la vue aérienne (en %), avec l'étage. */
const radarPoint = z
  .object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    level: z.number().int().min(1).max(3).default(1),
  })
  .transform((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, level: p.level }))
  .nullable()
  .default(null);

export const utilityInputSchema = z.object({
  id: z.uuid().nullable(),
  mapSlug: z.string().regex(/^[a-z0-9-]{2,30}$/),
  title: text(80).min(2, 'Titre trop court.'),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, 'Identifiant d’URL : minuscules, chiffres et tirets.')
    .default(''),
  side: z.enum(['T', 'CT', 'BOTH']),
  grenade: z.enum(['smoke', 'flash', 'molotov', 'he']),
  zone: text(40).default(''),
  originName: text(80).min(1, 'Départ requis.'),
  targetName: text(80).min(1, 'Arrivée requise.'),
  purpose: text(160).default(''),
  description: text(600).default(''),
  steps: z.array(text(200)).max(12, '12 étapes maximum.').default([]),
  technique: z.enum(['static', 'jumpthrow', 'runthrow', 'run_jumpthrow', 'walkthrow', 'crouch', 'jump_crouch', 'other']),
  difficulty: optionalEnum(['easy', 'medium', 'hard']),
  movement: optionalEnum(['stationary', 'walking', 'running', 'crouched_stationary', 'crouched_walking']),
  click: optionalEnum(['left', 'right', 'both']),
  jump: z.boolean().nullable().default(null),
  precision: optionalEnum(['loose', 'precise', 'very_precise']),
  throw: radarPoint,
  landing: radarPoint,
  tags: z.array(text(30)).max(10).default([]),
  videoUrl: z
    .string()
    .trim()
    .max(200)
    .default('')
    .refine((v) => v === '' || youtubeId(v) !== null, 'Vidéo : seuls les liens YouTube (youtube.com/watch, youtu.be, shorts) sont acceptés.'),
  status: z.enum(['draft', 'published']),
});
export type UtilityInput = z.input<typeof utilityInputSchema>;
