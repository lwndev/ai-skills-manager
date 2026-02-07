# Implementation Plan: Frontmatter Schema v2 — New Claude Code Fields & Validation Patterns

## Overview

Extend ASM's frontmatter validation to support 11 new fields introduced in Claude Code v2.0.30 through v2.1.33 and update the `allowed-tools` validator to accept advanced tool permission patterns. This is a single-feature implementation with 4 phases that builds incrementally on the existing validation architecture established in FEAT-011.

Significant infrastructure is already in place: `ALLOWED_KEYS`, `CheckName`, `ParsedFrontmatter`, `ValidationCheckName`, `CHECK_NAMES`, and the `initializeChecks()` function have already been updated with all 11 new fields. The frontmatter parser already normalizes `tools` and `disallowedTools`. The remaining work is creating the individual validator files, wiring them into the orchestrator, and writing comprehensive tests.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-014 | [#51](https://github.com/lwndev/ai-skills-manager/issues/51) | [FEAT-014-frontmatter-schema-v2.md](../features/FEAT-014-frontmatter-schema-v2.md) | High | Medium | Pending |

## Recommended Build Sequence

### Phase 1: Simple Field Validators (Boolean, Enum, String)
**Feature:** [FEAT-014](../features/FEAT-014-frontmatter-schema-v2.md) | [#51](https://github.com/lwndev/ai-skills-manager/issues/51)
**Status:** ✅ Complete

#### Rationale
- **Foundation first**: Start with the simplest validators that follow well-established patterns from FEAT-011 (`context.ts`, `agent.ts`, `user-invocable.ts`)
- **High coverage per effort**: 8 of 11 validators are straightforward type/enum/string checks
- **No cross-cutting concerns**: These validators are self-contained with no dependencies on each other

#### Implementation Steps

1. Create `src/validators/memory.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Validate value is one of `"user"`, `"project"`, `"local"`
   - Error for any other value, listing valid options

2. Create `src/validators/skills.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Accept string (non-empty) → valid
   - Accept array of strings → valid (including empty array)
   - Error for non-string types, arrays containing non-strings

3. Create `src/validators/model.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Must be non-empty string if present → error otherwise
   - Return warning for unknown values not in `["inherit", "sonnet", "opus", "haiku"]`
   - Use discriminated union return type: `ModelValidationResult`
   - Pattern: follows `HooksValidationResult` (valid with warnings)

4. Create `src/validators/permission-mode.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Must be non-empty string if present → error otherwise

5. Create `src/validators/argument-hint.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Must be non-empty string if present → error otherwise
   - Max length: 200 characters → error with current length info

6. Create `src/validators/keep-coding-instructions.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Must be boolean if present → error for non-boolean types

7. Create `src/validators/color.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Validate value is one of: `"blue"`, `"cyan"`, `"green"`, `"yellow"`, `"magenta"`, `"red"`
   - Error for any other value, listing valid options

8. Create `src/validators/disable-model-invocation.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Must be boolean if present → error for non-boolean types

9. Create `src/validators/version.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Must be non-empty string if present → error otherwise

10. Write unit tests for all 9 validators (one test file per validator in `tests/unit/validators/`)

#### Deliverables
- [x] `src/validators/memory.ts`
- [x] `src/validators/skills.ts`
- [x] `src/validators/model.ts` (with `ModelValidationResult` type)
- [x] `src/validators/permission-mode.ts`
- [x] `src/validators/argument-hint.ts`
- [x] `src/validators/keep-coding-instructions.ts`
- [x] `src/validators/color.ts`
- [x] `src/validators/disable-model-invocation.ts`
- [x] `src/validators/version.ts`
- [x] `tests/unit/validators/memory.test.ts`
- [x] `tests/unit/validators/skills.test.ts`
- [x] `tests/unit/validators/model.test.ts`
- [x] `tests/unit/validators/permission-mode.test.ts`
- [x] `tests/unit/validators/argument-hint.test.ts`
- [x] `tests/unit/validators/keep-coding-instructions.test.ts`
- [x] `tests/unit/validators/color.test.ts`
- [x] `tests/unit/validators/disable-model-invocation.test.ts`
- [x] `tests/unit/validators/version.test.ts`

---

### Phase 2: Tool-Pattern Validators (disallowedTools, tools, allowed-tools)
**Feature:** [FEAT-014](../features/FEAT-014-frontmatter-schema-v2.md) | [#51](https://github.com/lwndev/ai-skills-manager/issues/51)
**Status:** ✅ Complete

#### Rationale
- **Shared validation logic**: `disallowedTools`, `tools`, and `allowed-tools` all share the same tool permission pattern syntax
- **Pattern complexity**: These fields require validating advanced patterns (`Task(AgentName)`, `mcp__server__*`, `${CLAUDE_PLUGIN_ROOT}`, `Bash(git:*)`) which are best handled by a shared utility
- **Builds on Phase 1**: Validators follow the same structural patterns established in Phase 1

#### Implementation Steps

1. Create `src/validators/tool-patterns.ts` — shared utility
   - Export `validateToolEntry(entry: string): boolean` — validates a single tool permission string
   - Accept: simple names (`Read`, `Write`), `Task(agent-name)`, `mcp__server__*`, `${CLAUDE_PLUGIN_ROOT}/path`, `Bash(git *)`, `Bash(git:*)`, `Bash(*)`, `Bash`
   - Pattern: non-empty string is valid (relaxed validation — Claude Code handles runtime semantics)
   - Export `validateToolList(value: unknown): ValidationResult` — validates string or array of strings

2. Create `src/validators/disallowed-tools.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Accept string (non-empty) → valid
   - Accept array of strings → valid (including empty array)
   - Delegates to `validateToolList()` from tool-patterns
   - Error for non-string types, arrays containing non-strings

3. Create `src/validators/tools.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Same validation as `disallowedTools` — delegates to `validateToolList()`

4. Create `src/validators/allowed-tools.ts`
   - Accept `undefined`/`null` → valid (optional field)
   - Accept array of non-empty strings → valid (post-normalization, parser already converts strings to arrays)
   - Validate each entry is a non-empty string
   - Do NOT reject entries based on a fixed tool name list — accept any valid tool permission pattern
   - Error for non-array types (parser normalizes), arrays containing non-strings or empty strings

5. Write unit tests for all 4 files:
   - `tests/unit/validators/tool-patterns.test.ts` — tests for all pattern types
   - `tests/unit/validators/disallowed-tools.test.ts`
   - `tests/unit/validators/tools.test.ts`
   - `tests/unit/validators/allowed-tools.test.ts` — including `Task(AgentName)`, `mcp__server__*`, `${CLAUDE_PLUGIN_ROOT}`, `Bash(git:*)` acceptance

#### Deliverables
- [x] `src/validators/tool-patterns.ts`
- [x] `src/validators/disallowed-tools.ts`
- [x] `src/validators/tools.ts`
- [x] `src/validators/allowed-tools.ts`
- [x] `tests/unit/validators/tool-patterns.test.ts`
- [x] `tests/unit/validators/disallowed-tools.test.ts`
- [x] `tests/unit/validators/tools.test.ts`
- [x] `tests/unit/validators/allowed-tools.test.ts`

---

### Phase 3: Orchestrator Integration & Warning Propagation
**Feature:** [FEAT-014](../features/FEAT-014-frontmatter-schema-v2.md) | [#51](https://github.com/lwndev/ai-skills-manager/issues/51)
**Status:** ✅ Complete

#### Rationale
- **Wiring phase**: All individual validators exist from Phases 1-2 but aren't yet called from the validation orchestrator
- **Warning flow**: The `model` validator produces warnings (like `hooks`), which must be collected and propagated through `buildResult()`
- **Must follow Phases 1-2**: Cannot wire validators that don't exist yet

#### Implementation Steps

1. Update `src/generators/validate.ts` — wire all new validators
   - Import all 12 new validators (9 from Phase 1, 3 from Phase 2)
   - Add validation steps 12-22 (after existing step 11, before current step 12 for directory name match):
     - Step 12: `memory` → `validateMemory(frontmatter.memory)`
     - Step 13: `skills` → `validateSkills(frontmatter.skills)`
     - Step 14: `model` → `validateModel(frontmatter.model)` — collect warnings
     - Step 15: `permissionMode` → `validatePermissionMode(frontmatter.permissionMode)`
     - Step 16: `disallowedTools` → `validateDisallowedTools(frontmatter.disallowedTools)`
     - Step 17: `argumentHint` → `validateArgumentHint(frontmatter['argument-hint'])`
     - Step 18: `keepCodingInstructions` → `validateKeepCodingInstructions(frontmatter['keep-coding-instructions'])`
     - Step 19: `tools` → `validateTools(frontmatter.tools)`
     - Step 20: `color` → `validateColor(frontmatter.color)`
     - Step 21: `disableModelInvocation` → `validateDisableModelInvocation(frontmatter['disable-model-invocation'])`
     - Step 22: `version` → `validateVersion(frontmatter.version)`
     - Step 23: `allowedTools` → `validateAllowedTools(frontmatter['allowed-tools'])`
   - Renumber existing directory name match step (becomes step 24)
   - Renumber file size analysis step (becomes step 25)
   - Collect model warnings into the warnings array (same pattern as hooks warnings)

2. Update `src/validators/index.ts` barrel export
   - Export all new validators for external use

3. Write integration-level test for orchestrator
   - Test `validateSkill()` with a SKILL.md containing all new fields
   - Test that model warnings propagate to the final result
   - Test that invalid new field values produce correct check failures

#### Deliverables
- [x] `src/generators/validate.ts` — updated with 12 new validation steps
- [x] `src/validators/index.ts` — updated barrel exports
- [x] `tests/unit/generators/validate.test.ts` — new or updated orchestrator tests

---

### Phase 4: Integration Tests & Quality Verification
**Feature:** [FEAT-014](../features/FEAT-014-frontmatter-schema-v2.md) | [#51](https://github.com/lwndev/ai-skills-manager/issues/51)
**Status:** ✅ Complete

#### Rationale
- **Confidence phase**: Verify the full pipeline works end-to-end
- **Backward compatibility**: Confirm existing skills without new fields still pass
- **Quality gate**: `npm run quality` must pass before the feature is complete

#### Implementation Steps

1. Write integration tests in `tests/integration/validate-frontmatter-v2.test.ts`
   - Full validation of skill with all 11 new fields populated
   - Full validation of skill with subset of new fields
   - Backward compatibility: validate existing skill with no new fields
   - Model warning propagation through validation pipeline to formatter output
   - Advanced tool patterns in `allowed-tools` (end-to-end)
   - Advanced tool patterns in `tools` and `disallowedTools`

2. Verify existing tests still pass
   - `tests/unit/validators/frontmatter.test.ts` — ALLOWED_KEYS was already updated
   - `tests/unit/utils/frontmatter-parser.test.ts` — parser normalization already works
   - All other existing tests unaffected

3. Run `npm run quality` for final verification
   - Lint passes
   - All tests pass with coverage
   - Audit passes

#### Deliverables
- [x] `tests/integration/validate-frontmatter-v2.test.ts`
- [x] All existing tests still pass
- [x] `npm run quality` passes

---

## Shared Infrastructure

### Already Complete (Pre-existing)
- `ALLOWED_KEYS` in `src/validators/frontmatter.ts` — all 11 new keys added
- `CheckName` in `src/types/validation.ts` — all 11 new check names added
- `ParsedFrontmatter` in `src/types/validation.ts` — all 11 new field types added
- `ValidationCheckName` in `src/types/api.ts` — all 11 new check names added
- `CHECK_NAMES` in `src/formatters/validate-formatter.ts` — all 11 display names added
- `checkOrder` in `src/formatters/validate-formatter.ts` — all 11 new checks in display order
- `initializeChecks()` in `src/generators/validate.ts` — all 11 new checks initialized
- Frontmatter parser normalization for `tools` and `disallowedTools` fields

### New Shared Utility
- `src/validators/tool-patterns.ts` — shared tool permission pattern validation used by `disallowedTools`, `tools`, and `allowed-tools` validators

## Testing Strategy

### Unit Tests
- **One test file per validator** in `tests/unit/validators/`
- **Coverage goal**: 100% of new validator logic
- **Test matrix per validator**: undefined/null (optional), valid values, invalid types, edge cases per spec
- **Tool pattern tests**: All pattern types from FR-8 (simple, Task(), mcp__*, ${CLAUDE_PLUGIN_ROOT}, Bash variants)

### Integration Tests
- Full pipeline validation with all new fields
- Warning propagation (model → result → formatter)
- Backward compatibility (skills without new fields)
- Mixed old and new fields

## Dependencies and Prerequisites

### Already Satisfied
- FEAT-011 (Frontmatter Enhancements) — complete
- Type infrastructure (`CheckName`, `ParsedFrontmatter`, etc.) — already updated
- Frontmatter parser normalization — already handles `tools` and `disallowedTools`
- Formatter display names and check ordering — already updated

### No New External Dependencies
- All validators use only TypeScript built-in types
- No new npm packages required

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Validator naming collisions (e.g., `tools.ts` vs built-in modules) | Low | Low | Use descriptive names, check imports |
| Model warning not propagating through pipeline | Medium | Low | Follows established hooks warning pattern; integration test verifies |
| Tool pattern regex too strict, rejecting valid patterns | Medium | Medium | Use relaxed validation (non-empty string is valid); Claude Code handles runtime semantics |
| Breaking change in validation output format | High | Low | New fields use same check format; backward compatibility tests confirm |

## Success Criteria

### Per-Phase
- Each phase's deliverables all checked off
- All unit tests pass for new validators
- No regressions in existing tests

### Overall (matches FEAT-014 Acceptance Criteria)
- [x] All 11 new fields accepted and validated per spec
- [x] `allowed-tools` accepts advanced patterns (Task, mcp__*, ${CLAUDE_PLUGIN_ROOT}, Bash colon syntax)
- [x] Model warnings propagated through validation pipeline
- [x] Each new field has its own validator file in `src/validators/`
- [x] Error messages are clear, actionable, and reference specific fields
- [x] All existing tests continue to pass
- [x] New unit tests for each new field
- [x] Integration tests for full validation workflow
- [x] `npm run quality` passes

## Code Organization

```
src/validators/              # New validator files (Phase 1-2)
├── memory.ts                # FR-1: "user" | "project" | "local"
├── skills.ts                # FR-2: string | string[]
├── model.ts                 # FR-3: string with unknown-value warnings
├── permission-mode.ts       # FR-4: non-empty string
├── disallowed-tools.ts      # FR-5: string | string[]
├── argument-hint.ts         # FR-6: non-empty string, max 200 chars
├── keep-coding-instructions.ts  # FR-7: boolean
├── tools.ts                 # FR-10: string | string[]
├── color.ts                 # FR-11: enum of 6 colors
├── disable-model-invocation.ts  # FR-12: boolean
├── version.ts               # FR-13: non-empty string
├── tool-patterns.ts         # Shared: tool permission pattern validation
├── allowed-tools.ts         # FR-8: array of non-empty strings (post-normalization)
└── index.ts                 # Updated barrel exports

src/generators/
└── validate.ts              # Updated orchestrator (Phase 3)

tests/unit/validators/       # New test files (Phase 1-2)
├── memory.test.ts
├── skills.test.ts
├── model.test.ts
├── permission-mode.test.ts
├── disallowed-tools.test.ts
├── argument-hint.test.ts
├── keep-coding-instructions.test.ts
├── tools.test.ts
├── color.test.ts
├── disable-model-invocation.test.ts
├── version.test.ts
├── tool-patterns.test.ts
└── allowed-tools.test.ts

tests/unit/generators/
└── validate.test.ts         # Updated orchestrator tests (Phase 3)

tests/integration/
└── validate-frontmatter-v2.test.ts  # End-to-end tests (Phase 4)
```
