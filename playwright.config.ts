import { defineConfig, devices } from '@playwright/test';

const DEFAULT_PORT = 3217;
const configuredPort = Number(process.env.PLAYWRIGHT_PORT || DEFAULT_PORT);
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_PORT;
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, '');
const baseURL = externalBaseUrl || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: 'output/playwright/test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'output/playwright/html', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // PLAYWRIGHT_BASE_URL targets an already-running environment such as staging.
  // Without it, Playwright owns an isolated local Next.js server. Override the
  // local port with PLAYWRIGHT_PORT if 3217 is unavailable.
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        // Use a static public page for readiness so local UI tests do not need
        // Supabase credentials merely to prove that Next.js is accepting traffic.
        url: `${baseURL}/about`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
