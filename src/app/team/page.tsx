import type { Metadata } from 'next';
import Link from 'next/link';
import { PlayerCard } from '@/components/team/PlayerCard';
import styles from '@/components/team/PlayerCard.module.css';
import { StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { getViewer } from '@/lib/auth/viewer';
import { getRecentResults, getRoster, settle } from '@/lib/data/queries';

export const metadata: Metadata = { title: 'Joueurs' };

export default async function TeamPage() {
  const viewer = await getViewer();
  const roster = await settle(getRoster());
  const players = roster.ok ? roster.data : [];
  const results = await settle(getRecentResults(players.map((p) => p.id), 5));
  const team = players.filter((p) => p.group === 'team');
  const guests = players.filter((p) => p.group === 'guest');

  const list = (items: typeof players) => (
    <ul className={styles.grid}>
      {items.map((p) => (
        <PlayerCard
          key={p.id}
          player={p}
          results={results.ok ? (results.data.get(p.id) ?? []) : []}
        />
      ))}
    </ul>
  );

  return (
    <>
      <header className="page-head">
        <p className="kicker">
          <Icon name="spk" className="spk" /> Le roster
        </p>
        <h1 className="h1">Joueurs</h1>
        <p className="lede">
          Profils synchronisés avec FACEIT : pseudo, avatar, niveau et ELO CS2. « Progr. » = progression depuis l’ajout au
          classement permanent.
        </p>
      </header>
      <section className="sec" aria-labelledby="team-h">
        {!roster.ok ? (
          <StateBlock kind="error" title="Roster momentanément indisponible">
            La base de données n’a pas répondu. Réessaie dans un instant.
          </StateBlock>
        ) : players.length === 0 ? (
          <StateBlock
            title="Aucun joueur enregistré"
            actions={
              viewer.role === 'admin' ? (
                <Link className="btn btn-red btn-sm" href="/admin/players">
                  <Icon name="plus" /> Ajouter un joueur
                </Link>
              ) : null
            }
          >
            Le roster sera affiché ici dès qu’un administrateur aura ajouté les premiers profils FACEIT.
          </StateBlock>
        ) : (
          <div style={{ display: 'grid', gap: 40 }}>
            {team.length > 0 ? (
              <div>
                <div className="sec-h">
                  <h2 className="h2" id="team-h">
                    Team <span className="muted num">· {team.length}</span>
                  </h2>
                </div>
                {list(team)}
              </div>
            ) : null}
            {guests.length > 0 ? (
              <div>
                <div className="sec-h">
                  <h2 className="h2">
                    Guests <span className="muted num">· {guests.length}</span>
                  </h2>
                </div>
                {list(guests)}
              </div>
            ) : null}
            {!results.ok ? (
              <p className="mono">Derniers résultats momentanément indisponibles.</p>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}
