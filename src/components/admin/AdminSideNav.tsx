'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './admin.module.css';

const ITEMS = [
  { href: '/admin', label: 'Vue d’ensemble' },
  { href: '/admin/players', label: 'Joueurs' },
  { href: '/admin/mur', label: 'Mur des lamentations' },
  { href: '/admin/maps', label: 'Maps' },
  { href: '/admin/stuffs', label: 'Stuffs' },
  { href: '/admin/crosshairs', label: 'Crosshairs' },
  { href: '/admin/sync', label: 'Synchronisation' },
  { href: '/admin/clips', label: 'Clips', soon: true },
];

export function AdminSideNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.side} aria-label="Administration">
      <h2>Administration</h2>
      <ul>
        {ITEMS.map((it) => {
          const current = it.href === '/admin' ? pathname === '/admin' : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={current ? 'page' : undefined}>
                {it.label}
                {it.soon ? <small>bientôt</small> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
