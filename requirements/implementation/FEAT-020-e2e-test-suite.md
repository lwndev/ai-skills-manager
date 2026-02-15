# Implementation Plan: E2E Test Suite & Manual Test Plan

## Overview

Implement a comprehensive end-to-end test suite (100 tests across 8 test files) and a manual test plan (225+ test cases) for all ASM CLI commands. All e2e tests invoke the CLI via `node dist/cli.js` — no direct API imports — ensuring true end-to-end coverage of exit codes, output modes, and cross-command workflows.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-020 | [#88](https://github.com/lwndev/ai-skills-manager/issues/88) | [FEAT-020-e2e-test-suite.md](../features/FEAT-020-e2e-test-suite.md) | Medium | Medium | Complete |

## Recommended Build Sequence

### Phase 1: Manual Test Plan & Shared Helpers
**Feature:** [FEAT-020](../features/FEAT-020-e2e-test-suite.md) | [#88](https://github.com/lwndev/ai-skills-manager/issues/88)
**Status:** ✅ Complete

#### Rationale
- **Document first**: The manual test plan establishes the full test matrix that the automated suite draws from
- **Shared foundation**: The helpers module is required by all subsequent test files

#### Implementation Steps

1. Create `docs/asm/manual-test-plan.md`
   - Document test cases for all 7 commands organized by category
   - Include command examples, expected results, and exit codes
   - Document end-to-end workflow test cases (lifecycle, cross-scope, spec preservation)
   - Include cleanup instructions and environment notes

2. Create `tests/e2e/helpers.ts`
   - `runCli(args, options?)` — wraps `execSync` with try/catch to capture exit codes without throwing
   - `scaffoldSkill(name, outputDir, extraFlags?)` — scaffold via CLI, return result + skill dir
   - `packageSkill(skillDir, outputDir, extraFlags?)` — package via CLI, return result + package path
   - `createSkillManually(baseDir, name, frontmatter, body?)` — write SKILL.md with custom YAML frontmatter
   - `createTempDir(prefix?)` — `fs.mkdtemp` wrapper
   - `cleanupDir(dir)` — `fs.rm` wrapper
   - Internal `formatYamlValue(value)` — format values for YAML output

#### Key Design Decisions

- **`runCli` never throws**: Non-zero exit codes are captured in the result object, not thrown as errors. This allows tests to assert on specific exit codes cleanly.
- **`createSkillManually` uses a simple YAML serializer**: Rather than depending on a YAML library, the helper writes frontmatter directly with support for scalars, arrays, and nested objects. This keeps the e2e test dependencies minimal.
- **All helpers use the compiled CLI**: `CLI_PATH` points to `dist/cli.js`, requiring `npm run build` before running e2e tests.

#### Deliverables
- [x] `docs/asm/manual-test-plan.md`
- [x] `tests/e2e/helpers.ts`

---

### Phase 2: Independent Command Tests (scaffold, validate, package)
**Feature:** [FEAT-020](../features/FEAT-020-e2e-test-suite.md) | [#88](https://github.com/lwndev/ai-skills-manager/issues/88)
**Status:** ✅ Complete

#### Rationale
- **No cross-command dependencies**: Scaffold tests are self-contained, validate tests use `createSkillManually` or `scaffoldSkill`, and package tests depend only on scaffold
- **Highest test count**: These three files contribute 58 of 100 total tests, providing the majority of coverage early

#### Implementation Steps

1. Create `tests/e2e/scaffold.e2e.test.ts` (25 tests)
   - Template types: basic, forked (context:fork + tools), with-hooks, internal (user-invocable:false), invalid template error
   - Spec fields: `--license`, `--compatibility`, `--metadata` multi-entry, all combined, metadata with equals in value
   - Removed fields: `--model` rejected, `--memory` rejected
   - Additional options: `--no-user-invocable`, `--argument-hint`, `--minimal`, `--context fork`, `--agent`, `--hooks`
   - Validation edge cases: name too long, argument-hint too long, reserved words ("claude", "anthropic"), description too long, compatibility too long, empty metadata key

2. Create `tests/e2e/validate.e2e.test.ts` (25 tests)
   - Spec field validation: valid license/compat/metadata (via `scaffoldSkill`), compat too long/non-string/empty (via `createSkillManually`)
   - Claude Code 2.1.x fields: valid/invalid context, agent, hooks, user-invocable, argument-hint
   - FEAT-014 fields: valid/invalid version, tools, color (named colors only), keep-coding-instructions, disable-model-invocation

3. Create `tests/e2e/package.e2e.test.ts` (8 tests)
   - CLI packaging: package via CLI, custom output dir, quiet mode
   - Error cases: invalid skill (exit 1), non-existent path (exit 2)
   - Exit code verification: 0, 1, 2

#### Key Design Decisions

- **Validate tests use both `scaffoldSkill` and `createSkillManually`**: Valid-field tests scaffold via CLI (testing the happy path), while invalid-field tests create SKILL.md manually with intentionally malformed frontmatter.
- **Color field accepts named colors only**: The validator accepts `blue`, `cyan`, `green`, `yellow`, `magenta`, `red` — not hex codes. Tests use named colors for valid cases.
- **YAML numeric values**: Metadata values like `version=1.0` are stored as `version: 1.0` (YAML number), not `version: "1.0"` (quoted string). Assertions match actual output.

#### Deliverables
- [x] `tests/e2e/scaffold.e2e.test.ts` — 25 tests
- [x] `tests/e2e/validate.e2e.test.ts` — 25 tests
- [x] `tests/e2e/package.e2e.test.ts` — 8 tests

---

### Phase 3: Dependent Command Tests (install, list, uninstall, update)
**Feature:** [FEAT-020](../features/FEAT-020-e2e-test-suite.md) | [#88](https://github.com/lwndev/ai-skills-manager/issues/88)
**Status:** ✅ Complete

#### Rationale
- **Pipeline dependencies**: Install requires scaffold + package; list requires install; update requires install + new package; uninstall requires install
- **Each file has internal helpers**: `preparePackage()`, `installSkillForTest()`, `installSkillToProject()`, `setupUpdate()` encapsulate the multi-step setup

#### Implementation Steps

1. Create `tests/e2e/install.e2e.test.ts` (7 tests)
   - `preparePackage(name)` helper: scaffold + package in one call
   - CLI install: install with `--force` to custom path, `--dry-run`, `--quiet`
   - Error cases: non-existent package (exit 2), invalid package (non-zero exit)
   - Post-install: validate after install, list after install

2. Create `tests/e2e/list.e2e.test.ts` (10 tests)
   - `installSkillToProject(name, extraFlags?)` helper: scaffold + package + install to `projectDir/.claude/skills/`
   - Basic listing: list all, `ls` alias, project only, no skills message, invalid scope (exit 1)
   - Output modes: JSON array (`-j`), quiet names only (`-q`), JSON with scope filter
   - Display: long description truncation, version from metadata

3. Create `tests/e2e/uninstall.e2e.test.ts` (9 tests)
   - `installSkillForTest(name)` helper: scaffold + package + install to project scope
   - Security: invalid characters (exit 5), uppercase name (exit 5), absolute path (exit 5), path traversal (exit 5)
   - Error cases: non-existent skill (exit 1), custom scope rejected (exit 5), quiet without force (non-zero)
   - Basic: force uninstall, dry-run

4. Create `tests/e2e/update.e2e.test.ts` (9 tests)
   - `setupUpdate(name)` helper: install v1 + scaffold/package v2, returns `{ projectDir, newPkg }`
   - CLI update: update with `--force`, `--dry-run`, `--quiet`
   - Backup flags: `--keep-backup`, `--no-backup`
   - Error cases: skill not found (exit 1), invalid package (exit 4), security violation (exit 5), quiet without force (non-zero)

#### Key Design Decisions

- **Install error codes differ from manual test plan**: The CLI returns exit 2 (FS error) for invalid ZIP files rather than exit 3 (extraction error) because the installer's package-opening step treats unreadable files as a FS error. Tests assert `toBeGreaterThanOrEqual(1)` for this case.
- **Quiet-without-force exits vary by context**: When `--quiet` is used without `--force`, the exit code depends on whether the skill exists (exit 1 = not found) vs. confirmation blocked (exit 3 = cancelled). Tests assert non-zero rather than a specific code.
- **List "no skills" requires existing directory**: The `list` command exits 0 with "No skills installed" only when the CWD exists. Tests create the empty project directory before running.
- **Version display truncation**: Metadata `version=2.0` is stored as YAML number `2.0` and displayed as `(v2)` by the list formatter. Tests use a regex to match both `2` and `2.0`.

#### Deliverables
- [x] `tests/e2e/install.e2e.test.ts` — 7 tests
- [x] `tests/e2e/list.e2e.test.ts` — 10 tests
- [x] `tests/e2e/uninstall.e2e.test.ts` — 9 tests
- [x] `tests/e2e/update.e2e.test.ts` — 9 tests

---

### Phase 4: Lifecycle & Cross-Command Workflows
**Feature:** [FEAT-020](../features/FEAT-020-e2e-test-suite.md) | [#88](https://github.com/lwndev/ai-skills-manager/issues/88)
**Status:** ✅ Complete

#### Rationale
- **Full chain validation**: The lifecycle test exercises every command in sequence, catching integration issues that individual command tests miss
- **Implemented last**: Depends on all other commands working correctly

#### Implementation Steps

1. Create `tests/e2e/lifecycle.e2e.test.ts` (7 tests)
   - Full lifecycle: scaffold → validate → package → install → list → update → uninstall, verifying each step and final cleanup
   - Cross-scope: install to both project and personal, verify coexistence; uninstall from one scope, verify other preserved
   - Spec field preservation: scaffold with license/compat/metadata, verify fields survive package → install → validate cycle
   - FEAT-014 field preservation: manually create skill with version/tools/color/keep-coding-instructions/disable-model-invocation, verify fields survive full lifecycle
   - Output consistency: quiet mode across scaffold/validate/package/install/list/uninstall; JSON mode across validate/list

#### Key Design Decisions

- **FEAT-014 lifecycle uses `createSkillManually`**: Since `scaffold` doesn't emit FEAT-014 fields, the test creates SKILL.md manually, then runs it through the package → install → validate pipeline.
- **Color uses named value**: The FEAT-014 lifecycle test uses `color: blue` (not hex), matching validator requirements.

#### Deliverables
- [x] `tests/e2e/lifecycle.e2e.test.ts` — 7 tests

---

### Phase 5: Verification
**Feature:** [FEAT-020](../features/FEAT-020-e2e-test-suite.md) | [#88](https://github.com/lwndev/ai-skills-manager/issues/88)
**Status:** ✅ Complete

#### Implementation Steps

1. `npm run build` — required before e2e tests
2. `npm test -- tests/e2e/` — all 100 e2e tests pass
3. `npm run quality` — full suite passes (lint + 3261 tests + audit)

#### Deliverables
- [x] All 100 e2e tests pass
- [x] All 115 test suites pass (including 8 new e2e suites)
- [x] `npm run quality` passes with 0 vulnerabilities

---

## Code Organization

```
docs/asm/
└── manual-test-plan.md                -- 225+ manual test cases, v1.7.0

tests/e2e/
├── helpers.ts                         -- Shared utilities (runCli, scaffoldSkill, etc.)
├── scaffold.e2e.test.ts               -- 25 tests: templates, spec fields, options, edge cases
├── validate.e2e.test.ts               -- 25 tests: spec, 2.1.x, FEAT-014 fields
├── package.e2e.test.ts                -- 8 tests: packaging, exit codes, quiet mode
├── install.e2e.test.ts                -- 7 tests: install, errors, post-install verification
├── uninstall.e2e.test.ts              -- 9 tests: security, errors, basic operations
├── update.e2e.test.ts                 -- 9 tests: update, backup flags, errors
├── list.e2e.test.ts                   -- 10 tests: listing, output modes, display
└── lifecycle.e2e.test.ts              -- 7 tests: full lifecycle, cross-scope, spec preservation
```

## Testing Strategy

All e2e tests share these characteristics:

- **True CLI invocation**: Every test runs `node dist/cli.js` — no direct imports of application code
- **Temp directory isolation**: Created in `beforeEach`, cleaned in `afterEach`
- **Non-interactive**: All tests use `--force`/`--quiet` flags; no TTY prompts
- **Exit code verification**: Tests assert exact exit codes for known cases, `toBeGreaterThanOrEqual(1)` for context-dependent failures
- **No jest config changes**: `tests/e2e/*.test.ts` matches the existing `testMatch: ['**/*.test.ts']` pattern

### Test Counts by File

| File | Tests |
|------|-------|
| `scaffold.e2e.test.ts` | 25 |
| `validate.e2e.test.ts` | 25 |
| `package.e2e.test.ts` | 8 |
| `install.e2e.test.ts` | 7 |
| `list.e2e.test.ts` | 10 |
| `uninstall.e2e.test.ts` | 9 |
| `update.e2e.test.ts` | 9 |
| `lifecycle.e2e.test.ts` | 7 |
| **Total** | **100** |

## Dependencies and Prerequisites

### Required Before Running
- `npm run build` — e2e tests invoke the compiled `dist/cli.js`

### No New Dependencies
- No changes to `jest.config.js`
- No new npm packages
- No changes to application source code

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Exit codes change in future CLI updates | Medium | Medium | Tests document expected codes; easy to update |
| Temp directory cleanup fails, leaving artifacts | Low | Low | `afterEach` uses `force: true`; OS cleans `/tmp` periodically |
| Tests slow down CI pipeline | Low | Medium | 100 tests complete in ~8 seconds; parallelizable by file |
| False negatives from output format changes | Low | Medium | Tests assert on key content/patterns, not exact output strings |

## Success Criteria

- [x] Manual test plan documents 225+ test cases across all 7 commands
- [x] 100 automated e2e tests pass across 8 test files
- [x] All tests use `node dist/cli.js` (true end-to-end)
- [x] All tests use temp directories with cleanup
- [x] No jest config or application source changes required
- [x] `npm run quality` passes (lint + 3261 tests + audit, 0 vulnerabilities)
