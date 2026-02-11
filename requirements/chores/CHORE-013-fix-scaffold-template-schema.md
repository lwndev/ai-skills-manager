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

### Source code
- `src/templates/skill-md.ts` — Template generation engine (primary)
- `src/commands/scaffold.ts` — CLI command (exposes agent-only options)
- `src/commands/scaffold-interactive.ts` — Interactive scaffold prompts (FEAT-019; exposes agent template, model/memory prompts)
- `src/generators/scaffold.ts` — Generator utilities
- `src/api/scaffold.ts` — Public API
- `src/types/` — Type definitions for scaffold options

### Tests
- `tests/unit/templates/skill-md.test.ts` — Template generation tests (primary — ~150 lines of agent template tests, plus model/memory option tests)
- `tests/unit/commands/scaffold.test.ts` — CLI option parsing tests (tests `--model`, `--memory` options)
- `tests/unit/commands/scaffold-interactive.test.ts` — Interactive scaffold prompt tests (~1,258 lines; agent template prompts, model/memory defaults, `TEMPLATE_CONTENT_FLAGS` assertions)
- `tests/unit/api/scaffold.test.ts` — API-level scaffold tests
- `tests/unit/generators/scaffold.test.ts` — Legacy generator unit tests
- `tests/integration/scaffold.test.ts` — CLI integration tests
- `tests/integration/scaffold-interactive.test.ts` — Interactive scaffold integration tests (~231 lines; agent skill creation/validation, parameterized template type tests)
- `tests/integration/api/scaffold.test.ts` — API integration tests (agent template defaults)

### Documentation
- `README.md` — Scaffold options table (~lines 126-145), validation checks (~lines 202-231), allowed frontmatter keys (~line 1137)
- `requirements/features/FEAT-017-agent-template-type.md` — Feature spec that introduced the agent template (superseded by this chore)
- `requirements/implementation/FEAT-017-agent-template-type.md` — Implementation plan for agent template (superseded by this chore)
- `requirements/features/FEAT-019-interactive-scaffold-mode.md` — Interactive scaffold spec (references agent template in FR-2, model in FR-6, memory in FR-5; override list on line 38 includes `--memory`, `--model`)
- `requirements/implementation/FEAT-019-interactive-scaffold-mode.md` — Interactive scaffold implementation plan (lists `memory`, `model` in `TEMPLATE_CONTENT_FLAGS`; depends on FEAT-017 for agent-only fields)

## Acceptance Criteria

### Remove agent-only fields from skill templates

- [ ] Remove `model` from skill template frontmatter and CLI options
- [ ] Remove `memory` from skill template frontmatter and CLI options
- [ ] Remove `disallowedTools` from skill template frontmatter and CLI options
- [ ] Remove `skills` (dependency list) from skill template frontmatter and CLI options

### Remove the "agent" template type

- [ ] Remove the `agent` template variant from `--template` choices
- [ ] Remove `agent` from interactive scaffold template choices in `scaffold-interactive.ts`
- [ ] Remove `isAgent` conditional logic from interactive prompt flow
- [ ] Update help text to reflect only valid template types: `basic`, `forked`, `with-hooks`, `internal`

### Remove agent-only fields from interactive scaffold (FEAT-019)

- [ ] Remove model selection prompt from interactive scaffold
- [ ] Remove memory scope prompt from interactive scaffold
- [ ] Remove `model` and `memory` from `TEMPLATE_CONTENT_FLAGS` array
- [ ] Remove model/memory from interactive summary display

### Add missing agentskills.io spec fields

- [ ] Add `--license` CLI option to scaffold command
- [ ] Add `--compatibility` CLI option to scaffold command
- [ ] Add `--metadata` CLI option to scaffold command (key=value format)
- [ ] Generate these fields in SKILL.md frontmatter when provided
- [ ] Add `license`, `compatibility`, `metadata` prompts to interactive scaffold flow

### Update template content and guidance

- [ ] Update HTML comment guidance in templates to reflect correct skill-only fields
- [ ] Remove any references to agent-specific features in template body text
- [ ] Ensure minimal templates are also updated

