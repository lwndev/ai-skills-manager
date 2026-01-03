# Chore: Fix Implementing-Plan-Phases Skill Step Consistency

## Chore ID

`CHORE-003`

## GitHub Issue

[#17](https://github.com/lwndev/ai-skills-manager/issues/17)

## Category

`refactoring`

## Description

Fix intermittent step execution failures in the `implementing-plan-phases` skill by aligning step numbering across files, flattening nested references, adding tables of contents to long reference files, and improving inline content in SKILL.md.

## Background

Root cause analysis identified these issues causing intermittent failures on Steps 3 and 10:

1. **Inconsistent step numbering** - SKILL.md Quick Start has different step numbers than step-details.md (e.g., SKILL.md Step 3 = step-details.md Step 1)
2. **Nested file references** - step-details.md references github-templates.md, violating the "one level deep" best practice
3. **Missing table of contents** - step-details.md (282 lines) and workflow-example.md (308 lines) lack TOCs, causing incomplete reads
4. **Insufficient inline content** - Steps 3 and 10 in SKILL.md lack examples, forcing navigation through multiple files
5. **Workflow checklist mismatch** - Quick Start has 10 steps but workflow checklist has 8 items

## Affected Files

- `.claude/skills/implementing-plan-phases/SKILL.md`
- `.claude/skills/implementing-plan-phases/reference/step-details.md`
- `.claude/skills/implementing-plan-phases/reference/workflow-example.md`
- `.claude/skills/implementing-plan-phases/reference/github-templates.md`

## Acceptance Criteria

- [ ] Step numbering is consistent across SKILL.md, step-details.md, and workflow-example.md
- [ ] Workflow checklist in SKILL.md matches the numbered Quick Start steps (10 items)
- [ ] step-details.md has a table of contents at the top
- [ ] workflow-example.md has a table of contents at the top
- [ ] GitHub templates are inlined into step-details.md (flatten nested reference)
- [ ] SKILL.md Quick Start includes inline examples for Steps 3 and 10:
  - Step 3: Shows the exact markdown edit for status change
  - Step 10: Shows the `gh issue comment` command template
- [ ] SKILL.md body remains under 500 lines (per best practices)
- [ ] Skill executes Steps 3 and 10 reliably in testing

## Notes

### Step Numbering Alignment

Current misalignment:

| SKILL.md Quick Start | step-details.md Current | Proposed Alignment |
|---------------------|-------------------------|-------------------|
| 1. Locate plan | 2. Locate plan | 1. Locate plan |
| 2. Identify phase | 3. Identify phase | 2. Identify phase |
| 3. Update status (In Progress) | 1. Update status | 3. Update status |
| 4. Update GitHub issue (start) | 4. Update GitHub issue | 4. Update GitHub issue (start) |
| ... | ... | ... |

Recommend reordering step-details.md to match SKILL.md Quick Start order.

### Flattening Nested References

Move essential content from github-templates.md directly into step-details.md under Steps 4 and 10. Keep github-templates.md as optional advanced reference only.

### Testing

After changes, test the skill with:
- "implement phase 1" on a sample implementation plan
- Verify Steps 3 and 10 execute without requiring manual intervention
