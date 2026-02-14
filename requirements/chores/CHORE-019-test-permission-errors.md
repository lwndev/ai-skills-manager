# Chore: Test Permission Errors for Install API

## Chore ID

`CHORE-019`

## GitHub Issue

[#78](https://github.com/lwndev/ai-skills-manager/issues/78)

## Category

`testing`

## Description

Add permission error tests (EACCES, EPERM) for the install API. The source code at `src/api/install.ts` already handles these errors by throwing `FileSystemError`, but no test covers that path. Tests should verify that filesystem permission failures surface appropriate errors and return descriptive messages.

Permission error tests for the other three APIs were already added by prior chores:

- **update** — covered by CHORE-015 (`tests/unit/api/update.test.ts`, lines 1348-1388)
- **uninstall** — covered by CHORE-016 (`tests/unit/api/uninstall.test.ts`, lines 1010-1036)
- **scaffold** — covered by CHORE-017 (`tests/unit/api/scaffold.test.ts`, lines 507-543, 668-687)

## Affected Files

- `tests/unit/api/install.test.ts` (add permission error test cases)

## Acceptance Criteria

- [ ] EACCES permission error test exists for install API
- [ ] EPERM permission error test exists for install API
- [ ] Tests verify `FileSystemError` is thrown with "Permission denied" message
- [x] Permission error test exists for update API (CHORE-015)
- [x] Permission error test exists for uninstall API (CHORE-016)
- [x] Permission error test exists for scaffold API (CHORE-017)
- [ ] All tests pass via `npm run quality`

## Completion

**Status:** `Pending`

**Completed:** YYYY-MM-DD

**Pull Request:** [#N](https://github.com/lwndev/ai-skills-manager/pull/N)

## Notes

- Each test should verify: correct error type (`FileSystemError`) is thrown and error message contains "Permission denied"
- The install API handles permissions at `src/api/install.ts:158-160` using `hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM')`
- Follow the mocked test pattern used by the other API test files
- Priority is low — improves real-world error path confidence
