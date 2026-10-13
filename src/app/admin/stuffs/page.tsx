import Link from 'next/link';
import styles from '@/components/admin/admin.module.css';
import { GrenadeIcon, SideBadge, VerificationNote } from '@/components/stuffs/StuffCard';
import { DemoTag, StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { adminGetUtilities, getMaps, settle } from '@/lib/data/queries';

export const metadata = { title: 'Admin · Stuffs' };

export default async function AdminStuffsPage() {
  const [list, maps] = await Promise.all([settle(adminGetUtilities()), settle(getMaps(true))]);
  const items = list.ok ? list.data : [];
  const reported = items.filter((u) => u.openReports > 0).length;
  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>Stuffs</h1>
          <p>Fiches par map : brouillon puis publication, captures de placement et de visée, vidéo YouTube, date de vérification.</p>
          <div className={styles.stats}>
            <span>
              <b>{items.filter((u) => u.status === 'published').length}</b> publiées
            </span>
            <span>
              <b>{items.filter((u) => u.status === 'draft').length}</b> brouillons
            </span>
            <span>
              <b>{reported}</b> signalée{reported > 1 ? 's' : ''} à revérifier
            </span>
          </div>
        </div>
        <Link className="btn btn-red btn-sm" href="/admin/stuffs/nouveau">
          <Icon name="plus" /> Nouvelle fiche
        </Link>
      </header>
      {!list.ok || !maps.ok ? (
        <StateBlock kind="error" title="Stuffs momentanément indisponibles" />
      ) : (
        maps.data.map((m) => {
          const ofMap = items.filter((u) => u.mapSlug === m.slug);
          return (
            <section key={m.slug} className={styles.panel} aria-labelledby={`m-${m.slug}`}>
              <div className={styles.panelH}>
                <h2 id={`m-${m.slug}`}>
                  {m.name} <span className="muted num">· {ofMap.length}</span>
                </h2>
                <Link className="link" href={`/admin/stuffs/nouveau?map=${m.slug}`}>
                  <Icon name="plus" /> Ajouter
                </Link>
              </div>
              {ofMap.length === 0 ? (
                <p className={styles.panelB} style={{ margin: 0, color: 'var(--muted)' }}>
                  Aucune fiche.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {ofMap.map((u) => (
                    <li
                      key={u.id}
                      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 14px', padding: '12px 20px', borderTop: '1px solid var(--line)' }}
                    >
                      <GrenadeIcon grenade={u.grenade} />
                      <SideBadge side={u.side} />
                      <Link href={`/admin/stuffs/${u.id}`} style={{ fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>
                        {u.title}
                      </Link>
                      <span className={`chip ${u.status === 'published' ? 'ok' : 'unknown'}`}>
                        {u.status === 'published' ? 'Publiée' : 'Brouillon'}
                      </span>
                      <VerificationNote u={u} long />
                      {!u.placementImage || !u.aimImage ? <span className="chip stale">Captures manquantes</span> : null}
                      {u.isDemo ? <DemoTag /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
