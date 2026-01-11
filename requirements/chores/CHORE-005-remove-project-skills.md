# Chore: Remove Project-Level Skills

## Chore ID

`CHORE-005`

## GitHub Issue

[#25](https://github.com/lwndev/ai-skills-manager/issues/25)

## Category

`cleanup`

## Description

Remove project-level skills from `.claude/skills/` that have been migrated to the public repository at https://github.com/lwndev/lwndev-agent-skills. Update documentation to reflect this change and direct users to the new location.

## Affected Files

### Files/Directories to Delete

- `.claude/skills/creating-implementation-plans/` (entire directory)
- `.claude/skills/documenting-chores/` (entire directory)
- `.claude/skills/documenting-features/` (entire directory)
- `.claude/skills/executing-chores/` (entire directory)
- `.claude/skills/implementing-plan-phases/` (entire directory)
- `.claude/skills/managing-git-worktrees/` (if present)

### Files to Update

- `.claude/CLAUDE.md` - Add note about skills migration

## Acceptance Criteria

- [ ] All project-level skill directories under `.claude/skills/` are removed
- [ ] `.claude/CLAUDE.md` is updated with a note indicating skills have moved to https://github.com/lwndev/lwndev-agent-skills
- [ ] No broken references remain in project documentation
- [ ] Project builds successfully after changes
- [ ] Tests pass after changes

## Notes

- The skills previously bundled with this project are now maintained in the public repository: https://github.com/lwndev/lwndev-agent-skills
- Users who want these skills should install them from the public repository using:
  - Personal scope: `~/.claude/skills/` for cross-project availability
  - Or clone/install from the public repo
- The `.claude/skills/` directory itself may remain (for any future project-specific skills) or be removed entirely
- References to `.claude/skills/` in source code (commands, tests) should NOT be removed as they are part of the tool's functionality for managing skills at that location
