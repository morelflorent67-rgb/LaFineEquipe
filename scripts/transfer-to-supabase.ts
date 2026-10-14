/**
 * Transfert UNIQUE des vraies données de la base locale (.data/pglite) vers le projet Supabase.
 *   npm run transfer            → essai à blanc : compte ce qui serait copié, n'écrit rien
 *   npm run transfer -- --apply → copie réellement (relançable : les lignes déjà présentes sont mises à jour)
 *
 * Prérequis : migrations déjà appliquées sur Supabase, NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY
 * dans .env.local, et `npm run dev` ARRÊTÉ (la base locale n'accepte qu'un processus).
 *
 * Copié : profils FACEIT, roster (ELO et date d'ajout), relevés ELO, matchs et stats, Banlist (+ notes),
 * maps (images, ordre, visibilité), positions tactiques, stuffs, crosshairs, clips, et les images de
 * .data/media vers le bucket « stuff-media ». Jamais copié : données de démo, comptes, historique de synchro.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import nextEnv from '@next/env';
import { PGlite } from '@electric-sql/pglite';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd());

const APPLY = process.argv.includes('--apply');
const LOCAL_DIR = path.join(process.cwd(), '.data', 'pglite');
const MEDIA_DIR = path.join(process.cwd(), '.data', 'media');
const BUCKET = 'stuff-media';
/** Colonnes pointant vers des comptes locaux, inexistants sur Supabase. */
const ACCOUNT_COLUMNS = ['created_by', 'added_by', 'updated_by', 'reported_by'];

type Row = Record<string, unknown>;

