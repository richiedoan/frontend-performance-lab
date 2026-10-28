import { defineConfig } from '@playwright/test';
import { MEMORY_READINESS_POLICY } from './model';
export default defineConfig({
  testDir: '.',
  testMatch: 'journey.spec.ts',
  workers: 1,
  retries: 0,
  timeout: MEMORY_READINESS_POLICY.collectionTimeoutMs,
  expect: { timeout: MEMORY_READINESS_POLICY.assertionTimeoutMs },
  reporter: 'list',
});
