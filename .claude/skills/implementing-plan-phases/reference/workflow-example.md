# Workflow Example: Implementing Phase 2 of Validate Command

This example demonstrates executing Phase 2 (Validation Engine) from the validate skill command implementation plan.

## Context

The implementation plan is at `requirements/implementation/02-validate-skill-command.md`.

Phase 1 (YAML Parsing Infrastructure) is complete. Phase 2 builds the validation engine.

## Step-by-Step Execution

### 1. Read the Implementation Plan

```bash
# Locate the plan
ls requirements/implementation/
# Output: 02-validate-skill-command.md

# Read Phase 2 details
```

Phase 2 has:
- **Rationale**: Core functionality that orchestrates all validation checks
- **Implementation Steps**: 5 numbered steps
- **Deliverables**: 6 files to create

### 2. Verify Prerequisites

Check Phase 1 status shows "Complete":

```markdown
### Phase 1: YAML Parsing Infrastructure
**Status:** Complete
```

Verify Phase 1 deliverables exist:
- `src/utils/frontmatter-parser.ts`
- `src/types/validation.ts`
- `tests/unit/utils/frontmatter-parser.test.ts`

### 3. Create Feature Branch

```bash
git checkout -b feat/phase-2-validation-engine
```

### 4. Load Todos

Use TodoWrite with these items:

```
1. Create file-exists validator
2. Create required-fields validator
3. Create validation orchestrator
4. Write file-exists tests
5. Write required-fields tests
6. Write orchestrator tests
7. Verify all deliverables
```

### 5. Execute Each Step

**Step 1: Create file-exists validator**

Mark todo in_progress. Create `src/validators/file-exists.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

export interface FileExistsResult {
  exists: boolean;
  resolvedPath: string;
  error?: string;
}

export function validateFileExists(skillPath: string): FileExistsResult {
  // Handle file path pointing directly to SKILL.md
  if (skillPath.endsWith('SKILL.md')) {
    skillPath = path.dirname(skillPath);
  }

  const skillFile = path.join(skillPath, 'SKILL.md');

  if (!fs.existsSync(skillPath)) {
    return {
      exists: false,
      resolvedPath: skillFile,
      error: `Directory not found: ${skillPath}`
    };
  }

  if (!fs.existsSync(skillFile)) {
    return {
      exists: false,
      resolvedPath: skillFile,
      error: `SKILL.md not found in: ${skillPath}`
    };
  }

  return { exists: true, resolvedPath: skillFile };
}
```

Mark todo completed. Continue with next step.

**Steps 2-6: Continue pattern...**

Each step follows: mark in_progress, implement, mark completed.

### 6. Verify Deliverables

Run verification:

```bash
# All tests pass
npm test

# Build succeeds
npm run build

# Check coverage
npm run test:coverage
```

Confirm all files exist:
- `src/validators/file-exists.ts`
- `src/validators/required-fields.ts`
- `src/generators/validate.ts`
- `tests/unit/validators/file-exists.test.ts`
- `tests/unit/validators/required-fields.test.ts`
- `tests/unit/generators/validate.test.ts`

### 7. Update Plan Status

Edit `requirements/implementation/02-validate-skill-command.md`:

```markdown
### Phase 2: Validation Engine
**Feature:** [FEAT-002](../features/02-validate-skill-command.md)
**Status:** Complete

#### Deliverables
- [x] `src/validators/file-exists.ts` - File/directory existence validation
- [x] `src/validators/required-fields.ts` - Required fields validation
- [x] `src/generators/validate.ts` - Validation orchestration
- [x] `tests/unit/validators/file-exists.test.ts` - File existence tests
- [x] `tests/unit/validators/required-fields.test.ts` - Required fields tests
- [x] `tests/unit/generators/validate.test.ts` - Orchestrator tests
```

## Common Patterns

### Reusing Existing Validators

Phase 2 notes existing validators to reuse:

```markdown
#### Rationale
- **Leverages existing code**: Reuses `validateName`, `validateDescription`,
  and `validateFrontmatterKeys` from scaffold implementation
```

Import and integrate rather than rewriting:

```typescript
import { validateName } from './name';
import { validateDescription } from './description';
import { validateFrontmatterKeys } from './frontmatter';
```

### Following Code Organization

The plan's **Code Organization** section shows file structure:

```
src/
├── generators/
│   └── validate.ts           # Phase 2: Validation orchestration
├── validators/
│   ├── file-exists.ts        # Phase 2: File existence check
│   └── required-fields.ts    # Phase 2: Required fields check
```

Follow this exactly for consistency.

### Handling Test Fixtures

Create test fixtures in the specified location:

```
tests/
└── fixtures/
    └── skills/
        ├── valid-skill/
        ├── missing-name/
        ├── invalid-yaml/
        └── ...
```

## Result

Phase 2 is complete when:
- All 6 deliverables created
- Tests pass with >80% coverage
- Build succeeds
- Plan status updated to "Complete"
- All deliverable checkboxes marked `[x]`
