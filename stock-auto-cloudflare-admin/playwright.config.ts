import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: ['tests/responsive.spec.ts', 'tests/strategy-detail.spec.ts'],
  use: {
    baseURL: 'https://stock-admin.hjjun1006.workers.dev',
    headless: true,
  },
  workers: 2,
  retries: 0,
});
