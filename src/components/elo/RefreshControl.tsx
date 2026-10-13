'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import { publicRefreshAction } from '@/app/elo-run/actions';
import { fmtAgo, fmtTime } from '@/lib/format';
import styles from './elo.module.css';

/** Au-delà, la dernière synchro réussie est signalée comme ancienne (la synchro tourne toutes les 5 min). */
const STALE_MS = 20 * 60_000;
/** Relecture de la base (jamais de FACEIT) pour afficher le résultat des synchros planifiées. */
const RELOAD_MS = 60_000;

export function RefreshControl({
  lastOkAt,
  availableAt,
  running,
  serverNow,
}: {
  lastOkAt: string | null;
  availableAt: string | null;
  running: boolean;
  serverNow: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  // Rendu initial identique serveur / navigateur (même horloge), puis horloge locale.
  const [now, setNow] = useState(() => Date.parse(serverNow));
  const [retryAt, setRetryAt] = useState<number | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const reload = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, RELOAD_MS);
    return () => {
      clearInterval(tick);
      clearInterval(reload);
    };
  }, [router]);

  const available = Math.max(availableAt ? Date.parse(availableAt) : 0, retryAt ?? 0);
  const wait = Math.max(0, Math.ceil((available - now) / 1000));
  const stale = !lastOkAt || now - Date.parse(lastOkAt) > STALE_MS;
  const label = pending
    ? 'Actualisation…'
    : running
      ? 'Synchro en cours…'
      : wait > 0
        ? `Actualiser dans ${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}`
        : 'Actualiser';

  return (
    <div className={styles.sync} aria-live="polite">
      <p className={styles.syncRow}>
        <span className={`${styles.syncDot} ${stale ? styles.syncDotStale : ''}`} aria-hidden="true" />
        {lastOkAt ? (
          <span>
            Dernière synchro : <b>{fmtAgo(lastOkAt, new Date(now))}</b> <span className="muted">({fmtTime(lastOkAt)})</span>
          </span>
        ) : (
          <span>Aucune synchronisation réussie pour l’instant</span>
        )}
      </p>
      {stale && lastOkAt ? (
        <p className="chip stale">
          <Icon name="alert" /> Données anciennes : les dernières valeurs valides restent affichées
        </p>
      ) : null}
      <p className={`mono ${styles.syncNote}`}>Synchro automatique toutes les 5 min · source FACEIT Data API</p>
      <button
        type="button"
        className="btn btn-steel btn-sm"
        disabled={pending || running || wait > 0}
        onClick={() =>
          start(async () => {
            const res = await publicRefreshAction();
            if (!res.ok && res.code === 'too_soon' && typeof res.detail?.retryAt === 'string') setRetryAt(Date.parse(res.detail.retryAt));
            if (res.ok) setRetryAt(Date.now() + 120_000);
            toast(res.message, !res.ok);
            router.refresh();
          })
        }
      >
        <Icon name="refresh" /> {label}
      </button>
      <p className={styles.syncHint}>Actualisation manuelle limitée à une fois toutes les 2 minutes pour tout le site.</p>
    </div>
  );
}
