'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertDialog } from 'radix-ui';
import { deleteClipAction, saveClipAction } from '@/app/admin/clips/actions';
import type { Clip } from '@/lib/clips/schemas';
import { parseClipSource, PROVIDER_LABELS } from '@/lib/clips/providers';
import { useToast } from '@/components/ui/Toaster';
import { useReturnFocus } from '@/components/ui/useReturnFocus';
import styles from '@/components/clips/clips.module.css';

export function ClipEditor({
  clip,
  players,
  maps,
}: {
  clip: Clip | null;
  players: { id: string; nickname: string }[];
  maps: { slug: string; name: string }[];
}) {
  const router = useRouter(),
    toast = useToast(),
    focus = useReturnFocus();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState(clip?.sourceUrl ?? '');
  const [consent, setConsent] = useState(clip?.consentConfirmed ?? false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const source = parseClipSource(url);
  return (
    <div className={styles.editor}>
      <form
        className={styles.editor}
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          const data = new FormData(e.currentTarget);
          const str = (k: string) => String(data.get(k) ?? '');
          const published = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'published';
          start(async () => {
            const r = await saveClipAction({
              id: clip?.id ?? null,
              title: str('title'),
              sourceUrl: url,
              playerId: str('playerId') || null,
              mapSlug: str('mapSlug') || null,
              recordedOn: str('recordedOn'),
              description: str('description'),
              consentConfirmed: consent,
              embedAllowed: data.get('embedAllowed') === 'on',
              published,
            });
            toast(r.message, !r.ok);
            if (!r.ok) setError(r.message);
            else if (!clip && r.data) router.replace(`/admin/clips/${r.data.id}`);
            else router.refresh();
          });
        }}
      >
        <label className={styles.field}>
          Lien de la vidéo
          <input
            className="input"
            type="url"
            required
            maxLength={2048}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={!!url && !source}
            aria-describedby="clip-source-hint"
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </label>
        <div id="clip-source-hint" className={styles.preview} aria-live="polite">
          {source ? (
            <>
              <strong>
                {PROVIDER_LABELS[source.provider]} ·{' '}
                {source.provider === 'allstar' ? 'Lien externe' : 'Lecteur intégré possible'}
              </strong>
              <p>{source.sourceUrl}</p>
              <small>
                Format reconnu. Vérifie la vidéo sur sa plateforme : sa disponibilité et ses droits ne sont
                pas contrôlés automatiquement.
              </small>
            </>
          ) : (
            <span>
              {url ? 'Lien vidéo non reconnu. ' : ''}Formats : YouTube (watch, Shorts, youtu.be), Twitch (clip
              ou vidéo), Allstar (allstar.gg/clip/… ou /clip?clip=…). Les liens FACEIT ne sont pas encore pris en charge.
            </span>
          )}
        </div>
        <label className={styles.field}>
          Titre
          <input
            className="input"
            name="title"
            required
            minLength={2}
            maxLength={100}
            defaultValue={clip?.title ?? ''}
            placeholder="Le round qu’on n’oubliera pas"
          />
        </label>
        <div className={styles.columns}>
          <label className={styles.field}>
            Joueur
            <select className="select" name="playerId" defaultValue={clip?.player?.id ?? ''}>
              <option value="">Clip collectif / sans joueur</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Map
            <select className="select" name="mapSlug" defaultValue={clip?.map?.slug ?? ''}>
              <option value="">Non précisée</option>
              {maps.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={styles.field}>
          Date du clip
          <input
            className="input"
            name="recordedOn"
            type="date"
            required
            defaultValue={clip?.recordedOn ?? ''}
          />
        </label>
        <label className={styles.field}>
          Description (facultatif)
          <textarea
            className="textarea"
            name="description"
            maxLength={500}
            defaultValue={clip?.description ?? ''}
          />
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="embedAllowed" defaultChecked={clip?.embedAllowed ?? false} />
          J’ai vérifié que la vidéo autorise la lecture intégrée (YouTube / Twitch). Allstar reste pour l’instant un
          lien externe.
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          J’ai l’accord du joueur et le droit de partager ce clip.
        </label>
        {error ? (
          <p role="alert" className="neg">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button
            className="btn btn-red"
            type="submit"
            value="published"
            disabled={pending || !source || !consent}
          >
            {pending ? 'Enregistrement…' : 'Enregistrer et publier'}
          </button>
          <button className="btn btn-steel" type="submit" value="draft" disabled={pending || !source}>
            Enregistrer en brouillon
          </button>
        </div>
        <p className="mono">
          Le visuel de la map illustre le clip. Aucune miniature ni vidéo n’est récupérée ou réhébergée.
        </p>
      </form>
      {clip ? (
        <>
          <button
            className="btn btn-danger btn-sm"
            type="button"
            disabled={pending}
            onClick={() => {
              focus.remember();
              setConfirm(true);
            }}
          >
            Supprimer le clip
          </button>
          <AlertDialog.Root open={confirm} onOpenChange={setConfirm}>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="dialog-overlay" />
              <AlertDialog.Content className="dialog" onCloseAutoFocus={focus.onCloseAutoFocus}>
                <AlertDialog.Title>Supprimer « {clip.title} » ?</AlertDialog.Title>
                <AlertDialog.Description className="desc">
                  Le clip sera retiré de LaFineEquipe. La vidéo sur sa plateforme ne sera pas supprimée. Pour
                  le masquer, tu peux aussi le repasser en brouillon.
                </AlertDialog.Description>
                <div className="actions">
                  <AlertDialog.Cancel asChild>
                    <button className="btn btn-ghost">Annuler</button>
                  </AlertDialog.Cancel>
                  <button
                    className="btn btn-danger"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await deleteClipAction(clip.id);
                        toast(r.message, !r.ok);
                        if (r.ok) router.replace('/admin/clips');
                        else {
                          setConfirm(false);
                          setError(r.message);
                        }
                      })
                    }
                  >
                    Supprimer définitivement
                  </button>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </>
      ) : null}
    </div>
  );
}
