# Chore: Add Depth Limit Warning

## Chore ID

`CHORE-008`

## GitHub Issue

[#42](https://github.com/lwndev/ai-skills-manager/issues/42)

## Category

`refactoring`

## Description

When using `asm list --recursive --depth N`, add a warning to inform users if the traversal reached max depth while subdirectories still exist that could potentially contain `.claude/skills` directories. This improves UX by making the depth limit behavior transparent.

## Affected Files

- `src/utils/nested-discovery.ts`
- `src/commands/list.ts`

## Acceptance Criteria

- [x] `findNestedSkillDirectories` returns whether any directories were skipped due to depth limits
- [x] `asm list --recursive --depth N` displays a warning when depth limit prevents scanning subdirectories
- [x] Warning message includes suggestion to increase depth (e.g., "Use --depth <N> to increase the search depth")
- [x] No warning displayed when all directories are fully scanned
- [x] Existing tests continue to pass
- [x] New tests added for depth-limit warning behavior

## Completion

**Status:** `Completed`

**Completed:** 2026-01-30

**Pull Request:** [#46](https://github.com/lwndev/ai-skills-manager/pull/46)

## Notes

- This is a low-priority UX enhancement from PR #41 review feedback
- Related to FEAT-012 (nested skill discovery)
- The warning should only appear when using `--recursive` and a directory was actually skipped
