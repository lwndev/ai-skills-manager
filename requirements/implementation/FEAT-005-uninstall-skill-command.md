# Implementation Plan: Uninstall Skill Command

## Overview

Implement the `asm uninstall` command that enables users to remove installed Claude Code skills from their local or project skill directories. This command completes the skill lifecycle management workflow by providing the inverse operation to `asm install`, allowing users to remove skills that are unused, outdated, or causing issues.

This implementation prioritizes security due to the destructive nature of the operation. The command restricts scope to only the two official Claude Code skill locations (`project` and `personal`), validates skill names rigorously to prevent path traversal attacks, and implements comprehensive symlink and hard link detection to prevent unintended file system modifications.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-005   | [#5](https://github.com/lwndev/ai-skills-manager/issues/5) | [FEAT-005-uninstall-skill-command.md](../features/FEAT-005-uninstall-skill-command.md) | High | High | Pending |

## Recommended Build Sequence

### Phase 1: Skill Name Validation & Security Foundation
**Feature:** [FEAT-005](../features/FEAT-005-uninstall-skill-command.md) | [#5](https://github.com/lwndev/ai-skills-manager/issues/5) (Security Foundation)
**Status:** ✅ Complete

#### Rationale
- Security validation must be implemented first before any file system operations
- Establishes the critical input validation layer (FR-11) that prevents path traversal attacks
- Creates reusable validators that will be used in all subsequent phases
- Strict scope validation (FR-3) eliminates an entire class of security vulnerabilities
- Must be built first as all other phases depend on validated, safe inputs

#### Implementation Steps
1. Create `src/validators/uninstall-name.ts`:
   - `validateSkillName(name: string): ValidationResult` - Comprehensive skill name validation
   - Reject path separators (`/` and `\`)
   - Reject `.` and `..` names
   - Reject absolute paths (starting with `/` or drive letters)
   - Reject null bytes and control characters (Unicode points 0x00-0x1F, 0x7F)
   - Reject any non-ASCII characters (simplest Unicode attack defense)
   - Validate format: lowercase a-z, digits 0-9, hyphens only
   - Validate length: 1-64 characters
   - Reject names starting or ending with hyphen
   - Return clear error messages for each violation type
2. Create `src/validators/uninstall-scope.ts`:
   - `validateUninstallScope(scope: string | undefined): ValidationResult` - Scope validation
   - Only accept `project` or `personal` (case-sensitive)
   - Reject any other value with clear error: "Invalid scope. Only 'project' or 'personal' are supported."
   - Default to `project` if undefined
3. Create `src/types/uninstall.ts`:
   - `UninstallOptions` interface (scope, force, dryRun, quiet, skillNames)
   - `UninstallResult` interface (success, skillName, path, filesRemoved, bytesFreed)
   - `DryRunPreview` interface (type: 'dry-run-preview', files, totalSize)
   - `SkillInfo` interface (name, path, files, totalSize, hasSkillMd, warnings)
   - `UninstallError` type union for different error scenarios
   - Type discriminants for type-safe result handling
4. Add error types to `src/utils/errors.ts`:
   - `SkillNotFoundError` - Skill directory doesn't exist
   - `SecurityError` - Path traversal, symlink escape, or other security issues
5. Write comprehensive unit tests for validators including all attack vectors

#### Deliverables
- [x] `src/validators/uninstall-name.ts` - Skill name validation with security checks
- [x] `src/validators/uninstall-scope.ts` - Scope validation (project/personal only)
- [x] `src/types/uninstall.ts` - Uninstall type definitions
- [x] Enhanced `src/utils/errors.ts` with uninstall-specific errors
- [x] `tests/unit/validators/uninstall-name.test.ts` - Name validation tests
- [x] `tests/unit/validators/uninstall-scope.test.ts` - Scope validation tests

---

### Phase 2: Skill Discovery & Pre-Removal Validation
**Feature:** [FEAT-005](../features/FEAT-005-uninstall-skill-command.md) | [#5](https://github.com/lwndev/ai-skills-manager/issues/5) (Discovery)
**Status:** ✅ Complete

#### Rationale
- Builds on Phase 1 validation to locate skills safely
- Implements skill discovery (FR-1) with security-first approach
- Adds SKILL.md verification to confirm valid skill directories
- Implements case sensitivity verification (NFR-3) for case-insensitive filesystems
- Pre-removal validation (FR-2) provides informational warnings
- Creates foundation for file listing used in confirmation prompts and deletion

#### Implementation Steps
1. Create `src/generators/skill-discovery.ts`:
   - `discoverSkill(skillName: string, scopeInfo: ScopeInfo): Promise<SkillDiscoveryResult>`
     - Construct path: `<scope-path>/<validated-skill-name>`
     - Check if directory exists using `fs.access()`
     - Verify case matches exactly on filesystem (read parent dir, compare names)
     - Check for SKILL.md presence
     - Return `found`, `notFound`, or `caseMatch` error result
   - `verifyCaseSensitivity(skillPath: string, expectedName: string): Promise<CaseVerifyResult>`
     - Read parent directory with `fs.readdir()`
     - Find actual entry name that matches case-insensitively
     - Compare byte-for-byte with expected name
     - Return mismatch error if different (prevents symlink substitution attack)
   - `verifySkillMd(skillPath: string): Promise<SkillMdResult>`
     - Check SKILL.md exists
     - Return warning if missing (require --force to proceed)
2. Create `src/generators/file-enumerator.ts`:
   - `enumerateSkillFiles(skillPath: string): AsyncGenerator<FileInfo>`
     - Stream files using recursive `fs.readdir()` with async iteration
     - Yield file info: path, size, isDirectory, isSymlink, linkCount
     - Do NOT follow symlinks (use `fs.lstat()` not `fs.stat()`)
     - Identify directory symlinks for special handling
   - `getSkillSummary(skillPath: string): Promise<SkillSummary>`
     - Total file count, directory count, total size
     - Uses streaming enumeration for memory efficiency
   - `checkResourceLimits(summary: SkillSummary): ResourceLimitResult`
     - Warn if >10,000 files
     - Warn if >1 GB total size
     - Require --force to proceed if limits exceeded
3. Create `src/generators/pre-removal-validator.ts`:
   - `validateBeforeRemoval(skillPath: string): Promise<PreRemovalResult>`
     - Run existing `validateForPackaging()` from package-validator
     - Return validation warnings (informational only, don't block)
   - `detectUnexpectedFiles(skillPath: string): Promise<UnexpectedFilesResult>`
     - Check for `.git`, `node_modules`, large binaries (>10MB)
     - Require --force if unexpected files detected
4. Write unit tests for all discovery and enumeration functions

#### Deliverables
- [x] `src/generators/skill-discovery.ts` - Skill location and verification
- [x] `src/generators/file-enumerator.ts` - Streaming file enumeration
- [x] `src/generators/pre-removal-validator.ts` - Pre-removal checks
- [x] `tests/unit/generators/skill-discovery.test.ts` - Discovery tests
- [x] `tests/unit/generators/file-enumerator.test.ts` - Enumerator tests
- [x] `tests/unit/generators/pre-removal-validator.test.ts` - Pre-removal tests

---

### Phase 3: Security Checks (Symlinks, Hard Links, TOCTOU)
**Feature:** [FEAT-005](../features/FEAT-005-uninstall-skill-command.md) | [#5](https://github.com/lwndev/ai-skills-manager/issues/5) (Security Hardening)
**Status:** Pending

#### Rationale
- Implements critical security checks before any deletion occurs
- Symlink handling (NFR-3) prevents deletion of files outside skill directory
- Hard link detection (FR-12) warns about files that exist in multiple locations
- TOCTOU protection (NFR-3) prevents race condition attacks during deletion
- Containment verification ensures resolved paths stay within scope
- Must be implemented before the deletion logic in Phase 4

#### Implementation Steps
1. Create `src/generators/security-checker.ts`:
   - `checkSymlinkSafety(skillPath: string): Promise<SymlinkCheckResult>`
     - Check if skill directory itself is a symlink using `fs.lstat()`
     - If symlink, resolve target with `fs.realpath()`
     - Verify target is within scope using `isPathWithin()` from scope-resolver
     - Return error with target path if escape detected
   - `checkDirectorySymlinks(skillPath: string): AsyncGenerator<SymlinkInfo>`
     - Find all symlinks in skill directory (files and directories)
     - For each, check if target escapes scope
     - Yield warnings for directory symlinks (will be removed as files, not descended)
   - `checkHardLinks(skillPath: string): AsyncGenerator<HardLinkInfo>`
     - Check `stat().nlink > 1` for each regular file
     - Yield file path and link count for files with multiple links
   - `detectHardLinkWarnings(skillPath: string): Promise<HardLinkWarning | null>`
     - Aggregate hard link detections
     - Return warning requiring --force if any found
2. Create `src/generators/path-verifier.ts`:
   - `verifyContainment(basePath: string, targetPath: string): boolean`
     - Resolve both paths with `path.resolve()`
     - Ensure target starts with base + path separator
     - Prevent `..` escape via path manipulation
   - `verifyBeforeDeletion(skillPath: string, filePath: string): Promise<VerifyResult>`
     - Re-verify file still exists and hasn't changed
     - Re-verify it's still within skill directory
     - Use `fs.lstat()` to check current state
     - Return error if verification fails (possible TOCTOU attack)
3. Create `src/utils/safe-delete.ts`:
   - `safeUnlink(basePath: string, filePath: string): Promise<SafeDeleteResult>`
     - Open parent directory (if supported by Node.js version)
     - Verify containment before each operation
     - Use `fs.unlink()` for files, `fs.rmdir()` for empty directories
     - Return success, skipped (verification failed), or error
   - `safeRecursiveDelete(skillPath: string): AsyncGenerator<DeleteProgress>`
     - Delete files first, then directories bottom-up
     - Skip directory symlinks (delete the symlink, don't descend)
     - Re-verify each file before deletion
     - Yield progress: file path, status (deleted, skipped, error)
4. Write security-focused tests including attack simulations

#### Deliverables
- [ ] `src/generators/security-checker.ts` - Symlink and hard link detection
- [ ] `src/generators/path-verifier.ts` - Containment and TOCTOU verification
- [ ] `src/utils/safe-delete.ts` - Safe deletion utilities
- [ ] `tests/unit/generators/security-checker.test.ts` - Security check tests
- [ ] `tests/unit/generators/path-verifier.test.ts` - Verification tests
- [ ] `tests/unit/utils/safe-delete.test.ts` - Safe delete tests
- [ ] `tests/security/uninstall-security.test.ts` - Attack simulation tests

---

### Phase 4: Core Uninstall Logic & Audit Logging
**Feature:** [FEAT-005](../features/FEAT-005-uninstall-skill-command.md) | [#5](https://github.com/lwndev/ai-skills-manager/issues/5) (Core Logic)
**Status:** Pending

#### Rationale
- Builds on all previous phases to implement the core uninstall operation
- Orchestrates discovery, validation, security checks, and deletion
- Implements audit logging (NFR-6) for security and troubleshooting
- Handles multiple skills (FR-6) with partial failure support
- Implements resource limits and operation timeout (NFR-7)
- Provides rollback information for partial removal states (FR-10)

#### Implementation Steps
1. Create `src/generators/uninstaller.ts`:
   - `uninstallSkill(skillName: string, options: UninstallOptions): Promise<UninstallResult>`
     - Main orchestration function:
       1. Validate skill name (Phase 1)
       2. Resolve scope path (reuse scope-resolver)
       3. Discover skill (Phase 2)
       4. Run pre-removal validation (informational)
       5. Run security checks (Phase 3)
       6. If --dry-run, return preview
       7. Get confirmation (unless --force)
       8. Execute deletion with progress
       9. Log to audit trail
       10. Return result
   - `uninstallMultipleSkills(skillNames: string[], options: UninstallOptions): Promise<MultiUninstallResult>`
     - Process skills sequentially
     - Track successes and failures
     - Implement bulk --force safeguard (3+ skills → require "yes" confirmation)
     - Continue on partial failure
     - Return summary with individual results
   - `executeRemoval(skillInfo: SkillInfo): AsyncGenerator<RemovalProgress>`
     - Use safe-delete from Phase 3
     - Implement 5-minute timeout (NFR-7)
     - Yield progress for each file
     - Handle interruption gracefully
   - `generateDryRunPreview(skillInfo: SkillInfo): DryRunPreview`
     - Format file list with sizes
     - Show total count and size
     - Indicate no changes would be made
2. Create `src/utils/audit-logger.ts`:
   - `logUninstallOperation(entry: AuditLogEntry): Promise<void>`
     - Write to `~/.asm/audit.log`
     - Create directory and file if not exists
     - Set file permissions to 0600
     - Use append mode for atomic writes
   - `formatAuditEntry(entry: AuditLogEntry): string`
     - ISO 8601 timestamp with timezone
     - Format: `[timestamp] UNINSTALL skill-name scope status details`
   - `getAuditLogPath(): string`
     - Returns `~/.asm/audit.log` with tilde expansion
3. Create `src/utils/timeout.ts`:
   - `withTimeout<T>(operation: Promise<T>, ms: number, message: string): Promise<T>`
     - Wraps operation with timeout
     - Throws TimeoutError if exceeded
   - Use for overall uninstall operation (5 minutes = 300000ms)
4. Update `src/utils/errors.ts`:
   - `TimeoutError` - Operation exceeded time limit
   - `PartialRemovalError` - Some files removed, some failed
5. Write unit and integration tests

#### Deliverables
- [ ] `src/generators/uninstaller.ts` - Core uninstall logic
- [ ] `src/utils/audit-logger.ts` - Audit logging utilities
- [ ] `src/utils/timeout.ts` - Timeout wrapper utility
- [ ] Enhanced `src/utils/errors.ts` with TimeoutError, PartialRemovalError
- [ ] `tests/unit/generators/uninstaller.test.ts` - Uninstaller unit tests
- [ ] `tests/unit/utils/audit-logger.test.ts` - Audit logger tests
- [ ] `tests/unit/utils/timeout.test.ts` - Timeout utility tests
- [ ] `tests/integration/uninstall.test.ts` - End-to-end uninstall tests

---

### Phase 5: User Interaction & Output Formatting
**Feature:** [FEAT-005](../features/FEAT-005-uninstall-skill-command.md) | [#5](https://github.com/lwndev/ai-skills-manager/issues/5) (User Experience)
**Status:** Pending

#### Rationale
- Provides the user-facing layer for the uninstall operation
- Implements confirmation prompts (FR-4) with detailed information
- Creates rich output formatting matching feature spec examples
- Handles quiet mode (--quiet) with minimum required output (NFR-5)
- Ensures destructive operations are never completely silent

#### Implementation Steps
1. Create `src/formatters/uninstall-formatter.ts`:
   - `formatDiscoveryProgress(skillName: string, scopePath: string): string`
     - Show "Locating skill..." message
     - Display found path or not-found error
   - `formatFileList(files: FileInfo[], options: { indent?: number }): string`
     - List files with sizes using `formatFileSize()`
     - Show total count and size
   - `formatConfirmationPrompt(skillInfo: SkillInfo): string`
     - Show files to be removed
     - Display total size
     - Add "This action cannot be undone" warning
   - `formatMultiSkillConfirmation(skills: SkillInfo[]): string`
     - Summarize multiple skills
     - Show combined totals
   - `formatRemovalProgress(progress: RemovalProgress): string`
     - Show checkmark for each removed file/directory
     - Indicate skipped files with reason
   - `formatSuccess(result: UninstallResult): string`
     - Show success message with stats
     - Display location that was removed
   - `formatError(error: UninstallError): string`
     - Clear error message with suggestions
     - Match format from feature spec
   - `formatSecurityError(error: SecurityError): string`
     - Show security block with details
     - Indicate exit code 5
   - `formatDryRun(preview: DryRunPreview): string`
     - Show preview without changes
     - List files that would be removed
   - `formatQuietOutput(result: UninstallResult): string`
     - Single line: `✓ skill-name uninstalled from scope (N files, X KB)`
   - `formatPartialFailure(result: MultiUninstallResult): string`
     - Show which skills succeeded and which failed
2. Extend `src/utils/prompts.ts`:
   - `confirmUninstall(skillInfo: SkillInfo): Promise<boolean>`
     - Show formatted confirmation prompt
     - Return user's yes/no response
   - `confirmBulkUninstall(count: number): Promise<boolean>`
     - Require typing "yes" for 3+ skills with --force
     - Return false if anything else entered
   - `confirmWithWarning(warning: string, skillInfo: SkillInfo): Promise<boolean>`
     - Show warning (hard links, unexpected files) before confirmation
3. Write tests for all formatters

#### Deliverables
- [ ] `src/formatters/uninstall-formatter.ts` - Output formatting
- [ ] Extended `src/utils/prompts.ts` with uninstall confirmations
- [ ] `tests/unit/formatters/uninstall-formatter.test.ts` - Formatter tests

---

### Phase 6: Command Integration & Signal Handling
**Feature:** [FEAT-005](../features/FEAT-005-uninstall-skill-command.md) | [#5](https://github.com/lwndev/ai-skills-manager/issues/5) (CLI Integration)
**Status:** Pending

#### Rationale
- Final integration layer that ties all components together
- Implements the CLI command with proper argument and option handling
- Adds signal handling (NFR-8) for graceful interruption
- Implements all exit codes from specification
- Registers command in CLI entry point

#### Implementation Steps
1. Create `src/commands/uninstall.ts`:
   - Register command with Commander: `asm uninstall <skill-name...> [options]`
   - Add options:
     - `-s, --scope <scope>` - Installation scope (project or personal, default: project)
     - `-f, --force` - Remove without confirmation
     - `-d, --dry-run` - Preview what would be removed
     - `-q, --quiet` - Minimal output
   - Implement main handler:
     1. Parse and validate skill names (all must be valid before proceeding)
     2. Validate scope option
     3. Set up signal handlers for SIGINT/SIGTERM
     4. Call uninstaller generator
     5. Format and display output
     6. Return appropriate exit code
   - Handle exit codes:
     - `0` - Success
     - `1` - Skill not found
     - `2` - File system error
     - `3` - User cancelled
     - `4` - Partial failure
     - `5` - Security error
   - Add comprehensive help text with examples from spec
2. Create `src/utils/signal-handler.ts`:
   - `setupInterruptHandler(cleanup: () => Promise<void>): void`
     - Register SIGINT and SIGTERM handlers
     - First signal: set interrupted flag, complete current file
     - Call cleanup function before exit
   - `isInterrupted(): boolean`
     - Check if interrupt was received
     - Used by generator to stop gracefully
   - `resetInterruptHandler(): void`
     - Clean up handlers after operation
3. Update `src/cli.ts`:
   - Import and register `registerUninstallCommand()`
4. Write integration tests for command
5. Update help text and documentation

#### Deliverables
- [ ] `src/commands/uninstall.ts` - Uninstall command implementation
- [ ] `src/utils/signal-handler.ts` - Signal handling utilities
- [ ] Updated `src/cli.ts` with uninstall command registration
- [ ] `tests/commands/uninstall.test.ts` - Command integration tests
- [ ] Help text with examples
- [ ] Exit code handling for all scenarios

---

### Phase 7: Edge Cases, Security Tests & Documentation
**Feature:** [FEAT-005](../features/FEAT-005-uninstall-skill-command.md) | [#5](https://github.com/lwndev/ai-skills-manager/issues/5) (Polish)
**Status:** Pending

#### Rationale
- Ensures all edge cases from feature specification are handled
- Implements comprehensive security test suite
- Updates documentation with uninstall command
- Final verification against all acceptance criteria

#### Implementation Steps
1. Implement remaining edge cases:
   - Empty skill directory: Remove directory, warn that skill was empty
   - Same skill in both scopes: Only remove from specified scope, inform user
   - File locked by another process: Retry once, then warn and skip
   - Concurrent uninstall: Fail gracefully if skill already being removed
2. Create comprehensive security test suite `tests/security/uninstall-attacks.test.ts`:
   - Path traversal attempts (`../`, `..%2F`, `....//`)
   - Absolute paths (`/etc/passwd`, `C:\Windows\System32`)
   - Null bytes and control characters
   - Unicode lookalike characters
   - Symlink escape to external locations
   - Directory symlink to parent (loop)
   - Hard link detection
   - Case sensitivity attacks on macOS/Windows
   - TOCTOU race condition simulation
   - Scope validation bypass attempts
3. Update `README.md`:
   - Add uninstall command documentation
   - Include all options and examples
   - Document exit codes
   - Add troubleshooting section
4. Verify all acceptance criteria from feature spec:
   - Run through functional requirements checklist
   - Run through security requirements checklist
   - Run through quality requirements checklist
5. Add manual testing scenarios

#### Deliverables
- [ ] Edge case handling in `src/generators/uninstaller.ts`
- [ ] `tests/security/uninstall-attacks.test.ts` - Security attack tests
- [ ] Updated `README.md` with uninstall command documentation
- [ ] All acceptance criteria verified
- [ ] Manual testing completed

---

## Shared Infrastructure

### Reusable from Previous Features
- **CLI Framework**: Commander.js setup from FEAT-001
- **Scope Resolution**: `src/utils/scope-resolver.ts` from FEAT-004 (reuse `resolveScope()`, `expandTilde()`, `isPathWithin()`)
- **Output Utilities**: `src/utils/output.ts` for formatted messages
- **Error Types**: `src/utils/errors.ts` for custom error classes
- **Prompt Utilities**: `src/utils/prompts.ts` for confirmations
- **File Size Formatting**: `src/utils/archiver.ts` `formatFileSize()` function
- **Debug Utilities**: `src/utils/debug.ts` for debug logging
- **Validation Engine**: Validators from FEAT-002 for pre-removal checks

### New Shared Components
- **Skill Name Validator**: `src/validators/uninstall-name.ts` - May be reused for future skill management commands
- **Audit Logger**: `src/utils/audit-logger.ts` - Reusable for all destructive operations
- **Signal Handler**: `src/utils/signal-handler.ts` - Reusable for any long-running operations
- **Safe Delete**: `src/utils/safe-delete.ts` - Reusable for any secure file deletion
- **Timeout Utility**: `src/utils/timeout.ts` - Reusable for any timed operations

## Testing Strategy

### Unit Tests
- Skill name validation (all attack vectors)
- Scope validation (only project/personal accepted)
- Skill discovery (exists, not found, case mismatch)
- File enumeration (files, directories, symlinks, hard links)
- Security checks (symlink escape, hard links, containment)
- Safe delete operations
- Audit logging
- Timeout utility
- Signal handling
- Output formatting
- Exit code determination

### Integration Tests
- Full uninstallation workflow: discover → validate → remove
- Uninstallation from both scopes (project and personal)
- Invalid scope rejection
- Uninstallation with confirmation prompt
- Uninstallation with --force flag
- Dry run mode
- Quiet mode
- Multiple skills uninstallation
- Partial failure scenarios
- Interrupted operation handling

### Security Tests (Critical)
- Path traversal attacks (various encoding attempts)
- Absolute path injection
- Null byte and control character injection
- Unicode normalization attacks
- Symlink escape (skill directory and nested)
- Directory symlink loop detection
- Hard link detection
- Case sensitivity attacks on case-insensitive filesystems
- TOCTOU race condition simulation
- Scope bypass attempts
- Resource exhaustion (file count, total size)

### Manual Testing
- Uninstall skills installed by `asm install`
- Uninstall from both project and personal scopes
- Test confirmation prompts
- Verify skill is no longer available in Claude Code
- Test error scenarios (missing skill, permission denied)
- Test with Claude Code running
- Verify audit log entries
- Test interrupt handling (Ctrl+C)
- Test on multiple platforms (macOS, Linux)

## Dependencies and Prerequisites

### External Dependencies
- **fs/promises** (built-in): Async file system operations
- **path** (built-in): Path manipulation
- **os** (built-in): Home directory resolution
- **readline** (built-in): User prompts

### Internal Dependencies
- `asm validate` command (FEAT-002): Pre-removal validation (informational)
- Scope resolver from FEAT-004: Path resolution utilities
- Validators from FEAT-002: Frontmatter parsing for SKILL.md verification
- CLI infrastructure from FEAT-001: Commander.js setup
- Output utilities: Formatting functions
- Debug utilities from FEAT-004 Phase 7: Debug logging

### Prerequisites
- Node.js ≥20.19.6 (for native fs/promises)
- Installed skill to uninstall
- Write permissions to skill directory

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Path traversal attack** | **Critical** | **Low** | Strict input validation (Phase 1), containment verification (Phase 3) |
| **Symlink escape attack** | **Critical** | **Low** | Check symlink targets before deletion, reject external targets |
| **TOCTOU race condition** | **High** | **Low** | Re-verify each file before deletion, use atomic operations |
| **Accidental data loss** | **High** | **Medium** | Confirmation prompt, --dry-run preview, audit logging |
| **Hard link side effects** | **Medium** | **Low** | Detect and warn, require --force for hard-linked files |
| **Case sensitivity bypass** | **Medium** | **Low** | Verify case matches filesystem exactly on case-insensitive systems |
| **Partial removal state** | **Medium** | **Low** | Report progress, log state, provide clear error message |
| **Interrupt during deletion** | **Medium** | **Medium** | Graceful signal handling, complete current file, report state |
| **Resource exhaustion (DoS)** | **Low** | **Low** | Stream file enumeration, resource limits, timeout |
| **Audit log permission error** | **Low** | **Low** | Graceful fallback, continue operation, warn user |
| **Cross-platform path issues** | **Medium** | **Medium** | Use path module, test on Windows/macOS/Linux |

## Success Criteria

### Functional Requirements
- [ ] Command accepts skill name argument(s)
- [ ] Command accepts multiple skill names
- [ ] Command accepts --scope with only `project` or `personal` values
- [ ] Command rejects invalid --scope values with clear error
- [ ] Command accepts --force, --dry-run, --quiet options
- [ ] Skill discovery works correctly in both scopes
- [ ] SKILL.md verification required (or --force) before removal
- [ ] Confirmation prompt shows files to be removed
- [ ] Confirmation prompt shows total size
- [ ] --force flag bypasses confirmation
- [ ] --dry-run mode shows preview without removing
- [ ] --quiet flag produces minimal output (but never silent with --force)
- [ ] Multiple skills can be uninstalled in one command
- [ ] Bulk --force (3+ skills) requires typing "yes" to confirm
- [ ] Exit codes match specification (0-5)
- [ ] Error messages are clear and actionable

### Security Requirements (Critical)
- [ ] Only `project` and `personal` scopes are accepted (no arbitrary paths)
- [ ] Skill name input validation rejects path separators (`/`, `\`)
- [ ] Skill name input validation rejects `..` and `.`
- [ ] Skill name input validation rejects absolute paths
- [ ] Skill name input validation rejects null bytes and control characters
- [ ] Skill name input validation rejects non-ASCII characters
- [ ] Skill name format validation matches install command rules
- [ ] Path canonicalization uses realpath() before containment check
- [ ] Containment check verifies resolved path is within scope
- [ ] Case sensitivity verification on case-insensitive filesystems
- [ ] Symlink skill directories pointing outside scope are rejected
- [ ] Directory symlinks are not followed during recursive deletion
- [ ] Nested directory symlinks are removed as files, not descended into
- [ ] Hard links detected and require --force to proceed
- [ ] TOCTOU protection: each file re-verified before deletion
- [ ] Audit logging captures all security-relevant events
- [ ] Resource limits prevent DoS (>10K files or >1GB require --force)
- [ ] Signal handling prevents undefined state
- [ ] All security tests pass

### Quality Requirements
- [ ] All edge cases from feature spec are handled
- [ ] Unit test coverage ≥80%
- [ ] Security tests pass with 100% coverage of attack vectors
- [ ] Documentation updated
- [ ] Uninstalled skills no longer available in Claude Code

## Code Organization

```
src/
├── commands/
│   ├── scaffold.ts         (existing - FEAT-001)
│   ├── validate.ts         (existing - FEAT-002)
│   ├── package.ts          (existing - FEAT-003)
│   ├── install.ts          (existing - FEAT-004)
│   └── uninstall.ts        (new - uninstall command)
│
├── generators/
│   ├── scaffold.ts         (existing)
│   ├── validate.ts         (existing)
│   ├── packager.ts         (existing)
│   ├── installer.ts        (existing)
│   ├── skill-discovery.ts  (new - skill location and verification)
│   ├── file-enumerator.ts  (new - streaming file enumeration)
│   ├── pre-removal-validator.ts (new - pre-removal checks)
│   ├── security-checker.ts (new - symlink and hard link detection)
│   ├── path-verifier.ts    (new - containment and TOCTOU verification)
│   └── uninstaller.ts      (new - core uninstall logic)
│
├── validators/
│   ├── name.ts             (existing)
│   ├── description.ts      (existing)
│   ├── skill-path.ts       (existing)
│   ├── package-file.ts     (existing)
│   ├── uninstall-name.ts   (new - skill name security validation)
│   └── uninstall-scope.ts  (new - scope validation)
│
├── formatters/
│   ├── validate-formatter.ts (existing)
│   ├── package-formatter.ts  (existing)
│   ├── install-formatter.ts  (existing)
│   └── uninstall-formatter.ts (new - uninstall output formatting)
│
├── utils/
│   ├── output.ts           (existing)
│   ├── errors.ts           (existing - extend with uninstall errors)
│   ├── prompts.ts          (existing - extend with uninstall prompts)
│   ├── scope-resolver.ts   (existing - reuse)
│   ├── debug.ts            (existing - reuse)
│   ├── archiver.ts         (existing - reuse formatFileSize)
│   ├── safe-delete.ts      (new - secure deletion utilities)
│   ├── audit-logger.ts     (new - audit logging)
│   ├── timeout.ts          (new - timeout wrapper)
│   └── signal-handler.ts   (new - interrupt handling)
│
├── types/
│   ├── validation.ts       (existing)
│   ├── package.ts          (existing)
│   ├── install.ts          (existing)
│   ├── scope.ts            (existing)
│   └── uninstall.ts        (new - uninstall types)
│
└── cli.ts                  (existing - add uninstall command)

tests/
├── commands/
│   └── uninstall.test.ts   (new - command integration tests)
│
├── unit/
│   ├── generators/
│   │   ├── skill-discovery.test.ts      (new)
│   │   ├── file-enumerator.test.ts      (new)
│   │   ├── pre-removal-validator.test.ts (new)
│   │   ├── security-checker.test.ts     (new)
│   │   ├── path-verifier.test.ts        (new)
│   │   └── uninstaller.test.ts          (new)
│   ├── validators/
│   │   ├── uninstall-name.test.ts       (new)
│   │   └── uninstall-scope.test.ts      (new)
│   ├── formatters/
│   │   └── uninstall-formatter.test.ts  (new)
│   └── utils/
│       ├── safe-delete.test.ts          (new)
│       ├── audit-logger.test.ts         (new)
│       ├── timeout.test.ts              (new)
│       └── signal-handler.test.ts       (new)
│
├── integration/
│   └── uninstall.test.ts   (new - end-to-end uninstall workflow)
│
└── security/
    ├── uninstall-security.test.ts (new - security check tests)
    └── uninstall-attacks.test.ts  (new - attack simulation tests)
```

## Implementation Notes

### Phase Dependencies
1. **Phase 1** is completely independent and must be built first (security foundation)
2. **Phase 2** depends on Phase 1 (validators) for safe skill discovery
3. **Phase 3** depends on Phase 2 (file enumeration) for security checks
4. **Phase 4** requires Phases 1-3 for secure core logic
5. **Phase 5** can be developed in parallel with Phase 4 (formatting is independent)
6. **Phase 6** requires Phase 4 (uninstaller) and Phase 5 (formatters)
7. **Phase 7** requires Phase 6 to be complete for final polish

### Development Workflow
1. Implement phases sequentially for security-critical functionality
2. Write security tests early and run them frequently
3. Test on multiple platforms early (especially macOS for case sensitivity)
4. Create test fixtures: normal skills, skills with symlinks, hard links, etc.
5. Validate that uninstalled skills are truly removed from Claude Code
6. Document any platform-specific quirks

### Key Implementation Details

#### Scope Restriction (Security by Design)
Unlike install which allows custom paths, uninstall only supports:
- `project` → `.claude/skills/` (relative to cwd)
- `personal` → `~/.claude/skills/` (in home directory)

This eliminates path-based vulnerabilities entirely.

#### Exit Code Mapping
| Exit Code | Scenario |
|-----------|----------|
| 0 | Skill(s) uninstalled successfully |
| 1 | Skill not found |
| 2 | File system error (permission denied, etc.) |
| 3 | User cancelled uninstallation |
| 4 | Partial failure (some skills removed, some failed) |
| 5 | Security error (path traversal, symlink escape, etc.) |

#### Audit Log Format
```
[2026-01-01T12:34:56.789Z] UNINSTALL skill-name project SUCCESS removed=4 size=7800
[2026-01-01T12:35:00.000Z] UNINSTALL bad-skill personal SECURITY_BLOCKED symlink_escape=/etc/passwd
```

### Future Enhancements (Out of Scope)
- Custom scope paths (only if Claude Code adds support)
- Registry integration (remove registry reference when uninstalling)
- Dependency checking (warn if other skills depend on this one)
- Backup before removal (create .skill archive)
- Undo last uninstall
- Batch uninstall from list file
- Uninstall by pattern (`asm uninstall --pattern "test-*"`)
- Automatic cleanup of orphaned skill artifacts

## Related Features

### Dependencies
- **FEAT-001** (Scaffold): Creates skills that can be uninstalled
- **FEAT-002** (Validate): Provides pre-removal validation
- **FEAT-003** (Package): Skills are typically packaged before distribution
- **FEAT-004** (Install): Inverse operation; installs skills that this command removes

### Dependents
- **Future**: `asm list` - Lists installed skills
- **Future**: `asm update` - Updates installed skills (may use uninstall+install)

### Workflow Integration
```
scaffold → validate → package → install → uninstall
(FEAT-001) (FEAT-002) (FEAT-003) (FEAT-004) (FEAT-005)
```

This command completes the skill lifecycle, enabling full round-trip skill management from creation to removal.

## References

- Feature specification: [FEAT-005-uninstall-skill-command.md](../features/FEAT-005-uninstall-skill-command.md)
- GitHub issue: [#5](https://github.com/lwndev/ai-skills-manager/issues/5)
- Install command implementation: `src/commands/install.ts`
- Scope resolver: `src/utils/scope-resolver.ts`
- Node.js fs documentation: https://nodejs.org/api/fs.html
