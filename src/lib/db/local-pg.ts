import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { RPC_NAME, type RpcArgs } from './types';
import { toDbError } from './errors';

/**
 * Base PostgreSQL embarquée (PGlite) pour le développement local et les tests.
 * Elle exécute EXACTEMENT les mêmes migrations que Supabase, précédées d'une petite
 * émulation de l'environnement Supabase (rôles anon/authenticated, auth.uid()).
 * Les règles d'accès (RLS) s'appliquent donc aussi en local.
 */

export type PgRole = 'anon' | 'authenticated' | 'service_role';
export type LocalIdentity = { pgRole: PgRole; userId: string | null };

const ROOT = process.cwd();
const SHIM = path.join(ROOT, 'supabase', 'local', 'shim.sql');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const ACCOUNTS = path.join(ROOT, 'supabase', 'local', 'accounts.sql');
// Base locale de développement uniquement (refusée en production) : rien à embarquer au déploiement.
export const LOCAL_DATA_DIR = process.env.LFE_LOCAL_DATA_DIR
  ? path.resolve(/*turbopackIgnore: true*/ ROOT, process.env.LFE_LOCAL_DATA_DIR)
  : path.join(ROOT, '.data', 'pglite');

async function migrationFiles(): Promise<{ name: string; file: string }[]> {
  const names = (await readdir(MIGRATIONS_DIR)).filter((n) => n.endsWith('.sql')).sort();
  return [
    { name: '00000000000000_local_shim', file: SHIM },
    ...names.map((n) => ({ name: n.replace(/\.sql$/, ''), file: path.join(MIGRATIONS_DIR, n) })),
    { name: '99999999999999_local_accounts', file: ACCOUNTS },
  ];
}

/** Applique les migrations manquantes (suivi dans lfe_local.migrations). */
export async function applyMigrations(pg: PGlite): Promise<string[]> {
  await pg.exec(`
    create schema if not exists lfe_local;
    create table if not exists lfe_local.migrations (name text primary key, applied_at timestamptz not null default now());
  `);
  const done = new Set((await pg.query<{ name: string }>('select name from lfe_local.migrations')).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const m of await migrationFiles()) {
    if (done.has(m.name)) continue;
    const sql = await readFile(m.file, 'utf8');
    await pg.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('insert into lfe_local.migrations (name) values ($1)', [m.name]);
    });
    applied.push(m.name);
  }
  return applied;
}

/** Ouvre une base (dossier = persistante, sinon en mémoire) et la met à jour. */
export async function openLocalPg(dataDir?: string): Promise<PGlite> {
  if (dataDir) await mkdir(path.dirname(dataDir), { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  await applyMigrations(pg);
  return pg;
}

declare global {
  var __lfeLocalPg: Promise<PGlite> | undefined;
  var __lfeLocalPgChecked: number | undefined;
}

/**
 * Instance unique pour le serveur de développement (survit au rechargement à chaud).
 * Les nouvelles migrations ajoutées pendant que le serveur tourne sont appliquées automatiquement.
 */
export async function getLocalPg(): Promise<PGlite> {
  if (!globalThis.__lfeLocalPg) {
    globalThis.__lfeLocalPgChecked = Date.now();
    globalThis.__lfeLocalPg = openLocalPg(LOCAL_DATA_DIR).catch((err: unknown) => {
      globalThis.__lfeLocalPg = undefined;
      throw err;
    });
    return globalThis.__lfeLocalPg;
  }
  const pg = await globalThis.__lfeLocalPg;
  if (Date.now() - (globalThis.__lfeLocalPgChecked ?? 0) > 3000) {
    globalThis.__lfeLocalPgChecked = Date.now();
    await applyMigrations(pg);
  }
  return pg;
}

function toParam(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'string')) {
      return `{${value.map((v) => `"${String(v).replace(/(["\\])/g, '\\$1')}"`).join(',')}}`;
    }
    return JSON.stringify(value);
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value);
  return value;
}

/**
 * Appelle `public.<fn>(arg => valeur, …)` avec l'identité donnée, comme le ferait
 * l'API Supabase : rôle Postgres + identifiant utilisateur dans `request.jwt.claim.sub`.
 */
export async function localRpc(pg: PGlite, who: LocalIdentity, fn: string, args: RpcArgs = {}): Promise<unknown> {
  if (!RPC_NAME.test(fn)) throw new Error(`Nom de fonction invalide : ${fn}`);
  const keys = Object.keys(args).filter((k) => args[k] !== undefined);
  for (const k of keys) if (!RPC_NAME.test(k)) throw new Error(`Nom d'argument invalide : ${k}`);
  const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as result`;
  try {
    return await pg.transaction(async (tx) => {
      await tx.query(`select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [
        who.pgRole,
        who.userId ?? '',
      ]);
      const res = await tx.query<{ result: unknown }>(sql, keys.map((k) => toParam(args[k])));
      const value = res.rows[0]?.result;
      return value === '' || value === undefined ? null : value;
    });
  } catch (err) {
    throw toDbError(err);
  }
}
