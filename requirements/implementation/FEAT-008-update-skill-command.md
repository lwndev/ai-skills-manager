# Implementation Plan: Update Skill Command

## Overview

This plan details the implementation of the `asm update` command (FEAT-008), which enables users to safely update installed skills to newer versions from `.skill` packages. The update command combines install functionality (package validation, extraction) with uninstall functionality (skill discovery, file enumeration) while adding backup/rollback capabilities.

The implementation leverages 35+ existing components from FEAT-004 (install) and FEAT-005 (uninstall), minimizing new code while ensuring comprehensive security and reliability.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-008 | [#16](https://github.com/lwndev/ai-skills-manager/issues/16) | [FEAT-008-update-skill-command.md](../features/FEAT-008-update-skill-command.md) | Medium | High | Pending |

## Recommended Build Sequence

This implementation uses 14 phases, splitting the complex updater logic and comprehensive testing into manageable increments:

- **Phases 1-4**: Foundation (types, backup, comparator, formatter)
- **Phases 5-9**: Core updater logic (split from original monolithic phase)
- **Phase 10**: CLI command integration
- **Phases 11-14**: Testing and documentation (split from original monolithic phase)

---

### Phase 1: Type Definitions & Infrastructure
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** ✅ Complete

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
- [x] `src/types/update.ts` - Complete type definitions
- [x] Updated `src/utils/errors.ts` - Update-specific error classes
- [x] Updated `src/types/index.ts` - Export new types
- [x] Type definitions compile without errors

---

### Phase 2: Backup Manager Service
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** ✅ Complete

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
   - `BackupWritabilityResult` (writable, error?)
4. Implement backup writability check (Edge case 20):
   - `validateBackupWritability(): Promise<BackupWritabilityResult>` - Check before any operations
   - Test write permissions by creating/removing temp file in backup directory
   - Return clear error if backup location not writable
   - Skip check if `--no-backup` flag is set
5. Implement backup collision handling (Edge case 7):
   - After generating filename, check if file already exists
   - If exists: regenerate with new random component (up to 3 attempts)
   - If still collides: append incrementing suffix (-1, -2, etc.)
   - Log warning if collision detected
6. Implement streaming backup creation (NFR-8):
   - Use streaming ZIP creation (don't buffer entire skill in memory)
   - Process files incrementally using async iterators
   - Track progress for large skills (>100 files or >10MB)
7. Unit tests for:
   - Backup directory creation and validation
   - Filename generation (format, uniqueness, randomness)
   - Security validations (symlink rejection, containment)
   - Successful backup creation and verification

#### Deliverables
- [x] `src/services/backup-manager.ts` - Complete backup service
- [x] Updated `src/types/update.ts` - Backup types
- [x] `tests/unit/services/backup-manager.test.ts` - Unit tests
- [x] Backup directory created with correct permissions (0700)
- [x] Backup files created with correct permissions (0600)
- [x] Backup writability verified before update starts
- [x] Backup filename collision handling implemented
- [x] Streaming backup creation for memory efficiency

---

### Phase 3: Version Comparator Service
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** ✅ Complete

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
     - Modified: in both, different size (or hash if sizes equal)
     - Use size comparison first (fast), hash comparison only when sizes match (NFR-8)
   - `summarizeChanges(diff): ChangeSummary` - Aggregate stats (counts, size changes)
   - `formatDiffLine(change): string` - Format: `+ file.md (added)` or `~ file.md (modified, +50 bytes)`
2. Use existing components:
   - `collectSkillFiles()` from `file-enumerator.ts` for installed skill
   - `getZipEntries()` from `extractor.ts` for new package
   - `parseFrontmatter()` from `frontmatter-parser.ts` for metadata
   - `hashFile()` from `hash.ts` for thorough comparison (optional, size-only by default)
3. Implement memory-safe comparison (NFR-8):
   - Use streaming enumeration via async generators for file lists
   - Compare files incrementally, not loading all paths into memory at once
   - For file content comparison: use size first, hash only if sizes match
   - Limit in-memory file list to 1000 entries; stream beyond that
   - `streamFileComparison(installed, new): AsyncGenerator<FileChange>` - Yield changes incrementally
4. Add comparison types to `src/types/update.ts`:
   - `SkillMetadata` (name, description, version?, lastModified?)
   - `DowngradeInfo` (isDowngrade, installedDate, newDate, message)
   - `ChangeSummary` (added, removed, modified counts and sizes)
5. Unit tests for:
   - File categorization (added/removed/modified)
   - Downgrade detection
   - Size change calculations
   - Empty skill handling

#### Deliverables
- [x] `src/services/version-comparator.ts` - Complete comparator service
- [x] Updated `src/types/update.ts` - Comparison types (from Phase 1)
- [x] `tests/unit/services/version-comparator.test.ts` - Unit tests (31 tests)
- [x] Accurate diff calculation for various scenarios
- [x] Streaming comparison for large skills (>1000 files)
- [x] Memory usage bounded during diff calculation

---

### Phase 4: Update Formatter
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** ✅ Complete

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
2. Implement progress indicator formatting (NFR-1):
   - `formatProgressBar(current, total, label): string` - Render progress bar
   - `formatProgressSpinner(stage): string` - Spinning indicator for indeterminate progress
   - `shouldShowProgress(startTime): boolean` - Returns true if >2 seconds elapsed
   - Progress format: `[████████░░░░░░░░] 50% Backing up files...`
   - Use carriage return (`\r`) for in-place updates in TTY mode
   - Fall back to periodic line output in non-TTY mode
3. Use existing output utilities:
   - Import `success()`, `error()`, `warning()`, `info()` from `utils/output.ts`
   - Follow color patterns from `install-formatter.ts` and `uninstall-formatter.ts`
4. Match exact output format from requirements document (lines 231-367)
5. Unit tests for:
   - Each format function with sample data
   - Edge cases (empty diffs, large file counts, long paths)
   - Quiet mode output

#### Deliverables
- [x] `src/formatters/update-formatter.ts` - Complete formatter (31 functions)
- [x] `tests/unit/formatters/update-formatter.test.ts` - Unit tests (75 tests)
- [x] Output matches requirements document exactly
- [x] Progress bar formatting for determinate operations
- [x] Progress spinner for indeterminate operations
- [x] 2-second threshold before showing progress (NFR-1)

---

### Phase 5: Updater - Input & Discovery
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** ✅ Complete

#### Rationale
- **Foundation for updater**: Establishes the updater module structure
- **Depends on Phases 1-4**: Requires types, backup manager, comparator, and formatter
- **Validates inputs early**: Fails fast on invalid inputs before any file operations
- **Reuses existing validators**: Leverages install/uninstall validation logic

#### Implementation Steps
1. Create `src/generators/updater.ts` with module structure:
   - `updateSkill(skillName, packagePath, options): Promise<UpdateResultUnion>` - Main entry point (stub)
   - Internal phase orchestration framework
   - Result type handling
2. Implement Input Validation:
   - Use `validateSkillName()` from `validators/uninstall-name.ts` (FR-13)
   - Use `validateUninstallScope()` from `validators/uninstall-scope.ts` (FR-12)
   - Use `validatePackageFile()` from `validators/package-file.ts` (FR-14)
   - Return early with appropriate `UpdateError` on validation failure
3. Implement Skill Discovery:
   - Use `discoverSkill()` from `generators/skill-discovery.ts` (FR-1)
   - Handle not-found error with clear message
   - Handle case-mismatch error with suggestion
4. Implement case sensitivity verification (NFR-3):
   - After discovering skill path, read parent directory entries with `fs.readdir()`
   - Find the actual entry name that matches (case-insensitive)
   - Compare actual entry name byte-for-byte with input skill name
   - If case differs (e.g., input "my-skill" but actual "My-Skill"):
     - Return security error (exit code 5)
     - Message: "Security error: Skill name case mismatch. Input: '<input>', Actual: '<actual>'"
   - This prevents symlink substitution attacks on case-insensitive filesystems (macOS/Windows)
5. Implement Package Validation:
   - Extract package to temp directory using `extractPackage()` from `utils/extractor.ts`
   - Use `validatePackageStructure()` from `install-validator.ts` (FR-2)
   - Use `validatePackageContent()` from `install-validator.ts` (FR-2)
   - Verify skill name matches installed skill (FR-2 edge case 15)
   - Clean up temp directory on validation failure
6. Unit tests for:
   - Input validation (valid and invalid cases)
   - Skill discovery (found, not-found, case-mismatch)
   - Case sensitivity verification (exact match required)
   - Case mismatch rejection with clear error
   - Package validation (valid, invalid structure, name mismatch)

#### Deliverables
- [x] `src/generators/updater.ts` - Module structure with input/discovery/package validation
- [x] `tests/unit/generators/updater.test.ts` - Unit tests for Phase 5 functionality (38 tests)
- [x] Input validation working with appropriate error messages
- [x] Skill discovery integrated with error handling
- [x] Case sensitivity verification preventing symlink substitution attacks

---

### Phase 6: Updater - Security & Analysis
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Security before modification**: All security checks complete before any file changes
- **Depends on Phase 5**: Requires validated inputs and discovered skill
- **Leverages existing security**: Reuses security-checker.ts from install/uninstall
- **Provides user visibility**: Version comparison shows what will change

#### Implementation Steps
1. Implement Security Checks:
   - Use `checkSymlinkSafety()` from `security-checker.ts` for installed skill
   - Use `detectHardLinkWarnings()` for hard link detection (FR-16)
   - Validate ZIP entries for path traversal (FR-15) - leverage existing `install-validator.ts`
   - Require `--force` for hard links, return error otherwise
2. Implement TOCTOU-safe file operations (NFR-3):
   - Open skill directory with `O_DIRECTORY | O_NOFOLLOW` flag at start
   - Store directory file descriptor for duration of operation
   - Use `fstatat(dirFd, filename, AT_SYMLINK_NOFOLLOW)` before each file operation
   - Implement `openat()`/`unlinkat()` pattern for file operations:
     - `safeOpenAt(dirFd, relativePath, flags): Promise<number>` - Open relative to directory FD
     - `safeUnlinkAt(dirFd, relativePath): Promise<void>` - Unlink relative to directory FD
     - `safeStatAt(dirFd, relativePath): Promise<Stats>` - Stat relative to directory FD
   - Re-verify containment immediately before each destructive operation
   - Reject operation if any path resolves outside expected scope during execution
   - Note: Node.js doesn't expose `openat()` directly; implement via:
     - Opening directory, then using relative paths with realpath verification
     - Or use native addon for true `openat()` support (optional enhancement)
3. Implement Version Comparison:
   - Use `compareVersions()` from `version-comparator.ts` (FR-3)
   - Detect and warn on apparent downgrades
   - Calculate file diff (added, removed, modified)
4. Implement Resource Limits (NFR-8):
   - Check skill size < 1GB and file count < 10,000
   - Require `--force` to exceed limits
   - Return clear error with limit values
   - Implement operation timeouts using `utils/timeout.ts`:
     - Complete update timeout: 5 minutes (300,000ms)
     - Backup creation timeout: 2 minutes (120,000ms)
     - Extraction timeout: 2 minutes (120,000ms)
     - Package validation timeout: 5 seconds (5,000ms) per NFR-1
   - Wrap long-running operations with timeout:
     - `withTimeout(operation, timeoutMs, operationName): Promise<T>`
   - On timeout: clean up partial state, return clear error
5. Unit tests for:
   - Security check pass/fail scenarios
   - Hard link detection and --force requirement
   - TOCTOU protection (file descriptor anchoring)
   - Version comparison accuracy
   - Resource limit enforcement
   - Operation timeout enforcement
   - Timeout cleanup behavior

#### Deliverables
- [ ] Updated `src/generators/updater.ts` - Security checks and version comparison
- [ ] Updated `tests/unit/generators/updater.test.ts` - Phase 6 tests
- [ ] Security checks blocking unsafe operations
- [ ] Version comparison providing accurate diffs
- [ ] TOCTOU-safe file operations using directory FD anchoring
- [ ] Operation timeouts enforced (5min update, 2min backup, 2min extraction)

---

### Phase 7: Updater - Preparation
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Pre-execution setup**: Lock, backup, and confirm before any destructive operations
- **Depends on Phase 6**: Requires security checks to pass first
- **User confirmation**: Last chance to abort before changes
- **Safety net**: Backup created before any modifications

#### Implementation Steps
1. Implement Lock Acquisition:
   - Create lock file using existing `lock-file.ts` pattern (FR-17)
   - Check for stale locks (process not running)
   - Return `UpdateError` if lock cannot be acquired
2. Implement Backup Creation (unless `--no-backup`):
   - First call `validateBackupWritability()` from `backup-manager.ts` (Edge case 20)
   - If not writable and not `--no-backup`: return error before any modifications
   - Use `createBackup()` from `backup-manager.ts` (FR-4)
   - Store backup path for potential rollback
   - Skip with warning if `--no-backup` flag set
   - Log backup location to user
   - Show progress indicator if backup takes >2 seconds (NFR-1)
3. Implement Confirmation (unless `--force`):
   - Format summary using `update-formatter.ts` (FR-5)
   - Display version comparison, file changes, backup location
   - Require explicit y/N confirmation
   - Return `UserCancelledError` on 'n' or Ctrl+C
4. Unit tests for:
   - Lock acquisition success/failure
   - Backup creation success/failure
   - Confirmation prompt handling
   - --force and --no-backup flag behavior

#### Deliverables
- [ ] Updated `src/generators/updater.ts` - Lock, backup, and confirmation
- [ ] Updated `tests/unit/generators/updater.test.ts` - Phase 7 tests
- [ ] Lock file preventing concurrent updates
- [ ] Backup created with correct format and permissions

---

### Phase 8: Updater - Execution & Cleanup
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Core update logic**: Performs the actual file replacement
- **Depends on Phase 7**: Requires lock acquired and backup created
- **Atomic operation**: Uses rename for safe replacement
- **Post-validation**: Verifies update succeeded before cleanup

#### Implementation Steps
1. Implement Update Execution (FR-6):
   - Rename current skill to temporary name (atomic operation)
   - Extract new package to skill location using `extractPackage()`
   - Verify extraction success (all files present)
   - If extraction fails: immediately restore renamed directory
2. Implement Post-Update Validation (FR-7):
   - Use `validateSkill()` from `generators/validate.ts`
   - Verify SKILL.md present and valid
   - If validation fails: trigger rollback
3. Implement Cleanup:
   - On success: Remove renamed old directory using `safeDelete()`
   - On success: Remove backup unless `--keep-backup` (FR-9)
   - Always: Release lock file
   - Always: Log to audit log with exact format (NFR-6):
     ```
     [ISO-8601 timestamp] UPDATE <skill-name> <scope> <status> <details>
     ```
     Where:
     - timestamp: e.g., `2025-01-15T14:30:00.000Z`
     - skill-name: validated skill name
     - scope: `project` or `personal`
     - status: `SUCCESS`, `FAILED`, `ROLLED_BACK`, or `ROLLBACK_FAILED`
     - details: JSON object with:
       - `packagePath`: source package path
       - `backupPath`: backup location (if created)
       - `previousFiles`: file count before
       - `currentFiles`: file count after (on success)
       - `error`: error message (on failure)
       - `noBackup`: boolean if --no-backup was used
   - Use existing `audit-logger.ts` with update-specific formatter
4. Unit tests for:
   - Successful update flow
   - Extraction failure handling
   - Post-validation failure handling
   - Cleanup in success and failure cases

#### Deliverables
- [ ] Updated `src/generators/updater.ts` - Execution and cleanup logic
- [ ] Updated `tests/unit/generators/updater.test.ts` - Phase 8 tests
- [ ] Atomic update operation working
- [ ] Proper cleanup in all scenarios
- [ ] Audit log entries follow exact format from NFR-6
- [ ] Audit log captures --no-backup flag usage

---

### Phase 9: Updater - Recovery Paths
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Reliability**: Ensures skill is never left in broken state
- **Depends on Phase 8**: Requires update execution logic complete
- **Multiple recovery paths**: Handles rollback, dry-run, and signal interruption
- **User confidence**: Clear feedback on recovery actions

#### Implementation Steps
1. Implement Rollback Logic (FR-8):
   - `rollbackUpdate(skillPath, tempPath, backupPath): Promise<RollbackResult>`
   - Remove partial new installation if present
   - Restore from renamed temp directory (preferred) or backup
   - Keep backup on rollback for manual recovery
   - Return `UpdateRollbackError` on successful rollback
   - Return `UpdateCriticalError` if rollback also fails
2. Implement Dry-Run Mode (FR-10):
   - Run phases 5-6 only (input, discovery, package, security, comparison)
   - Skip phases 7-8 (lock, backup, confirmation, execution)
   - Return `UpdateDryRunPreview` with all information
   - Format output using `formatDryRun()` from formatter
3. Implement Signal Handling (NFR-7):
   - Use existing `signal-handler.ts`
   - Clean up lock file on SIGINT/SIGTERM
   - If mid-execution: complete current atomic operation then rollback
   - If pre-execution: clean exit with no changes
   - Track current operation phase for proper cleanup:
     - `Phase.VALIDATION`: exit immediately, no cleanup needed
     - `Phase.BACKUP`: complete backup, then exit
     - `Phase.EXECUTION`: complete current file op, then rollback
     - `Phase.CLEANUP`: complete cleanup, then exit
   - Display clear state after interruption showing what was preserved/rolled back
4. Unit tests for:
   - Rollback from various failure points
   - Rollback failure handling (critical error)
   - Dry-run output accuracy
   - Signal handling cleanup

#### Deliverables
- [ ] Updated `src/generators/updater.ts` - Complete with all recovery paths (~400-500 lines total)
- [ ] Updated `tests/unit/generators/updater.test.ts` - Complete unit test coverage
- [ ] Rollback working from any failure point
- [ ] Dry-run providing accurate preview
- [ ] Signal handling cleaning up properly

---

### Phase 10: CLI Command Integration
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Final assembly**: Connects generator to CLI
- **Depends on Phases 5-9**: Requires complete updater generator
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

### Phase 11: Security Tests
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Security first**: All security tests must pass before release
- **Depends on Phase 10**: Requires complete CLI command
- **Comprehensive coverage**: Tests all attack vectors
- **100% pass rate required**: No security compromises allowed

#### Implementation Steps
1. Create `tests/security/update-security.test.ts` with test categories:
   - Input validation tests (path traversal, null bytes, Unicode)
   - Package security tests (ZIP bombs, symlinks, traversal)
   - Symlink tests (escape prevention, TOCTOU)
   - Case sensitivity tests (macOS/Windows)
   - Hard link tests (detection, warning, --force requirement)
2. Add additional security test categories:
   - TOCTOU tests (race condition prevention)
   - Path resolution tests (containment verification)
   - Backup security tests (permissions, path escapes)
   - Resource limit tests (size, count, timeouts)
   - Concurrent access tests (lock files)
   - Signal handling tests (SIGINT cleanup)
3. Run security test suite and fix any failures
4. Document security test coverage

#### Deliverables
- [ ] `tests/security/update-security.test.ts` - Complete security test suite
- [ ] All security tests passing (100%)
- [ ] Security test coverage documented

---

### Phase 12: Edge Cases & Integration Tests
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **Real-world scenarios**: Tests actual user workflows
- **Depends on Phase 11**: Security tests should pass first
- **Error handling**: Verifies graceful degradation
- **Rollback verification**: Ensures recovery works correctly

#### Implementation Steps
1. Create `tests/integration/update-edge-cases.test.ts` with scenarios:
   - Same version update (info message)
   - Apparent downgrade (warning)
   - Backup directory creation
   - Disk full scenarios
   - Permission denied
   - Skill in use
2. Add rollback and error scenarios:
   - Rollback from extraction failure
   - Rollback from validation failure
   - Name mismatch rejection
   - Concurrent update rejection
3. Test `--no-backup` failure scenario:
   - Warning message displayed: "Warning: Update failed and no backup exists..."
   - Rollback from temp directory attempted
   - If rollback succeeds: Clear message that skill was restored
   - If rollback fails: Critical error with manual recovery instructions
   - Audit log captures `--no-backup` flag and failure state
4. Run integration tests and verify all pass

#### Deliverables
- [ ] `tests/integration/update-edge-cases.test.ts` - Edge case tests
- [ ] `--no-backup` failure scenario fully tested
- [ ] All integration tests passing
- [ ] Coverage > 80% for edge case code paths

---

### Phase 13: Performance & Snapshot Tests
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **NFR-1 compliance**: Performance thresholds must be met
- **Depends on Phase 12**: Core functionality verified first
- **Output verification**: Formatter output matches requirements exactly
- **Regression prevention**: Snapshots catch unintended output changes

#### Implementation Steps
1. Create performance test fixtures:
   - Small package: 1KB (baseline)
   - Medium package: 1MB (typical)
   - Large package: 50MB (stress test)
   - XLarge package: 500MB (limit test, run separately)
2. Create `tests/performance/update-benchmark.test.ts`:
   - Package validation: <5 seconds for packages up to 50MB
   - Full update cycle: <30 seconds for skills up to 50MB
   - Backup creation: <2 minutes for skills up to 1GB
   - Progress indicator threshold: 2 seconds
   - Allow 20% variance for CI environment fluctuations
3. Create output snapshot tests:
   - `tests/unit/formatters/update-formatter.snapshot.test.ts`
   - Test all formatter functions against expected output
   - Create `tests/fixtures/snapshots/update-output/` directory
   - Snapshots for: success, error, rollback, dry-run, quiet, downgrade-warning
4. Run benchmarks and snapshot tests

#### Deliverables
- [ ] `tests/fixtures/packages/` - Test packages of varying sizes
- [ ] `tests/performance/update-benchmark.test.ts` - Performance benchmark tests
- [ ] `tests/unit/formatters/update-formatter.snapshot.test.ts` - Snapshot tests
- [ ] `tests/fixtures/snapshots/update-output/` - Snapshot fixtures
- [ ] Performance benchmarks within thresholds (5s validation, 30s update, 2m backup)

---

### Phase 14: Documentation & Final QA
**Feature:** [FEAT-008](../features/FEAT-008-update-skill-command.md) | [#16](https://github.com/lwndev/ai-skills-manager/issues/16)
**Status:** Pending

#### Rationale
- **User guidance**: Clear documentation for update command
- **Depends on Phases 11-13**: All tests must pass first
- **Quality gate**: Final verification before release
- **Complete feature**: Ready for merge

#### Implementation Steps
1. Update README.md with:
   - Update command documentation
   - Examples for all options (--force, --dry-run, --quiet, --no-backup, --keep-backup)
   - Backup/restore instructions
   - Troubleshooting section
2. Run full quality suite:
   - `npm run quality` must pass
   - Verify coverage > 80% for all new code
   - Verify all security tests passing (100%)
   - Verify all performance benchmarks met
3. Manual testing verification:
   - Test update happy path in real environment
   - Test rollback scenario manually
   - Verify output matches requirements document
4. Final review and cleanup:
   - Remove any TODO comments
   - Verify all deliverables complete
   - Update implementation plan status to Complete

#### Deliverables
- [ ] Updated `README.md` - Update command documentation
- [ ] All tests passing with >80% coverage
- [ ] `npm run quality` passing
- [ ] Manual testing completed
- [ ] Implementation plan marked complete

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
│   └── update.ts              # Phase 10: CLI command
├── generators/
│   └── updater.ts             # Phases 5-9: Core logic
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
│   │   └── update-formatter.snapshot.test.ts  # Phase 13: Snapshot tests
│   └── generators/
│       └── updater.test.ts
├── integration/
│   ├── commands/
│   │   └── update.test.ts
│   └── update-edge-cases.test.ts              # Phase 12: Edge cases incl. --no-backup failure
├── performance/
│   └── update-benchmark.test.ts               # Phase 13: NFR-1 benchmarks
├── fixtures/
│   ├── packages/                              # Test packages of varying sizes
│   │   ├── small-skill.skill                  # 1KB
│   │   ├── medium-skill.skill                 # 1MB
│   │   └── large-skill.skill                  # 50MB (generated)
│   └── snapshots/
│       └── update-output/                     # Phase 13: Output snapshots
│           ├── success-output.snap
│           ├── error-output.snap
│           ├── rollback-output.snap
│           ├── dry-run-output.snap
│           ├── quiet-output.snap
│           └── downgrade-warning.snap
└── security/
    └── update-security.test.ts                # Phase 11: Security tests
```

---

## Development Guidelines

### Code Style
- Follow existing project TypeScript patterns
- Use discriminated unions for result types
- Prefer async/await over callbacks
- Document security-critical functions

### Commit Strategy
- One commit per phase
- Squash merge to feature branch when PR is merged
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

The 14-phase approach ensures incremental progress with testable milestones:
- **Phases 1-4**: Build independent foundation components (types, backup, comparator, formatter)
- **Phases 5-9**: Implement updater logic incrementally (input → security → preparation → execution → recovery)
- **Phase 10**: Expose functionality to users via CLI
- **Phases 11-14**: Ensure quality (security tests → edge cases → performance → documentation)

This completes the skill lifecycle management: create → validate → package → install → **update** → uninstall.
