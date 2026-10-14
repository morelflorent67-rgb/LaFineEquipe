import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/seo';
import Link from 'next/link';
import { GrenadeIcon } from '@/components/stuffs/StuffCard';
import styles from '@/components/stuffs/stuffs.module.css';
import { StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { getViewer } from '@/lib/auth/viewer';
import { getMaps, settle } from '@/lib/data/queries';
import { mapCoverUrl } from '@/lib/media';
import { GRENADE_LABEL, GRENADES } from '@/lib/stuffs';

export const metadata: Metadata = publicMetadata('Stuffs', 'La bibliothèque CS2 de LaFineEquipe : smokes, flashes, molotovs et HE par map, avec fiches de placement et carte tactique.', '/stuffs');

export default async function StuffsPage() {
  const viewer = await getViewer();
  const res = await settle(getMaps());
  const maps = res.ok ? res.data : [];
  const total = maps.reduce((n, m) => n + m.counts.total, 0);
  return (
    <>
      <header className="page-head">
        <p className="kicker">
          <Icon name="spk" className="spk" /> Bibliothèque de la team
        </p>
        <h1 className="h1">Stuffs par map</h1>
        <p className="lede">
          Smokes, flashes, molotovs et HE : chaque fiche donne le départ, l’arrivée, les captures de placement et de visée, le
          lancer et la date de dernière vérification. {total} fiche{total > 1 ? 's' : ''} publiée{total > 1 ? 's' : ''}.
        </p>
        {viewer.role === 'admin' ? (
          <div style={{ marginTop: 16 }}>
            <Link className="btn btn-red btn-sm" href="/admin/stuffs">
              <Icon name="plus" /> Gérer les stuffs
            </Link>
          </div>
        ) : null}
      </header>
      <section className="sec">
        {!res.ok ? (
          <StateBlock kind="error" title="Maps momentanément indisponibles" />
        ) : maps.length === 0 ? (
          <StateBlock title="Aucune map active" />
        ) : (
          <ul className={styles.mtiles}>
            {maps.map((m, i) => {
              const cover = mapCoverUrl(m);
              return (
                <li key={m.slug}>
                  <Link className={`${styles.mtile} ${m.counts.total === 0 ? styles.mtileEmpty : ''}`} href={`/stuffs/${m.slug}`}>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- vraie capture téléversée par l'admin
                      <img src={cover} alt="" loading={i < 4 ? 'eager' : 'lazy'} decoding="async" />
                    ) : null}
                    {m.aerialPath && m.positionCount > 0 ? (
                      <span className={styles.mtTac}>
                        <Icon name="map" /> Carte tactique
                      </span>
                    ) : null}
                    <span className={styles.mtIn}>
                      <h2 className={styles.mtName}>{m.name}</h2>
                      <span className={styles.mtCount}>
                        {m.counts.total === 0 ? (
                          'Aucun lineup pour l’instant'
                        ) : (
                          <>
                            <b>{m.counts.total}</b> lineup{m.counts.total > 1 ? 's' : ''}
                          </>
                        )}
                      </span>
                      {m.counts.total > 0 ? (
                        <span className={styles.mtTypes}>
                          {GRENADES.filter((g) => m.counts[g] > 0).map((g) => (
                            <span key={g}>
                              <GrenadeIcon grenade={g} /> {m.counts[g]} {GRENADE_LABEL[g]}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <span className={styles.mtBar} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
