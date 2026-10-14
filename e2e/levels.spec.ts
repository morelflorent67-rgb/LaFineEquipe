import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers';

test('badges FACEIT : fichiers chargés, niveau visible sur podium et classement mobile', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/elo-run');
    const podium = page.getByRole('list', { name: 'Podium (ELO actuel)' });
    await expect(podium.getByRole('img', { name: /^Niveau FACEIT/ })).toHaveCount(3);
    const board = page.locator('section[aria-labelledby="classement-h"]');
    const badge = board.getByRole('img', { name: 'Niveau FACEIT 10', exact: true }).first();
    await expect(badge).toBeVisible();
    await expect(badge.locator('img')).toHaveAttribute('src', '/faceit/levels/10.png');
    await expect
      .poll(() =>
        badge.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 38),
      )
      .toBe(true);
    await expectNoHorizontalOverflow(page);
    await board.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/levels-${width}.png` });
  }
  await page.goto('/players/a0000000-0000-4000-8000-000000000023');
  await expect(page.getByRole('img', { name: 'Niveau CS2 non fourni', exact: true })).toBeVisible();
  await expect(page.locator('img[src*="/faceit/levels/"]')).toHaveCount(0);
});

test('lien inexistant : page française, retour au classement', async ({ page }) => {
  await page.goto('/page-inexistante-test');
  await expect(page.getByRole('heading', { name: 'Cette page est introuvable.' })).toBeVisible();
  await page.locator('main').getByRole('link', { name: 'Classement ELO' }).click();
  await expect(page).toHaveURL(/\/elo-run$/);
});
