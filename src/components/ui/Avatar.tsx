'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './Avatar.module.css';

/**
 * SEUL composant d'affichage d'avatar du site (roster, podium, classement, matchs, Mur,
 * administration, aperçu d'import). L'image vient du profil FACEIT enregistré en base ;
 * si elle manque ou ne se charge pas, une silhouette neutre la remplace.
 * Les couleurs d'origine sont conservées (aucun filtre).
 */
export type AvatarProps = {
  src: string | null | undefined;
  size: number;
  /** Texte alternatif. Vide (décoratif) quand le pseudo est affiché à côté. */
  alt?: string;
  shape?: 'circle' | 'square';
  /** Anneau de niveau FACEIT (1–10). `null` = anneau neutre ; `undefined` = pas d'anneau. */
  level?: number | null;
  className?: string;
};

export function Avatar({ src, size, alt = '', shape = 'circle', level, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const showImage = Boolean(src) && failedSrc !== src;

  // Une image en erreur AVANT l'hydratation ne déclenche pas onError : on vérifie au montage.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0 && src) setFailedSrc(src);
  }, [src]);

  const ringClass =
    level === undefined ? '' : typeof level === 'number' && level >= 1 ? styles.ring : styles.ringPlain;
  const style = { '--s': `${size}px`, '--lvl': level ?? 0 } as CSSProperties;

  return (
    <span
      className={[styles.wrap, shape === 'circle' ? styles.circle : styles.square, ringClass, className]
        .filter(Boolean)
        .join(' ')}
      style={style}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <span className={styles.inner}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar FACEIT déjà petit, servi par le CDN FACEIT
          <img
            ref={imgRef}
            className={styles.img}
            src={src!}
            alt=""
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailedSrc(src ?? null)}
          />
        ) : (
          <svg className={styles.silhouette} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
            <circle cx="32" cy="25" r="11" fill="currentColor" />
            <path d="M12 60c0-11 9-19 20-19s20 8 20 19z" fill="currentColor" />
          </svg>
        )}
      </span>
    </span>
  );
}
