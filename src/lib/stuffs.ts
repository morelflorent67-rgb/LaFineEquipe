import type { Difficulty, Grenade, RadarPoint, Side, Technique, Utility } from '@/lib/domain/schemas';

export const GRENADE_LABEL: Record<Grenade, string> = { smoke: 'Smoke', flash: 'Flash', molotov: 'Molotov', he: 'HE' };
export const GRENADES: Grenade[] = ['smoke', 'flash', 'molotov', 'he'];
export const SIDE_LABEL: Record<Side, string> = { T: 'T', CT: 'CT', BOTH: 'T + CT' };
export const TECHNIQUE_LABEL: Record<Technique, string> = {
  static: 'Statique',
  jumpthrow: 'Jumpthrow',
  runthrow: 'Runthrow',
  run_jumpthrow: 'Run + jumpthrow',
  walkthrow: 'Walkthrow',
  crouch: 'Accroupi',
  jump_crouch: 'Saut accroupi',
  other: 'Autre',
};
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile' };
export const MOVEMENT_LABEL: Record<NonNullable<Utility['movement']>, string> = {
  stationary: 'Immobile',
  walking: 'Marche',
  running: 'Course',
  crouched_stationary: 'Accroupi',
  crouched_walking: 'Accroupi en marchant',
};
export const CLICK_LABEL: Record<NonNullable<Utility['click']>, string> = {
  left: 'clic gauche',
  right: 'clic droit',
  both: 'clic gauche + droit',
};
export const PRECISION_LABEL: Record<NonNullable<Utility['precision']>, string> = {
  loose: 'Tolérant',
  precise: 'Précis',
  very_precise: 'Très précis',
};

/** Technique simplifiée (filtres, anciennes fiches) déduite du mouvement et du saut. */
export function techniqueFor(movement: NonNullable<Utility['movement']>, jump: boolean): Technique {
  switch (movement) {
    case 'stationary':
      return jump ? 'jumpthrow' : 'static';
    case 'running':
      return jump ? 'run_jumpthrow' : 'runthrow';
    case 'walking':
      return jump ? 'other' : 'walkthrow';
    case 'crouched_stationary':
      return jump ? 'jump_crouch' : 'crouch';
    case 'crouched_walking':
      return jump ? 'other' : 'crouch';
  }
}

/** Résumé du lancer : « Course + saut + clic gauche » (ou la technique simplifiée des anciennes fiches). */
export function throwSummary(u: Pick<Utility, 'movement' | 'jump' | 'click' | 'technique'>): string {
  if (!u.movement || !u.click) return TECHNIQUE_LABEL[u.technique];
  const parts = [u.movement === 'stationary' ? null : MOVEMENT_LABEL[u.movement], u.jump ? 'saut' : null, CLICK_LABEL[u.click]];
  const text = parts.filter(Boolean).join(' + ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Filtres du catalogue, lus et écrits dans l'URL (partage + retour au catalogue avec les mêmes filtres). */
export type StuffFilters = { side: 'T' | 'CT' | null; type: Grenade | null; zone: string | null; q: string; beginner: boolean };

export function parseFilters(sp: Record<string, string | string[] | undefined>): StuffFilters {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
  const side = one('camp');
  const type = one('type');
  return {
    side: side === 'T' || side === 'CT' ? side : null,
    type: type && (GRENADES as string[]).includes(type) ? (type as Grenade) : null,
    zone: one('zone')?.slice(0, 40) ?? null,
    q: (one('q') ?? '').slice(0, 60),
    beginner: one('debutant') === '1',
  };
}

export function filtersToQuery(f: StuffFilters): string {
  const p = new URLSearchParams();
  if (f.side) p.set('camp', f.side);
  if (f.type) p.set('type', f.type);
  if (f.zone) p.set('zone', f.zone);
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.beginner) p.set('debutant', '1');
  const s = p.toString();
  return s ? `?${s}` : '';
}

export type CatalogMode = 'bibliotheque' | 'carte';

/** Mode lu dans l'URL ; sans « vue », celui par défaut de la map (la carte quand elle a une vue aérienne). */
export function parseMode(sp: Record<string, string | string[] | undefined>, fallback: CatalogMode = 'bibliotheque'): CatalogMode {
  return sp.vue === 'carte' ? 'carte' : sp.vue === 'bibliotheque' ? 'bibliotheque' : fallback;
}

/** Requête d'URL du catalogue : filtres + mode, toujours explicite (le retour d'une fiche rouvre la même vue). */
export function catalogQuery(f: StuffFilters, mode: CatalogMode): string {
  const q = filtersToQuery(f);
  return `${q ? `${q}&` : '?'}vue=${mode}`;
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function applyFilters<T extends Utility>(items: T[], f: StuffFilters): T[] {
  const needle = norm(f.q.trim());
  return items.filter(
    (u) =>
      (!f.side || u.side === f.side || u.side === 'BOTH') &&
      (!f.type || u.grenade === f.type) &&
      (!f.zone || u.zone === f.zone) &&
      (!f.beginner || u.difficulty === 'easy') &&
      (!needle ||
        [u.title, u.originName, u.targetName, u.zone ?? '', ...u.tags].some((s) => norm(s).includes(needle))),
  );
}

/** État de vérification d'une fiche (après un patch, une fiche peut ne plus fonctionner). */
export function verification(u: Pick<Utility, 'verifiedAt' | 'openReports'>): { kind: 'ok' | 'never' | 'reported'; reports: number } {
  if (u.openReports > 0) return { kind: 'reported', reports: u.openReports };
  if (!u.verifiedAt) return { kind: 'never', reports: 0 };
  return { kind: 'ok', reports: 0 };
}

/** Identifiant vidéo YouTube accepté (même règle que la contrainte SQL). */
export function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/^https:\/\/(?:www\.youtube\.com\/watch\?v=|youtu\.be\/|www\.youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,20})/);
  return m ? m[1]! : null;
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Marqueur de la carte tactique : une position de lancer × un type de grenade. */
export type TacticalGroup<T extends Utility> = {
  key: string;
  position: { id: string; name: string; x: number; y: number };
  grenade: Grenade;
  items: T[];
};

