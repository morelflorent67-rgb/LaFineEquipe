import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout sur une base LOCALE dédiée (.data/e2e) rechargée avec le jeu de
 * démonstration fictif, et FACEIT simulé (aucun appel réseau, aucune clé).
 * Utilise le Chrome installé sur le PC (aucun navigateur à télécharger).
 */
const PORT = 3100;
const env = {
  LFE_DATA_BACKEND: 'local',
  FACEIT_MODE: 'fixtures',
  LFE_LOCAL_DATA_DIR: '.data/e2e',
  NEXT_TELEMETRY_DISABLED: '1',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: `npx tsx --conditions=react-server scripts/local-reset.ts --demo && npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env,
  },
});
