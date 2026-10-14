import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, loginAs } from './helpers';

const alpha = '/players/a0000000-0000-4000-8000-000000000001';
const bravo = '/players/a0000000-0000-4000-8000-000000000002';

test('profil : courbe accessible, clips et crosshairs propres au joueur, lien de filtre', async ({
  page,
}) => {
  await page.goto(alpha);
  await expect(page.getByRole('heading', { level: 1, name: 'demo_alpha' })).toBeVisible();
  const chart = page.getByRole('group', { name: 'Évolution de l’ELO de demo_alpha depuis son ajout' });
  await chart.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(chart).toBeFocused();
  const clips = page.getByRole('region', { name: 'Ses clips', exact: true });
  await expect(clips.getByRole('article')).toHaveCount(1);
  await expect(clips).toContainText('Le clutch impossible');
  await expect(clips).not.toContainText('Trois ouvertures');
  const presets = page.getByRole('region', { name: 'Ses crosshairs', exact: true });
  await expect(presets.getByRole('article')).toHaveCount(1);
  await expect(presets).toContainText('Classique fin');
  await expect(presets.getByRole('button', { name: /Copier/ })).toBeVisible();
  await clips.getByRole('link', { name: /Voir ses clips/ }).click();
  await expect(page).toHaveURL(/\/clips\?player=a0000000-0000-4000-8000-000000000001$/);
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.goto(bravo);
  await expect(page.getByRole('region', { name: 'Ses clips', exact: true })).toContainText(
    'Trois ouvertures',
  );
  await expect(page.getByRole('region', { name: 'Ses crosshairs', exact: true })).toContainText('Point cyan');
  await loginAs(page, 'admin');
  await page.goto(alpha);
  await expect(presets.getByRole('article')).toHaveCount(1);
  await expect(page.locator('main')).not.toContainText('Exemple · Brouillon');
});

test('profil : mobile, contenu absent et identifiant inconnu', async ({ page }) => {
  for (const width of [360, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(alpha);
    await expectNoHorizontalOverflow(page);
    const nav = page.getByRole('navigation', { name: 'Sur ce profil' });
    await nav.getByRole('link', { name: /^Crosshairs/ }).click();
    await expect(page).toHaveURL(/#crosshairs$/);
    await expect(page.getByRole('heading', { name: 'Ses crosshairs' })).toBeInViewport();
    await page.goto(alpha);
    if (width !== 360) await page.screenshot({ path: `test-results/player-${width}.png`, fullPage: true });
  }
  await page.goto('/players/a0000000-0000-4000-8000-000000000023');
  await expect(page.getByText('ELO CS2 non fourni par FACEIT')).toBeVisible();
  await expect(page.getByText('Aucun clip publié pour ce joueur')).toBeVisible();
  await expect(page.getByText('Aucun crosshair publié pour ce joueur')).toBeVisible();
  await expect(page.getByRole('group', { name: /Évolution de l’ELO/ })).toHaveCount(0);
  for (const id of ['inconnu', 'a0000000-0000-4000-8000-000000000099']) {
    await page.goto(`/players/${id}`);
    await expect(page.getByRole('heading', { name: 'Joueur introuvable' })).toBeVisible();
    // notFound() peut ajouter son propre noindex aux métadonnées du site.
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
  }
  await page.getByRole('link', { name: 'Voir les joueurs' }).click();
  await expect(page).toHaveURL(/\/team$/);
});
