# Feature Requirements: Scaffold Skill Command

## Overview

Enable users to quickly scaffold a new Claude Code skill with the required directory structure and SKILL.md file.

## Feature ID
`FEAT-001`

## Priority
High - Core scaffolding feature

## User Story

As a skill developer, I want to scaffold a new skill project with the proper structure so that I can quickly start developing without manually creating directories and files.

## Command Syntax

```bash
asm scaffold <skill-name> [options]
```

### Arguments

- `<skill-name>` (required) - Name of the skill to create (lowercase letters, numbers, and hyphens only)

### Options

- `--description <text>` - Short description of what the skill does and when to use it
- `--output <path>` - Output directory (default: current directory)
- `--project` - Create in `.claude/skills/` for project-level skill (default)
- `--personal` - Create in `~/.claude/skills/` for personal skill
- `--allowed-tools <tools>` - Comma-separated list of allowed tools (optional restriction)

### Examples

```bash
# Basic scaffold (creates in current directory)
asm scaffold reviewing-code

# Scaffold with description
asm scaffold reviewing-code --description "Reviews code for best practices and potential issues. Use when reviewing code, checking PRs, or analyzing code quality."

# Scaffold as personal skill
asm scaffold generating-commit-messages --personal

# Scaffold as project skill (in .claude/skills/)
asm scaffold processing-pdfs --project

# Scaffold with tool restrictions
asm scaffold safe-file-reader --allowed-tools "Read, Grep, Glob"
```

## Functional Requirements

### FR-1: Directory Structure Creation
Create the following minimal structure:
```
<skill-name>/
├── SKILL.md              # Required - Skill metadata and instructions
└── scripts/              # Optional - Utility scripts directory
    └── .gitkeep
```

Users add reference files as needed. Common patterns (per official best practices):
- Single file: `reference.md`, `FORMS.md`, `examples.md`
- Directory: `reference/finance.md`, `reference/sales.md`
- Domain-specific: Name files descriptively based on content

### FR-2: SKILL.md Generation
Generate SKILL.md with proper YAML frontmatter and markdown body:

```markdown
---
name: <skill-name>
description: [TODO: Describe what this skill does AND when Claude should use it. This is the primary trigger for skill discovery. Example: "Analyzes Excel spreadsheets and generates reports. Use when working with .xlsx files, spreadsheets, or tabular data analysis."]
---

# <Skill Title>

<!-- Keep this file under 500 lines. For detailed content, use separate reference files. -->

## Overview

[TODO: 1-2 sentences explaining what this skill enables]

## Instructions

[TODO: Provide clear, step-by-step guidance for Claude. Choose a structure that fits:
- Workflow-based: Sequential processes with clear steps
- Task-based: Different operations/capabilities
- Reference: Standards or specifications
- Capabilities-based: Multiple interrelated features]

## Examples

[TODO: Show concrete input/output examples of using this skill]

## Resources

<!--
Progressive Disclosure: This SKILL.md serves as an overview that points Claude
to detailed materials as needed. Keep references one level deep from SKILL.md.
-->

Add reference files as needed (Claude loads them only when relevant):
- `reference.md` - Detailed documentation
- `examples.md` - Usage examples and patterns
- `scripts/` - Utility scripts (executed directly, not loaded into context)

For skill development guidance, see:
https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
```

**Frontmatter requirements:**
- `name` (required): Lowercase letters, numbers, and hyphens only; max 64 characters
- `description` (required): What the skill does AND when to use it; max 1024 characters. This is the **primary triggering mechanism** for skill discovery.
- `allowed-tools` (optional): Comma-separated list of permitted tools

### FR-3: Name Validation
- Enforce lowercase letters, numbers, and hyphens only (regex: `^[a-z0-9-]+$`)
- Reject names with spaces, underscores, uppercase, or special characters
- Cannot start or end with a hyphen
- Cannot contain consecutive hyphens (`--`)
- Reject reserved words: "anthropic", "claude" (per official Anthropic specification)
- Maximum length of 64 characters
- Recommend gerund form naming (e.g., `reviewing-code`, `processing-pdfs`, `generating-reports`)

