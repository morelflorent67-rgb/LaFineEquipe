import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { DemoTag, Delta, Level, ProfileFreshness, Series } from '@/components/ui/badges';
import { FaceitLink } from '@/components/ui/FaceitLink';
import type { Player, RecentResult } from '@/lib/domain/schemas';
import { progressionOf } from '@/lib/elo/board';
import { fmtInt, fmtShortDate, mapLabel } from '@/lib/format';
import styles from './PlayerCard.module.css';

export function PlayerCard({ player, results }: { player: Player; results: RecentResult[] }) {
  const p = player.profile;
  const progression = progressionOf(player);
  return (
    <li className={`${styles.card} ${player.group === 'guest' ? styles.guest : ''}`}>
      <div className={styles.media}>
        <Avatar src={p.avatarUrl} size={128} level={p.cs2Level} />
      </div>
      <div className={styles.body}>
        <div className={styles.tags}>
          <span className={`tag ${player.group === 'team' ? 'red' : ''}`}>{player.group === 'team' ? 'Team' : 'Guest'}</span>
          {player.isDemo ? <DemoTag /> : null}
        </div>
        <h3 className={styles.name}>
          <Link href={`/players/${player.id}`}>{p.nickname}</Link>
        </h3>
        <dl className={styles.stats}>
          <div>
            <dt>Niveau</dt>
            <dd>
              <Level level={p.cs2Level} />
            </dd>
          </div>
          <div>
            <dt>ELO</dt>
            <dd className="num">{p.cs2Elo !== null ? fmtInt(p.cs2Elo) : <small>non fourni</small>}</dd>
          </div>
          <div>
            <dt title={`Depuis l’ajout le ${fmtShortDate(player.addedAt)}`}>Progr.</dt>
            <dd>{player.active ? <Delta value={progression} /> : <small>inactif</small>}</dd>
          </div>
        </dl>
        <div className={styles.series}>
          <Series
            results={results.map((r) => ({
              result: r.result,
              detail: [mapLabel(null, r.mapName), r.at ? fmtShortDate(r.at) : null].filter(Boolean).join(' · '),
            }))}
          />
        </div>
        <div className={styles.foot}>
          <ProfileFreshness
            fetchedAt={p.fetchedAt}
            lastError={p.lastError}
            lastAttemptAt={p.lastAttemptAt}
            staleAfterHours={6}
          />
          <FaceitLink nickname={p.nickname} isDemo={p.isDemo} />
        </div>
      </div>
    </li>
  );
}
