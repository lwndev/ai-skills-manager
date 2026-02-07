# Chore: Include depthLimitReached in JSON Output

## Chore ID

`CHORE-009`

## GitHub Issue

[#47](https://github.com/lwndev/ai-skills-manager/issues/47)

## Category

`refactoring`

## Description

Change the `asm list --recursive --json` output from a raw skills array to a structured object that includes `depthLimitReached` metadata. PR #46 added depth limit tracking to `ListResult`, but the JSON output currently only serializes the skills array, discarding the metadata.

## Affected Files

- `src/commands/list.ts`
- `tests/commands/list.test.ts`

## Acceptance Criteria

- [ ] `asm list --json` outputs `{ "skills": [...], "depthLimitReached": false }` when `--recursive` is used
- [ ] `asm list --json` without `--recursive` continues to output a plain skills array (no breaking change for non-recursive usage)
- [ ] `depthLimitReached` is `true` when depth limit is reached during recursive scan
- [ ] Existing tests updated to reflect the new JSON structure
- [ ] `npm run quality` passes

## Completion

**Status:** `Completed`

**Completed:** 2026-02-06

**Pull Request:** [#50](https://github.com/lwndev/ai-skills-manager/pull/50)

## Notes

- This is a minor breaking change for JSON consumers of `--recursive` output who expect a raw array
- Since `--recursive` is a relatively new feature (FEAT-012), impact should be minimal
- Consider conditionally wrapping in an object only when `--recursive` is used to minimize breakage for non-recursive consumers
- Related: PR #46 (depth limit warning), CHORE-008 (depth limit warning implementation)
