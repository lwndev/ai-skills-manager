# Implementation Plan: Package Skill Command

## Overview

Implement the `asm package` command that enables users to package validated Claude Code skills into distributable `.skill` files (ZIP archives). This command completes the skill distribution workflow by bundling skills created with `asm scaffold` and validated with `asm validate` into shareable artifacts.

This implementation builds on the existing CLI infrastructure, validation system, and output utilities established by FEAT-001 and FEAT-002. The packaged `.skill` files will be consumed by the future `asm install` command (FEAT-004) to complete the skill lifecycle.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-003   | [#3](https://github.com/lwndev/ai-skills-manager/issues/3) | [03-package-skill-command.md](../features/03-package-skill-command.md) | High | Medium | Pending |

## Recommended Build Sequence

### Phase 1: ZIP Archive Infrastructure
**Feature:** [FEAT-003](../features/03-package-skill-command.md) | [#3](https://github.com/lwndev/ai-skills-manager/issues/3) (Foundation)
**Status:** ✅ Complete

#### Rationale
- Establishes the core ZIP creation capability that all packaging depends on
- Introduces archiver dependency for reliable cross-platform ZIP operations
- Creates testable utilities that can be used independently of command logic
- Must be built first as all other phases depend on ZIP creation

#### Implementation Steps
1. Install archiver dependency: `npm install archiver`
2. Install archiver types: `npm install --save-dev @types/archiver`
3. Create `src/utils/archiver.ts` with ZIP creation utilities:
   - `createZipArchive(outputPath: string): Archiver` - Creates ZIP stream
   - `addFileToArchive(archive: Archiver, filePath: string, archivePath: string): void` - Adds single file
   - `addDirectoryToArchive(archive: Archiver, dirPath: string, basePath: string): Promise<void>` - Adds directory recursively
   - `finalizeArchive(archive: Archiver): Promise<void>` - Closes and completes ZIP
   - File exclusion filter: `.git/`, `node_modules/`, `.DS_Store`, `*.log`, `__pycache__/`, `*.pyc`
4. Create `src/types/package.ts` with packaging types:
   - `PackageOptions` interface (outputPath, force, skipValidation, quiet)
   - `PackageResult` interface (success, packagePath, fileCount, size, errors)
   - `FileEntry` interface (path, size, excluded)
5. Write unit tests for archiver utilities

#### Deliverables
- [x] `src/utils/archiver.ts` - ZIP creation utilities
- [x] `src/types/package.ts` - Package type definitions
- [x] `tests/unit/utils/archiver.test.ts` - Archiver utility tests
- [x] Updated `package.json` with archiver dependency

---

### Phase 2: Path and File Validation
**Feature:** [FEAT-003](../features/03-package-skill-command.md) | [#3](https://github.com/lwndev/ai-skills-manager/issues/3) (Validation)
**Status:** ✅ Complete

#### Rationale
- Builds on existing validators from FEAT-002
- Validation before packaging prevents invalid packages
- Reuses `asm validate` command integration pattern
- Essential safety layer before expensive ZIP operations

#### Implementation Steps
1. Create `src/validators/skill-path.ts`:
   - `validateSkillPath(path: string): ValidationResult` - Verify path exists and is directory
   - Handle case where path points to SKILL.md (use parent directory)
   - Return clear error messages for invalid paths
2. Enhance `src/validators/file-exists.ts` if needed for SKILL.md check
3. Create `src/generators/package-validator.ts`:
   - `validateForPackaging(skillPath: string, skipValidation: boolean): Promise<ValidationResult>`
   - Run `asm validate` internally unless skipValidation is true
   - Parse validation output and return structured result
4. Add validation error types to `src/utils/errors.ts`:
   - `PathValidationError` - Path doesn't exist or isn't a directory
   - `ValidationFailedError` - Skill validation failed
5. Write unit tests for path validation and package validation

#### Deliverables
- [x] `src/validators/skill-path.ts` - Skill path validation
- [x] `src/generators/package-validator.ts` - Pre-package validation
- [x] Enhanced `src/utils/errors.ts` with packaging errors
- [x] `tests/unit/validators/skill-path.test.ts` - Path validation tests
- [x] `tests/unit/generators/package-validator.test.ts` - Package validation tests

---

### Phase 3: Package File Generation
**Feature:** [FEAT-003](../features/03-package-skill-command.md) | [#3](https://github.com/lwndev/ai-skills-manager/issues/3) (Core Packaging)
**Status:** ✅ Complete

#### Rationale
- Builds on ZIP infrastructure from Phase 1 and validation from Phase 2
- Implements the core packaging logic
- Creates the actual `.skill` files that will be consumed by FEAT-004
- Separates business logic from CLI command for testability

#### Implementation Steps
1. Create `src/generators/packager.ts`:
   - `generatePackage(skillPath: string, options: PackageOptions): Promise<PackageResult>`
   - Validate skill path and SKILL.md existence
   - Run pre-package validation (unless skipValidation)
   - Determine output path and package name
   - Check for existing file and handle overwrite logic
   - Create ZIP archive with proper structure (skill-name/ as root)
   - Add all files while respecting exclusion rules
   - Return structured result with stats
2. Implement file exclusion logic:
   - Filter: `.git/`, `node_modules/`, `.DS_Store`, `*.log`, `__pycache__/`, `*.pyc`
   - Keep: all other files including hidden files like `.gitkeep`
3. Implement overwrite detection:
   - Check if output file exists
   - Return flag indicating overwrite needed
   - Handle `--force` flag to skip prompt
4. Add helper functions:
   - `getPackageName(skillPath: string): string` - Extract skill name from path
   - `resolveOutputPath(outputDir: string, packageName: string): string` - Build full output path
   - `calculatePackageSize(filePath: string): string` - Format file size (KB, MB)
5. Write unit tests and integration tests

#### Deliverables
- [x] `src/generators/packager.ts` - Core packaging generator
- [x] File exclusion implementation with pattern matching
- [x] Overwrite detection and handling
- [x] Package naming and path resolution
- [x] `tests/unit/generators/packager.test.ts` - Packager unit tests
- [x] `tests/integration/package.test.ts` - End-to-end packaging tests

---

### Phase 4: Command Integration and Output
**Feature:** [FEAT-003](../features/03-package-skill-command.md) | [#3](https://github.com/lwndev/ai-skills-manager/issues/3) (CLI Integration)
**Status:** Pending

#### Rationale
- Final integration layer that ties all components together
- Implements user-facing CLI with proper error handling
- Creates rich output formatting for user feedback
- Completes the feature with working command

#### Implementation Steps
1. Create `src/formatters/package-formatter.ts`:
   - `formatPackageProgress(stage: string, file?: string): string` - Progress messages
   - `formatPackageSuccess(result: PackageResult): string` - Success output with stats
   - `formatPackageError(error: Error): string` - Error messages
   - `formatOverwritePrompt(existingPath: string): string` - Overwrite confirmation
   - `formatQuietOutput(result: PackageResult): string` - Minimal output for --quiet
2. Create `src/commands/package.ts`:
   - Register command with Commander: `asm package <skill-path> [options]`
   - Add options: `--output`, `--force`, `--skip-validation`, `--quiet`
   - Wire up packager generator
   - Handle user prompts for overwrite (unless --force)
   - Show progress output (unless --quiet)
   - Handle errors with proper exit codes (0, 1, 2, 3)
   - Add help text and examples
3. Register command in `src/cli.ts`
4. Create `src/utils/prompts.ts` for interactive confirmation:
   - `confirmOverwrite(packagePath: string): Promise<boolean>` - Prompt user for overwrite
5. Write integration tests for full command workflow
6. Update documentation

#### Deliverables
- [ ] `src/formatters/package-formatter.ts` - Output formatting
- [ ] `src/commands/package.ts` - Package command implementation
- [ ] `src/utils/prompts.ts` - User prompt utilities
- [ ] Updated `src/cli.ts` with package command registration
- [ ] `tests/commands/package.test.ts` - Command integration tests
- [ ] Help text with examples
- [ ] Exit code handling for all scenarios

---

## Shared Infrastructure

### Reusable from Previous Features
- **CLI Framework**: Commander.js setup from FEAT-001
- **Validation System**: Validators and validation engine from FEAT-002
- **Output Utilities**: `src/utils/output.ts` for formatted messages
- **Error Types**: `src/utils/errors.ts` for custom error classes
- **File System Utils**: Path resolution and file operations

### New Shared Components
- **Archiver Utilities**: `src/utils/archiver.ts` - May be reused for future archive operations
- **Package Types**: `src/types/package.ts` - Will be reused by FEAT-004 (install)
- **File Exclusion Patterns**: Can be extended with `.skillignore` support later
- **Prompt Utilities**: `src/utils/prompts.ts` - Reusable for other confirmations

## Testing Strategy

### Unit Tests
- Archiver utility functions (ZIP creation, file addition, finalization)
- Path validation (directory checks, SKILL.md parent resolution)
- Package name extraction and output path resolution
- File exclusion filter logic
- Error message formatting
- Exit code determination

### Integration Tests
- Full package workflow: scaffold → validate → package
- Package with different output directories
- Package with existing file (overwrite prompt and --force)
- Package with validation failure
- Package with --skip-validation flag
- Package with --quiet flag
- Verify ZIP structure and contents
- Cross-platform path handling (Windows, macOS, Linux)

### Manual Testing
- Package skills created by `asm scaffold`
- Extract `.skill` file with various ZIP tools (unzip, 7zip, WinZip, macOS Archive Utility)
- Verify packaged files are complete and structure preserved
- Test on different platforms (macOS, Linux, Windows)
- Verify package can be consumed by future `asm install` command
- Test with large skills (many files)
- Test with skills containing special characters in filenames

### Edge Cases to Test
1. Empty skill directory (only SKILL.md)
2. Symbolic links in skill directory
3. Very large files (>10MB individual files)
4. Binary files in skill
5. Nested `.skill` files (packaging a skill that contains packages)
6. Invalid characters in skill directory name
7. Read-only output directory
8. Insufficient disk space
9. Interrupted packaging operation
10. Concurrent package creation

## Dependencies and Prerequisites

### External Dependencies
- **archiver** (^7.0.0): Professional-grade ZIP archive creation
  - Why: Reliable, cross-platform, stream-based ZIP creation
  - Alternatives considered: JSZip (less suitable for large files), adm-zip (simpler but less robust)
- **@types/archiver**: TypeScript type definitions

### Internal Dependencies
- `asm validate` command (FEAT-002): Pre-package validation
- Validators from FEAT-002: Name, description, frontmatter validation
- CLI infrastructure from FEAT-001: Commander.js setup
- Utility functions: Output formatting, error handling

### Prerequisites
- Node.js ≥18.0.0 (for native fs/promises)
- Existing skill structure (typically from `asm scaffold`)
- Valid SKILL.md file

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| ZIP corruption on large files | High | Low | Use archiver library with stream support; test with large sample skills |
| Cross-platform path issues (Windows backslashes) | Medium | Medium | Use path.posix for archive paths; test on Windows |
| File permission loss | Low | Medium | Use archiver's mode option to preserve permissions; document limitations |
| Memory issues with large skills | Medium | Low | Use streaming with archiver; warn for skills >50MB |
| Overwrite data loss | High | Low | Implement confirmation prompt; require --force flag; clear warnings |
| Invalid validation integration | High | Low | Thorough testing of validate command integration; fallback error handling |
| File exclusion missing critical files | Medium | Low | Conservative exclusion list; document patterns; future `.skillignore` support |
| Package format incompatibility | High | Low | Use standard ZIP_DEFLATED; test with multiple extraction tools |

## Success Criteria

### Per-Feature Success Metrics
- [ ] `asm package` command available and documented
- [ ] All command options work correctly (--output, --force, --skip-validation, --quiet)
- [ ] Pre-package validation runs and blocks packaging on failure
- [ ] Packages created with correct `.skill` extension and valid ZIP format
- [ ] All skill files included with proper directory structure preserved
- [ ] Common development artifacts excluded (.git, node_modules, etc.)
- [ ] Overwrite protection works with user confirmation
- [ ] Progress output shows validation, file addition, and summary
- [ ] Error messages are clear and actionable
- [ ] Exit codes match specification (0, 1, 2, 3)
- [ ] Package size and file count reported accurately
- [ ] Cross-platform compatibility verified (Windows, macOS, Linux)

### Quality Metrics
- [ ] Unit test coverage ≥80%
- [ ] Integration tests cover all main workflows
- [ ] All acceptance criteria from feature spec met
- [ ] Manual testing completed on multiple platforms
- [ ] Help text includes clear examples
- [ ] Error messages provide actionable guidance

### Integration Metrics
- [ ] Packaged skills can be extracted by standard ZIP tools
- [ ] Packaged skills maintain correct structure for FEAT-004 (install)
- [ ] Workflow: scaffold → validate → package produces valid artifacts
- [ ] Performance acceptable for typical skills (<5 seconds for <10MB)

## Code Organization

```
src/
├── commands/
│   ├── scaffold.ts         (existing - FEAT-001)
│   ├── validate.ts         (existing - FEAT-002)
│   └── package.ts          (new - package command)
│
├── generators/
│   ├── scaffold.ts         (existing - FEAT-001)
│   ├── validate.ts         (existing - FEAT-002)
│   ├── packager.ts         (new - core packaging logic)
│   └── package-validator.ts (new - pre-package validation)
│
├── validators/
│   ├── name.ts             (existing - FEAT-001)
│   ├── description.ts      (existing - FEAT-001)
│   ├── frontmatter.ts      (existing - FEAT-001)
│   ├── file-exists.ts      (existing - FEAT-002)
│   ├── required-fields.ts  (existing - FEAT-002)
│   └── skill-path.ts       (new - path validation)
│
├── formatters/
│   ├── validate-formatter.ts (existing - FEAT-002)
│   └── package-formatter.ts  (new - package output formatting)
│
├── utils/
│   ├── output.ts           (existing - generic output)
│   ├── errors.ts           (existing - custom errors)
│   ├── frontmatter-parser.ts (existing - FEAT-002)
│   ├── archiver.ts         (new - ZIP creation utilities)
│   └── prompts.ts          (new - user confirmations)
│
├── types/
│   ├── validation.ts       (existing - FEAT-002)
│   └── package.ts          (new - packaging types)
│
└── cli.ts                  (existing - update with package command)

tests/
├── commands/
│   └── package.test.ts     (new - command integration tests)
│
├── generators/
│   ├── packager.test.ts    (new - packager unit tests)
│   └── package-validator.test.ts (new - validation tests)
│
├── validators/
│   └── skill-path.test.ts  (new - path validation tests)
│
├── utils/
│   └── archiver.test.ts    (new - archiver utility tests)
│
└── integration/
    └── package.test.ts     (new - end-to-end package workflow)
```

## Implementation Notes

### Phase Dependencies
1. **Phase 1** is completely independent and should be built first
2. **Phase 2** depends on Phase 1 types but can be developed in parallel with Phase 1
3. **Phase 3** requires both Phase 1 (ZIP infrastructure) and Phase 2 (validation) to be complete
4. **Phase 4** requires Phase 3 (packager) to be complete

### Development Workflow
1. Implement phases sequentially for clear progress tracking
2. Write tests alongside implementation (TDD where practical)
3. Test on multiple platforms early (especially Windows path handling)
4. Create sample skills for testing (small, medium, large)
5. Validate packages with multiple extraction tools
6. Document any platform-specific quirks

### Future Enhancements (Out of Scope)
- `.skillignore` file support for custom exclusions
- Package signing and verification
- Metadata injection (version, author, timestamp)
- Manifest file generation
- Compression level options
- Dry-run mode
- Package validation command
- Multi-skill bundling

## Related Features

### Dependencies
- **FEAT-001** (Scaffold): Creates skills that will be packaged
- **FEAT-002** (Validate): Provides validation used in packaging

### Dependents
- **FEAT-004** (Install): Consumes `.skill` packages created by this command

### Workflow Integration
```
scaffold → validate → package → install
(FEAT-001) (FEAT-002) (FEAT-003) (FEAT-004)
```

## References

- Feature specification: [03-package-skill-command.md](../features/03-package-skill-command.md)
- GitHub issue: [#3](https://github.com/lwndev/ai-skills-manager/issues/3)
- Original Python implementation: `docs/anthropic/skills/scripts/package_skill.py`
- Archiver documentation: https://www.archiverjs.com/
