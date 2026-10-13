'use client';

import { useRef, type ReactNode } from 'react';

/**
 * Parallaxe discrète du hero : suit la souris uniquement (pas au toucher), désactivée si
 * l'utilisateur a demandé moins d'animations. Seules les variables CSS --mx/--my changent.
 */
export function HeroParallax({ className, labelledBy, children }: { className?: string; labelledBy: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const raf = useRef(0);

  function set(x: number, y: number) {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      ref.current?.style.setProperty('--mx', x.toFixed(3));
      ref.current?.style.setProperty('--my', y.toFixed(3));
    });
  }

  return (
    <section
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const r = e.currentTarget.getBoundingClientRect();
        set(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
      }}
      onPointerLeave={() => set(0, 0)}
    >
      {children}
    </section>
  );
}
