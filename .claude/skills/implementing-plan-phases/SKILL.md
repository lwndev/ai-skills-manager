---
name: implementing-plan-phases
description: Executes implementation plan phases systematically, tracking progress with todos, managing feature branches, and verifying deliverables. Use when the user requests "implement phase N", "build the next phase", "continue implementation", "execute validation phase", or references implementation plans in requirements/implementation/. Handles branch creation, step-by-step execution, deliverable verification, and status updates.
---

# Implementing Plan Phases

Execute implementation plan phases with systematic tracking, verification, and status updates.

## When to Use This Skill

- User requests implementation of a specific phase (e.g., "implement phase 2")
- Continuing work on a multi-phase implementation plan
- User asks to "build the next phase" or "continue implementation"
- References files in `requirements/implementation/`

## Quick Start

1. **Locate the implementation plan** in `requirements/implementation/`
2. **Identify the target phase** from user request or find the next pending phase
3. **Create feature branch** if not already on one
4. **Load phase steps into todos** for tracking
5. **Execute each step**, marking complete as you go
6. **Verify deliverables** against the checklist
7. **Update plan status** to mark phase complete

## Workflow

Copy this checklist and track progress:

```
Phase Implementation:
- [ ] Step 1: Locate and read the implementation plan
- [ ] Step 2: Identify target phase and verify prerequisites
- [ ] Step 3: Create/switch to feature branch
- [ ] Step 4: Load implementation steps into todos
- [ ] Step 5: Execute each implementation step
- [ ] Step 6: Verify all deliverables
- [ ] Step 7: Update plan status to complete
```

### Step 1: Locate the Implementation Plan

```bash
ls requirements/implementation/
```

Read the relevant plan file to understand phases and current status.

### Step 2: Identify Target Phase

- Look for phases with **Status: Pending**
- Verify prior phases are **Complete** (dependencies)
- Note the **Rationale** section for context

### Step 3: Branch Strategy

Create a feature branch if not already on one:

```bash
git checkout -b feat/phase-N-short-description
```

Naming convention: `feat/phase-{N}-{2-3-word-summary}`

### Step 4: Load Steps into Todos

Use TodoWrite to track each implementation step from the phase. Include:
- Each numbered step from "Implementation Steps"
- Deliverable verification as final step

### Step 5: Execute Implementation

For each step:
1. Mark todo as `in_progress`
2. Implement the required functionality
3. Write tests alongside implementation
4. Mark todo as `completed`

Follow existing code patterns. Reference the **Shared Infrastructure** section for reusable utilities.

### Step 6: Verify Deliverables

Check each deliverable from the phase:
- Files created/modified exist
- Tests pass: `npm test`
- Build succeeds: `npm run build`
- Coverage meets threshold (if specified)

### Step 7: Update Plan Status

Edit the implementation plan to update the phase status:

```markdown
### Phase N: [Phase Name]
**Status:** Complete
```

Update deliverable checkboxes from `[ ]` to `[x]`.

## Phase Structure Reference

Implementation plans follow this phase structure:

```markdown
### Phase N: [Phase Name]
**Feature:** [Link to feature doc] | [GitHub Issue]
**Status:** Pending | In Progress | Complete

#### Rationale
Why this phase comes at this point in the sequence.

#### Implementation Steps
1. Specific action to take
2. Another specific action
3. Write tests for new functionality

#### Deliverables
- [ ] `path/to/file.ts` - Description
- [ ] `tests/path/to/file.test.ts` - Tests
```

## Handling Issues

**Blocked by failing tests**: Fix before proceeding. Do not skip verification.

**Unclear requirements**: Check the feature document linked in the phase header.

**Missing dependencies**: Verify prior phases are complete. Check **Dependencies and Prerequisites** section.

**Scope creep**: Stay focused on the current phase deliverables only.

## Verification Checklist

Before marking a phase complete:

- [ ] All implementation steps executed
- [ ] All deliverables created/modified
- [ ] Tests written and passing
- [ ] Build succeeds without errors
- [ ] Implementation plan updated with status
- [ ] Deliverable checkboxes checked

## Reference

See [workflow-example.md](reference/workflow-example.md) for a complete example of executing Phase 2 from a validation command implementation plan.
