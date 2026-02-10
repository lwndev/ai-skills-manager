# AI Skills Manager

[![npm version](https://img.shields.io/npm/v/ai-skills-manager.svg)](https://www.npmjs.com/package/ai-skills-manager)
[![npm downloads](https://img.shields.io/npm/dm/ai-skills-manager.svg)](https://www.npmjs.com/package/ai-skills-manager)
[![license](https://img.shields.io/npm/l/ai-skills-manager.svg)](https://github.com/lwndev/ai-skills-manager/blob/main/LICENSE)

AI Skills Manager (ASM) enables team members to create, test, distribute, install, update, and remove skills. It focuses on the [Claude Code Agent Skills](https://docs.claude.com/en/docs/claude-code/skills) system developed by Anthropic.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 20.19.6 (LTS) or later

### From NPM

#### Global Install

```bash
npm install -g ai-skills-manager
```

### As a Project Dependency

```bash
npm install ai-skills-manager
```

### From Source

```bash
# Clone the repository
git clone https://github.com/lwndev/ai-skills-manager.git
cd ai-skills-manager

# Install dependencies
npm install

# Build the project
npm run build

# Link the CLI globally (optional)
npm link
```

## Usage

### Create a New Skill

Use the `scaffold` command to create a new Claude Code skill:

```bash
# Create a basic skill in .claude/skills/ (project scope)
asm scaffold my-skill

# Create a skill with a description
asm scaffold my-skill --description "A helpful skill for code reviews"

# Create a personal skill in ~/.claude/skills/
asm scaffold my-skill --personal

# Create a skill in a custom location
asm scaffold my-skill --output ./custom/path

# Specify allowed tools
asm scaffold my-skill --allowed-tools "Read,Write,Bash"

# Overwrite existing directory without prompting
asm scaffold my-skill --force
```

#### Scaffold Options

| Option | Description |
|--------|-------------|
| `-d, --description <text>` | Short description of the skill |
| `-o, --output <path>` | Output directory path (overrides --project and --personal) |
| `-p, --project` | Create as a project skill in `.claude/skills/` (default) |
| `--personal` | Create as a personal skill in `~/.claude/skills/` |
| `-a, --allowed-tools <tools>` | Comma-separated list of allowed tools |
| `-f, --force` | Overwrite existing directory without prompting |
| `-t, --template <type>` | Template variant: `basic`, `forked`, `with-hooks`, `internal` |
| `--context <context>` | Set context in frontmatter (`fork`) |
| `--agent <name>` | Set agent field in frontmatter |
| `--no-user-invocable` | Set `user-invocable: false` in frontmatter |
| `--hooks` | Include commented hook examples in frontmatter |
| `--minimal` | Generate shorter templates without educational guidance |
| `--argument-hint <hint>` | Set argument hint for skill invocation (max 100 chars) |
| `--license <license>` | Set license (e.g., `MIT`, `Apache-2.0`) |
| `--compatibility <reqs>` | Set environment compatibility requirements (max 500 chars) |
| `--metadata <pairs...>` | Set metadata key=value pairs (e.g., `author=org version=1.0`) |

#### Skill Name Requirements

- Lowercase letters, numbers, and hyphens only
- Cannot start or end with a hyphen
- Cannot contain consecutive hyphens
- Maximum 64 characters
- Cannot use reserved words: "anthropic", "claude"

#### Generated Structure

```
my-skill/
  SKILL.md        # Skill instructions and metadata
  scripts/        # Directory for skill scripts
    .gitkeep
```

### Validate a Skill

Use the `validate` command to check that a skill conforms to the Claude Code specification:

```bash
# Validate a skill directory
asm validate ./my-skill

# Validate a project skill
asm validate .claude/skills/my-skill

# Validate using direct path to SKILL.md
asm validate ./my-skill/SKILL.md

# Quiet mode - show only pass/fail (for CI/CD)
asm validate ./my-skill --quiet

# JSON output (for programmatic use)
asm validate ./my-skill --json
```

#### Validate Options

| Option | Description |
|--------|-------------|
| `-q, --quiet` | Minimal output - show only pass/fail result |
| `-j, --json` | Output validation result as JSON |

#### Validation Checks

The validate command performs these checks in order:

1. **File existence** - Verifies SKILL.md exists at the specified path
2. **Frontmatter validity** - Checks YAML frontmatter structure and syntax
3. **Required fields** - Validates `name` and `description` are present and non-empty
4. **Allowed properties** - Ensures only permitted frontmatter keys are used
5. **Name format** - Validates hyphen-case format, max 64 characters
6. **Description format** - Validates no angle brackets, max 1024 characters
7. **Compatibility format** - Validates optional compatibility field (max 500 characters)
8. **Context format** - Validates optional context field (must be "fork" if present)
9. **Agent format** - Validates optional agent field (must be non-empty string if present)
10. **Hooks format** - Validates optional hooks object structure; unknown hook keys produce warnings
11. **User-invocable format** - Validates optional user-invocable field (must be boolean if present)
12. **Name matches directory** - Validates frontmatter name matches parent directory name

#### Exit Codes

- `0` - Skill is valid
- `1` - Skill is invalid or an error occurred

#### Output Examples

**Normal output (valid skill):**
```
Validating skill at: ./my-skill/SKILL.md
Skill name: my-skill

✓ File existence
✓ Frontmatter validity
✓ Required fields
✓ Allowed properties
✓ Name format
✓ Description format

✓ Skill is valid!
```

**Quiet output:**
```
PASS
```

**JSON output:**
```json
{
  "valid": true,
  "skillPath": "./my-skill/SKILL.md",
  "skillName": "my-skill",
  "checks": {
    "fileExists": { "passed": true },
    "frontmatterValid": { "passed": true },
    "requiredFields": { "passed": true },
    "allowedProperties": { "passed": true },
    "nameFormat": { "passed": true },
    "descriptionFormat": { "passed": true },
    "compatibilityFormat": { "passed": true },
    "contextFormat": { "passed": true },
    "agentFormat": { "passed": true },
    "hooksFormat": { "passed": true },
    "userInvocableFormat": { "passed": true },
    "nameMatchesDirectory": { "passed": true }
  },
  "errors": [],
  "warnings": []
}
```

### Package a Skill

Use the `package` command to create a distributable `.skill` package from a skill directory:

```bash
# Package a skill from the current project
asm package .claude/skills/my-skill

# Specify output directory
asm package ./my-skill --output ./dist

# Force overwrite existing package
asm package ./my-skill --force

# Skip validation (use with caution)
asm package ./my-skill --skip-validation

# Quiet mode for CI/CD
asm package ./my-skill --quiet
```

#### Package Options

| Option | Description |
|--------|-------------|
| `-o, --output <path>` | Output directory for the package file |
| `-f, --force` | Overwrite existing package without prompting |
| `-s, --skip-validation` | Skip pre-package validation |
| `-q, --quiet` | Quiet mode - minimal output |

#### Packaging Process

1. Validates the skill (unless `--skip-validation` is used)
2. Creates a ZIP archive with `.skill` extension
3. Includes all skill files (SKILL.md, scripts/, etc.)
4. Excludes common development artifacts (.git, node_modules, .DS_Store, etc.)

#### Exit Codes

- `0` - Package created successfully
- `1` - Skill validation failed
- `2` - File system error (path not found, permission denied)
- `3` - Package creation error

### Install a Skill

Use the `install` command to install a Claude Code skill from a `.skill` package file:

```bash
# Install to project scope (default: .claude/skills/)
asm install my-skill.skill

# Install to personal scope (~/.claude/skills/)
asm install my-skill.skill --scope personal

# Install to a custom directory
asm install my-skill.skill --scope ~/.claude/skills

# Force overwrite existing skill
asm install my-skill.skill --force

# Preview what would be installed (dry run)
asm install my-skill.skill --dry-run

# Quiet mode for CI/CD
asm install my-skill.skill --quiet
```

#### Install Options

| Option | Description |
|--------|-------------|
| `-s, --scope <scope>` | Installation scope: "project", "personal", or custom path |
| `-f, --force` | Overwrite existing skill without prompting |
| `-n, --dry-run` | Show what would be installed without making changes |
| `-q, --quiet` | Quiet mode - minimal output |
| `-t, --thorough` | Use content hashing for accurate file comparison (slower) |

#### Installation Scopes

| Scope | Directory | Description |
|-------|-----------|-------------|
| `project` (default) | `.claude/skills/` | Skills for current project only |
| `personal` | `~/.claude/skills/` | Skills available across all projects |
| Custom path | Any valid path | Install to a specific directory |

#### Installation Process

1. Validates the package file (exists, valid ZIP, correct structure)
2. Validates package contents (SKILL.md, metadata)
3. Checks for existing skill at target location
4. Prompts for confirmation if overwriting (unless `--force`)
5. Extracts files to target directory
6. Validates installed skill
7. Rolls back on validation failure

#### Security Note

Skills can execute code and access files. Only install packages from trusted sources. The SKILL.md file describes what the skill does - review it before using the skill.

#### Exit Codes

- `0` - Skill installed successfully
- `1` - Validation failed (package or post-installation)
- `2` - File system error (path not found, permission denied)
- `3` - Package extraction error
- `4` - User cancelled installation

### Update a Skill

Use the `update` command to update an installed skill to a newer version from a `.skill` package:

```bash
# Update a skill in project scope (default)
asm update my-skill ./my-skill-v2.skill

# Update a skill in personal scope
asm update my-skill ./my-skill-v2.skill --scope personal

# Preview update without making changes
asm update my-skill ./my-skill-v2.skill --dry-run

# Force update without confirmation
asm update my-skill ./my-skill-v2.skill --force

# Update without creating backup (not recommended)
asm update my-skill ./my-skill-v2.skill --no-backup

# Keep backup after successful update
asm update my-skill ./my-skill-v2.skill --keep-backup

# Quiet mode for CI/CD
asm update my-skill ./my-skill-v2.skill --quiet --force
```

#### Update Options

| Option | Description |
|--------|-------------|
| `-s, --scope <scope>` | Target scope: "project" or "personal" (default: project) |
| `-f, --force` | Skip confirmation prompt |
| `-n, --dry-run` | Preview update without making changes |
| `-q, --quiet` | Quiet mode - minimal output |
| `--no-backup` | Skip backup creation (not recommended) |
| `--keep-backup` | Keep backup after successful update |

#### Update Process

1. Validates the skill name and locates the installed skill
2. Validates the new `.skill` package (structure, contents, security)
3. Compares versions and shows diff summary (files added/removed/modified)
4. Creates a backup in `~/.asm/backups/` (unless `--no-backup`)
5. Prompts for confirmation (unless `--force`)
6. Replaces the installed skill with the new version atomically
7. Validates the updated skill
8. Removes backup on success (unless `--keep-backup`)
9. Rolls back automatically if any step fails

#### Backup and Restore

Backups are stored in `~/.asm/backups/` with the format `<skill-name>-<timestamp>-<random>.skill`. By default, backups are automatically deleted after a successful update. Use `--keep-backup` to preserve them.

To manually restore from a backup:

```bash
# Uninstall the current version
asm uninstall my-skill

# Reinstall from backup
asm install ~/.asm/backups/my-skill-20250103-143022-a1b2c3d4.skill
```

#### Rollback Behavior

If an update fails at any point, ASM automatically rolls back to the previous version:

- **Before extraction**: No changes made, backup deleted
- **During extraction**: Partial extraction removed, original restored
- **After validation failure**: New version removed, original restored

If rollback also fails (exit code 7), the backup file is preserved for manual recovery.

#### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Skill updated successfully |
| 1 | Skill not found |
| 2 | File system error (permission denied, disk full, etc.) |
| 3 | User cancelled update |
| 4 | Invalid new package |
| 5 | Security error (path traversal, invalid name, etc.) |
| 6 | Rollback performed (update failed but rollback succeeded) |
| 7 | Rollback failed (critical error - check backup) |

#### Output Examples

**Normal output:**
```
Updating skill 'my-skill' in .claude/skills/

Current version:
  Name: my-skill
  Files: 3 (2.1 KB)

New version:
  Package: ./my-skill-v2.skill
  Files: 4 (2.8 KB)

Changes:
  + scripts/new-helper.sh (added)
  ~ SKILL.md (modified, +200 bytes)

Backup created: ~/.asm/backups/my-skill-20250103-143022-a1b2c3d4.skill

Proceed with update? [y/N] y

Updating skill...
✓ Skill 'my-skill' updated successfully
  Added: 1 file
  Modified: 1 file
  Backup removed
```

**Dry run output:**
```
[DRY RUN] Would update skill 'my-skill' in .claude/skills/

Current version:
  Name: my-skill
  Files: 3 (2.1 KB)

New version:
  Package: ./my-skill-v2.skill
  Files: 4 (2.8 KB)

Changes:
  + scripts/new-helper.sh (added)
  ~ SKILL.md (modified, +200 bytes)

Backup would be created: ~/.asm/backups/my-skill-<timestamp>.skill

No changes were made.
```

**Quiet output:**
```
✓ my-skill updated in project (4 files, 2.8 KB)
```

### Uninstall a Skill

Use the `uninstall` command to remove installed Claude Code skills:

```bash
# Uninstall from project scope (default: .claude/skills/)
asm uninstall my-skill

# Uninstall from personal scope (~/.claude/skills/)
asm uninstall my-skill --scope personal

# Force uninstall without confirmation
asm uninstall my-skill --force

# Preview what would be removed (dry run)
asm uninstall my-skill --dry-run

# Uninstall multiple skills
asm uninstall skill1 skill2 skill3

# Quiet mode for CI/CD
asm uninstall my-skill --quiet --force
```

#### Uninstall Options

| Option | Description |
|--------|-------------|
| `-s, --scope <scope>` | Skill location: "project" or "personal" (default: project) |
| `-f, --force` | Remove without confirmation prompt |
| `-n, --dry-run` | Preview what would be removed without making changes |
| `-q, --quiet` | Quiet mode - minimal output |

#### Security Restrictions

For safety, the uninstall command only supports the two official Claude Code skill locations:

| Scope | Directory | Description |
|-------|-----------|-------------|
| `project` | `.claude/skills/` | Skills for current project only |
| `personal` | `~/.claude/skills/` | Skills available across all projects |

Custom paths are not allowed for uninstall operations to prevent accidental deletion of important files.

#### Skill Name Validation

Skill names are validated to prevent path traversal attacks:

- Contain only lowercase letters, numbers, and hyphens
- Cannot start or end with a hyphen
- Cannot contain consecutive hyphens
- No path separators (`/` or `\`)
- 1-64 characters long

Note: Unlike the `scaffold` command, `uninstall` does not block reserved words ("anthropic", "claude") to allow uninstalling skills created before that restriction was added.

#### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Skill(s) uninstalled successfully |
| 1 | Skill not found |
| 2 | File system error (permission denied, etc.) |
| 3 | User cancelled uninstallation |
| 4 | Partial failure (some skills removed, some failed) |
| 5 | Security error (invalid name, symlink escape, etc.) |

#### Bulk Uninstall Safety

When uninstalling 3 or more skills with `--force`, you will be prompted to type "yes" to confirm. This is an additional safety measure for bulk operations.

#### Output Examples

**Normal output (single skill):**
```
Locating skill 'my-skill' in .claude/skills/...
Found: .claude/skills/my-skill

Files to be removed:
  SKILL.md (1.2 KB)
  scripts/helper.sh (500 B)

Total: 2 files, 1.7 KB

This action cannot be undone.
Proceed with uninstall? [y/N] y

Removing files...
  ✓ scripts/helper.sh
  ✓ SKILL.md
  ✓ scripts/
  ✓ my-skill/

✓ Successfully uninstalled 'my-skill'
  Removed: 4 items (1.7 KB)
```

**Quiet output:**
```
✓ my-skill uninstalled from project (4 files, 1.7 KB)
```

**Dry run output:**
```
[DRY RUN] Would remove skill 'my-skill' from .claude/skills/

Files that would be removed:
  SKILL.md (1.2 KB)
  scripts/helper.sh (500 B)

Total: 2 files, 1.7 KB

No changes were made.
```

## Programmatic API

AI Skills Manager can be used programmatically in Node.js applications. All CLI functionality is available as importable functions.

### Installation

```bash
npm install ai-skills-manager
```

### Quick Example

```typescript
import {
  scaffold,
  validate,
  createPackage,
  install,
  update,
  uninstall,
  list,
} from 'ai-skills-manager';

// Create a new skill
const result = await scaffold({
  name: 'my-skill',
  description: 'A helpful skill',
  scope: 'project',
});
console.log(`Created skill at: ${result.path}`);

// Validate the skill
const validation = await validate(result.path);
if (validation.valid) {
  console.log('Skill is valid!');
}
```

### API Functions

#### scaffold(options)

Creates a new skill directory with the standard structure.

```typescript
const result = await scaffold({
  name: 'my-skill',           // Required: skill name
  description: 'Description', // Optional: skill description
  scope: 'project',           // Optional: 'project' | 'personal'
  output: './custom/path',    // Optional: custom output directory
  allowedTools: ['Bash'],     // Optional: allowed tools list
  force: false,               // Optional: overwrite existing
});

// Result: { path: string, files: string[] }
```

#### validate(path)

Validates a skill at the specified path. Returns a result object (never throws for validation failures).

```typescript
const result = await validate('./my-skill');

if (result.valid) {
  console.log('Valid!');
} else {
  for (const error of result.errors) {
    console.error(`[${error.code}] ${error.message}`);
  }
}

// Also check warnings
for (const warning of result.warnings) {
  console.warn(`[${warning.code}] ${warning.message}`);
}
```

#### createPackage(options)

Creates a `.skill` package file from a skill directory.

```typescript
const result = await createPackage({
  path: './my-skill',       // Required: skill directory path
  output: './dist',         // Optional: output directory
  skipValidation: false,    // Optional: skip validation
  force: false,             // Optional: overwrite existing
  signal: controller.signal // Optional: AbortSignal for cancellation
});

// Result: { packagePath: string, size: number, fileCount: number }
```

#### install(options)

Installs a skill from a `.skill` package file.

```typescript
const result = await install({
  file: './my-skill.skill', // Required: package file path
  scope: 'project',         // Optional: 'project' | 'personal'
  targetPath: '/custom',    // Optional: custom install path
  force: false,             // Optional: overwrite existing
  dryRun: false,            // Optional: preview only
  signal: controller.signal // Optional: AbortSignal for cancellation
});

// Result: { installedPath: string, skillName: string, version?: string, dryRun: boolean }
```

#### update(options)

Updates an installed skill from a new `.skill` package.

```typescript
const result = await update({
  name: 'my-skill',              // Required: installed skill name
  file: './my-skill-v2.skill',   // Required: new package file
  scope: 'project',              // Optional: 'project' | 'personal'
  force: false,                  // Optional: skip confirmation
  dryRun: false,                 // Optional: preview only
  keepBackup: false,             // Optional: keep backup after success
  signal: controller.signal      // Optional: AbortSignal for cancellation
});

// Result: { updatedPath: string, previousVersion?: string, newVersion?: string, backupPath?: string, dryRun: boolean }
```

#### uninstall(options)

Uninstalls one or more skills.

```typescript
const result = await uninstall({
  names: ['skill-a', 'skill-b'], // Required: skill names to remove
  scope: 'project',              // Optional: 'project' | 'personal'
  force: true,                   // Required for programmatic use
  dryRun: false,                 // Optional: preview only
  signal: controller.signal      // Optional: AbortSignal for cancellation
});

// Result: { removed: string[], notFound: string[], dryRun: boolean }
```

#### list(options)

Lists installed skills.

```typescript
// List all skills
const allSkills = await list();

// List only project skills
const projectSkills = await list({ scope: 'project' });

// List only personal skills
const personalSkills = await list({ scope: 'personal' });

// List skills in custom directory
const customSkills = await list({ targetPath: '/custom/path' });

// Result: InstalledSkill[]
// Each skill: { name: string, path: string, scope: string, version?: string, description?: string }
```

### Error Handling

All API functions throw typed errors that can be caught with `instanceof`:

```typescript
import {
  install,
  AsmError,
  ValidationError,
  FileSystemError,
  PackageError,
  SecurityError,
  CancellationError,
} from 'ai-skills-manager';

try {
  await install({ file: 'skill.skill' });
} catch (e) {
  if (e instanceof ValidationError) {
    // Validation failed - check e.issues for details
    for (const issue of e.issues) {
      console.error(`[${issue.code}] ${issue.message}`);
    }
  } else if (e instanceof FileSystemError) {
    // Filesystem error - check e.path for location
    console.error(`File error at ${e.path}: ${e.message}`);
  } else if (e instanceof PackageError) {
    // Invalid or corrupted package
    console.error('Package error:', e.message);
  } else if (e instanceof SecurityError) {
    // Security violation (path traversal, invalid name)
    console.error('Security error:', e.message);
  } else if (e instanceof CancellationError) {
    // Operation was cancelled via AbortSignal
    console.log('Operation cancelled');
  } else if (e instanceof AsmError) {
    // Catch-all for any ASM error
    console.error(`ASM Error [${e.code}]: ${e.message}`);
  }
}
```

### Cancellation with AbortSignal

Long-running operations support cancellation via `AbortSignal`:

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  await install({
    file: 'large-skill.skill',
    signal: controller.signal
  });
} catch (e) {
  if (e instanceof CancellationError) {
    console.log('Installation was cancelled');
  }
}
```

### TypeScript Support

All types are exported for TypeScript users:

```typescript
import type {
  // Options types
  ScaffoldOptions,
  CreatePackageOptions,
  InstallOptions,
  UpdateOptions,
  UninstallOptions,
  ListOptions,

  // Result types
  ScaffoldResult,
  ValidateResult,
  CreatePackageResult,
  InstallResult,
  UpdateResult,
  UninstallResult,
  InstalledSkill,

  // Common types
  ApiScope,
  ValidationIssue,
  ValidationWarning,
} from 'ai-skills-manager';
```

## Development

### Commands

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Run all quality checks
npm run quality
```

### Project Structure

```
src/
  cli.ts              # CLI entry point
  index.ts            # Main library entry point
  commands/           # Command implementations (scaffold, validate, package, install)
  formatters/         # Output formatting for commands
  generators/         # File/directory generation and business logic
  templates/          # Template generation
  types/              # TypeScript type definitions
  utils/              # Shared utilities
  validators/         # Input validation

tests/
  unit/               # Unit tests (mirrors src/ structure)
    edge-cases/       # Edge case tests
    formatters/
    generators/
    templates/
    utils/
    validators/
  integration/        # End-to-end tests
  security/           # Security-focused tests
  fixtures/           # Test fixtures and sample skills
```

## Contributing

Contributions are welcome! Please ensure:

1. Tests pass: `npm test`
2. Code is linted: `npm run lint`
3. Coverage is maintained above 80%

## FAQs

**Q: Where are project skills stored?**
A: In `.claude/skills/` within your project directory.

**Q: Where are personal skills stored?**
A: In `~/.claude/skills/` in your home directory.

**Q: What's the difference between project and personal scopes?**
A: Project skills (`.claude/skills/`) are specific to one project and typically checked into version control. Personal skills (`~/.claude/skills/`) are available across all your projects.

**Q: What is a .skill package?**
A: A `.skill` file is a ZIP archive containing the skill directory structure (SKILL.md, scripts/, etc.). It's the distribution format for sharing skills.

**Q: Can I share skills with my team?**
A: Yes. Use `asm package ./my-skill` to create a `.skill` file, then share it with your team. Recipients use `asm install my-skill.skill` to install it.

**Q: How do I see what skills are installed?**
A: List the contents of `.claude/skills/` (project scope) or `~/.claude/skills/` (personal scope). Each subdirectory is an installed skill.

**Q: What happens if I install a skill that already exists?**
A: ASM will prompt for confirmation before overwriting. Use `--force` to skip the prompt, or `--dry-run` to preview what would be installed without making changes.

**Q: How do I update a skill to a newer version?**
A: Use `asm update <skill-name> <new-package.skill>`. This safely replaces the installed skill with automatic backup and rollback capabilities.

**Q: Where are skill backups stored?**
A: Backups are stored in `~/.asm/backups/`. By default, they're removed after a successful update. Use `--keep-backup` to preserve them.

**Q: What happens if an update fails?**
A: ASM automatically rolls back to the previous version. The backup file is preserved for manual recovery if the rollback also fails.

**Q: How do I test my skill?**
A: After creating a skill, invoke it in Claude Code by name. Claude will discover skills in the standard locations.

## Troubleshooting

**Error: Invalid skill name**
Ensure your skill name uses only lowercase letters, numbers, and hyphens. It cannot start or end with a hyphen.

**Error: Directory already exists**
Use the `--force` flag to overwrite, or choose a different name.

**Error: SKILL.md not found**
Make sure the path points to a skill directory containing a SKILL.md file, or directly to the SKILL.md file itself.

**Error: Missing YAML frontmatter**
Ensure your SKILL.md file starts with `---` followed by YAML content and ends with another `---` on its own line.

**Error: Unknown frontmatter property**
Only these top-level keys are allowed in frontmatter: `name`, `description`, `license`, `compatibility`, `allowed-tools`, `metadata`, `context`, `agent`, `hooks`, `user-invocable`, `argument-hint`. Remove any other keys.

**Command not found: asm**
Run `npm link` after building, or use `node dist/cli.js` directly.

**Error: Invalid package file**
The file must be a valid `.skill` package created by `asm package`. Ensure the file hasn't been corrupted during transfer.

**Error: Package extraction failed**
Check that the `.skill` file is not corrupted and you have write permissions to the target directory.

**Error: Installation validation failed**
The skill was extracted but failed post-installation validation. ASM automatically rolls back the installation. Check the error message for specific validation failures.

**Error: Permission denied**
Ensure you have write permissions to the target directory. For personal skills, check permissions on `~/.claude/skills/`.

**Error: Description too long**
Skill descriptions must be 1024 characters or less. Shorten your description in SKILL.md.

**Error: Name contains reserved word**
Skill names cannot contain "anthropic" or "claude". Choose a different name.

**Error: Skill not found**
The specified skill does not exist in the target scope. Check the skill name and use `--scope personal` if the skill is in your personal directory.

**Error: Skill is currently being uninstalled**
Another uninstall operation is in progress for this skill. Wait for it to complete or check if a stale lock file exists.

**Error: Security error - symlink escape**
The skill directory or its contents contain symlinks pointing outside the allowed scope. This is blocked for security. Review the skill directory contents and remove any symlinks pointing to external locations.

**Error: SKILL.md not found (use --force)**
The directory exists but doesn't contain a SKILL.md file, suggesting it may not be a valid skill. Use `--force` if you're sure you want to remove it.

**Error: Hard links detected (use --force)**
Files in the skill directory have hard links to other locations. Deleting them will leave the data accessible elsewhere. Use `--force` if this is acceptable.

**Error: Update failed - rolled back to previous version**
The update encountered an error after backup was created. ASM automatically restored the previous version. Check the specific error message for details on what failed.

**Error: Rollback failed - skill may be in inconsistent state**
Both the update and the automatic rollback failed. Your skill may be in an inconsistent state. The backup file has been preserved for manual recovery. Use `asm install <backup-path>` to restore from the backup.

**Error: Package skill name mismatch**
The skill name in the new package does not match the installed skill. You cannot update a skill with a package containing a different skill. Use `asm uninstall` and `asm install` instead.

**Error: Cannot create backup directory**
ASM could not create the backup directory at `~/.asm/backups/`. Check permissions on your home directory. Use `--no-backup` to skip backup creation (not recommended).

**Error: Skill is currently being updated**
Another update operation is in progress for this skill. Wait for it to complete or check if a stale lock file exists.

### Debug Mode

For troubleshooting, you can enable debug logging by setting the `ASM_DEBUG` environment variable:

```bash
# Enable debug output
ASM_DEBUG=1 asm install my-skill.skill

# Alternative: use DEBUG variable
DEBUG=asm asm install my-skill.skill
```

Debug mode shows detailed information about internal operations, which can help diagnose issues with package installation, validation, or extraction.

## License

MIT
