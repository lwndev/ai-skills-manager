# Chore: Fix ESLint any Warning in Test

## Chore ID

`CHORE-002`

## GitHub Issue

https://github.com/lwndev/ai-skills-manager/issues/14

## Category

`refactoring`

## Description

Fix the `@typescript-eslint/no-explicit-any` warning in the install-formatter test file. The test intentionally uses `as any` to test the default case for an unknown stage value, which requires an eslint-disable comment to suppress the warning.

## Affected Files

- `tests/unit/formatters/install-formatter.test.ts`

## Acceptance Criteria

- [ ] No ESLint warnings when running `npm run lint`
- [ ] Test continues to verify default case behavior for unknown stage values
- [ ] All tests pass
