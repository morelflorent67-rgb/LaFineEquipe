import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers';

/** Image PNG minimale (1×1) : le serveur vérifie le vrai type du fichier, pas son nom. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Maps et carte tactique', () => {
  test('l’admin ajoute la vue aérienne, place une position, y rattache une fiche ; la carte publique l’affiche', async ({ page }) => {
    await page.goto('/stuffs/mirage?vue=carte');
    await expect(page.getByText('Vue aérienne de Mirage pas encore ajoutée')).toBeVisible();

    await loginAs(page, 'admin');
    await page.goto('/admin/maps');
    const aerial = page.locator('#img-mirage-aerial');
    await aerial.setInputFiles({ name: 'radar.png', mimeType: 'image/png', buffer: PNG_1PX });
    await aerial.locator('xpath=ancestor::form').getByRole('button', { name: 'Téléverser' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Vue aérienne enregistrée.' })).toBeVisible();

    // Un faux fichier image (texte renommé) est refusé.
    const cover = page.locator('#img-mirage-cover');
    await cover.setInputFiles({ name: 'faux.png', mimeType: 'image/png', buffer: Buffer.from('pas une image') });
    await cover.locator('xpath=ancestor::form').getByRole('button', { name: /Téléverser|Remplacer/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Format refusé' })).toBeVisible();

    await page.goto('/admin/maps/mirage');
    const box = page.locator('[data-mode="position"]');
    await box.click({ position: { x: 120, y: 160 } });
    await page.getByLabel(/^Nom \(ex\./).fill('Fenêtre');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('button', { name: /^Position Fenêtre, 0 fiche/ })).toBeVisible();

    await page.getByLabel('Position de lancer de « Exemple · Smoke mid »').first().selectOption({ label: 'Fenêtre' });
    await expect(page.getByRole('button', { name: /^Position Fenêtre, 1 fiche/ })).toBeVisible();
    const fiche = page.locator('li').filter({ has: page.getByLabel('Position de lancer de « Exemple · Smoke mid »') }).first();
    await fiche.getByRole('button', { name: 'Placer l’impact' }).click();
    await page.locator('[data-mode="landing"]').click({ position: { x: 260, y: 90 } });
    await expect(fiche.getByRole('button', { name: 'Replacer l’impact' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Impact de « Exemple · Smoke mid »/ })).toBeVisible();

    await logout(page);
    await page.goto('/stuffs/mirage?vue=carte');
    const marker = page.getByRole('button', { name: 'Smoke depuis Fenêtre : 1 lineup' });
    await marker.click();
    await expect(page.getByRole('heading', { name: 'Fenêtre' })).toBeVisible();
    await page.getByRole('link', { name: /Exemple · Smoke mid/ }).first().click();
    await expect(page).toHaveURL(/\/stuffs\/mirage\/exemple-smoke-mid-1\?vue=carte/);
    await expect(page.getByRole('heading', { name: 'Sur la carte' })).toBeVisible();
    await expect(page.getByRole('img', { name: /Lancer depuis Fenêtre, impact/ })).toBeVisible();

    // Mode entraînement : plein écran, → ouvre le lineup suivant dans le même mode, Échap ferme.
    await page.getByRole('button', { name: 'Mode entraînement' }).click();
    const training = page.getByRole('dialog', { name: 'Exemple · Smoke mid' });
    await expect(training).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/entrainement=1/);
    await expect(page.getByRole('dialog')).not.toHaveAccessibleName('Exemple · Smoke mid');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).not.toHaveURL(/entrainement/);
    await page.getByRole('link', { name: '← Retour à la carte tactique' }).click();
    await expect(page).toHaveURL(/\/stuffs\/mirage\?vue=carte$/);
    await expect(page.getByRole('tab', { name: /Carte tactique/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('une map masquée disparaît du site, puis revient', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/maps');
    const train = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Train' }) });
    await train.getByLabel('Visible sur le site').uncheck();
    await expect(train.getByText('Masquée', { exact: true })).toBeVisible();
    await logout(page);
    await page.goto('/stuffs');
    await expect(page.getByRole('link', { name: /^Train/ })).toHaveCount(0);
    await page.goto('/stuffs/train');
    await expect(page.getByText('Map introuvable')).toBeVisible();

    await loginAs(page, 'admin');
    await page.goto('/admin/maps');
    await train.getByLabel('Visible sur le site').check();
    await expect(train.getByText('Visible', { exact: true })).toBeVisible();
    await page.goto('/stuffs');
    await expect(page.getByRole('link', { name: /^Train/ })).toHaveCount(1);
  });
});
