import { Avatar } from '@/components/ui/Avatar';
import { DemoTag, ResultBadge } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import type { Match, MatchResult } from '@/lib/domain/schemas';
import { fmtDateTime, mapLabel, missingMapLabel } from '@/lib/format';
import styles from './MatchList.module.css';

const MAP_IMAGES: Record<string, string> = {
  de_mirage: '/maps/mirage.svg',
  de_inferno: '/maps/inferno.svg',
  de_dust2: '/maps/dust2.svg',
  de_nuke: '/maps/nuke.svg',
  de_ancient: '/maps/ancient.svg',
  de_anubis: '/maps/anubis.svg',
  de_train: '/maps/train.svg',
};

/** Résultat « team » : identique pour tous les joueurs suivis, sinon on affiche chacun. */
export function teamResult(m: Match): MatchResult | 'mixed' {
  const set = new Set(m.players.map((p) => p.result));
  if (set.size === 0) return m.status === 'cancelled' || m.status === 'aborted' ? 'cancelled' : 'unknown';
  return set.size === 1 ? [...set][0]! : 'mixed';
}

/**
 * Liste des matchs terminés : un match = une ligne, même si plusieurs joueurs suivis y étaient.
 * Le score n'est affiché que s'il a été fourni par FACEIT. `covers` : vraies captures des maps
 * (clé FACEIT → URL), sinon illustration maison.
 */
export function MatchList({ matches, covers = {} }: { matches: Match[]; covers?: Record<string, string> }) {
  return (
    <ol className={styles.list}>
      {matches.map((m) => {
        const res = teamResult(m);
        const map = mapLabel(m.mapKey, m.mapName);
        const at = m.finishedAt ?? m.startedAt;
        const ourFaction = m.players[0]?.faction;
        const cover = m.mapKey ? (covers[m.mapKey] ?? MAP_IMAGES[m.mapKey]) : undefined;
        const score =
          m.score && ourFaction && (ourFaction === 'faction1' || ourFaction === 'faction2')
            ? { us: m.score[ourFaction], them: m.score[ourFaction === 'faction1' ? 'faction2' : 'faction1'] }
            : null;
        return (
          <li key={m.id} className={`${styles.row} ${m.status === 'cancelled' || m.status === 'aborted' ? styles.cancel : ''}`}>
            {res === 'mixed' ? (
              <span className={styles.badges} title="Membres dans les deux équipes">
                {m.players.map((p) => (
                  <ResultBadge key={p.playerId} result={p.result} detail={p.nickname} />
                ))}
              </span>
            ) : (
              <ResultBadge result={res} large />
            )}
            <span
              className={styles.mapc}
              style={cover ? { backgroundImage: `url(${cover})` } : undefined}
            >
              {map ?? missingMapLabel(m)}
            </span>
            {score && typeof score.us === 'number' && typeof score.them === 'number' ? (
              <span className={styles.score} aria-label={`Score ${score.us} à ${score.them}`}>
                {score.us}
                <i>–</i>
                {score.them}
              </span>
            ) : (
              <span className={styles.noScore}>{m.status === 'cancelled' || m.status === 'aborted' ? 'Annulé' : 'Score non fourni'}</span>
            )}
            <span className={styles.who}>
              {m.players.map((p) => (
                <span key={p.playerId} className={styles.chipP}>
                  <Avatar src={p.avatarUrl} size={22} />
                  <span>{p.nickname}</span>
                </span>
              ))}
              {m.isDemo ? <DemoTag /> : null}
            </span>
            <span className={styles.meta}>
              <span className="mono">{at ? fmtDateTime(at) : 'date inconnue'}</span>
              {m.isDemo ? (
                <span className="mono" title="Match fictif : pas de salle FACEIT">
                  Salle fictive
                </span>
              ) : (
                <a
                  className="link"
                  href={m.faceitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Salle FACEIT du match${map ? ` sur ${map}` : ''} (nouvel onglet)`}
                >
                  FACEIT <Icon name="ext" />
                </a>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
