import { Avatar } from '@/components/ui/Avatar';
import { DemoTag } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import type { ShameCategoryKey, ShameRow, WallOfShame as WallOfShameData } from '@/lib/domain/schemas';
import { fmtDateTime, fmtInt, fmtShortDate, pluralize } from '@/lib/format';
import styles from './wall.module.css';

const dec = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Les 5 catégories validées par la team le 14/10/2026 (ton de chambrage, jamais d'insulte). */
const CATEGORIES: {
  key: ShameCategoryKey;
  title: string;
  rule: string;
  record: boolean;
  value: (v: number) => string;
}[] = [
  { key: 'touriste', title: 'Le Touriste', rule: 'Le moins de kills sur un match', record: true, value: (v) => pluralize(v, 'kill', 'kills') },
  { key: 'passoire', title: 'La Passoire', rule: 'Le plus de morts sur un match', record: true, value: (v) => pluralize(v, 'mort', 'morts') },
  { key: 'myope', title: 'Le Myope', rule: 'Pire moyenne de headshots', record: false, value: (v) => `${dec.format(v)} % HS` },
  { key: 'pacifiste', title: 'Le Pacifiste', rule: 'Plus faible ADR moyen', record: false, value: (v) => `${dec.format(v)} ADR` },
  { key: 'chatNoir', title: 'Le Chat noir', rule: 'Pire taux de victoire', record: false, value: (v) => `${fmtInt(v)} % de victoires` },
];

function Detail({ row, record }: { row: ShameRow; record: boolean }) {
  if (record && row.match) {
    const label = [row.match.mapName, row.match.finishedAt ? fmtShortDate(row.match.finishedAt) : null].filter(Boolean).join(' · ');
    return row.match.isDemo ? (
      <span>{label || 'Match d’exemple'}</span>
    ) : (
      <a href={row.match.faceitUrl} target="_blank" rel="noopener noreferrer">
        {label || 'Voir le match'} <Icon name="ext" />
      </a>
    );
  }
  return <span>sur {pluralize(row.matches, 'match', 'matchs')}</span>;
}

/** Wall of Shame : calculé en base à partir des stats FACEIT réellement enregistrées. */
export function WallOfShame({ data }: { data: WallOfShameData }) {
  return (
    <>
      <p className={styles.shameScope}>
        {data.days} derniers jours · joueurs Team · {pluralize(data.matchesCounted, 'match analysé', 'matchs analysés')} · calculé le{' '}
        {fmtDateTime(data.computedAt)}
      </p>
      <ol className={styles.shameList}>
        {CATEGORIES.map((c) => {
          const rows = data.categories[c.key];
          const [first, ...others] = rows;
          return (
            <li key={c.key} className={styles.shame}>
              <h3 className={styles.shameTitle}>{c.title}</h3>
              <p className={styles.shameRule}>
                {c.rule}
                {c.record ? '' : ' (3 matchs minimum)'}
              </p>
              {first ? (
                <>
                  <div className={styles.shameFirst}>
                    <Avatar src={first.player.avatarUrl} size={48} level={first.player.cs2Level} />
                    <div>
                      <b>{first.player.nickname}</b>
                      {first.player.isDemo ? <DemoTag /> : null}
                      <span className={styles.shameValue}>{c.value(first.value)}</span>
                      <span className={styles.shameDetail}>
                        <Detail row={first} record={c.record} />
                      </span>
                    </div>
                  </div>
                  {others.length > 0 ? (
                    <ol className={styles.shameOthers} start={2} aria-label={`Suivants pour ${c.title}`}>
                      {others.map((r) => (
                        <li key={r.player.playerId}>
                          <span>{r.player.nickname}</span>
                          <span className={styles.shameSmall}>{c.value(r.value)}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </>
              ) : (
                <p className={styles.shameEmpty}>
                  {data.matchesCounted === 0 ? 'Aucun match analysé sur la période.' : 'Pas encore assez de matchs pour ce titre.'}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <p className={styles.shameNote}>
        Pour rire entre nous : les joueurs concernés sont d’accord. Valeurs reprises telles quelles des statistiques de match
        FACEIT (kills, morts, % de headshots, ADR, résultat), sans estimation.
      </p>
    </>
  );
}