/**
 * Regroupe les stuffs (déjà filtrés) par position de lancer et type de grenade. Seuls les stuffs
 * rattachés par l'admin à une position existante apparaissent : aucune position n'est déduite.
 */
export function tacticalGroups<T extends Utility>(items: T[], positions: { id: string; name: string; x: number; y: number }[]): TacticalGroup<T>[] {
  const byId = new Map(positions.map((p) => [p.id, p]));
  const groups = new Map<string, TacticalGroup<T>>();
  for (const u of items) {
    const position = u.throwPositionId ? byId.get(u.throwPositionId) : undefined;
    if (!position) continue;
    const key = `${position.id}|${u.grenade}`;
    const g = groups.get(key) ?? { key, position, grenade: u.grenade, items: [] };
    g.items.push(u);
    groups.set(key, g);
  }
  return [...groups.values()].sort(
    (a, b) => a.position.name.localeCompare(b.position.name, 'fr') || GRENADES.indexOf(a.grenade) - GRENADES.indexOf(b.grenade),
  );
}

/** Point d'arrivée de la carte : stuffs d'un même type qui tombent au même endroit. */
export type LandingCluster<T extends Utility> = {
  key: string;
  grenade: Grenade;
  /** Position moyenne des points d'arrivée regroupés (en %). */
  x: number;
  y: number;
  /** Nom d'arrivée le plus fréquent du groupe (« B Short »). */
  name: string;
  items: T[];
};

/**
 * Regroupe les stuffs (déjà filtrés) par point d'arrivée sur un étage : deux arrivées du même
 * type à moins de `radius` (en % du plus grand côté de la vue aérienne) forment un seul marqueur.
 * Seuls les points réellement placés sont utilisés : rien n'est déduit.
 */
export function landingClusters<T extends Utility>(
  items: T[],
  opts: { level: number; aspect: number; radius?: number },
): LandingCluster<T>[] {
  const radius = opts.radius ?? 2.2;
  // Distances mesurées dans un repère carré : % de largeur × aspect si l'image est plus large que haute.
  const sx = opts.aspect >= 1 ? 1 : opts.aspect;
  const sy = opts.aspect >= 1 ? 1 / opts.aspect : 1;
  const placed = items
    .filter((u): u is T & { landing: RadarPoint } => u.landing !== null && (u.landing.level ?? 1) === opts.level)
    .sort((a, b) => a.landing.x - b.landing.x || a.landing.y - b.landing.y || a.id.localeCompare(b.id));
  const clusters: (LandingCluster<T> & { sumX: number; sumY: number })[] = [];
  for (const u of placed) {
    const near = clusters.find((c) => {
      if (c.grenade !== u.grenade) return false;
      const dx = (c.x - u.landing.x) * sx;
      const dy = (c.y - u.landing.y) * sy;
      return Math.hypot(dx, dy) <= radius;
    });
    if (near) {
      near.items.push(u);
      near.sumX += u.landing.x;
      near.sumY += u.landing.y;
      near.x = near.sumX / near.items.length;
      near.y = near.sumY / near.items.length;
    } else {
      clusters.push({ key: `${u.grenade}-${u.id}`, grenade: u.grenade, x: u.landing.x, y: u.landing.y, name: u.targetName, items: [u], sumX: u.landing.x, sumY: u.landing.y });
    }
  }
  return clusters.map((raw) => {
    const c = { key: raw.key, grenade: raw.grenade, x: raw.x, y: raw.y, items: raw.items };
    const freq = new Map<string, number>();
    for (const u of c.items) freq.set(u.targetName, (freq.get(u.targetName) ?? 0) + 1);
    const name = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
    c.items.sort((a, b) => a.originName.localeCompare(b.originName, 'fr') || a.title.localeCompare(b.title, 'fr'));
    return { ...c, name };
  });
}
