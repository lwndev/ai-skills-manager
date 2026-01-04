# GitHub Templates

Templates for GitHub interactions during chore execution.

## Table of Contents

- [Issue Comments](#issue-comments)
- [Commit Messages](#commit-messages)
- [Pull Request](#pull-request)
- [Creating New Issues](#creating-new-issues)

---

## Issue Comments

### Starting Work Comment

Post when beginning work on a chore:

```bash
gh issue comment <ISSUE_NUM> --body "🔄 **Starting work on CHORE-XXX**

**Chore Document:** [CHORE-XXX](../requirements/chores/CHORE-XXX-description.md)

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

**Branch:** \`chore/CHORE-XXX-description\`

**Status:** 🔄 In Progress"
```

**Example:**

```bash
gh issue comment 15 --body "🔄 **Starting work on CHORE-003**

**Chore Document:** [CHORE-003](../requirements/chores/CHORE-003-cleanup-unused-imports.md)

**Acceptance Criteria:**
- [ ] Remove unused imports from src/
- [ ] Run linter to verify no import errors
- [ ] Build passes

**Branch:** \`chore/CHORE-003-cleanup-unused-imports\`

**Status:** 🔄 In Progress"
```

### Work Complete Comment

Post when chore work is complete and PR is created:

```bash
gh issue comment <ISSUE_NUM> --body "✅ **Completed CHORE-XXX**

**Pull Request:** #<PR_NUM>

**Acceptance Criteria Verified:**
- [x] Criterion 1
- [x] Criterion 2

**Verification:**
- ✅ Tests passing
- ✅ Build successful

**Status:** ✅ Complete - Ready for review"
```

**Example:**

```bash
gh issue comment 15 --body "✅ **Completed CHORE-003**

**Pull Request:** #42

**Acceptance Criteria Verified:**
- [x] Remove unused imports from src/
- [x] Run linter to verify no import errors
- [x] Build passes

**Verification:**
- ✅ Tests passing
- ✅ Build successful

**Status:** ✅ Complete - Ready for review"
```

---

## Commit Messages

### Format

```
chore(category): brief description

Optional longer description explaining the change.

Refs: CHORE-XXX
```

### Categories

| Category | When to Use |
|----------|-------------|
| `dependencies` | Package updates, version bumps, security patches |
| `documentation` | README updates, comment fixes, doc corrections |
| `refactoring` | Code cleanup, restructuring without behavior changes |
| `configuration` | Config file updates, tooling changes, CI/CD |
| `cleanup` | Removing dead code, unused files, deprecated features |

### Examples

**Single-line (most chores):**

```
chore(dependencies): update typescript to 5.5.4
```

```
chore(documentation): fix typos in contributing guide
```

```
chore(cleanup): remove deprecated API endpoints
```

**Multi-line (when context helps):**

```
chore(dependencies): update react to v19

Breaking changes addressed:
- Updated createRoot usage
- Migrated from ReactDOM.render

Refs: CHORE-005
```

```
chore(refactoring): extract validation logic to utils

Consolidates duplicate validation code from:
- src/commands/scaffold.ts
- src/commands/validate.ts

No behavior changes.

Refs: CHORE-007
```

---

## Pull Request

### PR Title Format

```
chore(category): brief description
```

**Examples:**
- `chore(dependencies): update all npm packages`
- `chore(documentation): fix broken links in README`
- `chore(cleanup): remove unused utility functions`

### PR Body Template

Use with `gh pr create`:

```bash
gh pr create --title "chore(category): description" --body "## Chore
[CHORE-XXX](requirements/chores/CHORE-XXX-description.md)

## Summary
Brief description of what this chore accomplishes.

## Changes
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Linting passes (if applicable)

## Related
- Closes #N (if GitHub issue exists)

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

**Example:**

```bash
gh pr create --title "chore(dependencies): update typescript to 5.5" --body "## Chore
[CHORE-001](requirements/chores/CHORE-001-update-dependencies.md)

## Summary
Updates TypeScript from 5.4 to 5.5.4 for latest features and bug fixes.

## Changes
- Updated typescript in package.json
- Updated @types/node to compatible version
- Fixed one type error exposed by stricter checking

## Testing
- [x] Tests pass
- [x] Build succeeds
- [x] Linting passes

## Related
- Closes #12

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

See [templates/pr-template.md](../templates/pr-template.md) for the copyable template.

---

## Creating New Issues

### When to Create an Issue

Create a GitHub issue for a chore when:
- The work is significant enough to warrant tracking
- Multiple people might work on it
- It needs to be scheduled/prioritized
- There's a related discussion thread needed

### Issue Creation Template

```bash
gh issue create --title "chore: brief description" --body "## Summary
Brief description of the maintenance work needed.

## Category
[dependencies|documentation|refactoring|configuration|cleanup]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Notes
Any relevant context or constraints.

## Related
- Related issues or PRs (if any)"
```

**Example:**

```bash
gh issue create --title "chore: update npm dependencies" --body "## Summary
Update all npm dependencies to latest compatible versions. Address any security vulnerabilities.

## Category
dependencies

## Acceptance Criteria
- [ ] All packages updated to latest compatible versions
- [ ] No high/critical security vulnerabilities
- [ ] Build and tests pass
- [ ] No breaking changes (or documented if unavoidable)

## Notes
Last dependency update was 3 months ago. npm audit showing 2 moderate vulnerabilities.

## Related
- Security advisory for lodash CVE-2024-XXXX"
```

### Labeling Issues

If your repository uses labels:

```bash
gh issue create --title "..." --body "..." --label "chore" --label "dependencies"
```

Common chore labels:
- `chore`
- `dependencies`
- `documentation`
- `tech-debt`
- `maintenance`
