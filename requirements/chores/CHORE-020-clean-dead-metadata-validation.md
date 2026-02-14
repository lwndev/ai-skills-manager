# Chore: Clean Up Dead Metadata Validation Path

## Chore ID

`CHORE-020`

## GitHub Issue

[#69](https://github.com/lwndev/ai-skills-manager/issues/69)

## Category

`cleanup`

## Description

Remove the unreachable silent-skip code path in the interactive metadata validation of `scaffold-interactive.ts`. The `validate` function on the `input()` call rejected invalid `key=value` pairs before they could reach the parsing logic, making the downstream silent-skip branch dead code.

## Affected Files

- `src/commands/scaffold-interactive.ts`

## Acceptance Criteria

- [ ] No dead code path exists in the metadata parsing section of `scaffold-interactive.ts`
- [ ] Interactive metadata validation rejects invalid input at prompt time
- [ ] Tests pass after changes

## Completion

**Status:** `Completed`

**Completed:** 2026-02-14

**Pull Request:** [#87](https://github.com/lwndev/ai-skills-manager/pull/87)

## Notes

This chore was resolved as a side effect of PR #87 (commit `c204438`), which replaced the comma-splitting metadata parser with a multi-entry loop. The refactor eliminated the entire single-line parsing flow, including the dead silent-skip path. No standalone fix was needed.

**Dead code that was removed:** In the old code, the `validate` function on the `input()` call rejected any pair where `eqIndex <= 0` or the key was empty. The parsing logic below it re-checked `if (eqIndex > 0)` and `if (key.length > 0)` before storing — conditions guaranteed true by the validator. Those guards were unreachable. PR #87 replaced the entire flow with a multi-entry loop that has no redundant checks.

**Issue #70 (CHORE-021):** PR #87 also substantially addresses issue #70 (multi-entry loop UX). Four of five acceptance criteria are met; the one divergence is criterion 3 ("empty input exits the loop") — the implementation uses a `confirm('Add another metadata entry?')` prompt to control the loop instead of empty-input-to-exit. This is an intentional design choice (explicit confirmation over implicit empty-string signaling) but differs from the criterion as written. Issue #70 should be reviewed for closure with this noted.
