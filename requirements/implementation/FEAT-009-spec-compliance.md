# Implementation Plan: Agent Skills Specification Compliance

## Overview

This plan addresses four specification compliance gaps identified in FEAT-009. The implementation follows a foundation-first approach, establishing shared infrastructure before building individual features. Each phase builds on previous work, ensuring minimal rework and clean integration.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-009 | [#22](https://github.com/lwndev/ai-skills-manager/issues/22) | [FEAT-009-spec-compliance.md](../features/FEAT-009-spec-compliance.md) | High | Medium | Pending |

### Functional Requirements

| FR | Description | Complexity | Dependencies |
|----|-------------|------------|--------------|
| FR-1 | Add `compatibility` field support | Low | Phase 1 types |
| FR-2 | Directory name validation | Low | Phase 1 types |
| FR-3 | File size warnings | Medium | Phase 1 warnings infrastructure |
| FR-4 | Space-delimited `allowed-tools` | Low | None |

## Recommended Build Sequence

### Phase 1: Foundation - Type and Infrastructure Updates
**Feature:** [FEAT-009](../features/FEAT-009-spec-compliance.md) (Infrastructure) | [#22](https://github.com/lwndev/ai-skills-manager/issues/22)
**Status:** ✅ Complete

#### Rationale
- **Foundation first**: All subsequent phases depend on updated types
- **Single breaking change**: Update types once rather than incrementally
- **Enables warnings**: FR-3 requires `warnings` array in ValidationResult
- **Enables new checks**: FR-1 and FR-2 require new CheckName values

#### Implementation Steps
1. Update `src/types/validation.ts`:
   - Add `'compatibilityFormat'` and `'nameMatchesDirectory'` to `CheckName` type
   - Add `warnings?: string[]` to `ValidationResult` interface
   - Add `compatibility?: string` to `ParsedFrontmatter` interface
   - Update `'allowed-tools'` type to `string | string[]` for FR-4 support
2. Update `src/generators/validate.ts`:
   - Add new checks to `initializeChecks()` function
   - Initialize `warnings: []` in `buildResult()` function
3. Update `src/formatters/validate-formatter.ts`:
   - Add display names for new checks in `CHECK_NAMES` record
   - Add new checks to `checkOrder` array
4. Update unit tests to handle new type structure

#### Deliverables
- [x] `src/types/validation.ts` - Updated type definitions
- [x] `src/generators/validate.ts` - Extended check initialization
- [x] `src/formatters/validate-formatter.ts` - New check display names
- [x] `tests/unit/generators/validate.test.ts` - Updated for new checks

---

### Phase 2: Compatibility Field Support (FR-1)
**Feature:** [FEAT-009](../features/FEAT-009-spec-compliance.md) (FR-1) | [#22](https://github.com/lwndev/ai-skills-manager/issues/22)
**Status:** ✅ Complete

#### Rationale
- **Critical bug fix**: Valid skills currently fail validation
- **Simplest change**: Just add to allowed keys and add validator
- **Builds on Phase 1**: Uses new `compatibilityFormat` check name
- **Immediate value**: Unblocks users with compatibility field

#### Implementation Steps
1. Update `src/validators/frontmatter.ts`:
   - Add `'compatibility'` to `ALLOWED_KEYS` set
2. Create `src/validators/compatibility.ts`:
   - Validate string type
   - Validate length 1-500 characters when present
   - Return success if field is absent (optional field)
3. Integrate into `src/generators/validate.ts`:
   - Import compatibility validator
   - Add validation step after description format check
   - Only validate if compatibility field exists
4. Write unit tests for compatibility validator
5. Write integration tests for full validation with compatibility field

#### Deliverables
- [x] `src/validators/frontmatter.ts` - Add compatibility to ALLOWED_KEYS
- [x] `src/validators/compatibility.ts` - New compatibility validator
- [x] `src/generators/validate.ts` - Integrate compatibility validation
- [x] `tests/unit/validators/compatibility.test.ts` - Unit tests
- [x] `tests/integration/validate.test.ts` - Integration tests with compatibility

---

### Phase 3: Directory Name Validation (FR-2)
**Feature:** [FEAT-009](../features/FEAT-009-spec-compliance.md) (FR-2) | [#22](https://github.com/lwndev/ai-skills-manager/issues/22)
**Status:** ✅ Complete

#### Rationale
- **Spec requirement**: "Must match the parent directory name"
- **Uses existing utility**: `getSkillName()` already extracts directory name
- **Builds on Phase 1**: Uses new `nameMatchesDirectory` check name
- **High value**: Catches common misconfiguration errors

#### Implementation Steps
1. Create `src/validators/directory-name.ts`:
   - Accept skill directory path and frontmatter name
   - Compare `path.basename(skillDir)` with frontmatter name
   - Handle edge case: skill at root directory (`.`)
   - Return clear error message with both values on mismatch
2. Update `src/generators/validate.ts`:
   - Track resolved skill directory path (from file-exists validator)
   - Add directory name validation step after name format check
   - Pass skillDir to the validator
3. Update `src/validators/file-exists.ts` (if needed):
   - Ensure it returns the skill directory path, not just file path
4. Write unit tests for directory name validator
5. Write integration tests for directory mismatch scenarios

#### Deliverables
- [x] `src/validators/directory-name.ts` - New directory name validator
- [x] `src/generators/validate.ts` - Integrate directory name validation
- [x] `tests/unit/validators/directory-name.test.ts` - Unit tests
- [x] `tests/integration/validate.test.ts` - Integration tests

---

### Phase 4: Space-Delimited allowed-tools Support (FR-4)
**Feature:** [FEAT-009](../features/FEAT-009-spec-compliance.md) (FR-4) | [#22](https://github.com/lwndev/ai-skills-manager/issues/22)
**Status:** ✅ Complete

#### Rationale
- **Spec compliance**: Spec example uses space-delimited format
- **Backward compatible**: Continues to support array format
- **Parser-level fix**: Normalize format during parsing
- **Enables both formats**: Users can choose preferred style

#### Implementation Steps
1. Update `src/utils/frontmatter-parser.ts`:
   - After YAML parsing, check type of `allowed-tools`
   - If string: split on whitespace, trim each value, filter empty
   - If array: use as-is
   - Normalize to array format for consistent downstream handling
2. Create or update `src/validators/allowed-tools.ts`:
   - Validate normalized array format
   - Ensure each tool string is non-empty
   - Return success for empty array (valid - no tools)
3. Update type annotations to reflect normalized format:
   - Input can be `string | string[]`
   - Output (ParsedFrontmatter) is always `string[]`
4. Write unit tests for both input formats
5. Write integration tests validating both formats work

#### Deliverables
- [x] `src/utils/frontmatter-parser.ts` - Normalize allowed-tools format
- [x] `tests/unit/utils/frontmatter-parser.test.ts` - 10 parsing tests for space-delimited allowed-tools
- [x] `tests/integration/validate.test.ts` - Integration tests

Note: Separate `allowed-tools.ts` validator not needed - normalization at parse time is sufficient.

---

### Phase 5: File Size Warnings (FR-3)
**Feature:** [FEAT-009](../features/FEAT-009-spec-compliance.md) (FR-3) | [#22](https://github.com/lwndev/ai-skills-manager/issues/22)
**Status:** ✅ Complete

#### Rationale
- **Last phase**: Most complex, requires warnings infrastructure from Phase 1
- **Non-blocking**: Warnings don't fail validation (exit code 0)
- **Helpful guidance**: Alerts users to potential context issues
- **Spec recommendation**: "< 5000 tokens", "under 500 lines"

#### Implementation Steps
1. Create `src/analyzers/file-size.ts`:
   - Accept SKILL.md content (body after frontmatter)
   - Count lines in body content
   - Estimate tokens (heuristic: ~4 characters per token)
   - Return warnings array (may be empty)
   - Warning thresholds: >500 lines, >5000 estimated tokens
2. Update `src/generators/validate.ts`:
   - Import file size analyzer
   - Extract body content from parsed frontmatter result
   - Run analyzer and collect warnings
   - Include warnings in final result
3. Update `src/formatters/validate-formatter.ts`:
   - Add warnings section between checks and final status
   - Use warning indicator (e.g., `⚠`) for warnings
   - Only show warnings section if warnings exist
4. Update `src/utils/frontmatter-parser.ts` (if needed):
   - Ensure body content is available in parse result
   - Add `body?: string` to FrontmatterParseResult if not present
5. Write unit tests for file size analyzer
6. Write integration tests for warning display

#### Deliverables
- [x] `src/analyzers/file-size.ts` - New file size analyzer
- [x] `src/generators/validate.ts` - Integrate warnings collection
- [x] `src/formatters/validate-formatter.ts` - Display warnings
- [x] `src/utils/frontmatter-parser.ts` - Include body content in result
- [x] `src/types/validation.ts` - Added body field to FrontmatterParseResult
- [x] `tests/unit/analyzers/file-size.test.ts` - 20 unit tests
- [x] `tests/integration/validate.test.ts` - 3 integration tests

---

## Shared Infrastructure

### Type Updates (Phase 1)
```typescript
// src/types/validation.ts additions
export type CheckName =
  | 'fileExists'
  | 'frontmatterValid'
  | 'requiredFields'
  | 'allowedProperties'
  | 'nameFormat'
  | 'descriptionFormat'
  | 'compatibilityFormat'    // NEW
  | 'nameMatchesDirectory';  // NEW

export interface ValidationResult {
  valid: boolean;
  skillPath: string;
  skillName?: string;
  checks: Record<CheckName, { passed: boolean; error?: string }>;
  errors: string[];
  warnings?: string[];  // NEW
}

export interface ParsedFrontmatter {
  name?: string;
  description?: string;
  license?: string;
  compatibility?: string;           // NEW
  'allowed-tools'?: string[];       // Normalized to array
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}
```

### Validator Pattern
All validators follow the existing pattern:
```typescript
import { ValidationResult } from './name';

export function validateX(input: T): ValidationResult {
  // Validation logic
  if (invalid) {
    return { valid: false, error: 'Descriptive error message' };
  }
  return { valid: true };
}
```

---

## Testing Strategy

### Unit Testing
- **Coverage goal:** >80% for all new code
- **Test framework:** Jest (existing)
- **Focus areas:**
  - Each validator in isolation
  - Edge cases per FR requirements doc
  - Frontmatter parser normalization
  - File size estimation accuracy

### Integration Testing
- **Key scenarios:**
  - Valid skill with all optional fields
  - Invalid skill with each type of error
  - Skill with warnings but no errors
  - JSON output includes warnings
  - Exit codes: 0 for valid/warnings, 1 for errors

### Test Cases from Requirements

**FR-1: Compatibility field**
- Valid compatibility field (1-500 chars) - pass
- Empty compatibility field - error
- Compatibility exceeding 500 chars - error
- Missing compatibility - pass (optional)

**FR-2: Directory name validation**
- Name matches directory - pass
- Name differs from directory - error
- Various path depths
- Path with trailing slash

**FR-3: File size warnings**
- SKILL.md < 500 lines - no warning
- SKILL.md = 500 lines - no warning
- SKILL.md > 500 lines - warning
- Estimated < 5000 tokens - no warning
- Estimated > 5000 tokens - warning

**FR-4: allowed-tools format**
- Space-delimited string - valid
- Array format - valid
- Empty string - valid
- Empty array - valid
- Tools with special characters

---

## Dependencies and Prerequisites

### External Dependencies
- None new required

### Internal Dependencies
- Existing validation infrastructure in `src/validators/`
- Existing frontmatter parser in `src/utils/`
- Node.js `path` module (already used)

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Type changes break existing code | High | Medium | Run full test suite after Phase 1, fix all type errors before proceeding |
| Warnings cause CI failures | Medium | Low | Ensure exit code remains 0 when only warnings present |
| Token estimation inaccurate | Low | Medium | Use conservative heuristic (~4 chars/token), document as estimate |
| Root directory edge case | Low | Low | Handle `.` directory name gracefully, possibly skip validation |
| Backward compatibility break | High | Low | Maintain array support for allowed-tools, all existing valid skills should pass |

---

## Success Criteria

### Per-Phase Criteria
Each phase must meet:
- All functional requirements from FEAT-009 for that FR
- >80% test coverage for new code
- All existing tests continue to pass
- No regressions in existing validation behavior

### Overall Project Success
- [ ] `compatibility` field accepted as valid frontmatter property
- [ ] `compatibility` field validation enforces 1-500 character limit
- [ ] Skill name validated against parent directory name
- [ ] Clear error message when name doesn't match directory
- [ ] Warning issued for SKILL.md exceeding 500 lines
- [ ] Warning issued for SKILL.md exceeding ~5000 tokens
- [ ] Warnings do not cause validation failure (exit code 0)
- [ ] Space-delimited `allowed-tools` format supported
- [ ] Array `allowed-tools` format continues to work
- [ ] JSON output includes warnings array
- [ ] All existing tests pass
- [ ] New tests achieve >80% coverage

---

## Code Organization

### New Files
```
src/
├── analyzers/
│   └── file-size.ts           # Phase 5 - File size analysis
├── validators/
│   ├── compatibility.ts       # Phase 2 - Compatibility validator
│   ├── directory-name.ts      # Phase 3 - Directory name validator
│   └── allowed-tools.ts       # Phase 4 - Optional tools validator
└── types/
    └── validation.ts          # Phase 1 - Updated types

tests/
├── unit/
│   ├── analyzers/
│   │   └── file-size.test.ts
│   └── validators/
│       ├── compatibility.test.ts
│       ├── directory-name.test.ts
│       └── allowed-tools.test.ts
└── integration/
    └── validate.test.ts       # Extended with new scenarios
```

### Modified Files
```
src/
├── generators/validate.ts              # All phases - orchestration
├── formatters/validate-formatter.ts    # Phase 1, 5 - output formatting
├── utils/frontmatter-parser.ts         # Phase 4, 5 - normalization
└── validators/frontmatter.ts           # Phase 2 - ALLOWED_KEYS
```
