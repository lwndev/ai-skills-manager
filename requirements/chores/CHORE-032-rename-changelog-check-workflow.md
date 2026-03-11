# Chore: Rename Changelog Check Workflow

## Chore ID

`CHORE-032`

## GitHub Issue

[#117](https://github.com/lwndev/ai-skills-manager/issues/117)

## Category

`configuration`

## Description

Rename `.github/workflows/changelog-check.yml` to `.github/workflows/claude-code-changelog-check.yml` to clarify that this workflow monitors the **Claude Code** changelog for upstream compatibility — not the AI Skills Manager changelog. The current name is ambiguous and can be mistaken for a check of ASM's own `CHANGELOG.md`.

## Affected Files

- `.github/workflows/changelog-check.yml` — rename to `claude-code-changelog-check.yml`

### Internal References to Update

Within the renamed workflow file:

1. **Workflow `name:`** (line 1): Update from `Changelog Check` to `Claude Code Changelog Check`
2. **Concurrency group** (line 19): Update from `changelog-check` to `claude-code-changelog-check`
3. **Issue footer text** (line 579): Update from `changelog-check workflow` to `claude-code-changelog-check workflow`

### External References (No Changes Needed)

The following files reference the old filename but are **historical implementation docs** and do not need updating:

- `requirements/features/FEAT-022-automated-changelog-check.md`
- `requirements/features/FEAT-023-changelog-check-false-positive-reduction.md`
- `requirements/implementation/FEAT-022-automated-changelog-check.md`
- `requirements/implementation/FEAT-023-changelog-check-false-positive-reduction.md`

### Verify: No External Triggers

This workflow is triggered by `schedule` and `workflow_dispatch` only — no other workflow calls it via `workflow_call` or references it by filename. Confirm this before renaming.

## Acceptance Criteria

- [ ] Workflow file renamed from `changelog-check.yml` to `claude-code-changelog-check.yml`
- [ ] Workflow `name:` field updated to `Claude Code Changelog Check`
- [ ] Concurrency group updated to `claude-code-changelog-check`
- [ ] Issue footer text updated to reference `claude-code-changelog-check workflow`
- [ ] No other workflows reference the old filename (verified)
- [ ] Workflow triggers successfully via `workflow_dispatch` after rename

## Completion

**Status:** `Pending`

**Completed:** YYYY-MM-DD

**Pull Request:** TBD

## Notes

- Git treats a file rename as a delete + create, so the workflow run history in GitHub Actions will reset. The old `Changelog Check` workflow will appear as stale in the Actions tab until GitHub cleans it up (or it can be manually deleted via the API).
- The `.github/changelog-tracker.json` file is unaffected — it is referenced by path within the workflow, not by workflow name.
