# Feature Requirements: Agent Template Type & Template Updates

## Overview

Add a new `agent` template variant to ASM's `asm scaffold` command that demonstrates agent-specific frontmatter fields (`memory`, `model`, `skills`, `permissionMode`, `disallowedTools`), and update existing templates to document newly supported fields and patterns.

## Feature ID

`FEAT-017`

## GitHub Issues

- https://github.com/lwndev/ai-skills-manager/issues/52

## Priority

Medium — Improves developer experience for creating Claude Code agents

## Changelog References

| Version | Change |
|---------|--------|
| v2.1.33 | `memory` frontmatter field for persistent agent memory |
| v2.1.33 | `Task(agent_type)` syntax for restricting sub-agent spawning |
| v2.0.43 | `skills` field to declare auto-loaded skills |
| v2.0.43 | `permissionMode` field for agents |
| v2.0.30 | `disallowedTools` field for tool blocking |
| v1.0.64 | `model` field for agent model customization |
| v2.1.0  | `once: true` option for hooks |
| v1.0.54 | `argument-hint` field |

## User Story

As a skill developer, I want a dedicated agent template that scaffolds agent-specific fields and guidance so that I can quickly create custom Claude Code agents without researching which frontmatter fields are available.

## Dependencies

- FEAT-014 (Frontmatter Schema v2) — validation must support new fields before templates reference them
- FEAT-013 (Skill Template Enhancements) — existing template system this builds on

## Command Syntax

```bash
asm scaffold <name> --template agent [options]
```

### New Template

- `--template agent` — Agent skill with model, memory, skills, and tool control fields

### New Flags

- `--memory <scope>` — Set the `memory` field (`user`, `project`, or `local`)
- `--model <name>` — Set the `model` field (e.g., `sonnet`, `opus`, `haiku`)
- `--argument-hint <hint>` — Set the `argument-hint` field

### Examples

```bash
# Agent with project memory and Sonnet model
asm scaffold code-reviewer --template agent --memory project --model sonnet

# Agent with custom model and restricted tools
asm scaffold safe-refactor --template agent --model haiku

# Add argument hint to any template
asm scaffold search-helper --template forked --argument-hint "<query> [--deep]"

# Add memory to a basic skill
asm scaffold learning-assistant --memory user
```

## Functional Requirements

### FR-1: Agent Template (`--template agent`)

Generate a skill template tailored for custom agent definitions:

```yaml
---
name: skill-name
description: "TODO: Describe what this agent does and when it should be used."
model: sonnet
memory: project
skills: []
allowed-tools:
  - Read
  - Glob
  - Grep
  - Edit
  - Write
  - Bash
disallowedTools: []
---
```

Body should include guidance specific to agents:
- How `model` affects execution (inherits from parent if omitted)
- Memory scopes and when to use each (`user` = cross-project, `project` = repo-specific, `local` = machine-specific)
- Using `skills` to auto-load dependent skills
- Using `disallowedTools` vs restricting `allowed-tools`
- Using `permissionMode` for controlling agent permissions
- How agents differ from regular skills

### FR-2: `--memory` Flag

- Adds `memory: <scope>` to any template's frontmatter
- Valid values: `user`, `project`, `local`
- Invalid values produce an error before scaffold
- Overrides template default if template includes `memory`

### FR-3: `--model` Flag

- Adds `model: <name>` to any template's frontmatter
- Any non-empty string accepted
- Overrides template default if template includes `model`

### FR-4: `--argument-hint` Flag

- Adds `argument-hint: "<hint>"` to any template's frontmatter
- Any non-empty string accepted (max 100 chars)
- Useful for any template type, not just agents

### FR-5: Update Hooks Template with `once: true`

Update the `with-hooks` template to document the `once: true` option:

```yaml
hooks:
  PreToolUse:
    - matcher: "*"
      hooks:
        - type: command
          command: echo "Starting tool execution..."
          once: true  # Only runs on first matching tool use
```

Template guidance should explain:
- `once: true` causes the hook to run only once per session
- Useful for one-time setup, validation, or initialization

### FR-6: Update All Templates with New Field Documentation

Update the guidance comment blocks in all templates to document:

