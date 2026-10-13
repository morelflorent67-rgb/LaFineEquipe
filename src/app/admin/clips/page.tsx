import styles from '@/components/admin/admin.module.css';

export const metadata = { title: 'Admin · Clips' };

export default function AdminClipsPage() {
  return (
    <header className={styles.pageH}>
      <div>
        <h1>Clips</h1>
        <p>
          Pas encore disponible. Prévu en phase F : ajout de clips par lien (YouTube, Twitch, Allstar) avec titre, joueur, map
          et date. Aucun import automatique tant qu’une API officielle n’est pas accessible.
        </p>
      </div>
    </header>
  );
}
