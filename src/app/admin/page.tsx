import Link from 'next/link';
import styles from '@/components/admin/admin.module.css';
import { getServerEnv } from '@/lib/env';
import { getSyncStatus, settle } from '@/lib/data/queries';
import { fmtDateTime } from '@/lib/format';

export const metadata = { title: 'Administration' };

const SECTIONS = [
  { href: '/admin/players', title: 'Joueurs', text: 'Ajouter un profil FACEIT au roster, groupes Team/Guest, activation.', ready: true },
  { href: '/admin/mur', title: 'Mur des lamentations', text: 'Liste interne : ajout vérifié, motifs privés, archives.', ready: true },
  { href: '/admin/maps', title: 'Maps', text: 'Vraies images, vue aérienne, ordre, visibilité et positions de la carte tactique.', ready: true },
  { href: '/admin/stuffs', title: 'Stuffs', text: 'Fiches par map : captures, vidéo, étapes, vérification.', ready: true },
  { href: '/admin/sync', title: 'Synchronisation', text: 'Journal FACEIT, lancement manuel, source des matchs en cours.', ready: true },
  { href: '/admin/clips', title: 'Clips', text: 'Pas encore disponible : import de liens prévu en phase F.', ready: false },
  { href: '/admin/crosshairs', title: 'Crosshairs', text: 'Presets des joueurs : code de partage, aperçu indicatif, date de test en jeu.', ready: true },
];

export default async function AdminHome() {
  const env = getServerEnv();
  const sync = await settle(getSyncStatus());
  const faceitReady = env.faceit.mode === 'fixtures' || Boolean(env.faceit.apiKey);
  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>Administration</h1>
          <p>Toutes les modifications sont vérifiées côté serveur (rôle admin) et par la base de données (RLS).</p>
        </div>
      </header>

      <section className={styles.panel} aria-labelledby="cfg-h">
        <div className={styles.panelH}>
          <h2 id="cfg-h">État de la configuration</h2>
        </div>
        <div className={styles.panelB}>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            <li>
              Données : <b>{env.backend === 'local' ? 'base locale de développement (.data/)' : 'Supabase'}</b>
            </li>
            <li>
              FACEIT :{' '}
              <b>
                {env.faceit.mode === 'fixtures'
                  ? 'jeu d’essai fictif (FACEIT_MODE=fixtures)'
                  : env.faceit.apiKey
                    ? 'clé serveur présente'
                    : 'clé absente : ajoute FACEIT_API_KEY dans .env.local'}
              </b>
              {faceitReady ? null : <span className="chip error" style={{ marginLeft: 8 }}>Import bloqué</span>}
            </li>
            <li>
              Dernière synchro des profils :{' '}
              <b>
                {sync.ok && sync.data.jobs.profiles.lastOkAt ? fmtDateTime(sync.data.jobs.profiles.lastOkAt) : 'jamais'}
              </b>
            </li>
            <li>
              Matchs en cours :{' '}
              <b>
                {sync.ok && sync.data.live.source !== 'none'
                  ? `source validée (${sync.data.live.source})`
                  : 'aucune source validée → « Statut indisponible »'}
              </b>
            </li>
          </ul>
        </div>
      </section>

      <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, padding: 0, margin: 0, listStyle: 'none' }}>
        {SECTIONS.map((s) => (
          <li key={s.href} className={styles.panel}>
            <Link href={s.href} style={{ display: 'grid', gap: 8, padding: 18, textDecoration: 'none', height: '100%' }}>
              <b style={{ font: '700 18px/1.2 var(--f)' }}>{s.title}</b>
              <span className="muted" style={{ fontSize: 14 }}>
                {s.text}
              </span>
              {s.ready ? null : <span className="chip unknown">Pas encore disponible</span>}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
