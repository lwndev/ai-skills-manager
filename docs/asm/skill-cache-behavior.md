# Skill Cache Behavior

## How Claude Code Caches Skills

Claude Code loads skill files from disk into memory at conversation start. Once loaded, skills are cached in memory for the duration of the conversation. This means changes to skill files on disk (e.g., via `asm install` or `asm update`) are **not automatically reflected** in an active conversation.

## Refreshing Skills After Install or Update

After installing, updating, or uninstalling a skill with ASM, use one of these methods to pick up the changes:

1. **Run `/clear`** — Resets the conversation and reloads all skills from disk. Available since Claude Code v2.1.63.
2. **Start a new conversation** — Skills are always loaded fresh at conversation start.

### Claude Code Version Note

In Claude Code versions **before v2.1.63**, the `/clear` command did not reset cached skills. Users on older versions must start a new conversation to pick up skill changes. Upgrading to v2.1.63 or later is recommended.

## How ASM Interacts with Skills

ASM operates entirely at the filesystem level:

- **Install** (`asm install`): Extracts `.skill` package contents to the target skills directory (`.claude/skills/` for project scope, `~/.claude/skills/` for personal scope).
- **Update** (`asm update`): Replaces installed skill files on disk with new package contents, with backup and rollback support.
- **Uninstall** (`asm uninstall`): Removes skill files from disk.

ASM does not interact with Claude Code's in-memory cache. Cache invalidation is handled by Claude Code itself when `/clear` is run or a new conversation begins.

## Summary

| Action | Skills Refreshed? |
|--------|-------------------|
| `asm install` / `asm update` / `asm uninstall` | Files changed on disk, but active conversation still uses cached versions |
| `/clear` (v2.1.63+) | Yes — reloads all skills from disk |
| Start new conversation | Yes — skills loaded fresh |
| `/clear` (before v2.1.63) | No — cached skills persisted (bug, now fixed) |
