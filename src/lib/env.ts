import 'server-only';
import { z } from 'zod';

/**
 * Configuration serveur validée au démarrage. Les clés secrètes ne quittent jamais ce module
 * vers le navigateur : seules les variables préfixées NEXT_PUBLIC_ sont publiques.
 */
const raw = z.object({
  LFE_DATA_BACKEND: z.enum(['local', 'supabase'], {
    error: 'LFE_DATA_BACKEND doit valoir « local » ou « supabase » (voir .env.example).',
  }),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  FACEIT_API_KEY: z.string().optional(),
  FACEIT_MODE: z.enum(['live', 'fixtures']).default('live'),
  CRON_SECRET: z.string().optional(),
  SITE_URL: z.string().optional(),
  LFE_ADMIN_EMAIL: z.string().optional(),
});

export type ServerEnv = {
  backend: 'local' | 'supabase';
  supabase: { url: string; publishableKey: string; secretKey: string | null } | null;
  faceit: { apiKey: string | null; mode: 'live' | 'fixtures' };
  cronSecret: string | null;
  siteUrl: string;
  /** E-mail Supabase du compte unique « admin » (la connexion se fait avec l'identifiant admin). */
  adminEmail: string | null;
};

export class ConfigError extends Error {
  override name = 'ConfigError';
}

let cached: ServerEnv | null = null;

const blank = (v: string | undefined) => (v && v.trim() !== '' ? v.trim() : null);

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = raw.safeParse(process.env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => i.message).join(' '));
  }
  const e = parsed.data;
  // Hébergement en ligne (Netlify, ou Vercel par le passé) : interdit les modes de développement.
  const hosted = Boolean(process.env.NETLIFY || process.env.VERCEL);

  if (e.LFE_DATA_BACKEND === 'local' && hosted) {
    throw new ConfigError('Le mode de données « local » est réservé au développement : utilise « supabase » en ligne.');
  }
  if (e.FACEIT_MODE === 'fixtures' && (hosted || e.LFE_DATA_BACKEND === 'supabase')) {
    throw new ConfigError('FACEIT_MODE=fixtures (profils fictifs) est interdit avec Supabase ou en production.');
  }

  let supabase: ServerEnv['supabase'] = null;
  if (e.LFE_DATA_BACKEND === 'supabase') {
    const url = blank(e.NEXT_PUBLIC_SUPABASE_URL);
    const publishableKey = blank(e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    if (!url || !publishableKey) {
      throw new ConfigError(
        'Mode « supabase » : renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans .env.local.',
      );
    }
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && !url.startsWith('http://127.0.0.1')) {
      throw new ConfigError('NEXT_PUBLIC_SUPABASE_URL doit ressembler à https://xxxx.supabase.co');
    }
    supabase = { url: url.replace(/\/$/, ''), publishableKey, secretKey: blank(e.SUPABASE_SECRET_KEY) };
  }

  cached = {
    backend: e.LFE_DATA_BACKEND,
    supabase,
    faceit: { apiKey: blank(e.FACEIT_API_KEY), mode: e.FACEIT_MODE },
    cronSecret: blank(e.CRON_SECRET),
    siteUrl: blank(e.SITE_URL) ?? 'http://localhost:3000',
    adminEmail: blank(e.LFE_ADMIN_EMAIL)?.toLowerCase() ?? null,
  };
  return cached;
}

/** Pour les tests uniquement. */
export function resetServerEnvCache() {
  cached = null;
}
