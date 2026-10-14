import Link from 'next/link';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { ClipEditor } from '@/components/admin/ClipEditor';
import styles from '@/components/admin/admin.module.css';
import { StateBlock } from '@/components/ui/badges';
import { getClips, getMaps, getRoster, settle } from '@/lib/data/queries';

export const metadata = { title: 'Admin · Clip' };
export default async function EditClipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== 'nouveau' && !z.uuid().safeParse(id).success) notFound();
  const [list, roster, maps] = await Promise.all([
    settle(getClips(true)),
    settle(getRoster(true)),
    settle(getMaps(true)),
  ]);
  if (!list.ok || !roster.ok || !maps.ok) return <StateBlock kind="error" title="Données indisponibles" />;
  const clip = list.data.find((c) => c.id === id) ?? null;
  if (id !== 'nouveau' && !clip) notFound();
  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>{clip ? clip.title : 'Nouveau clip'}</h1>
          <p>
            {clip
              ? clip.published
                ? 'Publié'
                : 'Brouillon'
              : 'Un lien, un joueur, une map : conserve les meilleurs rounds.'}
          </p>
        </div>
        <Link href="/admin/clips" className="btn btn-ghost btn-sm">
          ← Tous les clips
        </Link>
      </header>
      <section className={styles.panel}>
        <div className={styles.panelB}>
          <ClipEditor
            key={clip?.id ?? 'new'}
            clip={clip}
            players={roster.data.map((p) => ({ id: p.id, nickname: p.profile.nickname }))}
            maps={maps.data.map((m) => ({ slug: m.slug, name: m.name }))}
          />
        </div>
      </section>
    </>
  );
}