### Update documentation

- [ ] Update `README.md` scaffold options table — remove `--model` and `--memory`; add `--license`, `--compatibility`, `--metadata`
- [ ] Update `README.md` allowed frontmatter keys list (~line 1137) — remove agent-only keys (`model`, `memory`, `disallowedTools`, `skills`) from the allowed list if they are no longer valid for skills
- [ ] Verify `README.md` validation section (~lines 202-231) — the "Agent format" check (#9) validates the `agent` skill frontmatter field, which IS valid for skills; keep it, but verify no references to the removed `agent` template type exist
- [ ] Mark `requirements/features/FEAT-017-agent-template-type.md` as superseded by CHORE-013
- [ ] Mark `requirements/implementation/FEAT-017-agent-template-type.md` as superseded by CHORE-013
- [ ] Update `requirements/features/FEAT-019-interactive-scaffold-mode.md` — remove FR-5 (memory scope), remove FR-6 (model selection), update FR-2 (remove `agent` from template list), remove agent references from FR-7 (hooks), update override list on line 38 (remove `--memory`, `--model`), update acceptance criteria
- [ ] Update `requirements/implementation/FEAT-019-interactive-scaffold-mode.md` — remove `memory`/`model` from `TEMPLATE_CONTENT_FLAGS` references, remove FEAT-017 dependency for agent-only fields

### Update tests

- [ ] Update `tests/unit/templates/skill-md.test.ts` — remove agent template tests (~lines 1047-1232), remove model/memory option tests (~lines 1240-1320)
- [ ] Update `tests/unit/commands/scaffold.test.ts` — remove `--model` tests (~lines 727-762), remove `--memory` tests (~lines 647-725), remove agent template CLI tests (~lines 609-875)
- [ ] Update `tests/unit/commands/scaffold-interactive.test.ts` — remove agent template prompt tests, model/memory default tests (~lines 579-654), update `TEMPLATE_CONTENT_FLAGS` assertions (~lines 123-144), remove agent template summary tests
- [ ] Update `tests/unit/api/scaffold.test.ts` — remove agent template option passthrough tests
- [ ] Update `tests/unit/generators/scaffold.test.ts` — verify no agent-only references
- [ ] Update `tests/integration/scaffold.test.ts` — remove agent template integration tests
- [ ] Update `tests/integration/scaffold-interactive.test.ts` — remove agent skill creation/validation tests (~lines 96-136), remove `agent` from parameterized template type tests (~lines 201-229)
- [ ] Update `tests/integration/api/scaffold.test.ts` — remove agent template default tests (~line 828+)
- [ ] Add tests for new `license`, `compatibility`, `metadata` fields (CLI, template generation, and interactive prompts)
- [ ] Add `validateLicense()` with trim, empty check, and 100-char length cap (consistency with `validateCompatibility` and `validateArgumentHint`)
- [ ] Add test for metadata empty-key rejection (`=value`)
- [ ] `npm run quality` passes

## Execution Order

This chore is executed as a single phase. The type-driven removal strategy lets the TypeScript compiler guide each step — removing `agent` from the discriminated union surfaces every callsite that needs updating.

1. **Types first** — Remove `agent` from `ScaffoldTemplateType` and remove `model`, `memory`, `disallowedTools`, `skills` from template option types. Add `license`, `compatibility`, `metadata` to option types.
2. **Source files** — Follow compiler errors through the dependency chain: template engine (`skill-md.ts`) → CLI command (`scaffold.ts`) → interactive prompts (`scaffold-interactive.ts`) → API (`api/scaffold.ts`) → generator (`generators/scaffold.ts`). Remove agent-only code paths, add new spec field support.
3. **Tests** — Remove agent template tests and model/memory option tests from all 8 test files. Add tests for the new `license`, `compatibility`, `metadata` fields (CLI options, template generation, interactive prompts, validation).
4. **Documentation** — Update `README.md`, mark FEAT-017 specs as superseded, update FEAT-019 specs to remove agent/model/memory references.
5. **Verify** — `npm run quality` passes (lint + test:coverage + audit).

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
