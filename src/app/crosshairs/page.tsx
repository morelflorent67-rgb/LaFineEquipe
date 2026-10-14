import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/seo';
import Link from 'next/link';
import { CrosshairCard } from '@/components/crosshairs/CrosshairCard';
import styles from '@/components/crosshairs/crosshairs.module.css';
import { StateBlock } from '@/components/ui/badges';
import { Icon } from '@/components/ui/Icon';
import { getViewer } from '@/lib/auth/viewer';
import { getCrosshairs, settle } from '@/lib/data/queries';

export const metadata: Metadata = publicMetadata(
  'Crosshairs',
  'Les réticules CS2 de LaFineEquipe : codes de partage à copier, aperçus indicatifs et dates de vérification en jeu.',
  '/crosshairs',
);

export default async function CrosshairsPage() {
  const viewer = await getViewer();
  const isAdmin = viewer.role === 'admin';
  const res = await settle(getCrosshairs(isAdmin));
  return (
    <>
      <header className="page-head">
        <p className="kicker">
          <Icon name="spk" className="spk" /> Team & pros
        </p>
        <h1 className="h1">Crosshairs</h1>
        <p className="lede">Trouve ton viseur. Copie le code. À toi de jouer.</p>
      </header>

      <section className="sec" aria-labelledby="presets-h">
        <div className="sec-h">
          <div>
            <p className="kicker">
              <Icon name="spk" className="spk" /> Presets
            </p>
            <h2 className="h2" id="presets-h">
              La sélection <span className="muted num">· {res.ok ? res.data.length : '—'}</span>
            </h2>
          </div>
          {isAdmin ? (
            <Link className="btn btn-steel btn-sm" href="/admin/crosshairs">
              <Icon name="plus" /> Gérer les crosshairs
            </Link>
          ) : null}
        </div>
        {!res.ok ? (
          <StateBlock kind="error" title="Crosshairs momentanément indisponibles" />
        ) : res.data.length === 0 ? (
          <StateBlock title="Aucun crosshair publié pour l’instant">
            Les presets des joueurs apparaîtront ici dès qu’un administrateur les aura ajoutés et testés en
            jeu.
          </StateBlock>
        ) : (
          <ul className={styles.grid}>
            {res.data.map((c, i) => (
              <li key={c.id} data-rv="" style={{ '--i': i % 6 } as CSSProperties}>
                <CrosshairCard c={c} />
              </li>
            ))}
          </ul>
        )}
        <details className={styles.importHelp}>
          <summary>Comment importer un viseur dans CS2 ?</summary>
          <p className={styles.notes}>
            Les images des pros sont les rendus de leur code chez la source indiquée, agrandis ×2, pas des
            captures prises dans CS2. Les autres aperçus restent indicatifs. Vérifie l’import et le rendu dans
            ta résolution de jeu ; les codes peuvent évoluer après une mise à jour.
          </p>
          <ol className={styles.howto}>
            <li>
              <b>Copier</b>Clique « Copier » sous le preset choisi.
            </li>
            <li>
              <b>Importer dans CS2</b>Dans les paramètres du réticule, utilise l’import par code de partage et
              colle le code. Le chemin exact des menus peut changer d’une mise à jour à l’autre.
            </li>
            <li>
              <b>Vérifier</b>Contrôle le rendu en jeu : l’aperçu du site est indicatif, et un code validé
              avant la mise à jour peut ne plus s’importer.
            </li>
          </ol>
        </details>
      </section>
    </>
  );
}
