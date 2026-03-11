# Chore: Standardize Permission Error Test Assertions

## Chore ID

`CHORE-028`

## GitHub Issue

[#84](https://github.com/lwndev/ai-skills-manager/issues/84)

## Category

`refactoring`

## Description

Standardize the permission error test assertion pattern across API test files. Currently, install and update tests use `try/catch` + `fail()` while uninstall tests use `.catch()` + inline assertion. Pick one pattern and apply it uniformly for consistency across the test suite.

## Affected Files

- `tests/unit/api/install.test.ts` - uses `try/catch` + `fail()` pattern
- `tests/unit/api/update.test.ts` - uses `try/catch` + `fail()` pattern
- `tests/unit/api/uninstall.test.ts` - uses `.catch()` + inline assertion pattern
- `tests/unit/api/scaffold.test.ts` - check and align to chosen pattern

## Acceptance Criteria

- [ ] All permission error tests across the four API test files use the same assertion pattern
- [ ] No mixed assertion styles remain for permission error checks
- [ ] All tests pass after changes (`npm run quality`)

## Completion

**Status:** `Completed`

**Completed:** 2026-03-11

**Pull Request:** [#113](https://github.com/lwndev/ai-skills-manager/pull/113)

## Notes

- Originated from PR #83 code review (observation #1)
- Both patterns are functionally correct; this is a cosmetic consistency improvement
- Low priority — no behavioral change expected
