import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, loginAs, logout } from './helpers';

test('clips : brouillon privé, publication, doublon, filtres, lecteur et suppression', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/admin/clips/nouveau');
  await page.getByLabel('Lien de la vidéo').fill('https://youtube.com.evil.test/watch?v=M7lc1UVf-VE');
  await expect(page.getByRole('button', { name: 'Enregistrer et publier' })).toBeDisabled();
  await page.getByLabel('Lien de la vidéo').fill('https://youtu.be/M7lc1UVf-VE?si=test');
  await page.getByLabel('Titre', { exact: true }).fill('Clip test e2e');
  await page.getByRole('combobox', { name: 'Joueur', exact: true }).selectOption({ label: 'demo_bravo' });
  await page.getByRole('combobox', { name: 'Map', exact: true }).selectOption({ label: 'Mirage' });
  await page.getByLabel('Date du clip').fill('2026-10-13');
  await page.getByRole('button', { name: 'Enregistrer en brouillon' }).click();
  await expect(page).toHaveURL(/\/admin\/clips\/[0-9a-f-]{36}$/);
  const editUrl = page.url();
  await logout(page);
  await page.goto('/clips');
  await expect(page.getByRole('heading', { name: 'Clip test e2e' })).toHaveCount(0);
  await loginAs(page, 'admin');
  await page.goto(editUrl);
  await page.getByLabel(/J’ai l’accord/).check();
  await page.getByLabel(/J’ai vérifié/).check();
  await page.getByRole('button', { name: 'Enregistrer et publier' }).click();
  await expect(page.getByRole('status').getByText('Clip enregistré et publié.')).toBeVisible();
  // Même vidéo via une autre forme d’URL : doublon refusé.
  await page.goto('/admin/clips/nouveau');
  await page.getByLabel('Lien de la vidéo').fill('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  await page.getByLabel('Titre', { exact: true }).fill('Doublon');
  await page.getByLabel('Date du clip').fill('2026-10-13');
  await page.getByRole('button', { name: 'Enregistrer en brouillon' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'déjà dans la bibliothèque' })).toBeVisible();
  await logout(page);
  await page.goto('/clips?map=mirage&q=Clip+test');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('article')).toContainText('demo_bravo');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Map', exact: true })).toHaveValue('mirage');
  await expect(page.locator('iframe')).toHaveCount(0);
  // Réseau tiers intercepté : on teste le contrat d’intégration, pas la disponibilité d’une vidéo réelle.
  await page.route('https://www.youtube.com/embed/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>Lecteur de test</p>' }),
  );
  const play = page.getByRole('button', { name: 'Lire le clip' });
  await play.click();
  await expect(page.getByRole('dialog').locator('iframe')).toHaveAttribute(
    'src',
    'https://www.youtube.com/embed/M7lc1UVf-VE?autoplay=0',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(play).toBeFocused();
  await page.getByLabel('Rechercher', { exact: true }).fill('aucun-resultat');
  await page.getByRole('button', { name: 'Filtrer', exact: true }).click();
  await expect(page.getByText('Aucun clip pour ces filtres')).toBeVisible();
  await loginAs(page, 'admin');
  await page.goto(editUrl);
  await page.getByLabel('Titre', { exact: true }).fill('Clip modifié e2e');
  await page.getByRole('button', { name: 'Enregistrer et publier' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Clip modifié e2e' })).toBeVisible();
  await page.getByRole('button', { name: 'Supprimer le clip' }).click();
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Supprimer le clip' })).toBeFocused();
  await page.getByRole('button', { name: 'Supprimer le clip' }).click();
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page).toHaveURL(/\/admin\/clips$/);
  await expect(page.getByRole('link', { name: 'Clip modifié e2e' })).toHaveCount(0);
});

test('clips : galerie et formulaire utilisables sur mobile, membres sans accès admin', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/clips');
    await expect(page.getByRole('heading', { name: 'Exemple · Le clutch impossible' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: `test-results/clips-${width}.png`, fullPage: true });
  }
  await loginAs(page, 'admin');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/clips/nouveau');
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: 'test-results/clips-admin-mobile.png', fullPage: true });
  await logout(page);
  await loginAs(page, 'membre');
  await page.goto('/admin/clips');
  await expect(page.getByText('Accès réservé aux administrateurs')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nouveau clip' })).toHaveCount(0);
});
