# Bug: Compatibility Length Validation Inconsistency

## Bug ID

`BUG-001`

## GitHub Issue

[#72](https://github.com/lwndev/ai-skills-manager/issues/72)

## Category

`logic-error`

## Severity

`low`

## Description

The compatibility field length validation differs between the interactive prompt and the CLI path. The interactive prompt validates against raw `value.length` (pre-trim), while the CLI's `validateCompatibility()` validates against `trimmed.length` (post-trim), causing inconsistent acceptance of whitespace-padded input near the 500-character limit.

## Steps to Reproduce

1. Run `asm scaffold` to enter interactive mode
2. At the compatibility prompt, enter a 498-character string padded with leading/trailing whitespace totaling >500 characters
3. Observe that the interactive prompt rejects the input with "Compatibility must be 500 characters or fewer."
4. Run the equivalent command via CLI flags: `asm scaffold --compatibility "<same padded string>"`
5. Observe that the CLI accepts the input (trims first, then checks the 498-char trimmed length)

## Expected Behavior

Both the interactive prompt and CLI should validate compatibility length consistently — trimming whitespace before checking the 500-character limit.

## Actual Behavior

The interactive prompt checks `value.length` (pre-trim) and rejects valid input that exceeds 500 characters only due to surrounding whitespace. The CLI trims first and correctly accepts the same input.

## Root Cause(s)

1. In `src/commands/scaffold-interactive.ts:225`, the compatibility validate function checks `value.length > 500` on the raw (untrimmed) input, while the CLI's `validateCompatibility()` in `src/commands/scaffold.ts:222` checks `trimmed.length > 500` after trimming. The interactive prompt should trim before checking the length limit.

## Affected Files

- `src/commands/scaffold-interactive.ts`

## Acceptance Criteria

- [ ] Interactive compatibility validation trims input before checking the 500-character length limit (RC-1)
- [ ] Behavior matches `validateCompatibility()` in `scaffold.ts` (RC-1)
- [ ] Test added for whitespace-padded input near the 500-char limit (RC-1)

## Completion

**Status:** `Pending`

**Completed:** YYYY-MM-DD

**Pull Request:** [#N](https://github.com/lwndev/ai-skills-manager/pull/N)

## Notes

- Found during code review of PR #68 (CHORE-013)
- Very minor edge case — unlikely to affect users in practice since compatibility values rarely approach the 500-character limit with significant whitespace padding
