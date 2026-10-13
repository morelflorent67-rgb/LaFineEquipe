import { z } from 'zod';

/** Schémas des réponses des fonctions SQL (clés camelCase). */
export const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'date invalide');

export const profileSchema = z.object({
  faceitPlayerId: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  country: z.string().nullable(),
  cs2Level: z.number().int().nullable(),
  cs2Elo: z.number().int().nullable(),
  fetchedAt: isoDate,
  lastAttemptAt: isoDate.nullable(),
  lastError: z.string().nullable(),
  isDemo: z.boolean(),
});
export type Profile = z.infer<typeof profileSchema>;

export const rosterGroupSchema = z.enum(['team', 'guest']);
export type RosterGroup = z.infer<typeof rosterGroupSchema>;

export const playerSchema = z.object({
  id: z.string(),
  group: rosterGroupSchema,
  active: z.boolean(),
  displayOrder: z.number().int(),
  isDemo: z.boolean(),
  createdAt: isoDate,
  /** Ajout au classement permanent (ou retour après désactivation). */
  addedAt: isoDate,
  /** ELO relevé à l'ajout : base de la progression. Null tant qu'aucun relevé CS2 n'existe. */
  addedElo: z.number().int().nullable(),
  profile: profileSchema,
});
export type Player = z.infer<typeof playerSchema>;

export const avoidStatusSchema = z.enum(['active', 'archived']);
export type AvoidStatus = z.infer<typeof avoidStatusSchema>;

export const avoidEntrySchema = z.object({
  id: z.string(),
  status: avoidStatusSchema,
  addedAt: isoDate,
  archivedAt: isoDate.nullable(),
  isDemo: z.boolean(),
  profile: profileSchema,
});
export type AvoidEntry = z.infer<typeof avoidEntrySchema>;

export const adminAvoidEntrySchema = avoidEntrySchema.extend({
  updatedAt: isoDate,
  addedBy: z.string().nullable(),
  reason: z.string().nullable(),
  inRoster: z.boolean(),
});
export type AdminAvoidEntry = z.infer<typeof adminAvoidEntrySchema>;

export const faceitUsageSchema = z.object({
  player: z.object({ id: z.string(), active: z.boolean(), group: rosterGroupSchema }).nullable(),
  avoid: z.object({ id: z.string(), status: avoidStatusSchema }).nullable(),
});
export type FaceitUsage = z.infer<typeof faceitUsageSchema>;

export const eloHistorySchema = z
  .object({
    playerId: z.string(),
    addedAt: isoDate,
    addedElo: z.number().int().nullable(),
    total: z.number().int(),
    compacted: z.boolean(),
    points: z.array(z.object({ elo: z.number().int(), level: z.number().int().nullable(), measuredAt: isoDate })),
  })
  .nullable();
export type EloHistory = NonNullable<z.infer<typeof eloHistorySchema>>;

export const refreshStatusSchema = z.object({
  running: z.boolean(),
  lastStartedAt: isoDate.nullable(),
  availableAt: isoDate.nullable(),
  lastOkAt: isoDate.nullable(),
  now: isoDate,
});
export type RefreshStatus = z.infer<typeof refreshStatusSchema>;

export const resultSchema = z.enum(['win', 'loss', 'cancelled', 'unknown']);
export type MatchResult = z.infer<typeof resultSchema>;

export const matchStatusSchema = z.enum(['unknown', 'scheduled', 'ready', 'ongoing', 'finished', 'cancelled', 'aborted']);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const matchSchema = z.object({
  id: z.string(),
  faceitMatchId: z.string(),
  status: matchStatusSchema,
  mapKey: z.string().nullable(),
  mapName: z.string().nullable(),
  startedAt: isoDate.nullable(),
  finishedAt: isoDate.nullable(),
  score: z.record(z.string(), z.number()).nullable(),
  winnerFaction: z.enum(['faction1', 'faction2']).nullable(),
  factions: z.record(z.string(), z.object({ name: z.string().nullable().optional() })).catch({}),
  competitionName: z.string().nullable(),
  faceitUrl: z.string(),
  source: z.string(),
  lastCheckedAt: isoDate,
  isDemo: z.boolean(),
  players: z.array(
    z.object({
      playerId: z.string(),
      nickname: z.string(),
      avatarUrl: z.string().nullable(),
      faction: z.string().nullable(),
      result: resultSchema,
    }),
  ),
});
export type Match = z.infer<typeof matchSchema>;

export const recentResultsSchema = z.array(
  z.object({
    playerId: z.string(),
    results: z.array(
      z.object({
        matchId: z.string(),
        faceitMatchId: z.string(),
        result: resultSchema,
        at: isoDate.nullable(),
        mapName: z.string().nullable(),
      }),
    ),
  }),
);
export type RecentResult = z.infer<typeof recentResultsSchema>[number]['results'][number];

export const liveSourceSchema = z.enum(['none', 'history_polling', 'webhook']);
export const liveStateSchema = z.object({
  source: liveSourceSchema,
  verifiedAt: isoDate.nullable(),
  lastMatchesSyncOkAt: isoDate.nullable(),
  lastMatchesSyncStatus: z.string().nullable(),
  ongoing: z.array(matchSchema),
});
export type LiveStateRow = z.infer<typeof liveStateSchema>;

