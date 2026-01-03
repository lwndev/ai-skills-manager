# Implementation Plan: Update Skill Command

## Overview

This plan details the implementation of the `asm update` command (FEAT-008), which enables users to safely update installed skills to newer versions from `.skill` packages. The update command combines install functionality (package validation, extraction) with uninstall functionality (skill discovery, file enumeration) while adding backup/rollback capabilities.

The implementation leverages 35+ existing components from FEAT-004 (install) and FEAT-005 (uninstall), minimizing new code while ensuring comprehensive security and reliability.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-008 | [#16](https://github.com/lwndev/ai-skills-manager/issues/16) | [FEAT-008-update-skill-command.md](../features/FEAT-008-update-skill-command.md) | Medium | High | Pending |

## Recommended Build Sequence

### Phase 1: Type Definitions & Infrastructure
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Foundation first**: Type definitions drive implementation, ensuring type safety throughout
- **Establishes patterns**: Update-specific types build on existing install/uninstall types
- **No dependencies**: Can be implemented immediately without other update components
- **Enables parallel work**: Once types exist, validators, generators, and formatters can be built in parallel

#### Implementation Steps
1. Create `src/types/update.ts` with:
   - `UpdateScope` type (alias to existing scope types)
   - `UpdateOptions` interface (scope, force, dryRun, quiet, noBackup, keepBackup)
   - `UpdateResult` discriminated union (success, dry-run-preview, rolled-back, rollback-failed)
   - `UpdateSuccess` interface (skillName, path, previousVersion, currentVersion, backupPath)
   - `UpdateDryRunPreview` interface (changes summary, file diffs)
   - `BackupInfo` interface (path, timestamp, size, fileCount)
   - `VersionComparison` interface (filesAdded, filesRemoved, filesModified, sizeChange)
   - `FileChange` interface (path, changeType, sizeBefore, sizeAfter)
   - `UpdateExitCode` enum matching FR-11 (0-7)
   - `UpdateError` discriminated union for all error types
2. Add update-specific error classes to `src/utils/errors.ts`:
   - `UpdateRollbackError` - When rollback succeeds after failed update
   - `UpdateCriticalError` - When both update and rollback fail
   - `BackupCreationError` - When backup fails
   - `PackageMismatchError` - When new package has different skill name
3. Export new types from `src/types/index.ts`

#### Deliverables
- [ ] `src/types/update.ts` - Complete type definitions
- [ ] Updated `src/utils/errors.ts` - Update-specific error classes
- [ ] Updated `src/types/index.ts` - Export new types
- [ ] Type definitions compile without errors

---

### Phase 2: Backup Manager Service
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Critical safety component**: Backup creation must work before any modifications
- **Independent service**: Can be tested in isolation
- **Reuses archiver**: Leverages existing `utils/archiver.ts` for ZIP creation
- **Foundation for rollback**: Must be complete before update execution phase

#### Implementation Steps
1. Create `src/services/backup-manager.ts` with:
   - `createBackup(skillPath, skillName): Promise<BackupResult>` - Main backup function
   - `getBackupDirectory(): Promise<string>` - Returns `~/.asm/backups/`, creates if needed
   - `validateBackupDirectory(): Promise<BackupDirValidation>` - Security checks (FR-4, NFR-5):
     - Verify `~/.asm` is not a symlink
     - Verify `~/.asm/backups` is not a symlink
     - Create with 0700 permissions if missing
     - Warn if permissions are world-readable
   - `generateBackupFilename(skillName): string` - Format: `<skill-name>-<YYYYMMDD-HHMMSS>-<8-hex-random>.skill`
   - `createBackupArchive(skillPath, backupPath): Promise<void>` - Create ZIP with same format as `.skill` packages
   - `verifyBackupContainment(backupPath): boolean` - Ensure path resolves within `~/.asm/backups/`
   - `cleanupBackup(backupPath): Promise<void>` - Remove backup after successful update
   - `getBackupInfo(backupPath): Promise<BackupInfo>` - Get backup metadata
2. Implement security measures per NFR-5:
   - Use `fs.open()` with mode 0o600 for backup files
   - Verify realpath resolves within backup directory
   - Include random component in filename for unpredictability
3. Add backup-related types to `src/types/update.ts`:
   - `BackupResult` (success, path, size, fileCount)
   - `BackupDirValidation` (valid, errors, warnings)
4. Unit tests for:
   - Backup directory creation and validation
   - Filename generation (format, uniqueness, randomness)
   - Security validations (symlink rejection, containment)
   - Successful backup creation and verification

#### Deliverables
- [ ] `src/services/backup-manager.ts` - Complete backup service
- [ ] Updated `src/types/update.ts` - Backup types
- [ ] `tests/unit/services/backup-manager.test.ts` - Unit tests
- [ ] Backup directory created with correct permissions (0700)
- [ ] Backup files created with correct permissions (0600)

---

### Phase 3: Version Comparator Service
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **User-facing feature**: Diff summary is key to user decision-making
- **Builds on file enumeration**: Leverages existing `file-enumerator.ts`
- **Independent logic**: Can be tested in isolation
- **Required for confirmation prompt**: Diff summary shown before user confirms

#### Implementation Steps
1. Create `src/services/version-comparator.ts` with:
   - `compareVersions(installedPath, newPackagePath): Promise<VersionComparison>` - Main comparison function
   - `extractMetadata(skillPath): Promise<SkillMetadata>` - Extract from SKILL.md frontmatter
   - `detectDowngrade(installed, new): DowngradeInfo | null` - Compare dates/versions
   - `calculateFileDiff(installedFiles, newFiles): FileChange[]` - Categorize files:
     - Added: in new, not in installed
     - Removed: in installed, not in new
     - Modified: in both, different size or hash
   - `summarizeChanges(diff): ChangeSummary` - Aggregate stats (counts, size changes)
   - `formatDiffLine(change): string` - Format: `+ file.md (added)` or `~ file.md (modified, +50 bytes)`
2. Use existing components:
   - `collectSkillFiles()` from `file-enumerator.ts` for installed skill
   - `getZipEntries()` from `extractor.ts` for new package
   - `parseFrontmatter()` from `frontmatter-parser.ts` for metadata
   - `hashFile()` from `hash.ts` for thorough comparison (optional, size-only by default)
3. Add comparison types to `src/types/update.ts`:
   - `SkillMetadata` (name, description, version?, lastModified?)
   - `DowngradeInfo` (isDowngrade, installedDate, newDate, message)
   - `ChangeSummary` (added, removed, modified counts and sizes)
4. Unit tests for:
   - File categorization (added/removed/modified)
   - Downgrade detection
   - Size change calculations
   - Empty skill handling

#### Deliverables
- [ ] `src/services/version-comparator.ts` - Complete comparator service
- [ ] Updated `src/types/update.ts` - Comparison types
- [ ] `tests/unit/services/version-comparator.test.ts` - Unit tests
- [ ] Accurate diff calculation for various scenarios

---

### Phase 4: Update Formatter
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Consistent UX**: Follows patterns from install/uninstall formatters
- **Independent component**: Can be built in parallel with generator
- **Required for all output**: Every user-facing message goes through formatter
- **Matches output spec**: Implements exact output format from requirements

#### Implementation Steps
1. Create `src/formatters/update-formatter.ts` with:
   - `formatUpdateProgress(stage, detail): string` - Progress messages for each phase
   - `formatCurrentVersion(info): string` - Display installed skill info
   - `formatNewVersion(info): string` - Display new package info
   - `formatChangeSummary(changes): string` - Diff display (added/removed/modified)
   - `formatBackupInfo(backup): string` - Backup location and status
   - `formatConfirmationPrompt(summary): string` - Full update summary for confirmation
   - `formatDowngradeWarning(info): string` - Warning for apparent downgrades
   - `formatUpdateSuccess(result): string` - Success message with stats
   - `formatRollbackSuccess(result): string` - Rollback successful message
   - `formatRollbackFailed(error): string` - Critical error message
   - `formatDryRun(preview): string` - Dry-run output (no changes made)
   - `formatQuietOutput(result): string` - Single-line output for --quiet
   - `formatError(error): string` - Error formatting with suggestions
   - `formatHardLinkWarning(files): string` - Hard link detection warning
   - `formatLockConflict(lockInfo): string` - Concurrent update error
2. Use existing output utilities:
   - Import `success()`, `error()`, `warning()`, `info()` from `utils/output.ts`
   - Follow color patterns from `install-formatter.ts` and `uninstall-formatter.ts`
3. Match exact output format from requirements document (lines 231-367)
4. Unit tests for:
   - Each format function with sample data
   - Edge cases (empty diffs, large file counts, long paths)
   - Quiet mode output

#### Deliverables
- [ ] `src/formatters/update-formatter.ts` - Complete formatter
- [ ] `tests/unit/formatters/update-formatter.test.ts` - Unit tests
- [ ] Output matches requirements document exactly

---

### Phase 5: Core Update Generator
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Core orchestration**: Ties all components together
- **Depends on Phases 2-4**: Requires backup manager, comparator, and types
- **Complex state management**: Must handle success, failure, and rollback paths
- **Security-critical**: Implements all security requirements

#### Implementation Steps
1. Create `src/generators/updater.ts` with main orchestration:
   - `updateSkill(skillName, packagePath, options): Promise<UpdateResultUnion>` - Main entry point
2. Implement update phases:
   - **Phase A: Input Validation**
     - Use `validateSkillName()` from `validators/uninstall-name.ts` (FR-13)
     - Use `validateUninstallScope()` from `validators/uninstall-scope.ts` (FR-12)
     - Use `validatePackageFile()` from `validators/package-file.ts` (FR-14)
   - **Phase B: Skill Discovery**
     - Use `discoverSkill()` from `generators/skill-discovery.ts` (FR-1)
     - Handle not-found and case-mismatch errors
   - **Phase C: Package Validation**
     - Extract package to temp directory
     - Use `validatePackageStructure()` and `validatePackageContent()` from `install-validator.ts` (FR-2)
     - Verify skill name matches installed skill (FR-2 edge case 15)
   - **Phase D: Security Checks**
     - Use `checkSymlinkSafety()` from `security-checker.ts` for installed skill
     - Use `detectHardLinkWarnings()` for hard link detection (FR-16)
     - Validate ZIP entries for path traversal (FR-15) - leverage existing `install-validator.ts`
     - Require `--force` for hard links
   - **Phase E: Version Comparison**
     - Use `compareVersions()` from `version-comparator.ts` (FR-3)
     - Detect and warn on downgrades
   - **Phase F: Resource Limits**
     - Check skill size < 1GB and file count < 10,000 (NFR-8)
     - Require `--force` to exceed limits
   - **Phase G: Lock Acquisition**
     - Create lock file using existing `lock-file.ts` pattern (FR-17)
     - Check for stale locks (process not running)
   - **Phase H: Backup Creation** (unless `--no-backup`)
     - Use `createBackup()` from `backup-manager.ts` (FR-4)
     - Skip with warning if `--no-backup`
   - **Phase I: Confirmation** (unless `--force`)
     - Display summary using formatter (FR-5)
     - Require explicit y/N confirmation
   - **Phase J: Update Execution** (FR-6)
     - Rename current skill to temporary name (atomic)
     - Extract new package to skill location
     - Verify extraction success
     - If failure: rollback to renamed directory
   - **Phase K: Post-Update Validation** (FR-7)
     - Use `validateSkill()` from `generators/validate.ts`
     - If failure: trigger rollback
   - **Phase L: Cleanup**
     - Remove renamed old directory (success) or restore (failure)
     - Remove backup unless `--keep-backup` (FR-9)
     - Release lock file
     - Log to audit log (NFR-6)
3. Implement rollback logic (FR-8):
   - `rollbackUpdate(skillPath, tempPath, backupPath): Promise<RollbackResult>`
   - Remove partial new installation
   - Restore from renamed temp directory
   - Keep backup on rollback
4. Implement dry-run mode (FR-10):
   - Run phases A-F only
   - Return `UpdateDryRunPreview` with all information
5. Handle signal interruption (NFR-7):
   - Use existing `signal-handler.ts`
   - Clean up lock file on SIGINT/SIGTERM
   - Complete current operation then rollback
6. Unit tests for:
   - Each phase in isolation (mocked dependencies)
   - State transitions (success → cleanup, failure → rollback)
   - Exit code mapping

#### Deliverables
- [ ] `src/generators/updater.ts` - Core update logic (~400-500 lines)
- [ ] `tests/unit/generators/updater.test.ts` - Unit tests
- [ ] All security requirements implemented
- [ ] Rollback logic verified

---

### Phase 6: CLI Command Integration
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Final assembly**: Connects generator to CLI
- **Depends on Phase 5**: Requires complete generator
- **Follows established patterns**: Mirrors install/uninstall command structure
- **User-facing interface**: All options and arguments defined here

#### Implementation Steps
1. Create `src/commands/update.ts` with:
   - Command definition using Commander.js
   - Arguments: `<skill-name>`, `<new-skill-package>`
   - Options:
     - `-s, --scope <scope>` (default: 'project')
     - `-f, --force` - Skip confirmations
     - `-n, --dry-run` - Preview only
     - `-q, --quiet` - Minimal output
     - `--no-backup` - Skip backup (with warning)
     - `--keep-backup` - Preserve backup after success
   - Help text with examples (matching requirements lines 44-65)
2. Implement command handler:
   - Parse and validate options
   - Call `updateSkill()` from generator
   - Handle result discriminated union
   - Format output using `update-formatter.ts`
   - Exit with correct code per FR-11
3. Wire confirmation prompts:
   - Create `confirmUpdate()` in `utils/prompts.ts`
   - Handle `--force` bypass
   - Handle SIGINT during prompt
4. Register command in `src/cli.ts`
5. Update `src/index.ts` if needed
6. Integration tests for:
   - Happy path: `asm update my-skill ./new-version.skill`
   - Scope handling: `--scope personal`
   - Dry-run: `--dry-run`
   - Force: `--force`
   - Quiet: `--quiet`
   - No-backup: `--no-backup` (verify warning)
   - Keep-backup: `--keep-backup`
   - Error cases: skill not found, invalid package

#### Deliverables
- [ ] `src/commands/update.ts` - CLI command implementation
- [ ] Updated `src/cli.ts` - Command registration
- [ ] Updated `src/utils/prompts.ts` - Update confirmation prompt
- [ ] `tests/integration/commands/update.test.ts` - Integration tests
- [ ] Help text matches requirements examples

---

### Phase 7: Comprehensive Testing & Documentation
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Quality assurance**: Ensures all requirements met before release
- **Security verification**: All security tests must pass
- **Documentation**: Users need clear guidance
- **Depends on all phases**: Full implementation required

#### Implementation Steps
1. Complete security test suite (requirements lines 591-684):
   - Input validation tests (path traversal, null bytes, Unicode)
   - Package security tests (ZIP bombs, symlinks, traversal)
   - Symlink tests (escape prevention, TOCTOU)
   - Case sensitivity tests (macOS/Windows)
   - Hard link tests (detection, warning, --force requirement)
   - TOCTOU tests (race condition prevention)
   - Path resolution tests (containment verification)
   - Backup security tests (permissions, path escapes)
   - Resource limit tests (size, count, timeouts)
   - Concurrent access tests (lock files)
   - Signal handling tests (SIGINT cleanup)
2. Edge case tests (requirements lines 536-552):
   - Same version update (info message)
   - Apparent downgrade (warning)
   - Backup directory creation
   - Disk full scenarios
   - Permission denied
   - Skill in use
   - Rollback scenarios
   - Name mismatch rejection
   - Concurrent update rejection
   - **`--no-backup` failure scenario**: Test that when update fails with `--no-backup`:
     - Warning message displayed: "Warning: Update failed and no backup exists. Original skill may be in inconsistent state."
     - Rollback from temp directory attempted
     - If rollback succeeds: Clear message that skill was restored from temp directory
     - If rollback fails: Critical error with manual recovery instructions
     - Audit log captures `--no-backup` flag and failure state
3. Performance benchmark tests (NFR-1 compliance):
   - Package validation completes within 5 seconds for typical packages
   - Full update completes within 30 seconds for skills up to 50MB
   - Backup creation completes within 2 minutes for skills up to 1GB
   - Progress indicators displayed for operations >2 seconds
   - Test fixture: Create test packages of varying sizes (1KB, 1MB, 50MB, 500MB)
   - Benchmark runner: Measure and assert timing thresholds
   - CI integration: Run performance tests on standardized hardware profile
4. Output snapshot tests (formatter verification):
   - Create snapshot fixtures matching requirements document output (lines 231-367)
   - Test `formatUpdateProgress()` against expected progress messages
   - Test `formatCurrentVersion()` / `formatNewVersion()` format
   - Test `formatChangeSummary()` with sample diffs (added/removed/modified)
   - Test `formatConfirmationPrompt()` complete summary
   - Test `formatDowngradeWarning()` warning format
   - Test `formatUpdateSuccess()` success message with stats
   - Test `formatRollbackSuccess()` / `formatRollbackFailed()` messages
   - Test `formatDryRun()` preview output
   - Test `formatQuietOutput()` single-line format
   - Test `formatError()` for each error type with suggestions
   - Snapshot comparison: Exact match against requirements examples
   - Update snapshots intentionally when output format changes
5. Update README.md with:
   - Update command documentation
   - Examples for all options
   - Backup/restore instructions
6. Run full test suite:
   - `npm run quality` must pass
   - Coverage > 80% for new code
   - All security tests passing (100%)

#### Deliverables
- [ ] `tests/security/update-security.test.ts` - Security test suite
- [ ] `tests/integration/update-edge-cases.test.ts` - Edge case tests (including `--no-backup` failure scenario)
- [ ] `tests/performance/update-benchmark.test.ts` - Performance benchmark tests (NFR-1)
- [ ] `tests/unit/formatters/update-formatter.snapshot.test.ts` - Output snapshot tests
- [ ] `tests/fixtures/snapshots/update-output/` - Snapshot fixtures matching requirements output
- [ ] Updated `README.md` - Update command documentation
- [ ] All tests passing with >80% coverage
- [ ] All security tests passing (100%)
- [ ] Performance benchmarks within thresholds (5s validation, 30s update, 2m backup)

---

## Shared Infrastructure

### Reusable Components (No Changes Needed)

| Component | Location | Usage in Update |
|-----------|----------|-----------------|
| Skill Discovery | `generators/skill-discovery.ts` | Find installed skill |
| File Enumeration | `generators/file-enumerator.ts` | Inventory files for backup/diff |
| Scope Resolution | `utils/scope-resolver.ts` | Resolve project/personal paths |
| Package Extraction | `utils/extractor.ts` | Extract new package |
| Install Validation | `generators/install-validator.ts` | Validate new package |
| Security Checks | `generators/security-checker.ts` | Symlink/hard link detection |
| Skill Validation | `generators/validate.ts` | Post-update validation |
| Safe Deletion | `utils/safe-delete.ts` | Cleanup old version |
| Archiver | `utils/archiver.ts` | Create backup ZIP |
| Audit Logger | `utils/audit-logger.ts` | Log operations |
| Error Classes | `utils/errors.ts` | Consistent error handling |
| Prompts | `utils/prompts.ts` | User confirmation |
| Signal Handler | `utils/signal-handler.ts` | SIGINT handling |
| Timeout | `utils/timeout.ts` | Operation timeouts |
| Lock File | `utils/lock-file.ts` | Concurrent access prevention |
| Hash | `utils/hash.ts` | File comparison |
| Frontmatter Parser | `utils/frontmatter-parser.ts` | Extract metadata |
| Output | `utils/output.ts` | Colored output |

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Update Types | `src/types/update.ts` | Type definitions |
| Backup Manager | `src/services/backup-manager.ts` | Create/manage backups |
| Version Comparator | `src/services/version-comparator.ts` | Compare skill versions |
| Update Formatter | `src/formatters/update-formatter.ts` | Format output |
| Update Generator | `src/generators/updater.ts` | Core logic |
| Update Command | `src/commands/update.ts` | CLI interface |

---

## Testing Strategy

### Unit Testing
- **Coverage goal:** >80% for all new code
- **Test framework:** Jest (existing)
- **Focus areas:**
  - Backup creation and security validation
  - Version comparison and diff calculation
  - Output formatting for all scenarios
  - Generator state transitions
  - Error handling and exit codes

### Integration Testing
- **Full workflows:**
  - Update happy path (project and personal scopes)
  - Rollback on validation failure
  - Dry-run preview accuracy
  - Confirmation prompt interaction
  - Force/quiet/no-backup options
- **Error scenarios:**
  - Skill not found
  - Invalid package
  - Name mismatch
  - Permission denied

### Security Testing
- **100% pass rate required**
- **Categories:**
  - Input validation (47 tests)
  - Package security (10 tests)
  - Symlink prevention (8 tests)
  - Case sensitivity (4 tests)
  - Hard link detection (4 tests)
  - TOCTOU protection (5 tests)
  - Path containment (4 tests)
  - Backup security (7 tests)
  - Resource limits (6 tests)
  - Concurrent access (7 tests)
  - Signal handling (4 tests)

### Performance Testing (NFR-1)
- **Threshold enforcement:** Tests fail if timing exceeds limits
- **Test fixtures:** Pre-generated packages of varying sizes
  - Small: 1KB (baseline)
  - Medium: 1MB (typical)
  - Large: 50MB (stress test)
  - XLarge: 500MB (limit test, run separately)
- **Benchmarks:**
  - Package validation: <5 seconds for packages up to 50MB
  - Full update cycle: <30 seconds for skills up to 50MB
  - Backup creation: <2 minutes for skills up to 1GB
  - Progress indicator threshold: 2 seconds
- **CI considerations:**
  - Run on consistent hardware profile
  - Allow 20% variance for CI environment fluctuations
  - XLarge tests marked as slow, run nightly only

### Snapshot Testing (Output Verification)
- **Purpose:** Ensure formatter output matches requirements document exactly
- **Framework:** Jest snapshots with custom serializer for ANSI codes
- **Coverage:**
  - Success output format (requirements lines 233-270)
  - Error output formats (lines 272-302)
  - Rollback output format (lines 304-334)
  - Dry-run output format (lines 336-362)
  - Quiet output format (line 365-367)
  - Downgrade warning format (lines 369-381)
- **Maintenance:**
  - Snapshot updates require explicit approval
  - Changes to output format must update both snapshots and requirements doc
  - CI fails on unexpected snapshot changes

---

## Dependencies and Prerequisites

### External Dependencies
- AdmZip (existing) - ZIP operations
- Commander.js (existing) - CLI framework
- Node.js fs/promises - Async file operations
- Node.js crypto - Random bytes for backup filenames

### Internal Dependencies
- FEAT-004 Install command - Package validation, extraction
- FEAT-005 Uninstall command - Skill discovery, file enumeration, security checks
- FEAT-002 Validate command - Skill validation

### Prerequisites
- Install and uninstall commands working correctly
- Existing test infrastructure
- Security utilities tested and verified

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Rollback fails leaving skill broken | Critical | Low | Atomic rename operations, verify before delete |
| Backup directory permissions wrong | High | Low | Explicit mode in mkdir/open, verification step |
| TOCTOU race conditions | High | Low | File descriptor anchoring, re-verify before operations |
| Lock file stale detection incorrect | Medium | Medium | Robust PID checking, timestamp verification |
| Large skill causes timeout | Medium | Low | Configurable timeout, progress indicators |
| Case sensitivity issues on macOS | Medium | Medium | Byte-for-byte name comparison after path resolution |
| Concurrent updates corrupt skill | High | Low | Atomic lock file creation (O_CREAT \| O_EXCL) |

---

## Success Criteria

### Phase Completion
Each phase must meet:
- [ ] All implementation steps completed
- [ ] Unit tests passing
- [ ] No TypeScript errors
- [ ] Code review completed

### Feature Completion
- [ ] All functional requirements FR-1 through FR-17 implemented
- [ ] All non-functional requirements NFR-1 through NFR-8 met
- [ ] Exit codes match specification (0-7)
- [ ] Output format matches requirements exactly
- [ ] All edge cases handled (20 cases)
- [ ] Security tests 100% passing
- [ ] Integration tests >80% coverage
- [ ] Documentation updated
- [ ] Updated skills work correctly in Claude Code

---

## Code Organization

### New Directory Structure

```
src/
├── commands/
│   └── update.ts              # Phase 6: CLI command
├── generators/
│   └── updater.ts             # Phase 5: Core logic
├── services/
│   ├── backup-manager.ts      # Phase 2: Backup operations
│   └── version-comparator.ts  # Phase 3: Version comparison
├── formatters/
│   └── update-formatter.ts    # Phase 4: Output formatting
└── types/
    └── update.ts              # Phase 1: Type definitions

tests/
├── unit/
│   ├── services/
│   │   ├── backup-manager.test.ts
│   │   └── version-comparator.test.ts
│   ├── formatters/
│   │   ├── update-formatter.test.ts
│   │   └── update-formatter.snapshot.test.ts  # Phase 7: Snapshot tests
│   └── generators/
│       └── updater.test.ts
├── integration/
│   ├── commands/
│   │   └── update.test.ts
│   └── update-edge-cases.test.ts              # Phase 7: Edge cases incl. --no-backup failure
├── performance/
│   └── update-benchmark.test.ts               # Phase 7: NFR-1 benchmarks
├── fixtures/
│   ├── packages/                              # Test packages of varying sizes
│   │   ├── small-skill.skill                  # 1KB
│   │   ├── medium-skill.skill                 # 1MB
│   │   └── large-skill.skill                  # 50MB (generated)
│   └── snapshots/
│       └── update-output/                     # Phase 7: Output snapshots
│           ├── success-output.snap
│           ├── error-output.snap
│           ├── rollback-output.snap
│           ├── dry-run-output.snap
│           ├── quiet-output.snap
│           └── downgrade-warning.snap
└── security/
    └── update-security.test.ts
```

---

## Development Guidelines

### Code Style
- Follow existing project TypeScript patterns
- Use discriminated unions for result types
- Prefer async/await over callbacks
- Document security-critical functions

### Commit Strategy
- One phase per branch (feat/FEAT-008-phase-N)
- Squash merge to feature branch
- Reference FEAT-008 and #16 in commits

### Review Process
- Security-sensitive code requires extra review
- Test coverage verified before merge
- Manual testing of update/rollback scenarios

---

## Conclusion

The FEAT-008 update command builds on the robust foundation established by FEAT-004 (install) and FEAT-005 (uninstall). By leveraging 35+ existing components, the implementation focuses on:

1. **New orchestration logic** in the updater generator
2. **Backup/rollback safety** through the backup manager
3. **User visibility** via version comparison and detailed output
4. **Comprehensive security** with 100 security tests

The 7-phase approach ensures incremental progress with testable milestones:
- Phases 1-4 build independent components in parallel-friendly order
- Phase 5 integrates everything into core logic
- Phase 6 exposes functionality to users
- Phase 7 ensures quality and documentation

This completes the skill lifecycle management: create → validate → package → install → **update** → uninstall.
