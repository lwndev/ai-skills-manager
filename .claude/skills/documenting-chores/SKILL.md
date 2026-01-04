---
name: documenting-chores
description: Creates lightweight documentation for chore tasks and maintenance work. Use when the user needs to document a chore, maintenance task, dependency update, refactoring, or minor fix that doesn't require full feature requirements.
---

# Documenting Chores

Create lightweight chore task documents that capture maintenance work, dependency updates, refactoring, and minor fixes without the overhead of full feature requirements.

## When to Use This Skill

- Documenting dependency updates or version bumps
- Recording planned refactoring work
- Tracking documentation fixes or README updates
- Capturing configuration changes
- Cleaning up dead code or unused files
- Any maintenance task that doesn't warrant full feature requirements

## Quick Start

1. Check for existing chores in `requirements/chores/` to determine the next Chore ID
2. **Ask for GitHub issue URL** if not provided (optional but recommended for traceability)
3. Identify the chore category (see [reference/categories.md](reference/categories.md))
4. Create chore document using the template
5. Save to `requirements/chores/CHORE-XXX-description.md`

## File Location

All chore documents go in: `requirements/chores/`

Naming format: `CHORE-XXX-{2-4-word-description}.md`

Examples:
- `CHORE-001-update-dependencies.md`
- `CHORE-002-fix-readme-typos.md`
- `CHORE-003-cleanup-unused-imports.md`

## Chore ID Assignment

To assign the next Chore ID:

1. Check existing files in `requirements/chores/`
2. Find the highest `CHORE-XXX` number
3. Increment by 1 for the new chore
4. If no chores exist, start with `CHORE-001`

## Template

See [templates/chore-document.md](templates/chore-document.md) for the full template.

### Structure Overview

```
# Chore: [Brief Title]
- Chore ID, GitHub Issue (optional), Category
- Description (1-2 sentences)
- Affected Files
- Acceptance Criteria
- Notes (optional)
```

## Categories

Five supported categories with specific guidance:

| Category | Use For |
|----------|---------|
| `dependencies` | Package updates, version bumps, security patches |
| `documentation` | README updates, comment fixes, doc corrections |
| `refactoring` | Code cleanup, restructuring, naming improvements |
| `configuration` | Config file updates, tooling changes, CI/CD modifications |
| `cleanup` | Removing dead code, unused files, deprecated features |

See [reference/categories.md](reference/categories.md) for detailed guidance on each category.

## Verification Checklist

Before finalizing, verify:

- [ ] Chore ID is unique (not already used)
- [ ] Category matches the type of work
- [ ] Description clearly explains the work
- [ ] Affected files list is complete
- [ ] Acceptance criteria are testable
- [ ] GitHub issue is linked (if one exists)

## Relationship to Other Skills

| Task Type | Recommended Approach |
|-----------|---------------------|
| New feature with requirements | Use `documenting-features` skill |
| Chore/maintenance task | Use this skill (`documenting-chores`) |
| Quick fix (no tracking needed) | Direct implementation |

After documenting a chore, use the `executing-chores` skill to implement it with proper branch management and PR creation.