**Valid examples:** `reviewing-code`, `pdf-processor`, `my-skill-v2`
**Invalid examples:** `-starts-with-hyphen`, `ends-with-hyphen-`, `has--double-hyphens`, `Claude-helper`

### FR-4: Description Validation
- Must be non-empty
- Maximum 1024 characters
- Cannot contain angle brackets (`<` or `>`)
- **Must describe both what the skill does AND when to use it** - this is critical for skill discovery
- Must be written in third person (e.g., "Processes files..." not "I can..." or "You can...")
- Should include specific trigger terms users would mention (e.g., file types, actions, contexts)
- "When to use" information belongs in the description, NOT in the SKILL.md body

**Good example:**
```
Analyzes Excel spreadsheets, creates pivot tables, and generates charts. Use when working with Excel files, spreadsheets, or analyzing tabular data in .xlsx format.
```

**Bad example:**
```
Helps with documents
```

### FR-5: Existing Directory Handling
- Check if target directory already exists
- Prompt user for confirmation before overwriting
- Use `--force` flag to skip confirmation

### FR-6: Success Output
- Display created file structure
- Show next steps for skill development
- Provide link to skill documentation

### FR-7: Frontmatter Validation
Only the following top-level keys are allowed in SKILL.md frontmatter:
- `name` (required)
- `description` (required)
- `license` (optional)
- `allowed-tools` (optional)
- `metadata` (optional) - Can contain nested keys

Reject any frontmatter with unexpected top-level keys. This ensures compatibility with Claude's skill parser.

## Output Format

```
Creating skill: reviewing-code

✓ Created reviewing-code/
✓ Created reviewing-code/SKILL.md
✓ Created reviewing-code/scripts/

Skill scaffolded successfully!

Next steps:
  1. Edit SKILL.md to complete the TODO placeholders
  2. Ensure your description specifies WHEN Claude should use this skill
  3. Add reference files or scripts as needed
  4. Keep SKILL.md under 500 lines; use separate files for detailed content
  5. Test by asking Claude a question that matches your description

Documentation: https://code.claude.com/docs/en/skills
Best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
```

## Non-Functional Requirements

### NFR-1: Performance
- Scaffold operation should complete within 1 second
- No network requests required for basic scaffolding

### NFR-2: Error Handling
- Invalid name: Display clear error with naming rules and examples
- Permission denied: Show helpful message about directory permissions
- Existing directory: Prompt for confirmation or show error with `--force` suggestion
- Invalid description: Show requirements for effective descriptions

### NFR-3: File System Safety
- Never overwrite existing files without explicit confirmation
- Create parent directories as needed
- Use atomic operations where possible

### NFR-4: Output Quality
- Generated files should be properly formatted
- YAML frontmatter must use spaces (not tabs) for indentation
- File encoding should be UTF-8
- Use forward slashes in all file paths

## Best Practices Reference

The generated SKILL.md should guide users toward these official best practices:

### Concise is Key
- The context window is a shared resource; every token competes with conversation history
- **Default assumption**: Claude is already very smart—only add context it doesn't have
- Challenge each piece of information: "Does Claude really need this explanation?"
- Keep SKILL.md body under 500 lines for optimal performance

### Progressive Disclosure
- SKILL.md serves as an overview pointing to detailed materials as needed (like a table of contents)
- Use separate reference files for detailed documentation
- **Keep references one level deep** from SKILL.md to ensure Claude reads complete files
- Claude loads additional files only when needed, saving context tokens
- For reference files over 100 lines, include a table of contents at the top

### Set Appropriate Degrees of Freedom
- **High freedom** (text instructions): When multiple approaches are valid
- **Medium freedom** (pseudocode/templates): When a preferred pattern exists
- **Low freedom** (specific scripts): When operations are fragile or consistency is critical

### Effective Descriptions
- The description is the **primary triggering mechanism** for skill discovery
- Include both what the skill does AND when to use it
- Use specific trigger terms (file types, actions, contexts)
- Write in third person ("Processes files..." not "I can...")

### Scripts and Execution
- Utility scripts are **executed, not loaded into context** (saves tokens)
- Prefer pre-made scripts over asking Claude to generate code (more reliable)
- Make clear whether Claude should execute a script or read it as reference

