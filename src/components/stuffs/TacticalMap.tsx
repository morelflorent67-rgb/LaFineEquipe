'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { MapPosition } from '@/lib/domain/schemas';
import { GRENADE_LABEL, GRENADES, SIDE_LABEL, TECHNIQUE_LABEL, tacticalGroups } from '@/lib/stuffs';
import { GrenadeIcon, type UtilityView } from './StuffCard';
import styles from './tactical.module.css';

const MIN_K = 1;
const MAX_K = 5;
const GRENADE_CLASS = { smoke: styles.smoke, flash: styles.flash, molotov: styles.molotov, he: styles.he };

type View = { k: number; x: number; y: number };

/**
 * Carte tactique : vue aérienne zoomable et déplaçable (Ctrl + molette, glisser, pincer, clavier).
 * Un marqueur = une position de lancer placée par l'admin × un type de grenade. Un clic affiche
 * les lineups associés et leurs points d'impact. Aucune trajectoire n'est dessinée : le trait
 * relie seulement le lancer à l'impact.
 * Le zoom et le déplacement modifient directement le style du calque (pas de rendu React).
 */
export function TacticalMap({
  mapName,
  aerialUrl,
  positions,
  items,
  query,
  isAdmin,
  mapSlug,
}: {
  mapName: string;
  aerialUrl: string | null;
  positions: MapPosition[];
  items: UtilityView[];
  query: string;
  isAdmin: boolean;
  mapSlug: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const view = useRef<View>({ k: 1, x: 0, y: 0 });
  const moved = useRef(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [hl, setHl] = useState<string | null>(null);

  const groups = useMemo(() => tacticalGroups(items, positions), [items, positions]);
  const selKey = groups.some((g) => g.key === picked) ? picked : null;
  const sel = groups.find((g) => g.key === selKey) ?? null;
  const unplaced = items.filter((u) => !u.throwPositionId).length;

  const apply = useCallback((next: View, animate: boolean) => {
    const box = boxRef.current;
    const layer = layerRef.current;
    if (!box || !layer) return;
    const s = box.clientWidth;
    const k = Math.min(MAX_K, Math.max(MIN_K, next.k));
    const x = Math.min(0, Math.max(s - s * k, next.x));
    const y = Math.min(0, Math.max(s - s * k, next.y));
    view.current = { k, x, y };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    layer.style.transition = animate && !reduce ? 'transform .35s cubic-bezier(.2,.8,.2,1)' : 'none';
    layer.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    layer.style.setProperty('--k', String(k));
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `×${k.toFixed(1).replace('.', ',')}`;
  }, []);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number, animate: boolean) => {
      const v = view.current;
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const r = k / v.k;
      apply({ k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r }, animate);
    },
    [apply],
  );

  const center = () => (boxRef.current?.clientWidth ?? 0) / 2;
  const local = (e: { clientX: number; clientY: number }) => {
    const r = boxRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  // Molette (écouteur non passif pour bloquer le défilement de la page pendant le zoom).
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // Ctrl + molette (et le pincement des pavés tactiles, signalé avec ctrlKey) : la molette seule fait défiler la page.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = box.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top, false);
    };
    const onResize = () => apply(view.current, false);
    box.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);
    return () => {
      box.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
    };
  }, [apply, zoomAt]);

  // Glisser (un doigt / souris) et pincer (deux doigts).
  const pointers = useRef(new Map<number, readonly [number, number]>());
  const drag = useRef<{ x: number; y: number; p: readonly [number, number] } | { pinch: true; d: number; k: number; x: number; y: number; m: [number, number] } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-marker]')) {
      moved.current = 0;
      return;
    }
    boxRef.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    moved.current = 0;
    const pts = [...pointers.current.values()];
    if (pts.length === 1) drag.current = { x: view.current.x, y: view.current.y, p: pts[0]! };
    if (pts.length === 2) {
      const [a, b] = pts as [readonly [number, number], readonly [number, number]];
      drag.current = { pinch: true, d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.current.k, x: view.current.x, y: view.current.y, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    pointers.current.set(e.pointerId, local(e));
    const d = drag.current;
    const pts = [...pointers.current.values()];
    if ('pinch' in d && pts.length === 2) {
      const [a, b] = pts as [readonly [number, number], readonly [number, number]];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const m: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const k = Math.min(MAX_K, Math.max(MIN_K, (d.k * dist) / d.d));
      const r = k / d.k;
      apply({ k, x: m[0] - (d.m[0] - d.x) * r, y: m[1] - (d.m[1] - d.y) * r }, false);
      moved.current = 99;
    } else if (!('pinch' in d)) {
      const p = local(e);
      const dx = p[0] - d.p[0];
      const dy = p[1] - d.p[1];
      moved.current = Math.max(moved.current, Math.abs(dx) + Math.abs(dy));
      if (moved.current > 4) {
        boxRef.current!.dataset.dragging = 'true';
        apply({ k: view.current.k, x: d.x + dx, y: d.y + dy }, false);
      }
    }
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const rest = [...pointers.current.values()];
    if (rest.length === 0) {
      drag.current = null;
      delete boxRef.current!.dataset.dragging;
    } else if (rest.length === 1) {
      drag.current = { x: view.current.x, y: view.current.y, p: rest[0]! };
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const c = center();
    const step = 50;
    const v = view.current;
    const actions: Record<string, () => void> = {
      '+': () => zoomAt(1.4, c, c, true),
      '=': () => zoomAt(1.4, c, c, true),
      '-': () => zoomAt(1 / 1.4, c, c, true),
      '0': () => apply({ k: 1, x: 0, y: 0 }, true),
      ArrowLeft: () => apply({ ...v, x: v.x + step }, true),
      ArrowRight: () => apply({ ...v, x: v.x - step }, true),
      ArrowUp: () => apply({ ...v, y: v.y + step }, true),
      ArrowDown: () => apply({ ...v, y: v.y - step }, true),
      Escape: () => setPicked(null),
    };
    const run = actions[e.key];
    if (run) {
      e.preventDefault();
      run();
    }
  };

  // Décalage horizontal des marqueurs qui partagent une même position.
  const offsets = useMemo(() => {
    const byPos = new Map<string, string[]>();
    for (const g of groups) byPos.set(g.position.id, [...(byPos.get(g.position.id) ?? []), g.key]);
    const out = new Map<string, number>();
    for (const keys of byPos.values()) keys.forEach((k, i) => out.set(k, (i - (keys.length - 1) / 2) * 40));
    return out;
  }, [groups]);
  const labelled = useMemo(() => [...new Map(groups.map((g) => [g.position.id, g.position])).values()], [groups]);

  if (!aerialUrl) {
    return (
      <div className="state">
        <strong>Vue aérienne de {mapName} pas encore ajoutée</strong>
        <span>La carte tactique apparaîtra dès qu’un administrateur aura téléversé la vue aérienne de la map.</span>
        {isAdmin ? (
          <div className="actions">
            <Link className="btn btn-steel btn-sm" href={`/admin/maps/${mapSlug}`}>
              Ajouter la vue aérienne
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.mapCol}>
        <div className={styles.boxWrap}>
          <div
            ref={boxRef}
            className={`${styles.box} ${sel ? styles.hasSel : ''}`}
            tabIndex={0}
            role="application"
            aria-roledescription="carte zoomable"
            aria-label={`Vue aérienne de ${mapName}. Plus et moins pour zoomer, flèches pour déplacer, 0 pour recentrer.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onDoubleClick={(e) => {
              if ((e.target as HTMLElement).closest('[data-marker]')) return;
              const p = local(e);
              zoomAt(1.8, p[0], p[1], true);
            }}
            onKeyDown={onKeyDown}
          >
            <div ref={layerRef} className={styles.layer}>
              {/* eslint-disable-next-line @next/next/no-img-element -- vue aérienne téléversée par l'admin */}
              <img className={styles.radar} src={aerialUrl} alt="" draggable={false} />
              <svg className={styles.links} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {sel?.items.map((u) =>
                  u.landing ? (
                    <line
                      key={u.id}
                      className={hl === u.id ? styles.lineHl : undefined}
                      x1={sel.position.x}
                      y1={sel.position.y}
                      x2={u.landing.x}
                      y2={u.landing.y}
                    />
                  ) : null,
                )}
              </svg>
              {labelled.map((p) => (
                <span key={p.id} className={styles.label} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                  {p.name}
                </span>
              ))}
              {groups.map((g, i) => (
                <button
                  key={g.key}
                  type="button"
                  data-marker
                  className={`${styles.marker} ${GRENADE_CLASS[g.grenade]}`}
                  style={{ left: `${g.position.x}%`, top: `${g.position.y}%`, ['--ox' as string]: `${offsets.get(g.key) ?? 0}px`, ['--d' as string]: i }}
                  aria-pressed={selKey === g.key}
                  aria-label={`${GRENADE_LABEL[g.grenade]} depuis ${g.position.name} : ${g.items.length} lineup${g.items.length > 1 ? 's' : ''}`}
                  onClick={() => {
                    if (moved.current > 4) return;
                    setPicked((k) => (k === g.key ? null : g.key));
                  }}
                >
                  <span className={styles.dia}>
                    <GrenadeIcon grenade={g.grenade} />
                  </span>
                  {g.items.length > 1 ? (
                    <span className={styles.count} aria-hidden="true">
                      {g.items.length}
                    </span>
                  ) : null}
                </button>
              ))}
              {sel?.items.map((u) =>
                u.landing ? (
                  <span
                    key={u.id}
                    className={`${styles.land} ${GRENADE_CLASS[u.grenade]} ${hl === u.id ? styles.landHl : ''}`}
                    style={{ left: `${u.landing.x}%`, top: `${u.landing.y}%` }}
                  >
                    <span className={styles.ring} />
                    <span className={styles.landLabel}>{u.targetName}</span>
                  </span>
                ) : null,
              )}
            </div>
          </div>
          <div className={styles.tools}>
            <button type="button" className={styles.tool} aria-label="Zoomer" onClick={() => zoomAt(1.4, center(), center(), true)}>
              <Icon name="plus" />
            </button>
            <button type="button" className={styles.tool} aria-label="Dézoomer" onClick={() => zoomAt(1 / 1.4, center(), center(), true)}>
              <span aria-hidden="true" className={styles.minus} />
            </button>
            <button type="button" className={styles.tool} aria-label="Recentrer la carte" onClick={() => apply({ k: 1, x: 0, y: 0 }, true)}>
              <Icon name="refresh" />
            </button>
          </div>
          <span ref={zoomLabelRef} className={styles.zoom} aria-hidden="true">
            ×1,0
          </span>
        </div>
        <p className={styles.help}>Ctrl + molette ou pincement pour zoomer · glisser pour déplacer · double-clic pour zoomer · clavier : + − flèches 0</p>
      </div>

      <aside className={styles.panel} aria-live="polite">
        {positions.length === 0 ? (
          <>
            <p className="kicker">Carte tactique</p>
            <h2 className={styles.panelTitle}>Aucune position placée</h2>
            <p className="muted">Les lineups de {mapName} n’ont pas encore de position de lancer sur la vue aérienne. Ils restent consultables dans la bibliothèque.</p>
            {isAdmin ? (
              <Link className="btn btn-steel btn-sm" href={`/admin/maps/${mapSlug}`}>
                Placer des positions
              </Link>
            ) : null}
          </>
        ) : !sel ? (
          <>
            <p className="kicker">Carte tactique</p>
            <h2 className={styles.panelTitle}>Choisis un point de lancer</h2>
            <p className="muted">Chaque losange est une position de lancer, avec la couleur et le pictogramme de la grenade. Le chiffre indique le nombre de lineups.</p>
            <ul className={styles.legend}>
              {GRENADES.map((g) => {
                const n = groups.filter((x) => x.grenade === g).reduce((s, x) => s + x.items.length, 0);
                return (
                  <li key={g} className={GRENADE_CLASS[g]}>
                    <span className={styles.legDia}>
                      <GrenadeIcon grenade={g} />
                    </span>
                    <span>
                      {GRENADE_LABEL[g]} · {n} visible{n > 1 ? 's' : ''}
                    </span>
                  </li>
                );
              })}
              <li>
                <span className={styles.legRing} /> Point d’impact (après sélection)
              </li>
            </ul>
            {unplaced > 0 ? (
              <p className={styles.unplaced}>
                {unplaced} lineup{unplaced > 1 ? 's' : ''} sans position placée : voir la bibliothèque.
              </p>
            ) : null}
            {groups.length === 0 && items.length > 0 ? <p className={styles.unplaced}>Aucun marqueur avec ces filtres.</p> : null}
          </>
        ) : (
          <>
            <p className="kicker">Depuis</p>
            <h2 className={styles.panelTitle}>{sel.position.name}</h2>
            <span className={`${styles.nade} ${GRENADE_CLASS[sel.grenade]}`}>
              <GrenadeIcon grenade={sel.grenade} /> {GRENADE_LABEL[sel.grenade]}
            </span>
            <ul className={styles.list}>
              {sel.items.map((u, i) => (
                <li key={u.id} style={{ ['--i' as string]: i }}>
                  <Link
                    className={styles.item}
                    href={`/stuffs/${u.mapSlug}/${u.slug}${query}`}
                    onMouseEnter={() => setHl(u.id)}
                    onMouseLeave={() => setHl(null)}
                    onFocus={() => setHl(u.id)}
                    onBlur={() => setHl(null)}
                  >
                    {u.placementUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.placementUrl} alt="" loading="lazy" />
                    ) : (
                      <span className={styles.noShot}>
                        <Icon name="target" />
                      </span>
                    )}
                    <span>
                      <b>{u.title}</b>
                      <span className={styles.itemSub}>
                        → {u.targetName} · {TECHNIQUE_LABEL[u.technique]} · {SIDE_LABEL[u.side]}
                        {u.landing ? '' : ' · impact non placé'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked(null)}>
              Fermer la sélection
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
