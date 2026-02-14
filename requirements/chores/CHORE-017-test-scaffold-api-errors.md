# Chore: Test Scaffold API Error Paths

## Chore ID

`CHORE-017`

## GitHub Issue

[#76](https://github.com/lwndev/ai-skills-manager/issues/76)

## Category

`refactoring`

## Description

Add unit tests for untested error handling branches and path resolution logic in the scaffold API (`src/api/scaffold.ts`). The existing test file covers happy paths, name validation, directory existence checks, and basic output path usage, but the catch block error mapping (EACCES, EPERM, ENOENT), scope-based path resolution without explicit output, template option mapping, and unknown error wrapping have no coverage — leaving branch coverage at ~32%.

## Affected Files

Source files (read-only reference):

- `src/api/scaffold.ts` — error catch block (lines 175-193), resolveOutputPath scope logic (lines 36-43), template option mapping (lines 149-162)
- `src/types/api.ts` — `ScaffoldOptions`, `ScaffoldTemplateOptions`, `ScaffoldTemplateType`
- `src/utils/error-helpers.ts` — `hasErrorCode()` helper
- `src/errors.ts` — `FileSystemError`, `SecurityError` classes
- `src/templates/skill-md.ts` — `generateSkillMd()`, `TemplateOptions`

New/modified test files:

- `tests/unit/api/scaffold.test.ts` — add unit tests for error handling, scope resolution, and template mapping

## Acceptance Criteria

- [ ] EACCES filesystem error tested: `fs.mkdir` or `fs.writeFile` throwing with `code: 'EACCES'` maps to `FileSystemError` with "Permission denied" message
- [ ] EPERM filesystem error tested: same pattern with `code: 'EPERM'` maps to `FileSystemError` with "Permission denied" message
- [ ] ENOENT filesystem error tested: error with `code: 'ENOENT'` maps to `FileSystemError` with "Parent directory does not exist" message
- [ ] Already-an-AsmError re-throw tested: `FileSystemError` and `SecurityError` thrown inside the try block are re-thrown without wrapping
- [ ] Unknown error wrapping tested: both branches of the ternary on line 192 — a plain `Error` (not an AsmError subclass, no error code) uses `error.message`, and non-Error values (string, null) use `String(error)` — both wrapped in `FileSystemError` with "Failed to create scaffold" message
- [ ] Template option mapping tested for all supported template types (`basic`, `forked`, `with-hooks`, `internal`) — verifies options pass through to `generateSkillMd`
- [ ] `resolveOutputPath` scope resolution tested without explicit output: `scope: 'personal'` uses personal skills dir, `scope: 'project'` (or undefined) uses project skills dir
- [ ] Scaffold API branch coverage reaches 70%+
- [ ] All tests pass via `npm run quality`

## Completion

**Status:** `Pending`

**Completed:** YYYY-MM-DD

**Pull Request:** [#N](https://github.com/lwndev/ai-skills-manager/pull/N)

## Notes

- Existing test file (512 lines, 40 tests) covers return types, directory structure, SKILL.md content, name validation (SecurityError), existing directory handling, output path options, scope option basics, and full workflow
- All existing scope tests pass `output` which takes precedence — the `resolveOutputPath` branches for scope-only resolution (lines 36-43) require mocking `getProjectSkillsDir`/`getPersonalSkillsDir` since no `output` can be provided
- Error handling tests require mocking `fs.mkdir` or `fs.writeFile` to throw specific error codes after the initial `directoryExists` check passes
- **Mocking approach**: mock `fs/promises` methods (`mkdir`, `writeFile`) to throw OS-level errors after the initial calls succeed. The catch block handles EACCES/EPERM/ENOENT before checking for already-wrapped AsmError types
- Current baseline: 32.25% branch / 76% statement / 100% function / 76% line coverage