const jobStatusSchema = z.object({
  lastRun: z
    .object({ status: z.string(), startedAt: isoDate, finishedAt: isoDate.nullable(), errorCode: z.string().nullable() })
    .nullable(),
  lastOkAt: isoDate.nullable(),
});
export const syncStatusSchema = z.object({
  jobs: z.object({ profiles: jobStatusSchema, matches: jobStatusSchema }),
  live: z.object({ source: liveSourceSchema, verifiedAt: isoDate.nullable(), note: z.string().nullable() }),
});
export type SyncStatus = z.infer<typeof syncStatusSchema>;

export const syncRunSchema = z.object({
  id: z.string(),
  job: z.string(),
  trigger: z.string(),
  status: z.string(),
  startedAt: isoDate,
  finishedAt: isoDate.nullable(),
  errorCode: z.string().nullable(),
  stats: z.record(z.string(), z.unknown()),
  failures: z.number().int(),
});
export type SyncRun = z.infer<typeof syncRunSchema>;

// ---------------------------------------------------------------------------
// Stuffs
// ---------------------------------------------------------------------------
export const grenadeSchema = z.enum(['smoke', 'flash', 'molotov', 'he']);
export type Grenade = z.infer<typeof grenadeSchema>;
export const sideSchema = z.enum(['T', 'CT', 'BOTH']);
export type Side = z.infer<typeof sideSchema>;
export const techniqueSchema = z.enum(['static', 'jumpthrow', 'runthrow', 'walkthrow', 'crouch', 'jump_crouch', 'other']);
export type Technique = z.infer<typeof techniqueSchema>;
export const difficultySchema = z.enum(['easy', 'medium', 'hard']);
export type Difficulty = z.infer<typeof difficultySchema>;

export const mapCountsSchema = z.object({
  total: z.number().int(),
  smoke: z.number().int(),
  flash: z.number().int(),
  molotov: z.number().int(),
  he: z.number().int(),
  T: z.number().int(),
  CT: z.number().int(),
});
export type MapCounts = z.infer<typeof mapCountsSchema>;

export const mapSchema = z.object({
  slug: z.string(),
  name: z.string(),
  faceitKey: z.string().nullable(),
  /** Illustration maison de repli (/maps/*.svg). */
  imagePath: z.string().nullable(),
  /** Vraie capture (stockage) et vue aérienne de la carte tactique. */
  coverPath: z.string().nullable(),
  aerialPath: z.string().nullable(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  counts: mapCountsSchema,
  positionCount: z.number().int(),
});
export type MapInfo = z.infer<typeof mapSchema>;

export const utilitySchema = z.object({
  id: z.string(),
  slug: z.string(),
  mapSlug: z.string(),
  mapName: z.string(),
  title: z.string(),
  side: sideSchema,
  grenade: grenadeSchema,
  zone: z.string().nullable(),
  originName: z.string(),
  targetName: z.string(),
  purpose: z.string().nullable(),
  description: z.string().nullable(),
  steps: z.array(z.string()),
  technique: techniqueSchema,
  difficulty: difficultySchema,
  tags: z.array(z.string()),
  placementImage: z.string().nullable(),
  aimImage: z.string().nullable(),
  videoUrl: z.string().nullable(),
  verifiedAt: isoDate.nullable(),
  status: z.enum(['draft', 'published']),
  isDemo: z.boolean(),
  updatedAt: isoDate,
  openReports: z.number().int(),
  throwPositionId: z.string().nullable(),
  landing: z.object({ x: z.number(), y: z.number() }).nullable(),
});
export type Utility = z.infer<typeof utilitySchema>;

export const mapPositionSchema = z.object({ id: z.string(), name: z.string(), x: z.number(), y: z.number() });
export type MapPosition = z.infer<typeof mapPositionSchema>;

export const catalogSchema = z
  .object({
    map: mapSchema,
    positions: z.array(mapPositionSchema),
    utilities: z.array(utilitySchema),
  })
  .nullable();
export type Catalog = NonNullable<z.infer<typeof catalogSchema>>;

export const utilityDetailSchema = z
  .object({
    utility: utilitySchema,
    siblings: z.array(z.object({ slug: z.string(), title: z.string() })),
    related: z.array(utilitySchema),
    myOpenReport: z.boolean(),
    aerialPath: z.string().nullable(),
    position: mapPositionSchema.nullable(),
  })
  .nullable();
export type UtilityDetail = NonNullable<z.infer<typeof utilityDetailSchema>>;

/** Réglages saisis par l'admin pour l'aperçu indicatif (jamais décodés du code de partage). */
export const crosshairPreviewSchema = z.object({
  len: z.number().min(0).max(12),
  gap: z.number().min(-5).max(10),
  thickness: z.number().min(0.5).max(5),
  outline: z.number().min(0).max(3),
  dot: z.boolean(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
export type CrosshairPreview = z.infer<typeof crosshairPreviewSchema>;

export const crosshairSchema = z.object({
  id: z.string(),
  label: z.string(),
  shareCode: z.string(),
  notes: z.string().nullable(),
  preview: crosshairPreviewSchema.nullable(),
  gameVersion: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  published: z.boolean(),
  isDemo: z.boolean(),
  sortOrder: z.number().int(),
  updatedAt: isoDate,
  player: z.object({ id: z.string(), nickname: z.string(), avatarUrl: z.string().nullable(), isDemo: z.boolean() }).nullable(),
  map: z.object({ slug: z.string(), name: z.string(), coverPath: z.string().nullable(), imagePath: z.string().nullable() }).nullable(),
});
export type Crosshair = z.infer<typeof crosshairSchema>;
