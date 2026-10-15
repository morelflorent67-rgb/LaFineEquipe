'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';

export type PanZoomView = { k: number; x: number; y: number };

/**
 * Zoom et déplacement d'un calque dans son cadre (rectangulaire) : Ctrl + molette, pincement,
 * glisser, double-clic, clavier (+ − flèches 0). Le style du calque est modifié directement
 * (pas de rendu React) ; la variable CSS --k permet aux marqueurs de garder leur taille à l'écran.
 */
export function usePanZoom({
  boxRef,
  layerRef,
  labelRef,
  maxK = 5,
  ignore = '[data-marker]',
}: {
  boxRef: RefObject<HTMLDivElement | null>;
  layerRef: RefObject<HTMLDivElement | null>;
  labelRef?: RefObject<HTMLSpanElement | null>;
  maxK?: number;
  /** Les pointeurs posés sur ces éléments (marqueurs) ne déclenchent pas de déplacement. */
  ignore?: string;
}) {
  const view = useRef<PanZoomView>({ k: 1, x: 0, y: 0 });
  /** Distance parcourue par le dernier geste : au-delà de 4 px, ce n'est plus un clic. */
  const moved = useRef(0);

  const apply = useCallback(
    (next: PanZoomView, animate: boolean) => {
      const box = boxRef.current;
      const layer = layerRef.current;
      if (!box || !layer) return;
      const w = box.clientWidth;
      const h = box.clientHeight;
      const k = Math.min(maxK, Math.max(1, next.k));
      const x = Math.min(0, Math.max(w - w * k, next.x));
      const y = Math.min(0, Math.max(h - h * k, next.y));
      view.current = { k, x, y };
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      layer.style.transition = animate && !reduce ? 'transform .35s cubic-bezier(.2,.8,.2,1)' : 'none';
      layer.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      layer.style.setProperty('--k', String(k));
      if (labelRef?.current) labelRef.current.textContent = `×${k.toFixed(1).replace('.', ',')}`;
    },
    [boxRef, layerRef, labelRef, maxK],
  );

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number, animate: boolean) => {
      const v = view.current;
      const k = Math.min(maxK, Math.max(1, v.k * factor));
      const r = k / v.k;
      apply({ k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r }, animate);
    },
    [apply, maxK],
  );

  const center = useCallback((): [number, number] => {
    const box = boxRef.current;
    return [(box?.clientWidth ?? 0) / 2, (box?.clientHeight ?? 0) / 2];
  }, [boxRef]);

  const zoomIn = useCallback(() => zoomAt(1.4, ...center(), true), [zoomAt, center]);
  const zoomOut = useCallback(() => zoomAt(1 / 1.4, ...center(), true), [zoomAt, center]);
  const reset = useCallback(() => apply({ k: 1, x: 0, y: 0 }, true), [apply]);

  /** Centre la vue sur un point (en % du calque) en zoomant au moins jusqu'à `minK`. */
  const focus = useCallback(
    (px: number, py: number, minK = 1.8) => {
      const box = boxRef.current;
      if (!box) return;
      const k = Math.max(view.current.k, minK);
      const w = box.clientWidth;
      const h = box.clientHeight;
      apply({ k, x: w / 2 - (px / 100) * w * k, y: h / 2 - (py / 100) * h * k }, true);
    },
    [apply, boxRef],
  );

  // Molette (écouteur non passif) et redimensionnement.
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
    const observer = new ResizeObserver(() => apply(view.current, false));
    box.addEventListener('wheel', onWheel, { passive: false });
    observer.observe(box);
    return () => {
      box.removeEventListener('wheel', onWheel);
      observer.disconnect();
    };
  }, [apply, zoomAt, boxRef]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = boxRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  // Glisser (un doigt / souris) et pincer (deux doigts).
  const pointers = useRef(new Map<number, readonly [number, number]>());
  const drag = useRef<
    | { x: number; y: number; p: readonly [number, number] }
    | { pinch: true; d: number; k: number; x: number; y: number; m: [number, number] }
    | null
  >(null);

  const onPointerDown = (e: React.PointerEvent) => {
    moved.current = 0;
    if ((e.target as HTMLElement).closest(ignore)) return;
    boxRef.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    if (pts.length === 1) drag.current = { x: view.current.x, y: view.current.y, p: pts[0]! };
    if (pts.length === 2) {
      const [a, b] = pts as [readonly [number, number], readonly [number, number]];
      drag.current = {
        pinch: true,
        d: Math.hypot(a[0] - b[0], a[1] - b[1]),
        k: view.current.k,
        x: view.current.x,
        y: view.current.y,
        m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      };
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
      const k = Math.min(maxK, Math.max(1, (d.k * dist) / d.d));
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
  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(ignore)) return;
    const p = local(e);
    zoomAt(1.8, p[0], p[1], true);
  };
  /** Raccourcis clavier ; renvoie vrai si la touche a été utilisée. */
  const handleKey = (e: React.KeyboardEvent): boolean => {
    const v = view.current;
    const step = 50;
    const actions: Record<string, () => void> = {
      '+': zoomIn,
      '=': zoomIn,
      '-': zoomOut,
      '0': reset,
      ArrowLeft: () => apply({ ...v, x: v.x + step }, true),
      ArrowRight: () => apply({ ...v, x: v.x - step }, true),
      ArrowUp: () => apply({ ...v, y: v.y + step }, true),
      ArrowDown: () => apply({ ...v, y: v.y - step }, true),
    };
    const run = actions[e.key];
    if (!run) return false;
    e.preventDefault();
    run();
    return true;
  };

  return {
    moved,
    zoomIn,
    zoomOut,
    reset,
    focus,
    handleKey,
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onDoubleClick },
  };
}
