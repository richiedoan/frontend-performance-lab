import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: 'runner.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 1800000,
  reporter: 'list',
});
