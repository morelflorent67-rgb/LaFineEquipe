import Link from 'next/link';
import styles from '@/components/admin/admin.module.css';
import { PositionsEditor } from '@/components/admin/PositionsEditor';
import { StateBlock } from '@/components/ui/badges';
import { getCatalog, settle } from '@/lib/data/queries';
import { mediaUrl } from '@/lib/media';

export const metadata = { title: 'Admin · Carte tactique' };

export default async function AdminMapPositionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const back = (
    <Link className="btn btn-ghost btn-sm" href="/admin/maps">
      ← Toutes les maps
    </Link>
  );
  if (!/^[a-z0-9-]{1,30}$/.test(slug)) return <StateBlock title="Map introuvable" actions={back} />;
  const catalog = await settle(getCatalog(slug, true));
  if (!catalog.ok) return <StateBlock kind="error" title="Carte momentanément indisponible" actions={back} />;
  if (!catalog.data) return <StateBlock title="Map introuvable" actions={back} />;
  const { map, positions, utilities } = catalog.data;
  const placed = utilities.filter((u) => u.throwPositionId).length;
  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>Carte tactique · {map.name}</h1>
          <p>
            Place les positions de lancer sur la vue aérienne, rattache chaque fiche à sa position et place son point d’impact.
            Rien n’est déduit automatiquement : seul ce que tu places ici apparaît sur la carte publique.
          </p>
          <div className={styles.stats}>
            <span>
              <b>{positions.length}</b> position{positions.length > 1 ? 's' : ''}
            </span>
            <span>
              <b>{placed}</b> / {utilities.length} fiches placées
            </span>
            {map.active ? (
              <Link className="link" href={`/stuffs/${map.slug}?vue=carte`}>
                Voir la carte publique
              </Link>
            ) : (
              <span className="chip unknown">Map masquée</span>
            )}
          </div>
        </div>
        {back}
      </header>
      {map.aerialPath ? (
        <PositionsEditor mapSlug={map.slug} aerialUrl={mediaUrl(map.aerialPath)!} positions={positions} utilities={utilities} />
      ) : (
        <StateBlock
          title="Vue aérienne manquante"
          actions={
            <Link className="btn btn-red btn-sm" href="/admin/maps">
              Ajouter la vue aérienne
            </Link>
          }
        >
          Téléverse d’abord la vue aérienne de {map.name} depuis la liste des maps : les positions sont placées sur cette image.
        </StateBlock>
      )}
    </>
  );
}
