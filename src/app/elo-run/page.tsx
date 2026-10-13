import type { Metadata } from 'next';
import Link from 'next/link';
import { RankingBoard } from '@/components/elo/RankingBoard';
import { RefreshControl } from '@/components/elo/RefreshControl';
import styles from '@/components/elo/elo.module.css';
import { StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { getViewer } from '@/lib/auth/viewer';
import { getEloHistory, getRecentResults, getRefreshStatus, getRoster, settle } from '@/lib/data/queries';
import { rankingRows } from '@/lib/elo/board';

export const metadata: Metadata = { title: 'ELO Run' };

/**
 * Classement ELO permanent : pas de saison ni de remise à zéro. Chaque joueur actif du roster est
 * classé par son ELO FACEIT actuel (copie locale synchronisée), progression = actuel − ELO d'ajout.
 */
export default async function EloRunPage() {
  const viewer = await getViewer();
  const [rosterRes, refreshRes] = await Promise.all([settle(getRoster()), settle(getRefreshStatus())]);

  const head = (
    <header className={styles.pageHead}>
      <p className={styles.backword} aria-hidden="true">
        ELO
      </p>
      <div className={styles.headRow}>
        <div>
          <p className="kicker">
            <Icon name="spk" className="spk" /> Classement permanent · FACEIT CS2
          </p>
          <h1 className="h1">ELO Run</h1>
          <p className={styles.lede}>
            Trié par <strong>ELO FACEIT actuel</strong>. Pas de saison, pas de remise à zéro : un joueur ajouté entre
            immédiatement à son vrai ELO, et sa progression se mesure depuis son ajout.
          </p>
        </div>
        {refreshRes.ok ? (
          <RefreshControl
            lastOkAt={refreshRes.data.lastOkAt}
            availableAt={refreshRes.data.availableAt}
            running={refreshRes.data.running}
            serverNow={refreshRes.data.now}
          />
        ) : null}
      </div>
    </header>
  );

  if (!rosterRes.ok) {
    return (
      <>
        {head}
        <section className="sec">
          <StateBlock kind="error" title="Classement momentanément indisponible">
            La base de données n’a pas répondu. Les derniers relevés enregistrés réapparaîtront dès son retour.
          </StateBlock>
        </section>
      </>
    );
  }

  const players = rosterRes.data.filter((p) => p.active);
  if (players.length === 0) {
    return (
      <>
        {head}
        <section className="sec">
          <StateBlock
            title="Personne au classement pour l’instant"
            actions={
              viewer.role === 'admin' ? (
                <Link className="btn btn-red btn-sm" href="/admin/players">
                  <Icon name="plus" /> Ajouter un joueur
                </Link>
              ) : null
            }
          >
            Dès qu’un administrateur ajoute un joueur FACEIT, il apparaît ici à son ELO actuel.
          </StateBlock>
        </section>
      </>
    );
  }

  const leader = rankingRows(players, 'elo')[0];
  const [resultsRes, historyRes] = await Promise.all([
    settle(getRecentResults(players.map((p) => p.id), 5)),
    leader ? settle(getEloHistory(leader.playerId)) : Promise.resolve(null),
  ]);

  return (
    <>
      {head}
      <RankingBoard
        players={players}
        results={resultsRes.ok ? Object.fromEntries(resultsRes.data) : {}}
        initialHistory={historyRes && historyRes.ok ? historyRes.data : null}
      />
      {!resultsRes.ok ? (
        <p className="mono" style={{ padding: '0 var(--pad)' }}>
          Derniers résultats momentanément indisponibles.
        </p>
      ) : null}
      <section className="sec" style={{ paddingTop: 0 }} aria-label="Règles du classement">
        <div className={styles.rules}>
          <div>
            <b>Progression = ELO actuel − ELO d’ajout</b>
            L’ELO d’ajout est le relevé FACEIT pris au moment où le joueur entre au classement : il démarre à 0.
          </div>
          <div>
            <b>Aucun historique inventé</b>
            La courbe commence à l’ajout du joueur. Rien n’est reconstitué avant, ni entre deux relevés.
          </div>
          <div>
            <b>Panne FACEIT</b>
            Les dernières valeurs valides restent affichées avec leur date ; rien n’est effacé ni estimé.
          </div>
        </div>
      </section>
    </>
  );
}
