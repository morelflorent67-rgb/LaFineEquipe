import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, loginAs } from './helpers';

test.describe('Mur des lamentations (public)', () => {
  test('un visiteur voit la Banlist et le Wall of Shame, jamais les notes ni les archives', async ({ page }) => {
    const res = await page.goto('/mur-des-lamentations');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Banlist' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wall of Shame' })).toBeVisible();
    const posters = page.locator('ul[aria-label="Profils sur le Mur"] > li');
    await expect(posters.filter({ hasText: 'demo_kilo' })).toContainText('Recherché');
    for (const title of ['Le Touriste', 'La Passoire', 'Le Myope', 'Le Pacifiste', 'Le Chat noir']) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
    }
    const html = await page.content();
    expect(html).not.toContain('Exemple fictif : quitte la partie');
    expect(html).not.toContain('demo_romeo'); // entrée archivée
    expect(html).not.toContain('demo_golf'); // invité : jamais au Wall of Shame
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.getByRole('link', { name: 'Gérer la Banlist' })).toHaveCount(0);
  });

  test('recherche dans la Banlist', async ({ page }) => {
    await page.goto('/mur-des-lamentations');
    await page.getByLabel('Rechercher un pseudo sur le Mur').fill('kilo');
    await expect(page.locator('ul[aria-label="Profils sur le Mur"] > li')).toHaveCount(1);
    await page.getByLabel('Rechercher un pseudo sur le Mur').fill('personne_xyz');
    await expect(page.getByText('Personne à ce nom sur le Mur.')).toBeVisible();
  });

  test('mobile : colonnes empilées, aucun débordement horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/mur-des-lamentations');
    await expect(page.getByRole('heading', { name: 'Wall of Shame' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: 'test-results/mur-390.png', fullPage: true, animations: 'disabled' });
  });

  test('l’admin voit les accès de gestion', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/mur-des-lamentations');
    await expect(page.getByRole('link', { name: 'Gérer la Banlist' })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'test-results/mur-1440.png', fullPage: true, animations: 'disabled' });
  });
});

test.describe('Accès à l’administration', () => {
  test('un compte sans rôle n’a pas accès à l’administration', async ({ page }) => {
    await loginAs(page, 'sans-role');
    await page.goto('/admin/mur');
    await expect(page.getByText('Accès réservé aux administrateurs')).toBeVisible();
  });

  test('l’administration redirige un visiteur vers la connexion', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/connexion\?suite=%2Fadmin|\/connexion\?suite=\/admin/);
  });

  test('un visiteur n’a pas de bouton de connexion dans l’en-tête, seulement un lien discret en pied de page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header').getByRole('link', { name: /Connexion/ })).toHaveCount(0);
    await expect(page.locator('footer').getByRole('link', { name: 'Connexion admin' })).toBeVisible();
  });
});
