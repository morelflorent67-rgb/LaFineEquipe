import { describe, expect, it } from 'vitest';
import { crosshairStatus, isShareCode, normalizeShareCode, previewRects } from './crosshairs';

describe('crosshairs', () => {
  it('contrôle la forme du code de partage sans rien supposer de plus', () => {
    expect(isShareCode('CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ')).toBe(true);
    expect(isShareCode('CSGO-ABCDE-FGHJK-LMNOP-QRSTU')).toBe(false);
    expect(isShareCode('CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXY1')).toBe(false); // « 1 » hors alphabet
    expect(isShareCode('CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ-AAAAA')).toBe(false);
  });

  it('nettoie un code collé (espaces, retour à la ligne, préfixe en minuscules) sans changer la casse', () => {
    expect(normalizeShareCode('  csgo-abcde-FGHJK-LMNOP-QRSTU-VWXYZ\n')).toBe('CSGO-abcde-FGHJK-LMNOP-QRSTU-VWXYZ');
    expect(normalizeShareCode('CSGO-ABCDE -FGHJK-LMNOP-QRSTU-VWXYZ')).toBe('CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ');
  });

  it('à revérifier si validé avant la mise à jour du 30/09/2026, ou jamais validé', () => {
    expect(crosshairStatus(null)).toBe('never');
    expect(crosshairStatus('2026-09-29')).toBe('stale');
    expect(crosshairStatus('2026-09-30')).toBe('ok');
    expect(crosshairStatus('2026-10-04')).toBe('ok');
  });

  it('aperçu : 4 branches symétriques, point central optionnel, contour autour de chaque élément', () => {
    const base = { len: 3, gap: 1, thickness: 1, outline: 1, dot: false, color: '#FFFFFF' };
    const a = previewRects(base, 120);
    expect(a.fill).toHaveLength(4);
    expect(a.outline).toHaveLength(4);
    const [top, bottom] = a.fill;
    expect(top!.x).toBeCloseTo(bottom!.x);
    expect(60 - (top!.y + top!.h)).toBeCloseTo(bottom!.y - 60); // même écart au centre
    expect(previewRects({ ...base, dot: true }, 120).fill).toHaveLength(5);
    expect(previewRects({ ...base, len: 0, dot: true }, 120).fill).toHaveLength(1);
    expect(previewRects({ ...base, outline: 0 }, 120).outline).toHaveLength(0);
  });
});
