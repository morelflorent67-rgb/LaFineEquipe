import Link from 'next/link';
import type { LiveState } from '@/lib/domain/live';
import { fmtAgo, fmtTime, mapLabel } from '@/lib/format';
import { Icon } from '@/components/ui/Icon';

/** Libellés de l'état « match en cours », identiques partout (accueil, page Matchs). */
export function liveSummary(state: LiveState | null): { title: string; detail: string } {
  if (!state) return { title: 'Statut indisponible', detail: 'Données momentanément inaccessibles.' };
  switch (state.kind) {
    case 'unavailable':
      return {
        title: 'Statut indisponible',
        detail: 'Aucune source FACEIT fiable n’est encore validée pour détecter les matchs en cours.',
      };
    case 'uncertain':
      return {
        title: 'Statut incertain',
        detail: state.lastOkAt ? `Dernière vérification réussie ${fmtAgo(state.lastOkAt)}.` : 'Aucune vérification réussie récemment.',
      };
    case 'none':
      return { title: 'Personne en game', detail: `Vérifié à ${fmtTime(state.checkedAt)}.` };
    case 'live':
      return {
        title: `${state.matches.length} match${state.matches.length > 1 ? 's' : ''} en cours`,
        detail: `Vérifié à ${fmtTime(state.checkedAt)}.`,
      };
  }
}

export function LiveBlock({ state }: { state: LiveState | null }) {
  const s = liveSummary(state);
  if (state?.kind === 'live') {
    return (
      <div className="state" style={{ borderStyle: 'solid', borderColor: 'var(--brand-hi)' }}>
        <span className="live">
          <span className="dot" aria-hidden="true" /> Live
        </span>
        <strong>{s.title}</strong>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {state.matches.map((m) => (
            <li key={m.id}>
              {m.players.map((p) => p.nickname).join(', ')}
              {mapLabel(m.mapKey, m.mapName) ? ` · ${mapLabel(m.mapKey, m.mapName)}` : ''} ·{' '}
              <a className="link" href={m.faceitUrl} target="_blank" rel="noopener noreferrer">
                Salle FACEIT <Icon name="ext" />
              </a>
            </li>
          ))}
        </ul>
        <span className="mono">{s.detail}</span>
      </div>
    );
  }
  return (
    <div className={`state ${state?.kind === 'none' ? '' : 'unavailable'}`}>
      <strong>{s.title}</strong>
      <span>{s.detail}</span>
      {state?.kind === 'unavailable' ? (
        <span className="mono">
          Rien n’est affiché « en direct » par supposition. Les derniers matchs terminés restent disponibles ci-dessous.
        </span>
      ) : null}
      {state?.kind === 'uncertain' ? (
        <span className="mono">Une panne ou une réponse incomplète de FACEIT n’est jamais présentée comme « personne en game ».</span>
      ) : null}
      <Link className="link" href="/matches">
        Derniers matchs <Icon name="arrow" className="arrow" />
      </Link>
    </div>
  );
}
