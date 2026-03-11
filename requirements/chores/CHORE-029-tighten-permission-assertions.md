# Chore: Tighten Permission Error Assertions

## Chore ID

`CHORE-029`

## GitHub Issue

[#85](https://github.com/lwndev/ai-skills-manager/issues/85)

## Category

`refactoring`

## Description

Tighten permission error message assertions in update and scaffold API tests to verify that the file path or skill name appears in the error, not just the generic "Permission denied" string. The uninstall tests already follow this pattern using `.toMatch(/Permission denied.*"test-skill"/)`, and the other API tests should be consistent.

## Affected Files

- `tests/unit/api/update.test.ts` — permission error tests
- `tests/unit/api/scaffold.test.ts` — permission error tests

## Acceptance Criteria

- [x] Permission error assertions in `update.test.ts` verify the file path or skill name in the error message (not just `'Permission denied'`)
- [x] Permission error assertions in `scaffold.test.ts` verify the file path or skill name in the error message (not just `'Permission denied'`)
- [x] Assertion pattern is consistent with the existing uninstall test approach (`.toMatch(/Permission denied.*"<name>"/)`)
- [x] All tests pass (`npm test`)

## Completion

**Status:** `Completed`

**Completed:** 2026-03-11

**Pull Request:** [#115](https://github.com/lwndev/ai-skills-manager/pull/115)

## Notes

- Originated from PR #83 code review (observation #3)
- Low priority — improves assertion specificity without changing behavior
- Milestone: 1.8.1
