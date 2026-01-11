# Feature Requirements: Programmatic API

## Overview

Add a programmatic API to `ai-skills-manager` so it can be imported as a Node.js module, enabling the upcoming ASM-UI (Electron GUI) and other integrations to use the same logic as the CLI.

## Feature ID
`FEAT-010`

## GitHub Issue
[#24](https://github.com/lwndev/ai-skills-manager/issues/24)

## Priority
High - Enables GUI development and third-party integrations without code duplication

## User Story

As an integration developer, I want to import ai-skills-manager as a Node.js module so that I can build GUI applications and other tools that use the same validated logic as the CLI.

## API Design

### Module Exports

```typescript
// src/index.ts
export { scaffold, validate, createPackage, install, update, uninstall, list } from './api';
export type {
  ScaffoldOptions,
  ScaffoldResult,
  ValidateResult,
  ValidationIssue,
  ValidationWarning,
  PackageOptions,
  PackageResult,
  InstallOptions,
  InstallResult,
  UpdateOptions,
  UpdateResult,
  UninstallOptions,
  UninstallResult,
  ListOptions,
  InstalledSkill
} from './types';
export {
  AsmError,
  ValidationError,
  FileSystemError,
  PackageError,
  SecurityError,
  CancellationError
} from './errors';
```

### Function Signatures

#### scaffold()

```typescript
interface ScaffoldOptions {
  name: string;
  description?: string;
  output?: string;                          // default: .claude/skills/
  scope?: 'project' | 'personal';
  allowedTools?: string[];
  force?: boolean;
}

interface ScaffoldResult {
  path: string;                             // created directory path
  files: string[];                          // list of created files
}

export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult>;
```

#### validate()

```typescript
interface ValidationIssue {
  code: string;
  message: string;
  path?: string;                            // file path or JSON path
}

interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
}

interface ValidateResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationWarning[];
}

export async function validate(path: string): Promise<ValidateResult>;
```

#### createPackage()

```typescript
interface PackageOptions {
  path: string;
  output?: string;
  skipValidation?: boolean;
  force?: boolean;
  signal?: AbortSignal;                     // for cancellation support
}

interface PackageResult {
  packagePath: string;                      // path to created .skill file
  size: number;                             // bytes
}

export async function createPackage(options: PackageOptions): Promise<PackageResult>;
// Note: named createPackage to avoid conflict with reserved word
```

#### install()

```typescript
interface InstallOptions {
  file: string;                             // path to .skill file
  scope?: 'project' | 'personal';           // default: 'project'
  targetPath?: string;                      // custom path, overrides scope if provided
  force?: boolean;
  dryRun?: boolean;
  signal?: AbortSignal;                     // for cancellation support
}

interface InstallResult {
  installedPath: string;
  skillName: string;
  version?: string;
  dryRun: boolean;
}

export async function install(options: InstallOptions): Promise<InstallResult>;
```

#### update()

```typescript
interface UpdateOptions {
  name: string;
  file: string;                             // path to new .skill file
  scope?: 'project' | 'personal';           // default: 'project'
  targetPath?: string;                      // custom path, overrides scope if provided
  force?: boolean;
  dryRun?: boolean;
  keepBackup?: boolean;
  signal?: AbortSignal;                     // for cancellation support
}

interface UpdateResult {
  updatedPath: string;
  previousVersion?: string;
  newVersion?: string;
  backupPath?: string;                      // if keepBackup is true
  dryRun: boolean;
}

export async function update(options: UpdateOptions): Promise<UpdateResult>;
```

#### uninstall()

```typescript
interface UninstallOptions {
  names: string[];
  scope?: 'project' | 'personal';           // default: 'project'
  targetPath?: string;                      // custom path, overrides scope if provided
  force?: boolean;
  dryRun?: boolean;
  signal?: AbortSignal;                     // for cancellation support
}

interface UninstallResult {
  removed: string[];                        // successfully removed skill names
  notFound: string[];                       // skills that weren't found
  dryRun: boolean;
}

export async function uninstall(options: UninstallOptions): Promise<UninstallResult>;
```

#### list()

```typescript
interface ListOptions {
  scope?: 'project' | 'personal' | 'all';   // default: 'all'
  targetPath?: string;                      // custom path to search
}

interface InstalledSkill {
  name: string;
  path: string;
  scope: 'project' | 'personal' | 'custom';
  version?: string;
  description?: string;
}

export async function list(options?: ListOptions): Promise<InstalledSkill[]>;
```

### Error Classes

```typescript
// src/errors.ts
export class AsmError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AsmError';
  }
}

export class ValidationError extends AsmError {
  constructor(message: string, public issues: ValidationIssue[]) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class FileSystemError extends AsmError {
  constructor(message: string, public path: string) {
    super(message, 'FILE_SYSTEM_ERROR');
  }
}

export class PackageError extends AsmError {
  constructor(message: string) {
    super(message, 'PACKAGE_ERROR');
  }
}

export class SecurityError extends AsmError {
  constructor(message: string) {
    super(message, 'SECURITY_ERROR');
  }
}

export class CancellationError extends AsmError {
  constructor(message: string = 'Operation cancelled') {
    super(message, 'CANCELLED');
  }
}
```

## Functional Requirements

### FR-1: Module Export Structure
- Export all API functions from `src/index.ts`
- Export all TypeScript types and interfaces
- Export all error classes for consumer error handling
- Maintain backward compatibility with existing CLI entry point

### FR-2: API Function Behavior
- Each API function must return a typed Promise
- Functions must not write to stdout/stderr (CLI layer handles output)
- Functions must throw typed errors rather than returning error codes
- Functions must accept the same options as CLI commands (with programmatic defaults)
- Functions must validate inputs before performing operations

### FR-3: scaffold() Function
- Accept skill name, optional description, output path, scope, and allowed tools
- Create skill directory structure with required files
- Return created path and list of files
- Throw `FileSystemError` if directory creation fails
- Throw `SecurityError` for invalid skill names

### FR-4: validate() Function
- Accept path to skill directory
- Return validation result with errors and warnings arrays
- Always return a result (never throw for validation failures)
- Return `valid: false` with error details for invalid skills
- Return `valid: true` with optional warnings for valid skills

> **Design Note**: `validate()` returns results rather than throwing because validation is an
> inspection operation—consumers typically want to display issues to users rather than treat
> them as exceptional. This contrasts with `createPackage()` which throws `ValidationError`
> when validation fails, because packaging an invalid skill is a failed operation that should
> not continue. Consumers who want unified handling can use `validate()` first in all cases.

### FR-5: createPackage() Function
- Accept path to skill directory and optional output path
- Validate skill before packaging (unless `skipValidation: true`)
- Create `.skill` package file
- Return package path and size in bytes
- Throw `ValidationError` if skill is invalid and validation not skipped
- Throw `PackageError` if packaging fails

### FR-6: install() Function
- Accept path to `.skill` file and target scope
- Validate package before installation
- Extract and install skill to target location
- Return installed path, skill name, and version
- Support dry-run mode (return what would happen without making changes)
- Throw `PackageError` for invalid packages
- Throw `FileSystemError` for installation failures
- Throw `SecurityError` for path traversal attempts

### FR-7: update() Function
- Accept skill name, new package path, and scope
- Create backup before update (unless disabled)
- Replace installed skill with new version
- Rollback on failure
- Return update details including backup path if retained
- Support dry-run mode
- Throw `FileSystemError` if skill not found
- Throw `PackageError` for invalid packages
- Throw `SecurityError` for invalid skill names

### FR-8: uninstall() Function
- Accept array of skill names and scope
- Remove skills from target location
- Return arrays of removed and not-found skills
- Support dry-run mode
- Throw `SecurityError` for invalid skill names
- Throw `FileSystemError` for permission errors

### FR-9: list() Function
- Accept optional scope filter ('project', 'personal', or 'all')
- Accept optional custom path to search
- Return array of installed skills with metadata
- Include skill name, path, scope, version, and description
- Return empty array if no skills found (never throw for empty results)
- Throw `FileSystemError` for permission errors reading skill directories

### FR-10: Error Handling Contract
- All thrown errors must extend `AsmError`
- Error `code` property must be machine-readable (e.g., `'VALIDATION_ERROR'`)
- Error `message` property must be human-readable
- Errors must include relevant context (path, skill name, etc.)

### FR-11: Cancellation Support
- Functions accepting `signal?: AbortSignal` must check signal state at operation boundaries
- Throw `CancellationError` if signal is aborted before or during operation
- Clean up any partial state before throwing (e.g., remove partially extracted files)
- GUI integrations can use `AbortController` to cancel long-running operations

### FR-12: CLI Refactoring
- CLI commands become thin wrappers around API functions
- CLI handles argument parsing (Commander.js)
- CLI handles output formatting and user interaction
- CLI translates API errors to exit codes and user messages

## Non-Functional Requirements

### NFR-1: Performance
- API functions should have equivalent performance to CLI commands
- No additional overhead from API layer
- Memory usage should remain bounded for large operations

### NFR-2: Error Handling
- Errors must be catchable and typed
- Error messages must be actionable
- Errors must not leak sensitive information (paths outside scope, etc.)

### NFR-3: Type Safety
- All public types must be exported
- All functions must have full TypeScript type coverage
- Types must use discriminated unions where appropriate (per CLAUDE.md guidelines)

### NFR-4: Backward Compatibility
- CLI must continue to work as before
- Existing integrations must not break
- Package exports must be additive

### NFR-5: Documentation
- All exported functions must have JSDoc comments
- TypeScript types serve as API contract documentation
- README should include API usage examples

### NFR-6: Testability
- API functions must be independently testable
- No hidden dependencies on CLI infrastructure
- Mock-friendly design for unit testing

## Implementation Plan

### Phase 1: Project Restructure

Reorganize source files to separate API, CLI, and core logic:

```
src/
├── api/                    # Programmatic API (new)
│   ├── index.ts           # Re-exports all API functions
│   ├── scaffold.ts
│   ├── validate.ts
│   ├── package.ts
│   ├── install.ts
│   ├── update.ts
│   ├── uninstall.ts
│   └── list.ts
├── cli/                    # CLI commands (refactored to thin wrappers)
│   ├── scaffold.ts
│   ├── validate.ts
│   ├── package.ts
│   ├── install.ts
│   ├── update.ts
│   ├── uninstall.ts
│   └── list.ts
├── core/                   # Shared business logic
│   ├── validation.ts
│   ├── packaging.ts
│   ├── filesystem.ts
│   └── ...
├── errors.ts               # Error classes
├── types.ts                # Shared TypeScript types
└── index.ts                # Package entry point (exports API)
```

### Phase 2: Type Definitions
1. Create `src/types.ts` with all TypeScript interfaces
2. Define options and result types for each function
3. Define error detail types

### Phase 3: Error Classes
1. Create `src/errors.ts` with error class hierarchy
2. Define `AsmError` base class
3. Define specialized error classes (ValidationError, FileSystemError, etc.)

### Phase 4: Core Logic Extraction
1. Extract business logic from existing CLI commands into `src/core/`
2. Remove console output and user interaction from core logic
3. Return data structures instead of formatting output

### Phase 5: API Layer Implementation
1. Create `src/api/` functions that call core logic
2. Implement input validation
3. Implement error wrapping
4. Return typed results

### Phase 6: CLI Refactoring
1. Refactor CLI commands to be thin wrappers
2. Parse arguments → call API → format output
3. Translate API errors to exit codes

### Phase 7: Package Configuration
1. Update `package.json` exports field with the following configuration:

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./errors": {
      "types": "./dist/errors.d.ts",
      "import": "./dist/errors.js",
      "require": "./dist/errors.cjs"
    }
  },
  "files": [
    "dist",
    "!dist/**/*.test.*",
    "!dist/**/*.spec.*"
  ]
}
```

2. Configure TypeScript for proper type exports:
   - Ensure `declaration: true` in tsconfig.json
   - Ensure `declarationMap: true` for source mapping
3. Update build configuration:
   - Generate both ESM (.js) and CJS (.cjs) outputs
   - Consider using tsup or unbuild for dual format builds

## Dependencies

### Existing Dependencies (No Changes)
- Commander.js for CLI argument parsing
- Node.js fs/promises for file operations
- adm-zip for package operations

### New/Modified Dependencies
- None required for API layer

### Internal Dependencies
- Existing validators, generators, and services
- Existing CLI command implementations (to be refactored)

## Edge Cases

1. **API called without required options**: Throw `AsmError` with helpful message
2. **Invalid skill name characters**: Throw `SecurityError` before any filesystem access
3. **Path traversal in options**: Throw `SecurityError` with sanitized message
4. **Concurrent API calls on same skill**: Same behavior as CLI (lockfile for update)
5. **API called with CLI-only options**: Ignore or throw depending on option
6. **Large skill packages**: Stream operations where possible, respect resource limits
7. **Network errors during operations**: Throw appropriate error type with context
8. **Partial failure in batch operations (uninstall)**: Return partial results in result object

## Testing Requirements

### Unit Tests
- Each API function individually tested
- Input validation coverage
- Error throwing scenarios
- Result type verification
- Options handling (defaults, overrides)

### Integration Tests
- API functions work end-to-end
- CLI commands still work via API
- Error handling chain works correctly
- Concurrent access scenarios

### Type Tests
- Exported types are correct
- Type inference works as expected
- Error types are catchable and narrowable

### Consumer Tests
- Import patterns work correctly
- TypeScript consumers get proper types
- JavaScript consumers work without types

## Example Usage

```typescript
import {
  install,
  ValidationError,
  FileSystemError,
  CancellationError
} from 'ai-skills-manager';

