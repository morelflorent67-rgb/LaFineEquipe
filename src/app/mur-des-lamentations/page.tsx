import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { StateBlock } from '@/components/ui/badges';
import { getViewer, isAdmin } from '@/lib/auth/viewer';
import { getAvoidEntries, settle } from '@/lib/data/queries';
import { WallGrid } from './WallGrid';
import styles from './wall.module.css';

export const metadata: Metadata = {
  title: 'Mur des lamentations',
  robots: { index: false, follow: false },
};

function Hero() {
  return (
    <header className={styles.hero}>
      <svg className={styles.crack} viewBox="0 0 520 220" aria-hidden="true" focusable="false">
        <path d="M8 30 L90 52 L120 40 L178 88 L230 80 L262 120 L330 112 L360 160 L430 150 L512 200 M178 88 L170 140 L196 176 M330 112 L352 70 L400 60" />
      </svg>
      <p className="kicker">
        <Icon name="spk" className="spk" /> Liste interne de la team
      </p>
      <h1 className={styles.engraved}>
        <span>Mur des</span> <span className={styles.red}>lamentations</span>
      </h1>
      <p className={styles.disclaimer}>
        <Icon name="lock" />
        <span>
          Les joueurs avec qui la team ne relance plus de partie. <b>Ce n’est pas une sanction FACEIT</b> et aucun motif
          n’est publié : c’est juste notre mémoire collective.
        </span>
      </p>
    </header>
  );
}

export default async function MurPage() {
  const viewer = await getViewer();

  // Contrôle serveur : un visiteur ne reçoit AUCUNE donnée du Mur (et la base le refuse aussi).
  if (!isAdmin(viewer)) {
    return (
      <div className={styles.page}>
        <Hero />
        <section className={styles.gate} aria-labelledby="gate-h">
          <span className={styles.lock}>
            <Icon name="lock" />
          </span>
          <h2 className="h2" id="gate-h">
            Réservé à l’administrateur
          </h2>
          {viewer.signedIn ? (
            <p>Ce compte n’a pas le rôle administrateur : il voit le site comme un visiteur.</p>
          ) : (
            <p>Pour l’instant, seul l’administrateur voit le Mur. Aucune donnée n’est envoyée aux visiteurs.</p>
          )}
          {viewer.signedIn ? null : (
            <Link className="btn btn-red" href="/connexion?suite=/mur-des-lamentations">
              <Icon name="lock" /> Connexion admin
            </Link>
          )}
        </section>
      </div>
    );
  }

  const res = await settle(getAvoidEntries('active'));
  return (
    <div className={styles.page}>
      <Hero />
      {res.ok ? (
        <WallGrid entries={res.data} isAdmin={isAdmin(viewer)} now={new Date().toISOString()} />
      ) : (
        <div style={{ padding: '0 var(--pad) 60px' }}>
          <StateBlock kind="error" title="Mur momentanément indisponible">
            La base de données n’a pas répondu. Réessaie dans un instant.
          </StateBlock>
        </div>
      )}
    </div>
  );
}
