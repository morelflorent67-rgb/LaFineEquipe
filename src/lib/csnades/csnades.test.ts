import { describe, expect, it } from 'vitest';
import { flightText, objectAt, parseVtt } from './parse';
import { legacyTechnique, splitTechnique, toImportItem, toPoint } from './normalize';
import { parseMapPage, parseNadePage, type CsListNade } from './source';

const A = 'https://assets.csnades.gg/nades/mirage-smoke-AbC123/';
const assets = {
  id: 'mirage-smoke-AbC123',
  videoHq: { webm: `${A}hq.webm`, mp4: `${A}hq.mp4` },
  videoLq: { webm: `${A}lq.webm`, mp4: `${A}lq.mp4` },
  thumbnail: `${A}thumbnail.webp`,
  thumbnailSmall: `${A}thumbnail_small.webp`,
  lineup: `${A}lineup.webp`,
};
const listNade: CsListNade = {
  id: 'nade_f3a397f1e923',
  slug: 'b-short-from-back-alley',
  assets,
  team: 't',
  type: 'smoke',
  technique: 'left_jump',
  movement: 'running',
  precision: 'precise',
  throwFrom: { x: 519, y: 130, levels: [1] },
  titleFrom: 'Back Alley',
  throwTo: { x: 95, y: 137, levels: null },
  titleTo: 'B Short',
  bounces: [{ x: 444, y: 100, levels: [null] }],
  beginner: true,
};

/** Page factice au format de leurs pages : le flux RSC découpé en plusieurs push. */
function page(payload: string): string {
  const half = Math.floor(payload.length / 2);
  return [payload.slice(0, half), payload.slice(half)]
    .map((part) => `<script>self.__next_f.push([1,${JSON.stringify(part)}])</script>`)
    .join('');
}

describe('csnades · lecture des pages', () => {
  it('recolle le flux RSC et extrait un objet en ignorant les accolades dans les chaînes', () => {
    const html = page('x:{"a":"} { [","b":[1,{"c":2}]}tail');
    const text = flightText(html);
    expect(objectAt(text, text.indexOf('{'))).toEqual({ a: '} { [', b: [1, { c: 2 }] });
  });

  it('lit la map, ses vues aériennes et ses stuffs (sans doublon)', () => {
    const map = {
      name: 'Mirage',
      slug: 'mirage',
      radars: [{ type: 'game', image: { url: 'https://assets.csnades.gg/mirage_game_radar.webp', width: 1374, height: 1196 }, callouts: null, level: 1 }],
    };
    const html = page(`1:{"map":${JSON.stringify(map)},"nades":[${JSON.stringify(listNade)},${JSON.stringify(listNade)}]}`);
    const parsed = parseMapPage(html);
    expect(parsed.map.radars[0]!.image.width).toBe(1374);
    expect(parsed.nades).toHaveLength(1);
  });

  it('refuse un média hors assets.csnades.gg', () => {
    const bad = { ...listNade, assets: { ...assets, thumbnail: 'https://evil.example/x.webp' } };
    const map = { name: 'Mirage', slug: 'mirage', radars: [] };
    expect(() => parseMapPage(page(`{"map":${JSON.stringify(map)},"n":[${JSON.stringify(bad)}]}`))).toThrow();
  });

  it('lit la fiche détaillée demandée et pas un « stuff similaire »', () => {
    const detail = (uid: string, desc: string) => ({
      uid, slug: 's', titleTo: 'B Short', titleFrom: 'Back Alley', assets, description: desc, console: null,
      team: 't', type: 'smoke', movement: 'running', technique: 'left', precision: 'precise', attribution: '',
      videoVtt: 'WEBVTT', publishedAt: '$D2023-09-02T18:21:06.055Z', updatedAt: '$D2024-06-16T07:00:55.913Z', aliases: [],
    });
    const html = page(`{"nade":${JSON.stringify(detail('nade_aaaaaa', 'autre'))}}{"nade":${JSON.stringify(detail('nade_bbbbbb', 'la bonne'))}}`);
    const d = parseNadePage(html, 'nade_bbbbbb');
    expect(d.description).toBe('la bonne');
    expect(d.updatedAt).toBe('2024-06-16T07:00:55.913Z');
  });

  it('lit les sous-titres WebVTT (début en secondes + texte)', () => {
    const vtt = 'WEBVTT\n\n1\n00:00:00.583 --> 00:00:02.600\nStand in corner\n\n2\n00:00:07.316 --> 00:00:09.566\nLeft click throw\n\n';
    expect(parseVtt(vtt)).toEqual([
      { start: 0.58, text: 'Stand in corner' },
      { start: 7.32, text: 'Left click throw' },
    ]);
  });
});

