'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AlertDialog } from 'radix-ui';
import {
  deleteCrosshairAction,
  saveCrosshairAction,
  verifyCrosshairAction,
} from '@/app/admin/crosshairs/actions';
import { CrosshairPreview } from '@/components/crosshairs/CrosshairPreview';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import { useReturnFocus } from '@/components/ui/useReturnFocus';
import { isShareCode, normalizeShareCode } from '@/lib/crosshairs';
import type { Crosshair, CrosshairPreview as Preview } from '@/lib/domain/schemas';
import proCrosshairs from '@/lib/pro-crosshairs.json';

const DEFAULT_PREVIEW: Preview = { len: 3, gap: 0, thickness: 1, outline: 1, dot: false, color: '#3CFF6E' };
const COLORS = ['#3CFF6E', '#41E5FF', '#FFE04A', '#FF3EDB', '#FF2A1F', '#FFFFFF'];
const RANGES: {
  key: 'len' | 'gap' | 'thickness' | 'outline';
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'len', label: 'Longueur', min: 0, max: 12, step: 0.5 },
  { key: 'gap', label: 'Écart', min: -5, max: 10, step: 0.5 },
  { key: 'thickness', label: 'Épaisseur', min: 0.5, max: 5, step: 0.5 },
  { key: 'outline', label: 'Contour', min: 0, max: 3, step: 1 },
];
const field = { display: 'grid', gap: 7 } as const;

