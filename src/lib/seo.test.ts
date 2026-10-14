import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicMetadata, robotsMetadata, seoConfig, sitemapMetadata } from './seo';

const production = {
  NODE_ENV: 'production',
  LFE_DATA_BACKEND: 'supabase',
  FACEIT_MODE: 'live',
  SITE_URL: 'https://lfe.example.com',
  VERCEL_ENV: 'production',
};
afterEach(() => vi.unstubAllEnvs());

describe('référencement et origines publiques', () => {
  it('active uniquement le site public de production configuré', () => {
    expect(seoConfig(production)).toEqual({ origin: 'https://lfe.example.com', indexable: true });
    for (const patch of [
      { NODE_ENV: 'development' },
      { LFE_DATA_BACKEND: 'local' },
      { FACEIT_MODE: 'fixtures' },
      { VERCEL_ENV: 'preview' },
      { SITE_URL: '' },
    ]) {
      expect(seoConfig({ ...production, ...patch }).indexable).toBe(false);
    }
  });
  it.each([
    'http://lfe.example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://[::1]',
    'https://test.local',
    'https://site.test',
    'https://name:pass@lfe.example.com',
    'https://lfe.example.com/site',
    'https://lfe.example.com?key=abc',
    'https://lfe.example.com#section',
    'pas-une-url',
  ])('ne publie pas une origine invalide : %s', (SITE_URL) => {
    expect(seoConfig({ ...production, SITE_URL })).toEqual({ origin: null, indexable: false });
  });
  it('sitemap limité aux sept pages publiques, sans dates de mise à jour inventées', () => {
    const sitemap = sitemapMetadata(seoConfig(production));
    expect(sitemap).toHaveLength(7);
    expect(
      sitemap.every((entry) => !entry.lastModified && !/[?]|admin|mur-des|connexion|api\//.test(entry.url)),
    ).toBe(true);
    expect(sitemapMetadata(seoConfig({ ...production, LFE_DATA_BACKEND: 'local' }))).toEqual([]);
  });
  it('bloque les robots en local et exclut les espaces privés en ligne', () => {
    expect(robotsMetadata(seoConfig({ ...production, VERCEL_ENV: 'preview' }))).toEqual({
      rules: { userAgent: '*', disallow: '/' },
    });
    expect(robotsMetadata(seoConfig(production))).toMatchObject({
      rules: { disallow: ['/admin', '/connexion', '/mur-des-lamentations', '/api/'] },
      sitemap: 'https://lfe.example.com/sitemap.xml',
    });
  });
  it('partage le vrai logo et ne donne pas d’URL canonique à un contenu non public', () => {
    for (const [key, value] of Object.entries(production)) vi.stubEnv(key, value);
    const page = publicMetadata('ELO Run', 'Classement enregistré', '/elo-run');
    expect(page.alternates).toEqual({ canonical: 'https://lfe.example.com/elo-run' });
    expect(page.openGraph).toMatchObject({
      title: 'ELO Run · LaFineEquipe',
      images: [{ url: 'https://lfe.example.com/brand/lfe-emblem.webp' }],
    });
    expect(publicMetadata('Brouillon', '', '/stuffs/exemple', false)).toMatchObject({
      robots: { index: false, follow: false },
      alternates: undefined,
    });
  });
});
