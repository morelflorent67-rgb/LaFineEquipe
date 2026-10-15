'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AlertDialog } from 'radix-ui';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import { useReturnFocus } from '@/components/ui/useReturnFocus';
import type { MapInfo, RadarPoint, Utility } from '@/lib/domain/schemas';
import {
  CLICK_LABEL,
  DIFFICULTY_LABEL,
  GRENADE_LABEL,
  MOVEMENT_LABEL,
  PRECISION_LABEL,
  SIDE_LABEL,
  slugify,
  throwSummary,
  youtubeId,
} from '@/lib/stuffs';
import {
  deleteUtilityAction,
  markUtilityVerifiedAction,
  removeUtilityImageAction,
  saveUtilityAction,
  uploadUtilityImageAction,
} from './actions';
import { RadarPicker, type PickerRadar } from './RadarPicker';
import styles from './wizard.module.css';

type Props = {
  maps: (Pick<MapInfo, 'slug' | 'name'> & { radars: PickerRadar[] })[];
  utility: Utility | null;
  defaultMap: string;
  images: { placement: string | null; aim: string | null };
};

const STEPS = [
  ['Vidéo', 'map, grenade, vidéo'],
  ['Arrivée', 'où tombe la grenade'],
  ['Lancer', 'd’où la lancer'],
  ['Infos', 'technique et étapes'],
] as const;

type Movement = NonNullable<Utility['movement']>;
type Click = NonNullable<Utility['click']>;
type Precision = NonNullable<Utility['precision']>;

/**
 * Assistant d'ajout et de modification d'un stuff, dans l'ordre de csnades :
 * 1. vidéo (+ map, grenade, camp), 2. clic sur le point d'arrivée, 3. clic sur le point de lancer,
 * 4. infos (technique, étapes…). Tout reste modifiable en revenant à une étape précédente.
 */
