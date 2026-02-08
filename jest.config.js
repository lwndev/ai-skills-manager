/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  // Map @inquirer ESM packages to CJS-compatible manual mocks
  moduleNameMapper: {
    '^@inquirer/prompts$': '<rootDir>/tests/__mocks__/@inquirer/prompts.js',
    '^@inquirer/core$': '<rootDir>/tests/__mocks__/@inquirer/core.js',
  },
  verbose: true,
};
