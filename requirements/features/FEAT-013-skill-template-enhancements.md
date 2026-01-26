# Feature Requirements: Skill Template Enhancements for Claude Code 2.1.x

## Overview

Enhance ASM's `asm scaffold` command with new template variants and options that leverage Claude Code 2.1.x features including context forking, hooks, agent specification, user-invocable control, wildcard tool patterns, and argument shorthand syntax.

## Feature ID
`FEAT-013`

## GitHub Issue
[#36](https://github.com/lwndev/ai-skills-manager/issues/36)

## Priority
Medium - Improves developer experience and demonstrates best practices for new Claude Code features

## User Story

As a skill developer, I want the scaffold command to offer template variants for advanced Claude Code 2.1.x features so that I can quickly create skills that use forked contexts, hooks, internal helpers, and other advanced patterns without writing boilerplate from scratch.

## Command Syntax

```bash
asm scaffold <name> [options]
```

### Arguments
- `<name>` (required) - Name of the skill to scaffold

### Options (New)
- `--template <type>` - Template variant to use (default: `basic`)
  - `basic` - Standard skill template (current behavior)
  - `forked` - Skill with `context: fork` for isolated execution
  - `with-hooks` - Skill demonstrating hook configuration
  - `internal` - Internal helper skill with `user-invocable: false`
- `--context fork` - Add `context: fork` to frontmatter
- `--agent <name>` - Set the `agent` field in frontmatter
- `--no-user-invocable` - Set `user-invocable: false` in frontmatter
- `--hooks` - Include commented hook examples in frontmatter

### Examples

```bash
# Basic skill (current behavior)
asm scaffold my-skill

# Forked context skill for isolated analysis
asm scaffold code-analyzer --template forked

# Skill with hook examples
asm scaffold git-workflow --template with-hooks

# Internal helper skill not shown in menu
asm scaffold validator-helper --template internal

# Custom combination using flags
asm scaffold my-agent-skill --context fork --agent custom-agent

# Add hook examples to basic template
asm scaffold my-skill --hooks
```

## Functional Requirements

### FR-1: Template Selection System

Add support for multiple template variants via the `--template` option:

| Template | Description | Key Features |
|----------|-------------|--------------|
| `basic` | Standard skill (current) | Name, description, allowed-tools |
| `forked` | Isolated execution | Adds `context: fork` |
| `with-hooks` | Hook demonstration | Includes PreToolUse, PostToolUse examples |
| `internal` | Internal helper | Adds `user-invocable: false` |

### FR-2: Forked Context Template (`--template forked`)

Generate a skill template optimized for isolated execution:

```yaml
---
name: skill-name
description: "TODO: Performs analysis in an isolated context. Use when analysis should not affect the main conversation state."
context: fork
allowed-tools:
  - Read
  - Glob
  - Grep
---
```

Body should include guidance specific to forked contexts:
- When to use forked contexts
- Limitations (no state persistence to parent)
- Best practices for data return

### FR-3: Hooks Template (`--template with-hooks`)

Generate a skill template demonstrating hook usage. Skills only support three hook types: `PreToolUse`, `PostToolUse`, and `Stop`.

The hooks format uses a nested structure with `matcher` (for PreToolUse/PostToolUse) and `hooks` array:

```yaml
---
name: skill-name
description: "TODO: Add description"
hooks:
  PreToolUse:
    - matcher: "*"
      hooks:
        - type: command
          command: echo "Starting tool execution..."
  PostToolUse:
    - matcher: "*"
      hooks:
        - type: command
          command: echo "Tool execution complete"
  # Stop:
  #   - hooks:
  #       - type: command
  #         command: echo "Skill stopped"
allowed-tools:
  - Bash
  - Read
  - Write
---
```

**Note:** Stop hooks don't use matchers. PreToolUse/PostToolUse can use `"*"` for all tools or specific patterns like `"Bash"` or `"Edit|Write"`.

Body should include:
- Hook types supported in skills and when they fire
- Matcher patterns for targeting specific tools
- Example use cases (validation, logging, cleanup)
- Hook configuration format
- The `once` option for running hooks only once per session

### FR-4: Internal Helper Template (`--template internal`)

Generate a skill template for internal use:

```yaml
---
name: skill-name
description: "TODO: Internal helper used by other skills. Not intended for direct user invocation."
user-invocable: false
allowed-tools:
  - Read
  - Grep
---
```

Body should include:
- Explanation of `user-invocable: false`
- How other skills can reference this skill
- Common patterns for helper skills

### FR-5: Individual Flag Support

Support individual flags that can be combined:

- `--context fork` - Adds `context: fork` to any template
- `--agent <name>` - Adds `agent: <name>` to frontmatter
- `--no-user-invocable` - Adds `user-invocable: false`
- `--hooks` - Adds commented hook examples

Flags override template defaults when both are specified.

### FR-6: Update Basic Template with Claude Code-Specific Comments

Enhance the existing basic template's guidance comments to document:

- New frontmatter fields (`context`, `agent`, `hooks`, `user-invocable`)
- Wildcard tool patterns (e.g., `Bash(git *)`, `Bash(npm install)`)
- Argument shorthand syntax (`$0`, `$1`, `$ARGUMENTS[0]`)
- Which fields are Claude Code-specific vs. open Agent Skills spec

### FR-7: Wildcard Tool Pattern Examples

Update allowed-tools documentation and examples to demonstrate wildcard patterns:

```yaml
allowed-tools:
  - Read
  - Glob
  - Grep
  - "Bash(git *)"           # All git commands
  - "Bash(npm install)"     # Only npm install
  - "Bash(npm test)"        # Only npm test
```

### FR-8: Argument Syntax Documentation

Include documentation of argument handling in template comments:

```markdown
ARGUMENT HANDLING:
- $ARGUMENTS - Full argument string passed to skill
- $0, $1, $2 - Individual positional arguments (shorthand)
- $ARGUMENTS[0] - Bracket syntax for positional arguments
- ${CLAUDE_SESSION_ID} - Current session identifier
```

## Output Format

### Scaffold Success with Template
```
Creating skill: code-analyzer
Template: forked

Created:
  skills/code-analyzer/
    SKILL.md (forked context template)
    scripts/

Skill scaffolded successfully!

Next steps:
  1. Edit skills/code-analyzer/SKILL.md
  2. Update the description and implementation
  3. Test with: asm validate skills/code-analyzer
```

### Invalid Template Error
```
Error: Unknown template 'invalid-template'

Available templates:
  - basic (default)
  - forked
  - with-hooks
  - internal
```

## Non-Functional Requirements

### NFR-1: Backward Compatibility
- Default behavior (no flags) must remain unchanged
- Existing scripts using `asm scaffold` must work without modification

### NFR-2: Documentation Quality
- Template comments should be clear and actionable
- Include links to official documentation where applicable
- Mark Claude Code-specific fields clearly

### NFR-3: Spec Compliance Warnings
- Templates should clearly indicate which frontmatter fields are Claude Code-specific extensions
- Reference the open Agent Skills specification (agentskills.io)

## Dependencies

- FEAT-011 (Frontmatter Enhancements) - Validation must support new fields
- Existing `src/templates/skill-md.ts`
- Existing `src/commands/scaffold.ts`

## Edge Cases

1. **`--template` with conflicting flags**: Flags override template defaults
2. **Unknown template name**: Error with list of valid templates
3. **`--agent` with empty string**: Error - agent name required
4. **Multiple templates specified**: Error - only one template allowed
5. **`--context` with invalid value**: Error - only "fork" is valid
6. **Template with `--hooks` flag**: Merge hook examples into template

## Testing Requirements

### Unit Tests

**Template generation (`src/templates/skill-md.ts`):**
- `generateSkillMd()` with each template type
- Flag combinations (e.g., `--context fork --agent custom`)
- Frontmatter field escaping for new fields
- Wildcard tool patterns in allowed-tools

**Command options (`src/commands/scaffold.ts`):**
- `--template` option parsing
- Individual flag parsing (`--context`, `--agent`, `--hooks`, `--no-user-invocable`)
- Flag/template combination handling

### Integration Tests

- Scaffold with each template type and verify output
- Scaffold with flag combinations
- Validate scaffolded skills pass `asm validate`
- Error handling for invalid templates/flags

### Manual Testing

- Create skill with each template variant
- Verify generated SKILL.md works in Claude Code 2.1.x
- Test hook examples execute correctly
- Confirm forked context skills run in isolation

## Future Enhancements

- Interactive template selection mode (`asm scaffold --interactive`)
- Custom template directories for organization-specific templates
- Template validation against Agent Skills specification
- Template preview before generation (`asm scaffold --dry-run`)

## Acceptance Criteria

- [ ] `--template basic` produces current default output
- [ ] `--template forked` adds `context: fork` and appropriate guidance
- [ ] `--template with-hooks` includes hook configuration examples
- [ ] `--template internal` adds `user-invocable: false`
- [ ] `--context fork` flag works independently
- [ ] `--agent <name>` flag sets agent field
- [ ] `--no-user-invocable` flag sets `user-invocable: false`
- [ ] `--hooks` flag adds commented hook examples
- [ ] Flags can be combined with templates
- [ ] Basic template updated with Claude Code 2.1.x documentation
- [ ] Wildcard tool patterns documented in templates
- [ ] Argument shorthand syntax documented
- [ ] Claude Code-specific vs. open spec fields clearly marked
- [ ] All existing scaffold tests continue to pass
- [ ] New unit tests for each template variant
- [ ] Integration tests validate scaffolded skills
- [ ] Error messages for invalid options are clear
