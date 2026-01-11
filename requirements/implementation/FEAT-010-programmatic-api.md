# Implementation Plan: Programmatic API

## Overview

This plan outlines the implementation of FEAT-010, which adds a programmatic API layer to ai-skills-manager. The goal is to expose all CLI functionality as importable Node.js functions, enabling GUI applications (ASM-UI) and third-party integrations to use the same validated logic as the CLI without code duplication.

The current codebase already has good separation between commands, generators, validators, and formatters. This refactor will formalize that separation by creating a public API layer that wraps the existing generator logic, while refactoring CLI commands to become thin wrappers around the API.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-010 | [#24](https://github.com/lwndev/ai-skills-manager/issues/24) | [FEAT-010-programmatic-api.md](../features/FEAT-010-programmatic-api.md) | High | High | Pending |

## Recommended Build Sequence

### Phase 1: Error Classes and Type Foundations
**Feature:** [FEAT-010](../features/FEAT-010-programmatic-api.md) | [#24](https://github.com/lwndev/ai-skills-manager/issues/24)
**Status:** ✅ Complete

#### Rationale
- **Foundation first**: Error classes and types are imported by all other code
- **No breaking changes**: Adding new exports is purely additive
- **Enables testing**: Types allow writing tests before implementation
- **Low risk**: Minimal changes to existing code paths

#### Implementation Steps
1. Review existing error classes in `src/utils/errors.ts`
2. Create `src/errors.ts` with the public error class hierarchy:
   - `AsmError` base class with `code` property
   - `ValidationError` extending AsmError with `issues` array
   - `FileSystemError` with `path` property
   - `PackageError` for packaging failures
   - `SecurityError` for security violations
   - `CancellationError` for AbortSignal cancellations
3. Create `src/types/api.ts` with all public API types:
   - Options interfaces: `ScaffoldOptions`, `PackageOptions`, `InstallOptions`, `UpdateOptions`, `UninstallOptions`, `ListOptions`
   - Result interfaces: `ScaffoldResult`, `ValidateResult`, `PackageResult`, `InstallResult`, `UpdateResult`, `UninstallResult`
   - Detail interfaces: `ValidationIssue`, `ValidationWarning`, `InstalledSkill`
4. Export types from `src/types/index.ts`
5. Write unit tests for error class behavior (instanceof checks, code values)
6. Ensure existing `src/utils/errors.ts` internal errors remain separate from public API errors

#### Deliverables
- [x] `src/errors.ts` - Public error class hierarchy
- [x] `src/types/api.ts` - Public API type definitions
- [x] `tests/unit/errors.test.ts` - Error class tests
- [x] Updated `src/types/index.ts` - Export new types

---

### Phase 2: Core API Functions (validate, list)
**Feature:** [FEAT-010](../features/FEAT-010-programmatic-api.md) | [#24](https://github.com/lwndev/ai-skills-manager/issues/24)
**Status:** ✅ Complete

#### Rationale
- **Simplest functions**: `validate()` and `list()` are read-only operations
- **No side effects**: Neither modifies filesystem state
- **Establishes patterns**: Defines how API functions wrap generators
- **Quick wins**: Demonstrates working API before complex operations

#### Implementation Steps
1. Create `src/api/` directory for API functions
2. Implement `src/api/validate.ts`:
   - Import existing validation logic from `src/generators/validate.ts`
   - Transform internal validation result to public `ValidateResult` type
   - Return result object (never throw for validation failures per spec)
   - Add JSDoc documentation
3. Implement `src/api/list.ts`:
   - Leverage existing `src/generators/skill-discovery.ts`
   - Accept `ListOptions` with scope filter and custom path
   - Return array of `InstalledSkill` objects
   - Return empty array if no skills found (never throw)
   - Throw `FileSystemError` only for permission errors
4. Create `src/api/index.ts` barrel export
5. Write unit tests for both functions
6. Write integration tests verifying end-to-end behavior

#### Deliverables
- [x] `src/api/validate.ts` - Validate API function
- [x] `src/api/list.ts` - List API function
- [x] `src/api/index.ts` - API barrel export
- [x] `tests/unit/api/validate.test.ts` - Unit tests
- [x] `tests/unit/api/list.test.ts` - Unit tests
- [x] `tests/integration/api/validate.test.ts` - Integration tests
- [x] `tests/integration/api/list.test.ts` - Integration tests

---

### Phase 3: Scaffold API Function
**Feature:** [FEAT-010](../features/FEAT-010-programmatic-api.md) | [#24](https://github.com/lwndev/ai-skills-manager/issues/24)
**Status:** ✅ Complete

#### Rationale
- **First write operation**: Introduces filesystem modification patterns
- **Lower complexity**: Creates files but no packaging/extraction
- **Isolated operation**: Doesn't depend on other API functions
- **Validates error handling**: Tests FileSystemError and SecurityError

#### Implementation Steps
1. Implement `src/api/scaffold.ts`:
   - Accept `ScaffoldOptions` (name, description, output, scope, allowedTools, force)
   - Wrap existing `src/generators/scaffold.ts` logic
   - Remove console output - return data only
   - Return `ScaffoldResult` with path and files array
   - Throw `SecurityError` for invalid skill names
   - Throw `FileSystemError` for directory creation failures
2. Add input validation before filesystem operations
3. Write unit tests covering all options
4. Write integration tests creating actual skill directories
5. Test error scenarios (invalid names, permission errors, existing directory)

#### Deliverables
- [x] `src/api/scaffold.ts` - Scaffold API function
- [x] `tests/unit/api/scaffold.test.ts` - Unit tests
- [x] `tests/integration/api/scaffold.test.ts` - Integration tests

---

### Phase 4: Package API Function (createPackage)
**Feature:** [FEAT-010](../features/FEAT-010-programmatic-api.md) | [#24](https://github.com/lwndev/ai-skills-manager/issues/24)
**Status:** Pending

#### Rationale
- **Builds on validation**: Uses validate() internally unless skipped
- **Introduces cancellation**: First function with AbortSignal support
- **Complex error handling**: Multiple failure modes (validation, packaging)
- **Required for install/update**: Install and update functions consume packages

#### Implementation Steps
1. Implement `src/api/package.ts`:
   - Accept `PackageOptions` (path, output, skipValidation, force, signal)
   - Call validate() unless skipValidation is true
   - Throw `ValidationError` with issues array if validation fails
   - Wrap existing `src/generators/packager.ts` logic
   - Return `PackageResult` with packagePath and size
   - Throw `PackageError` for packaging failures
   - Check AbortSignal at operation boundaries
   - Throw `CancellationError` if signal aborted
2. Implement AbortSignal checking utility
3. Write unit tests for all code paths
4. Write integration tests creating actual .skill files
5. Test cancellation scenarios

#### Deliverables
- [ ] `src/api/package.ts` - CreatePackage API function
- [ ] `src/utils/abort-signal.ts` - AbortSignal checking utility
- [ ] `tests/unit/api/package.test.ts` - Unit tests
- [ ] `tests/integration/api/package.test.ts` - Integration tests
- [ ] `tests/unit/utils/abort-signal.test.ts` - Cancellation utility tests

---

### Phase 5: Install API Function
**Feature:** [FEAT-010](../features/FEAT-010-programmatic-api.md) | [#24](https://github.com/lwndev/ai-skills-manager/issues/24)
**Status:** Pending

#### Rationale
- **Core operation**: Installing skills is a primary use case
- **Complex validation**: Security checks, package validation
- **Dry-run pattern**: Introduces dryRun mode for preview
- **Reuses patterns**: Builds on error handling from previous phases

#### Implementation Steps
1. Implement `src/api/install.ts`:
   - Accept `InstallOptions` (file, scope, targetPath, force, dryRun, signal)
   - Validate package before installation
   - Wrap existing `src/generators/installer.ts` logic
   - Return `InstallResult` with installedPath, skillName, version, dryRun flag
   - Support dryRun mode (return what would happen, no changes)
   - Throw `PackageError` for invalid packages
   - Throw `FileSystemError` for installation failures
   - Throw `SecurityError` for path traversal attempts
   - Check AbortSignal, clean up partial state on cancellation
2. Ensure partial cleanup on failure (no orphaned files)
3. Write unit tests including dryRun scenarios
4. Write integration tests with actual package installation
5. Test security scenarios (path traversal, invalid packages)

#### Deliverables
- [ ] `src/api/install.ts` - Install API function
- [ ] `tests/unit/api/install.test.ts` - Unit tests
- [ ] `tests/integration/api/install.test.ts` - Integration tests

---

### Phase 6: Update API Function
**Feature:** [FEAT-010](../features/FEAT-010-programmatic-api.md) | [#24](https://github.com/lwndev/ai-skills-manager/issues/24)
**Status:** Pending

#### Rationale
- **Most complex operation**: Backup, replace, rollback on failure
- **Depends on install patterns**: Reuses installation logic
- **Critical reliability**: Must not leave skills in broken state
- **Full feature set**: Backup retention, version tracking

#### Implementation Steps
1. Implement `src/api/update.ts`:
   - Accept `UpdateOptions` (name, file, scope, targetPath, force, dryRun, keepBackup, signal)
   - Find existing skill installation
   - Create backup before update
   - Wrap existing `src/generators/updater.ts` logic
   - Return `UpdateResult` with paths, versions, backup info, dryRun flag
   - Rollback on failure (restore from backup)
   - Clean up backup unless keepBackup is true
   - Support dryRun mode
   - Throw `FileSystemError` if skill not found
   - Throw `PackageError` for invalid packages
   - Throw `SecurityError` for invalid skill names
2. Ensure atomic update behavior (complete success or full rollback)
3. Write unit tests covering rollback scenarios
4. Write integration tests with actual updates
5. Test backup/restore behavior

#### Deliverables
- [ ] `src/api/update.ts` - Update API function
- [ ] `tests/unit/api/update.test.ts` - Unit tests
- [ ] `tests/integration/api/update.test.ts` - Integration tests

---

### Phase 7: Uninstall API Function
**Feature:** [FEAT-010](../features/FEAT-010-programmatic-api.md) | [#24](https://github.com/lwndev/ai-skills-manager/issues/24)
**Status:** Pending

#### Rationale
- **Batch operation**: Handles multiple skills in single call
- **Partial failure handling**: Must report both successes and failures
- **Simpler than update**: No backup/rollback complexity
- **Completes CRUD operations**: Last of the modification operations

#### Implementation Steps
1. Implement `src/api/uninstall.ts`:
   - Accept `UninstallOptions` (names array, scope, targetPath, force, dryRun, signal)
   - Wrap existing `src/generators/uninstaller.ts` logic
   - Return `UninstallResult` with removed array, notFound array, dryRun flag
   - Handle partial failures gracefully (continue with remaining skills)
   - Support dryRun mode
   - Throw `SecurityError` for invalid skill names
   - Throw `FileSystemError` for permission errors
2. Implement batch operation with individual error tracking
3. Write unit tests including partial failure scenarios
4. Write integration tests with actual uninstallation
5. Test concurrent uninstall safety

#### Deliverables
- [ ] `src/api/uninstall.ts` - Uninstall API function
- [ ] `tests/unit/api/uninstall.test.ts` - Unit tests
- [ ] `tests/integration/api/uninstall.test.ts` - Integration tests

---

### Phase 8: CLI Refactoring
**Feature:** [FEAT-010](../features/FEAT-010-programmatic-api.md) | [#24](https://github.com/lwndev/ai-skills-manager/issues/24)
**Status:** Pending

#### Rationale
- **Single source of truth**: CLI uses same code paths as API
- **Backward compatibility**: All CLI behavior must remain unchanged
- **Validates API design**: Real-world consumer of the API
- **Reduces maintenance**: One implementation to maintain

#### Implementation Steps
1. Refactor `src/commands/scaffold.ts`:
   - Parse arguments with Commander.js
   - Call `scaffold()` API function
   - Format output using existing formatters
   - Translate errors to exit codes
2. Refactor `src/commands/validate.ts`:
   - Call `validate()` API function
   - Format validation results for console
3. Refactor `src/commands/package.ts`:
   - Call `createPackage()` API function
   - Handle ValidationError specially (show issues)
4. Refactor `src/commands/install.ts`:
   - Call `install()` API function
   - Handle user prompts for force/overwrite
5. Refactor `src/commands/update.ts`:
   - Call `update()` API function
   - Handle user prompts and confirmations
6. Refactor `src/commands/uninstall.ts`:
   - Call `uninstall()` API function
   - Format partial results (removed/notFound)
7. Add `list` command to CLI:
   - Call `list()` API function
   - Format installed skills for console
8. Run full CLI test suite to verify backward compatibility
9. Test all CLI commands manually

#### Deliverables
- [ ] Refactored `src/commands/scaffold.ts`
- [ ] Refactored `src/commands/validate.ts`
- [ ] Refactored `src/commands/package.ts`
- [ ] Refactored `src/commands/install.ts`
- [ ] Refactored `src/commands/update.ts`
- [ ] Refactored `src/commands/uninstall.ts`
- [ ] New `src/commands/list.ts` - List command
- [ ] `tests/cli/` - CLI integration tests verifying unchanged behavior

---

### Phase 9: Package Entry Point and Exports
**Feature:** [FEAT-010](../features/FEAT-010-programmatic-api.md) | [#24](https://github.com/lwndev/ai-skills-manager/issues/24)
**Status:** Pending

#### Rationale
- **Public interface**: Defines what consumers can import
- **Dual format support**: ESM and CommonJS consumers
- **Type exports**: TypeScript consumers need type definitions
- **Last phase**: Requires all API functions to be complete

#### Implementation Steps
1. Update `src/index.ts` as the package entry point:
   - Export all API functions from `src/api/`
   - Export all public types from `src/types/api.ts`
   - Export all error classes from `src/errors.ts`
2. Update `package.json`:
   - Set `"type": "module"` for ESM
   - Configure `"exports"` field with types, import, require paths
   - Configure `"main"` for CommonJS fallback
   - Configure `"types"` for TypeScript
   - Update `"files"` array to include dist
3. Update `tsconfig.json` if needed:
   - Verify `declaration: true`
   - Verify `declarationMap: true`
4. Consider build tooling (tsup) for dual ESM/CJS output
5. Write consumer tests:
   - Test ESM import pattern
   - Test CommonJS require pattern
   - Test TypeScript type inference
   - Test error instanceof checks
6. Build and verify output structure
7. Test installation from local path

#### Deliverables
- [ ] Updated `src/index.ts` - Package entry point with all exports
- [ ] Updated `package.json` - Exports configuration
- [ ] `tests/consumer/esm.test.mts` - ESM consumer test
- [ ] `tests/consumer/cjs.test.cjs` - CommonJS consumer test
- [ ] `tests/consumer/types.test.ts` - TypeScript type inference test

---

### Phase 10: Documentation and Release
**Feature:** [FEAT-010](../features/FEAT-010-programmatic-api.md) | [#24](https://github.com/lwndev/ai-skills-manager/issues/24)
**Status:** Pending

#### Rationale
- **API discoverability**: Consumers need usage examples
- **Type documentation**: JSDoc enables IDE autocompletion
- **Release preparation**: Versioning, changelog, publication
- **Final validation**: Complete acceptance criteria check

#### Implementation Steps
1. Add JSDoc comments to all exported functions in `src/api/`
2. Add JSDoc comments to all exported types in `src/types/api.ts`
3. Add JSDoc comments to all exported error classes
4. Update README.md:
   - Add "Programmatic API" section
   - Include usage examples for each function
   - Document error handling patterns
   - Show cancellation usage with AbortController
5. Create or update CHANGELOG.md
6. Run full test suite including coverage report
7. Verify >80% code coverage on new code
8. Run linting and fix any issues
9. Bump version in package.json
10. Final manual testing of all operations
11. Verify all acceptance criteria from requirements document

#### Deliverables
- [ ] JSDoc comments on all exports
- [ ] Updated `README.md` with API documentation
- [ ] Updated `CHANGELOG.md`
- [ ] All tests passing with >80% coverage
- [ ] Version bump in `package.json`
- [ ] All acceptance criteria verified

---

## Shared Infrastructure

### AbortSignal Handling
Implement a utility for checking AbortSignal at operation boundaries:
```typescript
// src/utils/abort-signal.ts
export function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new CancellationError();
  }
}
```

### Error Translation Layer
Map internal errors to public API errors:
- Internal validation errors → `ValidationError` with issues array
- Internal filesystem errors → `FileSystemError` with path
- Internal security errors → `SecurityError`

### Result Transformation
Transform discriminated union results from generators to simpler API result types:
- Strip internal-only properties
- Ensure consistent property names across functions

## Testing Strategy

### Unit Testing
- **Coverage goal**: >80% for all new API code
- **Focus areas**:
  - Input validation for each function
  - Error throwing scenarios (correct error types)
  - Options handling (defaults, overrides)
  - AbortSignal cancellation
  - dryRun mode behavior

### Integration Testing
- **End-to-end operation testing**:
  - Create, validate, package, install, update, uninstall cycle
  - Multi-skill scenarios
  - Error recovery
- **Filesystem state verification**:
  - Files created/deleted as expected
  - No orphaned files on failure

### Consumer Testing
- **Import pattern verification**:
  - ESM static import
  - CommonJS dynamic require
  - TypeScript type inference
- **Error handling verification**:
  - instanceof checks work correctly
  - Error properties accessible

### CLI Regression Testing
- **All existing CLI tests must pass**
- **Behavior unchanged**:
  - Same output format
  - Same exit codes
  - Same error messages

## Dependencies and Prerequisites

### Existing Dependencies (No Changes)
- `commander` (v14.0.2) - CLI argument parsing
- `adm-zip` (v0.5.16) - Package extraction
- `archiver` (v7.0.1) - Package creation
- `js-yaml` (v4.1.1) - Frontmatter parsing

### Potential New Dependencies
- `tsup` or `unbuild` - For dual ESM/CJS builds (evaluate in Phase 9)

### Internal Dependencies
- Existing generators in `src/generators/`
- Existing validators in `src/validators/`
- Existing services in `src/services/`
- Existing types in `src/types/`

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| CLI regression after refactor | High | Medium | Comprehensive CLI test suite, run before/after comparison |
| Type export breaks TypeScript consumers | Medium | Low | Consumer tests verify type inference |
| Error class hierarchy changes break instanceof | High | Low | Freeze error class names and structure |
| Dual ESM/CJS build complexity | Medium | Medium | Use established build tool (tsup), test both formats |
| AbortSignal cleanup leaves partial state | High | Low | Unit tests for cancellation cleanup |
| Generator internal API changes break refactor | Medium | Medium | Minimize changes to generator interfaces |
| Package.json exports misconfiguration | High | Medium | Test actual import/require in consumer tests |

## Success Criteria

### Per-Phase Criteria
Each phase must meet:
- [ ] All deliverables completed
- [ ] All tests passing
- [ ] >80% code coverage on new code
- [ ] No regressions in existing functionality
- [ ] JSDoc documentation on public APIs

### Overall Project Success (from Requirements)

#### API Functionality
- [ ] All seven API functions exported and working (scaffold, validate, createPackage, install, update, uninstall, list)
- [ ] All TypeScript types exported and accurate
- [ ] All error classes exported and usable for instanceof checks
- [ ] API functions return typed results (not void)
- [ ] API functions throw typed errors (not generic Error)
- [ ] AbortSignal support for cancellable operations

#### CLI Compatibility
- [ ] All existing CLI commands continue to work
- [ ] CLI output format unchanged
- [ ] CLI exit codes unchanged
- [ ] CLI options unchanged

#### Type Safety
- [ ] Full TypeScript coverage on all exports
- [ ] No `any` types in public API
- [ ] Discriminated unions used for result types with branches
- [ ] JSDoc comments on all exported functions

#### Testing
- [ ] Unit tests for each API function (>80% coverage)
- [ ] Integration tests for CLI via API
- [ ] Error handling tests for all error types
- [ ] Consumer tests verifying import patterns

#### Documentation
- [ ] README updated with API usage examples
- [ ] TypeScript types serve as documentation
- [ ] Error handling patterns documented

## Code Organization

### Final Directory Structure

```
src/
├── api/                        # NEW: Public API layer
│   ├── index.ts               # Barrel export of all API functions
│   ├── scaffold.ts            # scaffold() function
│   ├── validate.ts            # validate() function
│   ├── package.ts             # createPackage() function
│   ├── install.ts             # install() function
│   ├── update.ts              # update() function
│   ├── uninstall.ts           # uninstall() function
│   └── list.ts                # list() function
├── commands/                   # CLI commands (refactored to thin wrappers)
│   ├── scaffold.ts
│   ├── validate.ts
│   ├── package.ts
│   ├── install.ts
│   ├── update.ts
│   ├── uninstall.ts
│   └── list.ts                # NEW: list command
├── generators/                 # Core business logic (existing)
│   ├── scaffold.ts
│   ├── validate.ts
│   ├── packager.ts
│   ├── installer.ts
│   ├── updater.ts
│   ├── uninstaller.ts
│   └── skill-discovery.ts
├── types/
│   ├── index.ts               # Barrel export
│   ├── api.ts                 # NEW: Public API types
│   └── ... (existing types)
├── errors.ts                   # NEW: Public error classes
├── index.ts                    # Package entry point (exports API)
└── cli.ts                      # CLI entry point (unchanged)

tests/
├── unit/
│   ├── api/                   # NEW: API unit tests
│   │   ├── scaffold.test.ts
│   │   ├── validate.test.ts
│   │   ├── package.test.ts
│   │   ├── install.test.ts
│   │   ├── update.test.ts
│   │   ├── uninstall.test.ts
│   │   └── list.test.ts
│   ├── errors.test.ts         # NEW: Error class tests
│   └── utils/
│       └── abort-signal.test.ts
├── integration/
│   └── api/                   # NEW: API integration tests
│       ├── scaffold.test.ts
│       ├── validate.test.ts
│       ├── package.test.ts
│       ├── install.test.ts
│       ├── update.test.ts
│       ├── uninstall.test.ts
│       └── list.test.ts
├── consumer/                  # NEW: Consumer pattern tests
│   ├── esm.test.mts
│   ├── cjs.test.cjs
│   └── types.test.ts
└── cli/                       # CLI regression tests
```

## Verification Checklist

Before finalizing implementation:

- [ ] All features from requirements included (7 API functions)
- [ ] Build sequence accounts for dependencies (types → simple functions → complex functions → CLI → exports)
- [ ] Each phase has clear rationale and deliverables
- [ ] Risks identified with mitigations
- [ ] Success criteria are measurable
- [ ] Test coverage requirements defined
- [ ] CLI backward compatibility addressed
- [ ] Consumer import patterns validated
