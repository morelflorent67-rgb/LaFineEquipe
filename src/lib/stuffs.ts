import type { Difficulty, Grenade, Side, Technique, Utility } from '@/lib/domain/schemas';

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

/** Filtres du catalogue, lus et écrits dans l'URL (partage + retour au catalogue avec les mêmes filtres). */
export type StuffFilters = { side: 'T' | 'CT' | null; type: Grenade | null; zone: string | null; q: string };

export function parseFilters(sp: Record<string, string | string[] | undefined>): StuffFilters {
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
  const side = one('camp');
  const type = one('type');
  return {
    side: side === 'T' || side === 'CT' ? side : null,
    type: type && (GRENADES as string[]).includes(type) ? (type as Grenade) : null,
    zone: one('zone')?.slice(0, 40) ?? null,
    q: (one('q') ?? '').slice(0, 60),
  };
}

export function filtersToQuery(f: StuffFilters): string {
  const p = new URLSearchParams();
  if (f.side) p.set('camp', f.side);
  if (f.type) p.set('type', f.type);
  if (f.zone) p.set('zone', f.zone);
  if (f.q.trim()) p.set('q', f.q.trim());
  const s = p.toString();
  return s ? `?${s}` : '';
}

export type CatalogMode = 'bibliotheque' | 'carte';

export function parseMode(sp: Record<string, string | string[] | undefined>): CatalogMode {
  return sp.vue === 'carte' ? 'carte' : 'bibliotheque';
}

/** Requête d'URL du catalogue : filtres + mode (la carte tactique se rouvre au retour d'une fiche). */
export function catalogQuery(f: StuffFilters, mode: CatalogMode): string {
  const q = filtersToQuery(f);
  if (mode !== 'carte') return q;
  return q ? `${q}&vue=carte` : '?vue=carte';
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function applyFilters<T extends Utility>(items: T[], f: StuffFilters): T[] {
  const needle = norm(f.q.trim());
  return items.filter(
    (u) =>
      (!f.side || u.side === f.side || u.side === 'BOTH') &&
      (!f.type || u.grenade === f.type) &&
      (!f.zone || u.zone === f.zone) &&
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
