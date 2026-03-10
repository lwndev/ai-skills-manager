# Implementation Plan: Changelog Check False Positive Reduction

## Overview

This plan addresses the high false positive rate (75%) in the automated changelog-check workflow (FEAT-022). Four improvements target the root cause: the LLM lacks sufficient context about ASM's architectural boundaries, leading it to flag irrelevant Claude Code changes. The changes are confined to a single file (`.github/workflows/changelog-check.yml`) and involve enriching the ASM context, adding a codebase grep pre-filter, upgrading the analysis model, and tightening the relevance criteria.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-023   | [#110](https://github.com/lwndev/ai-skills-manager/issues/110) | [FEAT-023-changelog-check-false-positive-reduction.md](../features/FEAT-023-changelog-check-false-positive-reduction.md) | High | Medium | Pending |

## Recommended Build Sequence

### Phase 1: Enrich ASM Context and Raise the Relevance Bar
**Feature:** [FEAT-023](../features/FEAT-023-changelog-check-false-positive-reduction.md) (FR-1, FR-5) | [#110](https://github.com/lwndev/ai-skills-manager/issues/110)
**Status:** ✅ Complete

#### Rationale
- The root cause of false positives is insufficient architectural context — the LLM doesn't know what ASM does and doesn't interact with
- This is the highest-impact, lowest-risk change: no new workflow steps or schema changes, just better prompt engineering
- Establishes the foundation that makes all subsequent phases more effective
- Combines FR-1 and FR-5 because both modify the same prompt/context areas and are logically coupled

#### Implementation Steps
1. Replace the `ASM_CONTEXT` block (lines 180-198) with an expanded version that includes:
   - Existing touchpoints (keep as "ASM ONLY interacts with" section)
   - New "ASM does NOT interact with" section listing: Claude Code's runtime/conversation system, settings files, plugin management, prompt/token optimization, slash commands, and the CLI process itself
   - Reframe the positive touchpoints to be more specific: `.claude/skills/` directories, `SKILL.md` file content (frontmatter YAML + markdown body), directory structure scanning for `SKILL.md` files, package archives (`.tar.gz`) for distribution
2. Add explicit relevance bar instructions to the system prompt (line 260-261):
   - "Only mark as relevant if the change would require ASM code modifications or would break existing ASM functionality. Documentation-only or 'good to know' items should be marked as not relevant."
   - "Changes to Claude Code's internal runtime, conversation handling, prompt optimization, settings management, or plugin system are NOT relevant to ASM unless they directly change the skill file format or `.claude/skills/` directory structure."
3. Test by running the workflow in dry-run mode against known false positives (v2.1.70, v2.1.71)

#### Deliverables
- [x] Updated `ASM_CONTEXT` block with positive and negative architectural boundaries
- [x] Updated system prompt with raised relevance bar instructions
- [ ] Dry-run verification against v2.1.70 and v2.1.71 (manual — run workflow after merge)

---

### Phase 2: Add `affected_asm_files` Field and Upgrade Model
**Feature:** [FEAT-023](../features/FEAT-023-changelog-check-false-positive-reduction.md) (FR-2, FR-4) | [#110](https://github.com/lwndev/ai-skills-manager/issues/110)
**Status:** ✅ Complete

#### Rationale
- Combines two complementary changes: the `affected_asm_files` field forces the LLM to provide concrete evidence, and the Sonnet upgrade gives it the reasoning capability to use that field well
- Adding the field without upgrading the model risks Haiku producing lower-quality file path reasoning; upgrading without the field misses the accountability mechanism
- Both changes are simple, localized modifications (tool schema and model string)
- Depends on Phase 1's improved context being in place so the model has enough information to populate the field accurately

#### Implementation Steps
1. Add `affected_asm_files` field to the `TOOL_SCHEMA` block (after `suggested_actions`):
   ```json
   "affected_asm_files": {
     "type": "array",
     "items": { "type": "string" },
     "description": "Specific ASM source files in src/ that would need modifications. Empty array if no files are affected."
   }
   ```
2. Add `affected_asm_files` to the `required` array in the tool schema
3. Change the model from `claude-haiku-4-5-20251001` to `claude-sonnet-4-6` (line 259)
4. Add a validation step after extracting the analysis result: if `relevant: true` but `affected_asm_files` is empty, log a warning:
   ```bash
   AFFECTED_FILES=$(echo "$ANALYSIS" | jq -r '.affected_asm_files | length')
   if [ "$RELEVANT" = "true" ] && [ "$AFFECTED_FILES" -eq 0 ]; then
     echo "  ::warning::v${VERSION} flagged as relevant but no affected ASM files specified — low confidence result"
   fi
   ```
5. Include `affected_asm_files` in the issue body template under a new "Affected Files" section (only when non-empty)
6. Test by running dry-run and verifying the model produces reasonable file paths for genuinely relevant versions

#### Deliverables
- [x] `affected_asm_files` field added to tool schema with `required` constraint
- [x] Model upgraded from `claude-haiku-4-5-20251001` to `claude-sonnet-4-6`
- [x] Low-confidence warning for relevant results with empty affected files
- [x] Affected files section in issue body template
- [ ] Dry-run verification (manual — run workflow after merge)

---

### Phase 3: Add Codebase Grep Pre-Filter
**Feature:** [FEAT-023](../features/FEAT-023-changelog-check-false-positive-reduction.md) (FR-3) | [#110](https://github.com/lwndev/ai-skills-manager/issues/110)
**Status:** ✅ Complete

#### Rationale
- Most complex change — adds a new workflow step and modifies how the LLM prompt is constructed
- Depends on Phases 1 and 2 being stable so that any issues can be isolated to this phase
- Provides the strongest evidence-based filtering: concrete grep results from the ASM codebase give the LLM factual data rather than relying solely on its reasoning
- Placed last because it's the most impactful but also the riskiest (new step, string processing of changelog content)

#### Implementation Steps
1. Add a new workflow step named "Grep codebase for changelog terms" between "Parse changelog into versions" and "Analyze changelog impact with LLM":
   ```yaml
   - name: Grep codebase for changelog terms
     if: env.SKIP_REMAINING != 'true'
     run: |
       # For each new version, extract key terms and grep src/
       ...
   ```
2. Implement term extraction from changelog content:
   - Extract file paths (patterns like `*.md`, `.claude/`, `settings.json`)
   - Extract feature/config names (e.g., `SKILL.md`, `frontmatter`, `skills/`)
   - Extract quoted terms and backtick-delimited terms
   - Use a combination of grep patterns: `grep -rn "term" src/ || echo "no matches"`
   - Cap at 10-15 terms per version to limit runtime
3. Store grep results in a temp file per version (`$RUNNER_TEMP/grep-results-${VERSION}.txt`)
4. Modify the LLM analysis step to include grep results in the user message:
   - Append grep results after the changelog content
   - Format as: `\n\n## Codebase Grep Results\n\nThe following terms from the changelog were searched in ASM's src/ directory:\n\n${GREP_RESULTS}`
   - If no terms were extractable, include: "No specific technical terms could be extracted for codebase search."
5. Handle edge cases:
   - Changelog with no extractable terms: skip grep, add note to prompt
   - Very long grep output: truncate to 2000 characters to stay within token limits
   - Binary file matches: exclude with `grep -I` flag
6. Test end-to-end in dry-run mode:
   - v2.1.70 and v2.1.71 should show "no matches" and be marked not relevant
   - v2.1.69 should show matches for relevant terms and remain flagged

#### Deliverables
- [x] New "Grep codebase for changelog terms" workflow step
- [x] Term extraction logic with reasonable limits
- [x] Grep results passed to LLM as additional context
- [x] Edge case handling (no terms, long output, binary files)
- [ ] Full end-to-end dry-run verification against v2.1.69, v2.1.70, v2.1.71

---

## Shared Infrastructure

No new shared infrastructure required. All changes are confined to `.github/workflows/changelog-check.yml`.

## Testing Strategy

### Manual Testing (Primary)
- **Dry-run mode** is the primary testing mechanism for this feature
- Run `workflow_dispatch` with `dry-run: true` after each phase
- Validate against known versions:
  - v2.1.70, v2.1.71 → expected: `relevant: false`
  - v2.1.69 → expected: `relevant: true`
- Verify grep output appears in workflow logs (Phase 3)
- Verify `affected_asm_files` field is populated appropriately (Phase 2)

### No Automated Tests
- This feature modifies a GitHub Actions workflow file, which cannot be unit tested
- Validation relies on dry-run executions against known data

## Dependencies and Prerequisites

- Anthropic API key with access to `claude-sonnet-4-6` model
- Existing `changelog-check.yml` workflow (FEAT-022) — already merged
- No new external dependencies or packages

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Sonnet model cost increase exceeds budget | Low | Low | Per-analysis cost increase is ~$0.012; well under $0.05 cap per NFR-1 |
| Grep pre-filter adds significant runtime | Low | Low | Cap terms at 10-15; grep on `src/` is fast (~100 files) |
| Term extraction misses relevant terms | Medium | Medium | Grep is supplementary context, not a gate; LLM still makes final decision |
| Over-correction causes false negatives | High | Low | Test against v2.1.69 (known true positive) in every phase; instructions explicitly say "no false negatives" |
| Shell escaping issues in grep patterns | Medium | Medium | Sanitize extracted terms; use `grep -F` for literal matching where possible |
| YAML syntax errors in workflow file | High | Low | Validate YAML after each edit; test with `act` locally if available |

## Success Criteria

- [ ] False positive rate reduced from 75% to under 25% (validated by dry-run against known versions)
- [ ] No false negatives — v2.1.69 continues to be flagged as relevant
- [ ] Workflow runs successfully end-to-end in dry-run mode
- [ ] Per-analysis cost remains under $0.05
- [ ] All 7 acceptance criteria from the feature requirements document are met

## Code Organization
```
.github/
└── workflows/
    └── changelog-check.yml    # All changes in this single file
```
