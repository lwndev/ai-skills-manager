# Chore: Test Uninstall API Error Handling

## Chore ID

`CHORE-016`

## GitHub Issue

[#75](https://github.com/lwndev/ai-skills-manager/issues/75)

## Category

`refactoring`

## Description

Add unit tests for untested error handling branches in the uninstall API (`src/api/uninstall.ts`). The existing test file covers happy paths, batch operations, dry run, and security validation, but `handleGeneratorError()`, `handleCatchBlockError()`, and `mapScope()` have no direct unit test coverage, leaving branch coverage at ~40%.

## Affected Files

Source files (read-only reference):

- `src/api/uninstall.ts` — error mapping, catch-block handling, scope mapping
- `src/types/uninstall.ts` — `UninstallError` union type (6 named error types)
- `src/errors.ts` — public error classes (`SecurityError`, `FileSystemError`, `CancellationError`)

New/modified test files:

- `tests/unit/api/uninstall.test.ts` — add unit tests for error handling branches

## Acceptance Criteria

- [x] `handleGeneratorError()` tested for all 8 scenarios: skill-not-found → not-found, security-error → throw SecurityError, filesystem-error → throw FileSystemError, validation-error without force → not-found, validation-error with force → throw FileSystemError, partial-removal → throw FileSystemError, timeout → throw FileSystemError, unknown/default → not-found
- [x] `handleCatchBlockError()` tested for: known error re-throw (SecurityError, FileSystemError, CancellationError), internal CancellationError conversion (by name), EACCES mapping, EPERM mapping, unknown Error wrapping, and non-Error wrapping (string, null)
- [x] `mapScope()` tested indirectly via the public `uninstall()` API for 'personal', 'project', and undefined inputs
- [x] Detailed mode result structures verified for error scenarios (preserves `searchedPath` for not-found)
- [x] Uninstall API branch coverage reaches 75%+ (actual: 96.36%)
- [x] All tests pass via `npm run quality`

## Completion

**Status:** `Completed`

**Completed:** 2026-02-13

**Pull Request:** [#81](https://github.com/lwndev/ai-skills-manager/pull/81)

## Notes

- Existing test file (759 lines) already covers return types, batch ops, dry run, security validation, cancellation, force mode, scope options, and detailed mode results
- Type guard functions (`isUninstallSuccess`, `isUninstallNotFound`, `isUninstallDryRunPreview`) are already tested in `tests/unit/api/uninstall-type-guards.test.ts` (CHORE-014) — not in scope here
- The gap is specifically in the internal helper functions that map generator errors and OS-level exceptions to public error types
- **Mocking approach differs from CHORE-015**: the uninstall generator returns result objects (`{ success: false, error: { type: '...' } }`) rather than throwing. Mock `uninstallSkill` to **resolve** with error results for `handleGeneratorError` tests, and **reject** with thrown errors for `handleCatchBlockError` tests
- Must also mock `isDryRunPreview` and `getScopePath` from `../generators/uninstaller` when mocking the generator module
- Lines 255-256 (targetPath `else` branch for paths not ending in `.claude/skills`) are uncovered but out of scope for this chore
- Current baseline: 40% branch / 73% line coverage (measured with both `uninstall.test.ts` and `uninstall-type-guards.test.ts`)
