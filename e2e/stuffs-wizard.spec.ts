import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers';

/** Image PNG minimale (1×1) servant de vue aérienne de test. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test('assistant en 4 étapes : vidéo, arrivée, lancer, infos ; la fiche publiée est retrouvée par les filtres', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/admin/maps');
  const aerial = page.locator('#img-inferno-aerial');
  await aerial.setInputFiles({ name: 'radar.png', mimeType: 'image/png', buffer: PNG_1PX });
  await aerial.locator('xpath=ancestor::form').getByRole('button', { name: /Téléverser|Remplacer/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Vue aérienne enregistrée.' })).toBeVisible();

  await page.goto('/admin/stuffs/nouveau?map=inferno');
  // 1. Vidéo, map, grenade
  await page.getByLabel('Grenade').selectOption('molotov');
  await page.getByLabel(/Vidéo YouTube/).fill('https://vimeo.com/123');
  await expect(page.getByText('Lien non reconnu')).toBeVisible();
  await page.getByLabel(/Vidéo YouTube/).fill('');
  await page.getByRole('button', { name: 'Suivant →' }).click();
  // 2. Arrivée : clic sur la vue aérienne + callout
  const radar = page.getByRole('application', { name: /Point d’arrivée/ });
  await radar.click({ position: { x: 100, y: 80 } });
  await expect(page.getByText(/^Point placé :/)).toBeVisible();
  await page.getByLabel(/Nom de l’arrivée/).fill('Coffins');
  await page.getByRole('button', { name: 'Suivant →' }).click();
  // 3. Lancer : au clavier cette fois (Entrée = centre, flèches = déplacer)
  const throwRadar = page.getByRole('application', { name: /Point de lancer/ });
  await throwRadar.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByText('Point placé : 50 % × 50,5 %')).toBeVisible();
  await page.getByLabel(/Nom du départ/).fill('Banana');
  await page.getByRole('button', { name: 'Suivant →' }).click();
  // 4. Infos : titre proposé à partir des callouts, résumé du lancer
  await expect(page.getByLabel('Titre')).toHaveValue('Coffins depuis Banana');
  await page.getByLabel('Mouvement').selectOption('running');
  await page.getByLabel('Avec saut (jumpthrow)').check();
  await expect(page.getByText('Course + saut + clic gauche')).toBeVisible();
  await page.getByRole('textbox', { name: /Étapes/ }).fill('Se placer contre le mur\nViser la cheminée\nCourse + saut + lancer');
  await page.getByRole('button', { name: 'Enregistrer et publier' }).click();
  await expect(page).toHaveURL(/\/admin\/stuffs\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Coffins depuis Banana' })).toBeVisible();

  await logout(page);
  await page.goto('/stuffs/inferno?vue=bibliotheque&type=molotov');
  await page.getByRole('link', { name: /Coffins depuis Banana/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Coffins depuis Banana' })).toBeVisible();
  await expect(page.getByText('Course + saut + clic gauche').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sur la carte' })).toBeVisible();
  await expect(page.getByText('Viser la cheminée')).toBeVisible();
});
