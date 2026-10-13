import styles from '@/components/admin/admin.module.css';
import { MapCreateForm, MapAdminRow } from '@/components/admin/MapsAdmin';
import { StateBlock } from '@/components/ui/badges';
import { getMaps, settle } from '@/lib/data/queries';
import { mediaUrl } from '@/lib/media';

export const metadata = { title: 'Admin · Maps' };

export default async function AdminMapsPage() {
  const maps = await settle(getMaps(true));
  const list = maps.ok ? maps.data : [];
  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>Maps</h1>
          <p>
            Chaque map a une vraie capture de CS2 (prise par la team ou issue d’une ressource utilisable légalement) et une vue
            aérienne pour la carte tactique. Une map masquée n’apparaît plus sur le site, ses fiches restent en base.
          </p>
          <div className={styles.stats}>
            <span>
              <b>{list.filter((m) => m.active).length}</b> visibles
            </span>
            <span>
              <b>{list.filter((m) => !m.active).length}</b> masquées
            </span>
            <span>
              <b>{list.filter((m) => m.aerialPath).length}</b> avec vue aérienne
            </span>
          </div>
        </div>
      </header>
      {!maps.ok ? (
        <StateBlock kind="error" title="Maps momentanément indisponibles" />
      ) : (
        <>
          <ol style={{ display: 'grid', gap: 12, margin: 0, padding: 0, listStyle: 'none' }}>
            {list.map((m, i) => (
              <MapAdminRow
                key={m.slug}
                map={m}
                coverUrl={mediaUrl(m.coverPath)}
                aerialUrl={mediaUrl(m.aerialPath)}
                first={i === 0}
                last={i === list.length - 1}
              />
            ))}
          </ol>
          <MapCreateForm />
        </>
      )}
    </>
  );
}
