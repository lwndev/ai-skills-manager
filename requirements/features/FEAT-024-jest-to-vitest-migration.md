# Feature Requirements: Migrate from Jest to Vitest

## Overview
Migrate the entire test suite from Jest to Vitest, replacing the test runner, configuration, mocking APIs, and all related dependencies. Vitest provides native TypeScript and ESM support, faster execution through Vite's transform pipeline, and a Jest-compatible API that minimizes test rewrite effort.

## Feature ID
`FEAT-024`

## GitHub Issue
[#119](https://github.com/lwndev/ai-skills-manager/issues/119)

## Priority
High - Vitest offers significantly faster test execution, native TypeScript support without ts-jest, and first-class ESM compatibility. The current Jest setup requires ts-jest as a bridge and CJS-compatible manual mocks for ESM packages like `@inquirer/prompts`.

## User Story
As a developer, I want the test suite to run on Vitest so that I get faster test execution, native TypeScript support, and simplified ESM handling without needing ts-jest or manual CJS mock workarounds.

## Functional Requirements

### FR-1: Replace Jest Dependencies with Vitest
- Remove `jest`, `ts-jest`, and `@types/jest` from `devDependencies`
- Install `vitest` as a `devDependency`
- Remove `jest.config.ts` (or `.js`) and replace with `vitest.config.ts`

### FR-2: Update Vitest Configuration
- Create `vitest.config.ts` with equivalent settings from current `jest.config.js`:
  - Test root: `tests/`
  - Test match pattern: `**/*.test.ts`
  - Coverage collection from `src/**/*.ts` (excluding `*.d.ts` and `src/index.ts`)
  - Coverage directory: `coverage/`
  - Coverage reporters: `text`, `lcov`, `html`, `json-summary`
  - Module alias mappings for `@inquirer/prompts` and `@inquirer/core` (or remove if Vitest handles ESM natively)
  - E2E test exclusion from coverage runs

### FR-3: Update npm Scripts
- Update all Jest references in `package.json` scripts:
  - `test`: `jest` → `vitest run`
  - `test:watch`: `jest --watch` → `vitest`
  - `test:coverage`: update to Vitest equivalent with e2e exclusion
- Ensure `quality`, `prepublishOnly`, and `preversion` scripts continue to work via the updated `test` and `test:coverage` scripts

### FR-4: Migrate Test Files Using Jest APIs
- Replace `jest.*` calls with `vi.*` equivalents across all 10 files that use them (96 occurrences):
  - `jest.fn()` → `vi.fn()`
  - `jest.mock()` → `vi.mock()`
  - `jest.spyOn()` → `vi.spyOn()`
  - `jest.doMock()` → `vi.doMock()`
  - `jest.resetModules()` → `vi.resetModules()`
  - `jest.restoreAllMocks()` → `vi.restoreAllMocks()`
  - `jest.clearAllMocks()` → `vi.clearAllMocks()`
- Add explicit imports from `vitest` where needed (e.g., `import { describe, it, expect, vi, beforeEach } from 'vitest'`)

### FR-5: Migrate Mock Files
- Update `tests/__mocks__/@inquirer/prompts.js` and `tests/__mocks__/@inquirer/core.js` to be compatible with Vitest's mocking system
- Evaluate whether Vitest's native ESM support eliminates the need for these manual CJS mock shims

### FR-6: Migrate Snapshot Tests
- Ensure snapshot files under `tests/unit/formatters/update-formatter.snapshot.test.ts` work with Vitest's snapshot format
- Regenerate snapshots if the format differs between Jest and Vitest

### FR-7: Preserve E2E Test Behavior
- E2E tests (`tests/e2e/`) invoke `node dist/cli.js` directly and should require minimal changes
- Verify E2E tests still run correctly after migration
- Ensure E2E tests remain excludable from coverage runs

### FR-8: Update CI/CD Configuration
- Update any GitHub Actions workflows that reference Jest directly
- Ensure CI runs use the updated npm scripts

### FR-9: Fix Tests Destabilized by Runner Change
- Vitest's faster execution can expose pre-existing flaky tests that were masked by Jest's higher per-test overhead
- Any test that becomes flaky under Vitest must be fixed as part of the migration — not skipped or disabled
- Specifically: the `should track timing variance` performance benchmark in `tests/performance/update-benchmark.test.ts` uses a sub-millisecond workload that produces `NaN` or extreme coefficient-of-variation values when `mean ≈ 0`
- Fix by increasing workload size to produce measurable timings, or adding a guard to skip the variance assertion when timings are below statistical significance (< 1ms)

### FR-10: Enforce Coverage Thresholds in Quality Gate
- The `npm run quality` script must include the coverage threshold check (`node scripts/check-coverage.js`) so that coverage enforcement happens locally, not only in CI
- Pre-existing coverage gaps exposed by the migration must be closed so all thresholds pass:
  - Statements ≥80%, branches ≥75%, functions ≥75%, lines ≥80%
- The primary gap is in `src/commands/` where 6 command files have 0–4% coverage (`install.ts`, `uninstall.ts`, `update.ts`, `validate.ts`, `list.ts`, `package.ts`)
- Add unit tests for these command files to bring overall coverage above thresholds
- Ensure `npm run quality` passes end-to-end with the coverage check integrated

## Non-Functional Requirements

### NFR-1: Performance
- Test suite execution time should be equal to or faster than current Jest performance
- Vitest's Vite-based transform pipeline should eliminate the ts-jest compilation overhead

### NFR-2: Error Handling
- Test failure output should be clear and actionable (Vitest's default reporter)
- Coverage thresholds must be preserved from Jest configuration and enforced in `npm run quality` (not only CI)

### NFR-3: Developer Experience
- `vitest` (watch mode) should provide immediate feedback during development
- IDE integration (VS Code Vitest extension) should work out of the box

### NFR-4: Compatibility
- All 115 test files must pass after migration
- No test should be skipped or disabled as part of the migration

## Dependencies
- `vitest` (latest stable)
- Removal of: `jest` (^30.2.0), `ts-jest` (^29.4.6), `@types/jest` (^30.0.0)
- Node.js >=20.19.6 (existing requirement)
- TypeScript 5.5+ (existing requirement)

## Edge Cases
1. **Dynamic imports with `jest.doMock`**: Vitest's `vi.doMock()` has slightly different hoisting behavior — verify test files using dynamic `await import()` patterns still work correctly
2. **Module name mapper paths**: Vitest uses `resolve.alias` in config instead of `moduleNameMapper` — ensure `@inquirer/*` mocks are correctly resolved
3. **Snapshot format differences**: Vitest snapshots may differ from Jest snapshots — requires regeneration, not a functional issue
4. **Global API availability**: Vitest can run with or without global APIs (`describe`, `it`, `expect`). Decide whether to use `globals: true` in config or add explicit imports to every test file
5. **Coverage provider**: Vitest supports both `v8` and `istanbul` for coverage — choose the appropriate provider based on accuracy and performance needs
6. **Timing-sensitive tests**: Vitest's faster execution can cause timing-based assertions (e.g., coefficient of variation checks) to fail when operations complete in sub-millisecond time, making `Date.now()` granularity insufficient for statistical analysis

## Testing Requirements

### Unit Tests
- All existing unit tests (85+ files) must pass without modification to test logic (only API migration changes)

### Integration Tests
- All integration tests (16 files) must pass with Vitest runner
- API integration tests must maintain the same behavior

### E2E Tests
- All 8 E2E tests must pass (these primarily invoke CLI and should be unaffected)

### Performance Tests
- Performance and benchmark tests must produce equivalent results
- Timing variance test must pass reliably across multiple consecutive runs (not flaky)

### Security Tests
- All 4 security tests must pass unchanged

### Migration Verification
- Run full `npm run quality` (lint + test:coverage + audit) to confirm parity

## Acceptance Criteria
- [x] `jest`, `ts-jest`, and `@types/jest` removed from `package.json`
- [x] `vitest` added to `devDependencies`
- [x] `jest.config.js` removed and `vitest.config.ts` created
- [x] All `package.json` scripts updated to use Vitest
- [x] All `jest.*` API calls replaced with `vi.*` equivalents across test files
- [x] Mock files updated or simplified for Vitest compatibility
- [x] Snapshot tests regenerated if format differs
- [x] All 115 test files pass with `npm test`
- [x] Coverage collection works with `npm run test:coverage`
- [x] Coverage meets all thresholds: statements ≥80%, branches ≥75%, functions ≥75%, lines ≥80%
- [x] `npm run quality` passes with coverage threshold check integrated (lint + test:coverage + check-coverage + audit)
- [x] E2E tests pass after `npm run build`
- [x] No test files skipped or disabled as part of migration
- [x] No flaky tests remain after migration (timing-sensitive tests fixed)