describe('csnades · conversion', () => {
  it('convertit la grille 0–1000 en % et garde l’étage (1 par défaut)', () => {
    expect(toPoint({ x: 535, y: 863, levels: [1] })).toEqual({ x: 53.5, y: 86.3, level: 1 });
    expect(toPoint({ x: 1004, y: -3, levels: [2] })).toEqual({ x: 100, y: 0, level: 2 });
    expect(toPoint({ x: 1, y: 1, levels: [null] }).level).toBe(1);
  });

  it('sépare clic et saut, et refuse une technique inconnue', () => {
    expect(splitTechnique('left_jump')).toEqual({ click: 'left', jump: true });
    expect(splitTechnique('both')).toEqual({ click: 'both', jump: false });
    expect(() => splitTechnique('middle')).toThrow(/inconnue/);
    expect(legacyTechnique('running', true)).toBe('run_jumpthrow');
    expect(legacyTechnique('stationary', false)).toBe('static');
  });

  it('construit un stuff complet, traduit les étapes et signale celles sans traduction', () => {
    const missing = new Set<string>();
    const detail = {
      uid: listNade.id, slug: listNade.slug, titleTo: 'B Short', titleFrom: 'Back Alley', assets,
      timings: { popTime: 14.7, throwTime: 7.8, airTime: 6.9 }, description: '$undefined',
      console: 'setpos -160.031250 887.970276 -71.648178;setang -45.790627 -134.498291 0.000000',
      team: 't', type: 'smoke', movement: 'running', technique: 'left_jump', precision: 'precise', attribution: '',
      videoVtt: 'WEBVTT\n\n1\n00:00:00.583 --> 00:00:02.600\nStand in corner\n\n2\n00:00:04.433 --> 00:00:06.583\nAim at antenna\n',
      publishedAt: '2023-09-02T18:21:06.055Z', updatedAt: null, aliases: [],
    };
    const item = toImportItem('mirage', 'smokes', listNade, detail, { 'Stand in corner': 'Se placer dans le coin' }, missing);
    expect(item).toMatchObject({
      slug: 'smoke-b-short-from-back-alley',
      title: 'B Short depuis Back Alley',
      side: 'T',
      grenade: 'smoke',
      technique: 'run_jumpthrow',
      difficulty: 'easy',
      description: null,
      steps: ['Se placer dans le coin', 'Aim at antenna'],
      stepTimes: [0.58, 4.43],
      throw: { x: 51.9, y: 13, level: 1 },
      landing: { x: 9.5, y: 13.7, level: 1 },
      airTime: 6.9,
      sourceUrl: 'https://csnades.gg/mirage/smokes/b-short-from-back-alley',
      sourceUpdatedAt: '2023-09-02T18:21:06.055Z',
      credit: null,
    });
    expect(item.consoleCmd).toMatch(/^setpos /);
    expect([...missing]).toEqual(['Aim at antenna']);
  });

  it('ignore une commande console qui n’en est pas une', () => {
    const detail = {
      uid: listNade.id, slug: listNade.slug, titleTo: 'B', titleFrom: 'A', assets, console: 'https://exemple.com/dossier/',
      team: 't', type: 'smoke', movement: 'running', technique: 'left', precision: 'precise',
      publishedAt: null, updatedAt: null,
    };
    expect(toImportItem('mirage', 'smokes', { ...listNade, beginner: false }, detail, {}, new Set()).consoleCmd).toBeNull();
  });
});
