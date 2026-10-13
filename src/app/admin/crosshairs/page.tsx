import Link from 'next/link';
import styles from '@/components/admin/admin.module.css';
import { CrosshairStatus } from '@/components/crosshairs/CrosshairCard';
import { CrosshairPreview } from '@/components/crosshairs/CrosshairPreview';
import { DemoTag, StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { crosshairStatus } from '@/lib/crosshairs';
import { getCrosshairs, settle } from '@/lib/data/queries';

export const metadata = { title: 'Admin · Crosshairs' };

export default async function AdminCrosshairsPage() {
  const res = await settle(getCrosshairs(true));
  const items = res.ok ? res.data : [];
  const toCheck = items.filter((c) => crosshairStatus(c.verifiedAt) !== 'ok').length;
  return (
    <>
      <header className={styles.pageH}>
        <div>
          <h1>Crosshairs</h1>
          <p>
            Presets des joueurs : code de partage contrôlé dans sa forme, aperçu indicatif saisi à la main, date de test en jeu. Les
            codes validés avant les mises à jour CS2 de fin septembre 2026 sont signalés « à revérifier ».
          </p>
          <div className={styles.stats}>
            <span>
              <b>{items.filter((c) => c.published).length}</b> publiés
            </span>
            <span>
              <b>{items.filter((c) => !c.published).length}</b> brouillons
            </span>
            <span>
              <b>{toCheck}</b> à vérifier en jeu
            </span>
          </div>
        </div>
        <Link className="btn btn-red btn-sm" href="/admin/crosshairs/nouveau">
          <Icon name="plus" /> Nouveau crosshair
        </Link>
      </header>
      {!res.ok ? (
        <StateBlock kind="error" title="Crosshairs momentanément indisponibles" />
      ) : items.length === 0 ? (
        <StateBlock title="Aucun crosshair">Ajoute le premier preset avec « Nouveau crosshair ».</StateBlock>
      ) : (
        <section className={styles.panel}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((c, i) => (
              <li
                key={c.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '8px 14px',
                  padding: '12px 20px',
                  borderTop: i ? '1px solid var(--line)' : undefined,
                }}
              >
                <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, background: '#0b0b0c', border: '1px solid var(--line)' }}>
                  {c.preview ? <CrosshairPreview preview={c.preview} size={40} label={`Aperçu de ${c.label}`} /> : null}
                </span>
                <Link href={`/admin/crosshairs/${c.id}`} style={{ fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>
                  {c.label}
                </Link>
                <span className="muted">{c.player?.nickname ?? 'Sans joueur'}</span>
                <span className={`chip ${c.published ? 'ok' : 'unknown'}`}>{c.published ? 'Publié' : 'Brouillon'}</span>
                <CrosshairStatus c={c} />
                {c.isDemo ? <DemoTag /> : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
