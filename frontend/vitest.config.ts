import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // e2e/ roda via Playwright (pnpm run test:e2e), não pelo Vitest.
    exclude: ['node_modules/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'features/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'stores/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/__tests__/**', '**/*.d.ts', 'e2e/**'],
      reporter: ['text-summary', 'json-summary'],
      // One point or two under the measured value (01/11/2026: 53.2 / 75.7 / 55.9 / 53.2): only real drops fail.
      thresholds: { statements: 52, branches: 74, functions: 54, lines: 52 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
