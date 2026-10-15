import type { Metadata } from 'next';
import { cache } from 'react';
import { publicMetadata } from '@/lib/seo';
import Link from 'next/link';
import { GrenadeIcon, SideBadge, VerificationNote } from '@/components/stuffs/StuffCard';
import { ReportButton, ShareButton, TrainingMode, VideoEmbed } from '@/components/stuffs/FicheClient';
import { ConsoleCommand, LineupVideo } from '@/components/stuffs/LineupVideo';
import styles from '@/components/stuffs/fiche.module.css';
import { DemoTag, StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { getViewer, isAdmin } from '@/lib/auth/viewer';
import { getMaps, getUtilityDetail, settle } from '@/lib/data/queries';
import type { MapInfo, MapPosition, Utility } from '@/lib/domain/schemas';
import { mapCoverUrl, mediaUrl } from '@/lib/media';
import { fmtDate } from '@/lib/format';
import {
  catalogQuery,
  DIFFICULTY_LABEL,
  filtersToQuery,
  GRENADE_LABEL,
  MOVEMENT_LABEL,
  parseFilters,
  parseMode,
  PRECISION_LABEL,
  SIDE_LABEL,
  throwSummary,
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
  return publicMetadata(
    `${u.title} · ${u.mapName}`,
    u.description || `${GRENADE_LABEL[u.grenade]} sur ${u.mapName} : de ${u.originName} vers ${u.targetName}. Vidéo, point de visée et technique de lancer.`,
    `/stuffs/${encodeURIComponent(mapSlug)}/${encodeURIComponent(stuffSlug)}`,
  );
}

/** Mini-carte : vue aérienne csnades (rectangulaire) avec le lancer, les rebonds et l'arrivée. */
function MiniRadar({ u, radars }: { u: Utility; radars: MapInfo['radars'] }) {
  const level = u.landing?.level ?? u.throw?.level ?? 1;
  const radar = radars.find((r) => r.level === level) ?? radars[0];
  if (!radar || !u.landing) return null;
  const sameLevel = u.throw && (u.throw.level ?? 1) === radar.level;
  const path = sameLevel ? [u.throw!, ...u.bounces, u.landing] : [];
  return (
    <div
      className={`${styles.radar} ${styles.radarRect}`}
      style={{ ['--ar' as string]: String(radar.width / radar.height) }}
      role="img"
      aria-label={`Sur la carte : lancer depuis ${u.originName}, arrivée ${u.targetName}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- vue aérienne csnades (accord écrit) */}
      <img src={radar.imageUrl} alt="" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {path.length > 1 ? (
          <polyline className={styles.ln} points={path.map((p) => `${p.x},${p.y}`).join(' ')} style={{ fill: 'none', vectorEffect: 'non-scaling-stroke', strokeWidth: 1.5 }} />
        ) : null}
      </svg>
      {sameLevel ? u.bounces.map((b, i) => <span key={i} className={styles.mBounce} style={{ left: `${b.x}%`, top: `${b.y}%` }} />) : null}
      {sameLevel ? <span className={styles.mFrom} style={{ left: `${u.throw!.x}%`, top: `${u.throw!.y}%` }} /> : null}
      <span className={styles.mTo} style={{ left: `${u.landing.x}%`, top: `${u.landing.y}%` }} />
    </div>
  );
}

/** Ancienne mini-carte : position de lancer nommée placée par l'admin sur sa propre vue aérienne. */
function LegacyRadar({ u, aerial, position }: { u: Utility; aerial: string; position: MapPosition | null }) {
  return (
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
          <rect className={styles.from} x={position.x - 1.8} y={position.y - 1.8} width={3.6} height={3.6} transform={`rotate(45 ${position.x} ${position.y})`} />
        ) : null}
        {position ? (
          <text x={position.x} y={Math.min(97, position.y + 6.5)} textAnchor="middle">
            {position.name}
          </text>
        ) : null}
      </svg>
    </div>
  );
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
  const radars = mapInfo?.radars ?? [];
  const mapImage = mapInfo ? mapCoverUrl(mapInfo) : null;
  const aerial = mediaUrl(res.data.aerialPath);
  const placement = mediaUrl(u.placementImage);
  const aim = mediaUrl(u.aimImage) ?? u.media?.lineup ?? null;
  const video = youtubeId(u.videoUrl);
  const media = u.media;
  const canonical = `/stuffs/${u.mapSlug}/${u.slug}`;
  const idx = siblings.findIndex((s) => s.slug === u.slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const v = verification(u);
  const fromCsnades = u.source === 'csnades';
  const trainingHref = (slug: string) => `/stuffs/${u.mapSlug}/${slug}${query ? `${query}&` : '?'}entrainement=1`;
  const summary = throwSummary(u);
  let n = 0;
  const num = () => ++n;

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
          <span className={styles.bdg}>{summary}</span>
          {u.precision ? <span className={styles.bdg}>{PRECISION_LABEL[u.precision]}</span> : null}
          {u.difficulty ? <span className={styles.bdg}>{u.difficulty === 'easy' && fromCsnades ? 'Débutant' : DIFFICULTY_LABEL[u.difficulty]}</span> : null}
          {u.status === 'draft' ? <span className="chip unknown">Brouillon (visible par les admins)</span> : null}
          {u.isDemo ? <DemoTag /> : null}
        </div>
        <div className={styles.actions}>
          <Link className="btn btn-ghost btn-sm" href={back}>
            {mode === 'carte' ? '← Retour à la carte' : `← Retour à la grille${filtersToQuery(parseFilters(sp)) ? ' (filtres conservés)' : ''}`}
          </Link>
          <TrainingMode
            initialOpen={sp.entrainement === '1'}
            slide={{
              title: u.title,
              mapName: u.mapName,
              badges: `${GRENADE_LABEL[u.grenade]} · ${SIDE_LABEL[u.side]}${u.precision ? ` · ${PRECISION_LABEL[u.precision]}` : ''}`,
              technique: summary,
              originName: u.originName,
              targetName: u.targetName,
              placement,
              aim,
              video: media ? { mp4: media.video.mp4, webm: media.video.webm, poster: media.poster } : null,
              steps: u.steps,
              position: idx >= 0 ? `${idx + 1} / ${siblings.length}` : 'brouillon',
              prevHref: prev ? trainingHref(prev.slug) : null,
              nextHref: next ? trainingHref(next.slug) : null,
            }}
          />
          <ShareButton path={canonical} />
          {isAdmin(viewer) && u.status === 'published' ? <ReportButton utilityId={u.id} path={canonical} already={myOpenReport} /> : null}
          {viewer.role === 'admin' ? (
            <Link className="btn btn-steel btn-sm" href={`/admin/stuffs/${u.id}`}>
              <Icon name="edit" /> Modifier
            </Link>
          ) : null}
        </div>
        {u.isDemo ? (
          <p className={styles.fakeNote}>Fiche d’exemple fictive : elle montre la mise en page. Aucun départ, point de visée ou lancer réel n’est décrit.</p>
        ) : null}
      </header>

      <div className={styles.fbody}>
        <div className={styles.main}>
          {media ? (
            <section aria-labelledby="s-video">
              <div className={styles.stepH}>
                <span className={styles.stepN}>{num()}</span>
                <h2 id="s-video">Le lineup en vidéo</h2>
                <p>
                  {u.originName} → {u.targetName}
                </p>
              </div>
              <LineupVideo media={media} steps={u.steps} stepTimes={u.stepTimes} title={u.title} />
            </section>
          ) : null}

          {placement ? (
            <section aria-labelledby="s-placement">
              <div className={styles.stepH}>
                <span className={styles.stepN}>{num()}</span>
                <h2 id="s-placement">Placement</h2>
                <p>Départ : {u.originName}</p>
              </div>
              <div className={styles.frame}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={placement} alt={`Capture du placement : ${u.originName}`} />
              </div>
            </section>
          ) : null}

          {aim || !media ? (
            <section aria-labelledby="s-aim">
              <div className={styles.stepH}>
                <span className={styles.stepN}>{num()}</span>
                <h2 id="s-aim">Point de visée</h2>
                <p>Arrivée : {u.targetName}</p>
              </div>
              <div className={styles.frame}>
                {aim ? (
                  // eslint-disable-next-line @next/next/no-img-element -- capture de l'admin ou image de visée csnades
                  <img src={aim} alt={`Point de visée vers ${u.targetName}`} loading="lazy" />
                ) : (
                  <div className={styles.ph}>
                    <Icon name="target" />
                    <b>Capture du point de visée à fournir</b>
                    <span>Aucune capture n’a encore été ajoutée pour cette fiche.</span>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {!media ? (
            <>
              <section aria-labelledby="s-yt">
                <div className={styles.stepH}>
                  <span className={styles.stepN}>{num()}</span>
                  <h2 id="s-yt">Vidéo</h2>
                </div>
                {video ? (
                  <VideoEmbed id={video} title={u.title} />
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    Pas de vidéo pour cette fiche.
                  </p>
                )}
              </section>
              <section aria-labelledby="s-steps">
                <div className={styles.stepH}>
                  <span className={styles.stepN}>{num()}</span>
                  <h2 id="s-steps">Étapes</h2>
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
              </section>
            </>
          ) : null}

          {u.consoleCmd ? (
            <section aria-labelledby="s-console">
              <div className={styles.stepH}>
                <span className={styles.stepN}>{num()}</span>
                <h2 id="s-console">S’entraîner en partie privée</h2>
              </div>
              <ConsoleCommand command={u.consoleCmd} />
              <p className={styles.hint}>
                Lance une partie privée avec <code>sv_cheats 1</code>, puis colle cette commande dans la console : tu es téléporté
                exactement au point de lancer, déjà orienté.
              </p>
            </section>
          ) : null}

          {u.description ? <p style={{ margin: 0 }}>{u.description}</p> : null}

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
              {u.movement ? (
                <div>
                  <dt>Mouvement</dt>
                  <dd>{MOVEMENT_LABEL[u.movement]}</dd>
                </div>
              ) : null}
              <div>
                <dt>Lancer</dt>
                <dd>{summary}</dd>
              </div>
              {u.precision ? (
                <div>
                  <dt>Précision</dt>
                  <dd>{PRECISION_LABEL[u.precision]}</dd>
                </div>
              ) : null}
              {u.airTime !== null ? (
                <div>
                  <dt>Temps de vol</dt>
                  <dd>{u.airTime.toFixed(1).replace('.', ',')} s</dd>
                </div>
              ) : null}
              {u.difficulty ? (
                <div>
                  <dt>Difficulté</dt>
                  <dd>{u.difficulty === 'easy' && fromCsnades ? 'Débutant' : DIFFICULTY_LABEL[u.difficulty]}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          {radars.length > 0 && u.landing ? (
            <div className={styles.box}>
              <h3>Sur la carte</h3>
              <MiniRadar u={u} radars={radars} />
              <p className={styles.radarLegend}>
                <span>
                  <i className={styles.legFrom} />
                  Lancer
                </span>
                <span>
                  <i className={styles.legTo} />
                  Arrivée
                </span>
                <Link className="link" href={`/stuffs/${u.mapSlug}?vue=carte&type=${u.grenade}`}>
                  Voir sur la carte
                </Link>
              </p>
            </div>
          ) : aerial && (position || u.landing) ? (
            <div className={styles.box}>
              <h3>Sur la carte</h3>
              <LegacyRadar u={u} aerial={aerial} position={position} />
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
              </p>
            </div>
          ) : null}
          {fromCsnades ? (
            <div className={`${styles.box} ${styles.source}`}>
              <h3>Source</h3>
              <div className={styles.boxBody}>
                <span>
                  Lineup de <b>csnades.gg</b>, repris avec leur accord.
                  {u.credit ? ` Auteur : ${u.credit}.` : ''}
                </span>
                {u.sourceUpdatedAt ? <span>Mis à jour chez csnades le {fmtDate(u.sourceUpdatedAt)}.</span> : null}
                {u.sourceUrl ? (
                  <a className="link" href={u.sourceUrl} target="_blank" rel="noopener noreferrer">
                    Voir la fiche d’origine <Icon name="ext" style={{ width: 13, height: 13, verticalAlign: '-1px' }} />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className={styles.box}>
            <h3>Vérification</h3>
            <div className={styles.boxBody}>
              <VerificationNote u={u} long />
              <span>
                {v.kind === 'ok'
                  ? `Testé en jeu par la team le ${fmtDate(u.verifiedAt!)}.`
                  : fromCsnades
                    ? 'Pas encore testé en jeu par la team.'
                    : 'Cette fiche doit être testée en jeu par un administrateur.'}{' '}
                Après une mise à jour CS2, un lineup peut ne plus fonctionner.
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
