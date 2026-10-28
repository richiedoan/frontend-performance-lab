import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: [
      'src/**/*.test.{ts,tsx}',
      'scripts/bundle/**/*.test.ts',
      'scripts/memory/**/*.test.ts',
      'scripts/benchmark/**/*.test.ts',
      'scripts/publication/**/*.test.ts',
    ],
    setupFiles: ['./src/test/setup.ts'],
  },
});
