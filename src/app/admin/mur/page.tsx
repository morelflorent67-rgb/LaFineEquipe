import Link from 'next/link';
import { FaceitImport } from '@/components/admin/FaceitImport';
import { AvoidAdminList } from '@/components/admin/AvoidAdminList';
import styles from '@/components/admin/admin.module.css';
import { StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { adminGetAvoidEntries, settle } from '@/lib/data/queries';

export const metadata = { title: 'Admin · Mur des lamentations' };

export default async function AdminMurPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const highlight = typeof sp.entree === 'string' ? sp.entree : null;
  const res = await settle(adminGetAvoidEntries('all'));
  const entries = res.ok ? res.data : [];
  const active = entries.filter((e) => e.status === 'active').length;

  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>Mur des lamentations</h1>
          <p>
            Banlist publique de la team. Ce n’est pas une sanction FACEIT. Tout le monde voit pseudo, avatar, niveau, ELO et
            date d’ajout des entrées actives ; la note interne reste réservée à l’administrateur.
          </p>
          <div className={styles.stats}>
            <span>
              <b>{active}</b> actif{active > 1 ? 's' : ''}
            </span>
            <span>
              <b>{entries.length - active}</b> archivé{entries.length - active > 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <Link className="btn btn-steel btn-sm" href="/mur-des-lamentations">
          Voir le Mur <Icon name="arrow" className="arrow" />
        </Link>
      </header>

      <section className={styles.panel} aria-labelledby="add-h">
        <div className={styles.panelH}>
          <h2 id="add-h">Ajouter un profil</h2>
          <span className={styles.private}>
            <Icon name="lock" /> Réservé aux administrateurs
          </span>
        </div>
        <div className={styles.panelB}>
          <FaceitImport target="avoid" />
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="list-h">
        <div className={styles.panelH}>
          <h2 id="list-h">Entrées</h2>
        </div>
        {res.ok ? (
          <AvoidAdminList entries={entries} highlightId={highlight} />
        ) : (
          <div className={styles.panelB}>
            <StateBlock kind="error" title="Impossible de charger le Mur">
              La base de données n’a pas répondu. Réessaie dans un instant.
            </StateBlock>
          </div>
        )}
      </section>
    </>
  );
}
