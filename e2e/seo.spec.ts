import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test('métadonnées publiques françaises et non-indexation du développement', async ({ page, request }) => {
  await page.goto('/elo-run');
  await expect(page).toHaveTitle('ELO Run · LaFineEquipe');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /classement permanent/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'ELO Run · LaFineEquipe',
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.goto('/clips?q=test');
  await expect(page).toHaveTitle('Clips · LaFineEquipe');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /highlights/);
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain('Disallow: /');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).not.toContain('<loc>');
  await page.goto('/stuffs/mirage?type=smoke');
  await expect(page).toHaveTitle('Stuffs Mirage · LaFineEquipe');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /Mirage/);
  await page.goto('/stuffs/inconnue');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('espaces privés sans indexation ni aperçu nominatif du Mur', async ({ page }) => {
  await loginAs(page, 'admin');
  for (const path of ['/mur-des-lamentations', '/admin', '/connexion']) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  }
});
