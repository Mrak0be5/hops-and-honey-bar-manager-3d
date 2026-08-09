import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  // Keep one WebGL scene active at a time. The richer connected-room scene can
  // starve Chromium's GPU task when desktop and mobile projects overlap.
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4187',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:4187',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-9x16-webkit', use: { ...devices['iPhone SE (3rd gen)'], browserName: 'webkit' } },
  ],
});
