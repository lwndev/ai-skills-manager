# Chore: Fix Scaffold Template Schema

## Chore ID

`CHORE-013`

## Category

`refactoring`

## Description

The scaffold command generates `SKILL.md` files that conflate the **Skills** frontmatter schema (`.claude/skills/`) with the **Subagents** frontmatter schema (`.claude/agents/`). Several frontmatter fields (`model`, `memory`, `disallowedTools`, `skills`) are agent-specific and do not belong in skill files. Additionally, valid agentskills.io spec fields (`license`, `compatibility`, `metadata`) are missing. The "agent" template type is the most affected, but the CLI options also expose agent-only fields for all template types.

### Problem Summary

Per the Anthropic docs (`docs/anthropic/agents/create-custom-subagents.md`) and the agentskills.io spec (`docs/agent-skills-io/agent-skills-specification.md`), skills and subagents are distinct systems:

**Valid skill frontmatter fields:**
- `name` (required), `description` (required)
- `license`, `compatibility`, `metadata` (agentskills.io spec)
- `allowed-tools` (experimental)
- `hooks` (PreToolUse/PostToolUse/Stop only)
- `context: fork`, `agent`, `user-invocable`, `argument-hint` (Claude Code extensions)

**Agent-only fields incorrectly placed in skill templates:**
- `model` — belongs in `.claude/agents/` files
- `memory` — belongs in `.claude/agents/` files
- `disallowedTools` — belongs in `.claude/agents/` files
- `skills` (dependency list) — belongs in `.claude/agents/` files

**Missing spec fields not offered by scaffold:**
- `license`
- `compatibility`
- `metadata`

## Affected Files

### Source code — Scaffold
- `src/templates/skill-md.ts` — Template generation engine (primary)
- `src/commands/scaffold.ts` — CLI command (exposes agent-only options)
- `src/commands/scaffold-interactive.ts` — Interactive scaffold prompts (FEAT-019; exposes agent template, model/memory prompts)
- `src/api/scaffold.ts` — Public API
- `src/types/api.ts` — Type definitions for scaffold and template options

### Source code — Validation pipeline
- `src/validators/frontmatter.ts` — Allowed keys set (remove 5 agent-only keys)
- `src/validators/index.ts` — Barrel exports (remove 5 validator exports)
- `src/validators/disallowed-tools.ts` — **Deleted** (agent-only validator)
- `src/validators/memory.ts` — **Deleted** (agent-only validator)
- `src/validators/model.ts` — **Deleted** (agent-only validator)
- `src/validators/permission-mode.ts` — **Deleted** (agent-only validator)
- `src/validators/skills.ts` — **Deleted** (agent-only validator)
- `src/generators/validate.ts` — Validation pipeline (remove 5 checks, 25→20)
- `src/api/validate.ts` — Validate API (remove 5 CHECK_TO_CODE entries, model warning handling)
- `src/types/validation.ts` — CheckName union and ParsedFrontmatter (remove 5 members/fields)
- `src/formatters/validate-formatter.ts` — Display labels (remove 5 check entries)

### Tests
- `tests/unit/templates/skill-md.test.ts` — Template generation tests (remove agent template + model/memory option tests)
- `tests/unit/commands/scaffold.test.ts` — CLI option parsing tests (remove `--model`, `--memory` options)
- `tests/unit/commands/scaffold-interactive.test.ts` — Interactive scaffold prompt tests (remove agent template prompts, model/memory defaults)
- `tests/unit/api/scaffold.test.ts` — API-level scaffold tests
- `tests/unit/api/validate.test.ts` — Validate API tests (remove agent-only check code tests)
- `tests/unit/generators/validate.test.ts` — Validation pipeline tests (remove 5 agent-only check tests)
- `tests/unit/formatters/validate-formatter.test.ts` — Formatter tests (remove 5 agent-only display entries)
- `tests/unit/validators/disallowed-tools.test.ts` — **Deleted**
- `tests/unit/validators/memory.test.ts` — **Deleted**
- `tests/unit/validators/model.test.ts` — **Deleted**
- `tests/unit/validators/permission-mode.test.ts` — **Deleted**
- `tests/unit/validators/skills.test.ts` — **Deleted**
- `tests/integration/scaffold-interactive.test.ts` — Interactive scaffold integration tests (remove agent skill creation/validation)
- `tests/integration/api/scaffold.test.ts` — API integration tests (remove agent template defaults)
- `tests/integration/validate-frontmatter-v2.test.ts` — Frontmatter v2 validation tests (remove agent-only field tests)

### Documentation
- `README.md` — Scaffold options table, template types, validation checks (25→20), JSON output example, allowed frontmatter keys
- `requirements/features/FEAT-017-agent-template-type.md` — Feature spec that introduced the agent template (superseded by this chore)
- `requirements/implementation/FEAT-017-agent-template-type.md` — Implementation plan for agent template (superseded by this chore)
- `requirements/features/FEAT-019-interactive-scaffold-mode.md` — Interactive scaffold spec (remove FR-5/FR-6, update FR-2/FR-7, add license/compatibility/metadata)
- `requirements/implementation/FEAT-019-interactive-scaffold-mode.md` — Interactive scaffold implementation plan (remove memory/model from TEMPLATE_CONTENT_FLAGS, add CHORE-013 dependency)

