import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env['PLAYWRIGHT_BASE_URL'];
const baseURL = externalBaseUrl ?? 'http://127.0.0.1:4200';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run start -- --host 127.0.0.1 --port 4200',
        url: baseURL,
        reuseExistingServer: !process.env['CI'],
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
