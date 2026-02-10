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
- `src/generators/scaffold.ts` — Generator utilities
- `src/api/scaffold.ts` — Public API
- `src/types/` — Type definitions for scaffold options

### Tests
- `tests/unit/templates/skill-md.test.ts` — Template generation tests (primary — ~150 lines of agent template tests, plus model/memory option tests)
- `tests/unit/commands/scaffold.test.ts` — CLI option parsing tests (tests `--model`, `--memory` options)
- `tests/unit/api/scaffold.test.ts` — API-level scaffold tests
- `tests/unit/generators/scaffold.test.ts` — Legacy generator unit tests
- `tests/integration/scaffold.test.ts` — CLI integration tests
- `tests/integration/api/scaffold.test.ts` — API integration tests (agent template defaults)

### Documentation
- `README.md` — Scaffold options table (~lines 74-81), validation checks (~line 140), allowed frontmatter keys (~line 930-931)
- `requirements/features/FEAT-017-agent-template-type.md` — Feature spec that introduced the agent template (superseded by this chore)
- `requirements/implementation/FEAT-017-agent-template-type.md` — Implementation plan for agent template (superseded by this chore)

## Acceptance Criteria

### Remove agent-only fields from skill templates

- [x] Remove `model` from skill template frontmatter and CLI options
- [x] Remove `memory` from skill template frontmatter and CLI options
- [x] Remove `disallowedTools` from skill template frontmatter and CLI options
- [x] Remove `skills` (dependency list) from skill template frontmatter and CLI options

### Remove the "agent" template type

- [x] Remove the `agent` template variant from `--template` choices
- [x] Update help text to reflect only valid template types: `basic`, `forked`, `with-hooks`, `internal`

### Add missing agentskills.io spec fields

- [x] Add `--license` CLI option to scaffold command
- [x] Add `--compatibility` CLI option to scaffold command
- [x] Add `--metadata` CLI option to scaffold command (key=value format)
- [x] Generate these fields in SKILL.md frontmatter when provided

### Update template content and guidance

- [x] Update HTML comment guidance in templates to reflect correct skill-only fields
- [x] Remove any references to agent-specific features in template body text
- [x] Ensure minimal templates are also updated

### Update documentation

- [x] Update `README.md` scaffold options table — the current table (lines 72-81) only lists 6 basic options and is missing all template-related options; add the remaining valid options (`--template`, `--context`, `--agent`, `--no-user-invocable`, `--hooks`, `--minimal`, `--argument-hint`, `--license`, `--compatibility`, `--metadata`) and omit the removed agent-only options (`--model`, `--memory`)
- [x] Update `README.md` allowed frontmatter keys list (line 931) — add `argument-hint` (currently missing despite being a valid skill field)
- [x] Verify `README.md` validation section (lines 128-143) — the "Agent format" check (#9) validates the `agent` skill frontmatter field, which IS valid for skills; keep it, but verify no references to the removed `agent` template type exist
- [x] Mark `requirements/features/FEAT-017-agent-template-type.md` as superseded by CHORE-013
- [x] Mark `requirements/implementation/FEAT-017-agent-template-type.md` as superseded by CHORE-013

### Update tests

- [x] Update `tests/unit/templates/skill-md.test.ts` — remove agent template tests (~lines 1047-1232), remove model/memory option tests (~lines 1240-1320)
- [x] Update `tests/unit/commands/scaffold.test.ts` — remove `--model` tests (~lines 727-762), remove `--memory` tests (~lines 647-725), remove agent template CLI tests
- [x] Update `tests/unit/api/scaffold.test.ts` — remove agent template option passthrough tests
- [x] Update `tests/unit/generators/scaffold.test.ts` — verify no agent-only references
- [x] Update `tests/integration/scaffold.test.ts` — remove agent template integration tests
- [x] Update `tests/integration/api/scaffold.test.ts` — remove agent template default tests (~line 828+)
- [x] Add tests for new `license`, `compatibility`, `metadata` fields
- [x] `npm run quality` passes

## Completion

**Status:** `Completed`

**Completed:** 2026-02-10

**Pull Request:** TBD

## Notes

- The `agent` template type was likely created before the subagent system (`.claude/agents/`) was fully documented as a separate entity. The scaffold was built around the time skills and slash commands were merging (v2.1.3).
- Consider whether ASM should also support scaffolding `.claude/agents/` files as a separate future feature (not in scope for this chore).
- The `context: fork` and `agent` skill fields ARE valid for skills — they tell Claude Code to run the skill in a forked subagent context. These should remain. The `agent` field validation check in the README ("Agent format", validation #9) is about this valid skill field, not the removed `agent` template type.
- `src/generators/scaffold.ts` contains a legacy `ScaffoldOptions`/`ScaffoldResult` type definition (using the older `success: boolean` pattern instead of discriminated unions) and calls `generateSkillMd()` without template options. Consider cleaning up or removing this legacy code path during implementation.
- Reference docs used for this analysis:
  - `docs/anthropic/skills/agent-skills-overview-20251229.md` — Anthropic's skills spec
  - `docs/anthropic/agents/create-custom-subagents.md` — Anthropic's subagent spec
  - `docs/agent-skills-io/agent-skills-specification.md` — agentskills.io open spec
  - `docs/anthropic/hooks/hooks-reference.md` — Hooks in skills/agents
  - `docs/anthropic/claude-code/CHANGELOG-v21-1-34.md` — Feature history
