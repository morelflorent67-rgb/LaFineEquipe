import type { ReactNode } from 'react';
import type { MatchResult } from '@/lib/domain/schemas';
import { fmtDateTime, fmtInt, fmtSigned } from '@/lib/format';
import { Icon } from './Icon';

/** Victoire = V vert, Défaite = D rouge, Annulé = « – » gris, Inconnu = « ? » pointillé. */
const RESULT = {
  win: { cls: 'v', letter: 'V', label: 'Victoire' },
  loss: { cls: 'd', letter: 'D', label: 'Défaite' },
  cancelled: { cls: 'c', letter: '–', label: 'Match annulé' },
  unknown: { cls: 'u', letter: '?', label: 'Résultat inconnu' },
} as const;

export function ResultBadge({ result, large = false, detail }: { result: MatchResult; large?: boolean; detail?: string }) {
  const r = RESULT[result];
  const label = detail ? `${r.label} · ${detail}` : r.label;
  return (
    <span className={`rb ${r.cls}${large ? ' lg' : ''}`} title={label} aria-label={label} role="img">
      {r.letter}
    </span>
  );
}

export function Series({
  results,
  emptyLabel = 'Aucun match récent',
}: {
  results: { result: MatchResult; detail?: string }[];
  emptyLabel?: string;
}) {
  if (results.length === 0) return <span className="mono">{emptyLabel}</span>;
  return (
    <ol className="series" aria-label="Derniers résultats, du plus récent au plus ancien">
      {results.map((r, i) => (
        <li key={i}>
          <ResultBadge result={r.result} detail={r.detail} />
        </li>
      ))}
    </ol>
  );
}

/** Progression : couleur + flèche + signe (jamais la couleur seule). */
export function Delta({ value, className = '' }: { value: number | null; className?: string }) {
  if (value === null) {
    return (
      <span className={`dl flat ${className}`} title="Progression indisponible : ELO de départ ou actuel manquant">
        —
      </span>
    );
  }
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '=';
  return (
    <span className={`dl ${dir} ${className}`} aria-label={`Progression ${fmtSigned(value)} ELO`}>
      <span className="ar" aria-hidden="true">
        {arrow}
      </span>
      {fmtSigned(value)}
    </span>
  );
}

export function Level({ level }: { level: number | null }) {
  if (level === null) {
    return (
      <span className="lvl none" title="Niveau CS2 non fourni par FACEIT" aria-label="Niveau CS2 non fourni">
        –
      </span>
    );
  }
  return (
    <span className={`lvl${level === 10 ? ' top' : ''}`} aria-label={`Niveau FACEIT ${level}`} title={`Niveau ${level}`}>
      {level}
    </span>
  );
}

export function Elo({ elo, className = '' }: { elo: number | null; className?: string }) {
  if (elo === null) return <span className={`muted ${className}`}>ELO non fourni</span>;
  return <span className={`num ${className}`}>{fmtInt(elo)}</span>;
}

export function DemoTag({ children = 'Exemple fictif' }: { children?: ReactNode }) {
  return (
    <span className="chip demo" title="Donnée de démonstration, pas une vraie donnée FACEIT">
      {children}
    </span>
  );
}

/**
 * Fraîcheur d'un profil FACEIT : date de la dernière donnée valide, et signal si la
 * dernière tentative a échoué (on garde alors les anciennes valeurs).
 */
export function ProfileFreshness({
  fetchedAt,
  lastError,
  lastAttemptAt,
  staleAfterHours,
  now = new Date(),
  quiet = false,
}: {
  fetchedAt: string;
  lastError: string | null;
  lastAttemptAt: string | null;
  staleAfterHours: number;
  now?: Date;
  /** N'affiche rien quand les données sont fraîches (seuls les problèmes sont signalés). */
  quiet?: boolean;
}) {
  const failedAfter = lastError && lastAttemptAt && Date.parse(lastAttemptAt) >= Date.parse(fetchedAt);
  const stale = now.getTime() - Date.parse(fetchedAt) > staleAfterHours * 3600_000;
  if (failedAfter) {
    return (
      <span className="chip error" title={`Dernière tentative FACEIT échouée le ${fmtDateTime(lastAttemptAt!)}`}>
        <Icon name="alert" />
        Données du {fmtDateTime(fetchedAt)}
      </span>
    );
  }
  if (stale) {
    return (
      <span className="chip stale">
        <Icon name="alert" />
        Données du {fmtDateTime(fetchedAt)}
      </span>
    );
  }
  return quiet ? null : <span className="mono">FACEIT · {fmtDateTime(fetchedAt)}</span>;
}

export function StateBlock({
  kind = 'empty',
  title,
  children,
  actions,
}: {
  kind?: 'empty' | 'error' | 'unavailable';
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={`state ${kind === 'empty' ? '' : kind}`} role={kind === 'error' ? 'alert' : undefined}>
      <strong>{title}</strong>
      {children ? <div>{children}</div> : null}
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}
