# Feature Requirements: Minimal Scaffold Flag

## Overview

Add a `--minimal` flag to `asm scaffold` that generates shorter, production-ready templates without the verbose educational guidance, catering to experienced users who prefer clean scaffolding output.

## Feature ID
`FEAT-016`

## GitHub Issue
[#44](https://github.com/lwndev/ai-skills-manager/issues/44)

## Priority
Medium - Improves developer experience for experienced users; originated from PR #43 review feedback

## User Story

As an experienced skill developer, I want to scaffold a skill with minimal boilerplate so that I get a clean, production-ready SKILL.md without verbose educational comments and TODO guidance.

## Command Syntax

```bash
asm scaffold <name> --minimal [options]
```

### Options (New)
- `--minimal` - Generate shorter templates without educational guidance text

### Examples

```bash
# Current verbose output (default)
asm scaffold my-skill

# Minimal output for production use
asm scaffold my-skill --minimal

# Minimal with template variant
asm scaffold my-analyzer --minimal --template forked

# Minimal with description pre-filled
asm scaffold my-tool --minimal --description "Formats markdown files. Use when formatting or linting .md files."

# Minimal with all customization flags
asm scaffold my-helper --minimal --template internal --allowed-tools "Read, Grep"
```

## Functional Requirements

### FR-1: `--minimal` Flag

Add a `--minimal` boolean flag to the scaffold command that controls the verbosity of generated SKILL.md content.

- Flag: `--minimal` (no short alias to avoid conflicts)
- Default: `false` (current verbose behavior preserved)
- Applies to all template types (`basic`, `forked`, `with-hooks`, `internal`)

### FR-2: Minimal Basic Template

When `--minimal` is used with the `basic` template (default), generate a SKILL.md with:

```markdown
---
name: skill-name
description: "TODO: Describe what this skill does and when to use it."
---

# Skill Name

## Overview

TODO: Brief description of what this skill does.

## Instructions

TODO: Step-by-step guidance for Claude.

## Examples

TODO: Concrete input/output examples.
```

Key differences from verbose basic template:
- No HTML comment block with general guidance, frontmatter field docs, best practices, or tool reference
- No `## Resources` section with progressive disclosure guidance
- No `## Usage` or `## Implementation Notes` placeholder sections
- Concise TODO placeholders (single-line, no multi-line explanations)

### FR-3: Minimal Forked Template

When `--minimal` is used with `--template forked`:

```markdown
---
name: skill-name
description: "TODO: Describe what this skill does and when to use it."
context: fork
allowed-tools:
  - Read
  - Glob
  - Grep
---

# Skill Name

## Overview

TODO: Brief description. This skill runs in a forked context.

## Instructions

TODO: Step-by-step guidance for Claude.

## Examples

TODO: Concrete input/output examples.
```

Key differences from verbose forked template:
- No embedded HTML comment block with forked context guidance (~130 lines removed)
- Retains `context: fork` and default allowed-tools in frontmatter
- Single-line note about forked context in Overview placeholder

### FR-4: Minimal Hooks Template

When `--minimal` is used with `--template with-hooks`:

```markdown
---
name: skill-name
description: "TODO: Describe what this skill does and when to use it."
hooks:
  PreToolUse:
    - matcher: "*"
      hooks:
        - type: command
          command: "echo 'TODO: pre-tool hook'"
  PostToolUse:
    - matcher: "*"
      hooks:
        - type: command
          command: "echo 'TODO: post-tool hook'"
allowed-tools:
  - Bash
  - Read
  - Write
---

# Skill Name

## Overview

TODO: Brief description. This skill uses hooks for tool lifecycle events.

## Instructions

TODO: Step-by-step guidance for Claude.

## Examples

TODO: Concrete input/output examples.
```

Key differences from verbose hooks template:
- No embedded HTML comment block with hook documentation (~80 lines removed)
- Retains functional hook configuration in frontmatter
- Single-line note about hooks in Overview placeholder

### FR-5: Minimal Internal Template

When `--minimal` is used with `--template internal`:

```markdown
---
name: skill-name
description: "TODO: Internal helper for other skills. Not for direct user invocation."
user-invocable: false
allowed-tools:
  - Read
  - Grep
---

# Skill Name

## Overview

TODO: Brief description. This is an internal helper skill.

## Instructions

TODO: Step-by-step guidance for Claude.

## Examples

TODO: Concrete input/output examples.
```

Key differences from verbose internal template:
- No embedded HTML comment block with internal skill guidance (~30 lines removed)
- Retains `user-invocable: false` and default allowed-tools
- Single-line note about internal use in Overview placeholder

### FR-6: Combination with Other Flags

The `--minimal` flag must work with all existing scaffold options:

| Combination | Behavior |
|------------|----------|
| `--minimal --description <text>` | Uses provided description instead of TODO placeholder |
| `--minimal --template <type>` | Generates minimal version of specified template |
| `--minimal --context fork` | Adds `context: fork` to minimal output |
| `--minimal --agent <name>` | Adds `agent` field to minimal frontmatter |
| `--minimal --no-user-invocable` | Adds `user-invocable: false` to minimal frontmatter |
| `--minimal --hooks` | Adds hook configuration to minimal frontmatter |
| `--minimal --allowed-tools <tools>` | Uses specified tools instead of template defaults |
| `--minimal --personal` / `--project` | Works with both scope options |
| `--minimal --force` | Works with force overwrite |
| `--minimal --output <path>` | Works with custom output path |

### FR-7: Minimal Validation

Minimal templates must still produce valid skill output:

- Generated SKILL.md must pass `asm validate`
- Frontmatter must contain required `name` and `description` fields
- All template-specific frontmatter fields must be preserved (context, hooks, user-invocable, agent)

## Output Format

### Scaffold Success with Minimal Flag
```
Creating skill: my-skill
Template: basic (minimal)

✓ Created my-skill/
✓ Created my-skill/SKILL.md
✓ Created my-skill/scripts/

Skill scaffolded successfully!

Next steps:
  1. Edit SKILL.md to complete the TODO placeholders
  2. Test with: asm validate my-skill
```

Note: Minimal mode uses a shorter "Next steps" section (2 steps vs. the standard 5).

## Non-Functional Requirements

### NFR-1: Backward Compatibility
- Default behavior (no `--minimal` flag) must remain unchanged
- Existing scripts using `asm scaffold` must produce identical output

### NFR-2: Template Validity
- All minimal templates must produce SKILL.md files that pass `asm validate`
- Frontmatter structure must be valid YAML

### NFR-3: Consistency
- Minimal templates across all types should follow a consistent structure (frontmatter + Overview + Instructions + Examples)
- TODO placeholder style should be uniform across all minimal templates

## Dependencies

- FEAT-001 (Scaffold Skill Command) - Base scaffold command
- FEAT-013 (Skill Template Enhancements) - Template variants and flags
- Existing `src/templates/skill-md.ts` - Template generation
- Existing `src/commands/scaffold.ts` - Command definition
- Existing `src/api/scaffold.ts` - Scaffold API

## Edge Cases

1. **`--minimal` with no other flags**: Produces minimal basic template
2. **`--minimal` with `--template` and conflicting flags**: Flags override template defaults (same as non-minimal behavior)
3. **`--minimal` with `--hooks` flag on non-hooks template**: Adds hook config to minimal frontmatter without hook guidance text
4. **Validate minimal output**: Minimal SKILL.md must pass `asm validate` even with TODO placeholders in description

## Testing Requirements

### Unit Tests

**Template generation (`src/templates/skill-md.ts`):**
- `generateSkillMd()` with `minimal: true` for each template type
- Verify minimal output excludes HTML comment guidance block
- Verify minimal output includes frontmatter with all required fields
- Verify minimal output body is shorter than verbose output
- Verify minimal + flag combinations produce correct frontmatter

**Command options (`src/commands/scaffold.ts`):**
- `--minimal` flag is parsed correctly
- `--minimal` combined with `--template` options
- `--minimal` combined with other flags (`--context`, `--agent`, etc.)

### Integration Tests

- Scaffold with `--minimal` for each template type and verify output
- Validate minimal scaffolded skills pass `asm validate`
- Scaffold with `--minimal` + various flag combinations
- Compare minimal vs. verbose output sizes (minimal should be significantly smaller)

### Manual Testing

- Scaffold minimal skill and verify SKILL.md is clean and readable
- Verify minimal SKILL.md works correctly when loaded by Claude Code
- Test minimal templates with `asm validate`

## Future Enhancements

- `--bare` flag for even more minimal output (frontmatter only, no body sections)
- User-configurable default for minimal vs. verbose via ASM configuration
- Template preview with `asm scaffold --dry-run --minimal`

## Acceptance Criteria

- [x] `--minimal` flag is accepted by `asm scaffold`
- [x] Minimal templates contain valid SKILL.md structure with required frontmatter
- [x] Minimal templates pass `asm validate`
- [x] Minimal basic template omits HTML comment guidance block
- [x] Minimal forked template omits forked context guidance while keeping `context: fork`
- [x] Minimal hooks template omits hook documentation while keeping hook configuration
- [x] Minimal internal template omits internal skill guidance while keeping `user-invocable: false`
- [x] `--minimal` works in combination with all other flags (`--template`, `--context`, `--agent`, `--hooks`, `--no-user-invocable`, `--allowed-tools`, `--personal`, `--project`, `--force`, `--output`, `--description`)
- [x] Default behavior (no `--minimal`) is unchanged
- [x] Help text documents the `--minimal` flag
- [x] Unit tests cover minimal output for all template types
- [x] Integration tests validate minimal skills pass `asm validate`