async function installSkillSafely(packagePath: string, signal?: AbortSignal) {
  try {
    const result = await install({
      file: packagePath,
      scope: 'project',
      signal
    });
    console.log(`Installed ${result.skillName} to ${result.installedPath}`);
    return result;
  } catch (e) {
    if (e instanceof CancellationError) {
      console.log('Installation cancelled by user');
    } else if (e instanceof ValidationError) {
      console.error('Invalid skill package:', e.issues);
    } else if (e instanceof FileSystemError) {
      console.error('File error at:', e.path);
    } else {
      throw e;
    }
    return null;
  }
}

// Usage with cancellation
const controller = new AbortController();
cancelButton.onclick = () => controller.abort();
await installSkillSafely('/path/to/skill.skill', controller.signal);
```

```typescript
import { validate } from 'ai-skills-manager';

async function checkSkill(skillPath: string) {
  const result = await validate(skillPath);

  if (result.valid) {
    console.log('Skill is valid!');
    if (result.warnings.length > 0) {
      console.log('Warnings:', result.warnings);
    }
  } else {
    console.error('Validation errors:', result.errors);
  }

  return result.valid;
}
```

```typescript
import { list } from 'ai-skills-manager';

async function showInstalledSkills() {
  // List all installed skills
  const skills = await list();

  console.log('Installed skills:');
  for (const skill of skills) {
    console.log(`  ${skill.name} (${skill.scope}) - ${skill.path}`);
    if (skill.version) {
      console.log(`    Version: ${skill.version}`);
    }
  }

  // Or filter by scope
  const projectSkills = await list({ scope: 'project' });
  console.log(`\nProject skills: ${projectSkills.length}`);
}
```

## Future Enhancements

- Event emitters for progress reporting
- Streaming results for large operations
- Plugin system for custom validators
- Registry integration (install from URL)
- Skill dependency resolution

## Acceptance Criteria

### API Functionality
- [x] All seven API functions exported and working (scaffold, validate, createPackage, install, update, uninstall, list)
- [x] All TypeScript types exported and accurate
- [x] All error classes exported and usable for instanceof checks
- [x] API functions return typed results (not void)
- [x] API functions throw typed errors (not generic Error)
- [x] AbortSignal support for cancellable operations (createPackage, install, update, uninstall)

### CLI Compatibility
- [x] All existing CLI commands continue to work
- [x] CLI output format unchanged
- [x] CLI exit codes unchanged
- [x] CLI options unchanged

### Type Safety
- [x] Full TypeScript coverage on all exports
- [x] No `any` types in public API
- [x] Discriminated unions used for result types with branches
- [x] JSDoc comments on all exported functions

### Testing
- [x] Unit tests for each API function (>80% coverage) - 88.73% statement, 88.65% line coverage
- [x] Integration tests for CLI via API
- [x] Error handling tests for all error types
- [x] Consumer tests verifying import patterns

### Documentation
- [x] README updated with API usage examples
- [x] TypeScript types serve as documentation
- [x] Error handling patterns documented

## Related Features

- `asm scaffold` (FEAT-001) - Creates skill structure → `scaffold()` API
- `asm validate` (FEAT-002) - Validates skills → `validate()` API
- `asm package` (FEAT-003) - Creates .skill packages → `createPackage()` API
- `asm install` (FEAT-004) - Installs skills → `install()` API
- `asm uninstall` (FEAT-005) - Removes skills → `uninstall()` API
- `asm update` (FEAT-008) - Updates skills → `update()` API
- `asm list` (new) - Lists installed skills → `list()` API

## Notes

### Design Rationale

**Single Source of Truth**: By extracting business logic into a programmatic API, both the CLI and future GUI (ASM-UI) share the same validated code paths. This eliminates:
- Code duplication between CLI and GUI
- Behavioral drift between interfaces
- Maintenance burden of keeping multiple implementations in sync

**Thin CLI Layer**: The CLI becomes a presentation layer only:
- Parses arguments (Commander.js)
- Calls API functions
- Formats output for terminal
- Translates errors to exit codes

**Error Classes Over Exit Codes**: The API uses thrown typed errors instead of returning error codes because:
- Easier to catch and handle specific error types
- More information available (message, context)
- Better TypeScript integration
- Standard Node.js pattern

### Naming Conventions

- `createPackage` instead of `package` (reserved word)
- Result types end in `Result`
- Options types end in `Options`
- Error classes extend `AsmError`
- `ValidationIssue` for validation result details (avoids collision with `ValidationError` class)
- `targetPath` for custom installation paths (keeps `scope` as a strict union type)

### Breaking Changes

This feature is additive and should not introduce breaking changes:
- CLI commands unchanged
- Package exports add new items but don't remove existing
- Existing consumers unaffected
