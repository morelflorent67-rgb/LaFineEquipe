import Link from 'next/link';
import { z } from 'zod';
import styles from '@/components/admin/admin.module.css';
import { CrosshairEditor } from '@/components/admin/CrosshairEditor';
import { CrosshairStatus } from '@/components/crosshairs/CrosshairCard';
import { StateBlock } from '@/components/ui/badges';
import { getCrosshairs, getMaps, getRoster, settle } from '@/lib/data/queries';

export const metadata = { title: 'Admin · Crosshair' };

export default async function AdminCrosshairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === 'nouveau';
  const back = (
    <Link className="btn btn-ghost btn-sm" href="/admin/crosshairs">
      ← Tous les crosshairs
    </Link>
  );
  if (!isNew && !z.uuid().safeParse(id).success) return <StateBlock title="Crosshair introuvable" actions={back} />;
  const [list, roster, maps] = await Promise.all([settle(getCrosshairs(true)), settle(getRoster(true)), settle(getMaps(true))]);
  if (!list.ok || !roster.ok || !maps.ok) return <StateBlock kind="error" title="Données indisponibles" actions={back} />;
  const crosshair = isNew ? null : (list.data.find((c) => c.id === id) ?? null);
  if (!isNew && !crosshair) return <StateBlock title="Crosshair introuvable" actions={back} />;

  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>{crosshair ? crosshair.label : 'Nouveau crosshair'}</h1>
          {crosshair ? (
            <div className={styles.stats}>
              <span>{crosshair.published ? 'Publié' : 'Brouillon'}</span>
              <CrosshairStatus c={crosshair} />
            </div>
          ) : (
            <p>Colle le code de partage exporté depuis CS2 par le joueur, puis teste-le en jeu avant de le publier.</p>
          )}
        </div>
        {back}
      </header>
      <section className={styles.panel}>
        <div className={styles.panelB}>
          <CrosshairEditor
            crosshair={crosshair}
            players={roster.data.map((p) => ({ id: p.id, nickname: p.profile.nickname }))}
            maps={maps.data.map((m) => ({ slug: m.slug, name: m.name }))}
          />
        </div>
      </section>
    </>
  );
}
