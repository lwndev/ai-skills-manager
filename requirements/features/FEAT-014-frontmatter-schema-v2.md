# Feature Requirements: Frontmatter Schema v2 — New Claude Code Fields & Validation Patterns

## Overview

Extend ASM's frontmatter validation to support new fields introduced in Claude Code v2.0.30 through v2.1.33, and update the `allowed-tools` validator to accept advanced tool permission patterns (`Task(AgentName)`, `mcp__server__*`, `${CLAUDE_PLUGIN_ROOT}`).

This builds on FEAT-011 which added `context`, `agent`, `hooks`, and `user-invocable`. This feature adds the remaining fields needed for full compatibility with Claude Code's current skill and agent frontmatter schema.

## Feature ID

`FEAT-014`

## GitHub Issues

- https://github.com/lwndev/ai-skills-manager/issues/51

## Priority

High — Required for compatibility with Claude Code v2.1.33+ agent and skill features

## Changelog References

| Version | Change |
|---------|--------|
| v2.1.33 | `memory` frontmatter field with `user`, `project`, or `local` scope |
| v2.1.33 | `Task(agent_type)` syntax in `tools` frontmatter for restricting sub-agents |
| v2.0.70 | `mcp__server__*` wildcard syntax for MCP tool permissions |
| v2.0.43 | `skills` frontmatter field for declaring auto-loaded skills |
| v2.0.43 | `permissionMode` field for custom agents |
| v2.0.30 | `disallowedTools` field for explicit tool blocking |
| v2.1.0  | `${CLAUDE_PLUGIN_ROOT}` substitution in `allowed-tools` |
| v1.0.64 | `model` field for agent model customization |
| v2.0.37 | `keep-coding-instructions` field for output style control |
| v1.0.54 | `argument-hint` field for slash command argument hints |

## User Story

As a skill developer, I want ASM to validate the full set of Claude Code frontmatter fields so that skills using agent memory, model selection, sub-skill loading, and advanced tool patterns pass validation without false-positive errors.

## Functional Requirements

### FR-1: Add `memory` Field

- If present, must be one of: `"user"`, `"project"`, or `"local"`
- Any other value is invalid
- Field is optional
- Enables persistent memory scoped to the specified level

```yaml
memory: project
```

### FR-2: Add `skills` Field

- If present, must be a string or array of strings
- Each string is a skill name to auto-load when this skill/agent runs
- Empty array is valid
- Field is optional

```yaml
skills:
  - code-analyzer
  - test-runner
```

Or single skill:
```yaml
skills: code-analyzer
```

### FR-3: Add `model` Field

- If present, must be a non-empty string
- No format constraints on model names (defers to Claude Code runtime)
- Field is optional
- Common values: `"sonnet"`, `"opus"`, `"haiku"`, or full model IDs

```yaml
model: sonnet
```

### FR-4: Add `permissionMode` Field

- If present, must be a non-empty string
- No format constraints (defers to Claude Code runtime)
- Field is optional
- Used primarily by custom agent definitions

```yaml
permissionMode: plan
```

### FR-5: Add `disallowedTools` Field

- If present, must be a string or array of strings
- Supports the same tool name patterns as `allowed-tools`
- Including `Task(AgentName)` syntax for blocking specific agent types
- Empty array is valid
- Field is optional

```yaml
disallowedTools:
  - Write
  - Task(general-purpose)
```

### FR-6: Add `argument-hint` Field

- If present, must be a non-empty string
- Provides hint text displayed in the slash command menu
- Field is optional
- Max length: 100 characters

```yaml
argument-hint: "<file-path> [--verbose]"
```

### FR-7: Add `keep-coding-instructions` Field

- If present, must be a boolean (`true` or `false`)
- Controls output style behavior in Claude Code
- Field is optional
- Niche field primarily used for output formatting preferences

```yaml
keep-coding-instructions: true
```

### FR-8: Update `allowed-tools` Validation for Advanced Patterns

The `allowed-tools` validator must accept the following patterns in addition to simple tool names:

| Pattern | Example | Description |
|---------|---------|-------------|
| Simple name | `Read` | Exact tool name |
| Bash with command | `Bash(git *)` | Wildcard bash command pattern |
| Task with agent | `Task(general-purpose)` | Restrict to specific agent type |
| MCP wildcard | `mcp__server__*` | All tools from an MCP server |
| Plugin root var | `${CLAUDE_PLUGIN_ROOT}/scripts/run.sh` | Plugin path substitution |
| Bare wildcard | `Bash(*)` or `Bash` | All commands for a tool |

Current validation should not reject these patterns. If ASM currently validates `allowed-tools` entries against a fixed list of known tools, that validation must be relaxed to accept any string that follows valid tool permission syntax.

### FR-9: Backward Compatibility

- Existing skills without new fields must continue to validate successfully
- No changes to required fields (`name`, `description`)
- No breaking changes to validation output format
- New fields are all optional

## Updated Allowed Keys

```typescript
const ALLOWED_KEYS = new Set([
  // Core spec fields
  'name',
  'description',
  'license',
  'compatibility',
  'allowed-tools',
  'metadata',
  // Claude Code 2.1.x fields (FEAT-011)
  'context',
  'agent',
  'hooks',
  'user-invocable',
  // New fields (FEAT-014)
  'memory',
  'skills',
  'model',
  'permissionMode',
  'disallowedTools',
  'argument-hint',
  'keep-coding-instructions',
]);
```

