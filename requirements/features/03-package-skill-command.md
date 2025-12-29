# Feature Requirements: Package Skill Command

## Overview

Enable users to package a validated Claude Code skill into a distributable `.skill` file (ZIP archive) for sharing, installation, and version control.

## Feature ID
`FEAT-003`

## GitHub Issue
[#3](https://github.com/lwndev/ai-skills-manager/issues/3)

## Priority
High - Essential for skill distribution and sharing

## User Story

As a skill developer, I want to package my validated skill into a distributable `.skill` file so that I can share it with others, publish it to registries, or version control the packaged artifact.

## Command Syntax

```bash
asm package <skill-path> [options]
```

### Arguments

- `<skill-path>` (required) - Path to the skill directory containing SKILL.md

### Options

- `--output <path>` - Output directory for the .skill file (default: current directory)
- `--force` - Overwrite existing .skill file without prompting
- `--skip-validation` - Skip validation step (not recommended)
- `--quiet` - Suppress detailed output, only show result

### Examples

```bash
# Package a skill in the current directory
asm package .

# Package a specific skill directory
asm package ./my-skill

# Package with custom output directory
asm package ./my-skill --output ./dist

# Package a project skill
asm package .claude/skills/reviewing-code --output ./packages

# Force overwrite existing package
asm package ./my-skill --force

# Package without validation (not recommended)
asm package ./my-skill --skip-validation
```

## Functional Requirements

### FR-1: Skill Path Validation
- Verify that the skill path exists
- Verify that the path is a directory
- If path points to a SKILL.md file, use its parent directory
- Return clear error if path is invalid

### FR-2: SKILL.md Existence Check
- Verify that `SKILL.md` exists in the skill directory
- Return clear error if SKILL.md is not found

### FR-3: Pre-Package Validation
- Run `asm validate` on the skill before packaging
- Display validation progress and results
- Abort packaging if validation fails (unless `--skip-validation` is used)
- Show clear error messages for validation failures

### FR-4: Package File Naming
- Use the skill directory name as the package name
- Format: `<skill-name>.skill`
- Example: `reviewing-code/` → `reviewing-code.skill`

### FR-5: ZIP Archive Creation
- Create a ZIP file with `.skill` extension
- Use ZIP_DEFLATED compression
- Include all files and subdirectories from the skill directory
- Preserve directory structure within the archive
- Archive structure: skill folder name as root
  ```
  reviewing-code.skill (ZIP)
  └── reviewing-code/
      ├── SKILL.md
      ├── reference.md (if exists)
      └── scripts/ (if exists)
          └── helper.py
  ```

### FR-6: File Inclusion Rules
- Include all files in the skill directory
- Include all subdirectories and their contents
- Include hidden files (e.g., `.gitkeep`)
- Exclude common development artifacts:
  - `.git/` directory
  - `node_modules/` directory
  - `.DS_Store` files
  - `*.log` files
  - `__pycache__/` directories
  - `*.pyc` files

### FR-7: Output Directory Handling
- Default output directory is current working directory
- Create output directory if it doesn't exist
- Handle custom output paths via `--output` option
- Use absolute paths for output location

### FR-8: Overwrite Protection
- Check if output file already exists
- Prompt for confirmation before overwriting
- Use `--force` flag to skip confirmation
- Show clear message when skipping existing file

### FR-9: Progress Reporting
- Show validation progress
- Display each file as it's added to the archive
- Show final package location and size
- Provide summary of packaged files

### FR-10: Exit Codes
- `0` - Package created successfully
- `1` - Validation failed (unless --skip-validation)
- `2` - File system error (path not found, permission denied, etc.)
- `3` - Package creation error

## Output Format

### Success Output
```
Packaging skill: reviewing-code

🔍 Validating skill...

Checks:
  ✓ SKILL.md exists
  ✓ Valid YAML frontmatter
  ✓ Required fields present
  ✓ No unknown properties
  ✓ Name format valid
  ✓ Description format valid

✅ Skill is valid!

📦 Creating package...
  Added: reviewing-code/SKILL.md
  Added: reviewing-code/reference.md
  Added: reviewing-code/scripts/analyze.py
  Added: reviewing-code/scripts/.gitkeep

✅ Successfully packaged skill to: ./reviewing-code.skill
   Package size: 12.5 KB
   Files included: 4

Distribution:
  Share this .skill file to distribute your skill
  Install with: asm install reviewing-code.skill
```

### Validation Failure Output
```
Packaging skill: my-skill

🔍 Validating skill...

Checks:
  ✓ SKILL.md exists
  ✓ Valid YAML frontmatter
  ✗ Name format invalid

Error: Name 'My_Skill' should be hyphen-case (lowercase letters, digits, and hyphens only).
       Example: 'my-skill', 'code-reviewer', 'pdf-processor-v2'

❌ Validation failed. Please fix the errors before packaging.
   Use --skip-validation to package anyway (not recommended)
```

### Overwrite Prompt
```
Packaging skill: reviewing-code

⚠️  Package already exists: ./reviewing-code.skill

Overwrite? [y/N]: _
```

### Quiet Output (--quiet flag)
```
✓ reviewing-code.skill created (12.5 KB, 4 files)
```

## Non-Functional Requirements

### NFR-1: Performance
- Package creation should complete within 5 seconds for typical skills (<10MB)
- No performance degradation for skills with many small files
- Efficient ZIP compression (ZIP_DEFLATED)

### NFR-2: Error Handling
- Directory not found: "Error: Skill directory '<path>' does not exist"
- Not a directory: "Error: Path '<path>' is not a directory"
- SKILL.md not found: "Error: SKILL.md not found in '<path>'"
- Permission denied: "Error: Cannot read '<path>' - permission denied"
- Disk full: "Error: Insufficient disk space to create package"
- ZIP creation failure: "Error: Failed to create package - <details>"

### NFR-3: Package Format
- Standard ZIP format compatible with all ZIP tools
- UTF-8 encoding for file names
- Preserve file permissions where possible
- Cross-platform compatible (Windows, macOS, Linux)

### NFR-4: File System Safety
- Never overwrite existing files without confirmation (unless --force)
- Create output directories with proper permissions
- Handle long file paths gracefully
- Clean up partial files on error

## Dependencies

- Node.js fs module for file operations
- Node.js path module for path handling
- JSZip or archiver for ZIP creation
- Existing `asm validate` command implementation

## Reference Implementation

This command is a TypeScript implementation of Anthropic's packaging script:
- **Source**: `docs/anthropic/skills/scripts/package_skill.py`
- **Original repository**: https://github.com/anthropics/skills/blob/main/skill-creator/scripts/package_skill.py

**Core functionality from package_skill.py:**
1. Validate skill path exists and is a directory
2. Check SKILL.md exists
3. Run validation before packaging
4. Create ZIP archive with .skill extension
5. Include all files from skill directory
6. Preserve directory structure in archive
7. Show progress as files are added
8. Report final package location

**ASM value-add features (not in Anthropic's script):**
- `--force` flag for overwrite handling
- `--skip-validation` flag (with warning)
- `--quiet` flag for minimal output
- File exclusion rules (node_modules, .git, etc.)
- Package size reporting
- File count reporting
- More detailed progress output
- Exit code granularity

**Integration with ASM ecosystem:**
- Uses `asm validate` for pre-packaging validation
- Prepares packages for future `asm install` command
- Complements `asm scaffold` and `asm validate` workflow

## Edge Cases

1. **Empty skill directory**: Error if only SKILL.md exists with no content
2. **Symbolic links**: Follow symlinks or skip with warning
3. **Very large files**: Warn if individual file >10MB or total >50MB
4. **Binary files**: Include but warn if skill contains large binaries
5. **Nested .skill files**: Warn if packaging a skill that contains .skill files
6. **Invalid characters in filenames**: Handle according to ZIP spec
7. **Concurrent package creation**: Handle file locks appropriately
8. **Interrupted packaging**: Clean up partial .skill file
9. **Output directory is readonly**: Clear error message
10. **Skill name collision**: Prompt for overwrite or use different output path

## Testing Requirements

### Unit Tests
- Path validation logic
- SKILL.md existence check
- Output file naming
- Overwrite detection
- File exclusion filters
- ZIP archive structure
- Exit code logic

### Integration Tests
- Full package workflow with valid skill
- Package with custom output directory
- Package with existing file (prompt and --force)
- Package with validation failure
- Package with --skip-validation
- Package with --quiet flag
- Verify ZIP contents and structure
- Cross-platform compatibility

### Manual Testing
- Package skills created by `asm scaffold`
- Package validated skills from `asm validate`
- Extract .skill file and verify contents
- Test package installation (when `asm install` is implemented)
- Verify with various ZIP tools (unzip, 7zip, WinZip, etc.)

## Acceptance Criteria

- [ ] Command accepts skill path argument
- [ ] Command accepts all specified options (--output, --force, --skip-validation, --quiet)
- [ ] Skill path validation works for directories and SKILL.md files
- [ ] SKILL.md existence is verified
- [ ] Pre-package validation runs and blocks packaging on failure
- [ ] --skip-validation flag bypasses validation
- [ ] Package file naming follows convention: `<skill-name>.skill`
- [ ] ZIP archive includes all skill files and preserves structure
- [ ] Common development artifacts are excluded (.git, node_modules, etc.)
- [ ] Output directory defaults to current directory
- [ ] Custom output directory is created if needed
- [ ] Existing file overwrite protection works
- [ ] --force flag bypasses overwrite prompt
- [ ] Progress output shows validation, files added, and summary
- [ ] --quiet flag produces minimal output
- [ ] Package size and file count are reported
- [ ] Exit codes match specification
- [ ] Error messages are clear and actionable
- [ ] All edge cases are handled
- [ ] Tests pass with >80% coverage
- [ ] Documentation updated
- [ ] Integration with `asm validate` works correctly

## Future Enhancements

- Support for `.skillignore` file (like `.gitignore`)
- Package signing/verification
- Metadata injection (version, author, timestamp)
- Manifest file generation
- Package compression level options
- Dry-run mode to preview package contents
- Package validation (verify .skill file integrity)
- Multi-skill packaging (bundle multiple skills)
- Integration with skill registries

## Related Commands

- `asm scaffold` (FEAT-001) - Creates skill structure that can be packaged
- `asm validate` (FEAT-002) - Validates skill before packaging
- `asm install` (FEAT-004) - Installs .skill packages
- `asm delete` (FEAT-005) - Deletes .skill packages
- `asm publish` (future) - Publishes packages to registries
