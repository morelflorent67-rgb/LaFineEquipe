import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import presets from './pro-crosshairs.json';
import { isShareCode } from './crosshairs';

describe('visuels sourcés des pros', () => {
  it('conserve dix codes distincts avec un PNG local lié au hash du code', () => {
    expect(presets).toHaveLength(10);
    expect(new Set(presets.map((p) => p.code)).size).toBe(10);
    for (const p of presets) {
      expect(isShareCode(p.code)).toBe(true);
      const hash = createHash('sha256').update(p.code).digest('hex').slice(0, 12);
      expect(p.image).toMatch(new RegExp(`^/crosshairs/pro/[a-z0-9]+-${hash}\\.png$`));
      expect(new URL(p.source).origin).toBe('https://crosshair.club');
      const png = readFileSync(join(process.cwd(), 'public', p.image));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(132);
      expect(png.readUInt32BE(20)).toBe(132);
    }
  });
});
