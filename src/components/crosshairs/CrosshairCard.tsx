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
import proCrosshairs from '@/lib/pro-crosshairs.json';

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
  // L'image est liée au code exact, jamais au seul pseudo. Un code modifié ne garde pas un ancien visuel.
  const pro = !c.isDemo ? proCrosshairs.find((p) => p.code === c.shareCode) : undefined;
  const bg = c.map ? mapCoverUrl(c.map) : null;
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <h3>{c.label.replace(/ · pro$/, '')}</h3>
        {pro ? <span className={styles.pro}>PRO</span> : c.isDemo ? <DemoTag /> : null}
      </div>
      <div className={styles.prev}>
        {bg && !pro ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bg} alt="" loading="lazy" />
        ) : null}
        {pro ? (
          // eslint-disable-next-line @next/next/no-img-element -- image locale du rendu source, pixels conservés
          <img
            className={styles.sourceImage}
            src={pro.image}
            width={132}
            height={132}
            alt={`Visuel du viseur ${c.label.replace(/ · pro$/, '')}, associé au code de partage`}
            loading="lazy"
          />
        ) : c.preview ? (
          <CrosshairPreview preview={c.preview} label={`Aperçu indicatif du réticule ${c.label}`} />
        ) : (
          <span className={styles.noPrev}>Pas d’aperçu</span>
        )}
        <span className={styles.ind}>{pro ? 'Visuel source · ×2' : c.preview ? 'Aperçu indicatif' : ''}</span>
      </div>
      <div className={styles.body}>
        <CopyCode code={c.shareCode} label={c.label} compact />
        <details className={styles.details}>
          <summary>Détails & source</summary>
          <code className={styles.fullCode}>{c.shareCode}</code>
          {pro ? (
            <p className={styles.notes}>
              <a href={pro.source} target="_blank" rel="noreferrer">
                Voir le code et son visuel à la source ↗
              </a>
              <br />
              Relevé le {fmtDate(pro.collectedAt)}. Rendu du fournisseur, pas une capture en jeu.
            </p>
          ) : null}
          {c.player ? (
            <div className={styles.head}>
              {c.player ? <Avatar src={c.player.avatarUrl} size={34} /> : null}
              <div>
                <span className={styles.own}>{c.player ? c.player.nickname : 'Preset communautaire'}</span>
              </div>
            </div>
          ) : null}
          {c.preview && !pro ? (
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
        </details>
        {!c.published ? <span className="chip unknown">Brouillon (visible par les admins)</span> : null}
      </div>
    </article>
  );
}
