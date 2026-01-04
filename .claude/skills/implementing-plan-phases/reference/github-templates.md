# GitHub Issue Management

Templates and guidance for updating GitHub issues during phase implementation.

## Finding the Issue Number

The GitHub issue number is referenced in the phase header:

```markdown
### Phase N: [Phase Name]
**Feature:** [FEAT-XXX](../features/...) | [#2](https://github.com/...)
```

Extract the number from `[#N]` notation.

## Checking Issue Status

View issue details and comments:

```bash
# View issue details
gh issue view <ISSUE_NUM>

# List all comments on an issue
gh issue view <ISSUE_NUM> --comments
```

## Phase Start Comment

Post when beginning a new phase:

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

## Phase Completion Comment

Post when a phase is complete:

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

## Closing Issue (Final Phase)

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

**Example:**

```bash
gh issue close 2 --comment "✅ All phases complete

**Feature Summary:**
- Phase 1: YAML Parsing Infrastructure ✅
- Phase 2: Validation Engine ✅
- Phase 3: Enhanced Validation Rules ✅
- Phase 4: Command Integration & Output ✅

All deliverables implemented, tested, and verified.

FEAT-002 validate command implementation complete."
```
