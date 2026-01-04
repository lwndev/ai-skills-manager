# Step-by-Step Implementation Details

Detailed guidance for each step in the phase implementation workflow.

## Table of Contents

- [Step 1: Locate the Implementation Plan](#step-1-locate-the-implementation-plan)
- [Step 2: Identify Target Phase](#step-2-identify-target-phase)
- [Step 3: Update Implementation Doc Status](#step-3-update-implementation-doc-status)
- [Step 4: Update GitHub Issue (Start)](#step-4-update-github-issue-start)
- [Step 5: Branch Strategy](#step-5-branch-strategy)
- [Step 6: Load Steps into Todos](#step-6-load-steps-into-todos)
- [Step 7: Execute Implementation](#step-7-execute-implementation)
- [Step 8: Verify Deliverables](#step-8-verify-deliverables)
- [Step 9: Update Plan Status](#step-9-update-plan-status)
- [Step 10: Update GitHub Issue (Completion)](#step-10-update-github-issue-completion)
- [Common Patterns](#common-patterns)

---

## Step 1: Locate the Implementation Plan

Find the relevant implementation plan:

```bash
ls requirements/implementation/
```

Read the plan file to understand:
- Phase structure and dependencies
- Implementation steps for each phase
- Deliverables checklist
- Shared infrastructure references

## Step 2: Identify Target Phase

Determine which phase to implement:

**User-specified:** User says "implement phase 2" → use Phase 2

**Auto-select:** Find the first phase with **Status: Pending** that has all prerequisites complete

**Verify prerequisites:**
- Check all prior phases show **Status: ✅ Complete**
- Verify deliverables from dependent phases exist

**Extract metadata:**
- GitHub issue number from phase header: `[#N]`
- Feature reference link
- Rationale for phase ordering

## Step 3: Update Implementation Doc Status

Update the phase status in the implementation plan to indicate work has started.

**Change:**
```markdown
**Status:** Pending
```

**To:**
```markdown
**Status:** 🔄 In Progress
```

**Example edit:**
```markdown
### Phase 2: Validation Engine
**Feature:** [FEAT-002](../features/02-validate-skill-command.md) | [#2](https://github.com/...)
**Status:** 🔄 In Progress
```

This provides visibility into current work across the team.

## Step 4: Update GitHub Issue (Start)

Post a phase start comment to the GitHub issue.

**Finding the Issue Number:**

The GitHub issue number is referenced in the phase header:

```markdown
### Phase N: [Phase Name]
**Feature:** [FEAT-XXX](../features/...) | [#2](https://github.com/...)
```

Extract the number from `[#N]` notation.

**Command Template:**

```bash
gh issue comment <ISSUE_NUM> --body "🔄 Starting Phase <N>: <Phase Name>

**Implementation Steps:**
1. <Step 1>
2. <Step 2>
...

**Expected Deliverables:**
- <Deliverable 1>
- <Deliverable 2>
...

**Status:** 🔄 In Progress"
```

**Example:**

```bash
gh issue comment 2 --body "🔄 Starting Phase 2: Validation Engine

**Implementation Steps:**
1. Create file-exists validator
2. Create required-fields validator
3. Create validation orchestrator
4. Write file-exists tests
5. Write required-fields tests
6. Write orchestrator tests

**Expected Deliverables:**
- src/validators/file-exists.ts
- src/validators/required-fields.ts
- src/generators/validate.ts
- tests/unit/validators/file-exists.test.ts
- tests/unit/validators/required-fields.test.ts
- tests/unit/generators/validate.test.ts

**Status:** 🔄 In Progress"
```

## Step 5: Branch Strategy

Create a feature branch following the naming convention:

```bash
git checkout -b feat/{Feature ID}-{2-3-word-summary}
```

**Naming guidelines:**
- Use `feat/` prefix for feature work
- Add 2-3 word description (kebab-case)

**Examples:**
- `feat/FEAT-001-scaffold-skill-command`
- `feat/FEAT-002-validate-skill-command`
- `feat/FEAT-007-chore-task-skill`

**If already on a feature branch:** Stay on current branch if it's the correct one for this phase sequence.

## Step 6: Load Steps into Todos

Use TodoWrite to create trackable tasks for each implementation step.

**Include:**
- Each numbered step from "Implementation Steps"
- Deliverable verification as final step

**Example:**
```json
[
  {"content": "Create file-exists validator", "status": "pending"},
  {"content": "Create required-fields validator", "status": "pending"},
  {"content": "Create validation orchestrator", "status": "pending"},
  {"content": "Write file-exists tests", "status": "pending"},
  {"content": "Write required-fields tests", "status": "pending"},
  {"content": "Write orchestrator tests", "status": "pending"},
  {"content": "Verify all deliverables", "status": "pending"}
]
```

## Step 7: Execute Implementation

For each implementation step:

1. **Mark in_progress:** Update todo status before starting
2. **Implement:** Write the code/tests
3. **Follow patterns:** Reference existing code style and architecture
4. **Use shared infrastructure:** Check plan's "Shared Infrastructure" section
5. **Mark completed:** Update todo when step is done

**Keep exactly ONE todo in_progress at a time.**

### Following Code Organization

Implementation plans include a "Code Organization" section showing where files should be created:

```
src/
├── generators/
│   └── validate.ts           # Phase 2
├── validators/
│   ├── file-exists.ts        # Phase 2
│   └── required-fields.ts    # Phase 2
```

Follow this structure exactly for consistency.

### Reusing Existing Code

Check the phase "Rationale" section for references to existing utilities:

```markdown
**Leverages existing code**: Reuses `validateName`, `validateDescription`,
and `validateFrontmatterKeys` from scaffold implementation
```

Import and integrate rather than rewriting:

```typescript
import { validateName } from './name';
import { validateDescription } from './description';
```

### Test-Driven Development

Write tests alongside implementation:
- Unit tests for individual functions
- Integration tests for workflows
- Create test fixtures as needed

Reference the plan's test organization structure for file placement.

## Step 8: Verify Deliverables

Before marking phase complete, verify all requirements:

### Run Tests

```bash
npm test
```

All tests must pass. If any fail, fix before proceeding.

### Build Project

```bash
npm run build
```

Build must succeed without errors or warnings.

### Check Coverage

```bash
npm run test:coverage
```

Verify coverage meets the threshold specified in the plan (typically 80%+).

### Verify Files Exist

Check each deliverable from the plan exists and is complete:

```bash
ls -la src/validators/file-exists.ts
ls -la tests/unit/validators/file-exists.test.ts
# ... etc for all deliverables
```

## Step 9: Update Plan Status

Edit the implementation plan file to mark the phase complete:

**Change:**
```markdown
### Phase N: [Phase Name]
**Status:** 🔄 In Progress

#### Deliverables
- [ ] `file1.ts` - Description
- [ ] `file2.ts` - Description
```

**To:**
```markdown
### Phase N: [Phase Name]
**Status:** ✅ Complete

#### Deliverables
- [x] `file1.ts` - Description
- [x] `file2.ts` - Description
```

Update both the status line and all deliverable checkboxes.

## Step 10: Update GitHub Issue (Completion)

Post a completion comment to the GitHub issue.

**Command Template:**

```bash
gh issue comment <ISSUE_NUM> --body "✅ Completed Phase <N>: <Phase Name>

**Deliverables Verified:**
- [x] <Deliverable 1>
- [x] <Deliverable 2>
...

**Verification:**
- ✅ Tests passing
- ✅ Build successful
- ✅ Coverage: <X>%

**Status:** ✅ Complete"
```

**Example:**

```bash
gh issue comment 2 --body "✅ Completed Phase 2: Validation Engine

**Deliverables Verified:**
- [x] src/validators/file-exists.ts - File/directory existence validation
- [x] src/validators/required-fields.ts - Required fields validation
- [x] src/generators/validate.ts - Validation orchestration
- [x] tests/unit/validators/file-exists.test.ts - File existence tests
- [x] tests/unit/validators/required-fields.test.ts - Required fields tests
- [x] tests/unit/generators/validate.test.ts - Orchestrator tests

**Verification:**
- ✅ Tests passing
- ✅ Build successful
- ✅ Coverage: 85%

**Status:** ✅ Complete"
```

**Closing Issue (Final Phase):**

When all phases are complete, close the issue:

```bash
gh issue close <ISSUE_NUM> --comment "✅ All phases complete

**Feature Summary:**
- Phase 1: <Name> ✅
- Phase 2: <Name> ✅
- Phase 3: <Name> ✅
...

All deliverables implemented, tested, and verified.

Implementation complete."
```

---

## Common Patterns

### Handling Test Fixtures

Create test fixtures in the structure specified by the plan:

```
tests/
└── fixtures/
    └── skills/
        ├── valid-skill/
        │   └── SKILL.md
        ├── missing-name/
        │   └── SKILL.md
        └── invalid-yaml/
            └── SKILL.md
```

Each fixture should represent a specific test case.

### Dependencies and Prerequisites

Implementation plans include a "Dependencies and Prerequisites" section:

```markdown
## Dependencies and Prerequisites

- Node.js 18+ with npm
- TypeScript 5.5+
- Jest testing framework
- Phase 1 must be complete before Phase 2
```

Verify these before starting implementation.

### Shared Infrastructure

Plans may include a "Shared Infrastructure" section listing reusable components:

```markdown
## Shared Infrastructure

### Validators (from Phase 2)
- `validateName(name: string)` - Name format validation
- `validateDescription(desc: string)` - Description validation

### Types (from Phase 1)
- `ValidationResult` - Standard validation result format
- `FrontmatterData` - Parsed frontmatter structure
```

Reference these rather than duplicating logic.