### Testing
- Test skills with all Claude models you plan to use (Haiku, Sonnet, Opus)
- What works for Opus might need more detail for Haiku
- Build evaluations before writing extensive documentation

### Anti-Patterns to Avoid
- Windows-style paths (use forward slashes: `scripts/helper.py`)
- Offering too many options without a clear default
- Time-sensitive information (use "old patterns" sections instead)
- Deeply nested file references

For complete guidance, see: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

## Dependencies

- Node.js fs module for file operations
- Commander.js for CLI argument parsing

## Reference Implementation

This command is implemented in TypeScript, with validation rules and templates derived from Anthropic's official skill-creator toolset:

**Source references:**
- Validation rules: https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/quick_validate.py
- Template structure: https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/init_skill.py
- Best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

**ASM value-add features (not in Anthropic's scripts):**
- `--project` / `--personal` path convenience options
- `--description` flag to pre-fill frontmatter
- `--allowed-tools` flag to pre-fill frontmatter
- `--force` flag for overwrite handling
- Interactive prompts for existing directories

**Related ASM commands:**
- `asm validate` - Validates skill structure (based on `quick_validate.py`)
- `asm package` - Packages skill for distribution (based on `package_skill.py`)

## Edge Cases

1. **Empty skill name**: Display error and usage help
2. **Name with invalid characters**: Display error with valid naming rules and examples
3. **Name starts/ends with hyphen**: Display error with valid examples
4. **Name has consecutive hyphens**: Display error with valid examples
5. **Reserved word used**: Display error listing reserved words ("anthropic", "claude")
6. **Description too long**: Reject with message showing character count
7. **Description contains angle brackets**: Display error explaining the restriction
8. **Insufficient permissions**: Display clear error message
9. **Disk full**: Handle gracefully with appropriate error
10. **Interrupted operation**: Clean up partial files if possible

## Testing Requirements

### Unit Tests
- Name validation logic:
  - Valid names (lowercase, numbers, hyphens)
  - Invalid characters (uppercase, underscores, spaces, special chars)
  - Start/end hyphen rejection
  - Consecutive hyphen rejection
  - Reserved words "anthropic"/"claude"
  - Maximum length (64 chars)
- Description validation logic:
  - Non-empty check
  - Maximum length (1024 chars)
  - Angle bracket rejection
- Frontmatter validation logic:
  - Required keys (name, description)
  - Allowed keys (license, allowed-tools, metadata)
  - Rejection of unexpected keys
- Path generation logic for personal vs project skills
- YAML frontmatter generation

### Integration Tests
- Full scaffold workflow
- Option combinations
- Error handling scenarios
- Personal vs project skill creation

### Manual Testing
- Scaffold in various directories
- Test with different name formats
- Verify generated SKILL.md has valid YAML frontmatter
- Verify Claude discovers and uses scaffolded skill

## Future Enhancements

- Interactive mode with prompts for all options
- Template selection (basic, with-scripts, with-references)
- Validate description quality (check for "when to use" trigger terms)
- Import existing skill from URL or registry

## Acceptance Criteria

- [ ] Command accepts skill name and all specified options
- [ ] Directory structure is created correctly (SKILL.md + scripts/.gitkeep)
- [ ] Generated SKILL.md has valid YAML frontmatter with name and description
- [ ] Generated SKILL.md includes TODO placeholders and 500-line guidance
- [ ] Generated SKILL.md emphasizes "when to use" in description
- [ ] Name validation enforces lowercase, hyphens, numbers only (max 64 chars)
- [ ] Name validation rejects start/end hyphens and consecutive hyphens
- [ ] Reserved words ("anthropic", "claude") are rejected
- [ ] Description validation rejects angle brackets
- [ ] Frontmatter validation rejects unexpected top-level keys
- [ ] Personal skills created in `~/.claude/skills/`
- [ ] Project skills created in `.claude/skills/`
- [ ] Success message includes links to documentation and best practices
- [ ] Error handling covers all specified cases
- [ ] Help text is clear and accurate
- [ ] Tests pass with >80% coverage
- [ ] Documentation updated
