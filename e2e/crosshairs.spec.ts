import { expect, test } from '@playwright/test';
import { loginAs, logout } from './helpers';

test.describe('Crosshairs', () => {
  test('le visiteur voit les presets publiés, leur état de vérification et copie un code', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/crosshairs');
    await expect(page.getByRole('heading', { name: 'Exemple · Classique fin' })).toBeVisible();
    await expect(page.getByText('Exemple · Brouillon')).toHaveCount(0);
    for (const details of await page.locator('article details summary').all()) await details.click();
    await expect(page.getByText(/À revérifier · validé le 12\/09\/2026/)).toBeVisible();
    await expect(page.getByText('Jamais vérifié en jeu')).toBeVisible();
    await page.getByRole('button', { name: 'Copier le code de « Exemple · Classique fin »' }).click();
    await expect(
      page.getByRole('button', { name: 'Copier le code de « Exemple · Classique fin »' }),
    ).toHaveText(/Copié/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'CSGO-EXEMP-LEFAK-EAAAA-AAAAA-AAAAB',
    );
  });

  test('l’admin ajoute un preset : code contrôlé pendant la saisie, publication visible du public', async ({
    page,
  }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/crosshairs/nouveau');
    await page.getByLabel('Nom du preset').fill('Test e2e');
    await page.getByLabel('Joueur').selectOption({ label: 'demo_bravo' });
    await page.getByLabel('Code de partage').fill('CSGO-ABCDE-FGHJK');
    await expect(
      page.getByText('Forme attendue : CS… (format récent) ou CSGO- puis 5 blocs de 5 caractères.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer et publier' })).toBeDisabled();
    await page.getByLabel('Code de partage').fill(' csgo-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ ');
    await expect(page.getByText('Forme valide. L’import en jeu reste à tester.')).toBeVisible();
    await page.getByLabel('Testé en jeu le').fill('2026-10-10');
    await page.getByRole('button', { name: 'Enregistrer et publier' }).click();
    await expect(page).toHaveURL(/\/admin\/crosshairs\/[0-9a-f-]{36}$/);

    await logout(page);
    await page.goto('/crosshairs');
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Test e2e' }) });
    await card.locator('summary').click();
    await expect(card.getByText('demo_bravo')).toBeVisible();
    await expect(card.getByText('CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ')).toBeVisible();
    await expect(card.getByText(/Validé le 10\/10\/2026/)).toBeVisible();
  });
});

test('code récent publié, aperçu et copie intacte', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await loginAs(page, 'admin');
  await page.goto('/admin/crosshairs/nouveau');
  await page.getByLabel('Nom du preset').fill('Test format récent');
  const code = 'CSH2Rx7cGRU5apQ4VSnZwjsr9RyLEiOrCAaVYWYvW6dz7H';
  await page.getByLabel('Code de partage').fill(code);
  await page.getByRole('button', { name: 'Enregistrer et publier' }).click();
  await expect(page).toHaveURL(/\/admin\/crosshairs\/[0-9a-f-]{36}$/);
  const editUrl = page.url();
  await logout(page);
  await page.goto('/crosshairs');
  const card = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Test format récent' }) });
  const visual = card.getByRole('img', { name: /Visuel du viseur/ });
  await expect(visual).toBeVisible();
  await expect.poll(() => visual.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(132);
  await expect(card.getByText('Jamais vérifié en jeu')).not.toBeVisible();
  await card.locator('summary').click();
  await expect(card.getByText('Jamais vérifié en jeu')).toBeVisible();
  await card.getByRole('button', { name: /Copier le code/ }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await loginAs(page, 'admin');
  await page.goto(editUrl);
  await page.getByLabel('Code de partage').fill('CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ');
  await page.getByRole('button', { name: 'Enregistrer (publié)' }).click();
  await expect(page.getByText('Crosshair enregistré et publié.').first()).toBeVisible();
  await logout(page);
  await page.goto('/crosshairs');
  await expect(card.getByRole('img', { name: /Visuel du viseur/ })).toHaveCount(0);
  await expect(card.getByText('Pas d’aperçu')).toBeVisible();
});
