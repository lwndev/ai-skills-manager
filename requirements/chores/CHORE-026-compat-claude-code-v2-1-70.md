# Chore: Claude Code v2.1.70 Compatibility Review

## Chore ID

`CHORE-026`

## GitHub Issue

[#104](https://github.com/lwndev/ai-skills-manager/issues/104)

## Category

`configuration`

## Description

Review and address Claude Code v2.1.70 changes that affect ASM's skill system. This release fixes skill listing being re-injected on every `--resume` (~600 tokens saved per resume), which directly impacts how ASM validates that installed skills are properly loaded by Claude Code. ASM should verify its skill validation, installation, and discovery logic remains compatible with the optimized skill-listing behavior.

## Affected Files

- `src/generators/skill-discovery.ts` - verify discovery works correctly with optimized skill listing
- `src/commands/install.ts` - verify post-installation validation is compatible
- `src/commands/list.ts` - verify skill list command works against v2.1.70
- `tests/` - add or update tests confirming compatibility

## Acceptance Criteria

- [x] Verify ASM's skill validation logic post-installation correctly detects skills after the `--resume` skill-listing fix
- [x] Verify ASM's skill installation flow is compatible with the optimized skill-listing behavior
- [x] Test `asm list` command confirms skill discovery works as expected with v2.1.70
- [x] Review remaining changelog entries for any other impacts on ASM
- [x] All existing tests pass after changes (`npm run quality`)

## Completion

**Status:** `Completed`

**Completed:** 2026-03-07

**Pull Request:** [#108](https://github.com/lwndev/ai-skills-manager/pull/108)

## Notes

- The key change is that skill listing is no longer re-injected on every `--resume`, saving ~600 tokens per resume. This is an internal Claude Code optimization that shouldn't affect ASM's behavior, but validation is needed since ASM relies on Claude Code correctly loading installed skills.
- Several other fixes in this release (API 400 errors with proxy endpoints, empty model responses after ToolSearch, prompt-cache bust with MCP server instructions) are Claude Code internals that don't directly affect ASM's skill management functionality.
- Severity is high per the automated issue classification due to the skill-listing change.
- **Compatibility confirmed**: ASM operates entirely at the filesystem level (directory scanning, file I/O) for skill discovery, installation, and listing. The v2.1.70 `--resume` optimization is internal to Claude Code's conversation/prompt handling and has no interaction surface with ASM. All 3166 existing tests pass without modification.
