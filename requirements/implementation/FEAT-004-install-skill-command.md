# Implementation Plan: Install Skill Command

## Overview

Implement the `asm install` command that enables users to install Claude Code skills from `.skill` package files into their local or project skill directories. This command completes the skill distribution workflow by consuming packages created with `asm package` and deploying them to Claude Code environments.

This implementation builds on the existing CLI infrastructure, validation system, and output utilities established by FEAT-001, FEAT-002, and FEAT-003. The command will validate packages, extract contents, handle installation scopes, and provide rollback capabilities on failure.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-004   | [#4](https://github.com/lwndev/ai-skills-manager/issues/4) | [FEAT-004-install-skill-command.md](../features/FEAT-004-install-skill-command.md) | High | Medium | Pending |

## Recommended Build Sequence

### Phase 1: ZIP Extraction Infrastructure
**Feature:** [FEAT-004](../features/FEAT-004-install-skill-command.md) | [#4](https://github.com/lwndev/ai-skills-manager/issues/4) (Foundation)
**Status:** ✅ Complete

#### Rationale
- Establishes the core ZIP extraction capability that all installation depends on
- Leverages existing `adm-zip` devDependency (move to production dependency)
- Creates testable utilities independent of command logic
- Must be built first as all other phases depend on ZIP extraction
- Mirrors the archiver utilities pattern from FEAT-003

#### Implementation Steps
1. Move `adm-zip` from devDependencies to dependencies in `package.json`
2. Create `src/utils/extractor.ts` with ZIP extraction utilities:
   - Note: adm-zip is imported as `import AdmZip from 'adm-zip'` and instantiated as `new AdmZip(path)`
   - `openZipArchive(packagePath: string): AdmZip` - Wrapper around `new AdmZip(packagePath)`
   - `isValidZipArchive(packagePath: string): boolean` - Try opening + `archive.test()` for integrity check
   - `getZipEntries(archive: AdmZip): IZipEntry[]` - Wrapper around `archive.getEntries()`
   - `extractToDirectory(archive: AdmZip, targetDir: string, overwrite?: boolean): Promise<void>` - Promisified wrapper around `archive.extractAllToAsync(targetPath, overwrite, keepOriginalPermission, callback)`
   - `extractEntryToDirectory(archive: AdmZip, entry: IZipEntry, targetDir: string): boolean` - Wrapper around `archive.extractEntryTo(entry, targetPath, maintainEntryPath, overwrite, keepOriginalPermission)`
   - `getZipRootDirectory(archive: AdmZip): string | null` - Analyze entries to detect single root directory (parse `entry.entryName` for all entries, find common root)
   - `getTotalUncompressedSize(archive: AdmZip): number` - Sum of `entry.header.size` for all entries
   - `readEntryAsText(archive: AdmZip, entryPath: string): string | null` - Wrapper around `archive.readAsText(entry)`
3. Create `src/types/install.ts` with installation types:
   - `InstallOptions` interface (scope, force, dryRun, quiet)
   - `InstallResult` interface (success, skillPath, fileCount, size, errors)
   - `InstallScope` type ('project' | 'personal' | string)
   - `ExtractedFileInfo` interface (path, size, isDirectory)
4. Key adm-zip `IZipEntry` properties we'll use:
   - `entryName: string` - Full path in archive (e.g., "my-skill/SKILL.md")
   - `name: string` - Just filename (e.g., "SKILL.md")
   - `isDirectory: boolean` - Whether entry is a directory
   - `header.size: number` - Uncompressed file size in bytes
   - `getData(): Buffer` - Get decompressed file contents
5. Write unit tests for extractor utilities

#### Deliverables
- [x] `src/utils/extractor.ts` - ZIP extraction utilities
- [x] `src/types/install.ts` - Install type definitions
- [x] `tests/unit/utils/extractor.test.ts` - Extractor utility tests
- [x] Updated `package.json` with adm-zip as production dependency

---

### Phase 2: Package File Validation
**Feature:** [FEAT-004](../features/FEAT-004-install-skill-command.md) | [#4](https://github.com/lwndev/ai-skills-manager/issues/4) (Validation)
**Status:** ✅ Complete

#### Rationale
- Validates package integrity before extraction to temporary directory
- Ensures package has required structure (single root directory with SKILL.md)
- Validates root directory name matches SKILL.md `name` field
- Reuses existing SKILL.md validators from FEAT-002
- Essential safety layer before modifying user's skill directories

#### Implementation Steps
1. Create `src/validators/package-file.ts`:
   - `validatePackageExists(packagePath: string): ValidationResult` - Use `fs.access()` to check file exists
   - `validatePackageExtension(packagePath: string): ValidationResult` - Check `path.extname() === '.skill'`
   - `validatePackageFormat(packagePath: string): ValidationResult` - Use `isValidZipArchive()` from extractor
2. Create `src/generators/install-validator.ts`:
   - `validatePackageStructure(archive: AdmZip): PackageStructureResult`:
     - Use `archive.getEntries()` to list all entries
     - Parse each `entry.entryName` to find unique top-level directories
     - Verify exactly one root directory exists (e.g., all paths start with "my-skill/")
     - Verify SKILL.md exists within root directory (look for entry where `entryName === "${rootDir}/SKILL.md"`)
     - Return root directory name and validation status
   - `extractToTempDirectory(archive: AdmZip): Promise<TempExtractionResult>`:
     - Create temp directory using `fs.mkdtemp()`
     - Use `extractToDirectory()` from extractor
     - Return temp path for cleanup
   - `validatePackageContent(tempDir: string, skillName: string): Promise<ValidationResult>`:
     - Call existing `validateForPackaging()` from `src/generators/package-validator.ts`
     - Or run `asm validate` on `${tempDir}/${skillName}` path
   - `validateNameMatch(archive: AdmZip): ValidationResult`:
     - Read SKILL.md content using `archive.readAsText("${rootDir}/SKILL.md")`
     - Parse YAML frontmatter to extract `name` field
     - Compare with root directory name from package structure
   - `cleanupTempDirectory(tempDir: string): Promise<void>` - Use `fs.rm(tempDir, { recursive: true })`
3. Add validation error types to `src/utils/errors.ts`:
   - `PackageNotFoundError` - Package file doesn't exist
   - `InvalidPackageError` - Not a valid .skill package (bad ZIP or structure)
   - `PackageValidationError` - Content validation failed
4. Write unit tests for package validation

#### Deliverables
- [x] `src/validators/package-file.ts` - Package file validation
- [x] `src/generators/install-validator.ts` - Package content validation
- [x] Enhanced `src/utils/errors.ts` with install-specific errors
- [x] `tests/unit/validators/package-file.test.ts` - Package file validation tests
- [x] `tests/unit/generators/install-validator.test.ts` - Content validation tests

---

### Phase 3: Scope and Path Resolution
**Feature:** [FEAT-004](../features/FEAT-004-install-skill-command.md) | [#4](https://github.com/lwndev/ai-skills-manager/issues/4) (Path Handling)
**Status:** ✅ Complete

#### Rationale
- Handles the complexity of installation scope resolution
- Supports project (`.claude/skills/`), personal (`~/.claude/skills/`), and custom paths
- Implements tilde expansion for home directory paths
- Validates write permissions and creates directories as needed
- Separates path logic from installation logic for testability

#### Implementation Steps
1. Create `src/utils/scope-resolver.ts`:
   - `resolveScope(scope: string | undefined): ScopeInfo` - Parse scope option
   - `expandTilde(path: string): string` - Expand ~ to home directory
   - `getProjectSkillsDir(): string` - Returns `.claude/skills/` from cwd
   - `getPersonalSkillsDir(): string` - Returns `~/.claude/skills/` expanded
   - `resolveInstallPath(scope: ScopeInfo, skillName: string): string` - Full installation path
   - `validateInstallPath(targetPath: string): Promise<PathValidationResult>` - Writable, not file
   - `ensureDirectoryExists(dirPath: string): Promise<void>` - Create with proper permissions
2. Create `src/types/scope.ts`:
   - `ScopeInfo` interface (type: 'project' | 'personal' | 'custom', path: string)
   - `PathValidationResult` interface (valid, exists, writable, isDirectory, errors)
3. Handle edge cases:
   - Scope is a file not directory → clear error
   - Parent directory doesn't exist → create recursively
   - Permission denied → clear error with suggestion
   - Windows path handling for cross-platform support
4. Write unit tests for scope resolution

#### Deliverables
- [x] `src/utils/scope-resolver.ts` - Scope and path resolution
- [x] `src/types/scope.ts` - Scope type definitions
- [x] `tests/unit/utils/scope-resolver.test.ts` - Scope resolution tests
- [x] Cross-platform path handling (Windows, macOS, Linux)

---

### Phase 4: Skill Installation and Rollback
**Feature:** [FEAT-004](../features/FEAT-004-install-skill-command.md) | [#4](https://github.com/lwndev/ai-skills-manager/issues/4) (Core Installation)
**Status:** Pending

#### Rationale
- Builds on extraction from Phase 1, validation from Phase 2, and paths from Phase 3
- Implements the core installation logic with full error handling
- Provides rollback capability if post-installation validation fails
- Handles existing skill detection and overwrite scenarios
- Separates business logic from CLI command for testability

#### Implementation Steps
1. Create `src/generators/installer.ts`:
   - `installSkill(packagePath: string, options: InstallOptions): Promise<InstallResult>`
   - Main orchestration flow:
     1. Open archive with `openZipArchive(packagePath)`
     2. Validate structure with `validatePackageStructure(archive)`
     3. Get skill name from root directory
     4. Resolve target path with `resolveInstallPath(scope, skillName)`
     5. Check for existing skill with `checkExistingSkill(targetPath)`
     6. If exists and not force, return `requiresOverwrite: true`
     7. If dry-run, return preview without extracting
     8. Extract to target with `extractSkillToTarget(archive, targetPath)`
     9. Run post-install validation with `postInstallValidation(skillPath)`
     10. If validation fails, rollback and throw error
     11. Return success result
   - `checkExistingSkill(targetPath: string): Promise<ExistingSkillInfo>`:
     - Use `fs.access()` to check if directory exists
     - Use `fs.readdir()` to list existing files for comparison
   - `backupExistingSkill(targetPath: string): Promise<string>`:
     - Copy existing skill to temp directory for potential rollback
     - Return backup path
   - `extractSkillToTarget(archive: AdmZip, targetPath: string): Promise<ExtractResult>`:
     - Create target directory with `fs.mkdir(targetPath, { recursive: true })`
     - Extract using `archive.extractAllTo(targetPath, true, true)` (overwrite=true, keepPermissions=true)
     - Note: Since package has root directory (e.g., "my-skill/"), extracting to parent of targetPath
     - Or use `extractEntryTo()` per-entry to strip root directory and extract directly to targetPath
     - Track extracted file count and total size
   - `postInstallValidation(skillPath: string): Promise<ValidationResult>`:
     - Call existing `validateForPackaging()` from package-validator
     - Return validation result
   - `rollbackInstallation(targetPath: string, backupPath?: string): Promise<void>`:
     - Remove extracted files with `fs.rm(targetPath, { recursive: true })`
     - If backup exists, restore from backup
   - `cleanupBackup(backupPath: string): Promise<void>`:
     - Remove backup directory with `fs.rm(backupPath, { recursive: true })`
2. Implement overwrite detection:
   - Check if skill directory already exists using `fs.access(targetPath)`
   - Use `fs.readdir()` to list existing files
   - Compare with package entries using `archive.getEntries()`
   - Mark files as "modified" (exists and different) vs "unchanged" (exists and same size)
   - Return `requiresOverwrite: true` flag if exists and `--force` not set
3. Implement dry-run mode:
   - Validate package structure without extracting
   - Use `archive.getEntries()` to list files that would be installed
   - Calculate total size with `getTotalUncompressedSize(archive)`
   - Check for conflicts by comparing with existing files if skill exists
   - Return `DryRunPreview` with file list, size, conflicts
4. Add helper functions:
   - `getSkillNameFromPackage(archive: AdmZip): string`:
     - Use `getZipRootDirectory(archive)` to extract root directory name
   - `calculateInstallSize(archive: AdmZip): number`:
     - Use `getTotalUncompressedSize(archive)`
   - Note: adm-zip's `extractAllTo` with `keepOriginalPermission=true` handles Unix permissions
5. Write unit and integration tests

#### Deliverables
- [ ] `src/generators/installer.ts` - Core installation generator
- [ ] Overwrite detection and handling
- [ ] Dry-run mode implementation
- [ ] Rollback on validation failure
- [ ] `tests/unit/generators/installer.test.ts` - Installer unit tests
- [ ] `tests/integration/install.test.ts` - End-to-end installation tests

---

### Phase 5: Command Integration and Output
**Feature:** [FEAT-004](../features/FEAT-004-install-skill-command.md) | [#4](https://github.com/lwndev/ai-skills-manager/issues/4) (CLI Integration)
**Status:** Pending

#### Rationale
- Final integration layer that ties all components together
- Implements user-facing CLI with proper error handling and exit codes
- Creates rich output formatting for progress and results
- Implements security warning display
- Completes the feature with working command

#### Implementation Steps
1. Create `src/formatters/install-formatter.ts`:
   - `formatInstallProgress(stage: string, detail?: string): string` - Progress messages
   - `formatValidationProgress(checks: ValidationCheck[]): string` - Validation output
   - `formatExtractionProgress(file: string, current: number, total: number): string` - File extraction
   - `formatInstallSuccess(result: InstallResult): string` - Success output with stats
   - `formatInstallError(error: Error): string` - Error messages
   - `formatOverwritePrompt(skillName: string, existingPath: string, files: FileComparison[]): string`
   - `formatDryRunOutput(preview: DryRunPreview): string` - Dry run preview
   - `formatQuietOutput(result: InstallResult): string` - Minimal output for --quiet
   - `formatSecurityWarning(): string` - Security note about untrusted sources
   - `formatNextSteps(): string` - Post-installation guidance
2. Create `src/commands/install.ts`:
   - Register command with Commander: `asm install <skill-package> [options]`
   - Add options: `--scope`, `--force`, `--dry-run`, `--quiet`
   - Wire up installer generator
   - Handle user prompts for overwrite (unless --force)
   - Show progress output (unless --quiet)
   - Display security warning in output
   - Handle errors with proper exit codes:
     - `0` - Skill installed successfully
     - `1` - Validation failed (package or post-installation)
     - `2` - File system error (path not found, permission denied, etc.)
     - `3` - Package extraction error
     - `4` - User cancelled installation
   - Add comprehensive help text with examples
3. Register command in `src/cli.ts`
4. Extend `src/utils/prompts.ts`:
   - `confirmInstallOverwrite(skillName: string, files: FileComparison[]): Promise<boolean>`
5. Write integration tests for full command workflow
6. Update documentation

#### Deliverables
- [ ] `src/formatters/install-formatter.ts` - Output formatting
- [ ] `src/commands/install.ts` - Install command implementation
- [ ] Extended `src/utils/prompts.ts` with install confirmation
- [ ] Updated `src/cli.ts` with install command registration
- [ ] `tests/commands/install.test.ts` - Command integration tests
- [ ] Help text with examples
- [ ] Exit code handling for all scenarios
- [ ] Security warning display

---

## Shared Infrastructure

### Reusable from Previous Features
- **CLI Framework**: Commander.js setup from FEAT-001
- **Validation System**: Validators and validation engine from FEAT-002
- **Output Utilities**: `src/utils/output.ts` for formatted messages
- **Error Types**: `src/utils/errors.ts` for custom error classes
- **Prompt Utilities**: `src/utils/prompts.ts` for confirmations
- **File Size Formatting**: `src/utils/archiver.ts` `formatFileSize()` function
- **Package Types**: `src/types/package.ts` for `FileEntry` and related types

### New Shared Components
- **Extractor Utilities**: `src/utils/extractor.ts` - May be reused for future package inspection
- **Scope Resolver**: `src/utils/scope-resolver.ts` - Reusable for future skill management commands
- **Install Types**: `src/types/install.ts` - Will be reused by future `asm update` command

## Testing Strategy

### Unit Tests
- ZIP extraction utilities (opening, validation, entry listing, extraction)
- Package file validation (exists, extension, format)
- Package structure validation (root directory, SKILL.md presence)
- Scope resolution (project, personal, custom paths, tilde expansion)
- Path validation (writable, directory vs file)
- Overwrite detection
- Error message formatting
- Exit code determination

### Integration Tests
- Full installation workflow: package → install → validate
- Installation to different scopes (project, personal, custom)
- Installation with existing skill (prompt and --force)
- Installation with validation failure and rollback
- Dry run mode
- Quiet mode
- Package with invalid structure
- Cross-platform path handling (Windows, macOS, Linux)

### Manual Testing
- Install skills packaged by `asm package`
- Install to various scope types
- Test overwrite scenarios with user prompts
- Verify file permissions after installation
- Test with Claude Code to ensure skill loads correctly
- Test error scenarios (corrupted ZIP, missing SKILL.md, permission denied)
- Test dry-run output accuracy
- Verify security warning display
- Test rollback on post-installation validation failure

### Edge Cases to Test
1. **Malformed ZIP structure**: No root directory or multiple root directories
2. **Large packages**: Show progress for packages >5MB, warn for >50MB
3. **Symbolic links in package**: Skip or follow based on platform
4. **Special characters in filenames**: Handle according to ZIP spec
5. **Installation interrupted**: Clean up partial extraction
6. **Scope directory doesn't exist**: Create with proper permissions (755)
7. **Scope is a file not directory**: Clear error message
8. **Skill name mismatch**: Root directory name vs SKILL.md name field
9. **Nested .skill files**: Warn if skill contains .skill files
10. **Permission issues mid-extraction**: Rollback and show clear error
11. **Skills referencing external URLs**: Security warning in output
12. **Windows-style paths in content**: Cross-platform compatibility note
13. **Empty skill (only SKILL.md)**: Should install successfully
14. **Very long file paths**: Handle gracefully

## Dependencies and Prerequisites

### External Dependencies
- **adm-zip** (^0.5.16): ZIP archive extraction (already in devDependencies, move to dependencies)
  - Why: Simple API for reading ZIP files, already used in project tests
  - Alternatives considered: yauzl (lower-level), node-stream-zip (streaming but more complex)
- **os** (built-in): Home directory resolution for personal scope
- **tmp** or native temp dir: Temporary directory for validation

### Internal Dependencies
- `asm validate` command (FEAT-002): Post-installation validation
- Validators from FEAT-002: Name, description, frontmatter validation
- CLI infrastructure from FEAT-001: Commander.js setup
- Package types from FEAT-003: `FileEntry`, `isExcluded` (reference only)
- Utility functions: Output formatting, error handling, prompts

### Prerequisites
- Node.js ≥20.19.6 (for native fs/promises)
- Valid `.skill` package file (typically from `asm package`)
- Write permissions to target installation directory

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| ZIP extraction fails mid-way | High | Low | Implement atomic extraction with rollback; clean up on error |
| Cross-platform path issues | Medium | Medium | Use path.posix for archive paths; normalize on extraction; test on Windows |
| File permission loss | Low | Medium | Attempt to preserve permissions; document limitations on Windows |
| Overwrite data loss | High | Low | Require confirmation; backup before overwrite; rollback capability |
| Post-install validation fails | Medium | Low | Full rollback to previous state; clear error messaging |
| Malicious package content | High | Low | Display security warning; recommend auditing before installation |
| Large package memory issues | Medium | Low | Use streaming extraction if needed; warn for very large packages |
| Temporary directory cleanup failure | Low | Medium | Use system temp with automatic cleanup; ignore cleanup errors |
| Concurrent installation to same target | Medium | Low | Check for lock files; clear error if concurrent access detected |

## Success Criteria

### Per-Feature Success Metrics
- [ ] `asm install` command available and documented
- [ ] All command options work correctly (--scope, --force, --dry-run, --quiet)
- [ ] Package file validation works (exists, extension, valid ZIP)
- [ ] Package structure validation works (single root directory, SKILL.md present)
- [ ] Root directory name matches SKILL.md `name` field
- [ ] Pre-installation content validation runs
- [ ] Installation scope handling works for project, personal, and custom paths
- [ ] Tilde expansion works for home directory paths
- [ ] Existing skill detection and overwrite protection works
- [ ] --force flag bypasses overwrite prompt
- [ ] Package extraction preserves structure and permissions (where possible)
- [ ] Post-installation validation runs
- [ ] Rollback works on validation failure
- [ ] --dry-run mode shows accurate preview without installing
- [ ] Progress output shows validation, extraction, and summary
- [ ] Security warning displayed in installation output
- [ ] --quiet flag produces minimal output
- [ ] Exit codes match specification (0, 1, 2, 3, 4)
- [ ] Error messages are clear and actionable
- [ ] All edge cases are handled

### Quality Metrics
- [ ] Unit test coverage ≥80%
- [ ] Integration tests cover all main workflows
- [ ] All acceptance criteria from feature spec met
- [ ] Manual testing completed on multiple platforms
- [ ] Help text includes clear examples
- [ ] Error messages provide actionable guidance

### Integration Metrics
- [ ] Skills packaged with `asm package` install correctly
- [ ] Installed skills work with Claude Code
- [ ] Workflow: scaffold → validate → package → install produces working skills
- [ ] Performance acceptable for typical skills (<5 seconds for <10MB)

## Code Organization

```
src/
├── commands/
│   ├── scaffold.ts         (existing - FEAT-001)
│   ├── validate.ts         (existing - FEAT-002)
│   ├── package.ts          (existing - FEAT-003)
│   └── install.ts          (new - install command)
│
├── generators/
│   ├── scaffold.ts         (existing - FEAT-001)
│   ├── validate.ts         (existing - FEAT-002)
│   ├── packager.ts         (existing - FEAT-003)
│   ├── package-validator.ts (existing - FEAT-003)
│   ├── installer.ts        (new - core installation logic)
│   └── install-validator.ts (new - package validation)
│
├── validators/
│   ├── name.ts             (existing - FEAT-001)
│   ├── description.ts      (existing - FEAT-001)
│   ├── frontmatter.ts      (existing - FEAT-001)
│   ├── file-exists.ts      (existing - FEAT-002)
│   ├── required-fields.ts  (existing - FEAT-002)
│   ├── skill-path.ts       (existing - FEAT-003)
│   └── package-file.ts     (new - package file validation)
│
├── formatters/
│   ├── validate-formatter.ts (existing - FEAT-002)
│   ├── package-formatter.ts  (existing - FEAT-003)
│   └── install-formatter.ts  (new - install output formatting)
│
├── utils/
│   ├── output.ts           (existing - generic output)
│   ├── errors.ts           (existing - extend with install errors)
│   ├── frontmatter-parser.ts (existing - FEAT-002)
│   ├── archiver.ts         (existing - FEAT-003)
│   ├── prompts.ts          (existing - extend with install prompts)
│   ├── extractor.ts        (new - ZIP extraction utilities)
│   └── scope-resolver.ts   (new - scope and path resolution)
│
├── types/
│   ├── validation.ts       (existing - FEAT-002)
│   ├── package.ts          (existing - FEAT-003)
│   ├── install.ts          (new - installation types)
│   └── scope.ts            (new - scope types)
│
└── cli.ts                  (existing - update with install command)

tests/
├── commands/
│   └── install.test.ts     (new - command integration tests)
│
├── generators/
│   ├── installer.test.ts   (new - installer unit tests)
│   └── install-validator.test.ts (new - validation tests)
│
├── validators/
│   └── package-file.test.ts (new - package file validation tests)
│
├── utils/
│   ├── extractor.test.ts   (new - extractor utility tests)
│   └── scope-resolver.test.ts (new - scope resolution tests)
│
└── integration/
    └── install.test.ts     (new - end-to-end install workflow)
```

## Implementation Notes

### Phase Dependencies
1. **Phase 1** is completely independent and should be built first
2. **Phase 2** depends on Phase 1 (extractor utilities) for ZIP operations
3. **Phase 3** is independent and can be developed in parallel with Phase 2
4. **Phase 4** requires Phase 1, 2, and 3 to be complete
5. **Phase 5** requires Phase 4 (installer) to be complete

### Development Workflow
1. Implement phases sequentially for clear progress tracking (Phases 2 and 3 can be parallel)
2. Write tests alongside implementation (TDD where practical)
3. Test on multiple platforms early (especially Windows path handling)
4. Create sample packages for testing (valid, invalid, large, edge cases)
5. Validate installed skills with Claude Code
6. Document any platform-specific quirks

### Key Implementation Details

#### Package Structure Validation
The package must have a single root directory containing SKILL.md:
```
my-skill.skill (ZIP)
└── my-skill/           <- Root directory (skill name)
    ├── SKILL.md        <- Required
    └── scripts/        <- Optional additional files
        └── utility.py
```

Validation must verify:
- Exactly one root directory exists
- SKILL.md exists within that directory
- Root directory name matches `name` field in SKILL.md frontmatter

#### Scope Resolution Priority
1. If `--scope` is provided:
   - `project` → `.claude/skills/`
   - `personal` → `~/.claude/skills/`
   - Custom path → resolve as provided (with tilde expansion)
2. Default (no --scope) → `project` (`.claude/skills/`)

#### Exit Code Mapping
| Exit Code | Scenario |
|-----------|----------|
| 0 | Skill installed successfully |
| 1 | Package validation failed, skill content validation failed |
| 2 | File system error (path not found, permission denied) |
| 3 | Package extraction error (corrupt ZIP, I/O error) |
| 4 | User cancelled installation |

### Future Enhancements (Out of Scope)
- Registry support (install by skill name from remote registry)
- Version management and conflict resolution
- Skill dependency management
- Automatic update checking
- Batch installation from multiple packages
- Installation hooks/scripts for custom setup
- `asm uninstall` command
- `asm update` command
- Installation verification checksum
- Signed package verification
- Installation history/audit log

## Related Features

### Dependencies
- **FEAT-001** (Scaffold): Creates skills that can be installed
- **FEAT-002** (Validate): Provides validation used in installation
- **FEAT-003** (Package): Creates `.skill` packages consumed by this command

### Dependents
- **Future**: `asm uninstall` - Removes installed skills
- **Future**: `asm update` - Updates installed skills

### Workflow Integration
```
scaffold → validate → package → install
(FEAT-001) (FEAT-002) (FEAT-003) (FEAT-004)
```

This command completes the core skill lifecycle, enabling full round-trip skill distribution from creation to deployment.

## References

- Feature specification: [FEAT-004-install-skill-command.md](../features/FEAT-004-install-skill-command.md)
- GitHub issue: [#4](https://github.com/lwndev/ai-skills-manager/issues/4)
- Package command implementation: `src/commands/package.ts`
- adm-zip documentation: https://github.com/cthackers/adm-zip