export function UtilityEditor({ maps, utility, defaultMap, images }: Props) {
  const router = useRouter();
  const toast = useToast();
  const focus = useReturnFocus();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [mapSlug, setMapSlug] = useState(utility?.mapSlug ?? defaultMap);
  const [grenade, setGrenade] = useState<Utility['grenade']>(utility?.grenade ?? 'smoke');
  const [side, setSide] = useState<Utility['side']>(utility?.side ?? 'T');
  const [videoUrl, setVideoUrl] = useState(utility?.videoUrl ?? '');
  const [landing, setLanding] = useState<RadarPoint | null>(utility?.landing ?? null);
  const [throwPt, setThrowPt] = useState<RadarPoint | null>(utility?.throw ?? null);
  const [level, setLevel] = useState(utility?.landing?.level ?? 1);
  const [targetName, setTargetName] = useState(utility?.targetName ?? '');
  const [originName, setOriginName] = useState(utility?.originName ?? '');
  const [title, setTitle] = useState(utility?.title ?? '');
  const [titleEdited, setTitleEdited] = useState(Boolean(utility));
  const [slug, setSlug] = useState(utility?.slug ?? '');
  const [movement, setMovement] = useState<Movement | ''>(utility?.movement ?? 'stationary');
  const [click, setClick] = useState<Click | ''>(utility?.click ?? 'left');
  const [jump, setJump] = useState(utility?.jump ?? false);
  const [precision, setPrecision] = useState<Precision | ''>(utility?.precision ?? '');
  const [difficulty, setDifficulty] = useState<NonNullable<Utility['difficulty']> | ''>(utility?.difficulty ?? '');
  const [stepsText, setStepsText] = useState(utility?.steps.join('\n') ?? '');
  const [description, setDescription] = useState(utility?.description ?? '');
  const [zone, setZone] = useState(utility?.zone ?? '');
  const [tags, setTags] = useState(utility?.tags.join(', ') ?? '');

  const map = maps.find((m) => m.slug === mapSlug) ?? maps[0];
  const autoTitle = targetName && originName ? `${targetName.trim()} depuis ${originName.trim()}` : '';
  const finalTitle = titleEdited ? title : autoTitle;
  const yt = youtubeId(videoUrl);
  const done = [Boolean(mapSlug), Boolean(landing && targetName.trim()), Boolean(throwPt && originName.trim()), finalTitle.trim().length >= 2];

  function changeMap(slug: string) {
    setMapSlug(slug);
    // Les points placés appartiennent à la vue aérienne de l'ancienne map.
    setLanding(null);
    setThrowPt(null);
    setLevel(1);
  }

  function save(status: 'draft' | 'published') {
    setError(null);
    startSave(async () => {
      const res = await saveUtilityAction({
        id: utility?.id ?? null,
        mapSlug,
        title: finalTitle,
        slug: slug || slugify(`${grenade} ${finalTitle}`),
        side,
        grenade,
        zone,
        originName,
        targetName,
        purpose: utility?.purpose ?? '',
        description,
        steps: stepsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        technique: utility?.technique ?? 'static',
        difficulty,
        movement,
        click,
        jump: movement ? jump : null,
        precision,
        throw: throwPt,
        landing,
        tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        videoUrl,
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

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {utility?.source === 'csnades' ? (
        <p className={styles.notice}>
          Stuff importé de csnades.gg : une nouvelle importation remplacera tes modifications (sauf brouillon/publié). Pour une
          version de la team, crée plutôt un nouveau stuff.
        </p>
      ) : null}

      <ol className={styles.steps} aria-label="Étapes">
        {STEPS.map(([label, hint], i) => (
          <li key={label}>
            <button type="button" className={styles.stepBtn} aria-current={step === i ? 'step' : undefined} data-done={done[i]} onClick={() => setStep(i)}>
              {i + 1}. {label}
              <small>{done[i] ? 'OK' : hint}</small>
            </button>
          </li>
        ))}
      </ol>

      <form
        className={styles.pane}
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 3) setStep(step + 1);
          else save('published');
        }}
      >
        {step === 0 ? (
          <>
            <h2>1. Vidéo, map et grenade</h2>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label htmlFor="mapSlug">Map</label>
                <select id="mapSlug" className="select" value={mapSlug} onChange={(e) => changeMap(e.target.value)}>
                  {maps.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="grenade">Grenade</label>
                <select id="grenade" className="select" value={grenade} onChange={(e) => setGrenade(e.target.value as Utility['grenade'])}>
                  {(['smoke', 'flash', 'molotov', 'he'] as const).map((g) => (
                    <option key={g} value={g}>
                      {GRENADE_LABEL[g]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="side">Camp</label>
                <select id="side" className="select" value={side} onChange={(e) => setSide(e.target.value as Utility['side'])}>
                  {(['T', 'CT', 'BOTH'] as const).map((s) => (
                    <option key={s} value={s}>
                      {SIDE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {utility?.media ? (
              <div className={styles.preview}>
                <video poster={utility.media.poster} muted loop playsInline controls preload="none">
                  <source src={utility.media.video.webm} type="video/webm" />
                  <source src={utility.media.video.mp4} type="video/mp4" />
                </video>
              </div>
            ) : (
              <div className={styles.field}>
                <label htmlFor="videoUrl">Vidéo YouTube (facultatif, avec le moment du lineup si la vidéo en contient plusieurs)</label>
                <input
                  id="videoUrl"
                  className="input"
                  type="url"
                  maxLength={200}
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtu.be/…?t=42"
                />
                {videoUrl && !yt ? <span style={{ color: '#ff9b93', fontSize: 13 }}>Lien non reconnu : seuls les liens YouTube sont acceptés.</span> : null}
                {yt ? (
                  <div className={styles.preview}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- miniature YouTube de la vidéo saisie */}
                    <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="Miniature de la vidéo YouTube" />
                  </div>
                ) : null}
              </div>
            )}
            <p>Conseils : vidéo 16:9 en 1080p, interface masquée (cl_draw_only_deathnotices 1), placement, visée et lancer bien visibles. Les captures se téléversent après le premier enregistrement.</p>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2>2. Où tombe la grenade ?</h2>
            <p>Clique sur la vue aérienne de {map?.name} à l’endroit exact où la grenade arrive.</p>
            <RadarPicker
              radars={map?.radars ?? []}
              level={level}
              onLevel={setLevel}
              point={landing}
              other={throwPt}
              kind="landing"
              onPick={setLanding}
              label={`Point d’arrivée sur ${map?.name ?? 'la map'}`}
            />
            <div className={styles.field} style={{ maxWidth: 420 }}>
              <label htmlFor="targetName">Nom de l’arrivée (callout, en anglais comme en jeu)</label>
              <input id="targetName" className="input" required maxLength={80} value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="ex. Window, B Short" />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2>3. D’où la lancer ?</h2>
            <p>Clique maintenant sur la position du joueur au moment du lancer. Le point d’arrivée reste affiché pour repère.</p>
            <RadarPicker
              radars={map?.radars ?? []}
              level={level}
              onLevel={setLevel}
              point={throwPt}
              other={landing}
              kind="throw"
              onPick={setThrowPt}
              label={`Point de lancer sur ${map?.name ?? 'la map'}`}
            />
            <div className={styles.field} style={{ maxWidth: 420 }}>
              <label htmlFor="originName">Nom du départ (callout)</label>
              <input id="originName" className="input" required maxLength={80} value={originName} onChange={(e) => setOriginName(e.target.value)} placeholder="ex. T Spawn" />
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2>4. Infos</h2>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label htmlFor="title">Titre</label>
                <input
                  id="title"
                  className="input"
                  required
                  maxLength={80}
                  value={finalTitle}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleEdited(true);
                  }}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="slug">Identifiant d’URL</label>
                <input id="slug" className="input" maxLength={80} value={slug} placeholder={slugify(`${grenade} ${finalTitle}`) || 'ex. smoke-window'} onChange={(e) => setSlug(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="movement">Mouvement</label>
                <select id="movement" className="select" value={movement} onChange={(e) => setMovement(e.target.value as Movement)}>
                  {(Object.keys(MOVEMENT_LABEL) as Movement[]).map((k) => (
                    <option key={k} value={k}>
                      {MOVEMENT_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="click">Clic</label>
                <select id="click" className="select" value={click} onChange={(e) => setClick(e.target.value as Click)}>
                  {(Object.keys(CLICK_LABEL) as Click[]).map((k) => (
                    <option key={k} value={k}>
                      {CLICK_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="precision">Précision demandée</label>
                <select id="precision" className="select" value={precision} onChange={(e) => setPrecision(e.target.value as Precision)}>
                  <option value="">Non précisée</option>
                  {(Object.keys(PRECISION_LABEL) as Precision[]).map((k) => (
                    <option key={k} value={k}>
                      {PRECISION_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="difficulty">Difficulté</label>
                <select id="difficulty" className="select" value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy')}>
                  <option value="">Non précisée</option>
                  {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {k === 'easy' ? `${v} (débutant)` : v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={jump} onChange={(e) => setJump(e.target.checked)} /> Avec saut (jumpthrow)
            </label>
            <p>
              Résumé affiché : <b>{movement && click ? throwSummary({ movement, click, jump, technique: 'static' }) : '—'}</b>
            </p>
            <div className={styles.field}>
              <label htmlFor="steps">Étapes (une par ligne, 12 maximum)</label>
              <textarea id="steps" className="textarea" rows={4} value={stepsText} onChange={(e) => setStepsText(e.target.value)} placeholder={'Se placer dans le coin\nViser la pointe de l’antenne\nSaut + lancer clic gauche'} />
            </div>
            <div className={styles.field}>
              <label htmlFor="description">Remarques (facultatif)</label>
              <textarea id="description" className="textarea" maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label htmlFor="zone">Zone (facultatif)</label>
                <input id="zone" className="input" maxLength={40} value={zone} onChange={(e) => setZone(e.target.value)} placeholder="ex. Mid, Site A" />
              </div>
              <div className={styles.field}>
                <label htmlFor="tags">Mots-clés (séparés par des virgules)</label>
                <input id="tags" className="input" maxLength={200} value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>
            </div>
          </>
        ) : null}

        {error ? (
          <p role="alert" style={{ margin: 0, color: '#ff9b93' }}>
            {error}
          </p>
        ) : null}
        <div className={styles.nav}>
          {step > 0 ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(step - 1)}>
              ← Précédent
            </button>
          ) : null}
          <span className={styles.spacer} />
          <button type="button" className="btn btn-steel btn-sm" disabled={saving || !done[3]} onClick={() => save('draft')}>
            {utility?.status === 'published' ? 'Dépublier (brouillon)' : 'Enregistrer en brouillon'}
          </button>
          {step < 3 ? (
            <button type="submit" className="btn btn-red btn-sm">
              Suivant →
            </button>
          ) : (
            <button type="submit" className="btn btn-red btn-sm" disabled={saving}>
              <Icon name="check" /> {utility?.status === 'published' ? 'Enregistrer (publié)' : 'Enregistrer et publier'}
            </button>
          )}
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
              <Icon name="check" /> Vérifié en jeu aujourd’hui
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={busy}
              onClick={() => {
                focus.remember();
                setConfirmDelete(true);
              }}
            >
              <Icon name="trash" /> Supprimer le stuff
            </button>
          </div>
          <AlertDialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="dialog-overlay" />
              <AlertDialog.Content className="dialog" onCloseAutoFocus={focus.onCloseAutoFocus}>
                <AlertDialog.Title>Supprimer « {utility.title} » ?</AlertDialog.Title>
                <AlertDialog.Description className="desc">
                  Le stuff, ses captures et ses signalements seront supprimés définitivement. Pour le masquer, repasse-le en brouillon.
                  {utility.source === 'csnades' ? ' Attention : une nouvelle importation csnades le recréerait.' : ''}
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
      ) : null}
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
