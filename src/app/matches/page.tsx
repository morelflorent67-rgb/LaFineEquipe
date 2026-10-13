import type { Metadata } from 'next';
import { LiveBlock } from '@/components/match/LiveStatus';
import { MatchList } from '@/components/match/MatchList';
import { StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { getLiveStateRow, getMapCovers, getRecentMatches, getSyncStatus, settle } from '@/lib/data/queries';
import { deriveLiveState } from '@/lib/domain/live';
import { fmtDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Matchs' };

export default async function MatchesPage() {
  const [liveRow, matchesRes, syncRes, mapsRes] = await Promise.all([
    settle(getLiveStateRow()),
    settle(getRecentMatches(30)),
    settle(getSyncStatus()),
    settle(getMapCovers()),
  ]);
  const covers = mapsRes.ok ? mapsRes.data : {};
  const live = liveRow.ok ? deriveLiveState(liveRow.data) : null;
  const lastOk = syncRes.ok ? syncRes.data.jobs.matches.lastOkAt : null;
  const lastRun = syncRes.ok ? syncRes.data.jobs.matches.lastRun : null;

  return (
    <>
      <header className="page-head">
        <p className="kicker">
          <Icon name="spk" className="spk" /> FACEIT
        </p>
        <h1 className="h1">Matchs</h1>
        <p className="lede">
          Matchs des joueurs suivis, regroupés par partie : plusieurs membres dans le même match = une seule ligne. Score et
          map affichés uniquement lorsqu’ils sont fournis par FACEIT.
        </p>
      </header>

      <section className="sec" id="en-cours" aria-labelledby="live-h" style={{ paddingBottom: 0 }}>
        <div className="sec-h">
          <h2 className="h2" id="live-h">
            En cours
          </h2>
        </div>
        <LiveBlock state={live} />
      </section>

      <section className="sec" aria-labelledby="recent-h">
        <div className="sec-h">
          <h2 className="h2" id="recent-h">
            Derniers matchs
          </h2>
          <span className="mono">
            {lastOk ? `Dernière synchro réussie ${fmtDateTime(lastOk)}` : 'Aucune synchro réussie pour l’instant'}
            {lastRun && lastRun.status === 'error' ? ' · la dernière tentative a échoué' : ''}
          </span>
        </div>
        {!matchesRes.ok ? (
          <StateBlock kind="error" title="Matchs momentanément indisponibles">
            La base de données n’a pas répondu. Réessaie dans un instant.
          </StateBlock>
        ) : matchesRes.data.length === 0 ? (
          <StateBlock title="Aucun match enregistré">
            Les matchs terminés des joueurs actifs du roster apparaîtront après la prochaine synchronisation FACEIT (historique
            des 14 derniers jours).
          </StateBlock>
        ) : (
          <MatchList matches={matchesRes.data} covers={covers} />
        )}
      </section>
    </>
  );
}
