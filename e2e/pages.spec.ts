import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, loginAs } from './helpers';

test.describe('ELO Run (classement permanent)', () => {
  test('trié par ELO ; tri et filtre mettent à jour ensemble podium, tableau et courbe', async ({ page }) => {
    await page.goto('/elo-run');
    await expect(page.getByRole('heading', { level: 1, name: 'ELO Run' })).toBeVisible();
    const board = page.locator('section[aria-labelledby="classement-h"]');
    const rows = board.locator('li[data-key]');
    await expect(rows).toHaveCount(10);
    // Rangs 1, 2, 3… dans l'ordre de l'ELO actuel décroissant.
    const elos = (await board.locator('li[data-key] span[title^="Relevé du"]').allInnerTexts()).map((t) => Number(t.replace(/\D/g, ''))).filter((n) => n > 0);
    expect(elos).toEqual([...elos].sort((a, b) => b - a));
    // Sélection d'un joueur de la team : la courbe suit.
    await board.getByRole('button', { name: 'demo_alpha', exact: true }).click();
    await expect(page.locator('#courbe-h')).toHaveText('demo_alpha');
    await expect(page.getByRole('group', { name: 'Évolution de l’ELO de demo_alpha depuis son ajout' })).toBeVisible();
    // Filtre Guests : demo_alpha sort du filtre, le premier guest devient le joueur sélectionné.
    await page.getByRole('button', { name: /^Guests/ }).click();
    await expect(rows).toHaveCount(4);
    await expect(board.getByRole('button', { name: 'demo_alpha', exact: true })).toHaveCount(0);
    const firstName = (await rows.first().getByRole('button').first().textContent())!.trim();
    await expect(page.locator('#courbe-h')).toHaveText(firstName);
    await expect(page.getByRole('list', { name: /Podium/ })).toContainText(firstName);
    // Tri par progression depuis l'ajout.
    await page.getByRole('button', { name: 'Progression', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Podium (progression depuis l’ajout)' })).toBeVisible();
  });

  test('« Actualiser » est limité dans le temps pour tout le site', async ({ page }) => {
    await page.goto('/elo-run');
    const refresh = page.getByRole('button', { name: /^Actualiser/ });
    await expect(refresh).toBeEnabled();
    await refresh.click();
    await expect(page.getByRole('status').getByText(/Classement actualisé|vient d’être actualisé/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Actualiser dans/ })).toBeDisabled();
  });
});

test.describe('Stuffs', () => {
  test('compteurs cohérents, fiche propre à chaque carte, filtres conservés au retour', async ({ page }) => {
    await page.goto('/stuffs/mirage');
    const counts = page.getByRole('list', { name: /fiches publiées/ });
    await expect(counts).toHaveAttribute('aria-label', '6 fiches publiées');
    await expect(page.locator('a[href^="/stuffs/mirage/"]')).toHaveCount(6);
    await page.getByRole('button', { name: /^Flash/ }).click();
    await expect(page).toHaveURL(/type=flash/);
    await expect(page.locator('a[href^="/stuffs/mirage/"]')).toHaveCount(1);
    await page.locator('a[href^="/stuffs/mirage/"]').first().click();
    await expect(page).toHaveURL(/\/stuffs\/mirage\/exemple-flash-mid-1\?type=flash/);
    await expect(page.getByRole('heading', { level: 1, name: 'Exemple · Flash mid' })).toBeVisible();
    await page.getByRole('link', { name: /Retour au catalogue \(filtres conservés\)/ }).click();
    await expect(page).toHaveURL(/\/stuffs\/mirage\?type=flash/);
    await expect(page.getByRole('button', { name: /^Flash/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('chaque map ouvre son propre catalogue et les maps vides ont un état dédié', async ({ page }) => {
    await page.goto('/stuffs');
    await page.getByRole('link', { name: /^Inferno/ }).click();
    await expect(page).toHaveURL(/\/stuffs\/inferno$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Inferno' })).toBeVisible();
    await page.goto('/stuffs/nuke');
    await expect(page.getByText('Aucune fiche publiée sur Nuke')).toBeVisible();
    await page.goto('/stuffs/inexistante');
    await expect(page.getByText('Map introuvable')).toBeVisible();
  });

  test('un membre peut signaler une fiche « à revérifier »', async ({ page }) => {
    await loginAs(page, 'membre');
    await page.goto('/stuffs/mirage/exemple-smoke-mid-1');
    await page.getByRole('button', { name: 'Signaler « à revérifier »' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Signaler' }).click();
    await expect(page.getByText('Signalée par toi')).toBeVisible();
  });
});

test.describe('Matchs et accueil', () => {
  test('sans source validée : « Statut indisponible » sur Matchs, rien de « live » sur l’accueil', async ({ page }) => {
    await page.goto('/matches');
    await expect(page.getByText('Statut indisponible').first()).toBeVisible();
    await expect(page.getByText('Personne en game')).toHaveCount(0);
    await expect(page.locator('main ol > li').first()).toBeVisible();
    // Accueil : sans source validée, aucune mention de match en cours, seulement le dernier match terminé.
    await page.goto('/');
    await expect(page.getByText('Dernier match', { exact: true })).toBeVisible();
    await expect(page.getByText('Matchs en cours')).toHaveCount(0);
    await expect(page.locator('main .live')).toHaveCount(0);
  });
});

test.describe('Clavier', () => {
  test('menu « Plus » : Échap ferme et rend le focus', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/');
    const more = page.getByRole('button', { name: 'Plus' });
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('link', { name: /Mur des lamentations/ }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
  });

  test('menu mobile : focus confiné, Échap ferme, retour au déclencheur', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const trigger = page.getByRole('navigation', { name: 'Navigation rapide' }).getByRole('button', { name: 'Menu' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Toutes les pages' });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 15; i++) await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

const PAGES = ['/', '/elo-run', '/matches', '/team', '/stuffs', '/stuffs/mirage', '/stuffs/mirage?vue=carte', '/stuffs/mirage/exemple-smoke-mid-1', '/clips', '/crosshairs', '/mur-des-lamentations', '/connexion'];
const ADMIN_PAGES = ['/admin', '/admin/players', '/admin/mur', '/admin/maps', '/admin/maps/mirage', '/admin/stuffs', '/admin/crosshairs', '/admin/crosshairs/nouveau', '/admin/sync'];

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`aucun débordement horizontal à ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
    await loginAs(page, 'admin');
    for (const path of [...ADMIN_PAGES, '/mur-des-lamentations']) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
  });
}
