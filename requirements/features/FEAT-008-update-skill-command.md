# Feature Requirements: Update Skill Command

## Overview

Enable users to update installed skills to newer versions from updated `.skill` packages, providing safe in-place updates with backup, rollback, and version comparison capabilities.

## Feature ID
`FEAT-008`

## GitHub Issue
[#16](https://github.com/lwndev/ai-skills-manager/issues/16)

## Priority
Medium - Enhances skill lifecycle management for iterative development

## User Story

As a skill user, I want to update installed skills to newer versions so that I can benefit from bug fixes, new features, and improvements without manually uninstalling and reinstalling.

## Command Syntax

```bash
asm update <skill-name> <new-skill-package> [options]
```

### Arguments

- `<skill-name>` (required) - Name of the installed skill to update
- `<new-skill-package>` (required) - Path to the new `.skill` package file

### Options

- `-s, --scope <scope>` - Target scope (default: `project`)
  - `project` - Project skills directory (`.claude/skills/`)
  - `personal` - Personal skills directory (`~/.claude/skills/`)
- `-f, --force` - Skip confirmation prompts
- `-n, --dry-run` - Preview update without making changes
- `-q, --quiet` - Suppress non-error output
- `--no-backup` - Skip backup creation (not recommended)
- `--keep-backup` - Keep backup after successful update

### Examples

```bash
# Update skill from project scope (default)
asm update my-skill ./my-skill-v2.skill

# Update skill in personal scope
asm update my-skill ./my-skill-v2.skill --scope personal

# Preview update without making changes
asm update my-skill ./my-skill-v2.skill --dry-run

# Force update without confirmation
asm update my-skill ./my-skill-v2.skill --force

# Update without creating backup (not recommended)
asm update my-skill ./my-skill-v2.skill --no-backup

# Keep backup after successful update
asm update my-skill ./my-skill-v2.skill --keep-backup

# Quiet update
asm update my-skill ./my-skill-v2.skill --quiet
```

## Functional Requirements

### FR-1: Skill Discovery and Verification
- Locate skill directory within the specified scope using existing `skill-discovery` module
- Verify the skill exists before attempting update
- Search for skill by name in scope directory (e.g., `.claude/skills/<skill-name>`)
- Return clear error if skill is not found
- Reuse skill name validation from `uninstall` command (FR-11)

### FR-2: New Package Validation
- Validate the new `.skill` package before any modifications
- Reuse `package-validator` from install command (FEAT-004)
- Extract new package to temporary location for pre-update validation
- Run `asm validate` on extracted skill
- Reject update if new package is invalid or corrupted

### FR-3: Version Comparison
- Compare metadata between installed skill and new package
- Extract version information from SKILL.md files if available
- Detect potential downgrades and warn user
- Show diff summary between old and new versions:
  - Files added
  - Files removed
  - Files modified (size changes)

### FR-4: Backup Creation
- Create backup of current skill before any modifications
- Backup location: `~/.asm/backups/<skill-name>-<timestamp>.skill`
- Create backup directory if it doesn't exist
- Skip backup creation with `--no-backup` flag
- Display warning when using `--no-backup`
- Backup format: Same as `.skill` package format for easy restore

### FR-5: Confirmation Prompt
- Display update summary before proceeding
- Show current vs new version metadata
- Show diff summary (files added/removed/modified)
- Show backup location (unless `--no-backup`)
- Require explicit confirmation (y/N, default No)
- Skip confirmation with `--force` flag

### FR-6: Update Execution
- Replace installed skill with new version
- Process:
  1. Rename current skill directory to temporary name
  2. Extract new package to skill location
  3. Verify extraction success
  4. Remove renamed old directory (or restore on failure)
- Handle nested files and directories
- Preserve scope directory structure

### FR-7: Post-Update Validation
- Run `asm validate` on the updated skill
- Verify skill integrity after update
- Trigger rollback if validation fails

### FR-8: Rollback Capability
- Automatic rollback if update fails or post-update validation fails
- Restore from temporary renamed directory
- Clear error message explaining rollback reason
- Rollback process:
  1. Remove partially installed new version
  2. Rename temporary directory back to original name
  3. Verify restoration success
- Manual rollback option using backup file

### FR-9: Backup Management
- Remove backup after successful update (default behavior)
- Keep backup with `--keep-backup` flag
- Provide backup path in success output for manual restore option

### FR-10: Dry Run Mode
- Show what would be updated without making changes
- Display current skill info
- Display new package info
- Show diff summary (files added/removed/modified)
- Show backup location that would be created
- Clearly indicate no changes were made

### FR-11: Exit Codes
- `0` - Skill updated successfully
- `1` - Skill not found
- `2` - File system error (permission denied, disk full, etc.)
- `3` - User cancelled update
- `4` - Invalid new package
- `5` - Security error (path traversal, invalid name, etc.)
- `6` - Rollback performed (update failed but rollback succeeded)
- `7` - Rollback failed (critical error state)

### FR-12: Scope Handling
- **Only two scopes are supported** (aligned with Claude Code's official skill locations):
  - `project` (default): `.claude/skills/` relative to current working directory
  - `personal`: `~/.claude/skills/` in user's home directory
- Handle tilde expansion for personal scope
- Error if scope directory doesn't exist
- Reject any scope value other than `project` or `personal`
- Reuse scope validation from `uninstall` command (FR-3)

### FR-13: Skill Name Input Validation (Security)
- Apply identical validation rules as FEAT-005 FR-11
- Validation MUST occur before any file system operations
- Reject:
  - Path separators (`/` or `\`)
  - Traversal sequences (`.` or `..`)
  - Absolute paths
  - Null bytes or control characters
  - Non-ASCII characters (prevents Unicode normalization attacks)
- Format constraints:
  - Maximum 64 characters
  - Lowercase ASCII letters (a-z), digits (0-9), and hyphens only
  - Must start with a letter
- Do not attempt Unicode normalization; reject non-ASCII outright

### FR-14: Package Path Validation
- Validate package path before any operations
- Resolve to absolute path and verify it points to a regular file
- Reject:
  - Paths containing null bytes or control characters
  - Non-existent files
  - Directories (must be a file)
  - Non-`.skill` file extensions
- Package path must be accessible (readable by current user)
- Verify package file is not a symlink to sensitive locations

### FR-15: ZIP Entry Security (Package Extraction)
- Before extracting any ZIP entry, validate the target path
- Reject entries with:
  - Path traversal sequences (`../`)
  - Absolute paths (starting with `/` or drive letters)
  - Symbolic links pointing outside extraction directory
  - Names containing null bytes
- All extracted paths must resolve within the temporary extraction directory
- Use zipslip-safe extraction or implement containment check:
  - Resolve each entry's target path to absolute
  - Verify it starts with extraction directory prefix
- Reject packages containing ZIP bombs (nested ZIPs, high compression ratios >100:1)

### FR-16: Hard Link Detection
- Before backup/update operations, check hard link counts on skill files
- Use `lstat()` to get `nlink` count for each file
- If any file has `nlink > 1`:
  - Display warning: "Skill contains files with multiple hard links. These files may exist elsewhere."
  - Require `--force` flag to proceed
  - Log hard-linked files in audit log
- Include hard link count in diff summary when applicable

### FR-17: Concurrent Access Prevention
- Create lockfile before starting update: `<skill-dir>/.asm-update.lock`
- Lock file contains:
  - Process ID (PID)
  - Timestamp (ISO-8601)
  - Operation type ("update")
  - Package path being applied
- If lockfile exists:
  - Check if owning process is still running
  - If running: fail with error "Update already in progress (PID: <pid>)"
  - If not running (stale lock): remove lockfile and proceed with warning
- Clean up lockfile on:
  - Successful completion
  - Failure/rollback
  - Signal handling (SIGINT/SIGTERM)
- Use atomic lockfile creation (O_CREAT | O_EXCL)

## Output Format

### Success Output
```
Updating skill: my-skill

Current version:
   Location: .claude/skills/my-skill
   Files: 4 (7.8 KB)
   Modified: 2025-01-10 14:30:00

New version:
   Package: ./my-skill-v2.skill
   Files: 5 (9.2 KB)

Changes:
   + templates/advanced.md (added)
   ~ SKILL.md (modified, +50 bytes)
   ~ scripts/helper.py (modified, +200 bytes)

Backup location: ~/.asm/backups/my-skill-20250115-143000.skill

This will replace the installed skill with the new version.
Proceed with update? [y/N]: y

Creating backup...
   Backup saved to: ~/.asm/backups/my-skill-20250115-143000.skill

Updating skill...
   Removing old version...
   Extracting new version...
   Validating updated skill...

Successfully updated skill: my-skill
   Previous: 4 files, 7.8 KB
   Current: 5 files, 9.2 KB
   Backup: ~/.asm/backups/my-skill-20250115-143000.skill (will be removed)

To restore the previous version, use:
   asm install ~/.asm/backups/my-skill-20250115-143000.skill --scope project --force
```

### Skill Not Found Output
```
Updating skill: nonexistent-skill

Locating installed skill...

Error: Skill 'nonexistent-skill' not found in .claude/skills/

Suggestions:
  - Check the skill name spelling
  - Verify the skill is installed: ls .claude/skills/
  - Try a different scope: asm update <skill> <package> --scope personal

Update failed
```

### Invalid Package Output
```
Updating skill: my-skill

Locating installed skill...
   Found: .claude/skills/my-skill

Validating new package...

Error: Invalid package './my-skill-v2.skill'
   - Missing required file: SKILL.md
   - Package appears to be corrupted

Update failed (no changes made)
```

### Rollback Output
```
Updating skill: my-skill

Locating installed skill...
   Found: .claude/skills/my-skill

Validating new package...
   Package valid

Creating backup...
   Backup saved to: ~/.asm/backups/my-skill-20250115-143000.skill

Updating skill...
   Removing old version...
   Extracting new version...
   Validating updated skill...

Post-update validation failed:
   - SKILL.md: Invalid format at line 15

Rolling back...
   Removing failed installation...
   Restoring previous version...
   Verifying restoration...

Rollback successful: my-skill restored to previous version
   Backup kept at: ~/.asm/backups/my-skill-20250115-143000.skill

Update failed (exit code 6)
```

### Dry Run Output
```
Dry run: my-skill

Update preview:
   Skill: my-skill
   Location: .claude/skills/my-skill

Current version:
   Files: 4 (7.8 KB)
   Modified: 2025-01-10 14:30:00

New version:
   Package: ./my-skill-v2.skill
   Files: 5 (9.2 KB)

Changes that would be made:
   + templates/advanced.md (added, 1.4 KB)
   ~ SKILL.md (modified, +50 bytes)
   ~ scripts/helper.py (modified, +200 bytes)
   - old-template.md (removed)

Backup would be created at:
   ~/.asm/backups/my-skill-20250115-143000.skill

No changes made (dry run mode)
```

### Quiet Output
```
my-skill updated (4 -> 5 files, 7.8 KB -> 9.2 KB)
```

### Downgrade Warning Output
```
Updating skill: my-skill

Locating installed skill...
   Found: .claude/skills/my-skill

Warning: This appears to be a downgrade
   Current version date: 2025-01-15
   New package date: 2025-01-10

Proceed anyway? [y/N]:
```

## Non-Functional Requirements

### NFR-1: Performance
- Package validation should complete within 5 seconds
- Full update should complete within 30 seconds for typical skills
- Show progress indicators for large packages
- Backup creation should not significantly delay update

### NFR-2: Error Handling
- Skill not found: "Error: Skill '<name>' not found in <scope>"
- Invalid package: "Error: Invalid package '<path>' - <reason>"
- Permission denied: "Error: Cannot update '<path>' - permission denied"
- Disk full: "Error: Cannot create backup - insufficient disk space"
- Rollback failed: "CRITICAL: Rollback failed - manual intervention required"

### NFR-3: File System Safety
- Never modify files outside the skill directory
- Atomic update using rename operations where possible
- Preserve original until new version is verified
- Follow same security measures as uninstall command:
  - Path traversal prevention
  - Symlink escape prevention
  - Case sensitivity verification
  - TOCTOU protection

**Case Sensitivity Verification (macOS/Windows):**
- On case-insensitive filesystems, verify actual directory name matches input exactly
- After path construction, read actual directory name from filesystem using `fs.readdir()` on parent
- Compare actual entry name byte-for-byte with input skill name
- Reject with security error (exit code 5) if case differs
- Prevents symlink substitution attacks exploiting case-insensitive matching
- Example attack: symlink `MY-SKILL` → `/etc/passwd`, user runs `asm update my-skill ...`

**TOCTOU (Time-of-Check-Time-of-Use) Protection:**
- Open skill directory with `O_DIRECTORY | O_NOFOLLOW` before any operations
- Use `fstatat()` with `AT_SYMLINK_NOFOLLOW` before copying each file to backup
- During old directory removal, re-verify containment before each unlink
- Use `openat()`/`unlinkat()` pattern for file operations where possible
- Re-verify each file path immediately before modification using `lstat()`
- Maintain directory file descriptor throughout operation to anchor path resolution
- Reject operation if any path resolves outside expected scope during execution

**Symlink Handling:**
- Reject if skill directory is a symlink
- Reject if skill directory contains symlinks pointing outside skill directory
- Use `O_NOFOLLOW` flag when opening files
- Verify symlink targets resolve within expected scope before following

### NFR-4: User Experience
- Clear confirmation prompts showing update impact
- Helpful error messages with actionable suggestions
- Consistent output formatting with other ASM commands
- Default to safe behavior (require confirmation, create backup)

### NFR-5: Backup Safety
- Backup directory created with 0700 permissions (owner only)
- Backup files created with 0600 permissions (owner read/write only)
- Warn if backup already exists for same skill/timestamp
- Provide clear restore instructions

**Backup Path Security:**
- Before creating backup directory, verify `~/.asm` is not a symlink
- If `~/.asm` is a symlink, fail with security error
- Create `~/.asm/backups` directory with 0700 permissions
- Backup filename format: `<skill-name>-<timestamp>-<random>.skill`
  - Skill name: already validated by FR-13
  - Timestamp: ISO-8601 format (YYYYMMDD-HHMMSS)
  - Random: 8 character hex string for uniqueness/unpredictability
- After constructing backup path, verify it resolves within `~/.asm/backups/`
- Use realpath() or equivalent to resolve and verify containment
- Reject operation if backup path escapes backup directory

**Backup Directory Validation:**
- On startup, check if `~/.asm/backups` exists and is a directory (not symlink)
- If backup directory is a symlink, fail with security error
- Verify backup directory permissions are not world-readable (warn if they are)
- Create backup directory atomically with correct permissions (mkdir with mode)

### NFR-6: Audit Logging
- Log all update operations to audit log
- Log location: `~/.asm/audit.log`
- Log format: `[ISO-8601 timestamp] UPDATE <skill-name> <scope> <status> <details>`
- Log entries include:
  - Skill name
  - Source package path
  - Backup location
  - Status (SUCCESS, FAILED, ROLLED_BACK)
  - Error details if applicable

### NFR-7: Signal Handling
- **SIGINT (Ctrl+C) handling:**
  - During confirmation: Treat as "No", no changes made
  - During backup: Complete backup, then stop
  - During update: Complete current operation, then rollback
  - Display clear state after interruption
- **State consistency:**
  - Never leave skill in partial update state
  - Either complete update or rollback to original

### NFR-8: Resource Limits (DoS Prevention)
- **Size limits:**
  - Maximum installed skill size: 1 GB
  - Maximum new package size: 1 GB
  - Check package size before extraction
- **File count limits:**
  - Maximum files per skill: 10,000 files
  - Enumerate files in streaming fashion (don't load all paths into memory)
- **Operation timeout:**
  - Complete update timeout: 5 minutes
  - Backup creation timeout: 2 minutes
  - Extraction timeout: 2 minutes
- **Behavior when limits exceeded:**
  - Display clear error explaining the limit
  - Require `--force` flag to proceed beyond limits
  - Log limit violations in audit log
- **Memory safety:**
  - Stream file enumeration, don't load all into memory
  - Process files incrementally during backup and diff calculation
  - Avoid loading entire file contents for comparison (use size/hash)

## Dependencies

- Install command (FEAT-004) - Reuses package validation and extraction
- Uninstall command (FEAT-005) - Reuses skill discovery and file enumeration
- Validate command (FEAT-002) - Pre/post update validation
- Node.js fs/promises module for async file operations
- Node.js path module for path handling
- Node.js os module for home directory resolution

### Reusable Components from Existing Codebase

1. `src/services/scope-resolver.ts` - Scope path resolution
2. `src/services/skill-discovery.ts` - Locate installed skills (from FEAT-005)
3. `src/services/file-enumerator.ts` - File listing for backup and diff (from FEAT-005)
4. `src/validators/package-validator.ts` - Validate new .skill package
5. `src/generators/extractor.ts` - Extract new package
6. `src/generators/validate.ts` - Pre/post update validation

### New Components Needed

1. `src/generators/updater.ts` - Core update orchestration logic
2. `src/services/backup-manager.ts` - Create and manage backups
3. `src/services/version-comparator.ts` - Compare old vs new skill versions
4. `src/validators/update-validator.ts` - Update-specific validation
5. `src/formatters/update-formatter.ts` - Output formatting for update command
6. `src/commands/update.ts` - CLI command registration
7. `src/types/update.ts` - TypeScript type definitions

## Edge Cases

1. **Skill not found**: Clear error message with suggestions
2. **Invalid new package**: Reject update before any modifications
3. **Corrupted new package**: Detect during extraction, reject update
4. **Same version update**: Allow but display info message
5. **Apparent downgrade**: Warn user but allow with confirmation
6. **Backup directory doesn't exist**: Create it automatically
7. **Backup already exists**: Generate unique timestamp or warn
8. **Disk full during backup**: Fail before starting update
9. **Disk full during update**: Rollback to original
10. **Permission denied on skill directory**: Clear error message
11. **Skill in use by Claude Code**: Warn but proceed
12. **Update interrupted (Ctrl+C)**: Rollback to original state
13. **Post-update validation fails**: Automatic rollback
14. **Rollback fails**: Critical error with manual intervention instructions
15. **New package has different skill name**: Reject update (name mismatch)
16. **Skill directory is symlink**: Apply same security checks as uninstall
17. **New package contains symlinks escaping scope**: Reject during validation
18. **Concurrent update of same skill**: Second invocation should fail gracefully
19. **--no-backup with failed update**: Warn that original is lost
20. **Backup location not writable**: Fail before starting update (unless --no-backup)

## Testing Requirements

### Unit Tests
- Skill discovery and verification logic
- Package validation before update
- Version comparison logic
- Backup creation and management
- Diff calculation (added/removed/modified files)
- Rollback logic
- Exit code determination
- Error message formatting

### Integration Tests
- Full update workflow (happy path)
- Update with confirmation prompt
- Update with --force flag
- Update with --dry-run flag
- Update with --quiet flag
- Update with --no-backup flag
- Update with --keep-backup flag
- Update in both scopes (project and personal)
- Rollback on extraction failure
- Rollback on post-update validation failure
- Update from invalid package (rejected)
- Update of non-existent skill (error)

### Manual Testing
- Update skill installed by `asm install`
- Update in both project and personal scopes
- Test confirmation prompts
- Verify backup created and restorable
- Test rollback scenarios
- Verify skill works in Claude Code after update
- Test error scenarios (missing skill, invalid package)
- Test with Claude Code running

### Security Tests
Security-focused test cases that MUST pass before release:

**Input Validation Tests:**
- [ ] Skill name with path traversal attempts (`../etc`, `foo/bar`)
- [ ] Skill name with absolute paths (`/etc/passwd`)
- [ ] Package path with path traversal attempts
- [ ] Invalid scope values rejected (not `project` or `personal`)
- [ ] Null bytes in skill name (`skill\x00name`)
- [ ] Null bytes in package path
- [ ] Control characters in skill name
- [ ] Non-ASCII characters in skill name rejected
- [ ] Unicode lookalike characters rejected (е vs e, ⁄ vs /)
- [ ] Skill name exceeding 64 characters rejected
- [ ] Skill name starting with hyphen or digit rejected

**Package Security Tests (ZIP Entry):**
- [ ] ZIP with path traversal entries (`../../../etc/passwd`)
- [ ] ZIP with absolute path entries (`/etc/passwd`)
- [ ] ZIP with symlinks pointing outside extraction directory
- [ ] ZIP with null bytes in entry names
- [ ] ZIP bomb detection (nested ZIPs)
- [ ] ZIP bomb detection (high compression ratio >100:1)
- [ ] Package size exceeding 1 GB rejected
- [ ] Package file count exceeding 10,000 rejected
- [ ] Package path is symlink to sensitive location
- [ ] Package with non-`.skill` extension rejected

**Symlink Tests:**
- [ ] Skill directory is symlink to external location
- [ ] Skill directory contains symlinks pointing outside skill directory
- [ ] Package containing symlinks to external locations
- [ ] Nested symlinks in new package
- [ ] Symlink in skill directory pointing to parent
- [ ] Symlink created between check and operation (TOCTOU)
- [ ] `~/.asm` is symlink (must fail)
- [ ] `~/.asm/backups` is symlink (must fail)

**Case Sensitivity Tests:**
- [ ] Case mismatch on macOS/Windows (`SKILL-NAME` vs `skill-name`)
- [ ] Symlink with uppercase name pointing to external target
- [ ] Mixed-case skill name rejected
- [ ] Actual directory name differs from input (case-insensitive FS)

**Hard Link Tests:**
- [ ] Skill file with link count > 1 detected
- [ ] Warning displayed for hard-linked files
- [ ] `--force` required to proceed with hard links
- [ ] Hard link count logged in audit log

**TOCTOU Tests:**
- [ ] File replaced with symlink between enumeration and copy
- [ ] Directory replaced with symlink during backup
- [ ] Verify containment check on each file operation
- [ ] Race condition during rename operation
- [ ] Concurrent modification during update

**Path Resolution Tests:**
- [ ] Verify containment checks on skill location
- [ ] Verify containment checks on backup location
- [ ] Verify containment checks on extraction directory
- [ ] Path with `..` components after resolution escapes scope
- [ ] Relative path resolution within skill directory

**Backup Security Tests:**
- [ ] Backup directory created with 0700 permissions
- [ ] Backup file created with 0600 permissions
- [ ] Backup path cannot escape backup directory
- [ ] `~/.asm` is not a symlink (verified before backup)
- [ ] Backup filename includes random component
- [ ] Existing backup not overwritten without warning
- [ ] World-readable backup directory triggers warning

**Resource Limit Tests:**
- [ ] Skill exceeding 10,000 files requires `--force`
- [ ] Skill exceeding 1 GB requires `--force`
- [ ] New package exceeding 1 GB rejected before extraction
- [ ] Operation timeout (5 minutes) enforced
- [ ] Memory usage stays bounded during large skill enumeration
- [ ] Streaming enumeration works for large directories

**Concurrent Access Tests:**
- [ ] Two simultaneous updates of same skill (second fails)
- [ ] Lock file created with correct content
- [ ] Lock file cleaned up on success
- [ ] Lock file cleaned up on failure/rollback
- [ ] Lock file cleaned up on SIGINT
- [ ] Stale lock detection (process not running)
- [ ] Atomic lock file creation (O_CREAT | O_EXCL)

**Signal Handling Security Tests:**
- [ ] SIGINT during backup leaves consistent state
- [ ] SIGINT during update triggers rollback
- [ ] Lock file cleaned up on signal
- [ ] No partial update state after interruption

## Future Enhancements

- Version tracking in skill metadata
- Automatic version comparison using semantic versioning
- Changelog display between versions
- Update multiple skills in batch
- Update from registry (download new version automatically)
- Scheduled/automatic updates
- Update notifications when new versions available
- Diff preview showing actual content changes
- Interactive update selection

## Acceptance Criteria

### Functional Requirements
- [ ] Command accepts skill name and package path arguments
- [ ] Command accepts --scope with only `project` or `personal` values
- [ ] Command accepts --force, --dry-run, --quiet options
- [ ] Command accepts --no-backup and --keep-backup options
- [ ] Skill discovery works correctly in both scopes
- [ ] New package is validated before any modifications
- [ ] Diff summary shows files added/removed/modified
- [ ] Backup is created before update (unless --no-backup)
- [ ] Confirmation prompt shows update summary
- [ ] --force flag bypasses confirmation
- [ ] --dry-run mode shows preview without changes
- [ ] --quiet flag produces minimal output
- [ ] --keep-backup preserves backup after success
- [ ] Rollback works when update fails
- [ ] Rollback works when post-update validation fails
- [ ] Exit codes match specification
- [ ] Error messages are clear and actionable

### Security Requirements

**Input Validation (FR-13, FR-14):**
- [ ] Skill name validation rejects path traversal, null bytes, non-ASCII
- [ ] Skill name format enforced (max 64 chars, lowercase + digits + hyphens)
- [ ] Package path validation prevents escape
- [ ] Package path verified as regular file with `.skill` extension

**ZIP Security (FR-15):**
- [ ] ZIP entry path traversal prevention implemented
- [ ] ZIP entries with absolute paths rejected
- [ ] ZIP symlinks validated for containment
- [ ] ZIP bomb detection (compression ratio, nested archives)

**File System Security (NFR-3):**
- [ ] Scope restricted to project/personal only
- [ ] Case sensitivity verification on macOS/Windows
- [ ] TOCTOU protection during all file operations
- [ ] Symlink escape prevention (skill directory, backup directory)
- [ ] `O_NOFOLLOW` used for file operations

**Hard Link Detection (FR-16):**
- [ ] Hard link count checked before operations
- [ ] Warning displayed for files with nlink > 1
- [ ] `--force` required for hard-linked files

**Concurrent Access (FR-17):**
- [ ] Lock file created with atomic creation (O_CREAT | O_EXCL)
- [ ] Stale lock detection implemented
- [ ] Lock file cleaned up on completion and signals

**Backup Security (NFR-5):**
- [ ] `~/.asm` verified not a symlink before backup
- [ ] Backup directory created with 0700 permissions
- [ ] Backup files created with 0600 permissions
- [ ] Backup filename includes random component
- [ ] Backup path containment verified

**Resource Limits (NFR-8):**
- [ ] Package size limit (1 GB) enforced before extraction
- [ ] File count limit (10,000) enforced
- [ ] Operation timeouts enforced
- [ ] Streaming enumeration for large directories

**General:**
- [ ] All security tests pass (100% required)
- [ ] Audit logging captures all operations and failures

### Quality Requirements
- [ ] All edge cases are handled
- [ ] Tests pass with >80% coverage
- [ ] Security tests pass with 100% coverage
- [ ] Documentation updated
- [ ] Updated skills work correctly in Claude Code

## Related Commands

- `asm scaffold` (FEAT-001) - Creates skill structure
- `asm validate` (FEAT-002) - Validates skills
- `asm package` (FEAT-003) - Creates .skill packages
- `asm install` (FEAT-004) - Installs skills
- `asm uninstall` (FEAT-005) - Removes skills

## Notes

This command completes the skill update workflow, providing safe in-place updates:

1. **Create**: `asm scaffold` - Create new skill from template
2. **Validate**: `asm validate` - Ensure skill meets requirements
3. **Package**: `asm package` - Bundle skill into distributable file
4. **Install**: `asm install` - Deploy skill to Claude Code environment
5. **Update**: `asm update` - Update skill to newer version
6. **Uninstall**: `asm uninstall` - Remove skill from Claude Code environment

The update command combines elements of install (package extraction, validation) and uninstall (skill discovery, file operations) to provide a seamless update experience with:

- **Safety**: Backup before modification, automatic rollback on failure
- **Visibility**: Clear diff of changes, version comparison
- **Control**: Dry-run preview, force option, backup retention

### Proposed Update Flow

1. Validate skill name (reuse `uninstall-name` validator)
2. Discover installed skill (reuse `skill-discovery`)
3. Validate new package (reuse `package-validator`)
4. Extract new package to temp location (reuse `extractor`)
5. Run validation on extracted skill (reuse `validate` generator)
6. Compare versions and show diff summary (new)
7. Create backup of current skill (new)
8. Prompt for confirmation (reuse `prompts`)
9. Replace files with new version (new)
10. Run post-update validation (reuse `validate` generator)
11. Rollback on failure or clean up backup on success (new)
12. Report results (new)

### Design Decision: Atomic Updates via Rename

The update uses rename-based operations rather than in-place modification:

1. Rename existing skill to temporary name (atomic)
2. Extract new package to skill location
3. Verify success
4. Remove old version (or restore on failure)

This approach ensures:
- No partial update state if interrupted
- Fast rollback by simple rename
- Clear separation of old and new versions during update
