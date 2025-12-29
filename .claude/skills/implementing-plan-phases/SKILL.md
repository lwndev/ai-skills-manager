---
name: implementing-plan-phases
description: Executes implementation plan phases systematically, tracking progress with todos, managing feature branches, and verifying deliverables. Use when the user requests "implement phase N", "build the next phase", "continue implementation", "execute validation phase", or references implementation plans in requirements/implementation/. Handles branch creation, step-by-step execution, deliverable verification, and status updates.
allowed-tools:
  - Read
  - Edit
  - Bash
  - TodoWrite
  - Glob
---

# Implementing Plan Phases

Executes feature implementation plans phase by phase with systematic tracking and verification.

## When to Use

Activate when user says:
- "implement phase 2" / "execute phase 3" / "build phase 1"
- "do the next phase" / "continue implementation" / "keep going"
- "work on the validation phase" / "start the CLI infrastructure"
- References `@requirements/implementation/*.md` with phase request
- "what's the next step" (during active implementation)

## Phase Execution Workflow

Copy and track this checklist:

```
Phase Implementation:
- [ ] Read implementation plan (requirements/implementation/{feature-id}.md)
- [ ] Checkout feature branch (git checkout -b {feature-id} or git checkout {feature-id})
- [ ] Identify target phase (number, name, or next pending)
- [ ] Review phase: rationale, steps, deliverables
- [ ] Execute steps sequentially with TodoWrite tracking
- [ ] Verify deliverables: existence → functionality → tests
- [ ] Update plan: mark phase complete, check deliverables
- [ ] Report completion with summary
```

## Critical Rules

**Never proceed if:**
- Any deliverable verification fails
- A step is blocked or unclear
- Build/test/lint fails after implementation

**Always do:**
- Complete each step before starting next
- Use TodoWrite for step-level tracking
- Report blockers immediately
- Ask user before modifying plan structure

## Verification Loop

For each deliverable:

1. **Existence** - File exists at specified path
2. **Functionality** - Expected code/content present
3. **Validation** - Build/lint/test passes (if applicable)
4. **Fix & Retry** - If fails, fix and re-verify
5. **Confirm** - Only mark complete when all pass

## Examples

### Example 1: Specific Phase
**User:** "Implement phase 2 of the scaffold-skill plan"

**Actions:**
- Reads requirements/implementation/scaffold-skill-command.md
- Checks out `scaffold-skill-command` branch
- Updates Phase 2 to "In Progress"
- Executes implementation steps with TodoWrite
- Verifies all deliverables
- Marks complete and reports

### Example 2: Next Phase
**User:** "Continue with the next phase"

**Actions:**
- Finds first pending phase in current plan
- Confirms selection with user
- Proceeds with execution workflow

### Example 3: Named Phase
**User:** "Let's work on the validation phase"

**Actions:**
- Searches for phase with "validation" in title
- Confirms correct phase found
- Executes phase workflow

## Related Resources

- Implementation patterns → [reference.md](reference.md)
- Feature requirements → `requirements/features/`
- Implementation plans → `requirements/implementation/`
