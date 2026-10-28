import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'preflight.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 120000,
  reporter: 'list',
});
