# Implementation Plan: Skill Template Enhancements

## Overview

This plan covers the implementation of enhanced template variants and CLI options for the `asm scaffold` command, enabling developers to quickly create skills that leverage Claude Code 2.1.x features including forked contexts, hooks, agent specification, and user-invocable control.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-013 | [#36](https://github.com/lwndev/ai-skills-manager/issues/36) | [FEAT-013-skill-template-enhancements.md](../features/FEAT-013-skill-template-enhancements.md) | Medium | Medium | Pending |

## Recommended Build Sequence

### Phase 1: Template Type System and Basic Template Enhancement
**Feature:** [FEAT-013](../features/FEAT-013-skill-template-enhancements.md) | [#36](https://github.com/lwndev/ai-skills-manager/issues/36)
**Status:** ✅ Complete

#### Rationale
- **Foundation first**: Establishes the template type system that all subsequent phases build upon
- **Backward compatibility**: Ensures existing `asm scaffold` behavior remains unchanged
- **Immediate value**: Improves the basic template with Claude Code 2.1.x documentation
- **Pattern establishment**: Defines how templates will be selected and applied

#### Implementation Steps
1. Define `TemplateType` enum/type in `src/templates/skill-md.ts` with values: `basic`, `forked`, `with-hooks`, `internal`
2. Create `TemplateOptions` interface to hold template configuration:
   ```typescript
   interface TemplateOptions {
     templateType?: TemplateType;
     context?: 'fork';
     agent?: string;
     userInvocable?: boolean;
     includeHooks?: boolean;
   }
   ```
3. Update `generateSkillMd()` function signature to accept `TemplateOptions`
4. Enhance the basic template's guidance comment to document:
   - New frontmatter fields (`context`, `agent`, `hooks`, `user-invocable`)
   - Wildcard tool patterns (e.g., `Bash(git *)`, `Bash(npm install)`)
   - Argument shorthand syntax (`$0`, `$1`, `$ARGUMENTS[0]`, `${CLAUDE_SESSION_ID}`)
   - Which fields are Claude Code-specific vs. open Agent Skills spec
5. Update existing unit tests to verify backward compatibility
6. Add new unit tests for template type validation

#### Deliverables
- [x] `TemplateType` type definition in `src/templates/skill-md.ts`
- [x] `TemplateOptions` interface in `src/templates/skill-md.ts`
- [x] Updated `generateSkillMd()` with template options support
- [x] Enhanced basic template with Claude Code 2.1.x documentation
- [x] Unit tests for template type system

---

### Phase 2: Forked Context and Internal Templates
**Feature:** [FEAT-013](../features/FEAT-013-skill-template-enhancements.md) | [#36](https://github.com/lwndev/ai-skills-manager/issues/36)
**Status:** ✅ Complete

#### Rationale
- **Simple additions**: Both templates add single frontmatter fields (`context: fork` and `user-invocable: false`)
- **Clear guidance**: Each template needs specific body content explaining the feature
- **Building blocks**: Tests foundational frontmatter field generation for more complex templates

#### Implementation Steps
1. Implement `forked` template generation:
   - Add `context: fork` to frontmatter
   - Set default allowed-tools to read-only tools: `Read`, `Glob`, `Grep`
   - Add body guidance for forked contexts:
     - When to use forked contexts (isolated analysis, exploratory operations)
     - Limitations (no state persistence to parent conversation)
     - Best practices for data return
2. Implement `internal` template generation:
   - Add `user-invocable: false` to frontmatter
   - Set default allowed-tools to `Read`, `Grep`
   - Add body guidance for internal helpers:
     - Explanation of `user-invocable: false` behavior
     - How other skills can reference this skill
     - Common patterns for helper skills
3. Update `escapeYamlString()` if needed for new field values
4. Add unit tests for each template variant
5. Add integration tests verifying generated skills pass `asm validate`

#### Deliverables
- [x] Forked template implementation in `src/templates/skill-md.ts`
- [x] Internal template implementation in `src/templates/skill-md.ts`
- [x] Unit tests for forked template generation
- [x] Unit tests for internal template generation
- [x] Integration tests for template validation

---

### Phase 3: Hooks Template
**Feature:** [FEAT-013](../features/FEAT-013-skill-template-enhancements.md) | [#36](https://github.com/lwndev/ai-skills-manager/issues/36)
**Status:** ✅ Complete

#### Rationale
- **Most complex template**: Hooks require nested YAML structure with multiple hook types
- **Educational value**: Demonstrates advanced Claude Code features with commented examples
- **Builds on prior phases**: Uses established template infrastructure

#### Implementation Steps
1. Implement `with-hooks` template generation:
   - Add hooks section to frontmatter using Claude Code's nested structure with `matcher` and `hooks` array
   - Include PreToolUse and PostToolUse examples with `"*"` matcher
   - Include commented Stop hook example (Stop hooks don't use matchers)
   - Note: Skills only support PreToolUse, PostToolUse, and Stop hooks (NOT SessionStart)
   - Set appropriate allowed-tools including `Bash`, `Read`, `Write`
2. Create helper function `generateHooksYaml()` for hooks section formatting
3. Add body guidance for hooks:
   - Document the three hook types supported in skills and when they fire
   - Matcher patterns (`"*"`, `"Bash"`, `"Edit|Write"`)
   - Example use cases (validation, logging, cleanup)
   - Hook configuration format with nested structure
   - The `once` option for running hooks only once per session
4. Ensure proper YAML indentation for nested hook structures
5. Add unit tests for hooks template
6. Add unit tests for hooks YAML generation edge cases

#### Deliverables
- [x] Hooks template implementation in `src/templates/skill-md.ts`
- [x] `generateHooksYaml()` helper function
- [x] Unit tests for hooks template generation
- [x] Unit tests for YAML indentation and structure

---

### Phase 4: CLI Flag Support
**Feature:** [FEAT-013](../features/FEAT-013-skill-template-enhancements.md) | [#36](https://github.com/lwndev/ai-skills-manager/issues/36)
**Status:** Pending

#### Rationale
- **User flexibility**: Individual flags allow custom combinations beyond predefined templates
- **Override behavior**: Flags can modify template defaults
- **CLI layer**: Builds on complete template system from prior phases

#### Implementation Steps
1. Add new CLI options to `src/commands/scaffold.ts`:
   - `--template <type>` - Template variant selection (basic, forked, with-hooks, internal)
   - `--context fork` - Add `context: fork` to frontmatter
   - `--agent <name>` - Set the `agent` field in frontmatter
   - `--no-user-invocable` - Set `user-invocable: false` in frontmatter
   - `--hooks` - Include commented hook examples
2. Implement template option validation:
   - Validate template name against allowed values
   - Validate `--context` only accepts "fork"
   - Validate `--agent` requires non-empty string
3. Implement flag-to-template-options mapping
4. Implement override logic: flags override template defaults when both specified
5. Update `src/api/scaffold.ts` to accept and pass template options
6. Update output messages to show template type used
7. Add error handling for invalid options:
   - Unknown template name
   - Empty agent string
   - Invalid context value
8. Add unit tests for CLI option parsing
9. Add unit tests for flag/template combination handling
10. Add integration tests for complete workflows

#### Deliverables
- [ ] CLI options in `src/commands/scaffold.ts`
- [ ] Template option validation
- [ ] Flag override logic
- [ ] Updated `src/api/scaffold.ts` with template options
- [ ] Updated scaffold output messages
- [ ] Error messages for invalid options
- [ ] Unit tests for CLI option parsing
- [ ] Unit tests for flag combinations
- [ ] Integration tests for scaffold with templates

---

### Phase 5: Documentation and Final Validation
**Feature:** [FEAT-013](../features/FEAT-013-skill-template-enhancements.md) | [#36](https://github.com/lwndev/ai-skills-manager/issues/36)
**Status:** Pending

#### Rationale
- **Quality assurance**: Final verification that all templates work correctly in Claude Code
- **Completeness**: Ensures all acceptance criteria are met
- **Polish**: Updates help text and ensures consistent user experience

#### Implementation Steps
1. Update CLI help text for scaffold command with new options
2. Run full test suite to verify all tests pass
3. Run `npm run quality` to verify linting and coverage
4. Manual testing of each template variant:
   - Verify generated SKILL.md works in Claude Code 2.1.x
   - Test hook examples execute correctly
   - Confirm forked context skills run in isolation
5. Verify Claude Code-specific vs. open spec fields are clearly marked in templates
6. Review error messages for clarity
7. Final cleanup and code review

#### Deliverables
- [ ] Updated CLI help text
- [ ] All tests passing
- [ ] `npm run quality` passing
- [ ] Manual testing completed
- [ ] Code review completed

---

## Shared Infrastructure

### New Types (`src/templates/skill-md.ts`)
```typescript
type TemplateType = 'basic' | 'forked' | 'with-hooks' | 'internal';

interface TemplateOptions {
  templateType?: TemplateType;
  context?: 'fork';
  agent?: string;
  userInvocable?: boolean;
  includeHooks?: boolean;
}
```

### Updated Exports
- `generateSkillMd()` with optional `TemplateOptions` parameter
- `TemplateType` type export for CLI usage

## Testing Strategy

### Unit Testing
- **Coverage goal:** Maintain >80% coverage
- **Focus areas:**
  - Template generation for each variant
  - YAML escaping for new fields
  - CLI option parsing
  - Flag/template combination handling
  - Error handling for invalid inputs

### Integration Testing
- Scaffold with each template type and verify output
- Validate scaffolded skills pass `asm validate`
- Test flag combinations produce expected frontmatter
- Verify backward compatibility (no flags = current behavior)

### Manual Testing
- Create skill with each template variant in Claude Code 2.1.x
- Verify hook examples execute correctly
- Confirm forked context skills run in isolation

## Dependencies and Prerequisites

### Internal Dependencies
- FEAT-011 (Frontmatter Enhancements) - Validation must support new fields
- Existing `src/templates/skill-md.ts`
- Existing `src/commands/scaffold.ts`
- Existing `src/api/scaffold.ts`

### External Dependencies
- No new external dependencies required

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| YAML formatting issues with hooks | Medium | Medium | Comprehensive unit tests for YAML generation |
| Breaking existing scaffold behavior | High | Low | Backward compatibility tests, no changes to default behavior |
| Flag combination edge cases | Low | Medium | Document precedence rules, test all combinations |
| Validation failures for new fields | Medium | Low | Verify FEAT-011 supports all new frontmatter fields |

## Success Criteria

### Per-Phase Criteria
- All unit tests passing
- All integration tests passing
- `npm run quality` passing

### Overall Success
- [ ] `--template basic` produces current default output
- [ ] `--template forked` adds `context: fork` and appropriate guidance
- [ ] `--template with-hooks` includes hook configuration examples
- [ ] `--template internal` adds `user-invocable: false`
- [ ] `--context fork` flag works independently
- [ ] `--agent <name>` flag sets agent field
- [ ] `--no-user-invocable` flag sets `user-invocable: false`
- [ ] `--hooks` flag adds commented hook examples
- [ ] Flags can be combined with templates
- [ ] Basic template updated with Claude Code 2.1.x documentation
- [ ] Wildcard tool patterns documented in templates
- [ ] Argument shorthand syntax documented
- [ ] Claude Code-specific vs. open spec fields clearly marked
- [ ] All existing scaffold tests continue to pass
- [ ] Error messages for invalid options are clear

## Code Organization

```
src/
├── commands/
│   └── scaffold.ts          # Updated with new CLI options
├── api/
│   └── scaffold.ts          # Updated with template options
└── templates/
    └── skill-md.ts          # Template type system and variants

tests/
├── unit/
│   ├── commands/
│   │   └── scaffold.test.ts # New option parsing tests
│   ├── api/
│   │   └── scaffold.test.ts # New template option tests
│   └── templates/
│       └── skill-md.test.ts # Template variant tests
└── integration/
    └── api/
        └── scaffold.test.ts # Template workflow tests
```