- `memory` field and its scopes
- `model` field for model selection
- `skills` field for loading dependent skills
- `disallowedTools` field for tool blocking
- `permissionMode` field for agent permissions
- `argument-hint` field for UI hints

This documentation should be in the HTML comment guidance block (or the verbose section), not in the frontmatter itself — only include fields that are relevant to each template type.

### FR-7: Flag Combination Rules

- `--memory`, `--model`, `--argument-hint` can be used with any `--template`
- Flags override template defaults when both specify the same field
- `--memory` validates against allowed values (`user`, `project`, `local`) before scaffolding
- `--argument-hint` validates max length (100 chars) before scaffolding

## Output Format

### Scaffold Success with Agent Template
```
Creating skill: code-reviewer
Template: agent

Created:
  skills/code-reviewer/
    SKILL.md (agent template)
    scripts/

Skill scaffolded successfully!

Next steps:
  1. Edit skills/code-reviewer/SKILL.md
  2. Update the description, model, and memory scope
  3. Test with: asm validate skills/code-reviewer
```

### Invalid Memory Scope Error
```
Error: Invalid memory scope 'global'. Valid values: user, project, local
```

### Invalid Argument Hint Length Error
```
Error: Argument hint must be 100 characters or fewer, got 142 characters.
```

## Non-Functional Requirements

### NFR-1: Backward Compatibility
- Existing templates unchanged when new flags are not used
- Default `--template basic` behavior must not change
- Existing scripts using `asm scaffold` must work without modification

### NFR-2: Template Consistency
- All templates follow the same structural pattern
- Guidance comments use consistent formatting
- Frontmatter field ordering is consistent across templates

### NFR-3: Minimal Template Support
- If FEAT-016 (`--minimal`) is implemented, the agent template must also support it
- Minimal agent template includes frontmatter only, no verbose guidance

## Edge Cases

1. **`--template agent` with `--context fork`**: Valid — creates forked agent
2. **`--template agent` with `--no-user-invocable`**: Valid — internal agent
3. **`--memory` without `--template agent`**: Valid — memory applies to any template
4. **`--model` with empty string**: Error before scaffolding
5. **`--memory global`**: Error — not a valid scope
6. **`--argument-hint` with special YAML chars**: Must be properly quoted in output
7. **`--template agent` with `--hooks`**: Valid — agent with hook examples
8. **All flags combined**: Must work — scaffold produces valid SKILL.md

## Testing Requirements

### Unit Tests

**Template generation (`src/templates/skill-md.ts`):**
- `agent` template generates correct frontmatter (model, memory, skills, etc.)
- `--memory` flag adds field to all template types
- `--model` flag adds field to all template types
- `--argument-hint` flag adds field with proper quoting
- `once: true` appears in `with-hooks` template
- Flag overrides template defaults
- Flag combination produces valid output

**Command options (`src/commands/scaffold.ts`):**
- `--memory` option parsing and validation
- `--model` option parsing
- `--argument-hint` option parsing and length validation
- Invalid `--memory` value produces error
- Over-length `--argument-hint` produces error

### Integration Tests

- Scaffold with `--template agent` and verify valid SKILL.md
- Scaffold with `--template agent --memory user --model haiku`
- Scaffold with every flag combination
- All scaffolded files pass `asm validate`
- Backward compatibility: all existing scaffold tests pass

### Manual Testing

- Create agent skill and test in Claude Code
- Verify memory persistence with different scopes
- Verify model selection takes effect
- Confirm `once: true` hook executes only once

## Acceptance Criteria

- [x] `--template agent` produces agent-specific SKILL.md
- [x] Agent template includes `model`, `memory`, `skills`, `disallowedTools` fields
- [x] `--memory <scope>` flag works with all templates
- [x] `--model <name>` flag works with all templates
- [x] `--argument-hint <hint>` flag works with all templates
- [x] Invalid `--memory` value produces clear error
- [x] Over-length `--argument-hint` produces clear error
- [x] `with-hooks` template documents `once: true` option
- [x] All templates updated with new field documentation in guidance
- [x] Flags override template defaults
- [x] All flag combinations produce valid SKILL.md
- [x] All existing scaffold tests continue to pass
- [x] New unit tests for agent template and new flags
- [x] Integration tests validate scaffolded skills
- [x] `npm run quality` passes
