import type { Player, RosterGroup } from '@/lib/domain/schemas';
import { rankPlayers, type RankMode } from './ranking';

export type GroupFilter = 'all' | RosterGroup;

export type BoardRow = {
  playerId: string;
  nickname: string;
  avatarUrl: string | null;
  level: number | null;
  group: RosterGroup;
  isDemo: boolean;
  addedAt: string;
  addedElo: number | null;
  /** Dernier ELO CS2 valide connu (copie locale du profil FACEIT). */
  currentElo: number | null;
  /** Date de la dernière réponse FACEIT valide pour ce profil. */
  currentAt: string;
  lastError: string | null;
  lastAttemptAt: string | null;
  delta: number | null;
  rank: number | null;
};

/** Classement permanent : joueurs actifs du roster, triés par ELO actuel ou par progression depuis l'ajout. */
export function rankingRows(players: Player[], mode: RankMode, group: GroupFilter = 'all'): BoardRow[] {
  const items = players
    .filter((p) => p.active && (group === 'all' || p.group === group))
    .map((p) => ({
      playerId: p.id,
      nickname: p.profile.nickname,
      avatarUrl: p.profile.avatarUrl,
      level: p.profile.cs2Level,
      group: p.group,
      isDemo: p.isDemo,
      addedAt: p.addedAt,
      addedElo: p.addedElo,
      currentElo: p.profile.cs2Elo,
      currentAt: p.profile.fetchedAt,
      lastError: p.profile.lastError,
      lastAttemptAt: p.profile.lastAttemptAt,
    }));
  return rankPlayers(items, mode);
}

/** Progression d'un joueur depuis son ajout (null si l'une des deux valeurs manque). */
export function progressionOf(p: Pick<Player, 'addedElo' | 'profile'>): number | null {
  return p.addedElo === null || p.profile.cs2Elo === null ? null : p.profile.cs2Elo - p.addedElo;
}
