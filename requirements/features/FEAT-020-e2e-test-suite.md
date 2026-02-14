# Feature Requirements: E2E Test Suite & Manual Test Plan

## Overview

Add a comprehensive end-to-end test suite and manual test plan covering all 7 ASM CLI commands (`scaffold`, `validate`, `package`, `install`, `uninstall`, `update`, `list`) plus cross-command lifecycle workflows. Existing integration tests primarily test through direct API calls — this feature fills the gap by testing every command via `node dist/cli.js`, verifying exit codes, output modes, and cross-command workflows.

## Feature ID

`FEAT-020`

## GitHub Issues

- https://github.com/lwndev/ai-skills-manager/issues/88

## Priority

Medium — Quality assurance and regression prevention for v1.7.0 release

## User Story

As a maintainer, I want automated e2e tests that invoke the CLI binary directly so that regressions in exit codes, output formatting, and cross-command workflows are caught before release.

## Functional Requirements

### FR-1: Manual Test Plan

Create a structured manual test plan (`docs/asm/manual-test-plan.md`) documenting 225+ test cases organized by command, covering:

| Command | Test Cases | Coverage Areas |
|---------|-----------|----------------|
| `scaffold` | 88 | Basic scaffolding, template types, spec fields, removed fields, additional options, validation edge cases, interactive mode |
| `validate` | 46 | Valid/invalid skills, output modes, spec field validation, 2.1.x fields, FEAT-014 fields, check order |
| `package` | 22 | Basic packaging, error cases, package contents, exit codes |
| `install` | 21 | Basic installation, conflict detection, error cases, post-install verification |
| `uninstall` | 26 | Basic uninstall, batch operations, security checks, error cases |
| `update` | 16 | Basic update, backup behavior, rollback, error cases |
| `list` | 28 | Basic listing, output modes, recursive discovery, display formatting |
| **E2E workflows** | 8 | Full lifecycle, cross-scope, spec field preservation, output consistency |

Each test case includes: test number, description, command/steps, and expected result.

### FR-2: Shared E2E Test Helpers

Create `tests/e2e/helpers.ts` providing:

- `runCli(args, options?)` — Runs `node dist/cli.js <args>`, returns `{ stdout, stderr, exitCode }` without throwing on non-zero exit
- `scaffoldSkill(name, outputDir, extraFlags?)` — Scaffold via CLI, returns result and skill directory path
- `packageSkill(skillDir, outputDir, extraFlags?)` — Package via CLI, returns result and package path
- `createSkillManually(baseDir, name, frontmatter, body?)` — Creates SKILL.md with custom YAML frontmatter for testing validation edge cases
- `createTempDir(prefix?)` — Creates a temporary directory
- `cleanupDir(dir)` — Removes a temporary directory

### FR-3: Scaffold E2E Tests

Automated tests covering:
- Template types: basic, forked, with-hooks, internal, invalid template error
- Spec fields: `--license`, `--compatibility`, `--metadata` (multi-entry, equals in value), all combined
- Removed fields: `--model` rejected, `--memory` rejected
- Additional options: `--no-user-invocable`, `--argument-hint`, `--minimal`, `--context`, `--agent`, `--hooks`
- Validation edge cases: name too long, argument-hint too long, reserved words, description too long, compatibility too long, empty metadata key

### FR-4: Validate E2E Tests

Automated tests covering:
- Spec field validation: valid license/compat/metadata, compat too long, compat non-string, compat empty
- Claude Code 2.1.x fields: valid/invalid context, agent, hooks, user-invocable, argument-hint
- FEAT-014 fields: valid/invalid version, tools, color, keep-coding-instructions, disable-model-invocation

### FR-5: Package E2E Tests

Automated tests covering:
- CLI packaging: package via CLI, custom output dir, quiet mode
- Error cases: invalid skill (exit 1), non-existent path (exit 2)
- Exit code verification: 0 (success), 1 (validation failure), 2 (FS error)

### FR-6: Install E2E Tests

Automated tests covering:
- CLI install: install with `--force`, `--dry-run`, `--quiet`, custom path
- Error cases: non-existent package (exit 2), invalid package (non-zero exit)
- Post-install: validate after install, list after install

### FR-7: Uninstall E2E Tests

Automated tests covering:
- Security: invalid characters (exit 5), uppercase name (exit 5), absolute path (exit 5), path traversal (exit 5)
- Error cases: non-existent skill (exit 1), custom scope rejected (exit 5), quiet without force (non-zero)
- Basic: force uninstall, dry-run

### FR-8: Update E2E Tests

Automated tests covering:
- CLI update: update with `--force`, `--dry-run`, `--quiet`
- Backup flags: `--keep-backup`, `--no-backup`
- Error cases: skill not found (exit 1), invalid package (exit 4), security violation (exit 5), quiet without force (non-zero)

### FR-9: List E2E Tests

Automated tests covering:
- Basic listing: list all, `ls` alias, project only, no skills message, invalid scope (exit 1)
- Output modes: JSON array, quiet (names only), JSON with scope filter
- Display: long description truncation, version from metadata

### FR-10: Lifecycle E2E Tests

Automated tests covering:
- Full lifecycle: scaffold → validate → package → install → list → update → uninstall
- Cross-scope: project+personal coexist, scope-specific uninstall preserves other scope
- Spec field preservation: license/compat/metadata survive full lifecycle, FEAT-014 fields survive
- Output consistency: quiet mode across all commands, JSON mode across JSON-capable commands

## Non-Functional Requirements

### NFR-1: Test Isolation

- All tests use temporary directories created in `beforeEach` and cleaned up in `afterEach`
- No test modifies or depends on the real `~/.claude/skills/` or `.claude/skills/` directories
- Tests are safe to run in CI environments

### NFR-2: Non-Interactive Execution

- All tests use `--force` and/or `--quiet` flags to avoid interactive prompts
- Tests must pass in non-TTY environments (CI, piped output)

### NFR-3: No Configuration Changes

- No changes to `jest.config.js` — `tests/e2e/*.test.ts` is auto-discovered by the existing `testMatch` pattern
- No new npm dependencies

### NFR-4: Quality Gate

- `npm run quality` must pass with all e2e tests included (lint + test:coverage + audit)

## Testing Requirements

This feature IS the testing deliverable. Success is measured by:
- All e2e tests pass (`npm test -- tests/e2e/`)
- Full quality check passes (`npm run quality`)
- No regressions in existing test suites

## Acceptance Criteria

- [x] Manual test plan covers all 7 commands with 225+ documented test cases
- [x] Shared helpers module provides `runCli`, `scaffoldSkill`, `packageSkill`, `createSkillManually`
- [x] Scaffold e2e tests: 25 passing tests covering templates, spec fields, options, edge cases
- [x] Validate e2e tests: 25 passing tests covering spec, 2.1.x, and FEAT-014 fields
- [x] Package e2e tests: 8 passing tests covering packaging and exit codes
- [x] Install e2e tests: 7 passing tests covering install, errors, post-install verification
- [x] Uninstall e2e tests: 9 passing tests covering security, errors, basic operations
- [x] Update e2e tests: 9 passing tests covering update, backup flags, errors
- [x] List e2e tests: 10 passing tests covering listing, output modes, display
- [x] Lifecycle e2e tests: 7 passing tests covering full lifecycle, cross-scope, spec preservation
- [x] 100 total e2e tests passing
- [x] `npm run quality` passes (3261 total tests, 115 test suites)
