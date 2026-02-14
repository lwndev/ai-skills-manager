# Chore: Test Update API Coverage

## Chore ID

`CHORE-015`

## GitHub Issue

[#74](https://github.com/lwndev/ai-skills-manager/issues/74)

## Category

`refactoring`

## Description

Add unit tests for the update API layer (`src/api/update.ts`) to raise function coverage from ~23% to 80%+. Tests should cover `mapUpdateError` error code mappings, result transformation functions (success and failure paths), and rollback logic (triggered and skipped scenarios).

## Affected Files

Source files (read-only reference):

- `src/api/update.ts` — error mapping, result transformation, rollback logic

New test files:

- `tests/unit/api/update.test.ts` — unit tests for update API functions

## Acceptance Criteria

- [x] `mapUpdateError` tested for all mapped error codes
- [x] Result transformation tested for success and failure branches
- [x] Rollback logic tested for trigger conditions and skip conditions
- [x] Update API function coverage reaches 80%+
- [x] All tests pass via `npm run quality`

## Completion

**Status:** `Completed`

**Completed:** 2026-02-13

**Pull Request:** [#80](https://github.com/lwndev/ai-skills-manager/pull/80)

## Notes

- Current update API function coverage is ~23.52%
- The update module is the most complex API module with 5 result types, error mapping, and rollback orchestration
- Type guard tests were already added in CHORE-014; this chore focuses on the functional logic
