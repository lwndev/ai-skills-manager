# AI Skills Manager

AI Skills Manager (ASM) enables team members to create, test, distribute, install, update, and remove skills. It focuses on the [Claude Code Agent Skills](https://docs.claude.com/en/docs/claude-code/skills) system developed by Anthropic.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 20.19.6 or later (LTS recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)

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
    "descriptionFormat": { "passed": true }
  },
  "errors": []
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

*Coming soon*

### Remove a Skill

*Coming soon*

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
  commands/           # Command implementations
  generators/         # File/directory generation
  templates/          # Template generation
  validators/         # Input validation
  utils/              # Shared utilities

tests/
  unit/               # Unit tests (mirrors src/ structure)
    generators/
    templates/
    utils/
    validators/
  integration/        # End-to-end tests
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
Only these top-level keys are allowed in frontmatter: `name`, `description`, `license`, `allowed-tools`, `metadata`. Remove any other keys.

**Command not found: asm**
Run `npm link` after building, or use `node dist/cli.js` directly.

## License

MIT
