import { Avatar } from '@/components/ui/Avatar';
import { DemoTag } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { crosshairStatus } from '@/lib/crosshairs';
import type { Crosshair } from '@/lib/domain/schemas';
import { fmtDate } from '@/lib/format';
import { mapCoverUrl } from '@/lib/media';
import { CopyCode } from './CopyCode';
import { CrosshairPreview } from './CrosshairPreview';
import styles from './crosshairs.module.css';

export function CrosshairStatus({ c }: { c: Pick<Crosshair, 'verifiedAt' | 'gameVersion'> }) {
  const s = crosshairStatus(c.verifiedAt);
  const version = c.gameVersion ? ` (${c.gameVersion})` : '';
  if (s === 'ok') {
    return (
      <span className="chip ok">
        <Icon name="check" /> Validé le {fmtDate(c.verifiedAt!)}
        {version}, après la mise à jour
      </span>
    );
  }
  if (s === 'stale') {
    return (
      <span className="chip stale">
        <Icon name="alert" /> À revérifier · validé le {fmtDate(c.verifiedAt!)}, avant la mise à jour
      </span>
    );
  }
  return (
    <span className="chip stale">
      <Icon name="alert" /> Jamais vérifié en jeu
    </span>
  );
}

/** Preset de la team : aperçu indicatif, propriétaire, réglages, état de vérification, code à copier. */
export function CrosshairCard({ c }: { c: Crosshair }) {
  const bg = c.map ? mapCoverUrl(c.map) : null;
  return (
    <article className={styles.card}>
      <div className={styles.prev}>
        {bg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg} alt="" loading="lazy" />
        ) : null}
        {c.preview ? (
          <CrosshairPreview preview={c.preview} label={`Aperçu indicatif du réticule ${c.label}`} />
        ) : (
          <span className={styles.noPrev}>Pas d’aperçu</span>
        )}
        {c.preview ? <span className={styles.ind}>Aperçu indicatif</span> : null}
      </div>
      <div className={styles.body}>
        <div className={styles.head}>
          {c.player ? <Avatar src={c.player.avatarUrl} size={34} /> : null}
          <div>
            <h3>{c.label}</h3>
            <span className={styles.own}>{c.player ? c.player.nickname : 'Preset de la team'}</span>
          </div>
          {c.isDemo ? <DemoTag /> : null}
        </div>
        {c.preview ? (
          <ul className={styles.params} aria-label="Réglages indicatifs">
            <li>long. {c.preview.len}</li>
            <li>écart {c.preview.gap}</li>
            <li>ép. {c.preview.thickness}</li>
            <li>contour {c.preview.outline}</li>
            {c.preview.dot ? <li>point</li> : null}
            <li>
              <span style={{ color: c.preview.color }} aria-hidden="true">
                ■
              </span>{' '}
              {c.preview.color.toUpperCase()}
            </li>
          </ul>
        ) : null}
        {c.notes ? <p className={styles.notes}>{c.notes}</p> : null}
        <CrosshairStatus c={c} />
        <CopyCode code={c.shareCode} label={c.label} />
        {!c.published ? <span className="chip unknown">Brouillon (visible par les admins)</span> : null}
      </div>
    </article>
  );
}
