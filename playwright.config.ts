import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/Strom_Gas_Tracker/`;

// Lokal kann ein vorinstalliertes Chromium genutzt werden (PW_CHROMIUM_EXECUTABLE=/pfad/zu/chrome).
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'off',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: 'iphone',
      // iPhone-Viewport mit Touch, gerendert in Chromium (Service Worker + CDP verfügbar).
      use: { ...devices['iPhone 15'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