## Acceptance Criteria

### Remove agent-only fields from skill templates

- [x] Remove `model` from skill template frontmatter and CLI options
- [x] Remove `memory` from skill template frontmatter and CLI options
- [x] Remove `disallowedTools` from skill template frontmatter and CLI options
- [x] Remove `skills` (dependency list) from skill template frontmatter and CLI options

### Remove the "agent" template type

- [x] Remove the `agent` template variant from `--template` choices
- [x] Remove `agent` from interactive scaffold template choices in `scaffold-interactive.ts`
- [x] Remove `isAgent` conditional logic from interactive prompt flow
- [x] Update help text to reflect only valid template types: `basic`, `forked`, `with-hooks`, `internal`

### Remove agent-only fields from interactive scaffold (FEAT-019)

- [x] Remove model selection prompt from interactive scaffold
- [x] Remove memory scope prompt from interactive scaffold
- [x] Remove `model` and `memory` from `TEMPLATE_CONTENT_FLAGS` array
- [x] Remove model/memory from interactive summary display

### Add missing agentskills.io spec fields

- [x] Add `--license` CLI option to scaffold command
- [x] Add `--compatibility` CLI option to scaffold command
- [x] Add `--metadata` CLI option to scaffold command (key=value format)
- [x] Generate these fields in SKILL.md frontmatter when provided
- [x] Add `license`, `compatibility`, `metadata` prompts to interactive scaffold flow

### Remove agent-only fields from validation pipeline

- [x] Remove `memory`, `skills`, `model`, `permissionMode`, `disallowedTools` from `ALLOWED_KEYS` in `src/validators/frontmatter.ts`
- [x] Delete 5 standalone validator files: `disallowed-tools.ts`, `memory.ts`, `model.ts`, `permission-mode.ts`, `skills.ts`
- [x] Remove 5 exports from `src/validators/index.ts`
- [x] Remove 5 validation checks from `src/generators/validate.ts` (25→20 checks)
- [x] Remove 5 `CheckName` union members and `ParsedFrontmatter` fields from `src/types/validation.ts`
- [x] Remove 5 `CHECK_TO_CODE` entries and model warning handling from `src/api/validate.ts`
- [x] Remove 5 check display labels and order entries from `src/formatters/validate-formatter.ts`

### Update template content and guidance

- [x] Update HTML comment guidance in templates to reflect correct skill-only fields
- [x] Remove any references to agent-specific features in template body text
- [x] Ensure minimal templates are also updated

### Update documentation

