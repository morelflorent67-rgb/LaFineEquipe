import type { Metadata } from 'next';
import { cache } from 'react';
import { publicMetadata } from '@/lib/seo';
import Link from 'next/link';
import { MapStrip } from '@/components/stuffs/MapStrip';
import { GrenadeIcon } from '@/components/stuffs/StuffCard';
import { StuffsCatalog } from '@/components/stuffs/StuffsCatalog';
import styles from '@/components/stuffs/stuffs.module.css';
import { StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { getViewer } from '@/lib/auth/viewer';
import { getCatalog, getMaps, settle } from '@/lib/data/queries';
import { mapCoverUrl, mediaUrl } from '@/lib/media';
import { GRENADE_LABEL, GRENADES, parseFilters, parseMode } from '@/lib/stuffs';

type Props = {
  params: Promise<{ mapSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const loadCatalog = cache((slug: string) => SLUG.test(slug) ? settle(getCatalog(slug)) : Promise.resolve({ ok: true as const, data: null }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mapSlug } = await params;
  const res = await loadCatalog(mapSlug);
  if (!res.ok || !res.data || !res.data.map.active) return { title: 'Stuffs', robots: { index: false, follow: false } };
  return publicMetadata(`Stuffs ${res.data.map.name}`, `Les stuffs de LaFineEquipe sur ${res.data.map.name} : filtres par grenade et camp, placements et carte tactique.`, `/stuffs/${encodeURIComponent(mapSlug)}`);
}

export default async function MapStuffsPage({ params, searchParams }: Props) {
  const { mapSlug } = await params;
  const sp = await searchParams;
  const viewer = await getViewer();
  const [catalogRes, mapsRes] = await Promise.all([
    loadCatalog(mapSlug),
    settle(getMaps()),
  ]);
  const maps = (mapsRes.ok ? mapsRes.data : []).map((m) => ({ ...m, coverUrl: mapCoverUrl(m) }));

  if (!catalogRes.ok) {
    return (
      <section className="sec">
        <StateBlock kind="error" title="Catalogue momentanément indisponible" />
      </section>
    );
  }
  const catalog = catalogRes.data;
  if (!catalog) {
    return (
      <>
        <section className="sec">
          <StateBlock
            title="Map introuvable"
            actions={
              <Link className="btn btn-steel btn-sm" href="/stuffs">
                Toutes les maps
              </Link>
            }
          >
            Cette map n’existe pas dans la bibliothèque.
          </StateBlock>
        </section>
        <MapStrip maps={maps} current={null} />
      </>
    );
  }

  const items = catalog.utilities.map((u) => ({ ...u, placementUrl: mediaUrl(u.placementImage), aimUrl: mediaUrl(u.aimImage) }));
  const c = catalog.map.counts;

  return (
    <>
      <header className={styles.mhero}>
        {mapCoverUrl(catalog.map) ? (
          // eslint-disable-next-line @next/next/no-img-element -- vraie capture téléversée par l'admin
          <img className={styles.artImg} src={mapCoverUrl(catalog.map)!} alt="" />
        ) : (
          <div className={styles.art} />
        )}
        <ol className={styles.crumb} aria-label="Fil d’Ariane">
          <li>
            <Link href="/stuffs">Stuffs</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{catalog.map.name}</li>
        </ol>
        <div className={styles.heroRow}>
          <h1 className={`display ${styles.mapTitle}`}>{catalog.map.name}</h1>
          <ul className={styles.counts} aria-label={`${c.total} fiches publiées`}>
            {GRENADES.map((g) => (
              <li key={g}>
                <GrenadeIcon grenade={g} />
                <b>{c[g]}</b> {GRENADE_LABEL[g]}
              </li>
            ))}
          </ul>
        </div>
        {viewer.role === 'admin' ? (
          <div>
            <Link className="btn btn-red btn-sm" href={`/admin/stuffs/nouveau?map=${catalog.map.slug}`}>
              <Icon name="plus" /> Ajouter un stuff
            </Link>
          </div>
        ) : null}
      </header>
      <MapStrip maps={maps} current={catalog.map.slug} />
      <StuffsCatalog
        items={items}
        initial={parseFilters(sp)}
        initialMode={parseMode(sp, catalog.map.radars.length > 0 ? 'carte' : 'bibliotheque')}
        mapName={catalog.map.name}
        mapSlug={catalog.map.slug}
        aerialUrl={mediaUrl(catalog.map.aerialPath)}
        positions={catalog.positions}
        radars={catalog.map.radars}
        isAdmin={viewer.role === 'admin'}
      />
    </>
  );
}
