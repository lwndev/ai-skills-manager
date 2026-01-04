---
name: executing-chores
description: Executes chore task workflows including branch creation, implementation, and pull request creation. Use when the user says "execute chore", "implement this chore", "run the chore workflow", or references chore documents in requirements/chores/.
---

# Executing Chores

Execute chore task workflows with systematic tracking from branch creation through pull request.

## When to Use This Skill

- User says "execute chore", "implement this chore", or "run the chore workflow"
- User references a chore document in `requirements/chores/`
- User wants to implement documented maintenance work
- Continuing chore work that was previously started

## Quick Start

1. Locate chore document in `requirements/chores/`
2. Extract Chore ID and review acceptance criteria
3. Check for linked GitHub issue (update if exists)
4. Create git branch: `chore/CHORE-XXX-description`
5. Execute the defined changes, tracking with todos
6. Commit changes with descriptive messages
7. Verify acceptance criteria are met
8. Run tests/build verification
9. Create pull request
10. Update GitHub issue with PR link (if issue exists)

## Workflow Checklist

Copy this checklist to track progress:

```
Chore Execution:
- [ ] Locate chore document (get Chore ID)
- [ ] Post GitHub issue start comment (if issue exists)
- [ ] Create git branch: chore/CHORE-XXX-description
- [ ] Load acceptance criteria into todos
- [ ] Execute defined changes
- [ ] Commit with chore(category): message format
- [ ] Verify acceptance criteria met
- [ ] Run tests/build verification
- [ ] Create pull request
- [ ] Update GitHub issue with PR link (if exists)
```

See [reference/workflow-details.md](reference/workflow-details.md) for detailed guidance on each step.

## Branch Naming

Format: `chore/CHORE-XXX-{2-4-word-description}`

- Uses Chore ID (not GitHub issue number) for consistent naming
- Description should be lowercase with hyphens
- Keep description brief but descriptive (2-4 words)

Examples:
- `chore/CHORE-001-update-dependencies`
- `chore/CHORE-002-fix-readme-typos`
- `chore/CHORE-003-cleanup-unused-imports`

## Commit Message Format

Format: `chore(category): brief description`

Categories: `dependencies`, `documentation`, `refactoring`, `configuration`, `cleanup`

Examples:
- `chore(dependencies): update typescript to 5.5`
- `chore(documentation): fix typos in README`
- `chore(cleanup): remove unused imports`

## Verification Checklist

Before creating the PR, verify:

- [ ] All acceptance criteria from chore document are met
- [ ] Tests pass (if applicable)
- [ ] Build succeeds
- [ ] Changes match the scope defined in chore document
- [ ] No unintended side effects

## References

- **Detailed workflow guidance**: [workflow-details.md](reference/workflow-details.md) - Step-by-step instructions for each phase
- **GitHub templates**: [github-templates.md](reference/github-templates.md) - Issue comments, commit messages, PR format
- **PR template**: [templates/pr-template.md](templates/pr-template.md) - Pull request format for chores

## Relationship to Other Skills

| Task Type | Recommended Approach |
|-----------|---------------------|
| Chore already documented | Use this skill (`executing-chores`) |
| Chore needs documentation first | Use `documenting-chores`, then this skill |
| New feature with requirements | Use `documenting-features` -> `creating-implementation-plans` -> `implementing-plan-phases` |
| Quick fix (no tracking needed) | Direct implementation |
