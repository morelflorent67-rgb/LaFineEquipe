'use client';

import Link from 'next/link';
import { useId, useRef, useState, useTransition } from 'react';
import {
  addAvoidEntryAction,
  addPlayerAction,
  lookupFaceitAction,
  type LookupResult,
} from '@/app/admin/faceit-actions';
import { Avatar } from '@/components/ui/Avatar';
import { Level } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toaster';
import { parseFaceitInput } from '@/lib/faceit/input';
import { fmtDateTime, fmtInt } from '@/lib/format';
import styles from './FaceitImport.module.css';

type Target = 'roster' | 'avoid';

/**
 * Parcours d'ajout commun au roster et au Mur :
 * 1. pseudo / lien / identifiant → 2. vérification du profil FACEIT (aperçu) → 3. confirmation.
 * Aucune donnée n'est enregistrée avant la confirmation, et le serveur recharge le profil
 * auprès de FACEIT au moment de l'enregistrement.
 */
export function FaceitImport({ target }: { target: Target }) {
  const toast = useToast();
  const inputId = useId();
  const reasonId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [group, setGroup] = useState<'team' | 'guest'>('team');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();
  const [saving, startSave] = useTransition();

  const preview = result?.kind === 'found' ? result.preview : null;
  const usage = result?.kind === 'found' ? result.usage : null;
  const blocked = target === 'avoid' ? usage?.avoid : usage?.player;
  const step = preview ? (blocked ? 2 : 3) : 1;

  function lookup(value: string) {
    const parsed = parseFaceitInput(value);
    setSaveError(null);
    if (!parsed.ok) {
      setInputError(parsed.reason);
      setResult(null);
      inputRef.current?.focus();
      return;
    }
    setInputError(null);
    startLookup(async () => {
      setResult(await lookupFaceitAction(value));
    });
  }

  function reset() {
    setResult(null);
    setQuery('');
    setReason('');
    setStatus('active');
    setGroup('team');
    setSaveError(null);
    inputRef.current?.focus();
  }

  function confirm() {
    if (!preview) return;
    setSaveError(null);
    startSave(async () => {
      const res =
        target === 'avoid'
          ? await addAvoidEntryAction({ faceitPlayerId: preview.faceitPlayerId, reason, status })
          : await addPlayerAction({ faceitPlayerId: preview.faceitPlayerId, group });
      if (res.ok) {
        toast(res.message);
        reset();
      } else {
        setSaveError(res.message);
        toast(res.message, true);
      }
    });
  }

  return (
    <div>
      <ol className={styles.stepper} aria-label="Étapes">
        {['Rechercher', 'Vérifier le profil', 'Confirmer'].map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? 'step' : undefined} data-done={step > i + 1}>
            <i>{step > i + 1 ? '✓' : i + 1}</i>
            {label}
          </li>
        ))}
      </ol>

      <form
        className="field"
        style={{ marginTop: 18 }}
        onSubmit={(e) => {
          e.preventDefault();
          lookup(query);
        }}
      >
        <label htmlFor={inputId}>Pseudo FACEIT, lien de profil ou identifiant</label>
        <div className={styles.searchRow}>
          <input
            ref={inputRef}
            id={inputId}
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ex. pseudo ou https://www.faceit.com/fr/players/pseudo"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={inputError ? true : undefined}
            aria-describedby={inputError ? `${inputId}-err` : undefined}
          />
          <button className="btn btn-red btn-sm" type="submit" disabled={looking}>
            <Icon name="search" />
            {looking ? 'Recherche…' : 'Rechercher'}
          </button>
        </div>
        {inputError ? (
          <p className={styles.error} id={`${inputId}-err`} role="alert">
            {inputError}
          </p>
        ) : null}
      </form>

      <div aria-live="polite">
        {result?.kind === 'error' ? (
          <div className={`${styles.alert} ${styles.block}`} role="alert">
            <b>Recherche impossible.</b> {result.message}
          </div>
        ) : null}

        {result?.kind === 'not_found' ? (
          <div className={styles.alert}>
            <b>Aucun profil FACEIT « {result.query} ».</b>{' '}
            {result.suggestions.length > 0
              ? 'Profils proches trouvés par la recherche FACEIT :'
              : 'Vérifie l’orthographe ou colle le lien du profil.'}
            {result.suggestions.length > 0 ? (
              <ul className={styles.suggestions}>
                {result.suggestions.map((s) => (
                  <li key={s.faceitPlayerId}>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery(s.nickname);
                        lookup(s.faceitPlayerId);
                      }}
                    >
                      <Avatar src={s.avatarUrl} size={36} />
                      <b>{s.nickname}</b>
                      {s.cs2Level ? <Level level={s.cs2Level} /> : null}
                      <span className="mono">{s.faceitPlayerId.slice(0, 8)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {preview && usage ? (
          <>
            <div className={styles.preview}>
              <Avatar src={preview.avatarUrl} size={88} level={preview.cs2Level} alt={`Avatar de ${preview.nickname}`} />
              <div style={{ minWidth: 0 }}>
                <p className={styles.found}>
                  <Icon name="check" />
                  Profil trouvé {preview.source === 'fixtures' ? 'dans le jeu d’essai fictif' : 'sur FACEIT'}
                </p>
                <h3>{preview.nickname}</h3>
                <dl className={styles.facts}>
                  <dt>Identifiant</dt>
                  <dd className={styles.fid} title="Identifiant FACEIT complet, utilisé pour les doublons et les synchronisations">
                    {preview.faceitPlayerId}
                  </dd>
                  <dt>Niveau CS2</dt>
                  <dd>{preview.hasCs2 ? <Level level={preview.cs2Level} /> : 'Pas de données CS2 sur FACEIT'}</dd>
                  <dt>ELO CS2</dt>
                  <dd className="num">{preview.cs2Elo !== null ? fmtInt(preview.cs2Elo) : 'Non fourni par FACEIT'}</dd>
                  <dt>Pays</dt>
                  <dd>{preview.country ? preview.country.toUpperCase() : 'Non renseigné'}</dd>
                  <dt>Avatar</dt>
                  <dd>
                    {preview.avatarUrl
                      ? 'Avatar FACEIT, utilisé automatiquement'
                      : preview.avatarRejected
                        ? 'Adresse d’image non autorisée : silhouette affichée'
                        : 'Pas d’avatar sur FACEIT : silhouette affichée'}
                  </dd>
                  <dt>Vérifié</dt>
                  <dd>{fmtDateTime(preview.fetchedAt)}</dd>
                </dl>
                <div className={styles.links}>
                  <a className="link" href={preview.faceitUrl} target="_blank" rel="noopener noreferrer">
                    Ouvrir le profil FACEIT <Icon name="ext" />
                  </a>
                </div>
                {preview.source === 'fixtures' ? (
                  <p className={styles.note}>Jeu d’essai local (FACEIT_MODE=fixtures) : ce profil n’existe pas sur FACEIT.</p>
                ) : null}
              </div>
            </div>

            {target === 'avoid' && usage.avoid ? (
              <div className={`${styles.alert} ${styles.block}`} role="alert">
                <b>Déjà sur le Mur</b> ({usage.avoid.status === 'active' ? 'entrée active' : 'entrée archivée'}). Pas de
                doublon possible : même identifiant FACEIT.{' '}
                <Link className="link" href={`/admin/mur?entree=${usage.avoid.id}#entree-${usage.avoid.id}`}>
                  Voir l’entrée
                </Link>
              </div>
            ) : null}
            {target === 'roster' && usage.player ? (
              <div className={`${styles.alert} ${styles.block}`} role="alert">
                <b>Déjà dans le roster</b> ({usage.player.active ? 'actif' : 'inactif'}). Même identifiant FACEIT : aucun
                doublon possible.
              </div>
            ) : null}
            {target === 'avoid' && usage.player ? (
              <div className={styles.alert}>
                <b>Attention :</b> ce profil fait partie du roster. L’ajout au Mur ne le retire pas du roster.
              </div>
            ) : null}
            {target === 'roster' && usage.avoid ? (
              <div className={styles.alert}>
                <b>Attention :</b> ce profil est sur le Mur des lamentations ({usage.avoid.status === 'active' ? 'actif' : 'archivé'}).
              </div>
            ) : null}

            {!blocked ? (
              <form
                className={styles.confirm}
                onSubmit={(e) => {
                  e.preventDefault();
                  confirm();
                }}
              >
                {target === 'avoid' ? (
                  <>
                    <div className="field">
                      <label htmlFor={reasonId}>Motif interne (facultatif)</label>
                      <textarea
                        id={reasonId}
                        className="textarea"
                        maxLength={280}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        aria-describedby={`${reasonId}-hint`}
                      />
                      <span className={styles.counter} aria-hidden="true">
                        {reason.length}/280
                      </span>
                      <span id={`${reasonId}-hint`} className="hint">
                        <span className="chip stale">
                          <Icon name="lock" /> Visible uniquement par les administrateurs
                        </span>{' '}
                        Reste factuel, sans insulte : cette note n’est jamais affichée publiquement.
                      </span>
                    </div>
                    <fieldset className={styles.radios}>
                      <legend>Statut</legend>
                      <label className={styles.radio}>
                        <input type="radio" name="status" checked={status === 'active'} onChange={() => setStatus('active')} />
                        <span>
                          <b>Actif</b>
                          <span>Visible publiquement sur le Mur.</span>
                        </span>
                      </label>
                      <label className={styles.radio}>
                        <input type="radio" name="status" checked={status === 'archived'} onChange={() => setStatus('archived')} />
                        <span>
                          <b>Archivé</b>
                          <span>Conservé, mais masqué du Mur.</span>
                        </span>
                      </label>
                    </fieldset>
                  </>
                ) : (
                  <fieldset className={styles.radios}>
                    <legend>Groupe</legend>
                    <label className={styles.radio}>
                      <input type="radio" name="group" checked={group === 'team'} onChange={() => setGroup('team')} />
                      <span>
                        <b>Team</b>
                        <span>Membre du roster principal.</span>
                      </span>
                    </label>
                    <label className={styles.radio}>
                      <input type="radio" name="group" checked={group === 'guest'} onChange={() => setGroup('guest')} />
                      <span>
                        <b>Guest</b>
                        <span>Joueur invité, filtrable à part.</span>
                      </span>
                    </label>
                  </fieldset>
                )}
                {target === 'avoid' ? (
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                    L’ajout au Mur ne donne aucun accès et n’inscrit le joueur ni au roster ni au classement.
                  </p>
                ) : null}
                {saveError ? (
                  <p className={styles.error} role="alert">
                    {saveError}
                  </p>
                ) : null}
                <div className={styles.actions}>
                  <button type="submit" className="btn btn-red" disabled={saving}>
                    <Icon name="plus" />
                    {saving ? 'Enregistrement…' : target === 'avoid' ? 'Ajouter au Mur' : 'Ajouter au roster'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={reset} disabled={saving}>
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <div className={styles.actions} style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                  Nouvelle recherche
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
