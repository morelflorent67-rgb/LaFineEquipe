'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { Grenade, MapInfo, MapPosition } from '@/lib/domain/schemas';
import { applyFilters, catalogQuery, GRENADE_LABEL, GRENADES, type CatalogMode, type StuffFilters } from '@/lib/stuffs';
import { GrenadeIcon, StuffCard, type UtilityView } from './StuffCard';
import { RadarMap } from './RadarMap';
import { TacticalMap } from './TacticalMap';
import styles from './stuffs.module.css';

const EMPTY: StuffFilters = { side: null, type: null, zone: null, q: '', beginner: false };

/**
 * Catalogue d'une map, en deux modes qui partagent les mêmes filtres : la carte (points
 * d'arrivée sur la vue aérienne, un type de grenade à la fois) et la grille. Filtres et mode
 * vivent dans l'URL : un lien partagé ou le retour depuis une fiche retrouve la même vue.
 */
export function StuffsCatalog({
  items,
  initial,
  initialMode,
  mapName,
  mapSlug,
  aerialUrl,
  positions,
  radars,
  isAdmin,
}: {
  items: UtilityView[];
  initial: StuffFilters;
  initialMode: CatalogMode;
  mapName: string;
  mapSlug: string;
  aerialUrl: string | null;
  positions: MapPosition[];
  radars: MapInfo['radars'];
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const searchId = useId();
  const [f, setF] = useState<StuffFilters>(initial);
  const [mode, setMode] = useState<CatalogMode>(initialMode);
  const toolsRef = useRef<HTMLDivElement>(null);

  // Hauteur de la barre de filtres collante : la carte et son panneau se calent juste dessous.
  useEffect(() => {
    const el = toolsRef.current;
    if (!el) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty('--stuffs-tools-h', `${el.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--stuffs-tools-h');
    };
  }, []);

  function update(next: StuffFilters, nextMode: CatalogMode = mode) {
    setF(next);
    setMode(nextMode);
    // API History native : l'URL suit les filtres sans recharger la page côté serveur.
    window.history.replaceState(null, '', `${pathname}${catalogQuery(next, nextMode)}`);
  }

  const radarMode = mode === 'carte' && radars.length > 0;
  // Sur la carte, un seul type de grenade à la fois (les smokes par défaut), comme des onglets.
  const radarType: Grenade = f.type ?? 'smoke';
  const visible = useMemo(() => applyFilters(items, radarMode ? { ...f, type: radarType } : f), [items, f, radarMode, radarType]);
  const zones = useMemo(() => [...new Set(items.map((u) => u.zone).filter((z): z is string => Boolean(z)))].sort(), [items]);
  const countBy = (g: Grenade) => applyFilters(items, { ...f, type: g }).length;
  const query = catalogQuery(f, mode);
  const groups = useMemo((): [string, UtilityView[]][] => {
    // Sans zones (stuffs importés), une seule grille triée par point d'arrivée.
    if (zones.length === 0) {
      const sorted = [...visible].sort(
        (a, b) => a.targetName.localeCompare(b.targetName, 'fr') || a.originName.localeCompare(b.originName, 'fr'),
      );
      return [['', sorted]];
    }
    const map = new Map<string, UtilityView[]>();
    for (const u of visible) {
      const key = u.zone ?? 'Autres';
      map.set(key, [...(map.get(key) ?? []), u]);
    }
    return [...map.entries()];
  }, [visible, zones.length]);
  const active = Boolean(f.side || f.type || f.zone || f.q.trim() || f.beginner);
  const hasBeginner = items.some((u) => u.difficulty === 'easy');
  const tabs: [CatalogMode, string, 'map' | 'grid'][] =
    radars.length > 0
      ? [
          ['carte', 'Carte', 'map'],
          ['bibliotheque', 'Grille', 'grid'],
        ]
      : [
          ['bibliotheque', 'Bibliothèque', 'grid'],
          ['carte', 'Carte tactique', 'map'],
        ];

  return (
    <>
      <div ref={toolsRef} className={styles.tools} role="region" aria-label="Filtres des stuffs">
        <div className={styles.modes} role="tablist" aria-label="Mode d’affichage">
          {tabs.map(([m, label, icon]) => (
            <button
              key={m}
              type="button"
              role="tab"
              id={`tab-${m}`}
              aria-controls={`pane-${m}`}
              aria-selected={mode === m}
              tabIndex={mode === m ? 0 : -1}
              className={styles.modeTab}
              onClick={() => update(f, m)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const other = m === 'carte' ? 'bibliotheque' : 'carte';
                  update(f, other);
                  document.getElementById(`tab-${other}`)?.focus();
                }
              }}
            >
              <Icon name={icon} /> {label}
              {m === 'carte' && radars.length === 0 && positions.length > 0 ? <span className={styles.modeCount}>{positions.length}</span> : null}
            </button>
          ))}
        </div>
        <div className={styles.toolsRow}>
          <div className={styles.grp} role="group" aria-label="Camp">
            <span className={styles.glbl}>Camp</span>
            {(['T', 'CT'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={styles.fchip}
                aria-pressed={f.side === s}
                onClick={() => update({ ...f, side: f.side === s ? null : s })}
              >
                {s}
              </button>
            ))}
          </div>
          <div className={styles.grp} role="group" aria-label="Grenade">
            <span className={styles.glbl}>Grenade</span>
            {GRENADES.map((g) => (
              <button
                key={g}
                type="button"
                className={styles.fchip}
                aria-pressed={radarMode ? radarType === g : f.type === g}
                onClick={() => update({ ...f, type: radarMode ? g : f.type === g ? null : g })}
              >
                <GrenadeIcon grenade={g} /> {GRENADE_LABEL[g]} <em>{countBy(g)}</em>
              </button>
            ))}
          </div>
          {hasBeginner ? (
            <div className={styles.grp} role="group" aria-label="Niveau">
              <button type="button" className={styles.fchip} aria-pressed={f.beginner} onClick={() => update({ ...f, beginner: !f.beginner })}>
                Débutant
              </button>
            </div>
          ) : null}
        </div>
        <div className={`${styles.toolsRow} ${styles.searchRow}`}>
          {zones.length > 0 ? (
            <div className={styles.grp} role="group" aria-label="Zone">
              <span className={styles.glbl}>Zone</span>
              {zones.map((z) => (
                <button
                  key={z}
                  type="button"
                  className={styles.fchip}
                  aria-pressed={f.zone === z}
                  onClick={() => update({ ...f, zone: f.zone === z ? null : z })}
                >
                  {z}
                </button>
              ))}
            </div>
          ) : null}
          <div className={`search ${styles.searchBox}`}>
            <Icon name="search" />
            <label htmlFor={searchId} className="sr-only-focusable">
              Rechercher un stuff sur {mapName}
            </label>
            <input
              id={searchId}
              className="input"
              type="search"
              placeholder="Rechercher (départ, arrivée, titre…)"
              value={f.q}
              onChange={(e) => update({ ...f, q: e.target.value })}
              autoComplete="off"
            />
          </div>
          <span className={styles.count} aria-live="polite">
            {visible.length} / {items.length} stuff{items.length > 1 ? 's' : ''}
          </span>
          {active ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => update(EMPTY)}>
              Réinitialiser
            </button>
          ) : null}
        </div>
      </div>

      {radarMode ? (
        <div className={styles.lib} id="pane-carte" role="tabpanel" aria-labelledby="tab-carte">
          <RadarMap mapName={mapName} radars={radars} items={visible} grenade={radarType} query={query} />
        </div>
      ) : mode === 'carte' ? (
        <div className={styles.lib} id="pane-carte" role="tabpanel" aria-labelledby="tab-carte">
          <TacticalMap
            mapName={mapName}
            mapSlug={mapSlug}
            aerialUrl={aerialUrl}
            positions={positions}
            items={visible}
            query={query}
            isAdmin={isAdmin}
          />
        </div>
      ) : (
      <div className={styles.lib} id="pane-bibliotheque" role="tabpanel" aria-labelledby="tab-bibliotheque">
        {items.some((u) => u.isDemo) ? (
          <p className={styles.fakeNote}>
            Fiches d’exemple fictives : elles montrent la structure du catalogue, sans aucun lineup réel. Les vraies fiches
            (captures, vidéo, instructions vérifiées) sont ajoutées par un administrateur.
          </p>
        ) : null}
        {items.length === 0 ? (
          <div className="state">
            <strong>Aucune fiche publiée sur {mapName}</strong>
            <span>Les stuffs de cette map seront ajoutés par un administrateur.</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="state" role="status">
            <strong>Aucune fiche ne correspond aux filtres</strong>
            <div className="actions">
              <button type="button" className="btn btn-steel btn-sm" onClick={() => update(EMPTY)}>
                Réinitialiser les filtres
              </button>
            </div>
          </div>
        ) : (
          groups.map(([zone, list]) => (
            <section key={zone || 'tout'} aria-labelledby={zone ? `z-${zone}` : undefined} aria-label={zone ? undefined : `Stuffs de ${mapName}`}>
              {zone ? (
                <div className={styles.zoneH}>
                  <h2 id={`z-${zone}`}>{zone}</h2>
                  <span className="mono">
                    {list.length} fiche{list.length > 1 ? 's' : ''}
                  </span>
                </div>
              ) : null}
              <ul className={styles.grid}>
                {list.map((u) => (
                  <li key={u.id}>
                    <StuffCard u={u} query={query} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      )}
    </>
  );
}
