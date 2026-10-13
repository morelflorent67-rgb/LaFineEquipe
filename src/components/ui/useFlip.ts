'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Glisse chaque élément [data-key] de son ancienne position vers la nouvelle (technique FLIP),
 * en ligne comme en grille. Les valeurs affichées sont déjà les vraies : seule la position est
 * animée. Un élément qui apparaît (après le premier rendu) entre en fondu.
 */
export function useFlip(container: RefObject<HTMLElement | null>, deps: unknown[]) {
  const prev = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();
    const reduced = reducedMotion();
    root.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => {
      const key = el.dataset.key!;
      const r = el.getBoundingClientRect();
      const at = { x: r.left - origin.left, y: r.top - origin.top };
      next.set(key, at);
      if (reduced) return;
      const before = prev.current.get(key);
      if (before === undefined) {
        if (prev.current.size > 0) {
          el.animate([{ opacity: 0, transform: 'translateY(12px) scale(0.98)' }, { opacity: 1, transform: 'none' }], {
            duration: 500,
            easing: 'cubic-bezier(.2,.8,.2,1)',
          });
        }
      } else if (Math.abs(before.x - at.x) > 1 || Math.abs(before.y - at.y) > 1) {
        el.animate([{ transform: `translate(${before.x - at.x}px, ${before.y - at.y}px)` }, { transform: 'none' }], {
          duration: 600,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        });
      }
    });
    prev.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relancé quand l'ordre affiché change
  }, deps);
}
