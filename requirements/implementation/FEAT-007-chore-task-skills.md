# Implementation Plan: Chore Task Skills

## Overview

This plan covers the implementation of two new Claude Code Agent Skills designed for routine maintenance tasks and chores. These skills complement the existing feature development workflow (`documenting-features` → `creating-implementation-plans` → `implementing-plan-phases`) by providing a streamlined path for work that doesn't warrant the full feature development process.

The two skills are:
- **documenting-chores**: Creates lightweight chore task documents
- **executing-chores**: Handles the complete chore workflow from branch creation through pull request

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-007   | [#9](https://github.com/lwndev/ai-skills-manager/issues/9) | [FEAT-007-chore-task-skills.md](../features/FEAT-007-chore-task-skills.md) | Medium | Low | Pending |

## Recommended Build Sequence

### Phase 1: documenting-chores Skill
**Feature:** [FEAT-007](../features/FEAT-007-chore-task-skills.md) | [#9](https://github.com/lwndev/ai-skills-manager/issues/9)
**Status:** ✅ Complete

#### Rationale
- **Foundation first**: The `documenting-chores` skill creates the chore documents that `executing-chores` will reference
- **Simpler scope**: Documentation skill has fewer dependencies and no git/GitHub integration
- **Establishes patterns**: Sets the chore document format that the execution skill will consume
- **Validates structure**: Tests the progressive disclosure pattern before building the more complex skill

#### Implementation Steps
1. Create skill directory structure: `.claude/skills/documenting-chores/`
2. Create SKILL.md with frontmatter:
   - name: `documenting-chores`
   - description: Third person, describes what it does and when to use it
3. Implement SKILL.md body with:
   - Quick start guide for creating chore documents
   - Trigger phrases section (when to use this skill)
   - File location conventions (`requirements/chores/`)
   - Chore ID assignment process (auto-increment from existing)
   - Links to templates and reference files
   - Verification checklist
4. Create `templates/chore-document.md`:
   - Complete template as specified in FR-6
   - All sections: Chore ID, GitHub Issue, Category, Description, Affected Files, Acceptance Criteria, Notes
   - Placeholder text with guidance for each section
5. Create `reference/categories.md`:
   - Detailed guidance for each chore category (dependencies, documentation, refactoring, configuration, cleanup)
   - Category-specific acceptance criteria suggestions
   - Common affected file patterns per category

#### Deliverables
- [x] `.claude/skills/documenting-chores/SKILL.md` - Main skill file with frontmatter and instructions
- [x] `.claude/skills/documenting-chores/templates/chore-document.md` - Chore document template
- [x] `.claude/skills/documenting-chores/reference/categories.md` - Category-specific guidance

---

### Phase 2: executing-chores Skill
**Feature:** [FEAT-007](../features/FEAT-007-chore-task-skills.md) | [#9](https://github.com/lwndev/ai-skills-manager/issues/9)
**Status:** ✅ Complete

#### Rationale
- **Builds on Phase 1**: Consumes chore documents created by `documenting-chores`
- **Higher complexity**: Involves git branch management, GitHub CLI integration, PR creation
- **Complete workflow**: Provides end-to-end automation from branch to PR
- **Patterns established**: Can reference existing `implementing-plan-phases` skill for git/GitHub patterns

#### Implementation Steps
1. Create skill directory structure: `.claude/skills/executing-chores/`
2. Create SKILL.md with frontmatter:
   - name: `executing-chores`
   - description: Third person, describes workflow execution and trigger phrases
3. Implement SKILL.md body with:
   - Quick start with copyable workflow checklist (as specified in FR-2)
   - Trigger phrases section (when to use this skill)
   - Branch naming convention summary (`chore/CHORE-XXX-description`)
   - Links to reference files for detailed steps
   - Verification checklist before PR creation
4. Create `reference/workflow-details.md`:
   - Detailed guidance for each workflow phase (Initialization, Execution, Completion)
   - Error recovery procedures
   - Git command examples for common operations
   - Edge case handling (existing branches, uncommitted changes, etc.)
5. Create `reference/github-templates.md`:
   - GitHub issue creation template (for chores without existing issues)
   - Issue comment templates ("Starting work", "Work complete" with PR link)
   - Commit message format for chores (`chore(category): brief description`)
   - Pull request description template
6. Create `templates/pr-template.md`:
   - PR template as specified in FR-6 with Chore ID reference, Summary, Changes, Testing, Related sections

#### Deliverables
- [x] `.claude/skills/executing-chores/SKILL.md` - Main skill file with workflow checklist
- [x] `.claude/skills/executing-chores/reference/workflow-details.md` - Detailed step guidance
- [x] `.claude/skills/executing-chores/reference/github-templates.md` - PR and issue comment templates
- [x] `.claude/skills/executing-chores/templates/pr-template.md` - Pull request template

---

### Phase 3: Integration Testing & Documentation
**Feature:** [FEAT-007](../features/FEAT-007-chore-task-skills.md) | [#9](https://github.com/lwndev/ai-skills-manager/issues/9)
**Status:** ✅ Complete

#### Rationale
- **Validation required**: Skills need real-world testing before being considered complete
- **End-to-end testing**: Both skills should work together and independently
- **Documentation alignment**: Ensure skills follow established patterns from existing skills

#### Implementation Steps
1. Manual testing of `documenting-chores`:
   - Test skill activation with various trigger phrases
   - Create sample chore documents for each category
   - Verify Chore ID auto-increment logic
   - Test with both existing and new GitHub issues
2. Manual testing of `executing-chores`:
   - Test complete workflow for a simple chore
   - Verify branch creation follows naming convention
   - Test PR creation with proper linking
   - Test error handling (no `gh` CLI, dirty working directory, existing branch)
3. Integration testing:
   - Full workflow: `documenting-chores` → `executing-chores`
   - Verify skills work independently (can use one without the other)
4. Create sample chore in `requirements/chores/` as a real example
5. Verify compliance with Agent Skills best practices:
   - SKILL.md frontmatter validation
   - Body under 500 lines
   - Reference files one level deep
   - Copyable workflow checklists
   - Third-person descriptions

#### Deliverables
- [x] `requirements/chores/` directory verified to exist (for chore documents)
- [x] Sample chore document created as real example
- [x] All acceptance criteria from feature requirements verified
- [x] Skills tested with different trigger phrases

---

## Shared Infrastructure

### Existing Patterns to Reuse
- `implementing-plan-phases` skill structure for git/GitHub workflow patterns
- `documenting-features` skill structure for document creation patterns
- GitHub templates from `implementing-plan-phases/reference/github-templates.md`

### New Directory
```
requirements/chores/    # Already exists, will store chore documents
```

## Testing Strategy

### Manual Testing
Since these are Agent Skills (prompt instructions), testing is primarily manual:

1. **Trigger phrase testing**: Verify skills activate with expected phrases
2. **Document creation**: Test chore document generation for each category
3. **Workflow execution**: Test complete chore workflow end-to-end
4. **Error scenarios**: Test graceful handling of missing prerequisites

### Validation Checklist
- [x] Skills appear in Claude Code skill list
- [x] Trigger phrases activate correct skill
- [x] Chore documents created in correct location
- [x] Git branches follow naming convention
- [x] PRs include required information
- [x] GitHub issues updated correctly (when applicable)

## Dependencies and Prerequisites

### External Dependencies
- Git CLI (for branch management)
- GitHub CLI (`gh`) for issue/PR operations
- Existing skills infrastructure in `.claude/skills/`

### Prerequisites
- GitHub repository with issue tracking enabled
- User has `gh` CLI installed and authenticated (for GitHub operations)

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Skill not discovered by Claude | High | Low | Clear, specific descriptions with trigger phrases |
| Chore ID collision | Medium | Low | Auto-increment logic checking existing documents |
| `gh` CLI not available | Medium | Medium | Clear error messages, allow workflow continuation without GitHub integration |
| Branch conflicts | Medium | Low | Check for existing branches, offer resolution options |
| SKILL.md too verbose | Medium | Medium | Follow progressive disclosure, keep body under 500 lines |

## Success Criteria

### Per-Phase Criteria

**Phase 1 - documenting-chores:**
- [x] SKILL.md frontmatter validates (name, description constraints)
- [x] Skill activates on relevant trigger phrases
- [x] Chore documents created with correct format
- [x] Chore ID assignment works correctly
- [x] All five categories documented

**Phase 2 - executing-chores:**
- [x] SKILL.md frontmatter validates
- [x] Workflow checklist is copyable and complete
- [x] Branch naming follows convention
- [x] PR creation works with proper format
- [x] GitHub issue updates work when issue exists

**Phase 3 - Integration:**
- [x] Both skills work independently
- [x] Full workflow works end-to-end
- [x] Error handling is graceful
- [x] Skills follow existing patterns

### Overall Success (from Feature Requirements)
- [x] `documenting-chores` skill creates valid chore documents
- [x] `executing-chores` skill completes full workflow (branch → commit → PR)
- [x] GitHub issues are properly linked and updated
- [x] Branch naming follows specified convention
- [x] Pull requests are created with proper format
- [x] Skills work independently (can use one without the other)
- [x] SKILL.md body is under 500 lines for both skills
- [x] Reference files are one level deep (no nested references)
- [x] Workflow checklists are copyable
- [x] Progressive disclosure pattern implemented correctly

## Code Organization

### New Directory Structure

```
.claude/skills/
├── documenting-chores/
│   ├── SKILL.md              # Main instructions (under 500 lines)
│   ├── templates/
│   │   └── chore-document.md # Chore document template
│   └── reference/
│       └── categories.md     # Category-specific guidance
│
├── executing-chores/
│   ├── SKILL.md              # Main instructions with workflow checklist
│   ├── reference/
│   │   ├── github-templates.md   # PR and issue comment templates
│   │   └── workflow-details.md   # Detailed step guidance
│   └── templates/
│       └── pr-template.md    # Pull request template
│
└── [existing skills...]

requirements/
├── chores/                   # Chore documents (already exists)
│   └── CHORE-XXX-*.md        # Individual chore documents
└── [other directories...]
```

## Development Guidelines

### Skill Authoring Standards
- Follow patterns from existing skills in `.claude/skills/`
- Keep SKILL.md body concise (under 500 lines)
- Use progressive disclosure (main file + reference files)
- Include copyable checklists for multi-step workflows
- Write descriptions in third person
- Include both "what it does" and "when to use it" in descriptions

### Commit Strategy
- One phase per branch
- Commit message format: `feat(skills): add documenting-chores skill`
- Reference feature document and issue in commits
