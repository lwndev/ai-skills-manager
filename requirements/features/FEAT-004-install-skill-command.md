# Feature Requirements: Install Skill Command

## Overview

Enable users to install Claude Code skills from `.skill` package files into their local or project skill directories, completing the skill distribution workflow.

## Feature ID
`FEAT-004`

## GitHub Issue
[#4](https://github.com/lwndev/ai-skills-manager/issues/4)

## Priority
High - Essential for completing the skill distribution workflow

## User Story

As a skill user, I want to install skills from `.skill` package files so that I can easily add skills created by others to my Claude Code environment without manual file manipulation.

## Command Syntax

```bash
asm install <skill-package> [options]
```

### Arguments

- `<skill-package>` (required) - Path to the .skill file or skill name (for registry installation in future)

### Options

- `--scope <type>` - Installation scope: `project` (default), `personal`, or custom path
- `--force` - Overwrite existing skill without prompting
- `--dry-run` - Preview installation without making changes
- `--quiet` - Suppress detailed output, only show result

### Examples

```bash
# Install to project skills directory (.claude/skills/)
asm install reviewing-code.skill

# Install to personal skills directory
asm install reviewing-code.skill --scope personal

# Install with custom path
asm install reviewing-code.skill --scope ~/.my-custom-skills

# Force overwrite existing skill
asm install reviewing-code.skill --force

# Preview installation
asm install reviewing-code.skill --dry-run

# Quiet installation
asm install reviewing-code.skill --quiet
```

## Functional Requirements

### FR-1: Package File Validation
- Verify that the package file exists
- Verify that the file has `.skill` extension
- Verify that the file is a valid ZIP archive
- Return clear error if package is invalid

### FR-2: Package Content Validation
- Extract package to temporary directory first
- Verify SKILL.md exists in the package
- Run `asm validate` on the extracted skill
- Abort installation if validation fails
- Clean up temporary files
- Show clear error messages for validation failures

### FR-3: Installation Scope Handling
- Default to project scope (`.claude/skills/`)
- Support personal scope (`~/.claude/skills/`)
- Support custom paths via `--scope <path>`
- Create scope directory if it doesn't exist
- Verify write permissions for target directory
- Handle tilde expansion for home directory paths

### FR-4: Skill Name Extraction
- Extract skill name from package structure (root directory name in ZIP)
- Use skill name to determine installation directory
- Validate skill name format
- Handle edge cases (multiple root directories, no root directory)

### FR-5: Existing Skill Detection
- Check if skill already exists in target directory
- Prompt for confirmation before overwriting
- Show what will be overwritten
- Use `--force` flag to skip confirmation
- Preserve user's choice for batch operations

### FR-6: Package Extraction
- Extract all files from .skill package to target directory
- Preserve directory structure from package
- Preserve file permissions where possible (Unix permissions)
- Handle extraction errors gracefully
- Show progress for large packages

### FR-7: Post-Installation Validation
- Verify all files were extracted successfully
- Run `asm validate` on installed skill
- Rollback installation on validation failure
- Show installation summary with file count and location

### FR-8: Dry Run Mode
- Show what would be installed without making changes
- Display target directory path
- Show list of files that would be extracted
- Show any potential conflicts with existing files
- Display total size of installation

### FR-9: Progress Reporting
- Show package validation progress
- Display extraction progress (file count/total)
- Show post-installation validation progress
- Show final installation location
- Provide summary of installed files and size

### FR-10: Exit Codes
- `0` - Skill installed successfully
- `1` - Validation failed (package or post-installation)
- `2` - File system error (path not found, permission denied, etc.)
- `3` - Package extraction error
- `4` - User cancelled installation

## Output Format

### Success Output
```
Installing skill: reviewing-code.skill

🔍 Validating package...
  ✓ Package exists
  ✓ Valid ZIP archive
  ✓ SKILL.md found

🔍 Validating skill content...

Checks:
  ✓ SKILL.md exists
  ✓ Valid YAML frontmatter
  ✓ Required fields present
  ✓ No unknown properties
  ✓ Name format valid
  ✓ Description format valid

✅ Skill is valid!

📦 Installing to: .claude/skills/reviewing-code
  Extracting: reviewing-code/SKILL.md
  Extracting: reviewing-code/reference.md
  Extracting: reviewing-code/scripts/analyze.py
  Extracting: reviewing-code/scripts/.gitkeep

✅ Successfully installed skill: reviewing-code
   Location: .claude/skills/reviewing-code
   Files installed: 4
   Total size: 12.5 KB

Next steps:
  Your skill is now available to Claude Code
  Restart Claude Code to load the new skill
```

### Validation Failure Output
```
Installing skill: my-skill.skill

🔍 Validating package...
  ✓ Package exists
  ✓ Valid ZIP archive
  ✗ SKILL.md not found

Error: Package does not contain a valid SKILL.md file.
       The package structure should include SKILL.md at the root.

❌ Installation failed
```

### Overwrite Prompt
```
Installing skill: reviewing-code.skill

⚠️  Skill 'reviewing-code' already exists in .claude/skills/

Existing files will be replaced:
  - SKILL.md (modified)
  - reference.md (unchanged)
  - scripts/analyze.py (modified)

Overwrite? [y/N]: _
```

### Dry Run Output
```
Dry run: reviewing-code.skill

Installation preview:
  Target: .claude/skills/reviewing-code
  Status: Skill already exists (will be overwritten)

Files to install:
  ✓ reviewing-code/SKILL.md
  ✓ reviewing-code/reference.md
  ✓ reviewing-code/scripts/analyze.py
  ✓ reviewing-code/scripts/.gitkeep

Total: 4 files, 12.5 KB

No changes made (dry run mode)
```

### Quiet Output (--quiet flag)
```
✓ reviewing-code installed to .claude/skills/reviewing-code (4 files, 12.5 KB)
```

## Non-Functional Requirements

### NFR-1: Performance
- Package extraction should complete within 10 seconds for typical skills (<10MB)
- Validation should run efficiently without re-reading files multiple times
- Use streaming extraction for large packages

### NFR-2: Error Handling
- Package not found: "Error: Package file '<path>' does not exist"
- Not a ZIP file: "Error: '<path>' is not a valid .skill package"
- Invalid ZIP: "Error: Package is corrupted or invalid"
- Permission denied: "Error: Cannot write to '<path>' - permission denied"
- Disk full: "Error: Insufficient disk space to install skill"
- Extraction failure: "Error: Failed to extract package - <details>"
- Validation failure: "Error: Installed skill failed validation - <details>"

### NFR-3: Package Format
- Must support standard ZIP format
- Handle UTF-8 encoded file names
- Support cross-platform packages (Windows, macOS, Linux)
- Handle both relative and absolute paths in scope

### NFR-4: File System Safety
- Never overwrite existing files without confirmation (unless --force)
- Create installation directories with proper permissions (755)
- Clean up temporary files on error
- Rollback installation on validation failure
- Handle concurrent installations safely

### NFR-5: User Experience
- Clear progress indicators for long operations
- Helpful error messages with actionable suggestions
- Confirmation prompts that show impact of actions
- Consistent output formatting with other ASM commands

## Dependencies

- Package command (FEAT-003) for creating compatible .skill files
- Validate command (FEAT-002) for skill validation
- Node.js fs/promises module for async file operations
- Node.js path module for path handling
- Node.js os module for home directory resolution
- JSZip or adm-zip for ZIP extraction
- tmp or temp module for temporary directory creation

## Edge Cases

1. **Malformed ZIP structure**: Error if package has no root directory or multiple root directories
2. **Large packages**: Show progress bar for packages >5MB, warn for packages >50MB
3. **Symbolic links in package**: Skip or follow based on platform capabilities
4. **Special characters in filenames**: Handle according to ZIP spec and file system
5. **Installation interrupted**: Clean up partial extraction and temporary files
6. **Scope directory doesn't exist**: Create with proper permissions
7. **Scope is a file not directory**: Clear error message
8. **Skill name mismatch**: Warn if package name doesn't match skill metadata name
9. **Nested .skill files**: Warn if installing a skill that contains .skill files
10. **Permission issues mid-extraction**: Rollback and show clear error

## Testing Requirements

### Unit Tests
- Package file validation logic
- ZIP archive validation
- Skill name extraction from package
- Scope path resolution
- Overwrite detection
- Exit code logic
- Error message formatting

### Integration Tests
- Full installation workflow with valid package
- Installation to different scopes (project, personal, custom)
- Installation with existing skill (prompt and --force)
- Installation with validation failure
- Dry run mode
- Quiet mode
- Rollback on post-installation validation failure
- Cross-platform path handling

### Manual Testing
- Install skills packaged by `asm package`
- Install to various scope types
- Test overwrite scenarios
- Verify file permissions after installation
- Test with Claude Code to ensure skill loads correctly
- Test error scenarios (corrupted ZIP, missing SKILL.md, etc.)

## Acceptance Criteria

- [ ] Command accepts skill package path argument
- [ ] Command accepts all specified options (--scope, --force, --dry-run, --quiet)
- [ ] Package file validation works correctly
- [ ] Package content validation runs before installation
- [ ] Installation scope handling works for project, personal, and custom paths
- [ ] Tilde expansion works for home directory paths
- [ ] Skill name extraction works correctly
- [ ] Existing skill detection and overwrite protection works
- [ ] --force flag bypasses overwrite prompt
- [ ] Package extraction preserves structure and permissions
- [ ] Post-installation validation runs
- [ ] Rollback works on validation failure
- [ ] --dry-run mode shows preview without installing
- [ ] Progress output shows validation, extraction, and summary
- [ ] --quiet flag produces minimal output
- [ ] Exit codes match specification
- [ ] Error messages are clear and actionable
- [ ] All edge cases are handled
- [ ] Tests pass with >80% coverage
- [ ] Documentation updated
- [ ] Installed skills work with Claude Code

## Future Enhancements

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

## Related Commands

- `asm scaffold` (FEAT-001) - Creates skill structure
- `asm validate` (FEAT-002) - Validates skills
- `asm package` (FEAT-003) - Creates .skill packages for installation
- `asm uninstall` (future) - Removes installed skills
- `asm update` (future) - Updates installed skills

## Notes

This command completes the core skill lifecycle:
1. **Create**: `asm scaffold` - Create new skill from template
2. **Validate**: `asm validate` - Ensure skill meets requirements
3. **Package**: `asm package` - Bundle skill into distributable file
4. **Install**: `asm install` - Deploy skill to Claude Code environment

The install command is the consumer-facing complement to the package command. Together, they enable the complete skill distribution workflow: developers use `asm package` to create distributable skills, and users use `asm install` to add those skills to their environments.
