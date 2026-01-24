# Feature Requirements: Frontmatter Enhancements for Claude Code 2.1.x

## Overview

Enhance ASM's frontmatter parsing and validation to support new Claude Code 2.1.x features including additional frontmatter fields (`context`, `agent`, `hooks`, `user-invocable`) and YAML list format for `allowed-tools`.

## Feature ID
`FEAT-011`

## GitHub Issues
- [#33](https://github.com/lwndev/ai-skills-manager/issues/33) - Add support for new skill frontmatter fields
- [#35](https://github.com/lwndev/ai-skills-manager/issues/35) - Support YAML list format for allowed-tools

## Priority
High - Required for compatibility with Claude Code 2.1.x skill features

## User Story

As a skill developer, I want ASM to recognize and validate the new Claude Code 2.1.x frontmatter fields so that I can use advanced skill features like forked contexts, hooks, and user-invocable control without validation errors.

## Functional Requirements

### FR-1: Support New Frontmatter Fields

Add the following fields to the allowed frontmatter keys:

| Field | Type | Description |
|-------|------|-------------|
| `context` | `"fork"` | Run skill in a forked sub-agent context |
| `agent` | `string` | Specify agent type for execution |
| `hooks` | `object` | Define lifecycle hooks (PreToolUse, PostToolUse, Stop) |
| `user-invocable` | `boolean` | Control visibility in slash command menu (default: `true`) |

### FR-2: Validate `context` Field

- If present, must be the literal string `"fork"`
- Any other value is invalid
- Field is optional

### FR-3: Validate `agent` Field

- If present, must be a non-empty string
- Field is optional
- No additional constraints on agent name format (defers to Claude Code)

### FR-4: Validate `hooks` Field

- If present, must be an object
- Allowed keys: `PreToolUse`, `PostToolUse`, `Stop`
- Each hook value must be a string (command to execute) or array of strings
- Unknown hook keys should produce a warning (non-blocking)
- Field is optional

Example valid hooks:
```yaml
hooks:
  PreToolUse: "./scripts/pre-hook.sh"
  PostToolUse: "./scripts/post-hook.sh"
  Stop: "./scripts/cleanup.sh"
```

### FR-5: Validate `user-invocable` Field

- If present, must be a boolean (`true` or `false`)
- When `false`, skill is hidden from the slash command menu
- Default behavior (when omitted): skill is visible (`true`)
- Field is optional

### FR-6: Support YAML List Format for `allowed-tools`

Update the frontmatter parser to accept both formats:

**Inline format (existing):**
```yaml
allowed-tools: Read, Write, Bash
```

**YAML list format (new):**
```yaml
allowed-tools:
  - Read
  - Write
  - Bash
```

Both formats should normalize to the same internal representation (`string[]`).

### FR-7: Backward Compatibility

- Existing skills without new fields must continue to validate successfully
- The inline `allowed-tools` format must remain supported
- No breaking changes to validation output format

## Output Format

### Validation Success with New Fields
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

### Validation Error for Invalid Field Value
```
Validating skill: my-skill

Checks:
  ✓ SKILL.md exists
  ✓ Valid YAML frontmatter
  ✓ Required fields present
  ✗ Field format invalid

Error: Field 'context' must be "fork" if specified, got "spawn".

Skill validation failed.
```

### Warning for Unknown Hook
```
Validating skill: my-skill

Checks:
  ✓ SKILL.md exists
  ✓ Valid YAML frontmatter
  ✓ Required fields present
  ✓ No unknown properties
  ✓ Name format valid
  ✓ Description format valid

Warning: Unknown hook 'OnError' in hooks field. Known hooks: PreToolUse, PostToolUse, Stop

Skill is valid!
```

## Non-Functional Requirements

### NFR-1: Performance
- No additional performance overhead for skills that don't use new fields
- Validation should still complete within 100ms

### NFR-2: Error Messages
- Error messages should reference the specific field and invalid value
- Suggest valid values where applicable (e.g., `context` must be "fork")

### NFR-3: Documentation
- Update skill specification documentation with new fields
- Add examples of new field usage

## API Integration

Update the programmatic API types:

```typescript
// src/types/validation.ts
export interface ParsedFrontmatter {
  name?: string;
  description?: string;
  license?: string;
  compatibility?: string;
  'allowed-tools'?: string[];
  metadata?: Record<string, unknown>;
  // New fields for Claude Code 2.1.x
  context?: 'fork';
  agent?: string;
  hooks?: {
    PreToolUse?: string | string[];
    PostToolUse?: string | string[];
    Stop?: string | string[];
    [key: string]: string | string[] | undefined;
  };
  'user-invocable'?: boolean;
  [key: string]: unknown;
}
```

## Dependencies

- Existing `src/utils/frontmatter-parser.ts`
- Existing `src/validators/frontmatter.ts`
- Existing `src/types/validation.ts`

## Edge Cases

1. **`context` with wrong value**: Error with message suggesting "fork"
2. **`user-invocable` as string "false"**: Error - must be boolean, not string
3. **`hooks` as string instead of object**: Error - must be object
4. **Empty `hooks` object**: Valid - no hooks defined
5. **Unknown hook key**: Warning but still valid (future-proofing)
6. **Mixed `allowed-tools` formats in same file**: Not applicable (YAML only allows one format per key)
7. **`allowed-tools` as empty array**: Valid - no tools pre-approved
8. **`allowed-tools` as null**: Treat as undefined/not specified
9. **Both inline and list elements in `allowed-tools`**: YAML syntax error (handled by parser)

## Testing Requirements

### Unit Tests

**New field validation (`src/validators/`):**
- `context` field: valid "fork", invalid other strings, missing
- `agent` field: valid string, empty string, non-string types
- `user-invocable` field: true, false, string "true"/"false" (invalid), missing
- `hooks` field: valid object, invalid non-object, unknown keys (warning)

**Frontmatter parser (`src/utils/frontmatter-parser.ts`):**
- YAML list `allowed-tools`: single item, multiple items, empty list
- Inline `allowed-tools`: existing tests still pass
- Mixed parsing with new fields present

**Allowed keys validation (`src/validators/frontmatter.ts`):**
- New keys accepted: context, agent, hooks, user-invocable
- Unknown keys still rejected

### Integration Tests

- Full validation of skill with all new fields
- Full validation of skill with subset of new fields
- Backward compatibility: validate existing skills without new fields
- Warning output for unknown hook keys

### Manual Testing

- Validate skills from Claude Code 2.1.x examples
- Create skill using `asm scaffold` and add new fields manually
- Verify ASM output matches expected format

## Future Enhancements

- CLI support for setting new fields during `asm scaffold` (e.g., `--context fork`)
- Template variants that demonstrate hook usage
- Validation that hook script files exist (optional check)

## Acceptance Criteria

- [ ] `context` field accepted and validated (must be "fork" if present)
- [ ] `agent` field accepted and validated (non-empty string)
- [ ] `hooks` field accepted and validated (object with known hook keys)
- [ ] `user-invocable` field accepted and validated (boolean)
- [ ] Unknown hook keys produce warnings, not errors
- [ ] YAML list format for `allowed-tools` is parsed correctly
- [ ] Inline format for `allowed-tools` continues to work
- [ ] `ParsedFrontmatter` type updated with new fields
- [ ] `ALLOWED_KEYS` set updated in frontmatter validator
- [ ] Error messages are clear and actionable
- [ ] All existing tests continue to pass
- [ ] New unit tests for each new field
- [ ] Integration tests for full validation workflow
- [ ] Documentation updated with new field descriptions
