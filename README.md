# AI Skills Manager

AI Skills Manager (ASM) enables team members to create, test, distribute, install, update, and remove skills. It focuses on the [Claude Code Agent Skills](https://docs.claude.com/en/docs/claude-code/skills) system developed by Anthropic.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
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

### Install a Skill

*Coming soon*

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

**Command not found: asm**
Run `npm link` after building, or use `node dist/cli.js` directly.

## License

MIT
