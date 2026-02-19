# Implementation Plan: Automated Claude Code Changelog Check

## Overview

Implement a GitHub Actions workflow that automatically monitors the Claude Code changelog for changes relevant to AI Skills Manager. The workflow fetches and parses the changelog, uses the Anthropic Messages API (Claude Haiku with tool use) to analyze impact, and creates GitHub issues for ASM-relevant changes. This is a self-contained CI/CD addition — no changes to ASM source code or npm dependencies.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-022 | [#91](https://github.com/lwndev/ai-skills-manager/issues/91) | [FEAT-022-automated-changelog-check.md](../features/FEAT-022-automated-changelog-check.md) | Medium | Medium | Pending |

## Recommended Build Sequence

### Phase 1: Workflow Skeleton & Changelog Retrieval
**Feature:** [FEAT-022](../features/FEAT-022-automated-changelog-check.md) | [#91](https://github.com/lwndev/ai-skills-manager/issues/91)
**Status:** ✅ Complete

#### Rationale
- **Foundation first**: The workflow file and changelog fetching are prerequisites for all subsequent phases
- **Establishes structure**: Sets up the cron schedule, manual dispatch, dry-run input, and job structure that later phases build into
- **Quick validation**: Can verify the workflow runs and fetches content before adding LLM or issue logic

#### Implementation Steps

1. Create `.github/workflows/changelog-check.yml` with:
   - `name: Changelog Check`
   - Trigger on `schedule` (weekly, e.g., `cron: '0 9 * * 1'` — Mondays at 9 AM UTC)
   - Trigger on `workflow_dispatch` with `dry-run` boolean input (default: `false`)
   - Single job `check-changelog` running on `ubuntu-latest`
   - Permissions: `issues: write`, `contents: write` (for committing tracker file)

2. Add checkout step with `fetch-depth: 0` (needed for committing tracker updates)

3. Add changelog fetch step:
   - Use `curl -sf` to fetch from `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`
   - Save to `$RUNNER_TEMP/changelog.md`
   - On failure, log clear error message and exit with non-zero code
   - No GitHub API fallback needed initially (raw URL is reliable)

4. Add changelog parsing step using shell + `awk`/`sed`:
   - Split changelog into per-version sections by detecting `## [X.Y.Z]` or `## X.Y.Z` header patterns
   - Extract: version number, release date (if present), and raw content for each version entry
   - Save parsed versions as a JSON array to `$RUNNER_TEMP/versions.json`:
     ```json
     [{"version": "1.2.3", "date": "2025-01-15", "content": "### Added\n- ..."}]
     ```
   - Sort versions in descending order (newest first)
   - Log the number of versions found

5. Create initial tracking file `.github/changelog-tracker.json`:
   - Schema: `{"last_reviewed_version": "", "last_checked": ""}`
   - On first run (empty `last_reviewed_version`), only process the latest version
   - Add step to read tracker and determine which versions are new

6. Add version comparison step:
   - Compare parsed versions against `last_reviewed_version` from tracker
   - Build a list of new (unreviewed) versions
   - If no new versions, log "No new versions since vX.Y.Z" and exit successfully
   - Save new versions list to `$RUNNER_TEMP/new-versions.json`

#### Deliverables
- [x] `.github/workflows/changelog-check.yml` — workflow skeleton with fetch, parse, and version tracking
- [x] `.github/changelog-tracker.json` — version tracking file (initial state)

---

### Phase 2: LLM-Powered Impact Analysis
**Feature:** [FEAT-022](../features/FEAT-022-automated-changelog-check.md) | [#91](https://github.com/lwndev/ai-skills-manager/issues/91)
**Status:** Pending

#### Rationale
- **Core intelligence**: The LLM analysis is what distinguishes relevant from irrelevant changes — it must work correctly before issue creation
- **Structured output via tool use**: Using the Anthropic Messages API `tool_use` feature guarantees schema-conformant JSON, eliminating fragile text parsing
- **Testable in isolation**: Can verify analysis quality with dry-run mode before enabling issue creation

#### Implementation Steps

1. Define the ASM context as a shell variable or inline heredoc in the workflow:
   - What ASM does (manages Claude Code Agent Skills — scaffold, validate, package, install, update, uninstall, list)
   - ASM's touchpoints with Claude Code (`.claude/skills/` directory structure, SKILL.md frontmatter schema, skill discovery, CLI compatibility flags like `claude-code>=2.1`)
   - Keep this easy to update (single variable block at the top of the step)

2. Add the `analyze_changelog_impact` tool schema as a JSON variable:
   - Fields: `relevant` (boolean), `impact_categories` (array of enum strings), `severity` (enum), `summary` (string), `suggested_actions` (array of strings)
   - Impact category enums: `skills-system`, `frontmatter`, `cli-behavior`, `config-paths`, `breaking-change`, `deprecation`
   - Severity enums: `high`, `medium`, `low`

3. Add analysis step that loops over each new version:
   - For each version entry, construct a `curl` request to `https://api.anthropic.com/v1/messages`:
     - Model: `claude-haiku-4-5-20251001` (most cost-effective for structured classification)
     - System prompt: ASM context + instruction to analyze the changelog entry for ASM impact
     - User message: The raw changelog content for that version
     - Tools array: Contains the `analyze_changelog_impact` tool definition
     - `tool_choice`: `{"type": "tool", "name": "analyze_changelog_impact"}`
     - Headers: `x-api-key: $ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01`, `content-type: application/json`
   - Extract structured result with `jq -r '.content[] | select(.type == "tool_use") | .input'`
   - On API failure (non-200 status), log the error, skip this version, and do NOT update the tracker
   - Save each analysis result to `$RUNNER_TEMP/analysis-{version}.json`

4. Log each analysis result for auditability:
   - Log version, `relevant`, `severity`, and `summary` for each entry
   - In dry-run mode, log the full structured response

5. Collect all relevant versions (where `relevant == true`) into `$RUNNER_TEMP/relevant-versions.json`

#### Deliverables
- [ ] Anthropic API integration step in workflow with tool use for structured output
- [ ] ASM context variable defined and easily maintainable
- [ ] Analysis results logged for each version
- [ ] Dry-run mode outputs analysis without proceeding to issue creation

---

### Phase 3: GitHub Issue Creation & Tracker Update
**Feature:** [FEAT-022](../features/FEAT-022-automated-changelog-check.md) | [#91](https://github.com/lwndev/ai-skills-manager/issues/91)
**Status:** Pending

#### Rationale
- **Final integration**: Connects the analysis pipeline to actionable GitHub issues
- **Deduplication is critical**: Must check for existing issues before creating to ensure idempotency
- **Tracker update finalizes the run**: Only update the tracking file after all processing succeeds

#### Implementation Steps

1. Add label setup step:
   - Ensure required labels exist: `compatibility`, `automated`, `severity:high`, `severity:medium`, `severity:low`
   - Use `gh label create` with `--force` flag (creates if missing, no-ops if exists)

2. Add issue creation step that loops over relevant versions:
   - **Deduplication check**: For each version, run:
     ```bash
     gh issue list --search "COMPAT: Claude Code v${VERSION} in:title" --state all --json number --jq '.[0].number'
     ```
     Skip creation if a match is found, log "Issue already exists for vX.Y.Z"
   - **Title construction**: `COMPAT: Claude Code v${VERSION} — ${SUMMARY}` (truncate to keep under 100 chars)
   - **Labels**: `compatibility,automated,severity:${SEVERITY}`
   - **Body**: Assembled from raw changelog text + parsed LLM fields using a heredoc:
     ```markdown
     ## Claude Code v${VERSION}

     **Release date:** ${DATE}
     **Severity:** ${SEVERITY}
     **Impact categories:** ${CATEGORIES}

     ## Analysis

     ${SUMMARY}

     ## Changelog Entries

     > ${RAW_CONTENT blockquoted}

     ## Suggested Actions

     - ${ACTION_1}
     - ${ACTION_2}

     ## References

     - [Full changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)

     ---
     *This issue was automatically generated by the changelog-check workflow.*
     ```
   - Use `gh issue create --title "..." --label "..." --body "$(cat <<'EOF' ... EOF)"` via heredoc
   - Add 2-second delay (`sleep 2`) between issue creations to avoid rate limits
   - In **dry-run mode**, log the title and body but do NOT call `gh issue create`

3. Add tracker update step:
   - Update `.github/changelog-tracker.json` with the newest version processed and current timestamp
   - Commit and push the updated tracker file:
     ```bash
     git config user.name "github-actions[bot]"
     git config user.email "github-actions[bot]@users.noreply.github.com"
     git add .github/changelog-tracker.json
     git commit -m "chore: update changelog tracker to v${VERSION}"
     git push
     ```
   - Only commit if the tracker actually changed (check `git diff --cached`)
   - In **dry-run mode**, log what would be updated but do NOT commit

4. Add summary step:
   - Log total versions checked, relevant count, issues created count
   - If any API errors occurred, log them as warnings

#### Deliverables
- [ ] Issue creation step with deduplication, formatting, and rate limiting
- [ ] Label setup step ensuring required labels exist
- [ ] Tracker update step with git commit
- [ ] Dry-run mode fully functional (logs but no side effects)
- [ ] Clear workflow summary output

---

## Shared Infrastructure

### No ASM source changes required
This feature is entirely self-contained within GitHub Actions:
- `.github/workflows/changelog-check.yml` — the workflow
- `.github/changelog-tracker.json` — version tracking state

### External tools used (all pre-installed on GitHub Actions runners)
- `curl` — HTTP requests to raw GitHub content and Anthropic API
- `jq` — JSON parsing and manipulation
- `gh` — GitHub CLI for issue management
- `awk`/`sed` — Changelog markdown parsing
- `git` — Committing tracker updates

## Testing Strategy

### Integration Testing
- **Manual `workflow_dispatch`** with `dry-run: true`:
  - Verify changelog is fetched and parsed correctly
  - Verify version comparison logic (new vs. already-reviewed)
  - Verify LLM analysis returns structured results
  - Verify issue body formatting in logs
- **Manual `workflow_dispatch`** with `dry-run: false`:
  - Verify issue creation with correct title, labels, and body
  - Verify deduplication (run twice, second run should skip)
  - Verify tracker file is updated and committed
- **Local testing with `act`** (optional):
  - Requires `ANTHROPIC_API_KEY` and `GITHUB_TOKEN` secrets

### Manual Testing Checklist
- [ ] Trigger workflow manually with `dry-run: true` — verify log output
- [ ] Trigger workflow manually with `dry-run: false` — verify issue creation
- [ ] Run twice against same changelog — verify no duplicate issues
- [ ] Verify tracker file updated after successful run
- [ ] Delete tracker file and re-run — verify first-run behavior (only latest version)
- [ ] Verify workflow failure is visible when changelog URL is unavailable

## Dependencies and Prerequisites

### Repository Secrets Required
- `ANTHROPIC_API_KEY` — for Claude Haiku API calls (must be added to repository settings)

### Existing Infrastructure
- `GITHUB_TOKEN` — automatically provided by GitHub Actions (used by `gh` CLI)
- GitHub Actions already in use (CI, release, publish workflows)

### Pre-creation Steps
- Add `ANTHROPIC_API_KEY` secret to the repository
- Document the secret requirement in the PR description

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Changelog format changes | High | Low | LLM handles format variations; log errors and skip unparseable versions |
| Anthropic API downtime | Medium | Low | Log error, skip version, don't update tracker — retry on next scheduled run |
| API key rotation/expiry | High | Low | Clear error message in workflow logs; documented in repo secrets |
| GitHub rate limits on issue creation | Low | Low | 2-second delay between creations; typical runs create 0-2 issues |
| Tracker file merge conflicts | Low | Low | Bot commits to main; workflow runs weekly so conflicts are unlikely |
| False positives (irrelevant issues) | Medium | Medium | LLM analysis with structured tool use reduces noise; easy to close false positives |
| False negatives (missed relevant changes) | Medium | Low | Weekly schedule provides timely coverage; manual dispatch for ad-hoc checks |

## Success Criteria

- [ ] Workflow file exists at `.github/workflows/changelog-check.yml`
- [ ] Workflow runs on weekly schedule and via manual dispatch
- [ ] Changelog is fetched, parsed into per-version entries, and version-compared correctly
- [ ] Tracking file persists last reviewed version across runs
- [ ] `ANTHROPIC_API_KEY` secret documented as required
- [ ] Impact analysis uses Claude Haiku with `analyze_changelog_impact` tool use
- [ ] Structured output enforced via `tool_choice` — no freeform text parsing
- [ ] Issues created with correct `COMPAT:` title format, severity labels, and formatted body
- [ ] Deduplication prevents duplicate issues for same version
- [ ] Dry-run mode logs everything without creating issues or updating tracker
- [ ] Clear, actionable log output on success and failure
- [ ] No new npm dependencies added

## Code Organization

```
.github/
├── workflows/
│   ├── ci.yml                    # existing
│   ├── release.yml               # existing
│   ├── publish.yml               # existing
│   └── changelog-check.yml       # NEW — changelog monitoring workflow
└── changelog-tracker.json        # NEW — version tracking state
```
