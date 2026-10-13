'use client';

import { usePathname } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { Grenade, MapPosition } from '@/lib/domain/schemas';
import { applyFilters, catalogQuery, GRENADE_LABEL, GRENADES, type CatalogMode, type StuffFilters } from '@/lib/stuffs';
import { GrenadeIcon, StuffCard, type UtilityView } from './StuffCard';
import { TacticalMap } from './TacticalMap';
import styles from './stuffs.module.css';

/**
 * Catalogue d'une map, en deux modes qui partagent les mêmes filtres : bibliothèque (cartes)
 * et carte tactique. Filtres et mode vivent dans l'URL : un lien partagé ou le retour depuis
 * une fiche retrouve exactement la même vue.
 */
export function StuffsCatalog({
  items,
  initial,
  initialMode,
  mapName,
  mapSlug,
  aerialUrl,
  positions,
  isAdmin,
}: {
  items: UtilityView[];
  initial: StuffFilters;
  initialMode: CatalogMode;
  mapName: string;
  mapSlug: string;
  aerialUrl: string | null;
  positions: MapPosition[];
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const searchId = useId();
  const [f, setF] = useState<StuffFilters>(initial);
  const [mode, setMode] = useState<CatalogMode>(initialMode);

  function update(next: StuffFilters, nextMode: CatalogMode = mode) {
    setF(next);
    setMode(nextMode);
    // API History native : l'URL suit les filtres sans recharger la page côté serveur.
    window.history.replaceState(null, '', `${pathname}${catalogQuery(next, nextMode)}`);
  }

  const visible = useMemo(() => applyFilters(items, f), [items, f]);
  const zones = useMemo(() => [...new Set(items.map((u) => u.zone).filter((z): z is string => Boolean(z)))].sort(), [items]);
  const countBy = (g: Grenade) => applyFilters(items, { ...f, type: g }).length;
  const query = catalogQuery(f, mode);
  const groups = useMemo(() => {
    const map = new Map<string, UtilityView[]>();
    for (const u of visible) {
      const key = u.zone ?? 'Autres';
      map.set(key, [...(map.get(key) ?? []), u]);
    }
    return [...map.entries()];
  }, [visible]);
  const active = Boolean(f.side || f.type || f.zone || f.q.trim());

  return (
    <>
      <div className={styles.tools} role="region" aria-label="Filtres des stuffs">
        <div className={styles.modes} role="tablist" aria-label="Mode d’affichage">
          {(
            [
              ['bibliotheque', 'Bibliothèque', 'grid'],
              ['carte', 'Carte tactique', 'map'],
            ] as const
          ).map(([m, label, icon]) => (
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
              {m === 'carte' && positions.length > 0 ? <span className={styles.modeCount}>{positions.length}</span> : null}
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
                aria-pressed={f.type === g}
                onClick={() => update({ ...f, type: f.type === g ? null : g })}
              >
                <GrenadeIcon grenade={g} /> {GRENADE_LABEL[g]} <em>{countBy(g)}</em>
              </button>
            ))}
          </div>
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
            {visible.length} / {items.length} fiche{items.length > 1 ? 's' : ''}
          </span>
          {active ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => update({ side: null, type: null, zone: null, q: '' })}>
              Réinitialiser
            </button>
          ) : null}
        </div>
      </div>

      {mode === 'carte' ? (
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
              <button type="button" className="btn btn-steel btn-sm" onClick={() => update({ side: null, type: null, zone: null, q: '' })}>
                Réinitialiser les filtres
              </button>
            </div>
          </div>
        ) : (
          groups.map(([zone, list]) => (
            <section key={zone} aria-labelledby={`z-${zone}`}>
              <div className={styles.zoneH}>
                <h2 id={`z-${zone}`}>{zone}</h2>
                <span className="mono">
                  {list.length} fiche{list.length > 1 ? 's' : ''}
                </span>
              </div>
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
