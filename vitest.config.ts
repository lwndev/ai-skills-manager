import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts'],
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
    },
  },
  resolve: {
    alias: {
      '@inquirer/prompts': path.resolve(__dirname, 'tests/__mocks__/@inquirer/prompts.js'),
      '@inquirer/core': path.resolve(__dirname, 'tests/__mocks__/@inquirer/core.js'),
    },
  },
});
