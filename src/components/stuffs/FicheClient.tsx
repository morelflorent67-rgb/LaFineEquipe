'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition } from 'react';
import { Dialog } from 'radix-ui';
import { reportUtilityAction } from '@/app/stuffs/actions';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import styles from './fiche.module.css';

/** Vidéo chargée seulement au clic (youtube-nocookie) : aucun traceur tant qu'on ne lance pas la lecture. */
export function VideoEmbed({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className={styles.video}>
      {on ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`}
          title={`Vidéo : ${title}`}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <div className={styles.ph}>
          <button type="button" className={styles.play} onClick={() => setOn(true)} aria-label={`Lire la vidéo : ${title}`}>
            <Icon name="play" />
          </button>
          <span>Lecture via YouTube (mode confidentialité renforcée), chargée seulement si tu cliques.</span>
        </div>
      )}
    </div>
  );
}

/** Copie le lien canonique de LA fiche (sans les filtres du catalogue). */
export function ShareButton({ path }: { path: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn btn-steel btn-sm"
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        try {
          await navigator.clipboard.writeText(url);
          toast('Lien de la fiche copié.');
        } catch {
          window.prompt('Copie ce lien :', url);
        }
      }}
    >
      <Icon name="link" /> Copier le lien
    </button>
  );
}

export function ReportButton({ utilityId, path, already }: { utilityId: string; path: string; already: boolean }) {
  const toast = useToast();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [done, setDone] = useState(already);

  if (done) {
    return (
      <span className="chip stale">
        <Icon name="flag" /> Signalée par toi
      </span>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-ghost btn-sm">
          <Icon name="flag" /> Signaler « à revérifier »
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog">
          <Dialog.Title>Signaler cette fiche</Dialog.Title>
          <Dialog.Description className="desc">
            Le lineup ne marche plus (mise à jour CS2, erreur) ? Les administrateurs verront ton signalement.
          </Dialog.Description>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await reportUtilityAction({ utilityId, note, path });
                if (res.ok) {
                  toast(res.message);
                  setDone(true);
                  setOpen(false);
                } else setError(res.message);
              });
            }}
          >
            <div className="field">
              <label htmlFor={noteId}>Précision (facultatif)</label>
              <textarea id={noteId} className="textarea" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error ? (
              <p role="alert" style={{ color: '#ff9b93', margin: '10px 0 0' }}>
                {error}
              </p>
            ) : null}
            <div className="actions">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost btn-sm">
                  Annuler
                </button>
              </Dialog.Close>
              <button type="submit" className="btn btn-red btn-sm" disabled={pending}>
                {pending ? 'Envoi…' : 'Signaler'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type TrainingSlide = {
  title: string;
  mapName: string;
  badges: string;
  technique: string;
  originName: string;
  targetName: string;
  placement: string | null;
  aim: string | null;
  /** Vidéo csnades du lineup : remplace la capture du placement quand elle existe. */
  video: { mp4: string; webm: string; poster: string } | null;
  steps: string[];
  position: string;
  prevHref: string | null;
  nextHref: string | null;
};

/**
 * Mode entraînement : plein écran, les deux captures en grand, ← → pour passer au lineup voisin
 * (la page suivante s'ouvre directement dans ce mode), Échap pour quitter.
 */
export function TrainingMode({ slide, initialOpen }: { slide: TrainingSlide; initialOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);

  function go(href: string | null) {
    if (href) router.push(href, { scroll: false });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && new URLSearchParams(window.location.search).has('entrainement')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('entrainement');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }

  // Plein écran du navigateur quand c'est possible (sinon la fenêtre couvre déjà toute la page).
  useEffect(() => {
    if (!open) return;
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button type="button" className="btn btn-red btn-sm">
          <Icon name="target" /> Mode entraînement
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          className={styles.train}
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') go(slide.nextHref);
            else if (e.key === 'ArrowLeft') go(slide.prevHref);
          }}
        >
          <div className={styles.trH}>
            <div>
              <span className={styles.trKicker}>
                {slide.mapName} · {slide.position}
              </span>
              <Dialog.Title className={styles.trTitle}>{slide.title}</Dialog.Title>
            </div>
            <div className={styles.trMeta}>
              <span className="mono">{slide.badges}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const el = document.querySelector(`.${styles.train}`);
                  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
                  else void el?.requestFullscreen?.().catch(() => {});
                }}
              >
                Plein écran
              </button>
              <Dialog.Close asChild>
                <button type="button" className={styles.trClose} aria-label="Quitter le mode entraînement">
                  <Icon name="close" />
                </button>
              </Dialog.Close>
            </div>
          </div>
          <div className={styles.trB} key={slide.title}>
            <figure>
              {slide.video ? (
                <video poster={slide.video.poster} muted loop playsInline autoPlay controls aria-label={`Vidéo : ${slide.title}`}>
                  <source src={slide.video.webm} type="video/webm" />
                  <source src={slide.video.mp4} type="video/mp4" />
                </video>
              ) : slide.placement ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slide.placement} alt={`Placement : ${slide.originName}`} />
              ) : (
                <div className={styles.ph}>
                  <Icon name="target" />
                  <b>Capture du placement à fournir</b>
                </div>
              )}
              <figcaption>
                1 · {slide.originName}
                <span>{slide.video ? 'Regarde le placement et le lancer' : 'Reproduis le placement'}</span>
              </figcaption>
            </figure>
            <figure>
              {slide.aim ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slide.aim} alt={`Point de visée vers ${slide.targetName}`} />
              ) : (
                <div className={styles.ph}>
                  <Icon name="target" />
                  <b>Capture du point de visée à fournir</b>
                </div>
              )}
              <figcaption>
                2 · Point de visée
                <span>Arrivée : {slide.targetName}</span>
              </figcaption>
            </figure>
          </div>
          <div className={styles.trF}>
            <div>
              <span className={styles.trTech}>{slide.technique}</span>
              {slide.steps.length > 0 ? (
                <ol className={styles.trSteps}>
                  {slide.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              ) : null}
            </div>
            <div className={styles.trNav}>
              <button type="button" className="btn btn-steel btn-sm" disabled={!slide.prevHref} onClick={() => go(slide.prevHref)}>
                ← Précédent
              </button>
              <button type="button" className="btn btn-red btn-sm" disabled={!slide.nextHref} onClick={() => go(slide.nextHref)}>
                Suivant →
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
