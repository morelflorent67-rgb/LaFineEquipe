import Link from 'next/link';
import { z } from 'zod';
import styles from '@/components/admin/admin.module.css';
import { VerificationNote } from '@/components/stuffs/StuffCard';
import { StateBlock } from '@/components/ui/badges';
import { adminGetUtilities, getMaps, settle } from '@/lib/data/queries';
import { mediaUrl } from '@/lib/media';
import { UtilityEditor } from '../UtilityEditor';

export const metadata = { title: 'Admin · Fiche stuff' };

export default async function AdminUtilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === 'nouveau';
  if (!isNew && !z.uuid().safeParse(id).success) {
    return <StateBlock title="Fiche introuvable" />;
  }
  const [maps, list] = await Promise.all([settle(getMaps(true)), isNew ? null : settle(adminGetUtilities())]);
  if (!maps.ok || (list && !list.ok)) return <StateBlock kind="error" title="Données indisponibles" />;
  const utility = list && list.ok ? (list.data.find((u) => u.id === id) ?? null) : null;
  if (!isNew && !utility) {
    return (
      <StateBlock
        title="Fiche introuvable"
        actions={
          <Link className="btn btn-steel btn-sm" href="/admin/stuffs">
            Retour aux stuffs
          </Link>
        }
      />
    );
  }
  const defaultMap = typeof sp.map === 'string' && maps.data.some((m) => m.slug === sp.map) ? sp.map : (maps.data[0]?.slug ?? 'mirage');

  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>{utility ? utility.title : 'Nouvelle fiche'}</h1>
          {utility ? (
            <div className={styles.stats}>
              <span>{utility.status === 'published' ? 'Publiée' : 'Brouillon'}</span>
              <VerificationNote u={utility} long />
              {utility.status === 'published' ? (
                <Link className="link" href={`/stuffs/${utility.mapSlug}/${utility.slug}`}>
                  Voir la fiche publique
                </Link>
              ) : null}
            </div>
          ) : (
            <p>Quatre étapes, comme sur csnades : la vidéo, le point d’arrivée, le point de lancer, puis les infos. N’ajoute que des lineups testés en jeu.</p>
          )}
        </div>
        <Link className="btn btn-ghost btn-sm" href="/admin/stuffs">
          ← Tous les stuffs
        </Link>
      </header>
      <section className={styles.panel}>
        <div className={styles.panelB}>
          <UtilityEditor
            maps={maps.data.map((m) => {
              // Vue aérienne csnades (par étage), sinon celle téléversée par l'admin (proportions inconnues : carrée).
              const aerial = mediaUrl(m.aerialPath);
              const radars = m.radars.length > 0 ? m.radars : aerial ? [{ level: 1, imageUrl: aerial, width: 1000, height: 1000 }] : [];
              return { slug: m.slug, name: m.name, radars };
            })}
            utility={utility}
            defaultMap={defaultMap}
            images={{ placement: mediaUrl(utility?.placementImage ?? null), aim: mediaUrl(utility?.aimImage ?? null) }}
          />
        </div>
      </section>
    </>
  );
}
