'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from 'react';
import { AlertDialog } from 'radix-ui';
import { GrenadeIcon } from '@/components/stuffs/StuffCard';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import { useReturnFocus } from '@/components/ui/useReturnFocus';
import type { MapPosition, Utility } from '@/lib/domain/schemas';
import { GRENADE_LABEL, SIDE_LABEL } from '@/lib/stuffs';
import { deletePositionAction, linkUtilityAction, savePositionAction } from '@/app/admin/maps/actions';
import styles from './PositionsEditor.module.css';

type Pt = { x: number; y: number };
/** Déplacement en cours (ou en attente d'enregistrement) ; ignoré dès que les données serveur ont changé. */
type Override = { key: string; from: Pt; to: Pt };
type Mode = { kind: 'position' } | { kind: 'landing'; utilityId: string };

const round = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 100) / 100;
const GRENADE_CLASS = { smoke: styles.smoke, flash: styles.flash, molotov: styles.molotov, he: styles.he };

/**
 * Éditeur de la carte tactique (admin) : clic sur la vue aérienne pour créer une position,
 * glisser (ou flèches du clavier) pour la déplacer, rattachement des fiches et points d'impact.
 * Les coordonnées sont des % de l'image carrée, comme sur la carte publique.
 */
export function PositionsEditor({
  mapSlug,
  aerialUrl,
  positions,
  utilities,
}: {
  mapSlug: string;
  aerialUrl: string;
  positions: MapPosition[];
  utilities: Utility[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: string; id: string; pointer: number; startX: number; startY: number; moved: boolean } | null>(null);
  const keyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [override, setOverride] = useState<Override | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Pt | null>(null);
  const [draftName, setDraftName] = useState('');
  const [mode, setMode] = useState<Mode>({ kind: 'position' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const focus = useReturnFocus();

  const sel = positions.find((p) => p.id === selected) ?? null;
  const landingFor = mode.kind === 'landing' ? (utilities.find((u) => u.id === mode.utilityId) ?? null) : null;

  /** Position affichée : valeur serveur, sauf déplacement en cours sur cette même valeur. */
  function shown(key: string, base: Pt): Pt {
    if (override && override.key === key && override.from.x === base.x && override.from.y === base.y) return override.to;
    return base;
  }

  function pointFrom(clientX: number, clientY: number): Pt | null {
    const box = boxRef.current;
    if (!box) return null;
    const r = box.getBoundingClientRect();
    return { x: round(((clientX - r.left) / r.width) * 100), y: round(((clientY - r.top) / r.height) * 100) };
  }

  function act(fn: () => Promise<{ ok: boolean; message: string }>, onDone?: (ok: boolean) => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setOverride(null);
        toast(res.message, true);
      } else toast(res.message);
      onDone?.(res.ok);
      router.refresh();
    });
  }

  function link(u: Utility, positionId: string | null, landing: Pt | null) {
    act(() => linkUtilityAction({ utilityId: u.id, mapSlug, positionId, landing }));
  }

  function commitMove(key: string, id: string, from: Pt, to: Pt) {
    if (from.x === to.x && from.y === to.y) return;
    setOverride({ key, from, to });
    if (key.startsWith('p:')) {
      act(() => savePositionAction({ id, mapSlug, x: to.x, y: to.y }));
    } else {
      const u = utilities.find((x) => x.id === id);
      if (u) link(u, u.throwPositionId, to);
    }
  }

  function onBoxPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    const pt = pointFrom(e.clientX, e.clientY);
    if (!pt) return;
    if (landingFor) {
      link(landingFor, landingFor.throwPositionId, pt);
      setMode({ kind: 'position' });
      return;
    }
    setSelected(null);
    setDraft(pt);
  }

  function markerHandlers(key: string, id: string, base: Pt) {
    return {
      onPointerDown(e: PointerEvent<HTMLButtonElement>) {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { key, id, pointer: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
      },
      onPointerMove(e: PointerEvent<HTMLButtonElement>) {
        const d = drag.current;
        if (!d || d.pointer !== e.pointerId) return;
        if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
        d.moved = true;
        const pt = pointFrom(e.clientX, e.clientY);
        if (pt) setOverride({ key, from: base, to: pt });
      },
      onPointerUp(e: PointerEvent<HTMLButtonElement>) {
        const d = drag.current;
        drag.current = null;
        if (!d || d.pointer !== e.pointerId) return;
        if (d.moved || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) >= 4) {
          const pt = pointFrom(e.clientX, e.clientY);
          if (pt) commitMove(key, id, base, pt);
        } else if (key.startsWith('p:')) {
          setDraft(null);
          setSelected(id === selected ? null : id);
        }
      },
      onPointerCancel() {
        drag.current = null;
        setOverride(null);
      },
      /** Flèches : 0,25 % par appui (1 % avec Maj), enregistré après une courte pause. */
      onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
        const dirs: Record<string, Pt> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
        const dir = dirs[e.key];
        if (!dir) return;
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.25;
        const cur = shown(key, base);
        const to = { x: round(cur.x + dir.x * step), y: round(cur.y + dir.y * step) };
        setOverride({ key, from: base, to });
        if (keyTimer.current) clearTimeout(keyTimer.current);
        keyTimer.current = setTimeout(() => commitMove(key, id, base, to), 700);
      },
    };
  }

  const linkedTo = (id: string) => utilities.filter((u) => u.throwPositionId === id);
  const posName = (id: string | null) => positions.find((p) => p.id === id)?.name ?? null;

  return (
    <div className={styles.wrap}>
      <div className={styles.mapCol}>
        <div className={styles.modeBar} role="status">
          {landingFor ? (
            <>
              <span>
                <b>Point d’impact</b> de « {landingFor.title} » : clique sur la vue aérienne.
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode({ kind: 'position' })}>
                Annuler
              </button>
            </>
          ) : (
            <span>Clique sur la vue aérienne pour ajouter une position de lancer ; glisse un repère pour le déplacer.</span>
          )}
        </div>
        <div
          ref={boxRef}
          className={styles.box}
          data-mode={mode.kind}
          onPointerDown={onBoxPointerDown}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.radar} src={aerialUrl} alt={`Vue aérienne de ${mapSlug}`} draggable={false} />
          <svg className={styles.links} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {utilities.map((u) => {
              const p = positions.find((x) => x.id === u.throwPositionId);
              if (!p || !u.landing) return null;
              const a = shown(`p:${p.id}`, p);
              const b = shown(`l:${u.id}`, u.landing);
              const hl = selected === p.id || landingFor?.id === u.id;
              return <line key={u.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={hl ? styles.lineHl : undefined} />;
            })}
          </svg>
          {utilities.map((u) => {
            if (!u.landing) return null;
            const at = shown(`l:${u.id}`, u.landing);
            return (
              <button
                key={`l-${u.id}`}
                type="button"
                className={`${styles.land} ${GRENADE_CLASS[u.grenade]}`}
                style={{ left: `${at.x}%`, top: `${at.y}%` }}
                data-hl={selected === u.throwPositionId && selected ? '' : undefined}
                aria-label={`Impact de « ${u.title} » (${at.x} %, ${at.y} %). Flèches pour déplacer.`}
                {...markerHandlers(`l:${u.id}`, u.id, u.landing)}
              />
            );
          })}
          {positions.map((p) => {
            const at = shown(`p:${p.id}`, p);
            const n = linkedTo(p.id).length;
            return (
              <button
                key={p.id}
                type="button"
                className={styles.pos}
                style={{ left: `${at.x}%`, top: `${at.y}%` }}
                aria-pressed={selected === p.id}
                aria-label={`Position ${p.name}, ${n} fiche${n > 1 ? 's' : ''}. Flèches pour déplacer.`}
                {...markerHandlers(`p:${p.id}`, p.id, p)}
              >
                <Icon name="pin" />
                <span className={styles.posLabel}>{p.name}</span>
              </button>
            );
          })}
          {draft ? (
            <span className={`${styles.pos} ${styles.draft}`} style={{ left: `${draft.x}%`, top: `${draft.y}%` }} aria-hidden="true">
              <Icon name="pin" />
            </span>
          ) : null}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setDraft({ x: 50, y: 50 })}>
          <Icon name="plus" /> Ajouter une position au centre
        </button>
      </div>

      <div className={styles.side}>
        {draft ? (
          <form
            className={styles.card}
            onSubmit={(e) => {
              e.preventDefault();
              const at = draft;
              act(
                () => savePositionAction({ mapSlug, name: draftName, x: at.x, y: at.y }),
                (ok) => {
                  if (ok) {
                    setDraft(null);
                    setDraftName('');
                  }
                },
              );
            }}
          >
            <h2>Nouvelle position</h2>
            <span className="mono">
              {draft.x} % · {draft.y} %
            </span>
            <label htmlFor="pos-name">Nom (ex. « Spawn T », « Escaliers »)</label>
            <input
              id="pos-name"
              className="input"
              autoFocus
              required
              maxLength={40}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <div className={styles.btns}>
              <button type="submit" className="btn btn-red btn-sm" disabled={pending}>
                <Icon name="check" /> Enregistrer
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>
                Annuler
              </button>
            </div>
          </form>
        ) : sel ? (
          <PositionCard
            key={sel.id}
            position={sel}
            linked={linkedTo(sel.id)}
            pending={pending}
            onRename={(name) => act(() => savePositionAction({ id: sel.id, mapSlug, name }))}
            onDelete={() => {
              focus.remember();
              setConfirmDelete(true);
            }}
          />
        ) : (
          <div className={styles.card}>
            <h2>Positions</h2>
            {positions.length === 0 ? (
              <p className="muted">Aucune position pour l’instant.</p>
            ) : (
              <ul className={styles.posList}>
                {positions.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setSelected(p.id)}>
                      <Icon name="pin" /> {p.name}
                      <span className="muted">{linkedTo(p.id).length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <section className={styles.card} aria-labelledby="link-h">
          <h2 id="link-h">Fiches de la map</h2>
          {utilities.length === 0 ? (
            <p className="muted">Aucune fiche sur cette map.</p>
          ) : (
            <ul className={styles.utils}>
              {utilities.map((u) => (
                <li key={u.id} data-hl={selected && u.throwPositionId === selected ? '' : undefined}>
                  <div className={styles.utilHead}>
                    <GrenadeIcon grenade={u.grenade} />
                    <b>{u.title}</b>
                    <span className="muted">
                      {GRENADE_LABEL[u.grenade]} · {SIDE_LABEL[u.side]}
                      {u.status === 'draft' ? ' · brouillon' : ''}
                    </span>
                  </div>
                  <div className={styles.utilCtl}>
                    <label className="sr-only-focusable" htmlFor={`pos-${u.id}`}>
                      Position de lancer de « {u.title} »
                    </label>
                    <select
                      id={`pos-${u.id}`}
                      className="select"
                      value={u.throwPositionId ?? ''}
                      disabled={pending || positions.length === 0}
                      onChange={(e) => link(u, e.target.value || null, u.landing)}
                    >
                      <option value="">Non placée</option>
                      {positions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-steel btn-sm"
                      disabled={pending}
                      aria-pressed={landingFor?.id === u.id}
                      onClick={() => {
                        setDraft(null);
                        setMode(landingFor?.id === u.id ? { kind: 'position' } : { kind: 'landing', utilityId: u.id });
                      }}
                    >
                      <Icon name="target" /> {u.landing ? 'Replacer l’impact' : 'Placer l’impact'}
                    </button>
                    {u.landing ? (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => link(u, u.throwPositionId, null)}>
                        Retirer l’impact
                      </button>
                    ) : null}
                  </div>
                  {u.throwPositionId && !u.landing ? <span className={styles.warn}>Impact non placé</span> : null}
                  {!u.throwPositionId && u.landing ? <span className={styles.warn}>Impact placé sans position de lancer : invisible sur la carte</span> : null}
                  {u.throwPositionId ? <span className="mono">Lancer : {posName(u.throwPositionId)}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AlertDialog.Root open={confirmDelete && Boolean(sel)} onOpenChange={setConfirmDelete}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay" />
          <AlertDialog.Content className="dialog" onCloseAutoFocus={focus.onCloseAutoFocus}>
            <AlertDialog.Title>Supprimer la position « {sel?.name} » ?</AlertDialog.Title>
            <AlertDialog.Description className="desc">
              Les fiches rattachées ({sel ? linkedTo(sel.id).length : 0}) restent publiées mais disparaissent de la carte tactique
              jusqu’à ce que tu les rattaches à une autre position.
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
                    if (!sel) return;
                    const id = sel.id;
                    act(() => deletePositionAction(id, mapSlug), (ok) => ok && setSelected(null));
                  }}
                >
                  Supprimer
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

function PositionCard({
  position,
  linked,
  pending,
  onRename,
  onDelete,
}: {
  position: MapPosition;
  linked: Utility[];
  pending: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(position.name);
  return (
    <form
      className={styles.card}
      onSubmit={(e) => {
        e.preventDefault();
        onRename(name);
      }}
    >
      <h2>Position sélectionnée</h2>
      <span className="mono">
        {position.x} % · {position.y} %
      </span>
      <label htmlFor="sel-name">Nom</label>
      <input id="sel-name" className="input" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      <div className={styles.btns}>
        <button type="submit" className="btn btn-steel btn-sm" disabled={pending || name.trim() === position.name}>
          Renommer
        </button>
        <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={onDelete}>
          <Icon name="trash" /> Supprimer
        </button>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {linked.length === 0
          ? 'Aucune fiche rattachée : choisis cette position dans la liste des fiches ci-dessous.'
          : `${linked.length} fiche${linked.length > 1 ? 's' : ''} rattachée${linked.length > 1 ? 's' : ''} : ${linked.map((u) => u.title).join(', ')}.`}
      </p>
    </form>
  );
}
