'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { Grenade, MapInfo } from '@/lib/domain/schemas';
import { GRENADE_LABEL, landingClusters, PRECISION_LABEL, SIDE_LABEL, throwSummary } from '@/lib/stuffs';
import { GrenadeIcon, type UtilityView } from './StuffCard';
import { usePanZoom } from './usePanZoom';
import styles from './radar.module.css';

const GRENADE_CLASS = { smoke: styles.smoke, flash: styles.flash, molotov: styles.molotov, he: styles.he };
const SIDE_CLASS = { T: styles.sideT, CT: styles.sideCT, BOTH: styles.sideBoth };

type Radar = MapInfo['radars'][number];

/** Libellé d'un étage (Nuke : 1 = haut, 2 = bas, d'après les vues aériennes csnades). */
export function levelLabel(level: number, count: number): string {
  if (count < 2) return 'Carte';
  return level === 1 ? 'Étage haut' : level === 2 ? 'Étage bas' : `Étage ${level}`;
}

/** Miniature d'un stuff : capture de l'admin, sinon miniature de la vidéo csnades. */
export function thumbOf(u: UtilityView): string | null {
  return u.placementUrl ?? u.media?.posterSmall ?? u.media?.poster ?? null;
}

/**
 * Carte d'une map centrée sur les points d'arrivée (comme csnades) : un marqueur par endroit où
 * tombent les grenades du type choisi, avec le nombre de stuffs. Un clic relie l'arrivée à chaque
 * point de lancer (en passant par les rebonds connus) et liste les stuffs à droite.
 * Seuls les points réellement enregistrés sont dessinés : aucune trajectoire n'est inventée.
 */
