import Link from 'next/link';
import styles from '@/components/admin/admin.module.css';
import clips from '@/components/clips/clips.module.css';
import { StateBlock, DemoTag } from '@/components/ui/badges';
import { getClips, settle } from '@/lib/data/queries';
import { PROVIDER_LABELS } from '@/lib/clips/providers';
import { fmtDate } from '@/lib/format';

export const metadata = { title: 'Admin · Clips' };

export default async function AdminClipsPage() {
  const res = await settle(getClips(true));
  const items = res.ok ? res.data : [];
  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>Clips</h1>
          <p>
            Ajoute les liens des meilleurs rounds. Les brouillons restent privés ; seuls les clips publiés
            sont visibles sur le site.
          </p>
        </div>
        <Link href="/admin/clips/nouveau" className="btn btn-red btn-sm">
          Nouveau clip
        </Link>
      </header>
      <section className={styles.panel}>
        {!res.ok ? (
          <StateBlock kind="error" title="Clips momentanément indisponibles" />
        ) : !items.length ? (
          <StateBlock title="Aucun clip ajouté">Commence par « Nouveau clip ».</StateBlock>
        ) : (
          <ul className={clips.rows}>
            {items.map((c) => (
              <li key={c.id} className={clips.row}>
                <Link href={`/admin/clips/${c.id}`}>{c.title}</Link>
                <span className="muted">
                  {c.player?.nickname ?? 'La team'} · {c.map?.name ?? 'Sans map'}
                </span>
                <span className="mono">
                  {PROVIDER_LABELS[c.provider]} · {fmtDate(c.recordedOn)}
                </span>
                <span className={`chip ${c.published ? 'ok' : 'unknown'}`}>
                  {c.published ? 'Publié' : 'Brouillon'}
                </span>
                {c.isDemo ? <DemoTag /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
