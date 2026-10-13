'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { AlertDialog } from 'radix-ui';
import { deletePlayerAction, refreshProfileAction, updatePlayerAction } from '@/app/admin/faceit-actions';
import { Avatar } from '@/components/ui/Avatar';
import { DemoTag, Level, ProfileFreshness } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import { useReturnFocus } from '@/components/ui/useReturnFocus';
import type { Player } from '@/lib/domain/schemas';
import { faceitProfileUrl, shortFaceitId } from '@/lib/faceit/input';
import { fmtInt } from '@/lib/format';
import styles from './AvoidAdminList.module.css';

export function RosterAdminList({ players }: { players: Player[] }) {
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Player | null>(null);
  const [, startTransition] = useTransition();
  const focus = useReturnFocus();

  function run(id: string, fn: () => Promise<{ ok: boolean; message: string }>) {
    setPendingId(id);
    startTransition(async () => {
      const res = await fn();
      toast(res.message, !res.ok);
      setPendingId(null);
    });
  }

  if (players.length === 0) {
    return <p className={styles.empty}>Aucun joueur enregistré. Ajoute un premier profil FACEIT ci-dessus.</p>;
  }

  return (
    <>
      <ul className={styles.rows} aria-label="Joueurs du roster">
        <li className={`${styles.row} ${styles.head}`} aria-hidden="true">
          <span>Joueur</span>
          <span>Niveau · ELO</span>
          <span>Données</span>
          <span>Groupe · ordre</span>
          <span>Statut</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </li>
        {players.map((p) => {
          const busy = pendingId === p.id;
          const save = (patch: Partial<{ group: 'team' | 'guest'; active: boolean; displayOrder: number }>) =>
            run(p.id, () =>
              updatePlayerAction({
                playerId: p.id,
                group: patch.group ?? p.group,
                active: patch.active ?? p.active,
                displayOrder: patch.displayOrder ?? p.displayOrder,
              }),
            );
          return (
            <li key={p.id} className={styles.row}>
              <div className={styles.who}>
                <Avatar src={p.profile.avatarUrl} size={40} level={p.profile.cs2Level} />
                <div style={{ minWidth: 0 }}>
                  <b>
                    <Link href={`/players/${p.id}`}>{p.profile.nickname}</Link>
                  </b>
                  <code title={`Identifiant FACEIT complet : ${p.profile.faceitPlayerId}`}>
                    ID {shortFaceitId(p.profile.faceitPlayerId)}…
                  </code>
                  {p.isDemo ? <DemoTag /> : null}
                </div>
              </div>
              <div className={styles.lv}>
                <Level level={p.profile.cs2Level} />
                {p.profile.cs2Elo !== null ? fmtInt(p.profile.cs2Elo) : <span className={styles.none}>ELO —</span>}
              </div>
              <div className={styles.dt}>
                <ProfileFreshness
                  fetchedAt={p.profile.fetchedAt}
                  lastError={p.profile.lastError}
                  lastAttemptAt={p.profile.lastAttemptAt}
                  staleAfterHours={6}
                />
              </div>
              <div className={styles.lv}>
                <label className="sr-only-focusable" htmlFor={`grp-${p.id}`}>
                  Groupe de {p.profile.nickname}
                </label>
                <select
                  id={`grp-${p.id}`}
                  className="select"
                  style={{ minHeight: 40, padding: '6px 10px', width: 'auto' }}
                  value={p.group}
                  disabled={busy}
                  onChange={(e) => save({ group: e.target.value as 'team' | 'guest' })}
                >
                  <option value="team">Team</option>
                  <option value="guest">Guest</option>
                </select>
                <label className="sr-only-focusable" htmlFor={`ord-${p.id}`}>
                  Ordre d’affichage de {p.profile.nickname}
                </label>
                <input
                  id={`ord-${p.id}`}
                  className="input"
                  type="number"
                  min={0}
                  max={100000}
                  defaultValue={p.displayOrder}
                  disabled={busy}
                  style={{ minHeight: 40, width: 80, padding: '6px 8px' }}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isInteger(v) && v !== p.displayOrder) save({ displayOrder: v });
                  }}
                />
              </div>
              <span className={`chip ${p.active ? 'ok' : 'cancel'} ${styles.status}`}>{p.active ? 'Actif' : 'Inactif'}</span>
              <div className={styles.acts}>
                {p.profile.isDemo ? null : (
                  <a
                    className={styles.ib}
                    href={faceitProfileUrl(p.profile.nickname)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Profil FACEIT de ${p.profile.nickname} (nouvel onglet)`}
                    title="Profil FACEIT"
                  >
                    <Icon name="ext" />
                  </a>
                )}
                <button
                  type="button"
                  className={styles.ib}
                  disabled={busy || p.isDemo}
                  aria-label={`Rafraîchir le profil FACEIT de ${p.profile.nickname}`}
                  title={p.isDemo ? 'Profil fictif : pas de rafraîchissement' : 'Rafraîchir depuis FACEIT'}
                  onClick={() => run(p.id, () => refreshProfileAction(p.profile.faceitPlayerId, 'roster'))}
                >
                  <Icon name="refresh" />
                </button>
                <button
                  type="button"
                  className={styles.ib}
                  disabled={busy}
                  aria-label={p.active ? `Désactiver ${p.profile.nickname}` : `Réactiver ${p.profile.nickname}`}
                  title={p.active ? 'Désactiver (masqué du roster, historique conservé)' : 'Réactiver'}
                  onClick={() => save({ active: !p.active })}
                >
                  <Icon name={p.active ? 'archive' : 'restore'} />
                </button>
                <button
                  type="button"
                  className={`${styles.ib} ${styles.danger}`}
                  disabled={busy}
                  aria-label={`Supprimer ${p.profile.nickname} du roster`}
                  title="Supprimer"
                  onClick={() => {
                    focus.remember();
                    setDeleting(p);
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <AlertDialog.Root open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay" />
          <AlertDialog.Content className="dialog" onCloseAutoFocus={focus.onCloseAutoFocus}>
            <AlertDialog.Title>Supprimer {deleting?.profile.nickname} du roster ?</AlertDialog.Title>
            <AlertDialog.Description className="desc">
              Possible uniquement si le joueur n’a aucun historique (ELO Run, matchs). Sinon, désactive-le : il disparaît du
              roster mais son historique reste juste.
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
                    if (target) run(target.id, () => deletePlayerAction(target.id));
                  }}
                >
                  <Icon name="trash" /> Supprimer
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
