# Feature Requirements: Automated Claude Code Changelog Check

## Overview

Automatically detect changes in Claude Code that may require updates to AI Skills Manager by periodically checking the [Claude Code changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md), analyzing entries for ASM-relevant impact, and creating GitHub issues to track needed updates.

## Feature ID

`FEAT-022`

## GitHub Issue

[#91](https://github.com/lwndev/ai-skills-manager/issues/91)

## Priority

Medium — Proactive maintenance to keep ASM aligned with Claude Code evolution

## User Story

As a maintainer, I want automated monitoring of Claude Code changelog entries so that I can promptly identify and track changes that require ASM updates, reducing the risk of compatibility gaps.

## Functional Requirements

### FR-1: Changelog Retrieval

- Fetch the Claude Code changelog from `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`
- Handle fetch failures gracefully (network errors, 404, rate limits)
- Support fetching via GitHub API as a fallback if raw URL is unavailable

### FR-2: Changelog Parsing

- Parse the changelog markdown into structured version entries
- Extract version number, release date, and change items per entry
- Support the [Keep a Changelog](https://keepachangelog.com/) format sections (Added, Changed, Deprecated, Removed, Fixed)
- Handle variations in changelog formatting gracefully

### FR-3: Version Tracking

- Maintain a record of the last reviewed changelog version to avoid re-processing
- Store the last reviewed version in a tracking file (e.g., `.github/changelog-tracker.json`)
- On first run, process only the most recent version (avoid flooding with historical issues)
- Identify all new versions since last reviewed version on subsequent runs

### FR-4: LLM-Powered Impact Analysis

- Send each new changelog entry to the Anthropic Messages API for ASM-relevant impact analysis
- Use Claude Haiku (most cost-effective for structured classification tasks)
- Provide a system prompt that includes ASM context:
  - What ASM does (manages Claude Code Agent Skills — scaffold, validate, package, install, update, uninstall, list)
  - ASM's touchpoints with Claude Code (`.claude/skills/` directory structure, SKILL.md frontmatter schema, skill discovery, CLI compatibility flags like `claude-code>=2.1`)
  - The impact categories to assess against (see below)
- Impact categories for the LLM to evaluate:
  - **Skills system changes**: Changes to skill format, discovery, installation, or execution
  - **Frontmatter/metadata changes**: Changes to YAML frontmatter fields, schema, or validation
  - **CLI behavior changes**: Changes to Claude Code CLI that affect how ASM interacts with it (e.g., config paths, skill flags)
  - **Configuration path changes**: Changes to `.claude/` directory structure, settings files, or skill storage locations
  - **Breaking changes**: Any backward-incompatible change that could break existing ASM functionality
  - **Deprecations**: Any deprecated feature that ASM currently depends on
- Use the Anthropic Messages API **tool use** feature to guarantee structured output
- Define a tool named `analyze_changelog_impact` with a JSON Schema specifying the output fields:
  ```json
  {
    "name": "analyze_changelog_impact",
    "description": "Report the impact analysis of a Claude Code changelog entry on AI Skills Manager.",
    "input_schema": {
      "type": "object",
      "properties": {
        "relevant": {
          "type": "boolean",
          "description": "Whether this changelog entry impacts ASM"
        },
        "impact_categories": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["skills-system", "frontmatter", "cli-behavior", "config-paths", "breaking-change", "deprecation"]
          },
          "description": "Which impact categories are affected (empty array if not relevant)"
        },
        "severity": {
          "type": "string",
          "enum": ["high", "medium", "low"],
          "description": "How urgently ASM needs to respond"
        },
        "summary": {
          "type": "string",
          "description": "1-2 sentence explanation of the impact (or why it is not relevant)"
        },
        "suggested_actions": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Specific ASM areas or code to review/update (empty array if not relevant)"
        }
      },
      "required": ["relevant", "impact_categories", "severity", "summary", "suggested_actions"]
    }
  }
  ```
- Force the model to use the tool by setting `tool_choice: {"type": "tool", "name": "analyze_changelog_impact"}` in the request
- This guarantees the API response contains a `tool_use` content block with schema-conformant JSON — no freeform text parsing required
- Extract the structured result using `jq`:
  ```bash
  jq -r '.content[] | select(.type == "tool_use") | .input'
  ```
- Only proceed to issue creation for entries where `.relevant == true`
- If the API call fails (network error, auth error, 5xx), log the error and skip that version entry — do not update the tracking version

### FR-5: GitHub Issue Creation

- Create a GitHub issue for each version where FR-4 returned `relevant: true`
- Use `gh issue create` for issue creation (authenticated via `GITHUB_TOKEN`)
- **Title**: Constructed from the parsed JSON — `COMPAT: Claude Code vX.Y.Z — ${summary}` (truncate summary to keep title under 100 chars)
- **Labels**: `compatibility`, `automated`, plus a severity label: `severity:high`, `severity:medium`, or `severity:low` (mapped from the `severity` field)
- **Body**: Assembled from a combination of the raw changelog text and the parsed LLM JSON fields, structured as:

  ```markdown
  ## Claude Code vX.Y.Z

  **Release date:** YYYY-MM-DD
  **Severity:** ${severity}
  **Impact categories:** ${impact_categories joined as comma-separated list}

  ## Analysis

  ${summary}

  ## Changelog Entries

  > ${raw changelog text for this version, blockquoted}

  ## Suggested Actions

  - ${suggested_actions[0]}
  - ${suggested_actions[1]}
  ...

  ## References

  - [Full changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)

  ---
  *This issue was automatically generated by the changelog-check workflow.*
  ```

- The body is passed to `gh issue create --body` via a heredoc to preserve formatting
- **Deduplication**: Before creating, search existing issues with `gh issue list --search "COMPAT: Claude Code vX.Y.Z in:title" --state all` — skip creation if a match is found
- **Batching**: When multiple versions are detected, create issues sequentially with a 2-second delay between calls to avoid GitHub API rate limits

### FR-6: Scheduled Execution

- Run as a GitHub Actions workflow on a daily cron schedule (e.g., `cron: '0 9 * * *'` — every day at 9 AM UTC)
- Support manual triggering via `workflow_dispatch` for on-demand checks
- Workflow uses `gh` CLI for issue creation (authenticated via `GITHUB_TOKEN`)

### FR-7: Dry Run Mode

- Support a `dry-run` input parameter on the workflow
- In dry run mode, output detected changes and proposed issues to the workflow log without creating actual issues
- Useful for testing the detection logic and validating impact analysis

## Non-Functional Requirements

### NFR-1: Reliability

- Workflow must not fail silently — log clear messages on success (no new versions, or issues created) and failure (fetch error, parse error)
- Idempotent: re-running the workflow should not create duplicate issues

### NFR-2: Minimal Dependencies

- Implement as a self-contained GitHub Actions workflow using shell scripting, `curl`, `jq`, and the `gh` CLI
- Anthropic API calls made directly via `curl` to `https://api.anthropic.com/v1/messages` (no SDK required)
- No new npm dependencies added to the project
- No changes to the ASM source code or build process

### NFR-3: Security

- Use the default `GITHUB_TOKEN` for issue creation
- Require an `ANTHROPIC_API_KEY` repository secret for LLM calls
- Do not log or expose the API key in workflow output
- Do not store or expose any sensitive data in the tracking file
- Tracking file is committed to the repository and visible in version control

### NFR-4: Maintainability

- ASM context provided to the LLM should be easy to update (defined as a variable or separate file referenced by the workflow)
- Workflow should log each step clearly for debugging
- Log the LLM's structured response for each version analyzed (for auditability)

## Dependencies

- GitHub Actions (already in use for CI, release, publish workflows)
- `gh` CLI (available in GitHub Actions runners by default)
- `curl` and `jq` (available in GitHub Actions runners by default)
- Anthropic Messages API (`https://api.anthropic.com/v1/messages`) — Claude Haiku model
- `ANTHROPIC_API_KEY` repository secret
- Claude Code changelog maintained at `https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md`

## Edge Cases

1. **Changelog format changes**: If Anthropic restructures the changelog format, parsing may fail — the LLM can help handle format variations, but log a clear error and skip if the raw content cannot be sectioned by version
2. **LLM API failure**: If the Anthropic API is unreachable or returns an error, log the failure, do not update the tracking version, and exit with non-zero code
3. **Multiple versions in one check**: If several versions are released between checks, create separate issues for each impactful version
4. **No impactful changes**: Log "no ASM-relevant changes detected" and update the tracking version without creating issues
5. **Changelog URL unavailable**: Log error, do not update tracking version, exit with non-zero code so workflow shows as failed
6. **Issue creation rate limits**: If creating multiple issues, add a brief delay between API calls to avoid rate limiting
7. **First run with large changelog**: Only process the latest version to avoid creating dozens of historical issues
8. **Version already tracked**: If tracking file shows current version already reviewed, skip with success

## Testing Requirements

### Unit Tests

- Not applicable — this is a GitHub Actions workflow, not ASM source code

### Integration Tests

- Test the workflow locally using `act` (GitHub Actions local runner) or manual `workflow_dispatch` with `dry-run: true`
- Verify changelog parsing against a known changelog snapshot

### Manual Testing

- Trigger workflow manually with `dry-run: true` and verify log output
- Trigger workflow manually with `dry-run: false` and verify issue creation
- Verify deduplication by running twice against the same changelog state
- Verify tracking file is updated after successful run

### Local Testing Directions

All manual testing is done from your local terminal using the `gh` CLI. The workflow runs on GitHub Actions — you trigger and observe it remotely.

#### Prerequisites

- `gh` CLI installed and authenticated (`gh auth status`)
- `ANTHROPIC_API_KEY` added as a repository secret (`gh secret list` to verify)
- Current branch pushed (the workflow runs against the default branch)

#### 1. Dry-run test

Trigger the workflow in dry-run mode and watch the output:

```bash
gh workflow run changelog-check.yml -f dry-run=true
```

Wait a few seconds, then find and watch the run:

```bash
gh run list --workflow=changelog-check.yml --limit=1
gh run watch          # watches the most recent run in progress
```

After it completes, view the full log output:

```bash
gh run view --log     # shows logs for the most recent completed run
```

**What to verify:**
- Changelog fetched successfully (byte count logged)
- Versions parsed into JSON (version count logged)
- Tracker read correctly (shows last reviewed version or "first run")
- LLM analysis returned structured results (relevant, severity, summary logged per version)
- `[dry-run]` prefix on proposed issue titles — no actual issues created
- `[dry-run]` prefix on tracker update — no commit pushed
- Workflow summary section at the end with all counts

#### 2. Live run (creates issues)

```bash
gh workflow run changelog-check.yml -f dry-run=false
gh run watch
```

**What to verify:**
- Issues created with `COMPAT: Claude Code vX.Y.Z — ...` title format
- Labels applied: `compatibility`, `automated`, `severity:{high|medium|low}`
- Issue body contains: Analysis, Changelog Entries (blockquoted), Suggested Actions, References
- Tracker file committed and pushed (check with `git pull` and inspect `.github/changelog-tracker.json`)

Check created issues:

```bash
gh issue list --label=compatibility --label=automated
```

#### 3. Deduplication test

Run the workflow again against the same changelog state:

```bash
gh workflow run changelog-check.yml -f dry-run=false
gh run watch
```

**What to verify:**
- Log shows "Issue already exists for vX.Y.Z (#N) — skipping" for previously created versions
- No duplicate issues created (compare `gh issue list --label=automated` before and after)
- Tracker version unchanged (no new commit)

#### 4. Verify tracker file updated

After a successful live run:

```bash
git pull
cat .github/changelog-tracker.json
```

**What to verify:**
- `last_reviewed_version` matches the latest Claude Code changelog version
- `last_checked` has a recent UTC timestamp

#### 5. First-run behavior test

Reset the tracker to simulate a first run, commit, and push:

```bash
echo '{"last_reviewed_version": "", "last_checked": ""}' > .github/changelog-tracker.json
git add .github/changelog-tracker.json
git commit -m "test: reset changelog tracker for first-run test"
git push
```

Then trigger:

```bash
gh workflow run changelog-check.yml -f dry-run=true
gh run watch
gh run view --log
```

**What to verify:**
- Log shows "First run detected — will only process the latest version"
- Only 1 version analyzed (not the entire changelog history)

> **Cleanup:** After testing, either let the next live run restore the tracker, or reset it to the correct version manually.

#### 6. Changelog URL failure test

This test requires temporarily breaking the fetch URL in the workflow file. It is optional — the behavior can also be verified by reading the workflow source (the `curl -sf` will exit non-zero and the step logs `::error::Failed to fetch changelog`).

If you want to test it live:

1. Temporarily change the URL in `.github/workflows/changelog-check.yml` to an invalid path (e.g., append `-BROKEN`)
2. Commit, push, and trigger the workflow
3. Verify the workflow run shows as failed with the error message
4. Revert the URL change

#### Viewing past runs

```bash
# List recent runs
gh run list --workflow=changelog-check.yml --limit=5

# View a specific run's logs
gh run view <run-id> --log

# View only a specific job's logs
gh run view <run-id> --log --job=<job-id>
```

## Future Enhancements

- Provide ASM source code context to the LLM for even more precise impact analysis (e.g., identify specific files/functions affected)
- Add Slack/email notifications for high-severity changes
- Extend to monitor other upstream dependencies (e.g., agent-skills-io specification)
- Dashboard or summary issue that aggregates all compatibility tracking
- Auto-assign issues based on severity level

## Acceptance Criteria

- [ ] GitHub Actions workflow file created at `.github/workflows/changelog-check.yml`
- [ ] Workflow fetches and parses the Claude Code changelog successfully
- [ ] Version tracking file persists last reviewed version across runs
- [ ] `ANTHROPIC_API_KEY` repository secret documented as required
- [ ] Impact analysis uses Claude Haiku via Anthropic Messages API with tool use
- [ ] `analyze_changelog_impact` tool schema enforces structured JSON output (relevant, impact_categories, severity, summary, suggested_actions)
- [ ] Impact analysis correctly identifies skills-related changes
- [ ] GitHub issues are created with correct title format, body, and labels
- [ ] Duplicate issues are not created for already-processed versions
- [ ] Dry run mode logs proposed issues without creating them
- [ ] Workflow runs on schedule (daily) and via manual dispatch
- [ ] Workflow logs are clear and actionable on both success and failure
- [ ] No new npm dependencies added to the project
