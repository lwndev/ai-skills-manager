# Feature Requirements: Chore Task Skills

## Overview

Create a set of Claude Code Agent Skills that enable efficient handling of routine maintenance work, chores, and minor changes that don't warrant the full feature development workflow.

## Feature ID
`FEAT-007`

## GitHub Issue
[#9](https://github.com/lwndev/ai-skills-manager/issues/9)

## Priority
Medium - Complements existing feature development skills and addresses workflow gaps for non-feature work.

## User Story

As a developer using Claude Code, I want skills that help me efficiently manage chore tasks (dependency updates, refactoring, documentation fixes, configuration changes) so that I can maintain proper tracking and documentation without the overhead of the full feature development process.

## Background

The AI Skills Manager currently contains three skills focused on feature development:
- `documenting-features` - Creates feature requirement documents
- `creating-implementation-plans` - Transforms requirements into implementation plans
- `implementing-plan-phases` - Executes implementation plan phases

These skills are optimized for larger feature work but are too heavyweight for routine maintenance tasks. Chore tasks need a streamlined workflow that still maintains:
- GitHub issue tracking
- Git branch management
- Documentation of changes
- Structured execution
- Pull request creation

## Proposed Skills

### Skill 1: `documenting-chores`
Creates lightweight chore task documents that capture the work to be done without the full feature requirements overhead.

**SKILL.md Frontmatter:**
```yaml
---
name: documenting-chores
description: Creates lightweight documentation for chore tasks and maintenance work. Use when the user needs to document a chore, maintenance task, dependency update, refactoring, or minor fix that doesn't require full feature requirements.
---
```

### Skill 2: `executing-chores`
Handles the complete chore workflow from branch creation through pull request.

**SKILL.md Frontmatter:**
```yaml
---
name: executing-chores
description: Executes chore task workflows including branch creation, implementation, and pull request creation. Use when the user says "execute chore", "implement this chore", "run the chore workflow", or references chore documents in requirements/chores/.
---
```

### Skill Naming Constraints
Per Claude Agent Skills documentation:
- Names must use lowercase letters, numbers, and hyphens only
- Maximum 64 characters
- Cannot contain reserved words ("anthropic", "claude")
- Descriptions must be third person, max 1024 characters

## Terminology

| Term | Description | Format | Example |
|------|-------------|--------|---------|
| **Chore ID** | Internal document identifier assigned when creating a chore document. Used in branch names and file names. | `CHORE-XXX` (uppercase, hyphen, 3+ digits) | `CHORE-007`, `CHORE-042` |
| **GitHub Issue Number** | The numeric identifier assigned by GitHub when an issue is created. Referenced in chore documents for traceability. | Digits only (no `#` in branch names/paths) | `9`, `157` |

**Why Chore ID in branch names (not GitHub Issue Number):**
- Chore ID is always available (chore document is created first in the workflow)
- Provides consistent branch naming regardless of whether a GitHub issue exists
- The chore document links to the GitHub issue, maintaining full traceability
- Aligns with existing `FEAT-XXX` pattern used in feature requirements

## Functional Requirements

### FR-1: Chore Documentation (`documenting-chores`)

The skill shall create a structured chore document containing:
- Chore ID (format: `CHORE-XXX`)
- GitHub issue reference
- Brief description of the work
- Files likely to be affected
- Acceptance criteria (simplified checklist)
- Testing requirements (if applicable)

Document location: `requirements/chores/CHORE-XXX-description.md`

### FR-2: Chore Workflow (`executing-chores`)

The skill shall execute the following workflow with a copyable checklist:

```
Chore Workflow:
- [ ] Locate or create chore document (assigns Chore ID)
- [ ] Link to GitHub issue (optional, create if needed)
- [ ] Create git branch: chore/CHORE-XXX-description
- [ ] Execute defined changes
- [ ] Commit changes with descriptive messages
- [ ] Verify acceptance criteria met
- [ ] Run tests/build verification
- [ ] Create pull request
- [ ] Update GitHub issue with PR link (if issue exists)
```

**Phase breakdown:**

1. **Initialization**
   - Locate or create chore document (assigns Chore ID)
   - Link to GitHub issue (optional, create if needed)
   - Create git branch: `chore/CHORE-XXX-description`

2. **Execution**
   - Track progress with todos
   - Execute the defined changes
   - Commit changes with descriptive messages

3. **Completion**
   - Verify acceptance criteria met
   - Run relevant tests/build
   - Create pull request
   - Update GitHub issue with PR link (if issue exists)

### FR-3: GitHub Integration

- Create GitHub issues for undocumented chores (optional, with user confirmation)
- Update issue status as work progresses
- Create pull requests with standardized format
- Link PRs back to the originating issue

### FR-4: Branch Naming Convention

Format: `chore/CHORE-XXX-{2-4-word-description}`

- Uses the Chore ID (not GitHub issue number) for consistent naming
- Description should be lowercase with hyphens (no spaces or special characters)
- Keep description brief but descriptive (2-4 words)

Examples:
- `chore/CHORE-001-update-dependencies`
- `chore/CHORE-002-fix-readme-typos`
- `chore/CHORE-003-cleanup-unused-imports`
- `chore/CHORE-015-upgrade-typescript`

### FR-5: Chore Categories

Support common chore types with category-specific guidance:
- **dependencies**: Package updates, version bumps
- **documentation**: README updates, comment fixes, doc corrections
- **refactoring**: Code cleanup, restructuring without behavior changes
- **configuration**: Config file updates, tooling changes
- **cleanup**: Removing dead code, unused files, deprecated features

### FR-6: Lightweight Documentation Template

The chore document template shall be simpler than feature requirements:

```markdown
# Chore: [Brief Title]

## Chore ID
`CHORE-XXX`

## GitHub Issue
[#N](https://github.com/org/repo/issues/N) *(optional - link when issue exists)*

## Category
[dependencies|documentation|refactoring|configuration|cleanup]

## Description
[1-2 sentences describing the work]

## Affected Files
- `path/to/file1`
- `path/to/file2`

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Notes
[Optional: any relevant context or constraints]
```

## Non-Functional Requirements

### NFR-1: Efficiency
- Chore documentation should take under 2 minutes to create
- Workflow overhead should be minimal compared to actual work
- Skills should not require extensive user input for simple tasks

### NFR-2: Integration
- Must work seamlessly with existing feature development skills
- Should not conflict with `implementing-plan-phases` workflow
- Git operations must handle edge cases (dirty working directory, existing branches)

### NFR-3: Error Handling
- Gracefully handle missing GitHub credentials
- Provide clear guidance when prerequisites aren't met
- Allow continuation after recoverable errors

### NFR-4: Consistency
- Follow same patterns as existing skills (SKILL.md structure, reference docs)
- Use consistent terminology with other project documentation
- Maintain similar user experience to feature skills

### NFR-5: Skill Structure (per Agent Skills Best Practices)
- SKILL.md body must be under 500 lines
- Use progressive disclosure: SKILL.md provides overview, reference files contain details
- Reference files should be one level deep from SKILL.md (no nested references)
- Include copyable workflow checklists for multi-step operations
- Longer reference files (>100 lines) should include table of contents

## Skill Directory Structure

Per Agent Skills best practices, each skill should use progressive disclosure:

### `documenting-chores/`
```
documenting-chores/
├── SKILL.md              # Main instructions (under 500 lines)
├── templates/
│   └── chore-document.md # Chore document template
└── reference/
    └── categories.md     # Category-specific guidance
```

#### File Descriptions

**SKILL.md**
- Quick start guide for creating chore documents
- When to use this skill (trigger phrases)
- File location conventions (`requirements/chores/`)
- Chore ID assignment process (auto-increment from existing)
- Links to templates and reference files

**templates/chore-document.md**
- Complete chore document template (as specified in FR-6)
- Includes all sections: Chore ID, GitHub Issue, Category, Description, Affected Files, Acceptance Criteria, Notes
- Placeholder text with guidance for each section

**reference/categories.md**
- Detailed guidance for each chore category:
  - **dependencies**: How to document package updates, version bumps, security patches
  - **documentation**: README updates, comment fixes, doc corrections
  - **refactoring**: Code cleanup, restructuring, naming improvements
  - **configuration**: Config file updates, tooling changes, CI/CD modifications
  - **cleanup**: Removing dead code, unused files, deprecated features
- Category-specific acceptance criteria suggestions
- Common affected file patterns per category

---

### `executing-chores/`
```
executing-chores/
├── SKILL.md              # Main instructions with workflow checklist
├── reference/
│   ├── github-templates.md   # PR and issue comment templates
│   └── workflow-details.md   # Detailed step guidance
└── templates/
    └── pr-template.md    # Pull request template
```

#### File Descriptions

**SKILL.md**
- Quick start with copyable workflow checklist
- When to use this skill (trigger phrases)
- Branch naming convention summary
- Links to reference files for detailed steps
- Verification checklist before PR creation

**reference/github-templates.md**
- GitHub issue creation template (for chores without existing issues)
- Issue comment templates:
  - "Starting work" comment
  - "Work complete" comment with PR link
- Pull request description template
- Commit message format for chores (e.g., `chore(category): brief description`)

**reference/workflow-details.md**
- Detailed guidance for each workflow phase:
  - **Initialization**: How to locate/create chore docs, assign Chore IDs, create branches
  - **Execution**: Todo tracking patterns, commit strategies, handling blockers
  - **Completion**: Verification steps, PR creation, issue updates
- Error recovery procedures
- Git command examples for common operations

**templates/pr-template.md**
- Pull request template for chore PRs:
  ```markdown
  ## Chore
  [CHORE-XXX](../requirements/chores/CHORE-XXX-description.md)

  ## Summary
  [Brief description of changes]

  ## Changes
  - Change 1
  - Change 2

  ## Testing
  - [ ] Tests pass
  - [ ] Build succeeds

  ## Related
  - Closes #N (if GitHub issue exists)
  ```

## Dependencies

- Existing Claude Code skills infrastructure
- Git CLI availability
- GitHub CLI (`gh`) for issue/PR operations
- GitHub repository with issue tracking enabled

## Edge Cases

1. **No GitHub issue exists**: Prompt user to create one or proceed without. Branch naming still works (uses Chore ID, not GitHub issue number).
2. **Branch already exists**: Offer to switch to existing branch or create new with incremented Chore ID
3. **Uncommitted changes**: Warn user and offer to stash or abort
4. **PR already exists for branch**: Update existing PR instead of creating new
5. **Multiple chores in one session**: Track each independently with separate Chore IDs
6. **Chore ID collision**: Check for existing Chore IDs and auto-increment to next available number

## Testing Requirements

### Manual Testing
- Complete workflow for each chore category
- Error handling for missing dependencies (no `gh` CLI)
- Branch conflict resolution
- PR creation with proper linking

### Validation
- Chore documents created in correct location
- Git branches follow naming convention
- PRs include required information
- GitHub issues updated correctly

## Relationship to Existing Skills

| Scenario | Recommended Skill(s) |
|----------|---------------------|
| New feature with requirements | `documenting-features` -> `creating-implementation-plans` -> `implementing-plan-phases` |
| Minor chore/maintenance task | `documenting-chores` -> `executing-chores` |
| Quick fix (no tracking needed) | Direct implementation (no skill needed) |

## Future Enhancements

- Batch chore processing (multiple related chores in one PR)
- Automated dependency update detection and chore creation
- Integration with project management tools beyond GitHub
- Chore templates for common scenarios (e.g., "update all dependencies")

## Acceptance Criteria

### Functional
- [ ] `documenting-chores` skill creates valid chore documents
- [ ] `executing-chores` skill completes full workflow (branch -> commit -> PR)
- [ ] GitHub issues are properly linked and updated
- [ ] Branch naming follows specified convention
- [ ] Pull requests are created with proper format
- [ ] Skills work independently (can use one without the other)

### Agent Skills Compliance (per Anthropic documentation)
- [ ] SKILL.md frontmatter contains valid `name` and `description`
- [ ] Skill names use lowercase letters, numbers, and hyphens only
- [ ] Descriptions are third person and under 1024 characters
- [ ] Descriptions include both "what it does" and "when to use it"
- [ ] SKILL.md body is under 500 lines
- [ ] Reference files are one level deep (no nested references)
- [ ] Workflow checklists are copyable
- [ ] Progressive disclosure pattern implemented correctly

### Documentation
- [ ] Skills include usage examples
- [ ] Skills follow existing patterns in `.claude/skills/`
- [ ] Reference files include table of contents where appropriate
