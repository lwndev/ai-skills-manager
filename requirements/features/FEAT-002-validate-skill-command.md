# Feature Requirements: Validate Skill Command

## Overview

Enable users to validate that a Claude Skill's structure and metadata conform to the official specification, catching errors before deployment.

## Feature ID
`FEAT-002`

## GitHub Issue
[#2](https://github.com/lwndev/ai-skills-manager/issues/2)

## Priority
High - Essential for skill development workflow and quality assurance

## User Story

As a skill developer, I want to validate my skill against the specification so that I can catch structural and metadata errors before deploying or distributing the skill.

## Command Syntax

```bash
asm validate <skill-path> [options]
```

### Arguments

- `<skill-path>` (required) - Path to the skill directory containing SKILL.md

### Options

- `--quiet` - Suppress detailed output, only show pass/fail
- `--json` - Output results in JSON format for programmatic use

### Examples

```bash
# Validate a skill in the current directory
asm validate .

# Validate a specific skill directory
asm validate ./my-skill

# Validate a project skill
asm validate .claude/skills/reviewing-code

# Validate with quiet output (for CI/CD)
asm validate ./my-skill --quiet

# Validate with JSON output
asm validate ./my-skill --json
```

## Functional Requirements

### FR-1: File Existence Validation
- Verify that `SKILL.md` exists in the specified skill directory
- If skill-path points to a file instead of directory, check if it's SKILL.md and use parent directory
- Return clear error if SKILL.md is not found

### FR-2: Frontmatter Structure Validation
- Verify file starts with YAML frontmatter delimiter (`---`)
- Validate frontmatter format: `---\n(content)\n---`
- Parse frontmatter as YAML and verify it produces a valid object
- Return clear error if frontmatter is malformed or missing

### FR-3: Required Fields Validation
- `name` (required) - Must be present and non-empty
- `description` (required) - Must be present and non-empty
- Return specific error messages for each missing required field

### FR-4: Allowed Properties Validation
Only these top-level keys are permitted in frontmatter:
- `name`
- `description`
- `license`
- `allowed-tools`
- `metadata` (can contain nested keys)

Reject any frontmatter with unexpected top-level keys to ensure compatibility with Claude's skill parser.

### FR-5: Name Validation
- Must be a string
- Must follow hyphen-case convention: lowercase letters, digits, and hyphens only
- Pattern: `^[a-z0-9]+(-[a-z0-9]+)*$`
- Cannot start or end with a hyphen
- Cannot contain consecutive hyphens (`--`)
- Maximum length: 64 characters

**Valid examples:** `reviewing-code`, `pdf-processor`, `my-skill-v2`
**Invalid examples:** `-starts-with-hyphen`, `ends-with-hyphen-`, `has--double-hyphens`, `UPPERCASE`, `has_underscores`

### FR-6: Description Validation
- Must be a string
- Cannot contain angle brackets (`<` or `>`)
- Maximum length: 1024 characters

### FR-7: Exit Codes
- `0` - Skill is valid
- `1` - Skill is invalid (validation errors found)

## Output Format

### Success Output
```
Validating skill: my-skill

Checks:
  ✓ SKILL.md exists
  ✓ Valid YAML frontmatter
  ✓ Required fields present
  ✓ No unknown properties
  ✓ Name format valid
  ✓ Description format valid

Skill is valid!
```

### Error Output
```
Validating skill: my-skill

Checks:
  ✓ SKILL.md exists
  ✓ Valid YAML frontmatter
  ✓ Required fields present
  ✗ Name format invalid

Error: Name 'My_Skill' should be hyphen-case (lowercase letters, digits, and hyphens only).
       Example: 'my-skill', 'code-reviewer', 'pdf-processor-v2'

Skill validation failed.
```

### JSON Output (--json flag)
```json
{
  "valid": false,
  "skillPath": "./my-skill",
  "checks": {
    "fileExists": { "passed": true },
    "frontmatterValid": { "passed": true },
    "requiredFields": { "passed": true },
    "allowedProperties": { "passed": true },
    "nameFormat": { "passed": false, "error": "Name 'My_Skill' should be hyphen-case" },
    "descriptionFormat": { "passed": true }
  },
  "errors": [
    "Name 'My_Skill' should be hyphen-case (lowercase letters, digits, and hyphens only)"
  ]
}
```

### Quiet Output (--quiet flag)
```
✗ my-skill: invalid
```
or
```
✓ my-skill: valid
```

## Non-Functional Requirements

### NFR-1: Performance
- Validation should complete within 100ms for a typical skill
- No network requests required

### NFR-2: Error Handling
- Directory not found: "Error: Directory '<path>' does not exist"
- SKILL.md not found: "Error: SKILL.md not found in '<path>'"
- Invalid YAML: "Error: Invalid YAML frontmatter - <parse error details>"
- Permission denied: "Error: Cannot read '<path>' - permission denied"

### NFR-3: Error Message Quality
- All error messages should be actionable
- Include the invalid value in the error message
- Provide examples of valid values where applicable
- Reference documentation when helpful

## Dependencies

- Node.js fs module for file operations
- YAML parser (js-yaml or similar) for frontmatter parsing
- Commander.js for CLI argument parsing

## Reference Implementation

This command is a TypeScript native implementation of Anthropic's validation script:
- **Source**: https://github.com/anthropics/skills/blob/main/skills/skill-creator/scripts/quick_validate.py

**ASM value-add features (not in Anthropic's script):**
- `--json` flag for programmatic/CI use
- `--quiet` flag for minimal output
- Detailed check-by-check output showing validation progress
- Actionable error messages with examples

## Edge Cases

1. **Empty path argument**: Display error and usage help
2. **Path is a file, not directory**: If file is SKILL.md, use parent directory; otherwise error
3. **SKILL.md is empty**: Error "SKILL.md is empty"
4. **SKILL.md has no frontmatter**: Error "Missing YAML frontmatter"
5. **Frontmatter has no closing delimiter**: Error "Unclosed YAML frontmatter"
6. **Invalid YAML syntax**: Error with YAML parse error details
7. **Name is empty string**: Error "Name cannot be empty"
8. **Description is empty string**: Error "Description cannot be empty"
9. **Name exceeds 64 characters**: Error with character count
10. **Description exceeds 1024 characters**: Error with character count
11. **Multiple validation errors**: Report all errors, not just the first one
12. **Non-UTF8 encoding**: Handle gracefully or report encoding error

## Testing Requirements

### Unit Tests
- File existence check
- YAML frontmatter parsing:
  - Valid frontmatter
  - Missing opening delimiter
  - Missing closing delimiter
  - Invalid YAML syntax
  - Empty frontmatter
- Required fields validation:
  - Missing name
  - Missing description
  - Both missing
- Allowed properties validation:
  - All valid keys
  - Unknown top-level key
  - Nested keys in metadata (allowed)
- Name validation:
  - Valid hyphen-case names
  - Uppercase letters (invalid)
  - Underscores (invalid)
  - Starting/ending with hyphen (invalid)
  - Consecutive hyphens (invalid)
  - Maximum length boundary (64/65 chars)
- Description validation:
  - Valid description
  - Contains `<` (invalid)
  - Contains `>` (invalid)
  - Maximum length boundary (1024/1025 chars)

### Integration Tests
- Full validation workflow with valid skill
- Full validation workflow with multiple errors
- JSON output format
- Quiet output format
- Exit code verification

### Manual Testing
- Validate skills from official Anthropic skills repository
- Validate skills created by `asm scaffold`
- Test in CI/CD pipeline context

## Acceptance Criteria

- [ ] Command accepts skill path argument
- [ ] SKILL.md existence is validated
- [ ] YAML frontmatter structure is validated
- [ ] Required fields (name, description) are validated
- [ ] Unknown top-level properties are rejected
- [ ] Name format validation matches spec (hyphen-case, max 64 chars)
- [ ] Description validation matches spec (no angle brackets, max 1024 chars)
- [ ] Exit code 0 for valid skills
- [ ] Exit code 1 for invalid skills
- [ ] `--quiet` flag produces minimal output
- [ ] `--json` flag produces valid JSON output
- [ ] Error messages are clear and actionable
- [ ] All edge cases are handled
- [ ] Tests pass with >80% coverage
- [ ] Documentation updated
