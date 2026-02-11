# Implementation Plan: Interactive Scaffold Mode

## Overview

Add an `--interactive` / `-i` flag to `asm scaffold` that launches a guided prompt-driven workflow for template selection and configuration. This replaces the need to memorize flag combinations by walking users through each option with descriptions, conditional logic, and a confirmation summary before generating the skill.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-019 | [#45](https://github.com/lwndev/ai-skills-manager/issues/45) | [FEAT-019-interactive-scaffold-mode.md](../features/FEAT-019-interactive-scaffold-mode.md) | Medium | Medium | Pending |

## Recommended Build Sequence

### Phase 1: Dependency and Interactive Infrastructure
**Feature:** [FEAT-019](../features/FEAT-019-interactive-scaffold-mode.md) | [#45](https://github.com/lwndev/ai-skills-manager/issues/45)
**Status:** ✅ Complete

#### Rationale
- Install the prompt library dependency before any interactive code can be written
- Register the `--interactive` / `-i` flag on the scaffold command
- Implement TTY detection and flag conflict detection — these are prerequisites for the prompt flow
- Establish the module structure (`src/commands/scaffold-interactive.ts`) to keep interactive logic separated from the existing command handler

#### Implementation Steps
1. Install `@inquirer/prompts` as a production dependency (`npm install @inquirer/prompts`)
2. Add `interactive?: boolean` to the `CliScaffoldOptions` interface in `src/commands/scaffold.ts`
3. Register `-i, --interactive` flag on the scaffold command in `registerScaffoldCommand()` in `src/commands/scaffold.ts`
4. Create `src/commands/scaffold-interactive.ts` with:
   - `isTTY()` function — checks `process.stdin.isTTY` (FR-13)
   - `detectConflictingFlags(options: CliScaffoldOptions): string[]` — returns list of template-content flag names that were set alongside `--interactive` (the flags: `template`, `context`, `agent`, `userInvocable`, `hooks`, `minimal`, `description`, `allowedTools`, `argumentHint`, `license`, `compatibility`, `metadata`). **CHORE-013 update:** `memory` and `model` removed; `license`, `compatibility`, `metadata` added.
   - `TEMPLATE_CONTENT_FLAGS` constant — the list of flag names that `--interactive` overrides (includes `userInvocable` even though there is no interactive prompt for it — `userInvocable` is implicitly determined by template type: `internal` sets it to `false`, all others default to `true`). **CHORE-013 update:** `memory` and `model` removed from this list; `license`, `compatibility`, and `metadata` added.
5. Add an early branch in `handleScaffold()` in `src/commands/scaffold.ts`: if `options.interactive` is true, check TTY and conflicting flags, then call into the interactive module (stub for now — actual prompt flow comes in Phase 2)
   - If not a TTY: display error `Error: --interactive requires a TTY. Use explicit flags for non-interactive environments.` and exit with code 1
   - If conflicting flags detected: display warning `Interactive mode enabled — template flags will be ignored.` using `output.displayWarning()`
6. Update help text for the scaffold command to document the `--interactive` / `-i` flag
7. Write unit tests in `tests/unit/commands/scaffold-interactive.test.ts`:
   - `isTTY()` returns correct value based on `process.stdin.isTTY`
   - `detectConflictingFlags()` correctly identifies template-content flags
   - `detectConflictingFlags()` does not flag output-location flags (`output`, `project`, `personal`, `force`)
   - Non-TTY environment produces correct error message and exit code
   - Warning displayed when conflicting flags are provided
   - `-i` short flag is accepted as alias for `--interactive`

#### Deliverables
- [x] `@inquirer/prompts` added to `package.json` dependencies
- [x] `-i, --interactive` flag registered on scaffold command
- [x] `src/commands/scaffold-interactive.ts` created with TTY detection and flag conflict detection
- [x] `handleScaffold()` branches to interactive path when flag is set
- [x] Help text updated for `--interactive` flag
- [x] `tests/unit/commands/scaffold-interactive.test.ts` — TTY detection and flag conflict tests

---

### Phase 2: Interactive Prompt Flow
**Feature:** [FEAT-019](../features/FEAT-019-interactive-scaffold-mode.md) | [#45](https://github.com/lwndev/ai-skills-manager/issues/45)
**Status:** ✅ Complete

#### Rationale
- With infrastructure in place, implement the full sequential prompt flow
- Each prompt is conditional based on the selected template type, matching the requirements (FR-1 through FR-11)
- Prompts produce a `ScaffoldTemplateOptions` object that feeds directly into the existing `scaffold()` API — no API changes needed

#### Implementation Steps
1. Implement `runInteractivePrompts(name: string)` in `src/commands/scaffold-interactive.ts` that returns `{ templateOptions: ScaffoldTemplateOptions; description?: string; allowedTools?: string[] }` (or throws on cancellation)
   - All prompts must follow NFR-3 accessibility requirements: clear/concise prompt text, default values indicated in prompt text (e.g., `(Y/n)` or `(default: basic)`), and all prompts navigable via keyboard (arrow keys for `select`, Enter to confirm) — these are provided by `@inquirer/prompts` out of the box but prompt messages must be written to include default indicators
2. Implement template type selection prompt (FR-2) using `select` from `@inquirer/prompts`:
   - Choices: `basic`, `forked`, `with-hooks`, `internal` with descriptions (**CHORE-013:** `agent` removed)
   - Default: `basic`
3. Implement context type selection prompt (FR-3) using `select`:
   - Only shown when template is `basic` (other templates set context implicitly — `forked` defaults to `fork`; `with-hooks` and `internal` default to `inherit`; these defaults are handled by the existing scaffold API, not by the interactive module)
   - Choices: `inherit` (default), `fork`
   - When `inherit` is selected, omit `context` from options
4. Implement agent name input prompt (FR-4) using `input`:
   - Optional — empty input skips
   - Validate with existing `validateAgent()` logic (rejects invalid characters; this is stricter than FR-4's "any non-empty string" but consistent with NFR-2's input validation requirement and the existing CLI behavior)
5. ~~Implement memory scope prompt (FR-5)~~ — **Removed by CHORE-013.** The `memory` field is agent-only.
6. ~~Implement model selection prompt (FR-6)~~ — **Removed by CHORE-013.** The `model` field is agent-only.
7. Implement hooks prompt (FR-7) using `confirm`:
   - Only shown for `basic` and `forked` templates (**CHORE-013:** `agent` template removed, no longer a consideration)
   - Default: No
8. Implement minimal mode prompt (FR-8) using `confirm`:
   - Always shown
   - Default: No
9. Implement description input prompt (FR-9) using `input`:
   - Optional — empty input skips (uses template default)
10. Implement argument hint input prompt (FR-10) using `input`:
    - Optional — empty input skips
    - Validate max 100 characters; re-prompt on validation failure
11. Implement allowed tools input prompt (FR-11) using `input`:
    - Optional — comma-separated input
    - Empty input skips
12. Wrap all prompts in try/catch to handle Ctrl+C and EOF gracefully (NFR-2):
    - Catch `ExitPromptError` from `@inquirer/prompts` — this covers both Ctrl+C and EOF/closed stdin
    - Display `Scaffold cancelled.` and exit with code 0
13. Wire `runInteractivePrompts()` into `handleScaffold()`:
    - Call prompts, then pass results to `scaffold()` API alongside output-location options
    - Reuse existing success output display logic
14. Write unit tests in `tests/unit/commands/scaffold-interactive.test.ts`:
    - Template type prompt produces correct `templateType` in options
    - Context prompt shown only for `basic` template
    - Context `inherit` omits `context` from options
    - Agent name skipped when empty
    - ~~Memory defaults to `project` for `agent` template, skip for others~~ (Removed by CHORE-013)
    - ~~Model defaults to `sonnet` for `agent` template, skip for others~~ (Removed by CHORE-013)
    - Hooks prompt skipped for `with-hooks` and `internal` templates
    - Argument hint validates 100-character max and re-prompts
    - Allowed tools parsed from comma-separated string to array
    - License, compatibility, and metadata prompts produce correct options (Added by CHORE-013)
    - Ctrl+C during prompts exits with code 0 and message `Scaffold cancelled.`
    - EOF on stdin exits with code 0 and message `Scaffold cancelled.`

#### Deliverables
- [x] `runInteractivePrompts()` function with all 10 prompt steps
- [x] Conditional prompt logic based on template type
- [x] Ctrl+C and EOF graceful handling
- [x] `handleScaffold()` integration — interactive results fed to `scaffold()` API
- [x] Unit tests for each prompt step and conditional logic

---

### Phase 3: Configuration Summary and Integration Tests
**Feature:** [FEAT-019](../features/FEAT-019-interactive-scaffold-mode.md) | [#45](https://github.com/lwndev/ai-skills-manager/issues/45)
**Status:** ✅ Complete

#### Rationale
- The configuration summary (FR-12) is the final UX step before scaffold generation — it gives users a chance to review and restart
- Integration tests verify the full end-to-end flow produces valid skill output
- This phase completes the feature

#### Implementation Steps
1. Implement `formatSummary(name: string, options: ScaffoldTemplateOptions, description?: string, allowedTools?: string[]): string` in `src/commands/scaffold-interactive.ts`:
   - Display only fields that were explicitly set (skip defaults and unset fields)
   - Always show: `Name`, `Template`
   - Conditionally show: `Context` (only if `fork`), `Agent`, `Memory`, `Model`, `Hooks` (only if yes), `Minimal` (only if yes), `Description`, `Argument hint`, `Allowed tools`
   - Format as aligned key-value pairs (see FR-12 example)
2. Implement confirmation prompt after summary using `confirm`:
   - Display the formatted summary
   - Prompt `Proceed? (Y/n)` with default Yes
   - If declined: restart from the beginning (loop back to template selection) with a fresh set of defaults — do not preserve previous answers
   - If confirmed: proceed with scaffold generation
3. Wire the summary confirmation into `runInteractivePrompts()` — wrap the prompt flow in a loop that restarts on decline (each iteration starts with clean defaults)
4. Write unit tests for summary formatting:
   - Summary includes only set fields
   - `Name` and `Template` always present
   - All optional fields appear when set (including `License`, `Compatibility`, `Metadata` per CHORE-013)
   - Alignment of key-value pairs is correct
5. Write integration tests in `tests/integration/scaffold-interactive.test.ts`:
   - Full interactive flow produces valid skill directory (mock prompts with `@inquirer/testing` or by mocking the module)
   - Generated skill from interactive mode matches equivalent explicit-flag output
   - Generated skill passes `asm validate`
   - `--interactive` combined with `--project` and `--force` respects those flags
   - Non-TTY environment produces error and exit code 1
   - Flag override warning displayed when conflicting flags are provided
6. Verify all acceptance criteria from the feature requirements document

#### Deliverables
- [x] `formatSummary()` function with conditional field display
- [x] Confirmation prompt with restart-on-decline loop
- [x] Unit tests for summary formatting
- [x] `tests/integration/scaffold-interactive.test.ts` — end-to-end integration tests
- [x] All acceptance criteria verified

---

## Shared Infrastructure

### No New Shared Infrastructure Required

This feature is entirely a CLI-layer concern. It reuses:
- Existing `scaffold()` API (`src/api/scaffold.ts`) — no changes needed
- Existing `generateSkillMd()` template engine (`src/templates/skill-md.ts`) — no changes needed
- Existing validation functions in `src/commands/scaffold.ts` (`validateAgent()`, `validateArgumentHint()`, `validateLicense()`, `validateCompatibility()`). **CHORE-013:** `validateMemoryScope()` and `validateModel()` removed.
- Existing output utilities (`src/utils/output.ts`) for warnings and success display

### New Module

- `src/commands/scaffold-interactive.ts` — all interactive logic isolated in a single new module

## Testing Strategy

### Unit Tests (`tests/unit/commands/scaffold-interactive.test.ts`)
- TTY detection logic
- Flag conflict detection and warning message
- Each prompt step produces correct options
- Conditional prompt logic (which prompts appear for each template type)
- ~~Template defaults for `agent` (memory → `project`, model → `sonnet`)~~ (Removed by CHORE-013)
- Argument hint 100-character validation
- License, compatibility, and metadata prompt handling (Added by CHORE-013)
- Summary formatting (conditional fields, alignment)
- Ctrl+C / EOF handling
- Mock `@inquirer/prompts` functions to simulate user input without a real TTY

### Integration Tests (`tests/integration/scaffold-interactive.test.ts`)
- Full interactive flow produces valid skill directory
- Generated skill matches equivalent explicit-flag output
- Generated skill passes `asm validate`
- Non-TTY fallback error
- Flag override warning when conflicting flags provided
- Output-location flags (`--project`, `--force`) respected alongside `--interactive`
- License, compatibility, and metadata fields in generated output (Added by CHORE-013)

### Manual Testing Checklist
- Run `asm scaffold test-skill -i` and walk through all prompts
- Verify each template type (`basic`, `forked`, `with-hooks`, `internal`) produces correct output
- Verify license, compatibility, and metadata prompts work correctly (Added by CHORE-013)
- Test Ctrl+C at each prompt stage
- Test in non-TTY environment: `echo | asm scaffold test-skill -i`
- Test `--interactive` combined with `--project` and `--force`
- Decline the summary confirmation and verify restart from template selection

## Dependencies and Prerequisites

### External Dependencies
- `@inquirer/prompts` — new production dependency (modern, ESM-compatible, tree-shakeable prompt library)

### Internal Dependencies
- FEAT-017 (Agent Template Type) — already complete; provides the `--argument-hint` flag. ~~The `agent` template, `--memory`, and `--model` flags were removed in CHORE-013.~~
- CHORE-013 (Fix Scaffold Template Schema) — removes agent template and agent-only fields (`memory`, `model`, `disallowedTools`, `skills`); adds `--license`, `--compatibility`, `--metadata` CLI options
- Existing scaffold command infrastructure (`src/commands/scaffold.ts`)
- Existing scaffold API (`src/api/scaffold.ts`)
- Existing template generator (`src/templates/skill-md.ts`)

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| `@inquirer/prompts` compatibility issues with project's Node.js/TypeScript version | High | Low | Check compatibility before installing; `@inquirer/prompts` supports Node 18+ and TypeScript |
| Testing interactive prompts is complex (requires mocking TTY input) | Medium | Medium | Use `@inquirer/testing` utilities or mock at the module level; keep prompt functions small and testable |
| ESM/CJS module compatibility with `@inquirer/prompts` | Medium | Low | Verify import works with project's TypeScript and module configuration; `@inquirer/prompts` supports both |
| Interactive mode diverges from explicit-flag behavior over time | Medium | Medium | Integration tests that compare interactive output to explicit-flag output; reuse `buildTemplateOptions()` validation logic |

## Success Criteria

- `--interactive` / `-i` flag is accepted by `asm scaffold`
- Interactive prompts guide user through configuration steps with correct conditional logic
- ~~`agent` template type is available and defaults memory to `project`, model to `sonnet`~~ (Removed by CHORE-013)
- Argument hint validates 100-character max
- License, compatibility, and metadata prompts available in interactive flow (Added by CHORE-013)
- Configuration summary displays only set fields before scaffold generation
- User can decline summary to restart, or confirm to proceed
- Generated skill matches equivalent explicit-flag output
- Works when combined with `--project`, `--personal`, `--output`, `--force`
- Warning displayed when `--interactive` overrides template-content flags (updated in CHORE-013: `--memory`/`--model` removed, `--license`/`--compatibility`/`--metadata` added)
- Non-TTY environment produces error with helpful message
- Ctrl+C during prompts exits cleanly without partial files
- Help text documents `--interactive` / `-i`
- `npm run quality` passes

## Code Organization

```
src/
└── commands/
    ├── scaffold.ts                    # Existing — add -i flag, branch to interactive
    └── scaffold-interactive.ts        # New — all interactive prompt logic

tests/
├── unit/
│   └── commands/
│       ├── scaffold.test.ts           # Existing — add -i flag registration tests
│       └── scaffold-interactive.test.ts  # New — prompt logic and edge case tests
└── integration/
    └── scaffold-interactive.test.ts   # New — end-to-end interactive flow tests
```
