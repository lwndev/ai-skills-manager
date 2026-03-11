# Chore: Convert Remaining .catch() Inline Assertions

## Chore ID

`CHORE-031`

## GitHub Issue

_(Create issue if needed)_

## Category

`refactoring`

## Description

CHORE-028 standardized permission error assertion patterns across API test files but missed 7 `.catch((e: unknown) => e)` inline assertions remaining in `uninstall.test.ts`. Convert these to the `try/catch` + `fail()` pattern used consistently in the other three API test files (`install.test.ts`, `update.test.ts`, `scaffold.test.ts`).

## Affected Files

- `tests/unit/api/uninstall.test.ts` — lines 831, 854, 913, 933, 1047, 1059, 1071

## Acceptance Criteria

- [x] All 7 `.catch((e: unknown) => e)` patterns in `uninstall.test.ts` are converted to `try/catch` + `fail()` style
- [x] No `.catch((e: unknown) => e)` patterns remain in any of the four API test files (`install`, `update`, `uninstall`, `scaffold`)
- [x] All permission error tests across the four API test files use the same assertion pattern (CHORE-028 AC1)
- [x] No mixed assertion styles remain for permission error checks (CHORE-028 AC2)
- [x] All tests pass (`npm run quality`) (CHORE-028 AC3)
- [x] CHORE-028 acceptance criteria checkboxes are marked complete in `requirements/chores/CHORE-028-standardize-permission-assertions.md`

## Completion

**Status:** `Completed`

**Completed:** 2026-03-11

**Pull Request:** [#N](https://github.com/lwndev/ai-skills-manager/pull/N)

## Notes

- Follow-up to CHORE-028 (PR #113), which standardized most but not all assertion patterns
- The `.catch()` pattern is functionally correct but inconsistent with the `try/catch` + `fail()` convention used across the rest of the API test suite
- Pure cosmetic consistency improvement — no behavioral change expected
