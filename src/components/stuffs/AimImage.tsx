'use client';

import { useState } from 'react';
import styles from './fiche.module.css';

const ZOOMS = [1, 2, 4] as const;

/**
 * Image du point de visée avec un viseur superposé. Les captures csnades sont prises en jeu sans
 * interface : le viseur de CS2 étant toujours au centre exact de l'écran, le point à viser est le
 * centre de l'image. Viseur classique ou « plein écran » (lignes sur toute l'image) et zoom
 * centré (le point visé reste au milieu). Survoler le centre atténue le viseur.
 */
export function AimImage({ src, alt, compact = false }: { src: string; alt: string; compact?: boolean }) {
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  return (
    <div className={styles.aim}>
      <div className={styles.aimFrame}>
        {/* eslint-disable-next-line @next/next/no-img-element -- image de visée csnades (accord écrit) */}
        <img src={src} alt={alt} loading="lazy" style={{ transform: `scale(${zoom})` }} />
        <span className={styles.crossHover} aria-hidden="true" />
        <svg className={styles.cross} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {full ? (
            <>
              <line x1="0" y1="50" x2="100" y2="50" />
              <line x1="50" y1="0" x2="50" y2="100" />
            </>
          ) : null}
        </svg>
        {full ? null : (
          <span className={styles.crossSmall} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <b />
          </span>
        )}
      </div>
      {compact ? null : (
        <div className={styles.vidBar}>
          <div className={styles.vidQ} role="group" aria-label="Viseur">
            <button type="button" className={styles.vidBtn} aria-pressed={!full} onClick={() => setFull(false)}>
              Viseur
            </button>
            <button type="button" className={styles.vidBtn} aria-pressed={full} onClick={() => setFull(true)}>
              Plein écran
            </button>
          </div>
          <div className={styles.vidQ} role="group" aria-label="Zoom sur le point de visée">
            {ZOOMS.map((z) => (
              <button key={z} type="button" className={styles.vidBtn} aria-pressed={zoom === z} onClick={() => setZoom(z)}>
                ×{z}
              </button>
            ))}
          </div>
          <span className={styles.vidNote}>Vise exactement le centre du viseur</span>
        </div>
      )}
    </div>
  );
}
