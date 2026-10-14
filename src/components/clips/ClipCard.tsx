'use client';

import { useState } from 'react';
import { Dialog } from 'radix-ui';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { DemoTag } from '@/components/ui/badges';
import { useReturnFocus } from '@/components/ui/useReturnFocus';
import { clipEmbedUrl, parseClipSource, PROVIDER_LABELS } from '@/lib/clips/providers';
import type { Clip } from '@/lib/clips/schemas';
import { fmtDate } from '@/lib/format';
import styles from './clips.module.css';

/** Aucun lecteur tiers avant une demande explicite. Le lien externe reste toujours accessible. */
export function ClipCard({
  clip,
  cover = null,
  headingLevel = 2,
}: {
  clip: Clip;
  cover?: string | null;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const [open, setOpen] = useState(false);
  const [embed, setEmbed] = useState<string | null>(null);
  const focus = useReturnFocus();
  const source = parseClipSource(clip.sourceUrl);
  const label = PROVIDER_LABELS[clip.provider];
  const canEmbed = clip.embedAllowed && !clip.isDemo;
  return (
    <article className={styles.card}>
      <div className={styles.visual}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" />
        ) : null}
        <span className={styles.stamp}>
          {label} · {clip.isDemo ? 'EXEMPLE FICTIF' : 'CLIP'}
        </span>
        <span className={styles.map}>{clip.map?.name ?? 'LaFineEquipe'}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          {clip.player ? (
            <>
              <Avatar src={clip.player.avatarUrl} size={28} />
              <Link href={`/players/${clip.player.id}`}>{clip.player.nickname}</Link>
            </>
          ) : (
            <span>La team</span>
          )}
          <time dateTime={clip.recordedOn}>{fmtDate(clip.recordedOn)}</time>
        </div>
        <Heading>{clip.title}</Heading>
        {clip.description ? <p className={styles.description}>{clip.description}</p> : null}
        {clip.isDemo ? <DemoTag /> : null}
        <div className={styles.actions}>
          {canEmbed && source ? (
            <button
              className="btn btn-red btn-sm"
              onClick={() => {
                focus.remember();
                // Twitch impose 400px de largeur et HTTPS : lien externe sur petit écran/en local HTTP.
                const fitsTwitch = window.innerWidth >= 480 && window.location.protocol === 'https:';
                setEmbed(
                  clip.provider === 'twitch' && !fitsTwitch
                    ? null
                    : clipEmbedUrl(source.sourceUrl, window.location.hostname),
                );
                setOpen(true);
              }}
            >
              Lire le clip
            </button>
          ) : null}
          {source && !clip.isDemo ? (
            <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
              Ouvrir sur {label} ↗
            </a>
          ) : null}
        </div>
      </div>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className={`dialog ${styles.playerDialog}`}
            onCloseAutoFocus={focus.onCloseAutoFocus}
          >
            <Dialog.Title>{clip.title}</Dialog.Title>
            <Dialog.Description className="desc">
              Lecture fournie par {label}. Si la vidéo est privée, supprimée ou non intégrable, utilise le
              lien vers la source.
            </Dialog.Description>
            {embed ? (
              <iframe
                title={`Vidéo : ${clip.title}`}
                src={embed}
                className={`${styles.video} ${clip.provider === 'twitch' ? styles.twitch : ''}`}
                allow="fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <p>
                Le lecteur Twitch nécessite HTTPS et au moins 400 px de largeur. Ouvre le clip directement sur
                Twitch.
              </p>
            )}
            <div className="actions">
              {source ? (
                <a
                  className="btn btn-steel btn-sm"
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ouvrir sur {label} ↗
                </a>
              ) : null}
              <Dialog.Close asChild>
                <button className="btn btn-ghost btn-sm">Fermer</button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </article>
  );
}