/** Édition d'un preset : code contrôlé pendant la saisie, aperçu indicatif réglé à la main. */
export function CrosshairEditor({
  crosshair,
  players,
  maps,
}: {
  crosshair: Crosshair | null;
  players: { id: string; nickname: string }[];
  maps: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const focus = useReturnFocus();
  const [pending, start] = useTransition();
  const [code, setCode] = useState(crosshair?.shareCode ?? '');
  const [withPreview, setWithPreview] = useState(Boolean(crosshair?.preview) || !crosshair);
  const [preview, setPreview] = useState<Preview>(crosshair?.preview ?? DEFAULT_PREVIEW);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(crosshair?.gameVersion ?? '');
  const [confirm, setConfirm] = useState(false);
  const normalized = normalizeShareCode(code);
  const codeOk = isShareCode(normalized);
  const source = proCrosshairs.find((p) => p.code === normalized);

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <form
        style={{ display: 'grid', gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const f = new FormData(e.currentTarget);
          const get = (k: string) => String(f.get(k) ?? '');
          const published = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'published';
          start(async () => {
            const res = await saveCrosshairAction({
              id: crosshair?.id ?? null,
              label: get('label'),
              shareCode: code,
              playerId: get('playerId') || null,
              notes: get('notes'),
              preview: !source && withPreview ? preview : null,
              mapSlug: get('mapSlug') || null,
              gameVersion: get('gameVersion'),
              verifiedAt: get('verifiedAt') || null,
              published,
            });
            toast(res.message, !res.ok);
            if (!res.ok) setError(res.message);
            else if (!crosshair && res.data) router.replace(`/admin/crosshairs/${res.data.id}`);
            else router.refresh();
          });
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          }}
        >
          <div style={field}>
            <label htmlFor="label">Nom du preset</label>
            <input
              id="label"
              name="label"
              className="input"
              required
              minLength={2}
              maxLength={40}
              defaultValue={crosshair?.label ?? ''}
              placeholder="ex. Classique fin"
            />
          </div>
          <div style={field}>
            <label htmlFor="playerId">Joueur</label>
            <select
              id="playerId"
              name="playerId"
              className="select"
              defaultValue={crosshair?.player?.id ?? ''}
            >
              <option value="">Preset communautaire (sans joueur du roster)</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={field}>
          <label htmlFor="shareCode">Code de partage</label>
          <input
            id="shareCode"
            className="input"
            required
            spellCheck={false}
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CS… ou ancien code CSGO-…"
            maxLength={160}
            aria-invalid={code.length > 0 && !codeOk}
            aria-describedby="shareCode-hint"
            style={{ fontFamily: 'var(--mono)' }}
          />
          <span
            id="shareCode-hint"
            className="mono"
            style={{ color: code && !codeOk ? '#ff9b93' : undefined }}
          >
            {code.length === 0
              ? 'Exporté depuis les réglages du réticule dans CS2.'
              : codeOk
                ? 'Forme valide. L’import en jeu reste à tester.'
                : 'Forme attendue : CS… (format récent) ou CSGO- puis 5 blocs de 5 caractères.'}
          </span>
        </div>
        <div style={field}>
          <label htmlFor="notes">Notes (facultatif)</label>
          <textarea
            id="notes"
            name="notes"
            className="textarea"
            maxLength={280}
            defaultValue={crosshair?.notes ?? ''}
            placeholder="ex. pensé pour l’AWP, fond clair"
          />
        </div>

        {source ? (
          <figure
            style={{ margin: 0, padding: 16, background: '#0d1214', border: '1px solid var(--line-2)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- visuel local associé au code exact */}
            <img
              src={source.image}
              width={132}
              height={132}
              alt={`Visuel source de ${source.name}`}
              style={{ imageRendering: 'pixelated' }}
            />
            <figcaption>
              Visuel associé à ce code ·{' '}
              <a href={source.source} target="_blank" rel="noreferrer">
                Source ↗
              </a>
              . Changer le code retire ce visuel.
            </figcaption>
          </figure>
        ) : (
          <fieldset
            style={{ display: 'grid', gap: 14, margin: 0, padding: 16, border: '1px solid var(--line-2)' }}
          >
            <legend style={{ padding: '0 6px', fontWeight: 700 }}>Aperçu indicatif</legend>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={withPreview}
                onChange={(e) => setWithPreview(e.target.checked)}
              />{' '}
              Afficher un aperçu dessiné d’après ces réglages (recopiés à la main depuis le jeu : le code
              n’est pas décodé)
            </label>
            {withPreview ? (
              <div
                style={{
                  display: 'grid',
                  gap: 16,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
                  alignItems: 'start',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    aspectRatio: '16 / 9',
                    background: 'radial-gradient(circle, #1f1f23, #0b0b0c 70%)',
                    border: '1px solid var(--line)',
                  }}
                >
                  <span style={{ width: 160, height: 160 }}>
                    <CrosshairPreview preview={preview} size={160} label="Aperçu indicatif du réticule" />
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  {RANGES.map((r) => (
                    <label
                      key={r.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '90px minmax(0, 1fr) 40px',
                        gap: 10,
                        alignItems: 'center',
                        fontSize: 14,
                      }}
                    >
                      {r.label}
                      <input
                        type="range"
                        min={r.min}
                        max={r.max}
                        step={r.step}
                        value={preview[r.key]}
                        onChange={(e) => setPreview({ ...preview, [r.key]: Number(e.target.value) })}
                        style={{ accentColor: 'var(--brand-hi)' }}
                      />
                      <output className="mono">{preview[r.key]}</output>
                    </label>
                  ))}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={preview.dot}
                      onChange={(e) => setPreview({ ...preview, dot: e.target.checked })}
                    />{' '}
                    Point central
                  </label>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
                    role="group"
                    aria-label="Couleur"
                  >
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Couleur ${c}`}
                        aria-pressed={preview.color.toUpperCase() === c}
                        onClick={() => setPreview({ ...preview, color: c })}
                        style={{
                          width: 30,
                          height: 30,
                          padding: 0,
                          background: c,
                          border:
                            preview.color.toUpperCase() === c ? '2px solid #fff' : '2px solid transparent',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      Autre
                      <input
                        type="color"
                        value={preview.color}
                        onChange={(e) => setPreview({ ...preview, color: e.target.value.toUpperCase() })}
                      />
                    </label>
                  </div>
                  <div style={field}>
                    <label htmlFor="mapSlug">Fond de la carte (capture de map)</label>
                    <select
                      id="mapSlug"
                      name="mapSlug"
                      className="select"
                      defaultValue={crosshair?.map?.slug ?? ''}
                    >
                      <option value="">Aucun</option>
                      {maps.map((m) => (
                        <option key={m.slug} value={m.slug}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <input type="hidden" name="mapSlug" value="" />
            )}
          </fieldset>
        )}

        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          }}
        >
          <div style={field}>
            <label htmlFor="verifiedAt">Testé en jeu le</label>
            <input
              id="verifiedAt"
              name="verifiedAt"
              className="input"
              type="date"
              defaultValue={crosshair?.verifiedAt ?? ''}
            />
          </div>
          <div style={field}>
            <label htmlFor="gameVersion">Version du jeu (facultatif)</label>
            <input
              id="gameVersion"
              name="gameVersion"
              className="input"
              maxLength={40}
              defaultValue={crosshair?.gameVersion ?? ''}
              placeholder="ex. build du 30/09/2026"
            />
          </div>
        </div>
        {error ? (
          <p role="alert" style={{ margin: 0, color: '#ff9b93' }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button type="submit" value="published" className="btn btn-red" disabled={pending || !codeOk}>
            <Icon name="check" /> {crosshair?.published ? 'Enregistrer (publié)' : 'Enregistrer et publier'}
          </button>
          <button type="submit" value="draft" className="btn btn-steel" disabled={pending || !codeOk}>
            {crosshair?.published ? 'Dépublier (brouillon)' : 'Enregistrer en brouillon'}
          </button>
        </div>
      </form>

      {crosshair ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 10,
            paddingTop: 18,
            borderTop: '1px solid var(--line)',
          }}
        >
          <div style={field}>
            <label htmlFor="verify-version">Version testée</label>
            <input
              id="verify-version"
              className="input"
              maxLength={40}
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-steel btn-sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await verifyCrosshairAction(crosshair.id, version);
                toast(res.message, !res.ok);
                router.refresh();
              })
            }
          >
            <Icon name="check" /> Testé en jeu aujourd’hui
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={pending}
            onClick={() => {
              focus.remember();
              setConfirm(true);
            }}
          >
            <Icon name="trash" /> Supprimer
          </button>
          <AlertDialog.Root open={confirm} onOpenChange={setConfirm}>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="dialog-overlay" />
              <AlertDialog.Content className="dialog" onCloseAutoFocus={focus.onCloseAutoFocus}>
                <AlertDialog.Title>Supprimer « {crosshair.label} » ?</AlertDialog.Title>
                <AlertDialog.Description className="desc">
                  Le preset disparaît du site. Pour le masquer seulement, repasse-le en brouillon.
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
                        start(async () => {
                          const res = await deleteCrosshairAction(crosshair.id);
                          toast(res.message, !res.ok);
                          if (res.ok) router.replace('/admin/crosshairs');
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
        </div>
      ) : null}
    </div>
  );
}