- [x] Update `README.md` scaffold options table — remove `--model` and `--memory`; add `--license`, `--compatibility`, `--metadata`
- [x] Update `README.md` allowed frontmatter keys list — remove agent-only keys (`model`, `memory`, `disallowedTools`, `skills`, `permissionMode`)
- [x] Update `README.md` validation checks (25→20) — remove memory, skills, model, permissionMode, disallowedTools checks; renumber remaining
- [x] Update `README.md` JSON output example — remove deleted check keys
- [x] Verify `README.md` "Agent format" check (#9) validates the `agent` skill frontmatter field (valid for skills; kept)
- [x] Mark `requirements/features/FEAT-017-agent-template-type.md` as superseded by CHORE-013
- [x] Mark `requirements/implementation/FEAT-017-agent-template-type.md` as superseded by CHORE-013
- [x] Update `requirements/features/FEAT-019-interactive-scaffold-mode.md` — remove FR-5 (memory scope), remove FR-6 (model selection), update FR-2 (remove `agent` from template list), remove agent references from FR-7 (hooks), update override list on line 38 (remove `--memory`, `--model`), update acceptance criteria
- [x] Update `requirements/implementation/FEAT-019-interactive-scaffold-mode.md` — remove `memory`/`model` from `TEMPLATE_CONTENT_FLAGS` references, remove FEAT-017 dependency for agent-only fields

### Update tests

- [x] Update `tests/unit/templates/skill-md.test.ts` — remove agent template tests (~lines 1047-1232), remove model/memory option tests (~lines 1240-1320)
- [x] Update `tests/unit/commands/scaffold.test.ts` — remove `--model` tests (~lines 727-762), remove `--memory` tests (~lines 647-725), remove agent template CLI tests (~lines 609-875)
- [x] Update `tests/unit/commands/scaffold-interactive.test.ts` — remove agent template prompt tests, model/memory default tests (~lines 579-654), update `TEMPLATE_CONTENT_FLAGS` assertions (~lines 123-144), remove agent template summary tests
- [x] Update `tests/unit/api/scaffold.test.ts` — remove agent template option passthrough tests
- [x] Update `tests/unit/generators/validate.test.ts` — remove agent-only validation check tests
- [x] Update `tests/integration/scaffold-interactive.test.ts` — remove agent skill creation/validation tests (~lines 96-136), remove `agent` from parameterized template type tests (~lines 201-229)
- [x] Update `tests/integration/api/scaffold.test.ts` — remove agent template default tests (~line 828+)
- [x] Update `tests/integration/validate-frontmatter-v2.test.ts` — remove agent-only field validation tests
- [x] Delete test files for removed validators: `disallowed-tools.test.ts`, `memory.test.ts`, `model.test.ts`, `permission-mode.test.ts`, `skills.test.ts`
- [x] Add tests for new `license`, `compatibility`, `metadata` fields (CLI, template generation, and interactive prompts)
- [x] Add `validateLicense()` with trim, empty check, and 100-char length cap (consistency with `validateCompatibility` and `validateArgumentHint`)
- [x] Add test for metadata empty-key rejection (`=value`)
- [x] `npm run quality` passes

## Execution Order

This chore was executed as a single phase. The type-driven removal strategy let the TypeScript compiler guide each step — removing `agent` from the discriminated union surfaced every callsite that needed updating.

1. **Types first** — Remove `agent` from `ScaffoldTemplateType` and remove `model`, `memory`, `disallowedTools`, `skills` from template option types. Add `license`, `compatibility`, `metadata` to option types. Remove 5 `CheckName` union members and `ParsedFrontmatter` fields from validation types.
2. **Scaffold source files** — Follow compiler errors through the dependency chain: template engine (`skill-md.ts`) → CLI command (`scaffold.ts`) → interactive prompts (`scaffold-interactive.ts`) → API (`api/scaffold.ts`). Remove agent-only code paths, add new spec field support.
3. **Validation pipeline** — Remove 5 agent-only keys from `ALLOWED_KEYS` in `frontmatter.ts`. Delete 5 standalone validator files (`disallowed-tools.ts`, `memory.ts`, `model.ts`, `permission-mode.ts`, `skills.ts`). Remove 5 validation checks from the pipeline in `validate.ts` (25→20 checks). Update `api/validate.ts`, `validate-formatter.ts`, and `validators/index.ts`.
4. **Tests** — Remove agent template and agent-only field tests from 15 test files. Delete 5 validator test files. Add tests for new `license`, `compatibility`, `metadata` fields.
5. **Documentation** — Update `README.md` (scaffold options, template types, validation checks, JSON output, allowed keys), mark FEAT-017 specs as superseded, update FEAT-019 specs to remove agent/model/memory references and add CHORE-013 fields.
6. **Field length corrections** — Align `compatibility` (100→500), `argument-hint` (100→200 in scaffold), `license` (remove artificial 100-char cap).
7. **Verify** — `npm run quality` passes (103 suites, 3025 tests, all coverage thresholds met).

## Completion

**Status:** `Completed`
**Date:** 2026-02-11
**PR:** [#68](https://github.com/lwndev/ai-skills-manager/pull/68)

## Notes

- The `agent` template type was likely created before the subagent system (`.claude/agents/`) was fully documented as a separate entity. The scaffold was built around the time skills and slash commands were merging (v2.1.3).
- Consider whether ASM should also support scaffolding `.claude/agents/` files as a separate future feature (not in scope for this chore).
- The `context: fork` and `agent` skill fields ARE valid for skills — they tell Claude Code to run the skill in a forked subagent context. These should remain. The `agent` field validation check in the README ("Agent format", validation #9) is about this valid skill field, not the removed `agent` template type.
- `src/generators/scaffold.ts` contains a legacy `ScaffoldOptions`/`ScaffoldResult` type definition (using the older `success: boolean` pattern instead of discriminated unions) and calls `generateSkillMd()` without template options. Consider cleaning up or removing this legacy code path during implementation.
- **FEAT-019 impact (added 2026-02-11):** The interactive scaffold feature (FEAT-019, merged in PR #65) was implemented before this chore and prominently exposes the `agent` template type, `model` selection, and `memory` scope prompts. These are the same agent-only fields this chore removes. FEAT-019's model/memory prompts are *only* shown when the `agent` template is selected — once the agent template is removed, there is no remaining use case for these prompts and they can be cleanly deleted. The FEAT-019 requirements documents (feature spec and implementation plan) also need updating to remove references to these removed fields.
- Reference docs used for this analysis:
  - `docs/anthropic/skills/agent-skills-overview-20251229.md` — Anthropic's skills spec
  - `docs/anthropic/agents/create-custom-subagents.md` — Anthropic's subagent spec
  - `docs/agent-skills-io/agent-skills-specification.md` — agentskills.io open spec
  - `docs/anthropic/hooks/hooks-reference.md` — Hooks in skills/agents
  - `docs/anthropic/claude-code/CHANGELOG-v21-1-34.md` — Feature history
