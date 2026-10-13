'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { AlertDialog } from 'radix-ui';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import { useReturnFocus } from '@/components/ui/useReturnFocus';
import type { MapInfo, Utility } from '@/lib/domain/schemas';
import { DIFFICULTY_LABEL, GRENADE_LABEL, SIDE_LABEL, slugify, TECHNIQUE_LABEL } from '@/lib/stuffs';
import {
  deleteUtilityAction,
  markUtilityVerifiedAction,
  removeUtilityImageAction,
  saveUtilityAction,
  uploadUtilityImageAction,
} from './actions';

type Props = {
  maps: Pick<MapInfo, 'slug' | 'name'>[];
  utility: Utility | null;
  defaultMap: string;
  images: { placement: string | null; aim: string | null };
};

const field = { display: 'grid', gap: 7 } as const;

export function UtilityEditor({ maps, utility, defaultMap, images }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [title, setTitle] = useState(utility?.title ?? '');
  const [slug, setSlug] = useState(utility?.slug ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, startBusy] = useTransition();
  const focus = useReturnFocus();

  function onSubmit(form: FormData, status: 'draft' | 'published') {
    setError(null);
    const get = (k: string) => String(form.get(k) ?? '');
    startSave(async () => {
      const res = await saveUtilityAction({
        id: utility?.id ?? null,
        mapSlug: get('mapSlug'),
        title,
        slug: slug || slugify(title),
        side: get('side') as 'T',
        grenade: get('grenade') as 'smoke',
        zone: get('zone'),
        originName: get('originName'),
        targetName: get('targetName'),
        purpose: get('purpose'),
        description: get('description'),
        steps: get('steps')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        technique: get('technique') as 'static',
        difficulty: get('difficulty') as 'easy',
        tags: get('tags')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        videoUrl: get('videoUrl'),
        status,
      });
      if (res.ok) {
        toast(res.message);
        if (!utility && res.data) router.replace(`/admin/stuffs/${res.data.id}`);
        else router.refresh();
      } else {
        setError(res.message);
        toast(res.message, true);
      }
    });
  }

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <form
        ref={formRef}
        style={{ display: 'grid', gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          onSubmit(new FormData(e.currentTarget), submitter?.value === 'published' ? 'published' : 'draft');
        }}
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
          <div style={field}>
            <label htmlFor="title">Titre</label>
            <input id="title" className="input" required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div style={field}>
            <label htmlFor="slug">Identifiant d’URL</label>
            <input
              id="slug"
              className="input"
              maxLength={80}
              value={slug}
              placeholder={slugify(title) || 'ex. smoke-fenetre'}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div style={field}>
            <label htmlFor="mapSlug">Map</label>
            <select id="mapSlug" name="mapSlug" className="select" defaultValue={utility?.mapSlug ?? defaultMap}>
              {maps.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div style={field}>
            <label htmlFor="zone">Zone</label>
            <input id="zone" name="zone" className="input" maxLength={40} defaultValue={utility?.zone ?? ''} placeholder="ex. Mid, Site A" />
          </div>
          <div style={field}>
            <label htmlFor="side">Camp</label>
            <select id="side" name="side" className="select" defaultValue={utility?.side ?? 'T'}>
              {(['T', 'CT', 'BOTH'] as const).map((s) => (
                <option key={s} value={s}>
                  {SIDE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div style={field}>
            <label htmlFor="grenade">Grenade</label>
            <select id="grenade" name="grenade" className="select" defaultValue={utility?.grenade ?? 'smoke'}>
              {(['smoke', 'flash', 'molotov', 'he'] as const).map((g) => (
                <option key={g} value={g}>
                  {GRENADE_LABEL[g]}
                </option>
              ))}
            </select>
          </div>
          <div style={field}>
            <label htmlFor="originName">Départ</label>
            <input id="originName" name="originName" className="input" required maxLength={80} defaultValue={utility?.originName ?? ''} />
          </div>
          <div style={field}>
            <label htmlFor="targetName">Arrivée</label>
            <input id="targetName" name="targetName" className="input" required maxLength={80} defaultValue={utility?.targetName ?? ''} />
          </div>
          <div style={field}>
            <label htmlFor="technique">Lancer</label>
            <select id="technique" name="technique" className="select" defaultValue={utility?.technique ?? 'static'}>
              {Object.entries(TECHNIQUE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div style={field}>
            <label htmlFor="difficulty">Difficulté</label>
            <select id="difficulty" name="difficulty" className="select" defaultValue={utility?.difficulty ?? 'medium'}>
              {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={field}>
          <label htmlFor="purpose">À quoi sert ce stuff ?</label>
          <input id="purpose" name="purpose" className="input" maxLength={160} defaultValue={utility?.purpose ?? ''} />
        </div>
        <div style={field}>
          <label htmlFor="steps">Étapes (une par ligne, 12 maximum)</label>
          <textarea id="steps" name="steps" className="textarea" rows={5} defaultValue={utility?.steps.join('\n') ?? ''} />
        </div>
        <div style={field}>
          <label htmlFor="description">Remarques</label>
          <textarea id="description" name="description" className="textarea" maxLength={600} defaultValue={utility?.description ?? ''} />
        </div>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>
          <div style={field}>
            <label htmlFor="videoUrl">Vidéo YouTube (facultatif)</label>
            <input id="videoUrl" name="videoUrl" className="input" type="url" maxLength={200} defaultValue={utility?.videoUrl ?? ''} placeholder="https://youtu.be/…" />
          </div>
          <div style={field}>
            <label htmlFor="tags">Mots-clés (séparés par des virgules)</label>
            <input id="tags" name="tags" className="input" maxLength={200} defaultValue={utility?.tags.join(', ') ?? ''} />
          </div>
        </div>
        {error ? (
          <p role="alert" style={{ margin: 0, color: '#ff9b93' }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button type="submit" value="published" className="btn btn-red" disabled={saving}>
            <Icon name="check" /> {utility?.status === 'published' ? 'Enregistrer (publiée)' : 'Enregistrer et publier'}
          </button>
          <button type="submit" value="draft" className="btn btn-steel" disabled={saving}>
            {utility?.status === 'published' ? 'Dépublier (brouillon)' : 'Enregistrer en brouillon'}
          </button>
        </div>
      </form>

      {utility ? (
        <>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
            <ImageSlot utilityId={utility.id} kind="placement" label="Capture du placement" url={images.placement} />
            <ImageSlot utilityId={utility.id} kind="aim" label="Capture du point de visée" url={images.aim} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              type="button"
              className="btn btn-steel btn-sm"
              disabled={busy}
              onClick={() =>
                startBusy(async () => {
                  const res = await markUtilityVerifiedAction(utility.id);
                  toast(res.message, !res.ok);
                  router.refresh();
                })
              }
            >
              <Icon name="check" /> Vérifiée en jeu aujourd’hui
            </button>
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => {
                focus.remember();
                setConfirmDelete(true);
              }}>
              <Icon name="trash" /> Supprimer la fiche
            </button>
          </div>
          <AlertDialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="dialog-overlay" />
              <AlertDialog.Content className="dialog" onCloseAutoFocus={focus.onCloseAutoFocus}>
                <AlertDialog.Title>Supprimer « {utility.title} » ?</AlertDialog.Title>
                <AlertDialog.Description className="desc">
                  La fiche, ses captures et ses signalements seront supprimés définitivement. Pour la masquer, repasse-la en
                  brouillon.
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
                      onClick={() =>
                        startBusy(async () => {
                          const res = await deleteUtilityAction(utility.id);
                          toast(res.message, !res.ok);
                          if (res.ok) router.replace('/admin/stuffs');
                        })
                      }
                    >
                      Supprimer définitivement
                    </button>
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Les captures pourront être ajoutées après le premier enregistrement.
        </p>
      )}
    </div>
  );
}

function ImageSlot({ utilityId, kind, label, url }: { utilityId: string; kind: 'placement' | 'aim'; label: string; url: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const inputId = `img-${kind}`;
  return (
    <div style={{ display: 'grid', gap: 10, padding: 14, border: '1px solid var(--line-2)', background: 'var(--ink-2)' }}>
      <b>{label}</b>
      <div style={{ aspectRatio: '16 / 9', display: 'grid', placeItems: 'center', background: '#0d0b0c', border: '1px solid var(--line)' }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <span className="muted" style={{ fontSize: 13 }}>
            Aucune capture
          </span>
        )}
      </div>
      <form
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set('utilityId', utilityId);
          fd.set('kind', kind);
          const form = e.currentTarget;
          start(async () => {
            const res = await uploadUtilityImageAction(fd);
            toast(res.message, !res.ok);
            if (res.ok) {
              form.reset();
              router.refresh();
            }
          });
        }}
      >
        <label htmlFor={inputId} className="sr-only-focusable">
          Fichier pour {label}
        </label>
        <input id={inputId} name="file" type="file" accept="image/png,image/jpeg,image/webp" required style={{ maxWidth: '100%' }} />
        <button type="submit" className="btn btn-steel btn-sm" disabled={pending}>
          {pending ? 'Envoi…' : url ? 'Remplacer' : 'Téléverser'}
        </button>
        {url ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await removeUtilityImageAction(utilityId, kind);
                toast(res.message, !res.ok);
                router.refresh();
              })
            }
          >
            Retirer
          </button>
        ) : null}
      </form>
      <span className="mono">PNG, JPEG ou WebP · 5 Mo maximum · captures prises en jeu par la team.</span>
    </div>
  );
}
