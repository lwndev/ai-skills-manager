---
name: implementing-plan-phases
description: Executes implementation plan phases systematically, tracking progress with todos, managing feature branches, and verifying deliverables. Use when the user requests "implement phase N", "build the next phase", "continue implementation", "execute validation phase", or references implementation plans in requirements/implementation/. Handles branch creation, step-by-step execution, deliverable verification, and status updates.
---

# Implementing Plan Phases

Execute implementation plan phases with systematic tracking and verification.

## When to Use

- User requests "implement phase N" or "build the next phase"
- References files in `requirements/implementation/`
- Continuing multi-phase implementation work

## Quick Start

1. Locate implementation plan in `requirements/implementation/`
2. Identify target phase (user-specified or next pending)
3. Update plan status to "🔄 In Progress"
   ```markdown
   **Status:** 🔄 In Progress
   ```
4. Update GitHub issue with phase start:
   ```bash
   gh issue comment <ISSUE_NUM> --body "🔄 Starting Phase N: <Name>..."
   ```
5. Create feature branch (if not already exists): `feat/{Feature ID}-{2-3-word-summary}`
6. Load implementation steps into todos
7. Execute each step, marking complete as you go
8. Verify deliverables (tests pass, build succeeds)
9. Update plan status to "✅ Complete"
10. Update GitHub issue with completion comment:
    ```bash
    gh issue comment <ISSUE_NUM> --body "✅ Completed Phase N: <Name>..."
    ```

## Workflow

Copy this checklist and track progress:

```
Phase Implementation:
- [ ] Locate implementation plan
- [ ] Identify target phase
- [ ] Update plan status to "🔄 In Progress"
- [ ] Post GitHub issue start comment
- [ ] Create/switch to feature branch
- [ ] Load steps into todos
- [ ] Execute implementation steps
- [ ] Verify deliverables
- [ ] Update plan status to "✅ Complete"
- [ ] Post GitHub issue completion comment
```

See [step-details.md](reference/step-details.md) for detailed guidance on each step.

## Phase Structure

Implementation plans follow this format:

```markdown
### Phase N: [Phase Name]
**Feature:** [FEAT-XXX](../features/...) | [#IssueNum](https://github.com/...)
**Status:** Pending | 🔄 In Progress | ✅ Complete

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

The GitHub issue number `[#N]` is used for status updates.

## Branch Naming

Format: `feat/{Feature ID}-{2-3-word-summary}`

Examples:
- `feat/FEAT-001-scaffold-skill-command`
- `feat/FEAT-002-validate-skill-command`
- `feat/FEAT-007-chore-task-skill`

## Verification

Before marking a phase complete, verify:

- All deliverables created/modified
- Tests pass: `npm test`
- Build succeeds: `npm run build`
- Coverage meets threshold (if specified)
- Plan status updated with checkmarks
- GitHub issue updated

## References

- **Complete workflow example**: [workflow-example.md](reference/workflow-example.md) - Full Phase 2 implementation walkthrough
- **GitHub issue templates**: [github-templates.md](reference/github-templates.md) - Comment templates for issue updates
- **Detailed step guidance**: [step-details.md](reference/step-details.md) - In-depth explanation of each workflow step
