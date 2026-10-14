import type { Metadata } from 'next';
import { cache } from 'react';
import { publicMetadata } from '@/lib/seo';
import Link from 'next/link';
import { GrenadeIcon, SideBadge, VerificationNote } from '@/components/stuffs/StuffCard';
import { ReportButton, ShareButton, TrainingMode, VideoEmbed } from '@/components/stuffs/FicheClient';
import styles from '@/components/stuffs/fiche.module.css';
import { DemoTag, StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { getViewer, isAdmin } from '@/lib/auth/viewer';
import { getMaps, getUtilityDetail, settle } from '@/lib/data/queries';
import { mapCoverUrl, mediaUrl } from '@/lib/media';
import { fmtDate } from '@/lib/format';
import {
  catalogQuery,
  DIFFICULTY_LABEL,
  GRENADE_LABEL,
  parseFilters,
  parseMode,
  SIDE_LABEL,
  TECHNIQUE_LABEL,
  verification,
  youtubeId,
} from '@/lib/stuffs';

type Props = {
  params: Promise<{ mapSlug: string; stuffSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const load = cache(async (mapSlug: string, stuffSlug: string) => {
  if (!SLUG.test(mapSlug) || !SLUG.test(stuffSlug)) return { ok: true as const, data: null };
  return settle(getUtilityDetail(mapSlug, stuffSlug));
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mapSlug, stuffSlug } = await params;
  const res = await load(mapSlug, stuffSlug);
  if (!res.ok || !res.data || res.data.utility.status !== 'published' || res.data.utility.isDemo) return { title: 'Stuff', robots: { index: false, follow: false } };
  const u = res.data.utility;
  return publicMetadata(`${u.title} · ${u.mapName}`, u.description || `${GRENADE_LABEL[u.grenade]} sur ${u.mapName} : de ${u.originName} vers ${u.targetName}. Placement et technique de lancer de LaFineEquipe.`, `/stuffs/${encodeURIComponent(mapSlug)}/${encodeURIComponent(stuffSlug)}`);
}

export default async function StuffPage({ params, searchParams }: Props) {
  const { mapSlug, stuffSlug } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  const res = await load(mapSlug, stuffSlug);
  const mode = parseMode(sp);
  const query = catalogQuery(parseFilters(sp), mode);
  const back = `/stuffs/${mapSlug}${query}`;

  if (!res.ok) {
    return (
      <section className="sec">
        <StateBlock kind="error" title="Fiche momentanément indisponible" />
      </section>
    );
  }
  if (!res.data) {
    return (
      <section className="sec">
        <StateBlock
          title="Fiche introuvable"
          actions={
            <Link className="btn btn-steel btn-sm" href={SLUG.test(mapSlug) ? back : '/stuffs'}>
              Retour au catalogue
            </Link>
          }
        >
          Cette fiche n’existe pas, n’est pas encore publiée ou a été supprimée.
        </StateBlock>
      </section>
    );
  }

  const { utility: u, siblings, related, myOpenReport, position } = res.data;
  const maps = await settle(getMaps());
  const mapInfo = maps.ok ? maps.data.find((m) => m.slug === u.mapSlug) : undefined;
  const mapImage = mapInfo ? mapCoverUrl(mapInfo) : null;
  const aerial = mediaUrl(res.data.aerialPath);
  const placement = mediaUrl(u.placementImage);
  const aim = mediaUrl(u.aimImage);
  const video = youtubeId(u.videoUrl);
  const canonical = `/stuffs/${u.mapSlug}/${u.slug}`;
  const idx = siblings.findIndex((s) => s.slug === u.slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const v = verification(u);
  const trainingHref = (slug: string) => `/stuffs/${u.mapSlug}/${slug}${query ? `${query}&` : '?'}entrainement=1`;

  return (
    <>
      <header className={styles.fhead}>
        <div className={styles.art} style={mapImage ? { backgroundImage: `url(${mapImage})` } : undefined} />
        <ol className="crumb" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: 0, font: '600 13px/1 var(--f)', color: 'var(--muted)' }} aria-label="Fil d’Ariane">
          <li>
            <Link href="/stuffs">Stuffs</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={back}>{u.mapName}</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{u.title}</li>
        </ol>
        <h1 className={`h1 ${styles.title}`}>{u.title}</h1>
        <div className={styles.badges}>
          <span className={styles.bdg}>{u.mapName}</span>
          <SideBadge side={u.side} />
          <span className={styles.bdg}>
            <GrenadeIcon grenade={u.grenade} /> {GRENADE_LABEL[u.grenade]}
          </span>
          <span className={styles.bdg}>{TECHNIQUE_LABEL[u.technique]}</span>
          <span className={styles.bdg}>{DIFFICULTY_LABEL[u.difficulty]}</span>
          {u.status === 'draft' ? <span className="chip unknown">Brouillon (visible par les admins)</span> : null}
          {u.isDemo ? <DemoTag /> : null}
        </div>
        <div className={styles.actions}>
          <Link className="btn btn-ghost btn-sm" href={back}>
            {mode === 'carte' ? '← Retour à la carte tactique' : `← Retour au catalogue${query ? ' (filtres conservés)' : ''}`}
          </Link>
          <TrainingMode
            initialOpen={sp.entrainement === '1'}
            slide={{
              title: u.title,
              mapName: u.mapName,
              badges: `${GRENADE_LABEL[u.grenade]} · ${SIDE_LABEL[u.side]} · ${DIFFICULTY_LABEL[u.difficulty]}`,
              technique: TECHNIQUE_LABEL[u.technique],
              originName: u.originName,
              targetName: u.targetName,
              placement,
              aim,
              steps: u.steps,
              position: idx >= 0 ? `${idx + 1} / ${siblings.length}` : 'brouillon',
              prevHref: prev ? trainingHref(prev.slug) : null,
              nextHref: next ? trainingHref(next.slug) : null,
            }}
          />
          <ShareButton path={canonical} />
          {isAdmin(viewer) && u.status === 'published' ? (
            <ReportButton utilityId={u.id} path={canonical} already={myOpenReport} />
          ) : null}
          {viewer.role === 'admin' ? (
            <Link className="btn btn-steel btn-sm" href={`/admin/stuffs/${u.id}`}>
              <Icon name="edit" /> Modifier
            </Link>
          ) : null}
        </div>
        {u.isDemo ? (
          <p className={styles.fakeNote}>
            Fiche d’exemple fictive : elle montre la mise en page. Aucun départ, point de visée ou lancer réel n’est décrit.
          </p>
        ) : null}
      </header>

      <div className={styles.fbody}>
        <div className={styles.main}>
          <section aria-labelledby="s1">
            <div className={styles.stepH}>
              <span className={styles.stepN}>1</span>
              <h2 id="s1">Placement</h2>
              <p>Départ : {u.originName}</p>
            </div>
            <div className={styles.frame}>
              {placement ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={placement} alt={`Capture du placement : ${u.originName}`} />
              ) : (
                <div className={styles.ph}>
                  <Icon name="target" />
                  <b>Capture du placement à fournir</b>
                  <span>Aucune capture n’a encore été ajoutée pour cette fiche.</span>
                </div>
              )}
            </div>
          </section>
          <section aria-labelledby="s2">
            <div className={styles.stepH}>
              <span className={styles.stepN}>2</span>
              <h2 id="s2">Point de visée</h2>
              <p>Arrivée : {u.targetName}</p>
            </div>
            <div className={styles.frame}>
              {aim ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={aim} alt={`Capture du point de visée vers ${u.targetName}`} />
              ) : (
                <div className={styles.ph}>
                  <Icon name="target" />
                  <b>Capture du point de visée à fournir</b>
                  <span>Aucune capture n’a encore été ajoutée pour cette fiche.</span>
                </div>
              )}
            </div>
          </section>
          <section aria-labelledby="s3">
            <div className={styles.stepH}>
              <span className={styles.stepN}>3</span>
              <h2 id="s3">Vidéo</h2>
            </div>
            {video ? (
              <VideoEmbed id={video} title={u.title} />
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Pas de vidéo pour cette fiche.
              </p>
            )}
          </section>
          <section aria-labelledby="s4">
            <div className={styles.stepH}>
              <span className={styles.stepN}>4</span>
              <h2 id="s4">Étapes</h2>
              {u.purpose ? <p>{u.purpose}</p> : null}
            </div>
            {u.steps.length > 0 ? (
              <ol className={styles.steps}>
                {u.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Instructions pas encore rédigées.
              </p>
            )}
            {u.description ? <p style={{ marginTop: 14 }}>{u.description}</p> : null}
          </section>
          <nav className={styles.pager} aria-label="Fiches de la même map">
            {prev ? (
              <Link className="link" href={`/stuffs/${u.mapSlug}/${prev.slug}${query}`}>
                ← {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link className="link" href={`/stuffs/${u.mapSlug}/${next.slug}${query}`}>
                {next.title} →
              </Link>
            ) : null}
          </nav>
        </div>

        <aside className={styles.facts} aria-label="Résumé de la fiche">
          <div className={styles.box}>
            <h3>Fiche</h3>
            <dl>
              <div>
                <dt>Map</dt>
                <dd>{u.mapName}</dd>
              </div>
              <div>
                <dt>Camp</dt>
                <dd>{SIDE_LABEL[u.side]}</dd>
              </div>
              <div>
                <dt>Grenade</dt>
                <dd>{GRENADE_LABEL[u.grenade]}</dd>
              </div>
              {u.zone ? (
                <div>
                  <dt>Zone</dt>
                  <dd>{u.zone}</dd>
                </div>
              ) : null}
              <div>
                <dt>Départ</dt>
                <dd>{u.originName}</dd>
              </div>
              <div>
                <dt>Arrivée</dt>
                <dd>{u.targetName}</dd>
              </div>
              <div>
                <dt>Lancer</dt>
                <dd>{TECHNIQUE_LABEL[u.technique]}</dd>
              </div>
              <div>
                <dt>Difficulté</dt>
                <dd>{DIFFICULTY_LABEL[u.difficulty]}</dd>
              </div>
            </dl>
          </div>
          {aerial && (position || u.landing) ? (
            <div className={styles.box}>
              <h3>Sur la carte</h3>
              <div className={styles.radar}>
                {/* eslint-disable-next-line @next/next/no-img-element -- vue aérienne téléversée par l'admin */}
                <img src={aerial} alt="" />
                <svg
                  viewBox="0 0 100 100"
                  role="img"
                  aria-label={[position ? `Lancer depuis ${position.name}` : null, u.landing ? `impact : ${u.targetName}` : null].filter(Boolean).join(', ')}
                >
                  {position && u.landing ? <line className={styles.ln} x1={position.x} y1={position.y} x2={u.landing.x} y2={u.landing.y} /> : null}
                  {u.landing ? <circle className={styles.to} cx={u.landing.x} cy={u.landing.y} r={2.6} /> : null}
                  {position ? (
                    <rect
                      className={styles.from}
                      x={position.x - 1.8}
                      y={position.y - 1.8}
                      width={3.6}
                      height={3.6}
                      transform={`rotate(45 ${position.x} ${position.y})`}
                    />
                  ) : null}
                  {position ? (
                    <text x={position.x} y={Math.min(97, position.y + 6.5)} textAnchor="middle">
                      {position.name}
                    </text>
                  ) : null}
                </svg>
              </div>
              <p className={styles.radarLegend}>
                {position ? (
                  <span>
                    <i className={styles.legFrom} />
                    Lancer
                  </span>
                ) : null}
                {u.landing ? (
                  <span>
                    <i className={styles.legTo} />
                    Impact
                  </span>
                ) : null}
                {position ? (
                  <Link className="link" href={`/stuffs/${u.mapSlug}?vue=carte`}>
                    Voir sur la carte tactique
                  </Link>
                ) : null}
              </p>
            </div>
          ) : null}
          <div className={styles.box}>
            <h3>Vérification</h3>
            <div className={styles.boxBody}>
              <VerificationNote u={u} long />
              <span>
                {v.kind === 'ok'
                  ? `Dernier test en jeu le ${fmtDate(u.verifiedAt!)}.`
                  : 'Cette fiche doit être testée en jeu par un administrateur.'}{' '}
                Après une mise à jour CS2, une fiche peut ne plus fonctionner : signale-la si c’est le cas.
              </span>
            </div>
          </div>
          {related.length > 0 ? (
            <div className={styles.box}>
              <h3>À voir aussi</h3>
              <ul className={styles.related}>
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/stuffs/${r.mapSlug}/${r.slug}${query}`}>
                      <GrenadeIcon grenade={r.grenade} /> {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
