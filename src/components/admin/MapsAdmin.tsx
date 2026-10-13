'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import { AlertDialog } from 'radix-ui';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import { useReturnFocus } from '@/components/ui/useReturnFocus';
import type { MapInfo } from '@/lib/domain/schemas';
import { slugify } from '@/lib/stuffs';
import {
  createMapAction,
  deleteMapAction,
  moveMapAction,
  removeMapImageAction,
  updateMapAction,
  uploadMapImageAction,
} from '@/app/admin/maps/actions';
import admin from './admin.module.css';
import styles from './MapsAdmin.module.css';

type RowProps = { map: MapInfo; coverUrl: string | null; aerialUrl: string | null; first: boolean; last: boolean };

/** Une map dans la liste d'administration : images, visibilité, ordre, positions, suppression. */
export function MapAdminRow({ map, coverUrl, aerialUrl, first, last }: RowProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [active, setActive] = useOptimistic(map.active);
  const focus = useReturnFocus();

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    start(async () => {
      const res = await action();
      toast(res.message, !res.ok);
      router.refresh();
    });
  }

  return (
    <li className={`${admin.panel} ${styles.row}`} data-hidden={map.active ? undefined : ''}>
      <div className={styles.head}>
        <div className={styles.order}>
          <button
            type="button"
            className={styles.ord}
            disabled={busy || first}
            aria-label={`Monter ${map.name}`}
            onClick={() => run(() => moveMapAction(map.slug, -1))}
          >
            <Icon name="chevron" style={{ rotate: '180deg' }} />
          </button>
          <button
            type="button"
            className={styles.ord}
            disabled={busy || last}
            aria-label={`Descendre ${map.name}`}
            onClick={() => run(() => moveMapAction(map.slug, 1))}
          >
            <Icon name="chevron" />
          </button>
        </div>
        <div className={styles.title}>
          <h2 id={`map-${map.slug}`}>{map.name}</h2>
          <span className="mono">/{map.slug}</span>
        </div>
        <div className={styles.facts}>
          <span className={`chip ${map.active ? 'ok' : 'unknown'}`}>{map.active ? 'Visible' : 'Masquée'}</span>
          <span>
            <b>{map.counts.total}</b> fiche{map.counts.total > 1 ? 's' : ''}
          </span>
          <span>
            <b>{map.positionCount}</b> position{map.positionCount > 1 ? 's' : ''}
          </span>
        </div>
        <div className={styles.actions}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={active}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.checked;
                start(async () => {
                  setActive(next);
                  const res = await updateMapAction({ slug: map.slug, active: next });
                  toast(res.message, !res.ok);
                  router.refresh();
                });
              }}
            />
            Visible sur le site
          </label>
          <Link className="btn btn-steel btn-sm" href={`/admin/maps/${map.slug}`}>
            <Icon name="pin" /> Carte tactique
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            aria-label={`Supprimer ${map.name}`}
            onClick={() => {
              focus.remember();
              setConfirm(true);
            }}
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>
      <div className={styles.images}>
        <MapImageSlot
          slug={map.slug}
          kind="cover"
          label="Capture de la map"
          hint="Vraie capture en jeu, format paysage (16:9 conseillé)."
          url={coverUrl}
          fallback={map.coverPath ? null : map.imagePath}
        />
        <MapImageSlot
          slug={map.slug}
          kind="aerial"
          label="Vue aérienne"
          hint="Image carrée vue du dessus : les positions sont placées en % de cette image."
          url={aerialUrl}
          fallback={null}
        />
      </div>

      <AlertDialog.Root open={confirm} onOpenChange={setConfirm}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay" />
          <AlertDialog.Content className="dialog" onCloseAutoFocus={focus.onCloseAutoFocus}>
            <AlertDialog.Title>Supprimer {map.name} ?</AlertDialog.Title>
            <AlertDialog.Description className="desc">
              {map.counts.total > 0
                ? 'Cette map a encore des fiches : la suppression sera refusée. Masque-la plutôt pour la retirer du site.'
                : 'La map, ses images et ses positions de lancer seront supprimées définitivement.'}
            </AlertDialog.Description>
            <div className="actions">
              <AlertDialog.Cancel asChild>
                <button type="button" className="btn btn-ghost btn-sm">
                  Annuler
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => run(() => deleteMapAction(map.slug))}>
                  Supprimer définitivement
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </li>
  );
}

function MapImageSlot({
  slug,
  kind,
  label,
  hint,
  url,
  fallback,
}: {
  slug: string;
  kind: 'cover' | 'aerial';
  label: string;
  hint: string;
  url: string | null;
  fallback: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const inputId = `img-${slug}-${kind}`;
  const shown = url ?? fallback;
  return (
    <div className={styles.slot} data-kind={kind}>
      <div className={styles.thumb}>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={`${label} : ${slug}`} loading="lazy" />
        ) : (
          <span>{kind === 'aerial' ? 'Pas de vue aérienne' : 'Pas de capture'}</span>
        )}
        {!url && fallback ? <span className={styles.fallback}>Illustration provisoire</span> : null}
      </div>
      <form
        className={styles.slotForm}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set('mapSlug', slug);
          fd.set('kind', kind);
          const form = e.currentTarget;
          start(async () => {
            const res = await uploadMapImageAction(fd);
            toast(res.message, !res.ok);
            if (res.ok) {
              form.reset();
              router.refresh();
            }
          });
        }}
      >
        <label htmlFor={inputId}>
          <b>{label}</b>
        </label>
        <span className={styles.hint}>{hint}</span>
        <input id={inputId} name="file" type="file" accept="image/png,image/jpeg,image/webp" required />
        <div className={styles.slotBtns}>
          <button type="submit" className="btn btn-steel btn-sm" disabled={pending}>
            <Icon name="upload" /> {pending ? 'Envoi…' : url ? 'Remplacer' : 'Téléverser'}
          </button>
          {url ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await removeMapImageAction(slug, kind);
                  toast(res.message, !res.ok);
                  router.refresh();
                })
              }
            >
              Retirer
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

/** Ajout d'une map : créée masquée, le temps de lui donner sa capture et sa vue aérienne. */
export function MapCreateForm() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const effectiveSlug = slug || slugify(name).slice(0, 30);
  return (
    <section className={admin.panel} aria-labelledby="new-map-h">
      <div className={admin.panelH}>
        <h2 id="new-map-h">Ajouter une map</h2>
      </div>
      <form
        className={`${admin.panelB} ${styles.create}`}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const res = await createMapAction({ slug: effectiveSlug, name });
            toast(res.message, !res.ok);
            if (res.ok) {
              setName('');
              setSlug('');
              router.refresh();
            } else setError(res.message);
          });
        }}
      >
        <div className={styles.field}>
          <label htmlFor="new-map-name">Nom</label>
          <input id="new-map-name" className="input" required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Vertigo" />
        </div>
        <div className={styles.field}>
          <label htmlFor="new-map-slug">Identifiant d’URL</label>
          <input id="new-map-slug" className="input" maxLength={30} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={effectiveSlug || 'ex. vertigo'} />
        </div>
        <button type="submit" className="btn btn-red" disabled={pending || name.trim().length < 2}>
          <Icon name="plus" /> Ajouter (masquée)
        </button>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}
