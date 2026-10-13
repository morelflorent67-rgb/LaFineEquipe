import { FaceitImport } from '@/components/admin/FaceitImport';
import { RosterAdminList } from '@/components/admin/RosterAdminList';
import styles from '@/components/admin/admin.module.css';
import { StateBlock } from '@/components/ui/badges';
import { getRoster, settle } from '@/lib/data/queries';

export const metadata = { title: 'Admin · Joueurs' };

export default async function AdminPlayersPage() {
  const res = await settle(getRoster(true));
  const players = res.ok ? res.data : [];
  const active = players.filter((p) => p.active);
  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>Joueurs</h1>
          <p>
            Ajoute un joueur par son pseudo ou son lien FACEIT : l’identifiant complet, le pseudo, l’avatar et les données CS2
            sont importés automatiquement, sans téléversement de photo.
          </p>
          <div className={styles.stats}>
            <span>
              <b>{active.filter((p) => p.group === 'team').length}</b> team
            </span>
            <span>
              <b>{active.filter((p) => p.group === 'guest').length}</b> guests
            </span>
            <span>
              <b>{players.length - active.length}</b> inactif{players.length - active.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </header>
      <section className={styles.panel} aria-labelledby="add-h">
        <div className={styles.panelH}>
          <h2 id="add-h">Ajouter un joueur au roster</h2>
        </div>
        <div className={styles.panelB}>
          <FaceitImport target="roster" />
        </div>
      </section>
      <section className={styles.panel} aria-labelledby="list-h">
        <div className={styles.panelH}>
          <h2 id="list-h">Roster</h2>
        </div>
        {res.ok ? (
          <RosterAdminList players={players} />
        ) : (
          <div className={styles.panelB}>
            <StateBlock kind="error" title="Impossible de charger le roster">
              La base de données n’a pas répondu.
            </StateBlock>
          </div>
        )}
      </section>
    </>
  );
}
