import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    root: 'tests/',
    include: ['**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts'],
      reportsDirectory: path.resolve(__dirname, 'coverage'),
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
