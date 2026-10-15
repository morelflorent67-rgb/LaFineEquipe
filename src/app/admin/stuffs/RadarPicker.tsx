'use client';

import { useRef } from 'react';
import type { RadarPoint } from '@/lib/domain/schemas';
import styles from './wizard.module.css';

export type PickerRadar = { level: number; imageUrl: string; width: number; height: number };

/**
 * Placement d'un point sur la vue aérienne : clic (souris, doigt), ou clavier une fois la carte
 * sélectionnée (flèches = déplacer de 0,5 %, Maj + flèches = 2 %, Entrée = placer au centre).
 * Les coordonnées sont en % de l'image, comme les stuffs importés.
 */
export function RadarPicker({
  radars,
  level,
  onLevel,
  point,
  other,
  kind,
  onPick,
  label,
}: {
  radars: PickerRadar[];
  level: number;
  onLevel: (level: number) => void;
  point: RadarPoint | null;
  other: RadarPoint | null;
  kind: 'landing' | 'throw';
  onPick: (p: RadarPoint) => void;
  label: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const radar = radars.find((r) => r.level === level) ?? radars[0];
  if (!radar) {
    return (
      <div className="state">
        <strong>Pas de vue aérienne pour cette map</strong>
        <span>Ajoute-la dans Admin › Maps pour pouvoir placer les points.</span>
      </div>
    );
  }
  const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 100) / 100;
  const place = (x: number, y: number) => onPick({ x: clamp(x), y: clamp(y), level: radar.level });
  const onThisLevel = (p: RadarPoint | null) => p && (p.level ?? 1) === radar.level;
  const showLine = onThisLevel(point) && onThisLevel(other);
  const from = kind === 'throw' ? point : other;
  const to = kind === 'throw' ? other : point;

  return (
    <div className={styles.picker}>
      {radars.length > 1 ? (
        <div className={styles.levels} role="group" aria-label="Étage">
          {radars.map((r) => (
            <button key={r.level} type="button" aria-pressed={r.level === radar.level} onClick={() => onLevel(r.level)}>
              {r.level === 1 ? 'Étage haut' : r.level === 2 ? 'Étage bas' : `Étage ${r.level}`}
            </button>
          ))}
        </div>
      ) : null}
      <div
        ref={boxRef}
        className={styles.radarBox}
        style={{ aspectRatio: `${radar.width} / ${radar.height}`, width: `min(100%, 720px, calc(75svh * ${radar.width / radar.height}))` }}
        tabIndex={0}
        role="application"
        aria-label={`${label}. Clique sur la carte, ou utilise les flèches du clavier pour déplacer le point.`}
        onClick={(e) => {
          const r = boxRef.current!.getBoundingClientRect();
          place(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 2 : 0.5;
          const base = onThisLevel(point) ? point! : { x: 50, y: 50 };
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
            Enter: [0, 0],
          };
          const m = moves[e.key];
          if (!m) return;
          e.preventDefault();
          place(base.x + m[0], base.y + m[1]);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- vue aérienne de la map */}
        <img src={radar.imageUrl} alt="" draggable={false} />
        {showLine && from && to ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
          </svg>
        ) : null}
        {onThisLevel(other) ? (
          <span className={`${styles.dot} ${kind === 'throw' ? styles.dotTo : styles.dotFrom} ${styles.dotOther}`} style={{ left: `${other!.x}%`, top: `${other!.y}%` }} />
        ) : null}
        {onThisLevel(point) ? (
          <span className={`${styles.dot} ${kind === 'throw' ? styles.dotFrom : styles.dotTo}`} style={{ left: `${point!.x}%`, top: `${point!.y}%` }} />
        ) : null}
      </div>
      <p className={styles.coords} aria-live="polite">
        {point ? `Point placé : ${String(point.x).replace('.', ',')} % × ${String(point.y).replace('.', ',')} %${radars.length > 1 ? ` (étage ${point.level === 1 ? 'haut' : 'bas'})` : ''}` : 'Aucun point placé.'}
      </p>
    </div>
  );
}
