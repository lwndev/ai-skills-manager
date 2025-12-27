---
name: implementing-plan-phase
description: Execute phases from implementation plans systematically, following defined steps and tracking deliverables. Use when the user wants to implement, execute, build, or work on a phase from an implementation plan in requirements/implementation/. Apply this skill for requests like "implement phase 3", "do the next phase", "continue implementation", "build the validation phase", or any reference to working on numbered phases from a plan.
---

# Implementing Plan Phases

Execute implementation plan phases systematically, following the defined steps and tracking deliverables.

## Example

**User request**: "Implement phase 2 of the scaffold-skill plan"

**Expected workflow**:
1. Read `requirements/implementation/scaffold-skill-command.md`
2. Find Phase 2, update status to "In Progress"
3. Execute each implementation step using TodoWrite for tracking
4. Verify deliverables exist and function correctly
5. Update status to "Complete", check off deliverables
6. Report completion with summary of what was created

## Workflow

Copy this checklist and track progress:

```
Phase Implementation:
- [ ] Step 1: Locate and read the implementation plan
- [ ] Step 2: Identify the target phase
- [ ] Step 3: Review phase details (rationale, steps, deliverables)
- [ ] Step 4: Execute implementation steps sequentially
- [ ] Step 5: Verify all deliverables complete
- [ ] Step 6: Update phase status to complete
```

### Step 1: Locate the Implementation Plan

Find the implementation plan in `requirements/implementation/`. If the user didn't specify a plan, ask the user which one to use.

### Step 2: Identify the Target Phase

- If user specified a phase number: locate that phase
- If user said "next phase": find first phase with status "Pending"
- If ambiguous: list available phases and ask user to select

### Step 3: Review Phase Details

Before implementing, review the phase's **Rationale**, **Implementation Steps**, and **Deliverables**.

Confirm with user before starting if the phase involves:
- Installing new dependencies
- Modifying existing files significantly
- Creating new architectural patterns

### Step 4: Execute Implementation Steps

Follow the implementation steps **in order**. For each step:

1. **Read the step** - understand what needs to be done
2. **Check context** - read relevant existing files before modifying
3. **Implement** - write the code or make the changes
4. **Verify** - ensure the step is complete before moving on

Use the TodoWrite tool to track individual steps within the phase.

**Critical rules:**
- Complete each step before moving to the next
- If a step is blocked, report the issue immediately
- If a step seems incorrect or outdated, ask the user before proceeding
- Reference the feature requirements document when implementation details are unclear

### Step 5: Verify Deliverables

For each deliverable, run this validation loop:

1. **Check existence** - verify file exists at specified location
2. **Validate content** - confirm expected functionality is present
3. **Run verification** - execute build/lint/test as applicable
4. If validation fails → fix the issue and re-verify
5. Only proceed when verification passes

**Critical**: Never mark a phase complete if any verification fails. If a deliverable cannot be verified, report the issue and ask the user how to proceed.

### Step 6: Update Phase Status

After all deliverables are verified:

1. Update the phase status from "Pending" to "Complete" in the implementation plan
2. Check the deliverable checkboxes
3. Report completion to the user with summary of what was created

## Implementation Patterns

See [reference.md](reference.md) for guidance on:
- Creating new files following project conventions
- Installing dependencies safely
- Creating test files
- Error recovery strategies

## Related Documents

- Implementation plans: `requirements/implementation/`
- Feature requirements: `requirements/features/`
- Project documentation: `docs/`
