import Link from 'next/link';
import type { MapInfo } from '@/lib/domain/schemas';
import styles from './stuffs.module.css';

/** Accès direct aux autres maps : chaque carte ouvre SON catalogue. */
export function MapStrip({ maps, current }: { maps: (MapInfo & { coverUrl: string | null })[]; current: string | null }) {
  return (
    <nav aria-label="Changer de map">
      <ul className={styles.mapstrip}>
        {maps.map((m) => (
          <li key={m.slug}>
            <Link
              className={styles.mcard}
              href={`/stuffs/${m.slug}`}
              aria-current={m.slug === current ? 'page' : undefined}
              style={m.coverUrl ? { backgroundImage: `url(${m.coverUrl})` } : undefined}
            >
              <b>{m.name}</b>
              <span>
                {m.counts.total} fiche{m.counts.total > 1 ? 's' : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
