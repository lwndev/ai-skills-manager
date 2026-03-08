# Chore: Claude Code v2.1.71 Compatibility Review

## Chore ID

`CHORE-027`

## GitHub Issue

[#105](https://github.com/lwndev/ai-skills-manager/issues/105)

## Category

`configuration`

## Description

Review and address Claude Code v2.1.71 changes that affect ASM's skill system. This release changes plugin installation to use `.claude/settings.local.json` for project-scoped plugins instead of `.claude/settings.json`, and improves plugin deduplication logic. ASM should verify its skill discovery, installation, and settings management remain compatible with the new settings file behavior.

## Affected Files

- `src/generators/skill-discovery.ts` - verify discovery handles both `settings.json` and `settings.local.json`
- `src/commands/install.ts` - verify installation is compatible with new plugin settings behavior
- `src/commands/uninstall.ts` - verify uninstall handles the new settings file path
- `src/commands/list.ts` - verify skill listing works against v2.1.71
- `tests/` - add or update tests confirming compatibility

## Acceptance Criteria

- [x] Verify ASM's skill discovery correctly detects skills regardless of whether plugins are configured in `settings.json` or `settings.local.json`
- [x] Verify ASM's skill installation flow is compatible with the new `.claude/settings.local.json` behavior for project-scoped plugins
- [x] Verify ASM's uninstall flow handles skills/plugins in both settings file locations
- [x] Review plugin deduplication changes for any impact on ASM's skill packaging or delivery
- [x] Review remaining changelog entries for any other impacts on ASM
- [x] All existing tests pass after changes (`npm run quality`)

## Completion

**Status:** `Completed`

**Completed:** 2026-03-07

**Pull Request:** [#109](https://github.com/lwndev/ai-skills-manager/pull/109)

## Notes

- The key change is that `/plugin uninstall` now disables project-scoped plugins in `.claude/settings.local.json` instead of modifying `.claude/settings.json`, so changes don't affect teammates. If ASM reads or writes plugin configuration from `settings.json`, it may need to also check `settings.local.json`.
- Plugin deduplication now skips servers that duplicate a manually-configured server (same command/URL). This could affect ASM if it relies on plugin-based skill delivery where duplicate server detection is relevant.
- Severity is medium per the automated issue classification due to the settings file path change and plugin deduplication behavior.
- Several other fixes in this release (stdin freeze, CoreAudio startup freeze, OAuth reconnection, `/fork` plan sharing) are Claude Code internals that don't directly affect ASM's skill management functionality.
- **Compatibility confirmed**: ASM does not read or write `settings.json` or `settings.local.json` — it operates entirely at the filesystem level (directory scanning, file I/O in `.claude/skills/` and `~/.claude/skills/`). The v2.1.71 change to use `settings.local.json` for project-scoped plugin configuration is internal to Claude Code's plugin system and has no interaction surface with ASM's skill management. Plugin deduplication is also a Claude Code runtime concern with no impact on ASM's skill packaging or delivery. All 3166 unit/integration tests and 100 e2e tests pass without modification.
