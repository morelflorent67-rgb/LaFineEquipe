'use client';

import { useEffect, useId, useMemo, useState, useTransition } from 'react';
import { AlertDialog, Dialog } from 'radix-ui';
import {
  deleteAvoidEntryAction,
  refreshProfileAction,
  setAvoidStatusAction,
  updateAvoidEntryAction,
} from '@/app/admin/faceit-actions';
import { Avatar } from '@/components/ui/Avatar';
import { Level, ProfileFreshness } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import { useReturnFocus } from '@/components/ui/useReturnFocus';
import type { AdminAvoidEntry } from '@/lib/domain/schemas';
import { shortFaceitId, faceitProfileUrl } from '@/lib/faceit/input';
import { fmtDate, fmtInt } from '@/lib/format';
import styles from './AvoidAdminList.module.css';

type Filter = 'active' | 'archived' | 'all';

export function AvoidAdminList({ entries, highlightId }: { entries: AdminAvoidEntry[]; highlightId: string | null }) {
  const toast = useToast();
  const searchId = useId();
  const [filter, setFilter] = useState<Filter>(() => {
    const h = entries.find((e) => e.id === highlightId);
    return h?.status === 'archived' ? 'archived' : 'active';
  });
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<AdminAvoidEntry | null>(null);
  const [deleting, setDeleting] = useState<AdminAvoidEntry | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const focus = useReturnFocus();

  const counts = useMemo(
    () => ({
      active: entries.filter((e) => e.status === 'active').length,
      archived: entries.filter((e) => e.status === 'archived').length,
      all: entries.length,
    }),
    [entries],
  );
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter(
      (e) => (filter === 'all' || e.status === filter) && (!needle || e.profile.nickname.toLowerCase().includes(needle)),
    );
  }, [entries, filter, q]);

  useEffect(() => {
    if (highlightId) document.getElementById(`entree-${highlightId}`)?.scrollIntoView({ block: 'center' });
  }, [highlightId]);

  function run(id: string, fn: () => Promise<{ ok: boolean; message: string }>) {
    setPendingId(id);
    startTransition(async () => {
      const res = await fn();
      toast(res.message, !res.ok);
      setPendingId(null);
    });
  }

  return (
    <div>
      <div className={styles.tools} style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
        <div className={`search ${styles.search}`}>
          <Icon name="search" />
          <label htmlFor={searchId} className="sr-only-focusable">
            Rechercher un pseudo
          </label>
          <input
            id={searchId}
            className="input"
            type="search"
            placeholder="Rechercher un pseudo"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="seg" role="group" aria-label="Filtrer par statut">
          {(
            [
              ['active', 'Actifs'],
              ['archived', 'Archivés'],
              ['all', 'Tous'],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label} <span className="count">{counts[value]}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className={styles.rows} aria-label="Entrées du Mur">
        <li className={`${styles.row} ${styles.head}`} aria-hidden="true">
          <span>Joueur</span>
          <span>Niveau · ELO</span>
          <span>Ajouté</span>
          <span>Motif interne</span>
          <span>Statut</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </li>
        {visible.length === 0 ? (
          <li className={styles.empty}>
            {entries.length === 0
              ? 'Le Mur est vide. Utilise le formulaire ci-dessus pour ajouter un profil.'
              : q
                ? `Aucune entrée ne correspond à « ${q} ».`
                : filter === 'archived'
                  ? 'Aucune entrée archivée.'
                  : 'Aucune entrée active.'}
          </li>
        ) : null}
        {visible.map((e) => {
          const busy = pendingId === e.id;
          return (
            <li
              key={e.id}
              id={`entree-${e.id}`}
              className={`${styles.row} ${e.id === highlightId ? styles.highlight : ''}`}
            >
              <div className={styles.who}>
                <Avatar src={e.profile.avatarUrl} size={40} level={e.profile.cs2Level} />
                <div style={{ minWidth: 0 }}>
                  <b>{e.profile.nickname}</b>
                  <code title={`Identifiant FACEIT complet : ${e.profile.faceitPlayerId}`}>
                    ID {shortFaceitId(e.profile.faceitPlayerId)}…
                  </code>
                  {e.inRoster ? <span className="tag" style={{ marginLeft: 6 }}>Roster</span> : null}
                </div>
              </div>
              <div className={styles.lv}>
                <Level level={e.profile.cs2Level} />
                {e.profile.cs2Elo !== null ? fmtInt(e.profile.cs2Elo) : <span className={styles.none}>ELO —</span>}
              </div>
              <div className={styles.dt}>
                <span className={styles.lbl}>Ajouté le </span>
                {fmtDate(e.addedAt)}
                <small>par {e.addedBy ?? 'compte supprimé'}</small>
                <ProfileFreshness
                  fetchedAt={e.profile.fetchedAt}
                  lastError={e.profile.lastError}
                  lastAttemptAt={e.profile.lastAttemptAt}
                  staleAfterHours={72}
                />
              </div>
              <div className={`${styles.reason} ${e.reason ? '' : styles.none}`}>
                <Icon name="lock" />
                <span>{e.reason ?? 'Aucun motif'}</span>
              </div>
              <span className={`chip ${e.status === 'active' ? 'ok' : 'cancel'} ${styles.status}`}>
                {e.status === 'active' ? 'Actif' : 'Archivé'}
              </span>
              <div className={styles.acts}>
                {e.profile.isDemo ? null : (
                  <a
                    className={styles.ib}
                    href={faceitProfileUrl(e.profile.nickname)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Profil FACEIT de ${e.profile.nickname} (nouvel onglet)`}
                    title="Profil FACEIT"
                  >
                    <Icon name="ext" />
                  </a>
                )}
                <button
                  type="button"
                  className={styles.ib}
                  disabled={busy}
                  aria-label={`Rafraîchir le profil FACEIT de ${e.profile.nickname}`}
                  title="Rafraîchir depuis FACEIT"
                  onClick={() => run(e.id, () => refreshProfileAction(e.profile.faceitPlayerId, 'avoid'))}
                >
                  <Icon name="refresh" />
                </button>
                <button
                  type="button"
                  className={styles.ib}
                  disabled={busy}
                  aria-label={`Modifier l’entrée de ${e.profile.nickname}`}
                  title="Modifier"
                  onClick={() => {
                    focus.remember();
                    setEditing(e);
                  }}
                >
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className={styles.ib}
                  disabled={busy}
                  aria-label={e.status === 'active' ? `Archiver ${e.profile.nickname}` : `Réactiver ${e.profile.nickname}`}
                  title={e.status === 'active' ? 'Archiver' : 'Réactiver'}
                  onClick={() =>
                    run(e.id, () => setAvoidStatusAction(e.id, e.status === 'active' ? 'archived' : 'active', e.reason))
                  }
                >
                  <Icon name={e.status === 'active' ? 'archive' : 'restore'} />
                </button>
                <button
                  type="button"
                  className={`${styles.ib} ${styles.danger}`}
                  disabled={busy}
                  aria-label={`Retirer ${e.profile.nickname} du Mur`}
                  title="Retirer définitivement"
                  onClick={() => {
                    focus.remember();
                    setDeleting(e);
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <EditDialog
        onCloseAutoFocus={focus.onCloseAutoFocus}
        entry={editing}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          toast(message);
          setEditing(null);
        }}
      />

      <AlertDialog.Root open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay" />
          <AlertDialog.Content className="dialog" onCloseAutoFocus={focus.onCloseAutoFocus}>
            <AlertDialog.Title>Retirer {deleting?.profile.nickname} du Mur ?</AlertDialog.Title>
            <AlertDialog.Description className="desc">
              L’entrée, son motif interne et la copie du profil FACEIT (s’il n’est pas dans le roster) seront effacés
              définitivement. Pour simplement le masquer, archive-le plutôt.
            </AlertDialog.Description>
            <div className="actions">
              <AlertDialog.Cancel asChild>
                <button type="button" className="btn btn-ghost btn-sm">
                  Annuler
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    const target = deleting;
                    if (target) run(target.id, () => deleteAvoidEntryAction(target.id));
                  }}
                >
                  <Icon name="trash" /> Retirer définitivement
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

function EditDialog({
  entry,
  onClose,
  onSaved,
  onCloseAutoFocus,
}: {
  onCloseAutoFocus: (event: Event) => void;
  entry: AdminAvoidEntry | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // Réinitialise le formulaire à chaque ouverture sur une nouvelle entrée.
  if (entry && entry.id !== openedFor) {
    setOpenedFor(entry.id);
    setReason(entry.reason ?? '');
    setStatus(entry.status);
    setError(null);
  }

  return (
    <Dialog.Root
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) {
          setOpenedFor(null);
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog" onCloseAutoFocus={onCloseAutoFocus}>
          <Dialog.Title>Modifier {entry?.profile.nickname}</Dialog.Title>
          <Dialog.Description className="desc">Le motif reste visible uniquement par les administrateurs.</Dialog.Description>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!entry) return;
              startSave(async () => {
                const res = await updateAvoidEntryAction({ entryId: entry.id, reason, status });
                if (res.ok) {
                  setOpenedFor(null);
                  onSaved(res.message);
                } else setError(res.message);
              });
            }}
          >
            <div className="field">
              <label htmlFor={reasonId}>Motif interne</label>
              <textarea
                id={reasonId}
                className="textarea"
                maxLength={280}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <span className="mono" style={{ justifySelf: 'end' }}>
                {reason.length}/280
              </span>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: '14px 0 0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <legend className="mono" style={{ marginBottom: 8 }}>
                Statut
              </legend>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
                <input type="radio" name="edit-status" checked={status === 'active'} onChange={() => setStatus('active')} />
                Actif (visible sur le Mur)
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44 }}>
                <input type="radio" name="edit-status" checked={status === 'archived'} onChange={() => setStatus('archived')} />
                Archivé (masqué)
              </label>
            </fieldset>
            {error ? (
              <p role="alert" style={{ color: '#ff9b93', margin: '12px 0 0' }}>
                {error}
              </p>
            ) : null}
            <div className="actions">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost btn-sm">
                  Annuler
                </button>
              </Dialog.Close>
              <button type="submit" className="btn btn-red btn-sm" disabled={saving}>
                <Icon name="check" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
