import type { CrosshairPreview } from '@/lib/domain/schemas';

/**
 * Forme d'un code de partage CS2 : « CSGO- » puis 5 blocs de 5 caractères (alphabet sans
 * 0, 1, I, l ni g). Contrôle de forme uniquement : l'import en jeu n'est jamais garanti.
 * Même règle que la contrainte SQL (migration 1100).
 */
export const SHARE_CODE = /^CSGO(-[ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789]{5}){5}$/;
/** Codes CS… observés après septembre 2026 : chaîne opaque alphanumérique bornée.
 * Ce contrôle de saisie n'est PAS un décodeur ni une validation du contenu binaire.
 * Voir docs/crosshairs-pro.md ; les anciens codes restent stockables sans conversion.
 */
export const MODERN_SHARE_CODE = /^CS[A-Za-z0-9]{38,126}$/;

/** Mises à jour CS2 des 22–30/09/2026 : réglages et codes de partage modifiés. */
export const CODES_CHANGED_ON = '2026-09-30';

/** Nettoie un code collé (espaces, retours à la ligne, préfixe en minuscules) sans toucher à la casse du reste. */
export function normalizeShareCode(input: string): string {
  const s = input.replace(/\s+/g, '');
  return /^csgo-/i.test(s) ? `CSGO-${s.slice(5)}` : s;
}

export function isShareCode(input: string): boolean {
  return SHARE_CODE.test(input) || MODERN_SHARE_CODE.test(input);
}

/** Validé après la mise à jour = à jour ; avant = à revérifier ; jamais = non vérifié. */
export function crosshairStatus(verifiedAt: string | null): 'ok' | 'stale' | 'never' {
  if (!verifiedAt) return 'never';
  return verifiedAt.slice(0, 10) >= CODES_CHANGED_ON ? 'ok' : 'stale';
}

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Géométrie de l'aperçu INDICATIF (carré de `size`) : 4 branches, point central, contour.
 * Échelle arbitraire : ce n'est pas le rendu du moteur CS2.
 */
export function previewRects(p: CrosshairPreview, size: number): { outline: Rect[]; fill: Rect[] } {
  const c = size / 2;
  const u = size / 40;
  const len = p.len * u * 1.6;
  const gap = (p.gap + 2) * u;
  const th = Math.max(1, p.thickness * u * 0.7);
  const ol = p.outline * u * 0.5;
  const bars: Rect[] = len
    ? [
        { x: c - th / 2, y: c - gap - len, w: th, h: len },
        { x: c - th / 2, y: c + gap, w: th, h: len },
        { x: c - gap - len, y: c - th / 2, w: len, h: th },
        { x: c + gap, y: c - th / 2, w: len, h: th },
      ]
    : [];
  const fill = p.dot ? [...bars, { x: c - th / 2, y: c - th / 2, w: th, h: th }] : bars;
  const outline = ol > 0 ? fill.map((r) => ({ x: r.x - ol, y: r.y - ol, w: r.w + 2 * ol, h: r.h + 2 * ol })) : [];
  return { outline, fill };
}
