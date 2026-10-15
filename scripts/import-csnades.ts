/**
 * Import des stuffs csnades.gg (accord écrit de csnades : voir docs/csnades-import.md).
 *
 *   npm run csnades -- fetch              → télécharge les pages des 8 maps dans .data/csnades (cache)
 *   npm run csnades -- fetch --maps nuke  → une seule map (liste séparée par des virgules)
 *   npm run csnades -- fetch --refresh    → ignore le cache et retélécharge tout
 *   npm run csnades -- analyze            → valeurs rencontrées + étapes encore sans traduction
 *   npm run csnades -- import             → essai à blanc depuis le cache : compte, vérifie, n'écrit rien
 *   npm run csnades -- import --apply     → écrit dans la base configurée (.env.local : locale ou Supabase)
 *
 * Pour tester sur une base locale séparée sans toucher à Supabase :
 *   LFE_DATA_BACKEND=local LFE_LOCAL_DATA_DIR=.data/pglite-csnades npm run csnades -- import --apply
 *
 * Le téléchargement est volontairement lent (une page par seconde) et s'identifie clairement.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nextEnv from '@next/env';
import {
  CS_TYPE_PATHS,
  csMapPageUrl,
  csNadePageUrl,
  parseMapPage,
  parseNadePage,
  type CsDetailNade,
  type CsListNade,
  type CsMap,
  type CsTypePath,
} from '../src/lib/csnades/source';
import { parseVtt } from '../src/lib/csnades/parse';
import { toImportItem, toRadars, type ImportItem, type Translations } from '../src/lib/csnades/normalize';

nextEnv.loadEnvConfig(process.cwd());

const CACHE = path.join(process.cwd(), '.data', 'csnades');
const DEFAULT_MAPS = ['mirage', 'inferno', 'dust2', 'ancient', 'nuke', 'anubis', 'overpass', 'train'];
const USER_AGENT = 'LaFineEquipe-import/1.0 (+https://fineequipe.com; import autorisé par csnades)';
const DELAY_MS = 1000;

export type CachedMap = { map: CsMap; fetchedAt: string; types: Record<CsTypePath, CsListNade[]> };

const args = process.argv.slice(2);
const command = args[0];
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const maps = (option('maps')?.split(',') ?? DEFAULT_MAPS).map((s) => s.trim()).filter(Boolean);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastFetch = 0;

async function get(url: string): Promise<string> {
  const wait = lastFetch + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastFetch = Date.now();
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
    if (res.ok) return res.text();
    if (attempt >= 3 || (res.status < 500 && res.status !== 429)) throw new Error(`${url} → HTTP ${res.status}`);
    await sleep(5000 * attempt);
  }
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 1));
}

export function mapCacheFile(slug: string) {
  return path.join(CACHE, slug, 'map.json');
}
export function nadeCacheFile(slug: string, uid: string) {
  return path.join(CACHE, slug, 'nades', `${uid}.json`);
}

async function fetchMap(slug: string) {
  const refresh = flag('refresh');
  let cached = refresh ? null : await readJson<CachedMap>(mapCacheFile(slug));
  if (!cached) {
    const types = {} as Record<CsTypePath, CsListNade[]>;
    let map: CsMap | null = null;
    for (const t of CS_TYPE_PATHS) {
      const page = parseMapPage(await get(csMapPageUrl(slug, t)));
      if (page.map.slug !== slug) throw new Error(`${slug} : la page renvoie la map ${page.map.slug}`);
      map = page.map;
      types[t] = page.nades;
    }
    cached = { map: map!, fetchedAt: new Date().toISOString(), types };
    await writeJson(mapCacheFile(slug), cached);
  }
  const total = CS_TYPE_PATHS.reduce((n, t) => n + cached.types[t].length, 0);
  console.log(`${slug.padEnd(9)} ${total} stuffs (${CS_TYPE_PATHS.map((t) => `${t} ${cached.types[t].length}`).join(', ')})`);

  let fetched = 0;
  for (const t of CS_TYPE_PATHS) {
    for (const nade of cached.types[t]) {
      const file = nadeCacheFile(slug, nade.id);
      if (!refresh && (await readJson(file))) continue;
      const detail = parseNadePage(await get(csNadePageUrl(slug, t, nade.slug)), nade.id);
      await writeJson(file, detail);
      fetched++;
      if (fetched % 25 === 0) console.log(`  … ${fetched} fiches téléchargées`);
    }
  }
  console.log(`  ${fetched} fiche(s) téléchargée(s), les autres venaient du cache`);
}

async function analyze() {
  const values: Record<string, Map<string, number>> = {};
  const count = (key: string, v: unknown) => {
    const m = (values[key] ??= new Map());
    const k = JSON.stringify(v);
    m.set(k, (m.get(k) ?? 0) + 1);
  };
  const phrases = new Map<string, number>();
  const descriptions: string[] = [];
  let total = 0;
  for (const slug of maps) {
    const cached = await readJson<CachedMap>(mapCacheFile(slug));
    if (!cached) {
      console.log(`${slug} : pas encore téléchargée`);
      continue;
    }
    count('radars', cached.map.radars.map((r) => `${r.type}:${r.level}:${r.image.width}x${r.image.height}`).join(' | '));
    for (const t of CS_TYPE_PATHS) {
      for (const n of cached.types[t]) {
        total++;
        count('type', `${t}→${n.type}`);
        for (const k of ['team', 'technique', 'movement', 'precision'] as const) count(k, n[k]);
        count('levels', [n.throwFrom.levels, n.throwTo.levels]);
        count('bounces', n.bounces.length);
        const d = await readJson<CsDetailNade>(nadeCacheFile(slug, n.id));
        if (!d) {
          count('detail', 'absente');
          continue;
        }
        const cues = parseVtt(d.videoVtt ?? '');
        count('cues', cues.length);
        count('console', d.console ? /^setpos\s/.test(d.console) : null);
        count('attribution', d.attribution ? 'oui' : 'non');
        count('lineup', d.assets.lineup ? 'oui' : 'non');
        if (d.description?.trim()) descriptions.push(d.description.trim());
        for (const c of cues) phrases.set(c.text, (phrases.get(c.text) ?? 0) + 1);
      }
    }
  }
  console.log(`\n${total} stuffs`);
  for (const [key, m] of Object.entries(values)) {
    console.log(`\n${key}`);
    for (const [v, n] of [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(n).padStart(5)}  ${v}`);
  }
  console.log(`\n${phrases.size} étapes différentes, ${descriptions.length} descriptions non vides`);
  await writeJson(path.join(CACHE, 'phrases.json'), [...phrases.entries()].sort((a, b) => b[1] - a[1]));
  await writeJson(path.join(CACHE, 'descriptions.json'), descriptions);
}

const TRANSLATIONS = path.join(process.cwd(), 'src', 'lib', 'csnades', 'steps.fr.json');

async function importMaps() {
  const apply = flag('apply');
  const translations = (await readJson<Translations>(TRANSLATIONS)) ?? {};
  const missing = new Set<string>();
  const payloads: { mapSlug: string; radars: ReturnType<typeof toRadars>; items: ImportItem[] }[] = [];
  for (const slug of maps) {
    const cached = await readJson<CachedMap>(mapCacheFile(slug));
    if (!cached) throw new Error(`${slug} : lance d’abord « fetch »`);
    const items: ImportItem[] = [];
    let withoutDetail = 0;
    for (const t of CS_TYPE_PATHS) {
      for (const n of cached.types[t]) {
        const detail = await readJson<CsDetailNade>(nadeCacheFile(slug, n.id));
        if (!detail) withoutDetail++;
        items.push(toImportItem(slug, t, n, detail, translations, missing));
      }
    }
    const slugs = new Set(items.map((i) => i.slug));
    if (slugs.size !== items.length) throw new Error(`${slug} : identifiants d’URL en double`);
    payloads.push({ mapSlug: slug, radars: toRadars(cached.map), items });
    console.log(`${slug.padEnd(9)} ${items.length} stuffs, ${toRadars(cached.map).length} vue(s) aérienne(s)${withoutDetail ? `, ${withoutDetail} sans fiche détaillée` : ''}`);
  }
  const missingFile = path.join(CACHE, 'missing-translations.json');
  await rm(missingFile, { force: true });
  if (missing.size) {
    await writeJson(missingFile, [...missing]);
    console.log(`
${missing.size} étape(s) sans traduction (gardées en anglais) → .data/csnades/missing-translations.json`);
  }

  const backend = process.env.LFE_DATA_BACKEND === 'local' ? `locale (${process.env.LFE_LOCAL_DATA_DIR ?? '.data/pglite'})` : 'Supabase';
  if (!apply) {
    console.log(`
Essai à blanc : rien n’a été écrit. Base qui serait utilisée : ${backend}. Ajoute --apply pour importer.`);
    return;
  }
  console.log(`
Import dans la base ${backend}…`);
  const { getServiceDb } = await import('../src/lib/db');
  const db = getServiceDb();
  for (const p of payloads) {
    const r = (await db.rpc('import_csnades_map', { p })) as { inserted: number; updated: number; retired: number };
    console.log(`${p.mapSlug.padEnd(9)} ${r.inserted} ajouté(s), ${r.updated} mis à jour, ${r.retired} retiré(s)`);
  }

  // Relecture comme le site public : chaque map doit passer la validation Zod du catalogue.
  const { catalogSchema } = await import('../src/lib/domain/schemas');
  for (const p of payloads) {
    const catalog = catalogSchema.parse(await db.rpc('list_utilities', { p_map_slug: p.mapSlug, p_include_drafts: false }));
    const published = catalog?.utilities.filter((u) => u.source === 'csnades').length ?? 0;
    console.log(`vérifié   ${p.mapSlug.padEnd(9)} ${published} stuffs csnades publiés, ${catalog?.map.radars.length ?? 0} vue(s) aérienne(s)`);
  }
}

async function main() {
  if (command === 'fetch') {
    for (const slug of maps) await fetchMap(slug);
  } else if (command === 'analyze') {
    await analyze();
  } else if (command === 'import') {
    await importMaps();
  } else {
    console.log('Commandes : fetch | analyze | import (voir l’en-tête du script).');
    process.exit(1);
  }
}

// La base locale (PGlite) garde le processus ouvert : on sort explicitement une fois fini.
main().then(() => process.exit(0)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
