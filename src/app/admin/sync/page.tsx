import styles from '@/components/admin/admin.module.css';
import { StateBlock } from '@/components/ui/badges';
import { getServerEnv } from '@/lib/env';
import { adminGetSyncRuns, getSyncStatus, settle } from '@/lib/data/queries';
import { fmtDateTime } from '@/lib/format';
import { LiveDetectionForm, LocalDataControls, RunSyncButton } from './SyncControls';

export const metadata = { title: 'Admin · Synchronisation' };

const STATUS = { ok: 'Réussie', partial: 'Partielle', error: 'Échec', running: 'En cours' } as const;
const JOB = { profiles: 'Profils + ELO', matches: 'Matchs' } as const;

export default async function AdminSyncPage() {
  const env = getServerEnv();
  const [runs, status] = await Promise.all([settle(adminGetSyncRuns(40)), settle(getSyncStatus())]);
  const faceitBlocked =
    env.faceit.mode === 'live' && !env.faceit.apiKey
      ? 'Clé FACEIT absente : ajoute FACEIT_API_KEY dans .env.local'
      : env.backend === 'supabase' && !env.supabase?.secretKey
        ? 'SUPABASE_SECRET_KEY absente : nécessaire à la synchro'
        : null;

  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>Synchronisation FACEIT</h1>
          <p>
            Les pages lisent uniquement la base : FACEIT est interrogé par cette synchronisation (planifiée ou manuelle), une
            fois par profil et par passage.
          </p>
        </div>
        <RunSyncButton disabledReason={faceitBlocked} />
      </header>

      <section className={styles.panel} aria-labelledby="journal-h">
        <div className={styles.panelH}>
          <h2 id="journal-h">Journal</h2>
          {status.ok ? (
            <span className="mono">
              Dernière réussite profils :{' '}
              {status.data.jobs.profiles.lastOkAt ? fmtDateTime(status.data.jobs.profiles.lastOkAt) : 'jamais'} · matchs :{' '}
              {status.data.jobs.matches.lastOkAt ? fmtDateTime(status.data.jobs.matches.lastOkAt) : 'jamais'}
            </span>
          ) : null}
        </div>
        <div className={styles.panelB} style={{ overflowX: 'auto' }}>
          {!runs.ok ? (
            <StateBlock kind="error" title="Journal indisponible" />
          ) : runs.data.length === 0 ? (
            <StateBlock title="Aucune synchronisation pour l’instant">
              Lance une première synchronisation avec le bouton ci-dessus, puis planifie-la (voir docs/setup.md).
            </StateBlock>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--dim)' }}>
                  <th scope="col" style={{ padding: 8 }}>Début</th>
                  <th scope="col" style={{ padding: 8 }}>Tâche</th>
                  <th scope="col" style={{ padding: 8 }}>Origine</th>
                  <th scope="col" style={{ padding: 8 }}>Résultat</th>
                  <th scope="col" style={{ padding: 8 }}>Échecs</th>
                  <th scope="col" style={{ padding: 8 }}>Code</th>
                </tr>
              </thead>
              <tbody>
                {runs.data.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{fmtDateTime(r.startedAt)}</td>
                    <td style={{ padding: 8 }}>{JOB[r.job as keyof typeof JOB] ?? r.job}</td>
                    <td style={{ padding: 8 }}>{r.trigger}</td>
                    <td style={{ padding: 8 }}>
                      <span className={`chip ${r.status === 'ok' ? 'ok' : r.status === 'partial' ? 'stale' : r.status === 'error' ? 'error' : 'unknown'}`}>
                        {STATUS[r.status as keyof typeof STATUS] ?? r.status}
                      </span>
                    </td>
                    <td style={{ padding: 8 }} className="num">
                      {r.failures}
                    </td>
                    <td style={{ padding: 8 }} className="mono">
                      {r.errorCode ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="live-h">
        <div className={styles.panelH}>
          <h2 id="live-h">Matchs en cours</h2>
          <span className="chip unknown">
            {status.ok && status.data.live.source !== 'none' ? `Source : ${status.data.live.source}` : 'Aucune source validée'}
          </span>
        </div>
        <div className={styles.panelB} style={{ display: 'grid', gap: 14 }}>
          <p style={{ margin: 0 }} className="muted">
            La Data API FACEIT n’a pas d’endpoint « match en cours d’un joueur ». Tant qu’aucune source n’a été validée par un
            test réel (procédure dans docs/faceit-feasibility.md), le site affiche « Statut indisponible » et n’annonce jamais de
            LIVE.
          </p>
          <LiveDetectionForm current={status.ok ? status.data.live.source : 'none'} />
        </div>
      </section>

      {env.backend === 'local' ? (
        <section className={styles.panel} aria-labelledby="local-h">
          <div className={styles.panelH}>
            <h2 id="local-h">Base locale de développement</h2>
            <span className="chip demo">Mode local</span>
          </div>
          <div className={styles.panelB} style={{ display: 'grid', gap: 12 }}>
            <p style={{ margin: 0 }} className="muted">
              Pour tester l’affichage : le jeu de démonstration contient uniquement des profils et contenus fictifs, marqués « Exemple
              fictif ». Il n’existe pas en ligne.
            </p>
            <LocalDataControls />
          </div>
        </section>
      ) : null}
    </>
  );
}
