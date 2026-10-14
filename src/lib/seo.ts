import 'server-only';
import type { Metadata, MetadataRoute } from 'next';

export const SITE_DESCRIPTION =
  'Le QG de LaFineEquipe : classement ELO FACEIT, matchs, clips, crosshairs et stuffs Counter-Strike 2.';
export const PUBLIC_PATHS = [
  '/',
  '/elo-run',
  '/matches',
  '/clips',
  '/crosshairs',
  '/stuffs',
  '/team',
] as const;

type SeoEnvironment = Partial<Record<'SITE_URL' | 'NODE_ENV' | 'VERCEL_ENV' | 'CONTEXT' | 'LFE_DATA_BACKEND' | 'FACEIT_MODE', string>>;

/** Pas d'URL absolue inventée ; le propriétaire configure son origine publique dans SITE_URL. */
export function seoConfig(env: SeoEnvironment = process.env) {
  let origin: string | null = null;
  try {
    const url = new URL(env.SITE_URL?.trim() ?? '');
    const host = url.hostname.toLowerCase();
    const local =
      host === 'localhost' ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.test') ||
      host.includes(':') ||
      /^[\d.]+$/.test(host);
    if (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      host.includes('.') &&
      !local
    )
      origin = url.origin;
  } catch {
    /* Une adresse absente ou invalide n'empêche pas le développement local. */
  }
  const indexable =
    origin !== null &&
    env.NODE_ENV === 'production' &&
    env.LFE_DATA_BACKEND === 'supabase' &&
    env.FACEIT_MODE !== 'fixtures' &&
    (!env.VERCEL_ENV || env.VERCEL_ENV === 'production') &&
    // Netlify : seules les mises en production sont indexables (pas les aperçus de branche).
    (!env.CONTEXT || env.CONTEXT === 'production');
  return { origin, indexable };
}

/** Métadonnées publiques : les filtres sont volontairement absents de l'URL canonique. */
export function publicMetadata(title: string, description: string, path: string, visible = true): Metadata {
  const { origin, indexable } = seoConfig();
  const url = origin && visible ? `${origin}${path}` : undefined;
  const fullTitle = title === 'LaFineEquipe' ? title : `${title} · LaFineEquipe`;
  const images = origin
    ? [{ url: `${origin}/brand/lfe-emblem.webp`, alt: 'Logo original LaFineEquipe' }]
    : undefined;
  return {
    title: { absolute: fullTitle },
    description,
    robots: { index: indexable && visible, follow: indexable && visible },
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      siteName: 'LaFineEquipe',
      title: fullTitle,
      description,
      url,
      images,
    },
    twitter: { card: 'summary', title: fullTitle, description, images },
  };
}

export function robotsMetadata(config = seoConfig()): MetadataRoute.Robots {
  if (!config.indexable || !config.origin) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/connexion', '/mur-des-lamentations', '/api/'],
    },
    sitemap: `${config.origin}/sitemap.xml`,
  };
}

/** Liste explicite : aucun compte, brouillon ou contenu du Mur n'est interrogé pour le sitemap. */
export function sitemapMetadata(config = seoConfig()): MetadataRoute.Sitemap {
  return config.indexable && config.origin
    ? PUBLIC_PATHS.map((path) => ({ url: `${config.origin}${path}` }))
    : [];
}
