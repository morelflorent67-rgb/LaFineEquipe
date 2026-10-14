import { expect, type Page } from '@playwright/test';

/** Connexion avec un compte LOCAL de test (mode local uniquement). */
export async function loginAs(page: Page, who: 'admin' | 'sans-role') {
  const label = { admin: /Admin local/, 'sans-role': /sans-role@local\.test/ }[who];
  await page.goto('/connexion');
  await page.getByRole('button', { name: label }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/connexion'));
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

/** Aucune barre de défilement horizontale (critère d'acceptation mobile). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `débordement horizontal de ${overflow}px sur ${page.url()}`).toBeLessThanOrEqual(0);
}
