'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Apparition au défilement des éléments marqués `data-rv` (ordre via la variable CSS --i).
 * Sans JavaScript, ou avec « réduire les animations », tout reste visible : les éléments ne
 * sont masqués qu'une fois l'observateur prêt, et ceux déjà à l'écran s'affichent sans effet.
 */
export function RevealObserver() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    const pending = [...document.querySelectorAll<HTMLElement>('[data-rv]:not([data-in])')];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      pending.forEach((el) => el.setAttribute('data-in', ''));
      return;
    }
    const vh = window.innerHeight;
    for (const el of pending) {
      const r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) el.setAttribute('data-in', '');
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute('data-in', '');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    pending.filter((el) => !el.hasAttribute('data-in')).forEach((el) => io.observe(el));
    root.setAttribute('data-reveal', '');
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
