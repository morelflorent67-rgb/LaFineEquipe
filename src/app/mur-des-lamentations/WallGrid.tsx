'use client';

import Link from 'next/link';
import { useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { DemoTag, Level } from '@/components/ui/badges';
import { FaceitLink } from '@/components/ui/FaceitLink';
import { Icon } from '@/components/ui/Icon';
import { useFlip } from '@/components/ui/useFlip';
import type { AvoidEntry } from '@/lib/domain/schemas';
import { fmtDate, fmtInt } from '@/lib/format';
import styles from './wall.module.css';

type Sort = 'recent' | 'az' | 'level';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'recent', label: 'Plus récents' },
  { value: 'az', label: 'A → Z' },
  { value: 'level', label: 'Niveau' },
];
const NEW_FOR_MS = 3 * 24 * 3600_000;

/**
 * Banlist publique en affiches « WANTED » : recherche par pseudo, tri, réordonnancement animé.
 * Aucun motif n'est jamais transmis ici. `now` vient du serveur : le ruban « Nouveau » est
 * identique au rendu serveur et client.
 */
export function WallGrid({ entries, isAdmin, now }: { entries: AvoidEntry[]; isAdmin: boolean; now: string }) {
  const searchId = useId();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const listRef = useRef<HTMLUListElement>(null);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = entries.filter((e) => !needle || e.profile.nickname.toLowerCase().includes(needle));
    return [...list].sort((a, b) => {
      if (sort === 'az') return a.profile.nickname.localeCompare(b.profile.nickname, 'fr', { sensitivity: 'base' });
      if (sort === 'level') {
        return (b.profile.cs2Level ?? -1) - (a.profile.cs2Level ?? -1) || (b.profile.cs2Elo ?? -1) - (a.profile.cs2Elo ?? -1);
      }
      return Date.parse(b.addedAt) - Date.parse(a.addedAt);
    });
  }, [entries, q, sort]);
  useFlip(listRef, [visible.map((e) => e.id).join()]);
  const nowMs = Date.parse(now);

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.counter} aria-live="polite">
          <b>{entries.length}</b>
          <span>
            {entries.length > 1 ? 'joueurs recherchés' : 'joueur recherché'}
            {q.trim() ? ` · ${visible.length} trouvé${visible.length > 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <div className={`search ${styles.search}`}>
          <Icon name="search" />
          <label htmlFor={searchId} className="sr-only-focusable">
            Rechercher un pseudo sur le Mur
          </label>
          <input
            id={searchId}
            className="input"
            type="search"
            placeholder="Rechercher un pseudo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className={`seg ${styles.seg}`} role="group" aria-label="Ordre d’affichage">
          {SORTS.map((s) => (
            <button key={s.value} type="button" aria-pressed={sort === s.value} onClick={() => setSort(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        {isAdmin ? (
          <Link className={`btn btn-steel btn-sm ${styles.manageAll}`} href="/admin/mur">
            <Icon name="edit" /> Gérer la Banlist
          </Link>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <div className={styles.empty}>
          <strong>Personne n’est recherché.</strong>
          La Banlist est vide pour l’instant.{isAdmin ? ' Ajoute un profil depuis l’administration.' : ''}
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.empty} role="status">
          <strong>Personne à ce nom sur le Mur.</strong>
          Bonne nouvelle.
        </div>
      ) : (
        <ul ref={listRef} className={styles.posters} aria-label="Profils sur le Mur">
          {visible.map((e, i) => (
            <li key={e.id} data-key={e.id} className={styles.poster} style={{ '--i': Math.min(i, 12) } as CSSProperties}>
              {nowMs - Date.parse(e.addedAt) <= NEW_FOR_MS ? <span className={styles.tape}>Nouveau</span> : null}
              <p className={styles.wanted} aria-hidden="true">
                Wanted
              </p>
              <p className={styles.sought}>Recherché</p>
              <div className={styles.mugshot}>
                <Avatar src={e.profile.avatarUrl} size={96} shape="square" />
              </div>
              <b className={styles.nick}>{e.profile.nickname}</b>
              <span className={styles.meta}>
                {e.profile.cs2Level !== null ? <Level level={e.profile.cs2Level} /> : null}
                {e.profile.cs2Elo !== null ? <span className={styles.elo}>{fmtInt(e.profile.cs2Elo)} ELO</span> : <span>ELO non fourni</span>}
                {e.isDemo ? <DemoTag /> : null}
              </span>
              <span className={styles.date}>Ajouté le {fmtDate(e.addedAt)}</span>
              <span className={styles.links}>
                <FaceitLink nickname={e.profile.nickname} isDemo={e.profile.isDemo} className={styles.fl} />
                {isAdmin ? (
                  <Link className={styles.manage} href={`/admin/mur?entree=${e.id}#entree-${e.id}`} aria-label={`Gérer ${e.profile.nickname}`}>
                    Gérer
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
