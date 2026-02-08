# Implementation Plan: Minimal Scaffold Flag

## Overview

This plan adds a `--minimal` flag to `asm scaffold` that generates shorter, production-ready SKILL.md templates without the verbose educational guidance (HTML comment blocks, multi-section TODOs, usage examples). The feature touches four layers: types, template generation, command parsing, and CLI output. All four template types (basic, forked, with-hooks, internal) get minimal variants.

The implementation is split into 3 phases: types and template generation (core logic), command/API integration (wiring), and testing with output refinements.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-016   | [#44](https://github.com/lwndev/ai-skills-manager/issues/44) | [FEAT-016-minimal-scaffold-flag.md](../features/FEAT-016-minimal-scaffold-flag.md) | Medium | Low | ✅ Complete |

## Recommended Build Sequence

### Phase 1: Template Generation — Minimal Variants
**Feature:** [FEAT-016](../features/FEAT-016-minimal-scaffold-flag.md) | [#44](https://github.com/lwndev/ai-skills-manager/issues/44)
**Status:** ✅ Complete

#### Rationale
- **Foundation**: The template generator (`skill-md.ts`) is the core of this feature — all other layers depend on it producing correct minimal output
- **Self-contained**: This phase modifies only `src/templates/skill-md.ts` and `src/types/api.ts`, keeping the blast radius small
- **Testable in isolation**: The `generateSkillMd()` function can be unit-tested directly without CLI or API wiring

#### Implementation Steps
1. Add `minimal?: boolean` to the `TemplateOptions` interface in `src/templates/skill-md.ts` (line 25-36)
2. Add `minimal?: boolean` to the `ScaffoldTemplateOptions` interface in `src/types/api.ts` (line 189-217) with JSDoc comment
3. Create a `generateMinimalBody()` function in `src/templates/skill-md.ts` that produces the minimal markdown body:
   - Accepts `params: SkillTemplateParams` and `templateType: TemplateType`
   - Returns only: `# Name` + `## Overview` (with template-type-specific one-liner TODO) + `## Instructions` + `## Examples`
   - No HTML comment block, no `## Usage`, no `## Implementation Notes`
   - Overview TODO includes a one-line note about the template type for forked/hooks/internal (e.g., "TODO: Brief description. This skill runs in a forked context.")
4. Update `generateMinimalFrontmatter()` — or modify `generateFrontmatter()` — so that when `minimal: true`:
   - Description placeholder uses: `"TODO: Describe what this skill does and when to use it."` (matches requirements)
   - The basic template does NOT include the commented-out `allowed-tools` placeholder block (lines 142-149) — just omit the `allowed-tools` field entirely when no tools are specified
5. Update `generateSkillMd()` (line 441-447) to branch on `options?.minimal`:
   - If `minimal: true`, call `generateMinimalBody()` instead of `generateBody()`
   - Pass `options` through to `generateFrontmatter()` as before
6. Update the hooks YAML in minimal mode — the requirements specify slightly different hook commands for minimal:
   - PreToolUse command: `echo 'TODO: pre-tool hook'` (single-quoted)
   - PostToolUse command: `echo 'TODO: post-tool hook'` (single-quoted)
   - No commented Stop example
   - Create `generateMinimalHooksYaml()` or add a `minimal` parameter to `generateHooksYaml()`

#### Deliverables
- [x] Updated `src/types/api.ts` — `minimal` field added to `ScaffoldTemplateOptions`
- [x] Updated `src/templates/skill-md.ts` — minimal body generation, frontmatter adjustments, hooks YAML variant

---

### Phase 2: Command and API Integration
**Feature:** [FEAT-016](../features/FEAT-016-minimal-scaffold-flag.md) | [#44](https://github.com/lwndev/ai-skills-manager/issues/44)
**Status:** ✅ Complete

#### Rationale
- **Depends on Phase 1**: Requires the template generation logic to be in place
- **Two touchpoints**: The CLI command definition and the API scaffold function both need to pass `minimal` through
- **Output changes**: The success message should show `(minimal)` in the template name and use shorter next-steps

#### Implementation Steps
1. Add `--minimal` option to the scaffold command in `src/commands/scaffold.ts` (after line 24):
   - `.option('--minimal', 'Generate shorter templates without educational guidance text')`
   - No short alias (per requirements)
2. Add `minimal?: boolean` to the `CliScaffoldOptions` interface in `src/commands/scaffold.ts` (line 70-82)
3. Update `buildTemplateOptions()` in `src/commands/scaffold.ts` (line 134-170) to set `minimal` on the template options:
   - If `options.minimal` is true, set `templateOptions.minimal = true` and `hasOptions = true`
4. Update the API scaffold function in `src/api/scaffold.ts` (line 149-157) to pass `minimal` through when mapping `ScaffoldTemplateOptions` to `TemplateOptions`:
   - Add `minimal: options.template.minimal` to the `templateOptions` object
5. Update the success output in `handleScaffold()` in `src/commands/scaffold.ts`:
   - When `minimal` is true, display the template type as `"basic (minimal)"`, `"forked (minimal)"`, etc.
   - Update `displayNextSteps()` call — either create a `displayMinimalNextSteps()` in `output.ts` or pass a minimal flag:
     - Minimal next steps: only 2 items (edit SKILL.md, validate with `asm validate`)
     - No documentation link or scripts directory mention
6. Add help text example for `--minimal` in the `addHelpText` section of the command (line 25-58):
   - Add `$ asm scaffold my-skill --minimal` to the Examples section
   - Add `--minimal` entry to the Note section

#### Deliverables
- [x] Updated `src/commands/scaffold.ts` — `--minimal` flag, option parsing, output changes
- [x] Updated `src/api/scaffold.ts` — `minimal` passthrough in template options mapping
- [x] Updated `src/utils/output.ts` — minimal next-steps variant

---

### Phase 3: Tests and Verification
**Feature:** [FEAT-016](../features/FEAT-016-minimal-scaffold-flag.md) | [#44](https://github.com/lwndev/ai-skills-manager/issues/44)
**Status:** ✅ Complete

#### Rationale
- **Depends on Phases 1-2**: All code must be in place before testing
- **Comprehensive coverage**: Unit tests for template generation, command parsing; integration tests for validation
- **Final verification**: `npm run quality` must pass

#### Implementation Steps
1. Add unit tests to `tests/unit/templates/skill-md.test.ts` (or create if it doesn't exist):
   - `generateSkillMd()` with `minimal: true` for basic template — verify no HTML comment, no Usage/Implementation Notes sections, has frontmatter + Overview + Instructions + Examples
   - `generateSkillMd()` with `minimal: true` for forked template — verify `context: fork` present, default tools present, overview mentions forked context
   - `generateSkillMd()` with `minimal: true` for with-hooks template — verify hooks YAML present with minimal commands, overview mentions hooks
   - `generateSkillMd()` with `minimal: true` for internal template — verify `user-invocable: false` present, overview mentions internal
   - Verify minimal output is shorter than verbose output for each template type
   - Verify minimal + custom `allowedTools` overrides template defaults
   - Verify minimal + custom `description` replaces TODO placeholder
   - Verify minimal + `agent` adds agent field
   - Verify default (no `minimal` flag) output is unchanged
2. Add unit tests to `tests/unit/commands/scaffold.test.ts`:
   - `--minimal` flag is parsed correctly (truthy)
   - `--minimal` combined with `--template forked` produces correct template options
   - `--minimal` combined with other flags (`--context fork`, `--agent`, `--no-user-invocable`, `--hooks`)
   - Default behavior (no `--minimal`) produces `undefined` or `false` for minimal
3. Add integration tests to `tests/integration/api/scaffold.test.ts`:
   - Scaffold with `minimal: true` for each template type and verify output passes `validate()`
   - Scaffold with `minimal: true` and verify SKILL.md content matches expected minimal structure
   - Scaffold with `minimal: true` + `description` + `allowedTools` and verify correct frontmatter
   - Compare minimal vs verbose output sizes (minimal should be significantly smaller)
4. Run `npm run quality` to verify all tests pass, lint passes, and coverage thresholds are met

#### Deliverables
- [x] Created/updated `tests/unit/templates/skill-md.test.ts` — minimal template generation tests
- [x] Updated `tests/unit/commands/scaffold.test.ts` — `--minimal` flag parsing tests
- [x] Updated `tests/integration/api/scaffold.test.ts` — minimal scaffold validation tests
- [x] `npm run quality` passes

---

## Shared Infrastructure

### Modified Modules

| Module | Change |
|--------|--------|
| `src/types/api.ts` | Add `minimal?: boolean` to `ScaffoldTemplateOptions` |
| `src/templates/skill-md.ts` | Add `generateMinimalBody()`, update `generateSkillMd()`, minimal hooks YAML |
| `src/commands/scaffold.ts` | Add `--minimal` flag, update `buildTemplateOptions()`, update output |
| `src/api/scaffold.ts` | Pass `minimal` through template options mapping |
| `src/utils/output.ts` | Add minimal next-steps variant |

### No New Dependencies
This feature requires no new packages. All changes are internal to existing modules.

---

## Testing Strategy

### Unit Tests
- Template generation with `minimal: true` for all 4 template types
- Minimal output excludes HTML comment guidance block
- Minimal output includes frontmatter with all required fields
- Minimal output body structure: Overview + Instructions + Examples only
- Minimal + flag combinations produce correct frontmatter
- Default (non-minimal) output is unchanged
- `--minimal` flag parsing in CLI command

### Integration Tests
- Scaffold with `--minimal` for each template type, verify output passes `asm validate`
- Scaffold with `--minimal` + various flag combinations
- Compare minimal vs. verbose output sizes (minimal should be significantly smaller)

### Manual Testing
- `asm scaffold my-skill --minimal` produces clean, readable SKILL.md
- `asm scaffold my-skill --minimal --template forked` includes forked frontmatter
- `asm scaffold my-skill --minimal --template with-hooks` includes hook config
- `asm scaffold my-skill --minimal --template internal` includes `user-invocable: false`
- `asm validate` passes on all minimal scaffolded skills

---

## Dependencies and Prerequisites

### Code Dependencies
- FEAT-001 (Scaffold Skill Command) — base scaffold implementation
- FEAT-013 (Skill Template Enhancements) — template variants and flags

### Existing Files Modified
- `src/templates/skill-md.ts` — template generation engine (448 lines)
- `src/commands/scaffold.ts` — CLI command definition (242 lines)
- `src/api/scaffold.ts` — scaffold API function (191 lines)
- `src/types/api.ts` — type definitions (999 lines)
- `src/utils/output.ts` — output display utilities

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Default scaffold output changes unexpectedly | High | Low | Phase 1 branches on `minimal` flag; no changes to existing code paths when `minimal` is false/undefined |
| Minimal templates fail validation | Medium | Low | Integration tests explicitly validate all minimal template types |
| `--minimal` conflicts with existing flags | Low | Very Low | No short alias; Commander.js handles boolean flags cleanly |
| Minimal hooks YAML is invalid | Medium | Low | Unit tests verify hooks structure; integration test validates full output |

---

## Success Criteria

### Per-Phase Criteria
- [x] Phase 1: `generateSkillMd({ name: 'test' }, { minimal: true })` produces correct minimal output for all 4 template types
- [x] Phase 2: `asm scaffold my-skill --minimal` works end-to-end with all flag combinations
- [x] Phase 3: All tests pass, `npm run quality` green

### Overall Success (from Requirements)
- [x] `--minimal` flag is accepted by `asm scaffold`
- [x] Minimal templates contain valid SKILL.md structure with required frontmatter
- [x] Minimal templates pass `asm validate`
- [x] Minimal basic template omits HTML comment guidance block
- [x] Minimal forked template omits forked context guidance while keeping `context: fork`
- [x] Minimal hooks template omits hook documentation while keeping hook configuration
- [x] Minimal internal template omits internal skill guidance while keeping `user-invocable: false`
- [x] `--minimal` works in combination with all other flags
- [x] Default behavior (no `--minimal`) is unchanged
- [x] Help text documents the `--minimal` flag
- [x] Unit tests cover minimal output for all template types
- [x] Integration tests validate minimal skills pass `asm validate`

---

## Code Organization

```
src/
├── api/
│   └── scaffold.ts            # MODIFY: pass minimal through template options
├── commands/
│   └── scaffold.ts            # MODIFY: add --minimal flag, update output
├── templates/
│   └── skill-md.ts            # MODIFY: add generateMinimalBody(), minimal hooks YAML
├── types/
│   └── api.ts                 # MODIFY: add minimal to ScaffoldTemplateOptions
└── utils/
    └── output.ts              # MODIFY: add minimal next-steps variant

tests/
├── unit/
│   ├── commands/
│   │   └── scaffold.test.ts   # UPDATE: --minimal flag parsing tests
│   └── templates/
│       └── skill-md.test.ts   # CREATE/UPDATE: minimal template generation tests
└── integration/
    └── api/
        └── scaffold.test.ts   # UPDATE: minimal scaffold validation tests
```
