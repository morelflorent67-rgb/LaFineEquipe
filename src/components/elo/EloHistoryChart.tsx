'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { Delta } from '@/components/ui/badges';
import { chartPoints, eloBounds, type ChartPoint } from '@/lib/elo/history';
import type { EloHistory } from '@/lib/domain/schemas';
import { fmtDateTime, fmtInt, fmtShortDate, fmtTime } from '@/lib/format';
import styles from './elo.module.css';

const W = 600;
const H = 250;
const PL = 46;
const PR = 14;
const PT = 16;
const PB = 30;

/**
 * Courbe ELO d'un joueur : uniquement ses relevés réels depuis l'ajout (rien n'est reconstitué
 * avant). Lecture au survol, au toucher ou au clavier (← →), avec la valeur exacte du relevé.
 */
export function EloHistoryChart({
  history,
  current,
  nickname,
  animate,
}: {
  history: EloHistory;
  current: { elo: number | null; at: string };
  nickname: string;
  animate: boolean;
}) {
  const pts = useMemo(() => chartPoints(history, current), [history, current]);
  const [idx, setIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gradId = useId().replace(/:/g, '');
  const noteId = useId();

  if (pts.length === 0) {
    return <p className={styles.chartEmpty}>Aucun relevé ELO CS2 enregistré depuis l’ajout de {nickname}.</p>;
  }

  const t0 = Date.parse(pts[0]!.at);
  const t1 = Math.max(Date.parse(pts.at(-1)!.at), t0 + 1);
  const { lo, hi } = eloBounds(pts.map((p) => p.elo).concat(history.addedElo !== null ? [history.addedElo] : []));
  const X = (t: number) => (pts.length === 1 ? (PL + W - PR) / 2 : PL + ((t - t0) / (t1 - t0)) * (W - PL - PR));
  const Y = (v: number) => PT + ((hi - v) / (hi - lo)) * (H - PT - PB);
  const xy = pts.map((p) => [X(Date.parse(p.at)), Y(p.elo)] as const);
  // Marches : l'ELO ne change qu'aux relevés, il reste constant entre deux (pas d'interpolation).
  const line = xy.map((q, i) => (i === 0 ? `M${q[0].toFixed(1)} ${q[1].toFixed(1)}` : `H${q[0].toFixed(1)}V${q[1].toFixed(1)}`)).join('');
  const area = xy.length > 1 ? `${line}V${H - PB}H${xy[0]![0].toFixed(1)}Z` : '';
  const ticks = [0, 1, 2, 3, 4].map((k) => lo + ((hi - lo) * k) / 4);
  // Moins de 36 h de relevés : on affiche des heures, sinon des dates ; jamais deux libellés identiques.
  const short = t1 - t0 < 36 * 3600_000;
  const fmtAxis = (at: string) => (short ? fmtTime(at) : fmtShortDate(at));
  const candidates: ChartPoint[] = pts.length > 2 ? [pts[0]!, pts[Math.floor((pts.length - 1) / 2)]!, pts.at(-1)!] : pts;
  const labels = candidates.filter((p, i) => candidates.findIndex((q) => fmtAxis(q.at) === fmtAxis(p.at)) === i);
  const active = idx !== null ? pts[idx] : null;
  const activeXY = idx !== null ? xy[idx] : null;

  const nearest = (clientX: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return 0;
    const x = ((clientX - r.left) / r.width) * W;
    let best = 0;
    xy.forEach((q, i) => {
      if (Math.abs(q[0] - x) < Math.abs(xy[best]![0] - x)) best = i;
    });
    return best;
  };

  return (
    <div
      className={styles.chart}
      tabIndex={0}
      role="group"
      aria-label={`Évolution de l’ELO de ${nickname} depuis son ajout`}
      aria-describedby={noteId}
      onPointerMove={(e) => setIdx(nearest(e.clientX))}
      onPointerDown={(e) => setIdx(nearest(e.clientX))}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setIdx(null);
      }}
      onFocus={() => setIdx((i) => i ?? pts.length - 1)}
      onBlur={() => setIdx(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setIdx((i) => Math.min(pts.length - 1, (i ?? -1) + 1));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setIdx((i) => Math.max(0, (i ?? pts.length) - 1));
        } else if (e.key === 'Escape') {
          setIdx(null);
        }
      }}
    >
      <div className={styles.plot}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`De ${fmtInt(pts[0]!.elo)} à ${fmtInt(pts.at(-1)!.elo)} ELO, ${history.total} relevé${history.total > 1 ? 's' : ''}`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff2a1f" stopOpacity=".28" />
            <stop offset="1" stopColor="#ff2a1f" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className={styles.grid}>
          {ticks.map((v) => (
            <line key={v} x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} />
          ))}
        </g>
        <g className={styles.axis}>
          {ticks.map((v) => (
            <text key={v} x={PL - 8} y={Y(v) + 3} textAnchor="end">
              {Math.round(v)}
            </text>
          ))}
          {labels.map((p, i) => (
            <text
              key={`${p.at}-${i}`}
              x={X(Date.parse(p.at))}
              y={H - 8}
              textAnchor={labels.length === 1 ? 'middle' : i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}
            >
              {fmtAxis(p.at)}
            </text>
          ))}
        </g>
        {history.addedElo !== null ? (
          <>
            <line className={styles.base} x1={PL} x2={W - PR} y1={Y(history.addedElo)} y2={Y(history.addedElo)} />
            <text className={styles.baseLabel} x={W - PR} y={Y(history.addedElo) - 6} textAnchor="end">
              ELO à l’ajout · {history.addedElo}
            </text>
          </>
        ) : null}
        {area ? <path className={styles.area} d={area} fill={`url(#${gradId})`} /> : null}
        {xy.length > 1 ? <path key={`${history.playerId}-${pts.length}`} className={`${styles.line} ${animate ? styles.draw : ''}`} pathLength={1} d={line} /> : null}
        {xy.map((q, i) =>
          pts.length <= 24 || i === 0 || i === xy.length - 1 ? (
            <circle key={i} className={`${styles.pt} ${i === xy.length - 1 ? styles.ptLast : ''}`} cx={q[0]} cy={q[1]} r={i === xy.length - 1 ? 5 : 3} />
          ) : null,
        )}
        {activeXY ? (
          <g className={styles.cursor}>
            <line x1={activeXY[0]} x2={activeXY[0]} y1={PT} y2={H - PB} />
            <circle cx={activeXY[0]} cy={activeXY[1]} r={6} />
          </g>
        ) : null}
      </svg>
      {active && activeXY ? (
        <div className={styles.tip} role="status" style={{ left: `${(activeXY[0] / W) * 100}%`, top: `${(activeXY[1] / H) * 100}%` }}>
          <b className="num">{fmtInt(active.elo)} ELO</b>{' '}
          {idx! > 0 ? <Delta value={active.elo - pts[idx! - 1]!.elo} /> : <span className="muted">(ajout)</span>}
          <small>
            {active.kind === 'current' ? 'Dernier ELO connu · ' : ''}
            {fmtDateTime(active.at)}
          </small>
        </div>
      ) : null}
      </div>
      <p className={styles.chartNote} id={noteId}>
        {pts.length === 1
          ? `Premier relevé le ${fmtDateTime(pts[0]!.at)}. La courbe se complète à chaque synchronisation.`
          : `Relevés FACEIT enregistrés depuis l’ajout le ${fmtShortDate(history.addedAt)}${history.compacted ? ' (un point par jour)' : ''}. Aucun historique antérieur n’est reconstitué. Survole, touche ou utilise ← → pour lire un point.`}
      </p>
    </div>
  );
}