function clean(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = ACCOUNT_COLUMNS.includes(k) ? null : v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

async function localRows(pg: PGlite, sql: string): Promise<Row[]> {
  return (await pg.query<Row>(sql)).rows.map(clean);
}

async function upsert(sb: SupabaseClient, table: string, rows: Row[], onConflict: string) {
  console.log(`${APPLY ? 'copie' : 'à copier'} · ${table.padEnd(26)} ${rows.length}`);
  if (!APPLY) return;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table} : ${error.message}`);
  }
}

async function listMedia(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await listMedia(path.join(dir, entry.name), rel)));
    else out.push(rel);
  }
  return out;
}

const CONTENT_TYPES: Record<string, string> = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

async function devServerRunning(): Promise<boolean> {
  try {
    await fetch('http://localhost:3000', { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error('Renseigne NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY dans .env.local.');
  if (await devServerRunning()) throw new Error('Arrête d’abord `npm run dev` : la base locale n’accepte qu’un processus.');

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: probe } = await sb.from('maps').select('slug').limit(1);
  if (probe) throw new Error(`Supabase inaccessible ou migrations absentes : ${probe.message}`);

  const pg = new PGlite(LOCAL_DIR);
  await pg.waitReady;
  console.log(APPLY ? 'Transfert réel vers Supabase…' : 'Essai à blanc (rien n’est écrit). Ajoute --apply pour copier.');

  try {
    // Maps : les migrations en créent déjà sur Supabase, avec d'autres identifiants → correspondance par slug.
    const localMaps = await localRows(pg, 'select * from public.maps order by sort_order');
    const { data: remoteMaps, error: mapsErr } = await sb.from('maps').select('id, slug');
    if (mapsErr) throw new Error(`maps : ${mapsErr.message}`);
    const remoteBySlug = new Map((remoteMaps ?? []).map((m) => [m.slug as string, m.id as string]));
    const mapId = new Map<string, string>();
    for (const m of localMaps) mapId.set(m.id as string, remoteBySlug.get(m.slug as string) ?? (m.id as string));
    await upsert(sb, 'maps', localMaps.map((m) => ({ ...m, id: mapId.get(m.id as string) })), 'id');
    const remap = (row: Row, col: string) => (row[col] ? { ...row, [col]: mapId.get(row[col] as string) ?? null } : row);

    const profiles = await localRows(pg, 'select * from public.faceit_profiles where not is_demo');
    await upsert(sb, 'faceit_profiles', profiles, 'faceit_player_id');
    await upsert(sb, 'players', await localRows(pg, 'select * from public.players where not is_demo'), 'id');

    // Relevés ELO : identifiant généré par la base, donc copiés seulement pour un profil qui n'en a aucun en ligne.
    const { data: existing, error: snapErr } = await sb.from('elo_snapshots').select('faceit_player_id');
    if (snapErr) throw new Error(`elo_snapshots : ${snapErr.message}`);
    const already = new Set((existing ?? []).map((s) => s.faceit_player_id as string));
    const snapshots = (
      await localRows(
        pg,
        `select s.faceit_player_id, s.elo, s.skill_level, s.measured_at, s.source
           from public.elo_snapshots s join public.faceit_profiles fp using (faceit_player_id)
          where not fp.is_demo order by s.measured_at`,
      )
    ).filter((s) => !already.has(s.faceit_player_id as string));
    console.log(`${APPLY ? 'copie' : 'à copier'} · ${'elo_snapshots'.padEnd(26)} ${snapshots.length}`);
    if (APPLY) {
      for (let i = 0; i < snapshots.length; i += 500) {
        const { error } = await sb.from('elo_snapshots').insert(snapshots.slice(i, i + 500));
        if (error) throw new Error(`elo_snapshots : ${error.message}`);
      }
    }

    await upsert(sb, 'matches', await localRows(pg, 'select * from public.matches where not is_demo'), 'id');
    await upsert(
      sb,
      'match_players',
      await localRows(pg, 'select mp.* from public.match_players mp join public.matches m on m.id = mp.match_id where not m.is_demo'),
      'match_id,player_id',
    );
    await upsert(
      sb,
      'match_player_stats',
      await localRows(pg, 'select s.* from public.match_player_stats s join public.matches m on m.id = s.match_id where not m.is_demo'),
      'match_id,player_id',
    );

    await upsert(sb, 'avoid_list_entries', await localRows(pg, 'select * from public.avoid_list_entries where not is_demo'), 'id');
    await upsert(
      sb,
      'avoid_list_private_notes',
      await localRows(pg, 'select n.* from public.avoid_list_private_notes n join public.avoid_list_entries a on a.id = n.entry_id where not a.is_demo'),
      'entry_id',
    );

    await upsert(sb, 'map_positions', (await localRows(pg, 'select * from public.map_positions')).map((r) => remap(r, 'map_id')), 'id');
    await upsert(sb, 'utilities', (await localRows(pg, 'select * from public.utilities where not is_demo')).map((r) => remap(r, 'map_id')), 'id');
    await upsert(
      sb,
      'crosshairs',
      (await localRows(pg, 'select * from public.crosshairs where not is_demo')).map((r) => remap(r, 'preview_map_id')),
      'id',
    );
    await upsert(sb, 'clips', (await localRows(pg, 'select * from public.clips where not is_demo')).map((r) => remap(r, 'map_id')), 'id');

    const files = await listMedia(MEDIA_DIR);
    console.log(`${APPLY ? 'envoi' : 'à envoyer'} · ${'images (stuff-media)'.padEnd(26)} ${files.length}`);
    if (APPLY) {
      for (const rel of files) {
        const type = CONTENT_TYPES[path.extname(rel).toLowerCase()];
        if (!type) continue;
        const bytes = await readFile(path.join(MEDIA_DIR, ...rel.split('/')));
        const { error } = await sb.storage.from(BUCKET).upload(rel, bytes, { contentType: type, upsert: true });
        if (error) throw new Error(`image ${rel} : ${error.message}`);
      }
    }
    console.log(APPLY ? 'Transfert terminé.' : 'Essai terminé : rien n’a été écrit.');
  } finally {
    await pg.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
