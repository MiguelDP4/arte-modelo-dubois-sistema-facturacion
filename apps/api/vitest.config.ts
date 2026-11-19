import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/__tests__/**',
        'src/server.ts',
        'src/db/seed.ts',
        'src/db/seed-permissions-cli.ts',
        'src/types/**',
      ],
      thresholds: {
        statements: 85,
        lines: 85,
      },
    },
  },
});
