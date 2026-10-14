import type { Metadata } from 'next';
import { Icon } from '@/components/ui/Icon';
import { StateBlock } from '@/components/ui/badges';
import { getViewer, isAdmin } from '@/lib/auth/viewer';
import { getAvoidEntries, getWallOfShame, settle } from '@/lib/data/queries';
import { WallGrid } from './WallGrid';
import { WallOfShame } from './WallOfShame';
import styles from './wall.module.css';

export const metadata: Metadata = {
  title: 'Mur des lamentations',
  description: 'La Banlist de la team et le Wall of Shame des 30 derniers jours.',
  // Page publique, mais des pseudos de joueurs extérieurs y figurent : pas d'indexation.
  robots: { index: false, follow: false },
};

function Hero() {
  return (
    <header className={styles.hero}>
      <svg className={styles.crack} viewBox="0 0 520 220" aria-hidden="true" focusable="false">
        <path d="M8 30 L90 52 L120 40 L178 88 L230 80 L262 120 L330 112 L360 160 L430 150 L512 200 M178 88 L170 140 L196 176 M330 112 L352 70 L400 60" />
      </svg>
      <p className="kicker">
        <Icon name="spk" className="spk" /> Chambrage entre amis
      </p>
      <h1 className={styles.engraved}>
        <span>Mur des</span> <span className={styles.red}>lamentations</span>
      </h1>
    </header>
  );
}

/** Page publique (décision du 14/10/2026). Les notes internes de la Banlist ne sont jamais lues ici. */
export default async function MurPage() {
  const viewer = await getViewer();
  const [banlist, shame] = await Promise.all([settle(getAvoidEntries('active')), settle(getWallOfShame(30))]);

  return (
    <div className={styles.page}>
      <Hero />
      <div className={styles.split}>
        <section className={styles.col} aria-labelledby="banlist-h">
          <h2 className={styles.colTitle} id="banlist-h">
            Banlist
          </h2>
          <p className={styles.disclaimer}>
            <Icon name="info" />
            <span>
              Les joueurs avec qui la team ne relance plus de partie. <b>Ce n’est pas une sanction FACEIT</b> et aucun motif
              n’est publié.
            </span>
          </p>
          {banlist.ok ? (
            <WallGrid entries={banlist.data} isAdmin={isAdmin(viewer)} now={new Date().toISOString()} />
          ) : (
            <StateBlock kind="error" title="Banlist momentanément indisponible">
              La base de données n’a pas répondu. Réessaie dans un instant.
            </StateBlock>
          )}
        </section>

        <section className={`${styles.col} ${styles.shameCol}`} aria-labelledby="shame-h">
          <h2 className={styles.colTitle} id="shame-h">
            Wall of <span className={styles.red}>Shame</span>
          </h2>
          {shame.ok ? (
            <WallOfShame data={shame.data} />
          ) : (
            <StateBlock kind="error" title="Wall of Shame momentanément indisponible">
              La base de données n’a pas répondu. Réessaie dans un instant.
            </StateBlock>
          )}
        </section>
      </div>
    </div>
  );
}
