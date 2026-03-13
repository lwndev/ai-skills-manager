# Implementation Plan: Migrate from Jest to Vitest

## Overview

Migrate the AI Skills Manager test suite from Jest to Vitest, replacing the test runner, configuration, mocking APIs, and all related dependencies. This migration eliminates the ts-jest compilation bridge, simplifies ESM mock handling for `@inquirer/*` packages, and provides faster test execution through Vite's transform pipeline. The Jest-compatible API minimizes test rewrite effort — only 10 of 115 test files require API-level changes.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-024 | [#119](https://github.com/lwndev/ai-skills-manager/issues/119) | [FEAT-024-jest-to-vitest-migration.md](../features/FEAT-024-jest-to-vitest-migration.md) | High | Medium | Pending |

## Recommended Build Sequence

### Phase 1: Dependencies and Configuration
**Feature:** [FEAT-024](../features/FEAT-024-jest-to-vitest-migration.md) | [#119](https://github.com/lwndev/ai-skills-manager/issues/119)
**Status:** ✅ Complete

#### Rationale
- Establishes the Vitest foundation before touching any test files
- Swapping dependencies and configuration first means every subsequent phase can validate against the new runner
- Keeps the blast radius small — if the config is wrong, no test files have been modified yet

#### Implementation Steps
1. Install `vitest` as a devDependency
2. Remove `jest`, `ts-jest`, and `@types/jest` from devDependencies
3. Remove the `overrides` entries for `minimatch` and `test-exclude` if they were only needed by Jest/ts-jest (verify first)
4. Delete `jest.config.js`
5. Create `vitest.config.ts` with equivalent settings:
   - Test root: `tests/`
   - Test match: `**/*.test.ts`
   - `globals: true` (avoids adding imports to all 115 test files — `describe`, `it`, `expect`, `vi`, `beforeEach` etc. available globally)
   - Coverage provider: `v8` (fast, built-in to Node)
   - Coverage collection from `src/**/*.ts`, excluding `*.d.ts` and `src/index.ts`
   - Coverage directory: `coverage/`
   - Coverage reporters: `text`, `lcov`, `html`, `json-summary`
   - `resolve.alias` mappings for `@inquirer/prompts` and `@inquirer/core` pointing to `tests/__mocks__/` (replaces `moduleNameMapper`)
6. Update `package.json` scripts:
   - `test`: `jest` → `vitest run`
   - `test:watch`: `jest --watch` → `vitest`
   - `test:coverage`: update to `vitest run --coverage --exclude 'tests/e2e/**'`
7. Add `vitest/globals` to the `types` array in `tsconfig.json` (or a `tsconfig.test.json`) so TypeScript recognizes global `vi`, `describe`, `expect`, etc.
8. Verify: run `npm test -- tests/unit/utils/output.test.ts` (a simple test file with no jest.* APIs) to confirm the new runner works

#### Deliverables
- [x] `vitest` installed, `jest`/`ts-jest`/`@types/jest` removed from `package.json`
- [x] `jest.config.js` deleted
- [x] `vitest.config.ts` created with equivalent configuration
- [x] `package.json` scripts updated for Vitest
- [x] TypeScript config updated for Vitest global types
- [x] At least one simple test file passes with `npm test`

---

### Phase 2: Migrate Mock Files and Test API Calls
**Feature:** [FEAT-024](../features/FEAT-024-jest-to-vitest-migration.md) | [#119](https://github.com/lwndev/ai-skills-manager/issues/119)
**Status:** Pending

#### Rationale
- With the runner configured, this phase updates the 10 test files that use Jest-specific APIs and the 2 manual mock files
- Mock files must be updated first since test files depend on them
- Grouping all API migrations in one phase ensures consistent patterns

#### Implementation Steps
1. Update `tests/__mocks__/@inquirer/prompts.js` — replace `jest.fn()` with `vi.fn()` (or convert to `.ts` if Vitest handles it better)
2. Update `tests/__mocks__/@inquirer/core.js` — no jest API usage, but verify compatibility
3. Migrate jest API calls across 10 test files (replace `jest.*` → `vi.*`):
   - `tests/unit/commands/scaffold-interactive.test.ts` — uses `jest.mock()`, `jest.fn()`, `jest.clearAllMocks()`
   - `tests/unit/generators/scaffold.test.ts` — uses `jest.mock()`, `jest.fn()`
   - `tests/unit/api/install.test.ts` — uses `jest.fn()`, `jest.doMock()`, `jest.resetModules()`, `jest.restoreAllMocks()`
   - `tests/unit/api/scaffold.test.ts` — uses `jest.fn()`, `jest.spyOn()`, `jest.doMock()`, `jest.resetModules()`
   - `tests/unit/api/uninstall.test.ts` — uses `jest.fn()`, `jest.doMock()`, `jest.resetModules()`, `jest.restoreAllMocks()`
   - `tests/unit/api/update.test.ts` — uses `jest.fn()`, `jest.doMock()`, `jest.resetModules()`, `jest.restoreAllMocks()`
   - `tests/unit/utils/signal-handler.test.ts` — uses `jest.fn()`
   - `tests/unit/utils/debug.test.ts` — uses `jest.spyOn()`, `jest.restoreAllMocks()`
   - `tests/unit/utils/output.test.ts` — uses `jest.spyOn()`
4. For files using `jest.doMock()` + `jest.resetModules()` + dynamic `await import()`: verify Vitest's `vi.doMock()` + `vi.resetModules()` produces the same behavior (this is the highest-risk pattern)
5. Verify: run `npm test` to confirm all migrated files pass

#### Deliverables
- [ ] Mock files updated with `vi.fn()` replacing `jest.fn()`
- [ ] All 10 test files migrated from `jest.*` to `vi.*` APIs
- [ ] `vi.doMock()` + dynamic import pattern validated in API test files
- [ ] `npm test` passes for all migrated files

---

### Phase 3: Snapshots, CI, and Final Verification
**Feature:** [FEAT-024](../features/FEAT-024-jest-to-vitest-migration.md) | [#119](https://github.com/lwndev/ai-skills-manager/issues/119)
**Status:** Pending

#### Rationale
- Snapshot regeneration must happen after the runner is fully configured and API migration is complete
- CI workflow update is the final step — ensures the pipeline uses the new runner
- Full `npm run quality` validates end-to-end parity with the pre-migration state

#### Implementation Steps
1. Delete existing snapshot files under `tests/unit/formatters/__snapshots__/`
2. Run `npx vitest run tests/unit/formatters/update-formatter.snapshot.test.ts --update` to regenerate snapshots
3. Verify snapshot tests pass on a clean run (without `--update`)
4. Update `.github/workflows/ci.yml`:
   - Line 45: replace `npx jest tests/e2e/ --verbose` with `npx vitest run tests/e2e/ --reporter=verbose`
5. Run `npm run build` to ensure build still works (no jest references in src/)
6. Run `npm test` — all 115 test files must pass
7. Run `npm run test:coverage` — verify coverage collection works and excludes e2e
8. Run E2E tests: `npm test -- tests/e2e/` (after `npm run build`)
9. Run `npm run quality` — full lint + test:coverage + audit must pass
10. Update `CLAUDE.md` memory note about test framework from Jest to Vitest

#### Deliverables
- [ ] Snapshot files regenerated for Vitest format
- [ ] `.github/workflows/ci.yml` updated to use Vitest
- [ ] All 115 test files pass with `npm test`
- [ ] Coverage collection works with `npm run test:coverage`
- [ ] E2E tests pass after `npm run build`
- [ ] `npm run quality` passes (lint + test:coverage + audit)
- [ ] No test files skipped or disabled

---

## Shared Infrastructure

- **`vitest.config.ts`** — Central configuration replacing `jest.config.js`
- **`tests/__mocks__/`** — Existing mock directory, updated for Vitest compatibility
- **`globals: true`** — Eliminates need to add explicit imports to all 115 test files; only mock files need `vi` references

## Testing Strategy

- **Incremental validation**: Each phase ends with a test run to catch regressions early
- **Phase 1**: Single simple test file validates runner configuration
- **Phase 2**: Full `npm test` validates API migration across all 115 files
- **Phase 3**: Full `npm run quality` validates end-to-end parity including lint, coverage, and audit
- **No test logic changes**: Only framework API calls change (`jest.*` → `vi.*`). Test assertions, setup, and teardown logic remain identical.

## Dependencies and Prerequisites

- **vitest** (latest stable) — Vite-powered test runner with Jest-compatible API
- **@vitest/coverage-v8** — Coverage provider using V8's built-in coverage (replaces Istanbul used by Jest)
- **Removal of**: `jest` (^30.2.0), `ts-jest` (^29.4.6), `@types/jest` (^30.0.0)
- **Node.js >=20.19.6** — existing requirement, compatible with Vitest
- **TypeScript 5.5+** — existing requirement, natively supported by Vitest without ts-jest

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| `vi.doMock()` + dynamic import behaves differently than `jest.doMock()` | High | Medium | Test the 4 API files (install, scaffold, uninstall, update) individually in Phase 2; adjust mock setup if needed |
| `resolve.alias` doesn't replicate `moduleNameMapper` behavior exactly | Medium | Low | Fall back to Vitest's `__mocks__` auto-resolution or inline `vi.mock()` factories |
| Snapshot format differs, causing false test failures | Low | High | Expected — delete and regenerate snapshots in Phase 3 |
| `overrides` in package.json were Jest-specific | Low | Low | Verify `minimatch` and `test-exclude` overrides are still needed; remove if not |
| `globals: true` causes naming conflicts | Low | Low | If conflicts arise, switch to explicit imports in affected files only |

## Success Criteria

- All 115 test files pass with `vitest run`
- Coverage collection produces equivalent reports (text, lcov, html, json-summary)
- E2E tests pass after build
- `npm run quality` passes without modifications to test logic
- `jest`, `ts-jest`, and `@types/jest` fully removed from the project
- CI pipeline runs successfully with Vitest
- No test files skipped or disabled as part of migration
