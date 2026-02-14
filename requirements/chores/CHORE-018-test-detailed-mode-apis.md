# Chore: Test Detailed Mode APIs

## Chore ID

`CHORE-018`

## GitHub Issue

[#77](https://github.com/lwndev/ai-skills-manager/issues/77)

## Category

`testing`

## Description

Add unit tests covering the `{ detailed: true }` overloaded function signatures for the install, update, and uninstall APIs. These overloads return richer discriminated union result types that consumers depend on, but currently lack dedicated test coverage.

## Affected Files

- `tests/unit/api/install.test.ts` (add detailed mode test cases)
- `tests/unit/api/update.test.ts` (add detailed mode test cases)
- `tests/unit/api/uninstall.test.ts` (add detailed mode test cases)

## Acceptance Criteria

- [x] Install detailed mode tested (success + failure)
- [x] Update detailed mode tested (success + failure)
- [x] Uninstall detailed mode tested (success + failure)
- [x] Default mode verified to return simple result type
- [x] All tests pass via `npm run quality`

## Completion

**Status:** `Closed — Already Complete`

**Completed:** 2026-02-13

**Pull Request:** N/A — coverage already existed prior to chore creation

## Notes

- The detailed mode overloads use discriminated unions (e.g., `DetailedInstallResult`, `DetailedUpdateResult`, `DetailedUninstallResult`) with a `type` field for narrowing
- Type guard test files already exist separately in `tests/unit/api/*-type-guards.test.ts` — this chore covers runtime behavior, not type narrowing

### Resolution

Upon investigation, all acceptance criteria were already satisfied by existing tests. Every result subtype across all three APIs has dedicated test coverage:

**Install** (`tests/unit/api/install.test.ts`, lines 525–686):
- `install-success` — 2 tests + overwrite variant
- `install-dry-run-preview` — 1 test
- `install-overwrite-required` — 1 test
- Simple mode fallback — 2 tests

**Update** (`tests/unit/api/update.test.ts`, lines 601–737 + 1206–1310):
- `update-success` — 4 tests (basic, fields, keepBackup true/false)
- `update-dry-run-preview` — 1 test
- `update-rolled-back` — 1 mocked test
- `update-rollback-failed` — 1 mocked test
- `update-cancelled` — 1 mocked test
- Unexpected type error path — 1 test
- Simple mode fallback — 2 tests

**Uninstall** (`tests/unit/api/uninstall.test.ts`, lines 586–758 + 1147–1264):
- `success` — 1 test
- `not-found` — 1 test
- `dry-run-preview` — 1 test
- Multi-skill aggregation — 1 test
- Mixed results — 1 test
- Error paths in detailed mode — 5 mocked tests
- Simple mode fallback — 2 tests
