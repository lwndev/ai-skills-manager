# Implementation Plan: Frontmatter Enhancements for Claude Code 2.1.x

## Overview

This plan covers adding support for new Claude Code 2.1.x frontmatter fields (`context`, `agent`, `hooks`, `user-invocable`) and YAML list format for `allowed-tools`. The implementation follows established codebase patterns for validation, using discriminated unions and the existing validator architecture.

The work is organized into three phases: type system updates, field validators, and integration with the validation pipeline. This sequencing ensures type safety throughout development and maintains backward compatibility.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-011 | [#33](https://github.com/lwndev/ai-skills-manager/issues/33), [#35](https://github.com/lwndev/ai-skills-manager/issues/35) | [FEAT-011-frontmatter-enhancements.md](../features/FEAT-011-frontmatter-enhancements.md) | High | Medium | Pending |

## Recommended Build Sequence

### Phase 1: Type System and Infrastructure Updates
**Feature:** [FEAT-011](../features/FEAT-011-frontmatter-enhancements.md) | [#33](https://github.com/lwndev/ai-skills-manager/issues/33)
**Status:** ✅ Complete

#### Rationale
- Type definitions must be updated first to enable type-safe development of validators
- `ALLOWED_KEYS` must be updated before validators can accept new fields
- Establishes the foundation for all subsequent phases

#### Implementation Steps
1. Update `ParsedFrontmatter` interface in `src/types/validation.ts`:
   - Add `context?: 'fork'`
   - Add `agent?: string`
   - Add `hooks?: { PreToolUse?: string | string[]; PostToolUse?: string | string[]; Stop?: string | string[]; [key: string]: string | string[] | undefined; }`
   - Add `'user-invocable'?: boolean`

2. Update `ALLOWED_KEYS` set in `src/validators/frontmatter.ts`:
   - Add `'context'`
   - Add `'agent'`
   - Add `'hooks'`
   - Add `'user-invocable'`

3. Update `allowed-tools` normalization in `src/utils/frontmatter-parser.ts`:
   - Handle `null` value (treat as undefined)
   - Verify YAML array format is already handled (existing code supports arrays)
   - Add test coverage for YAML list format edge cases

4. Write unit tests for type updates:
   - Verify new keys pass `ALLOWED_KEYS` check
   - Verify old keys still pass
   - Verify unknown keys still fail
   - Test `allowed-tools` with YAML list format, empty array, null

#### Deliverables
- [x] `src/types/validation.ts` - Updated `ParsedFrontmatter` interface
- [x] `src/validators/frontmatter.ts` - Updated `ALLOWED_KEYS` set
- [x] `src/utils/frontmatter-parser.ts` - Handle `allowed-tools: null` case
- [x] `tests/unit/validators/frontmatter.test.ts` - Tests for new allowed keys
- [x] `tests/unit/utils/frontmatter-parser.test.ts` - Tests for YAML list format

---

### Phase 2: Field Validators
**Feature:** [FEAT-011](../features/FEAT-011-frontmatter-enhancements.md) | [#33](https://github.com/lwndev/ai-skills-manager/issues/33)
**Status:** ✅ Complete

#### Rationale
- With types in place, validators can be implemented with full type safety
- Each validator follows established patterns from `description.ts` and `compatibility.ts`
- Validators are independent and can be developed/tested in isolation

#### Implementation Steps

1. Create `src/validators/context.ts`:
   - Export `validateContext(value: unknown): ValidationResult`
   - If undefined/null, return valid (field is optional)
   - If present, must be exactly the string `"fork"`
   - Error message: `Field 'context' must be "fork" if specified, got "[value]".`

2. Create `src/validators/agent.ts`:
   - Export `validateAgent(value: unknown): ValidationResult`
   - If undefined/null, return valid (field is optional)
   - If present, must be a non-empty string
   - Error message: `Field 'agent' must be a non-empty string if specified.`

3. Create `src/validators/hooks.ts`:
   - Export `validateHooks(value: unknown): HooksValidationResult`
   - Return type includes `warnings?: string[]` for unknown hook keys
   - If undefined/null, return valid (field is optional)
   - If present, must be an object (not array, not primitive)
   - Allowed keys: `PreToolUse`, `PostToolUse`, `Stop`
   - Each value must be string or array of strings
   - Unknown keys generate warnings, not errors
   - Error message: `Field 'hooks' must be an object if specified.`
   - Warning message: `Unknown hook '[key]' in hooks field. Known hooks: PreToolUse, PostToolUse, Stop`

4. Create `src/validators/user-invocable.ts`:
   - Export `validateUserInvocable(value: unknown): ValidationResult`
   - If undefined/null, return valid (field is optional)
   - If present, must be a boolean (not string "true"/"false")
   - Error message: `Field 'user-invocable' must be a boolean (true or false), got "[typeof value]".`

5. Write unit tests for each validator:
   - Valid cases: correct types, undefined, null
   - Invalid cases: wrong types, empty strings, string booleans
   - Edge cases: empty hooks object (valid), unknown hook keys (warning)
   - Error message content verification

#### Deliverables
- [x] `src/validators/context.ts` - Context field validator
- [x] `src/validators/agent.ts` - Agent field validator
- [x] `src/validators/hooks.ts` - Hooks field validator with warning support
- [x] `src/validators/user-invocable.ts` - User-invocable field validator
- [x] `tests/unit/validators/context.test.ts` - Context validator tests
- [x] `tests/unit/validators/agent.test.ts` - Agent validator tests
- [x] `tests/unit/validators/hooks.test.ts` - Hooks validator tests
- [x] `tests/unit/validators/user-invocable.test.ts` - User-invocable validator tests

---

### Phase 3: Validation Pipeline Integration
**Feature:** [FEAT-011](../features/FEAT-011-frontmatter-enhancements.md) | [#33](https://github.com/lwndev/ai-skills-manager/issues/33), [#35](https://github.com/lwndev/ai-skills-manager/issues/35)
**Status:** Pending

#### Rationale
- Validators are complete and tested, ready for integration
- Integration connects validators to the validation flow in `validate.ts`
- Final phase ensures end-to-end functionality

#### Implementation Steps

1. Update `src/generators/validate.ts`:
   - Import new validators
   - Add validation calls for `context`, `agent`, `hooks`, `user-invocable` fields
   - Collect warnings from hooks validator and add to `ValidationResult.warnings`
   - Follow existing pattern: only validate format if field exists

2. Update check initialization if needed:
   - Decide whether new field validations are individual checks or part of existing checks
   - Recommendation: Add as part of "Field format valid" check (existing pattern)

3. Write integration tests:
   - Full validation with all new fields present and valid
   - Full validation with subset of new fields
   - Full validation with no new fields (backward compatibility)
   - Validation failure for each invalid field type
   - Warning output for unknown hook keys

4. Run `npm run quality` to verify all tests pass and no regressions

#### Deliverables
- [ ] `src/generators/validate.ts` - Integrated new validators
- [ ] `tests/generators/validate.test.ts` - Integration tests for new fields
- [ ] All existing tests continue to pass
- [ ] `npm run quality` passes

---

## Shared Infrastructure

### Existing Patterns to Leverage
- **Discriminated unions**: All validators return `{ valid: true } | { valid: false; error: string }`
- **Optional field handling**: Check for undefined/null before validating
- **Error message format**: Include field name, expected value, and actual value
- **Warning collection**: `ValidationResult.warnings` array for non-blocking issues

### New Infrastructure
- **HooksValidationResult type**: Extends ValidationResult with optional warnings array for hook validation

```typescript
export type HooksValidationResult =
  | { valid: true; warnings?: string[] }
  | { valid: false; error: string };
```

## Testing Strategy

### Unit Tests
- Each new validator has dedicated test file
- Test valid values, invalid values, edge cases
- Verify error messages contain expected content
- Test undefined/null handling for optional fields

### Integration Tests
- Full skill validation with new fields
- Backward compatibility with existing skills
- Warning propagation to final output

### Manual Testing
- Validate skills from Claude Code 2.1.x examples (if available)
- Create test skill with all new fields
- Verify CLI output format matches requirements

## Dependencies and Prerequisites

### External Dependencies
- None - uses existing `js-yaml` for parsing

### Internal Dependencies
- Phase 2 depends on Phase 1 (types must exist)
- Phase 3 depends on Phase 2 (validators must exist)

### Existing Code Requirements
- `src/types/validation.ts` - Existing type definitions
- `src/validators/frontmatter.ts` - ALLOWED_KEYS set
- `src/utils/frontmatter-parser.ts` - Frontmatter normalization
- `src/generators/validate.ts` - Validation pipeline

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking backward compatibility | High | Low | Comprehensive tests for existing skills, optional field handling |
| Incorrect YAML list parsing | Medium | Low | Existing array handling in parser already works; add tests to verify |
| Hook validation too strict | Medium | Medium | Use warnings for unknown keys, not errors (future-proofing) |
| Type definition conflicts | Low | Low | Follow existing patterns, use TypeScript strict mode |

## Success Criteria

### Per-Feature Criteria (from Requirements)
- [ ] `context` field accepted and validated (must be "fork" if present)
- [ ] `agent` field accepted and validated (non-empty string)
- [ ] `hooks` field accepted and validated (object with known hook keys)
- [ ] `user-invocable` field accepted and validated (boolean)
- [ ] Unknown hook keys produce warnings, not errors
- [ ] YAML list format for `allowed-tools` is parsed correctly
- [ ] Inline format for `allowed-tools` continues to work
- [ ] `ParsedFrontmatter` type updated with new fields
- [ ] `ALLOWED_KEYS` set updated in frontmatter validator
- [ ] Error messages are clear and actionable
- [ ] All existing tests continue to pass
- [ ] New unit tests for each new field
- [ ] Integration tests for full validation workflow

### Overall Success
- `npm run quality` passes
- No breaking changes to existing validation behavior
- New fields validate according to Claude Code 2.1.x specification

## Code Organization

```
src/
├── types/
│   └── validation.ts        # Updated ParsedFrontmatter interface
├── validators/
│   ├── frontmatter.ts       # Updated ALLOWED_KEYS
│   ├── context.ts           # NEW: Context validator
│   ├── agent.ts             # NEW: Agent validator
│   ├── hooks.ts             # NEW: Hooks validator
│   └── user-invocable.ts    # NEW: User-invocable validator
├── utils/
│   └── frontmatter-parser.ts # Updated allowed-tools handling
└── generators/
    └── validate.ts          # Integrated new validators

tests/
├── validators/
│   ├── context.test.ts      # NEW
│   ├── agent.test.ts        # NEW
│   ├── hooks.test.ts        # NEW
│   └── user-invocable.test.ts # NEW
├── utils/
│   └── frontmatter-parser.test.ts # Additional tests
└── generators/
    └── validate.test.ts     # Integration tests
```