## Output Format

### Validation Error for Invalid `memory` Value
```
Validating skill: my-agent

Checks:
  ✓ SKILL.md exists
  ✓ Valid YAML frontmatter
  ✓ Required fields present
  ✗ Field format invalid

Error: Field 'memory' must be one of "user", "project", or "local" if specified, got "global".

Skill validation failed.
```

### Validation Error for Invalid `skills` Value
```
Error: Field 'skills' must be a string or array of strings if specified, got number.
```

### Validation Error for Invalid `argument-hint` Length
```
Error: Field 'argument-hint' must be 100 characters or fewer, got 142 characters.
```

## Non-Functional Requirements

### NFR-1: Performance
- No additional performance overhead for skills that don't use new fields
- Validation should still complete within 100ms

### NFR-2: Error Messages
- Error messages should reference the specific field and invalid value
- Suggest valid values where applicable (e.g., `memory` must be "user", "project", or "local")

### NFR-3: Extensibility
- The pattern of adding validators per field should be maintained
- Each new field gets its own validator file in `src/validators/`

## API Integration

Update the programmatic API types:

```typescript
// src/types/validation.ts - additions to ParsedFrontmatter
export interface ParsedFrontmatter {
  // ... existing fields ...

  // New fields (FEAT-014)
  memory?: 'user' | 'project' | 'local';
  skills?: string | string[];
  model?: string;
  permissionMode?: string;
  disallowedTools?: string | string[];
  'argument-hint'?: string;
  'keep-coding-instructions'?: boolean;
}
```

## Dependencies

- FEAT-011 (Frontmatter Enhancements) — already complete
- Existing `src/validators/frontmatter.ts`
- Existing `src/types/validation.ts`

## Edge Cases

1. **`memory` with wrong value**: Error with message listing valid options
2. **`skills` as single string**: Valid — treat as single-item list
3. **`skills` as empty array**: Valid — no auto-loaded skills
4. **`skills` as number or boolean**: Error — must be string or array of strings
5. **`model` as empty string**: Error — must be non-empty if present
6. **`disallowedTools` as single string**: Valid — treat as single tool
7. **`disallowedTools` with `Task(AgentName)` pattern**: Valid
8. **`argument-hint` as empty string**: Error — must be non-empty if present
9. **`argument-hint` exceeding 100 chars**: Error with length info
10. **`allowed-tools` with `mcp__server__*`**: Must be accepted (not rejected as unknown tool)
11. **`allowed-tools` with `${CLAUDE_PLUGIN_ROOT}`**: Must be accepted (variable substitution)
11a. **`keep-coding-instructions` as string**: Error — must be boolean
11b. **`keep-coding-instructions` as boolean**: Valid
12. **`permissionMode` as non-string**: Error — must be string
13. **Both `allowed-tools` and `disallowedTools` present**: Valid (Claude Code handles precedence)

## Testing Requirements

### Unit Tests

**New validators (`src/validators/`):**
- `memory`: valid scopes, invalid scope, missing, non-string
- `skills`: string, array of strings, empty array, non-string types
- `model`: valid string, empty string, non-string
- `permissionMode`: valid string, empty string, non-string
- `disallowedTools`: string, array of strings, Task() pattern, empty array
- `argument-hint`: valid string, empty string, over-length, non-string
- `keep-coding-instructions`: valid boolean, non-boolean types

**Frontmatter key validation (`src/validators/frontmatter.ts`):**
- All new keys accepted individually
- All new keys accepted together
- Unknown keys still rejected
- Mixed old and new keys work

**Allowed-tools pattern validation:**
- `Task(agent-name)` accepted
- `mcp__server__*` accepted
- `${CLAUDE_PLUGIN_ROOT}/path` accepted
- `Bash(git *)` accepted (existing but verify)
- `Bash(*)` accepted

### Integration Tests

- Full validation of skill with all new fields populated
- Full validation of skill with subset of new fields
- Backward compatibility: existing skills without new fields
- Scaffold + validate round-trip with new fields

## Acceptance Criteria

- [ ] `memory` field accepted and validated (`"user"`, `"project"`, or `"local"`)
- [ ] `skills` field accepted and validated (string or string array)
- [ ] `model` field accepted and validated (non-empty string)
- [ ] `permissionMode` field accepted and validated (non-empty string)
- [ ] `disallowedTools` field accepted and validated (string or string array)
- [ ] `argument-hint` field accepted and validated (non-empty string, max 100 chars)
- [ ] `keep-coding-instructions` field accepted and validated (boolean)
- [ ] `allowed-tools` accepts `Task(AgentName)` patterns
- [ ] `allowed-tools` accepts `mcp__server__*` patterns
- [ ] `allowed-tools` accepts `${CLAUDE_PLUGIN_ROOT}` patterns
- [ ] `ALLOWED_KEYS` set updated in frontmatter validator
- [ ] `ParsedFrontmatter` type updated with new fields
- [ ] Each new field has its own validator file
- [ ] Error messages are clear and actionable
- [ ] All existing tests continue to pass
- [ ] New unit tests for each new field
- [ ] Integration tests for full validation workflow
- [ ] `npm run quality` passes
