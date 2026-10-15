import Link from 'next/link';
import { DemoTag } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import type { Utility } from '@/lib/domain/schemas';
import { fmtDate } from '@/lib/format';
import { GRENADE_LABEL, PRECISION_LABEL, SIDE_LABEL, throwSummary, verification, youtubeId } from '@/lib/stuffs';
import styles from './stuffs.module.css';

export type UtilityView = Utility & { placementUrl: string | null; aimUrl: string | null };

const GRENADE_CLASS = { smoke: styles.nSmoke, flash: styles.nFlash, molotov: styles.nMolotov, he: styles.nHe };
const SIDE_CLASS = { T: styles.sbT, CT: styles.sbCT, BOTH: styles.sbBOTH };

export function GrenadeIcon({ grenade }: { grenade: Utility['grenade'] }) {
  return <Icon name={grenade} className={GRENADE_CLASS[grenade]} />;
}

export function SideBadge({ side }: { side: Utility['side'] }) {
  return (
    <span className={`${styles.sb} ${SIDE_CLASS[side]}`} aria-label={`Camp ${SIDE_LABEL[side]}`}>
      {SIDE_LABEL[side]}
    </span>
  );
}

export function VerificationNote({
  u,
  long = false,
}: {
  u: Pick<Utility, 'verifiedAt' | 'openReports' | 'source' | 'sourceUpdatedAt'>;
  long?: boolean;
}) {
  const v = verification(u);
  // Stuff importé et pas encore revérifié par la team : on affiche sa source plutôt qu'une alerte.
  if (u.source === 'csnades' && v.kind === 'never') {
    return (
      <span className={styles.ver}>
        Source csnades.gg{u.sourceUpdatedAt ? ` · mis à jour le ${fmtDate(u.sourceUpdatedAt)}` : ''}
      </span>
    );
  }
  if (v.kind === 'reported') {
    return (
      <span className={`${styles.ver} ${styles.verWarn}`}>
        Signalée à revérifier{long ? ` (${v.reports} signalement${v.reports > 1 ? 's' : ''})` : ''}
      </span>
    );
  }
  if (v.kind === 'never') return <span className={`${styles.ver} ${styles.verWarn}`}>Jamais vérifiée</span>;
  return <span className={styles.ver}>Vérifiée le {fmtDate(u.verifiedAt!)}</span>;
}

/** Carte d'une fiche : ouvre SA fiche, en conservant les filtres du catalogue dans l'URL. */
export function StuffCard({ u, query }: { u: UtilityView; query: string }) {
  const thumb = u.placementUrl ?? u.media?.poster ?? null;
  return (
    <Link className={styles.card} href={`/stuffs/${u.mapSlug}/${u.slug}${query}`}>
      <div className={styles.shot}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- capture de l'admin ou miniature csnades
          <img src={thumb} alt="" loading="lazy" />
        ) : (
          <span className={styles.ph}>
            <Icon name="target" />
            Capture du placement à fournir
          </span>
        )}
        <span className={styles.badgesTop}>
          <span className={styles.nb}>
            <GrenadeIcon grenade={u.grenade} /> {GRENADE_LABEL[u.grenade]}
          </span>
          <SideBadge side={u.side} />
        </span>
        {u.isDemo ? (
          <span className={styles.fake}>
            <DemoTag />
          </span>
        ) : null}
      </div>
      <div className={styles.body}>
        <h3>{u.title}</h3>
        <dl className={styles.route}>
          <dt>Départ</dt>
          <dd>{u.originName}</dd>
          <dt>Arrivée</dt>
          <dd>{u.targetName}</dd>
        </dl>
        <div className={styles.meta}>
          <span className={styles.tech}>{throwSummary(u)}</span>
          {u.precision ? <span>{PRECISION_LABEL[u.precision]}</span> : null}
          {u.difficulty === 'easy' ? <span>Débutant</span> : null}
          {youtubeId(u.videoUrl) || u.media ? (
            <span>
              <Icon name="video" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> Vidéo
            </span>
          ) : null}
          {u.status === 'draft' ? <span className="chip unknown">Brouillon</span> : null}
        </div>
        <VerificationNote u={u} />
      </div>
    </Link>
  );
}
