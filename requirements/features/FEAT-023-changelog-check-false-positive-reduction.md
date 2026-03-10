# Feature Requirements: Changelog Check False Positive Reduction

## Overview
Reduce false positives in the automated changelog-check workflow (FEAT-022) by improving LLM context, adding codebase pre-filtering, upgrading the analysis model, and requiring concrete evidence of impact before flagging a version as relevant.

## Feature ID
`FEAT-023`

## GitHub Issue
[#110](https://github.com/lwndev/ai-skills-manager/issues/110)

## Priority
High - 3 of 4 recent compatibility chores (CHORE-024 through CHORE-027) were no-ops, each consuming 15-30 minutes of effort for branch creation, review, PR creation, and merge.

## User Story
As a maintainer, I want the changelog-check workflow to only flag versions that genuinely require ASM code changes so that I spend time on real compatibility work instead of verifying false positives.

## Background

### Evidence of False Positives

| Chore | Version | Flagged Severity | Actual Impact | Code Changes |
|-------|---------|-----------------|---------------|-------------|
| 024 | v2.1.63 | high | docs only | 0 lines |
| 025 | v2.1.69 | medium | minor tests | ~50 lines of tests, 1 line of code |
| 026 | v2.1.70 | high | complete no-op | 0 lines |
| 027 | v2.1.71 | medium | complete no-op | 0 lines |

### Root Cause
The LLM prompt provides a generic description of ASM but doesn't convey the critical architectural boundary — ASM operates entirely at the filesystem level. It never interacts with Claude Code's runtime, settings files, conversation handling, or plugin system. The model sees keywords like "skill listing" or "settings.json" and flags them without understanding ASM has zero interaction surface with those systems.

## Functional Requirements

### FR-1: Enrich ASM Context with Architectural Boundaries
- Update the `ASM_CONTEXT` block (lines 180-198 of `changelog-check.yml`) to include explicit negative and positive boundaries
- Add "ASM does NOT interact with" section covering:
  - Claude Code's runtime or conversation system
  - Settings files (`settings.json`, `settings.local.json`)
  - Plugin installation or management
  - Claude Code's internal prompt/token optimization
  - Slash commands or their execution
  - The Claude Code CLI process itself
- Add "ASM ONLY interacts with" section covering:
  - Files in `.claude/skills/` and `~/.claude/skills/` directories
  - `SKILL.md` file content (frontmatter YAML + markdown body)
  - Directory structure for skill discovery (scanning for `SKILL.md` files)
  - Package archives (`.tar.gz`) for skill distribution

### FR-2: Add `affected_asm_files` Field to Tool Schema
- Add an `affected_asm_files` field (array of strings) to the `analyze_changelog_impact` tool schema
- Description: "Specific ASM source files in src/ that would need modifications. Empty array if no files are affected."
- The LLM must provide concrete file paths to justify relevance
- If `relevant: true` but `affected_asm_files` is empty, treat as low-confidence and log a warning

### FR-3: Add Codebase Grep Pre-Filter Step
- Add a new workflow step between "Parse changelog into versions" and "Analyze changelog impact with LLM"
- For each new version's changelog content, extract key technical terms (file paths, config names, feature names)
- Grep the ASM `src/` directory for those terms
- Pass grep results (matches or "no matches found") to the LLM as additional context in the user message
- This provides concrete evidence of whether a changelog change touches ASM's interaction surface

### FR-4: Upgrade Analysis Model to Sonnet 4.6
- Change the model from `claude-haiku-4-5-20251001` to `claude-sonnet-4-6` (line 259)
- Cost justification: ~$0.012/analysis increase is negligible compared to 15-30 min per false positive chore
- Sonnet provides better nuanced reasoning about architectural relevance

### FR-5: Raise the Relevance Bar in the Prompt
- Add explicit instruction to the system prompt: "Only mark as relevant if the change would require ASM code modifications or would break existing ASM functionality. Documentation-only or 'good to know' items should be marked as not relevant."
- Add instruction: "Changes to Claude Code's internal runtime, conversation handling, prompt optimization, settings management, or plugin system are NOT relevant to ASM unless they directly change the skill file format or `.claude/skills/` directory structure."

## Non-Functional Requirements

### NFR-1: Cost
- Per-analysis cost increase (Haiku to Sonnet) must remain under $0.05 per version analyzed
- Overall workflow run cost should remain under $1.00 for typical runs (1-3 versions)

### NFR-2: Accuracy
- Target: reduce false positive rate from 75% (3/4) to under 25%
- No false negatives — genuinely impactful changes (like CHORE-025's frontmatter parsing fixes) must still be flagged

### NFR-3: Backwards Compatibility
- Existing changelog-tracker.json format unchanged
- Existing issue format and labels unchanged
- Dry-run mode continues to function

## Dependencies
- Anthropic API key with access to Sonnet 4.6
- No new external dependencies

## Edge Cases
1. Changelog entry mentions `.claude/skills/` but change is internal to Claude Code (not ASM-facing): grep pre-filter provides context, LLM should still assess correctly
2. Changelog entry has no extractable technical terms: skip grep pre-filter, rely on improved prompt context
3. Multiple versions in a single run: each version analyzed independently with its own grep results
4. Grep finds matches but change is still not relevant: LLM has final say with improved architectural context

## Testing Requirements

### Manual Testing
- Run workflow in dry-run mode against known changelog versions (v2.1.70, v2.1.71) that were previously false positives — verify they are now marked as not relevant
- Run workflow against v2.1.69 changelog — verify it is still correctly flagged as relevant
- Verify grep pre-filter output appears in workflow logs

## Acceptance Criteria
- [x] ASM_CONTEXT includes explicit positive and negative architectural boundaries
- [x] Tool schema includes `affected_asm_files` field
- [x] Codebase grep pre-filter step runs before LLM analysis and passes results to the prompt
- [x] Model upgraded from Haiku 4.5 to Sonnet 4.6
- [x] System prompt includes raised relevance bar instructions
- [x] Dry-run against v2.1.70 and v2.1.71 correctly marks them as not relevant
- [x] Dry-run against v2.1.69 correctly marks it as relevant
- [x] Workflow runs successfully end-to-end in dry-run mode
