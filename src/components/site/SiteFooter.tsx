import Link from 'next/link';
import styles from './SiteFooter.module.css';

export function SiteFooter({ signedIn, isAdmin }: { signedIn: boolean; isAdmin: boolean }) {
  return (
    <footer className={styles.foot}>
      <p className={styles.word} aria-hidden="true">
        La<b>Fine</b>Equipe
      </p>
      <div className={styles.row}>
        <span className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/lfe-round-temp.webp" alt="" width={34} height={34} />
          Site communautaire, non affilié à FACEIT ni à Valve.
        </span>
        <nav aria-label="Pied de page">
          <Link href="/elo-run">ELO Run</Link>
          <Link href="/matches">Matchs</Link>
          <Link href="/stuffs">Stuffs</Link>
          <Link href="/team">Joueurs</Link>
          <Link href="/mur-des-lamentations">Mur des lamentations</Link>
          {isAdmin ? <Link href="/admin">Espace admin</Link> : null}
          {signedIn ? null : <Link href="/connexion">Connexion admin</Link>}
        </nav>
      </div>
    </footer>
  );
}
