'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import type { ExternalMedia } from '@/lib/domain/schemas';
import styles from './fiche.module.css';

/** Temps WebVTT (hh:mm:ss.mmm). */
function vttTime(s: number): string {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}.${pad(ms % 1000, 3)}`;
}

/** Sous-titres français fabriqués à partir des étapes traduites et de leur moment dans la vidéo. */
export function stepsToVtt(steps: string[], times: number[]): string | null {
  if (steps.length === 0 || times.length !== steps.length) return null;
  const cues = steps.map((text, i) => {
    const start = times[i]!;
    const end = i + 1 < times.length ? Math.max(start + 0.5, times[i + 1]!) : start + 4;
    return `${i + 1}\n${vttTime(start)} --> ${vttTime(end)}\n${text.replace(/-->/g, '→')}`;
  });
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

/** Index de l'étape en cours à l'instant t (la dernière commencée). */
export function stepAt(times: number[], t: number): number {
  let idx = -1;
  times.forEach((start, i) => {
    if (t + 0.05 >= start) idx = i;
  });
  return idx;
}

/**
 * Vidéo du lineup (hébergée par csnades, accord écrit) : lecture en boucle sans son, sous-titres
 * français, étapes cliquables qui s'allument au bon moment, ralenti et qualité HD/SD.
 * Avec « réduire les animations », la vidéo ne démarre pas toute seule.
 */
export function LineupVideo({ media, steps, stepTimes, title }: { media: ExternalMedia; steps: string[]; stepTimes: number[]; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hq, setHq] = useState(true);
  const [slow, setSlow] = useState(false);
  const [active, setActive] = useState(-1);
  const [autoplay, setAutoplay] = useState(false);
  const synced = stepTimes.length === steps.length && steps.length > 0;
  const vtt = useMemo(() => stepsToVtt(steps, stepTimes), [steps, stepTimes]);
  const track = vtt ? `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}` : null;
  const src = hq ? media.video : media.videoLq;

  // Choix faits côté navigateur : SD sur petit écran, pas de lecture automatique si l'utilisateur limite les animations.
  useEffect(() => {
    const small = window.matchMedia('(max-width: 700px)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- préférences connues seulement dans le navigateur
    if (small) setHq(false);
    setAutoplay(!reduce);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = slow ? 0.5 : 1;
  }, [slow, src]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !autoplay) return;
    void v.play().catch(() => {});
  }, [autoplay, src]);

  function seek(i: number) {
    const v = ref.current;
    if (!v || !synced) return;
    v.currentTime = stepTimes[i]!;
    setActive(i);
    void v.play().catch(() => {});
  }

  return (
    <div className={styles.lineup}>
      <div className={styles.videoBox}>
        <video
          key={src.mp4}
          ref={ref}
          className={styles.vid}
          poster={media.poster}
          muted
          loop
          playsInline
          controls
          preload="metadata"
          aria-label={`Vidéo du lineup : ${title}`}
          onTimeUpdate={(e) => synced && setActive(stepAt(stepTimes, e.currentTarget.currentTime))}
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = slow ? 0.5 : 1;
          }}
        >
          <source src={src.webm} type="video/webm" />
          <source src={src.mp4} type="video/mp4" />
          {track ? <track kind="subtitles" srcLang="fr" label="Français" src={track} default /> : null}
        </video>
      </div>
      <div className={styles.vidBar}>
        <button type="button" className={styles.vidBtn} aria-pressed={slow} onClick={() => setSlow((s) => !s)}>
          Ralenti ×0,5
        </button>
        <div className={styles.vidQ} role="group" aria-label="Qualité de la vidéo">
          <button type="button" className={styles.vidBtn} aria-pressed={hq} onClick={() => setHq(true)}>
            HD
          </button>
          <button type="button" className={styles.vidBtn} aria-pressed={!hq} onClick={() => setHq(false)}>
            SD
          </button>
        </div>
        <span className={styles.vidNote}>Vidéo csnades.gg · sans son</span>
      </div>
      {steps.length > 0 ? (
        <ol className={styles.syncSteps}>
          {steps.map((s, i) => (
            <li key={i}>
              {synced ? (
                <button type="button" className={styles.syncStep} aria-current={active === i ? 'step' : undefined} onClick={() => seek(i)}>
                  <span className={styles.syncN}>{i + 1}</span>
                  <span>{s}</span>
                  <span className={styles.syncT}>{stepTimes[i]!.toFixed(1).replace('.', ',')} s</span>
                </button>
              ) : (
                <span className={styles.syncStep}>
                  <span className={styles.syncN}>{i + 1}</span>
                  <span>{s}</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** Commande console « setpos/setang » : à coller dans une partie privée (sv_cheats 1) pour se téléporter au lancer. */
export function ConsoleCommand({ command }: { command: string }) {
  const toast = useToast();
  return (
    <div className={styles.console}>
      <code>{command}</code>
      <button
        type="button"
        className="btn btn-steel btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            toast('Commande copiée : colle-la dans la console CS2.');
          } catch {
            window.prompt('Copie cette commande :', command);
          }
        }}
      >
        <Icon name="copy" /> Copier
      </button>
    </div>
  );
}