export function RadarMap({
  mapName,
  radars,
  items,
  grenade,
  query,
}: {
  mapName: string;
  radars: Radar[];
  items: UtilityView[];
  grenade: Grenade;
  query: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const pz = usePanZoom({ boxRef, layerRef, labelRef: zoomLabelRef });
  const [level, setLevel] = useState(radars[0]?.level ?? 1);
  const [callouts, setCallouts] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [hl, setHl] = useState<string | null>(null);

  const radar = radars.find((r) => r.level === level) ?? radars[0]!;
  const aspect = radar.width / radar.height;
  const clusters = useMemo(() => landingClusters(items, { level: radar.level, aspect }), [items, radar.level, aspect]);
  const sel = clusters.find((c) => c.key === picked) ?? null;
  const onLevel = (lv: number) => items.filter((u) => u.landing && (u.landing.level ?? 1) === lv).length;
  const unplaced = items.filter((u) => !u.landing).length;
  const shownCount = clusters.reduce((n, c) => n + c.items.length, 0);

  function choose(key: string | null) {
    setPicked(key);
    setHl(null);
  }

  function switchLevel(lv: number) {
    setLevel(lv);
    choose(null);
    pz.reset();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.mapCol}>
        <div className={styles.bar}>
          {radars.length > 1 ? (
            <div className={styles.levels} role="group" aria-label="Étage">
              {radars.map((r) => (
                <button
                  key={r.level}
                  type="button"
                  className={styles.levelBtn}
                  aria-pressed={r.level === radar.level}
                  onClick={() => switchLevel(r.level)}
                >
                  {levelLabel(r.level, radars.length)} <em>{onLevel(r.level)}</em>
                </button>
              ))}
            </div>
          ) : null}
          {radar.calloutsUrl ? (
            <button type="button" className={styles.toggle} aria-pressed={callouts} onClick={() => setCallouts((v) => !v)}>
              <span className={styles.switch} aria-hidden="true" /> Noms des zones
            </button>
          ) : null}
        </div>
        <div className={styles.boxWrap} style={{ ['--ar' as string]: String(aspect) }}>
          <div
            ref={boxRef}
            className={`${styles.box} ${sel ? styles.hasSel : ''}`}
            tabIndex={0}
            role="application"
            aria-roledescription="carte zoomable"
            aria-label={`Vue aérienne de ${mapName}. Plus et moins pour zoomer, flèches pour déplacer, 0 pour recentrer, Échap pour fermer la sélection.`}
            {...pz.handlers}
            onClick={(e) => {
              if (pz.moved.current > 4 || (e.target as HTMLElement).closest('[data-marker]')) return;
              choose(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && sel) {
                e.preventDefault();
                choose(null);
                return;
              }
              pz.handleKey(e);
            }}
          >
            <div ref={layerRef} className={styles.layer}>
              {/* eslint-disable-next-line @next/next/no-img-element -- vue aérienne hébergée par csnades (accord écrit) */}
              <img className={styles.radar} src={radar.imageUrl} alt="" draggable={false} />
              {callouts && radar.calloutsUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- calque des noms de zones (csnades)
                <img className={styles.callouts} src={radar.calloutsUrl} alt="" draggable={false} />
              ) : null}
              <svg className={styles.links} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {sel?.items.map((u) =>
                  u.throw && u.landing && (u.throw.level ?? 1) === radar.level ? (
                    <polyline
                      key={u.id}
                      className={hl === u.id ? styles.lineHl : undefined}
                      points={[u.throw, ...u.bounces, u.landing].map((p) => `${p.x},${p.y}`).join(' ')}
                    />
                  ) : null,
                )}
              </svg>
              {sel?.items.flatMap((u) =>
                !u.throw || (u.throw.level ?? 1) === radar.level
                  ? u.bounces.map((b, i) => (
                      <span key={`${u.id}-b${i}`} className={styles.bounce} style={{ left: `${b.x}%`, top: `${b.y}%` }} aria-hidden="true" />
                    ))
                  : [],
              )}
              {clusters.map((c, i) => (
                <button
                  key={c.key}
                  type="button"
                  data-marker
                  className={`${styles.land} ${GRENADE_CLASS[c.grenade]}`}
                  style={{ left: `${c.x}%`, top: `${c.y}%`, ['--d' as string]: Math.min(i, 30) }}
                  aria-pressed={sel?.key === c.key}
                  aria-label={`${GRENADE_LABEL[c.grenade]} sur ${c.name} : ${c.items.length} stuff${c.items.length > 1 ? 's' : ''}`}
                  onClick={() => choose(sel?.key === c.key ? null : c.key)}
                >
                  <span className={styles.disc}>
                    <GrenadeIcon grenade={c.grenade} />
                  </span>
                  {c.items.length > 1 ? (
                    <span className={styles.count} aria-hidden="true">
                      {c.items.length}
                    </span>
                  ) : null}
                </button>
              ))}
              {sel?.items.map((u) =>
                u.throw && (u.throw.level ?? 1) === radar.level ? (
                  <Link
                    key={u.id}
                    data-marker
                    href={`/stuffs/${u.mapSlug}/${u.slug}${query}`}
                    className={`${styles.from} ${SIDE_CLASS[u.side]} ${hl === u.id ? styles.fromHl : ''}`}
                    style={{ left: `${u.throw.x}%`, top: `${u.throw.y}%` }}
                    aria-label={`${u.title} (${SIDE_LABEL[u.side]}) : ouvrir la fiche`}
                    onMouseEnter={() => setHl(u.id)}
                    onMouseLeave={() => setHl(null)}
                    onFocus={() => setHl(u.id)}
                    onBlur={() => setHl(null)}
                  >
                    <span className={styles.fromDot} />
                    <span className={styles.fromLabel}>{u.originName}</span>
                  </Link>
                ) : null,
              )}
            </div>
          </div>
          <div className={styles.tools}>
            <button type="button" className={styles.tool} aria-label="Zoomer" onClick={pz.zoomIn}>
              <Icon name="plus" />
            </button>
            <button type="button" className={styles.tool} aria-label="Dézoomer" onClick={pz.zoomOut}>
              <span aria-hidden="true" className={styles.minus} />
            </button>
            <button type="button" className={styles.tool} aria-label="Recentrer la carte" onClick={pz.reset}>
              <Icon name="refresh" />
            </button>
          </div>
          <span ref={zoomLabelRef} className={styles.zoom} aria-hidden="true">
            ×1,0
          </span>
        </div>
        <p className={styles.help}>
          Clique un point d’arrivée pour voir d’où lancer · Ctrl + molette ou pincement pour zoomer · glisser pour déplacer
        </p>
      </div>

      <aside className={styles.panel} aria-live="polite">
        {!sel ? (
          <>
            <p className="kicker">{GRENADE_LABEL[grenade]}s · {levelLabel(radar.level, radars.length)}</p>
            <h2 className={styles.panelTitle}>Où veux-tu l’envoyer ?</h2>
            <p className="muted">
              Chaque rond marque un point d’arrivée ; le chiffre indique le nombre de stuffs qui y mènent. Choisis-en un pour voir
              les positions de lancer.
            </p>
            <p className={styles.stat}>
              <b>{clusters.length}</b> point{clusters.length > 1 ? 's' : ''} d’arrivée · <b>{shownCount}</b> stuff
              {shownCount > 1 ? 's' : ''}
            </p>
            {radars.length > 1
              ? radars
                  .filter((r) => r.level !== radar.level && onLevel(r.level) > 0)
                  .map((r) => (
                    <button key={r.level} type="button" className="btn btn-ghost btn-sm" onClick={() => switchLevel(r.level)}>
                      {onLevel(r.level)} autre{onLevel(r.level) > 1 ? 's' : ''} sur l’{levelLabel(r.level, radars.length).toLowerCase()}
                    </button>
                  ))
              : null}
            {unplaced > 0 ? (
              <p className={styles.note}>
                {unplaced} stuff{unplaced > 1 ? 's' : ''} sans point d’arrivée placé : voir la grille.
              </p>
            ) : null}
            {items.length === 0 ? <p className={styles.note}>Aucun stuff ne correspond aux filtres.</p> : null}
          </>
        ) : (
          <>
            <p className="kicker">Arrivée</p>
            <h2 className={styles.panelTitle}>{sel.name}</h2>
            <p className={styles.selMeta}>
              <span className={`${styles.chip} ${GRENADE_CLASS[sel.grenade]}`}>
                <GrenadeIcon grenade={sel.grenade} /> {GRENADE_LABEL[sel.grenade]}
              </span>
              {sel.items.length} position{sel.items.length > 1 ? 's' : ''} de lancer
            </p>
            <ul className={styles.list}>
              {sel.items.map((u, i) => {
                const thumb = thumbOf(u);
                const otherLevel = u.throw && (u.throw.level ?? 1) !== radar.level;
                return (
                  <li key={u.id} style={{ ['--i' as string]: Math.min(i, 12) }}>
                    <Link
                      className={`${styles.item} ${hl === u.id ? styles.itemHl : ''}`}
                      href={`/stuffs/${u.mapSlug}/${u.slug}${query}`}
                      onMouseEnter={() => setHl(u.id)}
                      onMouseLeave={() => setHl(null)}
                      onFocus={() => setHl(u.id)}
                      onBlur={() => setHl(null)}
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- miniature csnades ou capture de l'admin
                        <img src={thumb} alt="" loading="lazy" />
                      ) : (
                        <span className={styles.noShot}>
                          <Icon name="target" />
                        </span>
                      )}
                      <span className={styles.itemText}>
                        <b>Depuis {u.originName}</b>
                        <span className={styles.itemSub}>{throwSummary(u)}</span>
                        <span className={styles.tags}>
                          <span className={`${styles.side} ${SIDE_CLASS[u.side]}`}>{SIDE_LABEL[u.side]}</span>
                          {u.precision ? <span>{PRECISION_LABEL[u.precision]}</span> : null}
                          {u.difficulty === 'easy' ? <span className={styles.easy}>Débutant</span> : null}
                          {otherLevel ? <span>Lancer depuis l’autre étage</span> : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => choose(null)}>
              Fermer la sélection
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
