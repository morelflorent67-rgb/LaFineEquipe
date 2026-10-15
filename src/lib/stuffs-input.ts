import { z } from 'zod';
import { youtubeId } from '@/lib/stuffs';

/** Validation serveur d'une fiche de stuff (formulaire admin). */
const text = (max: number) => z.string().trim().max(max);

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
  difficulty: z.enum(['easy', 'medium', 'hard']),
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
