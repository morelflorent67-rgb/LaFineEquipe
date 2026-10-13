'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import { Icon } from '@/components/ui/Icon';
import { signOutAction } from '@/app/actions/auth';
import { NAV, isActive } from './nav-items';
import styles from './SiteNav.module.css';

export type NavViewer = { role: 'visitor' | 'member' | 'admin'; signedIn: boolean; label: string | null };
export type NavLive = { kind: 'unavailable' | 'uncertain' | 'none' | 'live' | 'error'; count: number };

function LivePill({ live }: { live: NavLive }) {
  // N'apparaît QUE si un match en cours est vérifié par une source validée.
  if (live.kind !== 'live' || live.count === 0) return null;
  return (
    <Link className="live" href="/matches#en-cours" title="Match en cours vérifié par FACEIT">
      <span className="dot" aria-hidden="true" />
      <span className={styles.liveLabel}>Live · {live.count}</span>
    </Link>
  );
}

function MoreMenu({ pathname, viewer }: { pathname: string; viewer: NavViewer }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Fermeture quand on change de page (ajustement pendant le rendu, sans effet).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  const items = NAV.filter((n) => n.prio === 2);
  return (
    <div
      className={styles.more}
      ref={wrapRef}
      onBlur={(e) => {
        if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className={styles.moreBtn}
        aria-expanded={open}
        aria-controls={popId}
        onClick={() => setOpen((o) => !o)}
      >
        Plus <Icon name="chevron" />
      </button>
      {open ? (
        <ul className={styles.morePop} id={popId}>
          {items.map((n) => (
            <li key={n.href}>
              <Link href={n.href} aria-current={isActive(pathname, n.href) ? 'page' : undefined}>
                {n.full ?? n.label}
                {n.restricted && viewer.role === 'visitor' ? (
                  <small>
                    <Icon name="lock" className={styles.lock} /> team
                  </small>
                ) : n.soon ? (
                  <small>bientôt</small>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SiteNav({ viewer, live }: { viewer: NavViewer; live: NavLive }) {
  const pathname = usePathname();
  return (
    <header className={styles.nav}>
      <Link className={styles.brand} href="/" aria-label="LaFineEquipe, accueil">
        {/* Logo rond provisoire (recadrage de l'emblème) en attendant le fichier original. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/lfe-round-temp.webp" alt="" width={42} height={42} />
        <span className={styles.brandWord}>
          La<b>Fine</b>Equipe
        </span>
      </Link>
      <nav aria-label="Menu principal" style={{ marginLeft: 'auto' }}>
        <ul className={styles.menu}>
          {NAV.map((n) => (
            <li key={n.href} data-prio={n.prio ?? 1}>
              <Link
                href={n.href}
                aria-current={isActive(pathname, n.href) ? 'page' : undefined}
                title={n.full}
              >
                {n.label}
                {n.restricted && viewer.role === 'visitor' ? (
                  <Icon name="lock" className={styles.lock} title="Réservé à la team" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <MoreMenu pathname={pathname} viewer={viewer} />
      <div className={styles.tools}>
        <LivePill live={live} />
        {viewer.role === 'admin' ? (
          <Link className={`${styles.adminBtn} ${styles.hideMobile}`} href="/admin">
            <Icon name="lock" />
            Admin
          </Link>
        ) : null}
        {viewer.signedIn ? (
          <form action={signOutAction} className={styles.hideMobile}>
            <button type="submit" className={styles.toolBtn} title={viewer.label ?? undefined}>
              <Icon name="logout" />
              Déconnexion
            </button>
          </form>
        ) : (
          <Link className={`${styles.toolBtn} ${styles.hideMobile}`} href={`/connexion?suite=${encodeURIComponent(pathname)}`}>
            <Icon name="lock" />
            Connexion team
          </Link>
        )}
      </div>
    </header>
  );
}

export function MobileTabBar({ viewer, live }: { viewer: NavViewer; live: NavLive }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }
  const tabs = NAV.filter((n) => n.tab);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <nav className={styles.tabbar} aria-label="Navigation rapide">
        {tabs.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(pathname, n.href) ? 'page' : undefined}>
            {n.icon ? <Icon name={n.icon} /> : null}
            {n.href === '/matches' && live.kind === 'live' ? <span className={styles.tdot} aria-hidden="true" /> : null}
            {n.label}
          </Link>
        ))}
        <Dialog.Trigger asChild>
          <button type="button">
            <Icon name="menu" />
            Menu
          </button>
        </Dialog.Trigger>
      </nav>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={styles.sheet} aria-describedby={undefined}>
          <Dialog.Title asChild>
            <h2>Toutes les pages</h2>
          </Dialog.Title>
          <Dialog.Close asChild>
            <button type="button" className={`btn btn-ghost btn-icon ${styles.sheetClose}`} aria-label="Fermer le menu">
              <Icon name="close" />
            </button>
          </Dialog.Close>
          <ul>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={isActive(pathname, n.href) ? 'page' : undefined}>
                  {n.full ?? n.label}
                  {n.restricted && viewer.role === 'visitor' ? (
                    <small>
                      <Icon name="lock" className={styles.lock} /> réservé à la team
                    </small>
                  ) : n.soon ? (
                    <small>bientôt disponible</small>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <hr />
          <ul>
            {viewer.role === 'admin' ? (
              <li>
                <Link href="/admin">
                  Espace admin <small>administrateurs</small>
                </Link>
              </li>
            ) : null}
            <li>
              {viewer.signedIn ? (
                <form action={signOutAction}>
                  <button type="submit" className={styles.sheetItem}>
                    Déconnexion <small>{viewer.label}</small>
                  </button>
                </form>
              ) : (
                <Link href={`/connexion?suite=${encodeURIComponent(pathname)}`}>
                  Connexion team <small>membres et admins</small>
                </Link>
              )}
            </li>
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
