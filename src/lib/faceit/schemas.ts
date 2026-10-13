import { z } from 'zod';

/**
 * Réponses de la FACEIT Data API v4 (spécification officielle :
 * https://open.faceit.com/data/v4/docs/swagger.json). Seuls les champs utilisés sont validés ;
 * les autres sont ignorés. Toute réponse non conforme est rejetée (rien n'est enregistré).
 */
const optString = z.string().nullish();

export const gameDetailSchema = z.object({
  faceit_elo: z.number().int().nullish(),
  skill_level: z.number().int().nullish(),
  region: optString,
});

export const playerSchema = z.object({
  player_id: z.string().min(1),
  nickname: z.string().min(1),
  avatar: optString,
  country: optString,
  faceit_url: optString,
  // Seul CS2 est validé : les autres jeux du profil (Valorant, Clash Royale…) sont ignorés,
  // pour qu'un format inattendu ailleurs ne bloque pas l'import.
  games: z.object({ cs2: gameDetailSchema.nullish() }).nullish(),
});
export type FaceitRawPlayer = z.infer<typeof playerSchema>;

export const searchPlayersSchema = z.object({
  items: z
    .array(
      z.object({
        player_id: z.string().min(1),
        nickname: z.string().min(1),
        avatar: optString,
        country: optString,
        games: z
          .array(z.object({ name: optString, skill_level: z.union([z.string(), z.number()]).nullish() }))
          .nullish(),
      }),
    )
    .default([]),
});

const historyPlayerSchema = z.object({
  player_id: z.string().min(1),
  nickname: optString,
});

const historyFactionSchema = z.object({
  team_id: optString,
  nickname: optString,
  players: z.array(historyPlayerSchema).nullish(),
});

export const historyItemSchema = z.object({
  match_id: z.string().min(1),
  status: optString,
  started_at: z.number().nullish(),
  finished_at: z.number().nullish(),
  competition_name: optString,
  faceit_url: optString,
  results: z
    .object({
      winner: optString,
      score: z.record(z.string(), z.number()).nullish(),
    })
    .nullish(),
  teams: z.record(z.string(), historyFactionSchema).nullish(),
});
export type FaceitHistoryItem = z.infer<typeof historyItemSchema>;

export const historySchema = z.object({ items: z.array(historyItemSchema).default([]) });

export const matchSchema = z.object({
  match_id: z.string().min(1),
  status: optString,
  started_at: z.number().nullish(),
  finished_at: z.number().nullish(),
  competition_name: optString,
  faceit_url: optString,
  results: z
    .object({
      winner: optString,
      score: z.record(z.string(), z.number()).nullish(),
    })
    .nullish(),
  teams: z
    .record(
      z.string(),
      z.object({ faction_id: optString, name: optString, roster: z.array(z.object({ player_id: z.string() })).nullish() }),
    )
    .nullish(),
  // Le champ « voting » n'est pas décrit par la spécification : lu de façon défensive.
  voting: z.unknown().optional(),
});
export type FaceitRawMatch = z.infer<typeof matchSchema>;

/** /matches/{id}/stats : structure non typée dans la spécification, analysée à part (match-mapping.ts). */
export const matchStatsSchema = z.unknown();
