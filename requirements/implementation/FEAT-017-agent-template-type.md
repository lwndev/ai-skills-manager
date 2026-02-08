# Implementation Plan: Agent Template Type & Template Updates

## Overview

This plan adds a new `agent` template variant to `asm scaffold` and three new CLI flags (`--memory`, `--model`, `--argument-hint`), while updating existing templates with new field documentation and `once: true` hook support. The feature builds on the existing template system (FEAT-013) and frontmatter schema v2 (FEAT-014), extending both the template generator and CLI command with agent-specific scaffolding capabilities.

The implementation is split into 4 phases: types and agent template generation, new CLI flags with validation, existing template updates (hooks `once: true` + field documentation), and comprehensive testing.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-017   | [#52](https://github.com/lwndev/ai-skills-manager/issues/52) | [FEAT-017-agent-template-type.md](../features/FEAT-017-agent-template-type.md) | Medium | Medium | Pending |

## Recommended Build Sequence

### Phase 1: Agent Template Type — Core Generation
**Feature:** [FEAT-017](../features/FEAT-017-agent-template-type.md) | [#52](https://github.com/lwndev/ai-skills-manager/issues/52)
**Status:** ✅ Complete

#### Rationale
- **Foundation**: The `agent` template type must exist in the type system and template generator before CLI flags or other templates can reference it
- **Self-contained**: Modifies only `src/types/api.ts` and `src/templates/skill-md.ts` — the same pattern used by FEAT-016
- **Testable in isolation**: `generateSkillMd()` can be tested directly without CLI wiring
- **Establishes patterns**: The agent frontmatter fields (`model`, `memory`, `skills`, `disallowedTools`, `allowed-tools`) set the baseline that Phase 2 flags will override

#### Implementation Steps
1. Add `'agent'` to the `ScaffoldTemplateType` union in `src/types/api.ts` (currently `'basic' | 'forked' | 'with-hooks' | 'internal'`)
2. Add `'agent'` to the `TemplateType` union in `src/templates/skill-md.ts` (line 20)
3. Add `'agent'` to the `VALID_TEMPLATE_TYPES` array in `src/commands/scaffold.ts`
4. Update `getDefaultAllowedTools()` in `src/templates/skill-md.ts` to return agent defaults:
   - Agent tools: `['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash']`
5. Update `generateFrontmatter()` in `src/templates/skill-md.ts` to handle `templateType === 'agent'`:
   - Add agent-specific description TODO: `"TODO: Describe what this agent does and when it should be used."` (both verbose and minimal modes)
   - **Frontmatter field ordering must match FR-1**: name → description → model → memory → skills → allowed-tools → disallowedTools
   - Add `model: sonnet` field after description (before allowed-tools)
   - Add `memory: project` field after model (before allowed-tools)
   - Add `skills: []` field after memory (before allowed-tools)
   - Keep existing `allowed-tools` logic (uses agent defaults from step 4)
   - Add `disallowedTools: []` field after allowed-tools
   - **Override design**: Use pattern `options?.model ?? (templateType === 'agent' ? 'sonnet' : undefined)` so Phase 2 flags can override agent defaults without code duplication. Same pattern for `memory` (default `'project'` for agent)
6. Create agent-specific guidance in `getTemplateGuidance()`:
   - How `model` affects execution (inherits from parent if omitted)
   - Memory scopes: `user` (cross-project), `project` (repo-specific), `local` (machine-specific)
   - Using `skills` to auto-load dependent skills
   - Using `disallowedTools` vs restricting `allowed-tools`
   - Using `permissionMode` for controlling agent permissions
   - How agents differ from regular skills
7. Add agent entry to `getMinimalOverviewTodo()`:
   - `"TODO: Brief description. This is a custom Claude Code agent."`
8. Update `generateMinimalBody()` to handle `'agent'` template type (should work automatically via the existing pattern)
9. Update `generateBody()` to include the agent guidance from `getTemplateGuidance('agent')`

#### Deliverables
- [x] Updated `src/types/api.ts` — `'agent'` added to `ScaffoldTemplateType`
- [x] Updated `src/templates/skill-md.ts` — agent template generation (frontmatter, guidance, minimal variant)
- [x] Updated `src/commands/scaffold.ts` — `'agent'` added to `VALID_TEMPLATE_TYPES`

---

### Phase 2: New CLI Flags — `--memory`, `--model`, `--argument-hint`
**Feature:** [FEAT-017](../features/FEAT-017-agent-template-type.md) | [#52](https://github.com/lwndev/ai-skills-manager/issues/52)
**Status:** ✅ Complete

#### Rationale
- **Depends on Phase 1**: The `--memory` and `--model` flags override agent template defaults, so the agent template must exist first
- **Cross-template**: All three flags work with any `--template` type, not just agent
- **Validation-heavy**: `--memory` has enum validation, `--argument-hint` has length validation — these must be implemented before testing
- **Type extensions**: Requires adding new fields to both `ScaffoldTemplateOptions` and `TemplateOptions` interfaces

#### Implementation Steps
1. Add new optional fields to `ScaffoldTemplateOptions` in `src/types/api.ts`:
   - `memory?: 'user' | 'project' | 'local'` — with JSDoc explaining memory scopes
   - `model?: string` — with JSDoc explaining model selection
   - `argumentHint?: string` — with JSDoc explaining argument hints
2. Add matching fields to `TemplateOptions` in `src/templates/skill-md.ts`:
   - `memory?: 'user' | 'project' | 'local'`
   - `model?: string`
   - `argumentHint?: string`
3. Add CLI options to the scaffold command in `src/commands/scaffold.ts`:
   - `.option('--memory <scope>', 'Set memory scope (user, project, local)')`
   - `.option('--model <name>', 'Set model for agent execution')`
   - `.option('--argument-hint <hint>', 'Set argument hint for skill invocation')`
4. Add `memory`, `model`, and `argumentHint` to the `CliScaffoldOptions` interface in `src/commands/scaffold.ts`
5. Add validator functions in `src/commands/scaffold.ts` following the existing pattern (see `validateTemplateType()`, `validateContext()`, `validateAgent()`):
   - **`validateMemoryScope(memory: string): 'user' | 'project' | 'local'`**: Check against `['user', 'project', 'local']`. If invalid, `throw new ValidationError("Invalid memory scope '{value}'. Valid values: user, project, local", [...])`. This is caught by `handleError()` in the action handler, which calls `displayValidationError()` automatically.
   - **`validateModel(model: string): string`**: Trim and check non-empty. If empty, `throw new ValidationError(...)`.
   - **`validateArgumentHint(hint: string): string`**: Check max 100 chars. If over, `throw new ValidationError("Argument hint must be 100 characters or fewer, got {n} characters.", [...])`.
6. Update `buildTemplateOptions()` in `src/commands/scaffold.ts` to call the new validators:
   - Call `validateMemoryScope()`, `validateModel()`, `validateArgumentHint()` for each flag present
   - Set `hasOptions = true` for each flag present
7. Update `generateFrontmatter()` in `src/templates/skill-md.ts` to handle the new fields:
   - Phase 1 already uses the override-ready pattern: `options?.model ?? (templateType === 'agent' ? 'sonnet' : undefined)`. When `options.model` is set, it takes precedence over the agent default automatically.
   - If resolved `model` value is set, add `model: <name>` to frontmatter (after description, before allowed-tools)
   - If resolved `memory` value is set, add `memory: <scope>` to frontmatter (after model, before allowed-tools)
   - If `options.argumentHint` is set, add `argument-hint: "<hint>"` to frontmatter (use `escapeYamlString()`)
8. Update the API scaffold function in `src/api/scaffold.ts` to pass new fields through when mapping `ScaffoldTemplateOptions` to `TemplateOptions`:
   - `memory: options.template.memory`
   - `model: options.template.model`
   - `argumentHint: options.template.argumentHint`
9. Update help text in `src/commands/scaffold.ts` to document:
   - New flags with examples
   - Agent template description
   - Flag combination examples (e.g., `asm scaffold code-reviewer --template agent --memory project --model sonnet`)

#### Deliverables
- [x] Updated `src/types/api.ts` — `memory`, `model`, `argumentHint` fields on `ScaffoldTemplateOptions`
- [x] Updated `src/templates/skill-md.ts` — frontmatter generation for new fields with override logic
- [x] Updated `src/commands/scaffold.ts` — three new CLI flags with validation, help text
- [x] Updated `src/api/scaffold.ts` — passthrough for new template option fields

---

### Phase 3: Template Updates — Hooks `once: true` & Field Documentation
**Feature:** [FEAT-017](../features/FEAT-017-agent-template-type.md) | [#52](https://github.com/lwndev/ai-skills-manager/issues/52)
**Status:** ✅ Complete

#### Rationale
- **Independent of Phases 1-2 functionally**, but sequenced here because it modifies the same files (avoids merge conflicts if done in parallel)
- **Low risk**: Modifying comment/guidance blocks only — no behavioral changes to existing templates
- **Completeness**: The requirements explicitly call for `once: true` in hooks and field documentation across all templates

#### Implementation Steps
1. Update `generateHooksYaml()` in `src/templates/skill-md.ts` to add `once: true` to the PreToolUse hook YAML:
   - In verbose mode, add `once: true` as an active field with an inline YAML comment on the PreToolUse hook command:
     ```yaml
     hooks:
       PreToolUse:
         - matcher: "*"
           hooks:
             - type: command
               command: echo "Starting tool execution..."
               once: true  # Only runs on first matching tool use
     ```
   - This is an **uncommented** YAML field matching FR-5 — not a commented-out example like the Stop hook
   - In minimal mode, keep the existing compact format (no `once: true` needed since it's a TODO placeholder)
   - **Note**: `getTemplateGuidance('with-hooks')` already documents `once: true` with explanation and examples (lines 322-330) — no changes needed there
2. Update `getTemplateGuidance()` for all template types (basic, forked, with-hooks, internal) to document new fields in the HTML comment guidance block:
   - `memory` field and its scopes (`user`, `project`, `local`)
   - `model` field for model selection
   - `skills` field for loading dependent skills
   - `disallowedTools` field for tool blocking
   - `permissionMode` field for agent permissions
   - `argument-hint` field for UI hints
   - Keep documentation relevant to each template type (e.g., forked templates may not need agent-specific fields prominently)
3. Update the large HTML comment block in `generateBody()` (the "SKILL DEVELOPMENT GUIDANCE" section) to include the new fields in the frontmatter reference:
   - Add `memory`, `model`, `skills`, `disallowedTools`, `permissionMode`, `argument-hint` to the available fields list

#### Deliverables
- [x] Updated `src/templates/skill-md.ts` — `once: true` in hooks YAML, new field documentation across all template guidance blocks

---

### Phase 4: Tests and Verification
**Feature:** [FEAT-017](../features/FEAT-017-agent-template-type.md) | [#52](https://github.com/lwndev/ai-skills-manager/issues/52)
**Status:** ✅ Complete

#### Rationale
- **Depends on Phases 1-3**: All code changes must be in place before comprehensive testing
- **Broad coverage**: Agent template, three new flags, flag combinations, template updates, backward compatibility
- **Final gate**: `npm run quality` must pass

#### Implementation Steps
1. Add unit tests to `tests/unit/templates/skill-md.test.ts` for agent template generation:
   - `generateSkillMd()` with `templateType: 'agent'` produces correct frontmatter (`model`, `memory`, `skills`, `disallowedTools`, `allowed-tools`)
   - Agent template verbose body includes agent-specific guidance
   - Agent template minimal body is concise with agent overview TODO
   - Agent template default allowed-tools: `['Read', 'Glob', 'Grep', 'Edit', 'Write', 'Bash']`
   - Agent template + `--minimal` works correctly
2. Add unit tests for new flag frontmatter generation:
   - `--memory user` adds `memory: user` to basic template frontmatter
   - `--memory project` adds `memory: project` to forked template frontmatter
   - `--model haiku` adds `model: haiku` to any template frontmatter
   - `--argument-hint "<query>"` adds properly escaped `argument-hint` to frontmatter
   - Flag overrides template defaults (e.g., `--memory user` overrides agent's default `memory: project`)
   - `--model` overrides agent's default `model: sonnet`
3. Add unit tests to `tests/unit/commands/scaffold.test.ts` for CLI flag parsing:
   - `--memory` option parsed correctly with valid values
   - `--memory` with invalid value produces validation error
   - `--model` option parsed correctly
   - `--model` with empty string produces validation error
   - `--argument-hint` option parsed correctly
   - `--argument-hint` over 100 chars produces validation error
   - `--template agent` is accepted as valid template type
   - All flag combinations with `--template agent` parsed correctly
4. Add unit tests for hooks `once: true`:
   - Verbose hooks YAML **frontmatter** includes `once: true` field (new test for `generateHooksYaml()` change)
   - With-hooks template guidance mentions `once: true` — **existing test** at `skill-md.test.ts:637-643` already covers this; verify it still passes
5. Add unit tests for template field documentation:
   - All template guidance blocks mention `memory`, `model`, etc.
   - Agent guidance explains memory scopes, model selection, etc.
6. Add integration tests to `tests/integration/api/scaffold.test.ts`:
   - Scaffold with `--template agent` and verify output passes `validate()`
   - Scaffold with `--template agent --memory user --model haiku` and verify frontmatter
   - Scaffold with `--memory project` on basic template and verify `memory: project` in output
   - Scaffold with `--argument-hint "search query"` and verify proper YAML escaping
   - Scaffold with every flag combination and verify valid SKILL.md
   - All existing scaffold tests still pass (backward compatibility)
7. Run `npm run quality` to verify all tests pass, lint is clean, and coverage thresholds are met

#### Deliverables
- [x] Updated `tests/unit/templates/skill-md.test.ts` — agent template tests, flag frontmatter tests, hooks `once: true` tests
- [x] Updated `tests/unit/commands/scaffold.test.ts` — new flag parsing tests, validation error tests
- [x] Updated `tests/integration/api/scaffold.test.ts` — agent scaffold validation, flag combination tests
- [x] `npm run quality` passes

---

## Shared Infrastructure

### Modified Modules

| Module | Change |
|--------|--------|
| `src/types/api.ts` | Add `'agent'` to `ScaffoldTemplateType`, add `memory`, `model`, `argumentHint` to `ScaffoldTemplateOptions` |
| `src/templates/skill-md.ts` | Agent template generation, new frontmatter fields, `once: true` hooks, updated guidance blocks |
| `src/commands/scaffold.ts` | `'agent'` in valid types, `--memory`/`--model`/`--argument-hint` flags with validation, updated help text |
| `src/api/scaffold.ts` | Pass `memory`, `model`, `argumentHint` through template options mapping |

### No New Dependencies
This feature requires no new packages. All changes are internal to existing modules.

---

## Testing Strategy

### Unit Tests
- Agent template generation for verbose and minimal modes
- Agent frontmatter fields: `model`, `memory`, `skills`, `disallowedTools`, `allowed-tools`
- `--memory` flag: valid values produce correct frontmatter, invalid values produce errors
- `--model` flag: adds field to frontmatter, empty string rejected
- `--argument-hint` flag: proper YAML escaping, max length validation
- Flag overrides: `--memory`/`--model` override agent template defaults
- Flag combinations: all flags combined produce valid output
- Hooks `once: true`: appears in verbose with-hooks YAML
- Template guidance: all templates document new fields
- Backward compatibility: default (no new flags) output is unchanged

### Integration Tests
- Scaffold with `--template agent` for verbose and minimal, verify output passes `asm validate`
- Scaffold with new flags across all template types
- All scaffolded files discoverable and valid
- Existing scaffold tests unmodified and passing

### Manual Testing
- `asm scaffold code-reviewer --template agent --memory project --model sonnet`
- `asm scaffold safe-refactor --template agent --model haiku --minimal`
- `asm scaffold search-helper --template forked --argument-hint "<query> [--deep]"`
- `asm scaffold learning-assistant --memory user`
- All scaffolded skills pass `asm validate`

---

## Dependencies and Prerequisites

### Code Dependencies
- FEAT-014 (Frontmatter Schema v2) — ✅ Complete — validation supports `memory`, `model`, `skills`, `permissionMode`, `disallowedTools` fields
- FEAT-013 (Skill Template Enhancements) — ✅ Complete — template system with variants and flags
- FEAT-016 (Minimal Scaffold Flag) — ✅ Complete — `--minimal` support for all template types

### Existing Files Modified
- `src/templates/skill-md.ts` — template generation engine (507 lines)
- `src/commands/scaffold.ts` — CLI command definition (261 lines)
- `src/api/scaffold.ts` — scaffold API function (192 lines)
- `src/types/api.ts` — type definitions

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Default scaffold output changes unexpectedly | High | Low | Agent template is a new code path; existing templates only get guidance comment additions |
| Agent template frontmatter fails validation | Medium | Medium | FEAT-014 already validates `memory`, `model`, `skills`, `disallowedTools` — integration tests verify |
| `--memory` flag conflicts with other flags | Low | Very Low | Commander.js handles option flags cleanly; validation runs before scaffold |
| YAML escaping issues with `--argument-hint` | Medium | Low | Existing `escapeYamlString()` handles special characters; add explicit test cases |
| Template guidance bloat | Low | Medium | Keep guidance concise; only add fields relevant to each template type |
| `once: true` hook syntax incorrect | Medium | Low | Unit test verifies exact YAML structure; integration test validates full output |

---

## Success Criteria

### Per-Phase Criteria
- [x] Phase 1: `generateSkillMd({ name: 'test' }, { templateType: 'agent' })` produces correct agent template with all agent-specific fields
- [x] Phase 2: `asm scaffold my-agent --template agent --memory user --model haiku --argument-hint "query"` works end-to-end
- [x] Phase 3: With-hooks template includes `once: true`, all templates document new fields
- [x] Phase 4: All tests pass, `npm run quality` green

### Overall Success (from Requirements)
- [x] `--template agent` produces agent-specific SKILL.md
- [x] Agent template includes `model`, `memory`, `skills`, `disallowedTools` fields
- [x] `--memory <scope>` flag works with all templates
- [x] `--model <name>` flag works with all templates
- [x] `--argument-hint <hint>` flag works with all templates
- [x] Invalid `--memory` value produces clear error
- [x] Over-length `--argument-hint` produces clear error
- [x] `with-hooks` template documents `once: true` option
- [x] All templates updated with new field documentation in guidance
- [x] Flags override template defaults
- [x] All flag combinations produce valid SKILL.md
- [x] All existing scaffold tests continue to pass
- [x] New unit tests for agent template and new flags
- [x] Integration tests validate scaffolded skills
- [x] `npm run quality` passes

---

## Code Organization

```
src/
├── api/
│   └── scaffold.ts            # MODIFY: pass memory, model, argumentHint through template options
├── commands/
│   └── scaffold.ts            # MODIFY: add 'agent' type, --memory/--model/--argument-hint flags, validation, help text
├── templates/
│   └── skill-md.ts            # MODIFY: agent template, new frontmatter fields, once:true hooks, updated guidance
├── types/
│   └── api.ts                 # MODIFY: 'agent' type, memory/model/argumentHint on ScaffoldTemplateOptions
└── utils/
    └── output.ts              # NO CHANGE (reuses existing display functions)

tests/
├── unit/
│   ├── commands/
│   │   └── scaffold.test.ts   # UPDATE: agent template type, new flag parsing/validation tests
│   └── templates/
│       └── skill-md.test.ts   # UPDATE: agent template generation, new field tests, hooks once:true
└── integration/
    └── api/
        └── scaffold.test.ts   # UPDATE: agent scaffold validation, flag combination tests
```
