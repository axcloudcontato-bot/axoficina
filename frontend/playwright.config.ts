import { defineConfig, devices } from '@playwright/test';

// Precisa do backend rodando à parte (docker compose up + migrate + seed) —
// este config só sobe o frontend. Ver README para o setup completo.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // In CI the workflow builds first (a build inside the 120 s start-up limit would time out).
    command: process.env.CI ? 'pnpm run start' : 'pnpm run build && pnpm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
