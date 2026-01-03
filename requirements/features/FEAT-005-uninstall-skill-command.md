# Feature Requirements: Uninstall Skill Command

## Overview

Enable users to remove installed Claude Code skills from their local or project skill directories, completing the skill lifecycle management workflow.

## Feature ID
`FEAT-005`

## GitHub Issue
[#5](https://github.com/lwndev/ai-skills-manager/issues/5)

## Priority
High - Essential for complete skill lifecycle management

## User Story

As a skill user, I want to uninstall skills I no longer need so that I can keep my Claude Code environment clean and remove skills that are unused, outdated, or causing issues.

## Command Syntax

```bash
asm uninstall <skill-name> [options]
```

### Arguments

- `<skill-name>` (required) - Name of the installed skill to remove. Supports multiple space-separated skill names.

### Options

- `--scope <project|personal>` - Installation scope to search (default: `project`)
  - `project` - Project skills directory (`.claude/skills/`)
  - `personal` - Personal skills directory (`~/.claude/skills/`)
- `--force` - Remove skill without confirmation prompt
- `--dry-run` - Preview what would be removed without making changes
- `--quiet` - Suppress detailed output, only show result

> **Note:** Only the two official Claude Code skill locations are supported. This aligns with Claude Code's skill installation behavior and provides a secure, predictable uninstall experience.

### Examples

```bash
# Uninstall from project skills directory (.claude/skills/) - default
asm uninstall reviewing-code

# Uninstall from personal skills directory (~/.claude/skills/)
asm uninstall reviewing-code --scope personal

# Force uninstall without confirmation
asm uninstall reviewing-code --force

# Preview uninstallation
asm uninstall reviewing-code --dry-run

# Quiet uninstallation
asm uninstall reviewing-code --quiet

# Uninstall multiple skills
asm uninstall reviewing-code documenting-features testing-utils
```

## Functional Requirements

### FR-1: Skill Discovery and Verification
- Locate skill directory within the specified scope
- Verify the skill exists before attempting removal
- Search for skill by name in scope directory (e.g., `.claude/skills/<skill-name>`)
- Verify directory contains SKILL.md before proceeding
- If no SKILL.md found, display warning and require `--force` to proceed
- Warning message: "Warning: '<name>' does not appear to be a valid skill (no SKILL.md). Use --force to remove anyway."
- Return clear error if skill is not found

### FR-2: Skill Validation Pre-Check
- Run `asm validate` on the skill before uninstallation (informational only)
- Display warning if skill appears to be invalid or corrupted
- Proceed with uninstallation regardless of validation status (user may want to remove broken skills)
- Note: This is advisory only; don't block removal of invalid skills

### FR-3: Scope Handling
- **Only two scopes are supported** (aligned with Claude Code's official skill locations):
  - `project` (default): `.claude/skills/` relative to current working directory
  - `personal`: `~/.claude/skills/` in user's home directory
- Handle tilde expansion for personal scope
- Error if scope directory doesn't exist
- Reject any scope value other than `project` or `personal`
- This restriction eliminates an entire class of path-based security vulnerabilities

### FR-4: Confirmation Prompt
- Display what will be removed before deletion
- Show list of files and directories that will be deleted
- Show total size of files to be removed
- Require explicit confirmation (y/N, default No)
- Skip confirmation with `--force` flag

### FR-5: Skill Removal
- Remove entire skill directory and all contents
- Handle nested files and directories
- Handle read-only files gracefully (attempt to remove, report if unable)
- **Do NOT clean up parent directories** (safety measure - we cannot reliably determine if ASM created them)
- Only remove the exact skill directory specified, nothing above it

### FR-6: Multiple Skills Support
- Accept multiple skill names in a single command
- Process each skill sequentially
- Continue with remaining skills if one fails (non-atomic)
- Display summary of all operations at the end
- Prompt once for all skills unless individual issues arise
- **Bulk deletion safeguard:**
  - When `--force` is used with 3 or more skills, require explicit confirmation
  - Prompt: "Removing N skills with --force. Type 'yes' to confirm: "
  - Only proceed if user types exactly "yes"

### FR-7: Dry Run Mode
- Show what would be removed without making changes
- Display target directory path
- Show list of files that would be deleted
- Display total size of files
- Clearly indicate no changes were made

### FR-8: Progress Reporting
- Show skill discovery progress
- Display file removal progress for large skill directories
- Show final summary with removed file count and freed space
- Provide clear success or failure message

### FR-9: Exit Codes
- `0` - Skill(s) uninstalled successfully
- `1` - Skill not found
- `2` - File system error (permission denied, etc.)
- `3` - User cancelled uninstallation
- `4` - Partial failure (some skills removed, some failed)
- `5` - Security error (path traversal attempt, invalid skill name, symlink escape)

### FR-10: Rollback Capability
- If removal fails mid-operation, report which files were removed
- Do not attempt automatic restoration (complex and error-prone)
- Provide clear message about partial removal state
- Suggest manual cleanup if needed

### FR-11: Skill Name Input Validation (Security)
- **Validate skill name BEFORE any file system operations**
- Reject skill names containing path separators (`/` or `\`)
- Reject skill names that are `.` or `..`
- Reject absolute paths as skill names (starting with `/` or drive letter)
- Reject skill names containing null bytes or control characters
- **Reject any non-ASCII characters** (simplest defense against Unicode normalization attacks)
  - Do not attempt Unicode normalization; reject outright
  - This prevents confusable characters, normalization form attacks (NFC/NFD), and Unicode path separators
- Validate against same format rules as install command:
  - Maximum 64 characters
  - Lowercase ASCII letters (a-z), ASCII digits (0-9), and hyphens only
  - Must not start or end with hyphen
- Return clear error: "Error: Invalid skill name '<name>'. Skill names must contain only lowercase letters, numbers, and hyphens."
- This validation must occur before path construction to prevent path traversal attacks

### FR-12: Hard Link Detection (Security)
- Before deletion, check if any files within the skill directory have a hard link count > 1
- Use `stat()` to retrieve `nlink` (link count) for each file
- If hard links are detected:
  - Display warning: "Warning: Skill contains files with multiple hard links. These files may exist elsewhere on the filesystem."
  - List affected files with their link counts
  - Require `--force` to proceed
- This prevents accidental deletion of files that are referenced from other locations
- Note: Hard links can only be created by users with write access to both locations, limiting attack surface

## Output Format

### Success Output
```
Uninstalling skill: reviewing-code

🔍 Locating skill...
   Found: .claude/skills/reviewing-code

📁 Files to be removed:
   - SKILL.md (2.1 KB)
   - reference.md (4.5 KB)
   - scripts/analyze.py (1.2 KB)
   - scripts/.gitkeep (0 B)

   Total: 4 files, 7.8 KB

⚠️  This action cannot be undone.
Remove skill 'reviewing-code'? [y/N]: y

🗑️  Removing files...
   ✓ Removed: SKILL.md
   ✓ Removed: reference.md
   ✓ Removed: scripts/analyze.py
   ✓ Removed: scripts/.gitkeep
   ✓ Removed: scripts/
   ✓ Removed: reviewing-code/

✅ Successfully uninstalled skill: reviewing-code
   Removed: 4 files, 7.8 KB
   Location was: .claude/skills/reviewing-code
```

### Skill Not Found Output
```
Uninstalling skill: nonexistent-skill

🔍 Locating skill...

Error: Skill 'nonexistent-skill' not found in .claude/skills/

Suggestions:
  - Check the skill name spelling
  - Verify the skill is installed: ls .claude/skills/
  - Try a different scope: asm uninstall <skill> --scope personal

❌ Uninstallation failed
```

### Multiple Skills Output
```
Uninstalling skills: reviewing-code, documenting-features, testing-utils

📁 Skills to be removed:
   1. reviewing-code (4 files, 7.8 KB)
   2. documenting-features (6 files, 12.3 KB)
   3. testing-utils (3 files, 5.1 KB)

   Total: 13 files, 25.2 KB

⚠️  This action cannot be undone.
Remove 3 skills? [y/N]: y

🗑️  Removing reviewing-code...
   ✓ Removed: 4 files

🗑️  Removing documenting-features...
   ✓ Removed: 6 files

🗑️  Removing testing-utils...
   ✓ Removed: 3 files

✅ Successfully uninstalled 3 skills
   Total removed: 13 files, 25.2 KB
```

### Dry Run Output
```
Dry run: reviewing-code

Uninstallation preview:
   Location: .claude/skills/reviewing-code
   Status: Skill found

Files that would be removed:
   - SKILL.md (2.1 KB)
   - reference.md (4.5 KB)
   - scripts/analyze.py (1.2 KB)
   - scripts/.gitkeep (0 B)

Total: 4 files, 7.8 KB

No changes made (dry run mode)
```

### Quiet Output (--quiet flag)
```
✓ reviewing-code uninstalled from .claude/skills/ (4 files, 7.8 KB)
```

### Cancellation Output
```
Uninstalling skill: reviewing-code

🔍 Locating skill...
   Found: .claude/skills/reviewing-code

📁 Files to be removed:
   - SKILL.md (2.1 KB)
   - reference.md (4.5 KB)
   - scripts/analyze.py (1.2 KB)
   - scripts/.gitkeep (0 B)

   Total: 4 files, 7.8 KB

⚠️  This action cannot be undone.
Remove skill 'reviewing-code'? [y/N]: n

Cancelled. No changes made.
```

### Security Error Output (Invalid Skill Name)
```
asm uninstall ../../../etc/passwd

🛑 Security Error: Invalid skill name '../../../etc/passwd'

Skill names must:
  - Contain only lowercase letters, numbers, and hyphens
  - Not contain path separators (/ or \)
  - Not be longer than 64 characters

❌ Uninstallation aborted (exit code 5)
```

### Security Error Output (Symlink Escape)
```
Uninstalling skill: malicious-skill

🔍 Locating skill...
   Found: .claude/skills/malicious-skill

🛑 Security Error: Skill directory is a symlink pointing outside the allowed scope

   Skill path: .claude/skills/malicious-skill
   Symlink target: /etc/important-config
   Allowed scope: .claude/skills/

This could indicate a malicious skill or misconfiguration.
The skill directory will NOT be removed.

❌ Uninstallation aborted (exit code 5)
```

### Invalid Scope Output
```
asm uninstall my-skill --scope /custom/path

Error: Invalid scope '/custom/path'

Only the following scopes are supported:
  --scope project   .claude/skills/ (default)
  --scope personal  ~/.claude/skills/

❌ Uninstallation failed
```

### Hard Link Warning Output
```
Uninstalling skill: shared-utils

🔍 Locating skill...
   Found: .claude/skills/shared-utils

⚠️  Warning: Skill contains files with multiple hard links

The following files exist in other locations on this filesystem:
   - shared-utils/common.js (2 hard links)
   - shared-utils/helpers.js (3 hard links)

Removing these files will affect all linked locations.
Use --force to proceed anyway.

❌ Uninstallation requires --force
```

### Case Mismatch Output (macOS/Windows)
```
asm uninstall my-skill

🔍 Locating skill...

🛑 Security Error: Directory name case mismatch

   Input: my-skill
   Actual: MY-SKILL

On case-insensitive filesystems, this could indicate a symlink
substitution attack. The skill will NOT be removed.

❌ Uninstallation aborted (exit code 5)
```

### TOCTOU Violation Output
```
Uninstalling skill: test-skill

🔍 Locating skill...
   Found: .claude/skills/test-skill

🗑️  Removing files...
   ✓ Removed: SKILL.md
   ⚠️  Skipped: data.json (security: file changed during operation)
   ✓ Removed: config.yml

⚠️  Security Warning: 1 file skipped due to TOCTOU violation
   This may indicate a race condition attack or concurrent modification.
   Check audit log for details: ~/.asm/audit.log

✅ Partially uninstalled skill: test-skill
   Removed: 2 files, 3.2 KB
   Skipped: 1 file (security concern)
```

## Non-Functional Requirements

### NFR-1: Performance
- Skill discovery should complete within 2 seconds
- File removal should handle 100+ files efficiently
- Show progress indicators for directories with >20 files
- Total operation should complete within 10 seconds for typical skills

### NFR-2: Error Handling
- Skill not found: "Error: Skill '<name>' not found in <scope>"
- Permission denied: "Error: Cannot remove '<path>' - permission denied"
- Directory not empty after removal: "Warning: Directory not fully removed"
- Read-only file: "Warning: Could not remove read-only file '<path>'"
- Scope not found: "Error: Scope directory '<path>' does not exist"

### NFR-3: File System Safety
- Never remove files outside the skill directory
- Never remove the scope directory itself (only the skill subdirectory)
- Handle concurrent access gracefully
- **Path Construction (Simplified by scope restriction):**
  - Scope is always one of two known paths: `.claude/skills/` or `~/.claude/skills/`
  - Skill name is validated by FR-11 (no path separators, no traversal)
  - Final path is simply: `<scope>/<validated-skill-name>`
  - Resolve final path using `realpath()` to handle symlinks
  - Verify resolved path starts with resolved scope path (containment check)
- **Case Sensitivity Verification (macOS/Windows):**
  - After path construction, read the actual directory name from the filesystem
  - Verify the actual directory name matches the input skill name exactly (byte-for-byte)
  - On case-insensitive filesystems (HFS+, APFS, NTFS), reject if case differs
  - This prevents symlink substitution attacks where `SKILL-NAME` → malicious target could be accessed via `skill-name`
  - Implementation: Use `fs.readdir()` on parent and compare actual entry name
- **Symbolic Link Handling:**
  - Before deletion, check if skill directory itself is a symlink
  - If skill directory symlink target is outside scope, refuse to delete
  - Use `lstat()` not `stat()` when enumerating files to identify symlinks
  - Never follow directory symlinks during recursive deletion
  - **Nested directory symlinks:** When encountering a directory symlink during recursion, remove the symlink itself (like a file), do NOT descend into it
  - Remove symlink files themselves, never their targets
  - Error message: "Security error: Skill directory is a symlink pointing outside the allowed scope"
- **TOCTOU (Time-of-Check to Time-of-Use) Protection:**
  - Re-verify each file path immediately before deletion using `lstat()`
  - Use `O_NOFOLLOW` flag (or equivalent) when opening files for deletion
  - Perform containment check on each file's resolved path before removal
  - Use `openat()` with directory file descriptors where possible to prevent path substitution attacks
  - If a file fails re-verification, skip it and log a security warning
  - Implementation pattern:
    1. Open skill directory with `O_DIRECTORY | O_NOFOLLOW`
    2. Enumerate files using `readdir()` on the directory fd
    3. For each file, use `fstatat()` with `AT_SYMLINK_NOFOLLOW` to verify before `unlinkat()`
    4. This ensures the file being deleted is the same file that was checked

### NFR-4: User Experience
- Clear confirmation prompts showing impact of action
- Helpful error messages with actionable suggestions
- Consistent output formatting with other ASM commands
- Default to safe behavior (require confirmation)

### NFR-5: Destructive Operation Safeguards
- **Combined --quiet and --force restrictions:**
  - When both `--quiet` and `--force` are used together, still output a single summary line
  - Never allow completely silent destructive operations
  - Minimum output: "Removed: <skill-name> (N files)"
- **Audit trail:**
  - Even in quiet mode, errors must always be displayed
  - Exit code must always reflect actual operation result

### NFR-6: Audit Logging
- Log all uninstall operations to a local audit log file
- Log location: `~/.asm/audit.log` (created if not exists)
- Log format: `[ISO-8601 timestamp] UNINSTALL <skill-name> <scope> <status> <details>`
- Log entries include:
  - Timestamp (ISO 8601 format with timezone)
  - Operation type (UNINSTALL)
  - Skill name(s) targeted
  - Scope (project or personal)
  - Full resolved path
  - Status (SUCCESS, FAILED, PARTIAL, CANCELLED, SECURITY_BLOCKED)
  - Number of files removed
  - Error details if applicable
  - User (from environment, if available)
- Security-relevant events are always logged, even if --quiet is used:
  - Security blocks (symlink escape, path traversal attempt)
  - Hard link warnings
  - TOCTOU violations detected
- Log file permissions: 0600 (owner read/write only)
- Log rotation: Not implemented in v1; future enhancement

### NFR-7: Resource Limits (DoS Prevention)
- **Maximum files per skill:** 10,000 files
  - If skill contains more than 10,000 files, require `--force` to proceed
  - Display warning: "Warning: Skill contains N files (exceeds 10,000 limit). Use --force to proceed."
- **Maximum total size:** 1 GB
  - If skill directory exceeds 1 GB, require `--force` to proceed
  - Display warning: "Warning: Skill is N MB (exceeds 1 GB limit). Use --force to proceed."
- **Operation timeout:** 5 minutes
  - If deletion takes longer than 5 minutes, abort with clear message
  - Report progress at abort time
  - Exit code 2 (file system error)
- **Memory usage:** Enumerate files in streaming fashion, not all at once
  - Do not load entire file list into memory for large directories
  - Process and display files in batches

### NFR-8: Signal Handling (Interrupt Safety)
- **SIGINT (Ctrl+C) handling:**
  - First SIGINT: Complete deletion of current file, then stop gracefully
  - Display: "Interrupted. N of M files removed."
  - Set exit code 3 (user cancelled)
  - Do not leave files in partially written state
- **SIGTERM handling:**
  - Same behavior as SIGINT
- **State consistency:**
  - Each file deletion is atomic (file either exists or doesn't)
  - Directory removal only after all contents removed
  - If interrupted mid-skill, that skill is in partial state (expected)
- **Prompt interruption:**
  - If interrupted during confirmation prompt, treat as "No"
  - Display: "Cancelled. No changes made."

## Dependencies

- Install command (FEAT-004) for understanding skill installation structure
- Validate command (FEAT-002) for pre-uninstall checks (advisory)
- Node.js fs/promises module for async file operations
- Node.js path module for path handling
- Node.js os module for home directory resolution

## Edge Cases

1. **Skill directory is a symbolic link**: Check if target is within scope; refuse if pointing outside scope
2. **Skill contains symbolic links**: Remove links themselves, never follow or delete targets
3. **Read-only files in skill**: Warn and skip, continue with other files
4. **Skill directory has unexpected files**: If directory contains files not typical for skills (e.g., `.git`, `node_modules`, large binaries >10MB), require `--force` to proceed. Display warning: "Directory contains unexpected files. Review contents before removing."
5. **Skill being uninstalled is currently in use by Claude Code**: Warn but proceed (Claude Code will handle gracefully)
6. **Uninstall interrupted (Ctrl+C)**: Leave partial state, show warning on next command
7. **Scope directory doesn't exist**: Clear error message (e.g., `.claude/skills/` not found)
8. **Skill name with special characters**: Reject with clear error (FR-11 validation)
9. **Empty skill directory**: Remove directory, warn that skill was empty
10. **Nested skill directories**: Only remove the exact skill requested
11. **Same skill name in both scopes**: Only remove from specified scope; inform user skill exists in other scope
12. **File locked by another process**: Retry once, then warn and skip
13. **Skill name contains path traversal**: Reject immediately via FR-11 validation
14. **Race condition - files added during deletion**: Complete deletion of enumerated files; new files added during operation are ignored; use TOCTOU protections (NFR-3) to prevent malicious file substitution
15. **Skill directory resolves outside scope**: Refuse to delete (symlink escape attempt)
16. **Hard links detected in skill**: Warn user and require `--force` (FR-12); log to audit
17. **Case mismatch on case-insensitive filesystem**: Reject if actual directory name case differs from input (NFR-3 case sensitivity verification)
18. **Concurrent uninstall of same skill**: Second invocation should fail gracefully with "Skill not found" or "Skill already being removed"
19. **File replaced with symlink during deletion (TOCTOU attack)**: Detected by NFR-3 TOCTOU protections; file skipped and security warning logged
20. **Skill contains directory symlink to external location**: Remove the symlink itself, do not descend into it (NFR-3 nested directory symlinks)
21. **Unicode skill name variations**: Reject any non-ASCII characters (FR-11); prevents normalization attacks
22. **Skill exceeds resource limits (>10K files or >1GB)**: Warn and require `--force` (NFR-7)
23. **Operation timeout**: Abort after 5 minutes with progress report (NFR-7)

## Testing Requirements

### Unit Tests
- Skill discovery logic
- Scope enum validation (only `project` or `personal` accepted)
- Tilde expansion for personal scope
- File listing and size calculation
- Multiple skill name parsing
- Exit code logic
- Error message formatting
- **Skill name validation (FR-11):**
  - Format validation (lowercase, hyphens, numbers only)
  - Path separator rejection
  - Absolute path rejection
  - Null byte and control character rejection
  - Length limit enforcement
- **Path containment verification (NFR-3):**
  - Symlink resolution before containment check
  - Scope boundary enforcement

### Integration Tests
- Full uninstallation workflow
- Uninstallation from both scopes (project and personal)
- Invalid scope rejection
- Uninstallation with confirmation prompt
- Uninstallation with --force flag
- Dry run mode
- Quiet mode
- Multiple skills uninstallation
- Partial failure scenarios

### Manual Testing
- Uninstall skills installed by `asm install`
- Uninstall from both project and personal scopes
- Test confirmation prompts
- Verify skill is no longer available in Claude Code
- Test error scenarios (missing skill, permission denied, etc.)
- Test with Claude Code running
- Verify invalid scope values are rejected

### Security Tests
Security-focused test cases that MUST pass before release:

**Input Validation Tests (FR-11):**
- Skill name with path traversal attempts (`../`, `..%2F`, `....//`, etc.)
- Skill name as absolute path (`/etc/passwd`, `C:\Windows\System32`)
- Skill name with null bytes (`skill\x00name`)
- Skill name with control characters
- Skill name with Unicode path separators
- Skill name with URL-encoded characters (`%2F`, `%5C`)
- Skill name exceeding 64 characters
- Skill name with uppercase letters (should reject)

**Scope Validation Tests (FR-3):**
- Invalid scope value rejected (e.g., `--scope /etc`)
- Only `project` and `personal` accepted
- Scope parameter is case-sensitive

**Symlink Tests:**
- Skill directory is a symlink to `/tmp`
- Skill directory is a symlink to location outside scope
- Skill containing symlinks pointing outside scope
- Skill containing symlink to parent directory (loop)
- Nested symlinks that eventually escape scope

**Path Resolution Tests:**
- Verify `realpath()` is used before containment check
- Verify containment check happens AFTER symlink resolution
- Test with case variations on case-insensitive file systems

**Concurrent Access Tests:**
- Files added to skill directory during deletion
- Skill directory renamed during deletion
- Permission changes during deletion

**Boundary Tests:**
- Skill with name matching scope directory name (e.g., skill named "skills")
- Empty scope directory after skill removal

**Hard Link Tests (FR-12):**
- Skill file with link count > 1 (hard link exists elsewhere)
- Hard link detection correctly identifies linked files
- Warning displayed and `--force` required
- Audit log records hard link warning

**Case Sensitivity Tests (NFR-3):**
- On macOS/Windows: skill directory `SKILL-NAME` accessed via input `skill-name` (should reject)
- Verify exact byte-for-byte match between input and actual directory name
- Symlink with uppercase name pointing to malicious target

**Unicode/ASCII Tests (FR-11):**
- Skill name with Unicode lookalike characters (e.g., Cyrillic 'а' vs ASCII 'a')
- Skill name with Unicode normalization forms (NFC vs NFD)
- Skill name with zero-width characters
- Skill name with right-to-left override characters
- All non-ASCII input rejected before path construction

**TOCTOU Attack Simulation Tests (NFR-3):**
- File replaced with symlink between enumeration and deletion
- Directory replaced with symlink between enumeration and deletion
- Verify `openat()`/`unlinkat()` pattern prevents path substitution
- Verify each file re-verified immediately before deletion

**Signal Handling Tests (NFR-8):**
- SIGINT during file enumeration phase
- SIGINT during file deletion phase
- SIGINT during confirmation prompt
- Verify partial state is correctly reported
- Verify exit code is 3 (user cancelled)

**Resource Limit Tests (NFR-7):**
- Skill with exactly 10,000 files (should pass)
- Skill with 10,001 files (should require --force)
- Skill with exactly 1 GB (should pass)
- Skill exceeding 1 GB (should require --force)
- Operation exceeding 5-minute timeout

**Audit Logging Tests (NFR-6):**
- Successful uninstall logged
- Failed uninstall logged
- Security block logged
- Log file created with correct permissions (0600)
- Log format is correct

## Acceptance Criteria

### Functional Requirements
- [ ] Command accepts skill name argument
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
- [ ] Exit codes match specification
- [ ] Error messages are clear and actionable

### Security Requirements (Critical)
- [ ] Only `project` and `personal` scopes are accepted (no arbitrary paths)
- [ ] Skill name input validation rejects path separators (`/`, `\`)
- [ ] Skill name input validation rejects `..` and `.`
- [ ] Skill name input validation rejects absolute paths
- [ ] Skill name input validation rejects null bytes and control characters
- [ ] Skill name input validation rejects non-ASCII characters (FR-11)
- [ ] Skill name format validation matches install command rules
- [ ] Path canonicalization uses realpath() before containment check
- [ ] Containment check verifies resolved path is within scope
- [ ] Case sensitivity verification on case-insensitive filesystems (NFR-3)
- [ ] Symlink skill directories pointing outside scope are rejected
- [ ] Directory symlinks are not followed during recursive deletion
- [ ] Nested directory symlinks are removed as files, not descended into (NFR-3)
- [ ] Hard links detected and require --force to proceed (FR-12)
- [ ] TOCTOU protection: each file re-verified before deletion (NFR-3)
- [ ] TOCTOU protection: openat()/unlinkat() pattern used where possible (NFR-3)
- [ ] Audit logging captures all security-relevant events (NFR-6)
- [ ] Resource limits prevent DoS (NFR-7)
- [ ] Signal handling prevents undefined state (NFR-8)
- [ ] All security tests pass

### Quality Requirements
- [ ] All edge cases are handled
- [ ] Tests pass with >80% coverage
- [ ] Security tests pass with 100% coverage
- [ ] Documentation updated
- [ ] Uninstalled skills no longer available in Claude Code

## Future Enhancements

- Custom scope paths (if Claude Code adds support for additional skill locations)
- Registry integration (remove registry reference when uninstalling)
- Dependency checking (warn if other skills depend on this one)
- Backup before removal (create .skill archive)
- Undo last uninstall
- Batch uninstall from list file
- Uninstall by pattern (e.g., `asm uninstall --pattern "test-*"`)
- Automatic cleanup of orphaned skill artifacts
- Integration with `asm list` command for interactive selection

## Related Commands

- `asm scaffold` (FEAT-001) - Creates skill structure
- `asm validate` (FEAT-002) - Validates skills
- `asm package` (FEAT-003) - Creates .skill packages
- `asm install` (FEAT-004) - Installs skills (inverse operation)
- `asm list` (future) - Lists installed skills
- `asm update` (future) - Updates installed skills

## Notes

This command completes the skill removal workflow:
1. **Create**: `asm scaffold` - Create new skill from template
2. **Validate**: `asm validate` - Ensure skill meets requirements
3. **Package**: `asm package` - Bundle skill into distributable file
4. **Install**: `asm install` - Deploy skill to Claude Code environment
5. **Uninstall**: `asm uninstall` - Remove skill from Claude Code environment

The uninstall command is the complement to the install command. Together, they provide complete lifecycle management for skills in a Claude Code environment. The command follows npm conventions for package removal, providing clear feedback and safe defaults.

### Security Design Decision: Scope Restriction

This command intentionally restricts the `--scope` option to only `project` and `personal` values, corresponding to Claude Code's two official skill locations:
- `.claude/skills/` (project)
- `~/.claude/skills/` (personal)

This design decision eliminates an entire class of security vulnerabilities:
- **No arbitrary path deletion**: Users cannot accidentally or maliciously target system directories
- **No path traversal via scope**: The scope is an enum, not a path string
- **Simplified validation**: Only skill name needs path-safety validation
- **Aligned with Claude Code**: Matches the official skill installation locations

If Claude Code adds support for additional skill locations in the future, this restriction can be revisited.
