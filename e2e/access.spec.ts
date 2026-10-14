import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Accès au Mur des lamentations', () => {
  test('un visiteur voit la page verrouillée et ne reçoit aucune donnée', async ({ page }) => {
    const res = await page.goto('/mur-des-lamentations');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Réservé à l’administrateur' })).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain('demo_kilo');
    expect(html).not.toContain('Exemple fictif : quitte');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('un compte sans rôle reste traité comme un visiteur', async ({ page }) => {
    await loginAs(page, 'sans-role');
    await page.goto('/mur-des-lamentations');
    await expect(page.getByText('n’a pas le rôle administrateur')).toBeVisible();
    expect(await page.content()).not.toContain('demo_kilo');
  });

  test('l’admin voit le Mur et peut chercher', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/mur-des-lamentations');
    await expect(page.getByText('demo_kilo')).toBeVisible();
    await page.getByLabel('Rechercher un pseudo sur le Mur').fill('kilo');
    await expect(page.locator('ul[aria-label="Profils sur le Mur"] > li')).toHaveCount(1);
    await page.getByLabel('Rechercher un pseudo sur le Mur').fill('personne_xyz');
    await expect(page.getByText('Personne à ce nom sur le Mur.')).toBeVisible();
  });

  test('un compte sans rôle n’a pas accès à l’administration', async ({ page }) => {
    await loginAs(page, 'sans-role');
    await page.goto('/admin/mur');
    await expect(page.getByText('Accès réservé aux administrateurs')).toBeVisible();
  });

  test('un visiteur n’a pas de bouton de connexion dans l’en-tête, seulement un lien discret en pied de page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header').getByRole('link', { name: /Connexion/ })).toHaveCount(0);
    await expect(page.locator('footer').getByRole('link', { name: 'Connexion admin' })).toBeVisible();
  });

  test('l’administration redirige un visiteur vers la connexion', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/connexion\?suite=%2Fadmin|\/connexion\?suite=\/admin/);
  });
});
