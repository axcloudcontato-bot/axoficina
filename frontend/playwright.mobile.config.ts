import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'mobile-photo-upload.spec.ts',
  timeout: 45_000,
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
