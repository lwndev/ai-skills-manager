# Implementation Plan: Minimal Scaffold Flag

## Overview

Add a `--minimal` flag to `asm scaffold` that generates shorter, production-ready SKILL.md templates without the verbose educational guidance comments. This caters to experienced users who prefer clean scaffolding output. The feature touches the template generator, CLI command, API layer, and output utilities, with a consistent minimal structure across all four template types: `basic`, `forked`, `with-hooks`, and `internal`.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-016 | [#44](https://github.com/lwndev/ai-skills-manager/issues/44) | [FEAT-016-minimal-scaffold-flag.md](../features/FEAT-016-minimal-scaffold-flag.md) | Medium | Low-Medium | Pending |

## Recommended Build Sequence

### Phase 1: Minimal Template Generation
**Feature:** [FEAT-016](../features/FEAT-016-minimal-scaffold-flag.md) | [#44](https://github.com/lwndev/ai-skills-manager/issues/44)
**Status:** Pending

#### Rationale
- **Core logic first**: The template generator is the heart of this feature — all other layers depend on it
- **Self-contained**: Changes are isolated to `src/templates/skill-md.ts` and its tests
- **Testable independently**: Minimal templates can be verified before wiring up CLI/API

#### Implementation Steps
1. Add `minimal?: boolean` to `TemplateOptions` interface in `src/templates/skill-md.ts`
2. Create `generateMinimalBody()` function that produces the shorter body structure:
   - H1 heading with skill name
   - `## Overview` with template-specific single-line TODO
   - `## Instructions` with `TODO: Step-by-step guidance for Claude.`
   - `## Examples` with `TODO: Concrete input/output examples.`
   - No `## Usage`, `## Implementation Notes`, or `## Resources` sections
   - No HTML comment guidance block
3. Update `generateBody()` to dispatch to `generateMinimalBody()` when `options.minimal` is true
4. Update `generateFrontmatter()` to use minimal description placeholder:
   - Minimal: `"TODO: Describe what this skill does and when to use it."`
   - Verbose (unchanged): `"TODO: Add a short description of what this skill does"`
5. Template-specific Overview TODO text:
   - `basic`: `TODO: Brief description of what this skill does.`
   - `forked`: `TODO: Brief description. This skill runs in a forked context.`
   - `with-hooks`: `TODO: Brief description. This skill uses hooks for tool lifecycle events.`
   - `internal`: `TODO: Brief description. This is an internal helper skill.`
6. Add unit tests in `tests/unit/templates/skill-md.test.ts`:
   - `generateSkillMd()` with `minimal: true` for each of the 4 template types
   - Verify minimal output does NOT contain `<!--` (no HTML comment block)
   - Verify minimal output does NOT contain `## Usage` or `## Implementation Notes`
   - Verify minimal output DOES contain `## Overview`, `## Instructions`, `## Examples`
   - Verify frontmatter is preserved correctly (name, description, allowed-tools, context, hooks, user-invocable, agent)
   - Verify minimal output is shorter than verbose output for each template type
   - Verify minimal + explicit description uses the provided description (not TODO placeholder)
   - Verify minimal + explicit allowedTools overrides template defaults

#### Deliverables
- [ ] `minimal` option added to `TemplateOptions` interface
- [ ] `generateMinimalBody()` function
- [ ] Updated `generateBody()` with minimal dispatch
- [ ] Updated `generateFrontmatter()` with minimal description placeholder
- [ ] Unit tests for all 4 minimal template types
- [ ] Unit tests for minimal + flag combinations

---

### Phase 2: API and CLI Integration
**Feature:** [FEAT-016](../features/FEAT-016-minimal-scaffold-flag.md) | [#44](https://github.com/lwndev/ai-skills-manager/issues/44)
**Status:** Pending

#### Rationale
- **Builds on Phase 1**: Template generation is complete, now wire it through the stack
- **Three touch points**: Types, API passthrough, and CLI option parsing
- **Straightforward plumbing**: No complex logic, just threading the `minimal` flag

#### Implementation Steps
1. Add `minimal?: boolean` to `ScaffoldTemplateOptions` in `src/types/api.ts`
2. Update `src/api/scaffold.ts` to pass `minimal` through the template options mapping (line ~155)
3. Add `--minimal` CLI option to `src/commands/scaffold.ts`:
   - Option definition: `.option('--minimal', 'Generate shorter templates without educational guidance')`
   - No short alias (to avoid conflicts, as specified in requirements)
   - Default: `false`
4. Add `minimal?: boolean` to `CliScaffoldOptions` interface
5. Update `buildTemplateOptions()` in `src/commands/scaffold.ts` to include `minimal`:
   ```typescript
   if (options.minimal) {
     templateOptions.minimal = true;
     hasOptions = true;
   }
   ```
6. Update CLI help text to document `--minimal` flag:
   - Add to the examples section
   - Add to the "Template options" section
7. Add unit tests in `tests/unit/commands/scaffold.test.ts`:
   - `--minimal` flag is parsed correctly
   - `--minimal` combined with `--template` options
   - `--minimal` combined with other flags (`--context`, `--agent`, `--hooks`, `--no-user-invocable`, `--description`, `--allowed-tools`)
   - `--minimal` is included in template options passed to API

#### Deliverables
- [ ] `minimal` field in `ScaffoldTemplateOptions` type
- [ ] `minimal` passthrough in `src/api/scaffold.ts`
- [ ] `--minimal` CLI option in `src/commands/scaffold.ts`
- [ ] Updated CLI help text with `--minimal` examples
- [ ] Unit tests for CLI option parsing
- [ ] Unit tests for flag combinations

---

### Phase 3: Output Formatting and Integration Tests
**Feature:** [FEAT-016](../features/FEAT-016-minimal-scaffold-flag.md) | [#44](https://github.com/lwndev/ai-skills-manager/issues/44)
**Status:** Pending

#### Rationale
- **User-facing polish**: Output messages should reflect minimal mode
- **End-to-end verification**: Integration tests prove the full pipeline works
- **Validation**: Ensures minimal SKILL.md files pass `asm validate`

#### Implementation Steps
1. Update `src/utils/output.ts`:
   - Add `displayMinimalNextSteps()` or add a `minimal` parameter to `displayNextSteps()` for the shorter 2-step output:
     ```
     Next steps:
       1. Edit SKILL.md to complete the TODO placeholders
       2. Test with: asm validate <skill-name>
     ```
   - Update `displayCreatedFiles()` or scaffold command output to show `(minimal)` after template type:
     ```
     Template: basic (minimal)
     ```
2. Update `handleScaffold()` in `src/commands/scaffold.ts` to pass minimal state to output functions
3. Add integration tests in `tests/integration/api/scaffold.test.ts`:
   - Scaffold with `--minimal` for each template type and verify SKILL.md content
   - Verify minimal scaffolded skills pass `asm validate`
   - Compare minimal vs. verbose output sizes (minimal should be significantly smaller)
   - Test `--minimal` with `--description`, `--allowed-tools`, and other flag combinations
4. Add integration tests in `tests/integration/scaffold.test.ts`:
   - CLI scaffold with `--minimal` flag produces correct output
   - CLI scaffold with `--minimal --template forked` produces correct output
   - Help text includes `--minimal` documentation
5. Run `npm run quality` to verify all tests pass and coverage is maintained

#### Deliverables
- [ ] Updated output formatting for minimal mode
- [ ] Integration tests for minimal scaffold (all 4 template types)
- [ ] Integration tests for minimal + `asm validate`
- [ ] Integration tests for minimal + flag combinations
- [ ] `npm run quality` passing

---

## Shared Infrastructure

### Updated Types

**`src/templates/skill-md.ts`**
```typescript
export interface TemplateOptions {
  templateType?: TemplateType;
  context?: 'fork';
  agent?: string;
  userInvocable?: boolean;
  includeHooks?: boolean;
  minimal?: boolean;  // NEW
}
```

**`src/types/api.ts`**
```typescript
export interface ScaffoldTemplateOptions {
  templateType?: ScaffoldTemplateType;
  context?: 'fork';
  agent?: string;
  userInvocable?: boolean;
  includeHooks?: boolean;
  minimal?: boolean;  // NEW
}
```

### New Functions
- `generateMinimalBody(params, templateType)` in `src/templates/skill-md.ts`

### Modified Functions
- `generateBody()` — dispatch to minimal variant
- `generateFrontmatter()` — minimal description placeholder
- `buildTemplateOptions()` — handle `--minimal` flag
- `handleScaffold()` — pass minimal state to output
- `displayNextSteps()` — shorter output for minimal mode

## Testing Strategy

### Unit Testing
- **Coverage goal:** Maintain existing >80% coverage
- **Focus areas:**
  - Template generation: 4 minimal templates × verified structure + no guidance block
  - CLI option parsing: `--minimal` alone and in combination with all other flags
  - Frontmatter correctness: All template-specific fields preserved in minimal mode
  - Flag override: `--description` and `--allowed-tools` override minimal defaults

### Integration Testing
- Scaffold with `--minimal` for each template type → verify SKILL.md content
- Minimal SKILL.md passes `asm validate` for each template type
- Minimal output is significantly shorter than verbose output
- Flag combinations (`--minimal --template forked --allowed-tools "Read,Write"`)
- Backward compatibility: scaffold without `--minimal` produces identical output to current behavior

## Dependencies and Prerequisites

### Internal Dependencies
- FEAT-001 (Scaffold Skill Command) — base scaffold command
- FEAT-013 (Skill Template Enhancements) — template variants and flags (✅ Complete)
- `src/templates/skill-md.ts` — template generation
- `src/commands/scaffold.ts` — command definition
- `src/api/scaffold.ts` — scaffold API
- `src/types/api.ts` — API type definitions

### External Dependencies
- No new external dependencies required

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Minimal templates fail `asm validate` | High | Low | Integration tests verify all minimal templates pass validation |
| Breaking existing (non-minimal) scaffold behavior | High | Low | Backward compatibility tests; `--minimal` defaults to false |
| Inconsistent minimal structure across template types | Medium | Low | Shared `generateMinimalBody()` function; consistent TODO style |
| Missing frontmatter fields in minimal mode | Medium | Low | Frontmatter generation is shared with verbose mode; only body changes |

## Success Criteria

### Per-Phase Criteria
- All unit tests passing
- All integration tests passing
- `npm run quality` passing

### Overall Success
- [ ] `--minimal` flag is accepted by `asm scaffold`
- [ ] Minimal basic template: frontmatter + Overview + Instructions + Examples (no HTML comment block)
- [ ] Minimal forked template: includes `context: fork`, default tools, no guidance block
- [ ] Minimal hooks template: includes hook configuration, no guidance block
- [ ] Minimal internal template: includes `user-invocable: false`, no guidance block
- [ ] `--minimal` works with all other flags (`--template`, `--context`, `--agent`, `--hooks`, `--no-user-invocable`, `--allowed-tools`, `--description`, `--personal`, `--project`, `--force`, `--output`)
- [ ] Minimal templates pass `asm validate`
- [ ] Default behavior (no `--minimal`) is unchanged
- [ ] Help text documents the `--minimal` flag
- [ ] Output shows `(minimal)` indicator when flag is used
- [ ] Minimal "Next steps" is 2 steps (vs. standard output)

## Code Organization

```
src/
├── commands/
│   └── scaffold.ts          # Add --minimal option, update output
├── api/
│   └── scaffold.ts          # Pass minimal through template options
├── templates/
│   └── skill-md.ts          # generateMinimalBody(), updated TemplateOptions
├── types/
│   └── api.ts               # Add minimal to ScaffoldTemplateOptions
└── utils/
    └── output.ts            # Minimal next steps output

tests/
├── unit/
│   ├── commands/
│   │   └── scaffold.test.ts # --minimal flag parsing tests
│   └── templates/
│       └── skill-md.test.ts # Minimal template generation tests
└── integration/
    ├── api/
    │   └── scaffold.test.ts # Minimal scaffold + validate tests
    └── scaffold.test.ts     # CLI minimal scaffold tests
```
