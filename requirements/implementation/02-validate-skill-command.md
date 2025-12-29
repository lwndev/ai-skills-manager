# Implementation Plan: Validate Skill Command

## Overview

This implementation plan covers the `validate` command for AI Skills Manager (ASM), which validates Claude Skill structure and metadata against the official Anthropic specification. The command provides detailed validation feedback with multiple output formats for both interactive and CI/CD use cases.

The existing codebase already includes validators for name, description, and frontmatter keys from the scaffold command implementation. This plan focuses on building the YAML parsing infrastructure, validation orchestration, and CLI integration.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-002   | [#2](https://github.com/lwndev/ai-skills-manager/issues/2) | [02-validate-skill-command.md](../features/02-validate-skill-command.md) | High | Medium | Complete |

## Recommended Build Sequence

### Phase 1: YAML Parsing Infrastructure
**Feature:** [FEAT-002](../features/02-validate-skill-command.md) | [#2](https://github.com/lwndev/ai-skills-manager/issues/2)
**Status:** ✅ Complete

#### Rationale
- **Foundation first**: YAML frontmatter parsing is required by all other validation steps
- **New dependency**: Need to add `js-yaml` package for robust YAML parsing
- **Establishes types**: Define interfaces for validation results that all validators will use
- **Reusable utility**: Frontmatter parser can be used by future features

#### Implementation Steps
1. Add `js-yaml` and `@types/js-yaml` as dependencies
2. Create `src/utils/frontmatter-parser.ts` with:
   - `parseFrontmatter(content: string)` - Extract and parse YAML frontmatter from SKILL.md content
   - Handle missing opening delimiter
   - Handle missing closing delimiter
   - Handle invalid YAML syntax with descriptive errors
   - Handle empty frontmatter
3. Create `src/types/validation.ts` with:
   - `ValidationCheck` interface for individual check results
   - `ValidationResult` interface for overall validation result
   - `CheckName` type for the six validation checks
4. Write comprehensive unit tests for frontmatter parser

#### Deliverables
- [x] `package.json` - Updated with js-yaml dependency
- [x] `src/utils/frontmatter-parser.ts` - Frontmatter extraction and parsing
- [x] `src/types/validation.ts` - Validation result type definitions
- [x] `tests/unit/utils/frontmatter-parser.test.ts` - Parser unit tests

---

### Phase 2: Validation Engine
**Feature:** [FEAT-002](../features/02-validate-skill-command.md) | [#2](https://github.com/lwndev/ai-skills-manager/issues/2)
**Status:** ✅ Complete

#### Rationale
- **Core functionality**: Orchestrates all validation checks in correct order
- **Leverages existing code**: Reuses `validateName`, `validateDescription`, and `validateFrontmatterKeys` from scaffold implementation
- **Collects all errors**: Must report all validation failures, not just the first one
- **Structured output**: Returns data suitable for all output formats (normal, quiet, JSON)

#### Implementation Steps
1. Create `src/validators/file-exists.ts`:
   - Validate that path exists
   - Validate that SKILL.md exists in directory
   - Handle file path pointing directly to SKILL.md
   - Return appropriate errors for missing files
2. Create `src/validators/required-fields.ts`:
   - Validate `name` field is present and non-empty
   - Validate `description` field is present and non-empty
   - Return specific errors for each missing field
3. Create `src/generators/validate.ts` - Main validation orchestrator:
   - Accept skill path as input
   - Resolve path (handle file vs directory)
   - Execute checks in order:
     1. File existence check
     2. Frontmatter validity check
     3. Required fields check
     4. Allowed properties check (using existing validator)
     5. Name format check (using existing validator)
     6. Description format check (using existing validator)
   - Collect all check results
   - Return structured `ValidationResult`
4. Write unit tests for each new validator
5. Write unit tests for validation orchestrator

#### Deliverables
- [x] `src/validators/file-exists.ts` - File/directory existence validation
- [x] `src/validators/required-fields.ts` - Required fields validation
- [x] `src/generators/validate.ts` - Validation orchestration
- [x] `tests/unit/validators/file-exists.test.ts` - File existence tests
- [x] `tests/unit/validators/required-fields.test.ts` - Required fields tests
- [x] `tests/unit/generators/validate.test.ts` - Orchestrator tests

---

### Phase 3: Command Integration & Output Formatting
**Feature:** [FEAT-002](../features/02-validate-skill-command.md) | [#2](https://github.com/lwndev/ai-skills-manager/issues/2)
**Status:** ✅ Complete

#### Rationale
- **User-facing feature**: This phase creates the actual CLI command users interact with
- **Multiple output modes**: Must support normal, quiet, and JSON output formats
- **Consistent patterns**: Follows the established command pattern from scaffold
- **Exit codes**: Must return correct exit codes for scripting/CI use

#### Implementation Steps
1. Create `src/formatters/validate-formatter.ts`:
   - `formatNormal(result: ValidationResult)` - Verbose check-by-check output
   - `formatQuiet(result: ValidationResult)` - Single line pass/fail output
   - `formatJSON(result: ValidationResult)` - Structured JSON output
   - Use existing output utilities (success, error from `utils/output.ts`)
2. Create `src/commands/validate.ts`:
   - Define `ValidateOptions` interface (`quiet`, `json`)
   - Implement `registerValidateCommand(program: Command)`
   - Add command with `<skill-path>` required argument
   - Add `--quiet` and `--json` options
   - Add help text with usage examples
   - Implement handler that:
     - Calls validation generator
     - Formats output based on options
     - Sets exit code based on validation result
3. Update `src/cli.ts`:
   - Import and register validate command
4. Write integration tests for full command workflow

#### Deliverables
- [x] `src/formatters/validate-formatter.ts` - Output formatting for all modes
- [x] `src/commands/validate.ts` - CLI command implementation
- [x] `src/cli.ts` - Updated to register validate command
- [x] `tests/unit/formatters/validate-formatter.test.ts` - Formatter unit tests
- [x] `tests/integration/validate.test.ts` - Full CLI integration tests

---

### Phase 4: Edge Cases & Documentation
**Feature:** [FEAT-002](../features/02-validate-skill-command.md) | [#2](https://github.com/lwndev/ai-skills-manager/issues/2)
**Status:** ✅ Complete

#### Rationale
- **Robustness**: Handle all edge cases specified in requirements
- **Error quality**: Ensure all error messages are actionable with examples
- **Documentation**: Update README and help text
- **Polish**: Final testing and refinement

#### Implementation Steps
1. Implement edge case handling:
   - Empty path argument (show usage help)
   - Path is SKILL.md file (use parent directory)
   - Empty SKILL.md file
   - SKILL.md has no frontmatter
   - Frontmatter has no closing delimiter
   - Empty name/description strings
   - Name/description exceeding max length
   - Permission denied errors
   - Non-UTF8 encoding handling
2. Enhance error messages:
   - Include invalid values in error messages
   - Add examples of valid values
   - Reference documentation where helpful
3. Add comprehensive test coverage for edge cases
4. Update README.md with:
   - Validate command documentation
   - Usage examples
   - Output format examples
5. Verify all acceptance criteria from requirements

#### Deliverables
- [x] Enhanced error handling in validation chain
- [x] `tests/unit/edge-cases/validate.test.ts` - Edge case tests
- [x] `README.md` - Updated with validate command documentation
- [x] All acceptance criteria verified and passing

---

## Shared Infrastructure

### Existing Utilities (Reuse)
These are already implemented and will be reused:

1. **Name Validator** (`src/validators/name.ts`)
   - Validates hyphen-case format
   - Checks max length (64 chars)
   - Rejects reserved words

2. **Description Validator** (`src/validators/description.ts`)
   - Validates non-empty
   - Checks max length (1024 chars)
   - Rejects angle brackets

3. **Frontmatter Keys Validator** (`src/validators/frontmatter.ts`)
   - Validates allowed top-level keys only
   - Permits: name, description, license, allowed-tools, metadata

4. **Output Utilities** (`src/utils/output.ts`)
   - `success()`, `error()`, `warning()`, `info()`
   - `displayError()`, `displayValidationError()`

5. **Error Classes** (`src/utils/errors.ts`)
   - `ValidationError`, `FileSystemError`

### New Utilities (Create)

1. **Frontmatter Parser** (`src/utils/frontmatter-parser.ts`)
   - Extract frontmatter from markdown
   - Parse YAML with error handling
   - Developed in: Phase 1

2. **Validation Types** (`src/types/validation.ts`)
   - `ValidationCheck`, `ValidationResult` interfaces
   - Developed in: Phase 1

---

## Testing Strategy

### Unit Testing
- **Coverage goal:** >80% for all new code
- **Test framework:** Jest (existing)
- **Focus areas:**
  - YAML frontmatter parsing (valid, invalid, edge cases)
  - File existence validation
  - Required fields validation
  - Validation orchestration
  - Output formatting (normal, quiet, JSON)

### Integration Testing
- **Key scenarios:**
  - Valid skill validation (all checks pass)
  - Invalid skill with single error
  - Invalid skill with multiple errors
  - Each output format (normal, quiet, JSON)
  - Exit code verification (0 for valid, 1 for invalid)
  - Path handling (directory, file, relative, absolute)

### Manual Testing
- Validate skills created by `asm scaffold`
- Validate skills from official Anthropic skills repository
- Test in CI/CD pipeline context
- Verify error message quality and actionability

---

## Dependencies and Prerequisites

### External Dependencies
- **Existing:** Commander.js, TypeScript, Jest
- **New:** `js-yaml` (YAML parsing), `@types/js-yaml` (TypeScript types)

### Internal Dependencies
- Existing validators from scaffold implementation
- Existing error classes and output utilities

### Prerequisites
- Scaffold command implementation complete
- Existing test infrastructure working

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| YAML parsing edge cases | Medium | Medium | Use battle-tested js-yaml library, extensive edge case tests |
| File encoding issues | Low | Low | Use Node.js fs with utf-8 encoding, catch encoding errors |
| Path resolution cross-platform | Medium | Low | Use Node.js path module for all path operations |
| Performance on large files | Low | Low | SKILL.md files are typically small; add size check if needed |
| Breaking changes to existing validators | Medium | Low | Validators are well-tested; ensure backwards compatibility |

---

## Success Criteria

### Per-Phase Criteria

**Phase 1:**
- [x] js-yaml installed and working
- [x] Frontmatter parser handles all valid/invalid cases
- [x] Type definitions complete and exported
- [x] Unit tests pass with >80% coverage

**Phase 2:**
- [x] All six validation checks implemented
- [x] Validation collects all errors (not just first)
- [x] Existing validators integrated correctly
- [x] Unit tests pass with >80% coverage

**Phase 3:**
- [x] Command registered and accessible via `asm validate`
- [x] All three output formats working correctly
- [x] Exit codes correct (0 valid, 1 invalid)
- [x] Integration tests pass

**Phase 4:**
- [x] All edge cases from requirements handled
- [x] Error messages are actionable with examples
- [x] Documentation updated
- [x] All acceptance criteria verified

### Overall Success Criteria
From requirements document:
- [x] Command accepts skill path argument
- [x] SKILL.md existence is validated
- [x] YAML frontmatter structure is validated
- [x] Required fields (name, description) are validated
- [x] Unknown top-level properties are rejected
- [x] Name format validation matches spec (hyphen-case, max 64 chars)
- [x] Description validation matches spec (no angle brackets, max 1024 chars)
- [x] Exit code 0 for valid skills
- [x] Exit code 1 for invalid skills
- [x] `--quiet` flag produces minimal output
- [x] `--json` flag produces valid JSON output
- [x] Error messages are clear and actionable
- [x] All edge cases are handled
- [x] Tests pass with >80% coverage (93.64% achieved)
- [x] Documentation updated

---

## Code Organization

### New Files

```
src/
├── commands/
│   └── validate.ts           # Phase 3: CLI command
├── formatters/
│   └── validate-formatter.ts # Phase 3: Output formatting
├── generators/
│   └── validate.ts           # Phase 2: Validation orchestration
├── types/
│   └── validation.ts         # Phase 1: Type definitions
├── utils/
│   └── frontmatter-parser.ts # Phase 1: YAML parsing
└── validators/
    ├── file-exists.ts        # Phase 2: File existence check
    └── required-fields.ts    # Phase 2: Required fields check

tests/
├── unit/
│   ├── formatters/
│   │   └── validate-formatter.test.ts
│   ├── generators/
│   │   └── validate.test.ts
│   ├── utils/
│   │   └── frontmatter-parser.test.ts
│   └── validators/
│       ├── file-exists.test.ts
│       └── required-fields.test.ts
├── integration/
│   └── validate.test.ts
└── fixtures/
    └── skills/               # Test fixtures for validation
        ├── valid-skill/
        ├── missing-name/
        ├── invalid-yaml/
        └── ...
```

### Files to Modify

- `src/cli.ts` - Register validate command
- `package.json` - Add js-yaml dependency
- `README.md` - Add validate command documentation

---

## Development Guidelines

### Code Style
- Follow existing patterns from scaffold command
- Use TypeScript strict mode
- Maintain consistent error handling patterns
- Keep functions small and focused

### Commit Strategy
- One phase per branch (or smaller logical units)
- Frequent, small commits
- Reference issue #2 in commit messages
- Example: `feat(validate): add frontmatter parser (#2)`

### Testing Approach
- Write tests alongside implementation
- Test edge cases thoroughly
- Use fixtures for test skills
- Verify integration after each phase
