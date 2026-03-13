# Chore: Compat Claude Code v2.1.74

## Chore ID

`CHORE-033`

## GitHub Issue

[#120](https://github.com/lwndev/ai-skills-manager/issues/120)

## Category

`refactoring`

## Description

Review and update ASM's `allowed-tools` validation, scaffolding, and documentation to reflect Claude Code v2.1.74's behavioral change where skill `allowed-tools` can no longer bypass managed policy `ask` rules. This ensures ASM's validators warn skill authors about the new enforcement semantics and scaffolded templates include appropriate guidance.

## Affected Files

- `src/validators/allowed-tools.ts`
- `src/generators/validate.ts`
- `src/templates/skill-md.ts`

## Acceptance Criteria

- [x] Review `src/validators/allowed-tools.ts` — determine if validation rules need updating to reflect that `allowed-tools` cannot override managed policy `ask` rules
- [x] Review `src/generators/validate.ts` (around line 270) — check if validation feedback or warnings should inform skill authors of this constraint
- [x] Review `src/templates/skill-md.ts` (lines 77, 179, 183) — update scaffolded templates or inline comments to note that `allowed-tools` cannot override managed policy `ask` rules
- [x] `npm run quality` passes after changes

## Completion

**Status:** `Completed`

**Completed:** 2026-03-13

**Pull Request:** [#122](https://github.com/lwndev/ai-skills-manager/pull/122)

## Notes

- Severity: medium
- Milestone: 1.8.2
- This is a compatibility update triggered by Claude Code v2.1.74's fix for managed policy `ask` rules being bypassed by skill `allowed-tools`
- The change is behavioral (runtime enforcement), so ASM's validation and scaffolding may only need documentation/warning updates rather than logic changes
- See the [full changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) for additional context
