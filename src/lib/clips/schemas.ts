import { z } from 'zod';
import { parseClipSource } from './providers';

export const clipInputSchema = z
  .object({
    id: z.uuid().nullable(),
    title: z.string().trim().min(2, 'Titre : 2 caractères minimum.').max(100),
    sourceUrl: z
      .string()
      .trim()
      .max(2048)
      .refine(
        (s) => !!parseClipSource(s),
        'Lien vidéo non reconnu. Utilise YouTube, un clip/une vidéo Twitch ou un lien de clip Allstar (allstar.gg/clip/…).',
      ),
    playerId: z.uuid().nullable(),
    mapSlug: z
      .string()
      .regex(/^[a-z0-9-]{1,30}$/)
      .nullable(),
    recordedOn: z.iso.date(),
    description: z.string().trim().max(500),
    consentConfirmed: z.boolean(),
    embedAllowed: z.boolean(),
    published: z.boolean(),
  })
  .refine((d) => !d.published || d.consentConfirmed, 'Confirme l’accord du joueur avant publication.');
export type ClipInput = z.input<typeof clipInputSchema>;

export const clipSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  sourceUrl: z.string(),
  provider: z.enum(['youtube', 'twitch', 'allstar']),
  externalId: z.string(),
  recordedOn: z.string(),
  description: z.string(),
  consentConfirmed: z.boolean(),
  embedAllowed: z.boolean(),
  published: z.boolean(),
  isDemo: z.boolean(),
  createdAt: z.string(),
  player: z.object({ id: z.uuid(), nickname: z.string(), avatarUrl: z.string().nullable() }).nullable(),
  map: z
    .object({
      slug: z.string(),
      name: z.string(),
      coverPath: z.string().nullable(),
      imagePath: z.string().nullable(),
    })
    .nullable(),
});
export type Clip = z.infer<typeof clipSchema>;
