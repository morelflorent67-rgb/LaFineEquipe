import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Import FACEIT et Mur (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('ajout vérifié, persistance, doublon par identifiant, archive, réactivation, suppression', async ({ page }) => {
    await page.goto('/admin/mur');
    const search = page.getByLabel('Pseudo FACEIT, lien de profil ou identifiant');
    // Casse différente : la recherche FACEIT retrouve le bon profil.
    await search.fill('Demo_Yankee');
    await page.getByRole('button', { name: 'Rechercher' }).click();
    await expect(page.getByText('d0000000-0000-4000-8000-000000000021')).toBeVisible();
    await expect(page.getByText('Avatar FACEIT, utilisé automatiquement')).toBeVisible();
    await page.getByLabel('Motif interne (facultatif)').fill('Motif e2e');
    await page.getByRole('button', { name: 'Ajouter au Mur' }).click();
    await expect(page.getByRole('status').getByText('demo_yankee ajouté au Mur.')).toBeVisible();

    // Persistance après rechargement.
    await page.reload();
    const row = page.locator('li[id^="entree-"]', { hasText: 'demo_yankee' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Motif e2e');

    // Doublon : même identifiant via un lien de profil.
    await search.fill('https://www.faceit.com/en/players/demo_yankee/stats/cs2');
    await page.getByRole('button', { name: 'Rechercher' }).click();
    await expect(page.getByText('Déjà sur le Mur')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ajouter au Mur' })).toHaveCount(0);

    // Archive puis réactivation.
    await row.getByRole('button', { name: 'Archiver demo_yankee' }).click();
    await expect(page.getByRole('status').getByText('Entrée mise à jour.')).toBeVisible();
    await page.getByRole('button', { name: /Archivés/ }).click();
    await page.locator('li[id^="entree-"]', { hasText: 'demo_yankee' }).getByRole('button', { name: 'Réactiver demo_yankee' }).click();
    await expect(page.getByRole('status').getByText('Entrée mise à jour.').last()).toBeVisible();

    // Suppression avec confirmation ; Échap ferme la boîte et rend le focus au bouton.
    await page.getByRole('button', { name: /Actifs/ }).click();
    const del = page.locator('li[id^="entree-"]', { hasText: 'demo_yankee' }).getByRole('button', { name: 'Retirer demo_yankee du Mur' });
    await del.click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(del).toBeFocused();
    await del.click();
    await page.getByRole('button', { name: 'Retirer définitivement' }).click();
    await expect(page.locator('li[id^="entree-"]', { hasText: 'demo_yankee' })).toHaveCount(0);
  });

  test('erreurs FACEIT, profil introuvable, profil sans avatar ni CS2, doublon roster', async ({ page }) => {
    await page.goto('/admin/players');
    const search = page.getByLabel('Pseudo FACEIT, lien de profil ou identifiant');
    const go = async (q: string) => {
      await search.fill(q);
      await page.getByRole('button', { name: 'Rechercher' }).click();
    };
    await go('demo_panne');
    await expect(page.getByText('FACEIT ne répond pas correctement')).toBeVisible();
    await go('demo_quota');
    await expect(page.getByText('Trop de requêtes vers FACEIT')).toBeVisible();
    await go('zzz_introuvable');
    await expect(page.getByText('Aucun profil FACEIT « zzz_introuvable »')).toBeVisible();
    await go('https://example.com/players/x');
    await expect(page.getByText('Seuls les liens faceit.com sont acceptés.')).toBeVisible();
    await go('demo_sansavatar');
    await expect(page.getByText('Déjà dans le roster')).toBeVisible();
    await expect(page.getByText('Pas d’avatar sur FACEIT : silhouette affichée')).toBeVisible();
    await go('demo_sanscs2');
    await expect(page.getByText('Pas de données CS2 sur FACEIT')).toBeVisible();
  });
});
