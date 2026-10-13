import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Accès au Mur des lamentations', () => {
  test('un visiteur voit la page verrouillée et ne reçoit aucune donnée', async ({ page }) => {
    const res = await page.goto('/mur-des-lamentations');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Réservé à la team' })).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain('demo_kilo');
    expect(html).not.toContain('Exemple fictif : quitte');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('un compte sans rôle reste traité comme un visiteur', async ({ page }) => {
    await loginAs(page, 'sans-role');
    await page.goto('/mur-des-lamentations');
    await expect(page.getByText('n’a pas encore le rôle membre')).toBeVisible();
    expect(await page.content()).not.toContain('demo_kilo');
  });

  test('un membre voit le Mur, sans aucun motif interne, et peut chercher', async ({ page }) => {
    await loginAs(page, 'membre');
    await page.goto('/mur-des-lamentations');
    await expect(page.getByText('demo_kilo')).toBeVisible();
    expect(await page.content()).not.toContain('Exemple fictif : quitte la partie');
    await page.getByLabel('Rechercher un pseudo sur le Mur').fill('kilo');
    await expect(page.locator('ul[aria-label="Profils sur le Mur"] > li')).toHaveCount(1);
    await page.getByLabel('Rechercher un pseudo sur le Mur').fill('personne_xyz');
    await expect(page.getByText('Personne à ce nom sur le Mur.')).toBeVisible();
    // Un membre n'a pas accès à l'administration.
    await page.goto('/admin/mur');
    await expect(page.getByText('Accès réservé aux administrateurs')).toBeVisible();
  });

  test('l’administration redirige un visiteur vers la connexion', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/connexion\?suite=%2Fadmin|\/connexion\?suite=\/admin/);
  });
});
