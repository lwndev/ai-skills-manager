# Implementation Plan: Changelog Check False Positive Reduction

## Overview

This plan addresses the high false positive rate (75%) in the automated changelog-check workflow (FEAT-022). Five phases target the root cause: the LLM lacks sufficient context about ASM's architectural boundaries, leading it to flag irrelevant Claude Code changes. The changes are confined to a single file (`.github/workflows/changelog-check.yml`) and involve enriching the ASM context (Phase 1), adding an `affected_asm_files` accountability field with a model upgrade (Phase 2), adding a codebase grep pre-filter (Phase 3), auto-demoting low-confidence results where no affected files are identified (Phase 4), and cross-referencing claimed affected files against grep evidence (Phase 5).

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-023   | [#110](https://github.com/lwndev/ai-skills-manager/issues/110) | [FEAT-023-changelog-check-false-positive-reduction.md](../features/FEAT-023-changelog-check-false-positive-reduction.md) | High | Medium | Complete |

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
- [x] Dry-run verification against v2.1.70 and v2.1.71 (manual — run workflow after merge)

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
- [x] Dry-run verification (manual — run workflow after merge)

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
- [x] Full end-to-end dry-run verification against v2.1.69, v2.1.70, v2.1.71

---

### Phase 4: Low-Confidence Result Demotion
**Feature:** [FEAT-023](../features/FEAT-023-changelog-check-false-positive-reduction.md) (FR-2, FR-5) | [#110](https://github.com/lwndev/ai-skills-manager/issues/110)
**Status:** ✅ Complete

#### Rationale
- The low-confidence warning added in Phase 2 correctly identifies false positives (relevant=true, 0 affected files), but the workflow only logs a warning — it doesn't act on the signal
- v2.1.70 is the sole remaining false positive and exhibits exactly this pattern: flagged as relevant with medium severity but zero affected ASM files
- This phase converts the passive warning into an active demotion, closing the gap between detection and action
- Two complementary changes: a prompt-level instruction (tell the LLM to self-correct) and a workflow-level safety net (auto-demote if it doesn't)
- Placed after Phase 3 because it depends on the grep pre-filter and affected_asm_files field being stable

#### Implementation Steps
1. Add an explicit instruction to the system prompt (after the existing relevance criteria):
   ```
   - If you cannot identify at least one specific file in ASM's src/ directory that would need modification, you MUST mark the entry as not relevant. A change that is 'good to know' but requires zero code changes is not relevant.
   ```
2. Add auto-demotion logic after the existing low-confidence warning (lines 404-406):
   ```bash
   if [ "$RELEVANT" = "true" ] && [ "$AFFECTED_FILES" -eq 0 ]; then
     echo "  ::warning::v${VERSION} flagged as relevant but no affected ASM files — demoting to not relevant"
     RELEVANT="false"
     # Update the analysis JSON with the demotion
     ANALYSIS=$(echo "$ANALYSIS" | jq '.relevant = false | .severity = "low" | .summary = .summary + " [auto-demoted: no affected files identified]"')
   fi
   ```
3. Update the dry-run output to indicate when a result was demoted so it's visible in workflow logs
4. Test by running dry-run mode:
   - v2.1.70 should now be demoted to not-relevant (was the remaining false positive)
   - v2.1.71 should remain not-relevant (already correct)
   - v2.1.69 should remain relevant with 2 affected files (not demoted)

#### Deliverables
- [x] System prompt updated with "must identify specific files" instruction
- [x] Auto-demotion logic replaces passive low-confidence warning
- [x] Dry-run output shows demotion events (demoted analysis logged before relevance collection)
- [x] Dry-run verification against v2.1.69 (still relevant), v2.1.70 (demoted), v2.1.71 (still not relevant)

---

### Phase 5: Grep-Corroborated Affected Files Validation
**Feature:** [FEAT-023](../features/FEAT-023-changelog-check-false-positive-reduction.md) (FR-2, FR-3) | [#110](https://github.com/lwndev/ai-skills-manager/issues/110)
**Status:** ✅ Complete

#### Rationale
- Phase 4 dry-run revealed the LLM can fabricate plausible-sounding affected files to justify a relevance claim — v2.1.70 named `src/commands/list.ts` as affected by a "skill listing re-injection" runtime fix, even though the grep pre-filter found no related matches in that file
- The grep results from Phase 3 already provide ground-truth evidence of which files reference changelog terms, but this evidence is only used as LLM context — not as a hard validation gate
- This phase cross-references the LLM's `affected_asm_files` claims against the grep results: if none of the claimed files appear in the grep output, the claim is unsupported and the result is demoted
- This creates a two-layer demotion system: Phase 4 catches zero-file claims, Phase 5 catches fabricated-file claims
- No additional API calls or workflow steps required — just post-processing logic after the existing LLM analysis

#### Implementation Steps
1. After the Phase 4 auto-demotion check, add a grep-corroboration check for results that are still `relevant=true`:
   ```bash
   if [ "$RELEVANT" = "true" ] && [ "$AFFECTED_FILES" -gt 0 ]; then
     # Cross-reference affected files against grep results
     GREP_FILE="$RUNNER_TEMP/grep-results-${VERSION}.txt"
     CORROBORATED=0
     if [ -f "$GREP_FILE" ]; then
       # Check if any affected file path appears in the grep results
       for af in $(echo "$ANALYSIS" | jq -r '.affected_asm_files[]'); do
         if grep -q "$af" "$GREP_FILE"; then
           CORROBORATED=$((CORROBORATED + 1))
         fi
       done
     fi
     if [ "$CORROBORATED" -eq 0 ]; then
       echo "  ::warning::v${VERSION} affected files not corroborated by grep results — demoting to not relevant"
       RELEVANT="false"
       ANALYSIS=$(echo "$ANALYSIS" | jq '.relevant = false | .severity = "low" | .summary = .summary + " [auto-demoted: affected files not found in grep results]"')
       echo "$ANALYSIS" > "$RUNNER_TEMP/analysis-${VERSION}.json"
     else
       echo "  Grep corroboration: ${CORROBORATED}/${AFFECTED_FILES} affected file(s) confirmed"
     fi
   fi
   ```
2. Add a prompt instruction to reinforce evidence-based reasoning (append to existing relevance criteria):
   ```
   - Your affected_asm_files claims must be supported by the codebase grep results. If the grep results show no matches for changelog terms in a file, do not list that file as affected.
   ```
3. Test by running dry-run mode:
   - v2.1.70: LLM may still claim `src/commands/list.ts`, but grep results won't contain that file for the "skill listing re-injection" terms → demoted
   - v2.1.69: grep results contain matches in the claimed affected files (frontmatter parsing, skill discovery) → not demoted
   - v2.1.71: already not relevant → unaffected

#### Deliverables
- [x] Grep-corroboration logic added after Phase 4 demotion check
- [x] System prompt updated with grep-evidence instruction
- [x] Dry-run output shows corroboration counts for relevant results
- [x] Dry-run verification against v2.1.69 (corroborated), v2.1.70 (demoted), v2.1.71 (still not relevant)

---

## Shared Infrastructure

No new shared infrastructure required. All changes are confined to `.github/workflows/changelog-check.yml`.

## Testing Strategy

### Manual Testing (Primary)
- **Dry-run mode** is the primary testing mechanism for this feature
- Run `workflow_dispatch` with `dry-run: true` after each phase
- Validate against known versions:
  - v2.1.70, v2.1.71 → expected: `relevant: false`
  - v2.1.69 → expected: `relevant: true` with ≥1 affected file (not demoted)
- Verify grep output appears in workflow logs (Phase 3)
- Verify `affected_asm_files` field is populated appropriately (Phase 2)
- Verify auto-demotion events appear in workflow logs when relevant=true but 0 affected files (Phase 4)

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
| Auto-demotion causes false negatives for novel changes | Medium | Low | Only demotes when affected_asm_files is empty; genuinely impactful changes (new file formats, path changes) will have identifiable files; v2.1.69 validation confirms true positives survive |
| Grep-corroboration too strict for novel terms not yet in codebase | Medium | Low | Only triggers when LLM claims specific files are affected but grep found no changelog terms in those files; truly novel changes (e.g., new directory paths) would still have terms like `.claude/skills/` matching in existing code; v2.1.69 validates that genuine impacts survive corroboration |

## Success Criteria

- [x] False positive rate reduced from 75% to under 25% (validated by dry-run against known versions)
- [x] No false negatives — v2.1.69 continues to be flagged as relevant
- [x] Workflow runs successfully end-to-end in dry-run mode
- [x] Per-analysis cost remains under $0.05
- [x] All 7 acceptance criteria from the feature requirements document are met

## Code Organization
```
.github/
└── workflows/
    └── changelog-check.yml    # All changes in this single file
```
