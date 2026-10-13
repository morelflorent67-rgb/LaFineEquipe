'use client';

import { useState, useTransition } from 'react';
import { AlertDialog } from 'radix-ui';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import { useReturnFocus } from '@/components/ui/useReturnFocus';
import { resetLocalDataAction, runSyncNowAction, setLiveDetectionAction } from './actions';

export function RunSyncButton({ disabledReason }: { disabledReason: string | null }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <button
        type="button"
        className="btn btn-red btn-sm"
        disabled={pending || Boolean(disabledReason)}
        onClick={() =>
          start(async () => {
            const res = await runSyncNowAction();
            toast(res.message, !res.ok);
          })
        }
      >
        <Icon name="refresh" /> {pending ? 'Synchronisation…' : 'Synchroniser maintenant'}
      </button>
      {disabledReason ? <span className="chip error">{disabledReason}</span> : null}
    </div>
  );
}

export function LiveDetectionForm({ current }: { current: 'none' | 'history_polling' | 'webhook' }) {
  const toast = useToast();
  const [source, setSource] = useState(current);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      style={{ display: 'grid', gap: 12, maxWidth: 560 }}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await setLiveDetectionAction({ source, note });
          toast(res.message, !res.ok);
        });
      }}
    >
      <div className="field">
        <label htmlFor="live-source">Source utilisée pour « match en cours »</label>
        <select id="live-source" className="select" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
          <option value="none">Aucune (affiche « Statut indisponible »)</option>
          <option value="history_polling">Historique FACEIT interrogé régulièrement</option>
          <option value="webhook">Webhooks FACEIT</option>
        </select>
      </div>
      {source !== 'none' ? (
        <div className="field">
          <label htmlFor="live-note">Test réel qui valide cette source</label>
          <textarea
            id="live-note"
            className="textarea"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ex. 12/10 : match lancé par X, statut ONGOING reçu 40 s après le début…"
          />
        </div>
      ) : null}
      <div>
        <button type="submit" className="btn btn-steel btn-sm" disabled={pending}>
          Enregistrer
        </button>
      </div>
    </form>
  );
}

export function LocalDataControls() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<null | 'demo' | 'empty'>(null);
  const focus = useReturnFocus();
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button type="button" className="btn btn-steel btn-sm" disabled={pending} onClick={() => {
            focus.remember();
            setConfirm('demo');
          }}>
          Charger le jeu de démonstration
        </button>
        <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => {
            focus.remember();
            setConfirm('empty');
          }}>
          <Icon name="trash" /> Vider la base locale
        </button>
      </div>
      <AlertDialog.Root open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay" />
          <AlertDialog.Content className="dialog" onCloseAutoFocus={focus.onCloseAutoFocus}>
            <AlertDialog.Title>
              {confirm === 'demo' ? 'Remplacer les données locales par la démonstration ?' : 'Vider la base locale ?'}
            </AlertDialog.Title>
            <AlertDialog.Description className="desc">
              Toutes les données de la base LOCALE (joueurs, Mur, runs, matchs, stuffs) seront effacées
              {confirm === 'demo' ? ' puis remplacées par des exemples fictifs' : ''}. Les comptes locaux sont conservés. Supabase
              n’est pas concerné.
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
                    const demo = confirm === 'demo';
                    start(async () => {
                      const res = await resetLocalDataAction(demo);
                      toast(res.message, !res.ok);
                    });
                  }}
                >
                  Confirmer
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
