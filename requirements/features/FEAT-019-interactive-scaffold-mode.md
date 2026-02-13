# Feature Requirements: Interactive Scaffold Mode

## Overview

Add an `--interactive` flag to `asm scaffold` that guides users through template selection and configuration via interactive prompts, making it easier to scaffold skills without memorizing flag combinations.

## Feature ID
`FEAT-019`

## GitHub Issue
[#45](https://github.com/lwndev/ai-skills-manager/issues/45)

## Priority
Medium - UX enhancement for discoverability of scaffold options

## User Story

As a skill author, I want to interactively configure a new skill through guided prompts so that I can discover and select template options without memorizing CLI flags.

## Command Syntax

```bash
asm scaffold <name> --interactive [options]
```

### Arguments

- `<name>` (required) - Name of the skill to create

### Options

- `--interactive` / `-i` - Launch interactive prompt-driven scaffold workflow

### Compatibility with Existing Options

- `--interactive` can be combined with `<name>` (skill name is still provided as a positional argument)
- `--interactive` can be combined with `-o`/`--output`, `-p`/`--project`, `--personal`, and `-f`/`--force` (these configure output location/behavior, not template content)
- `--interactive` **overrides** template-content flags if both are provided: `--template`, `--context`, `--agent`, `--no-user-invocable`, `--hooks`, `--minimal`, `-d`/`--description`, `-a`/`--allowed-tools`, `--argument-hint`, `--license`, `--compatibility`, `--metadata`
- When overriding, display a warning: `Interactive mode enabled — template flags will be ignored.`

### Examples

```bash
# Interactive scaffold
asm scaffold my-skill --interactive

# Short flag
asm scaffold my-skill -i

# Combined with output options
asm scaffold my-skill -i --project --force
```

## Functional Requirements

### FR-1: Interactive Prompt Flow

Launch a sequential prompt flow when `--interactive` is specified:

1. **Template type selection** (single-select, required)
2. **Context type selection** (single-select, conditional)
3. **Agent name** (text input, optional)
4. ~~**Memory scope** (single-select, conditional)~~ (Removed by CHORE-013)
5. ~~**Model selection** (single-select, conditional)~~ (Removed by CHORE-013)
6. **Hooks configuration** (yes/no, conditional)
7. **Minimal mode** (yes/no)
8. **Description** (text input, optional)
9. **Argument hint** (text input, optional)
10. **Allowed tools** (text input, optional)
11. **License** (text input, optional) (Added by CHORE-013)
12. **Compatibility** (text input, optional) (Added by CHORE-013)
13. **Metadata** (text input, optional, key=value format) (Added by CHORE-013)

Display a summary of selected options before proceeding with scaffold generation.

### FR-2: Template Type Selection

Prompt the user to select a template type with descriptions:

```
? Select a template type:
  > basic      - Standard skill with default settings
    forked     - Isolated context with read-only tools
    with-hooks - Includes hook configuration examples
    internal   - Non-user-invocable helper skill
```

- Default selection: `basic`
- Maps directly to `--template <type>` flag values
- ~~`agent` template type was previously listed here but was removed in CHORE-013~~

### FR-3: Context Type Selection

Prompt for context type only when the selected template is `basic` (other templates set context implicitly):

```
? Select context type:
  > inherit - Share context with parent (default)
    fork    - Isolated context with separate conversation
```

- Default selection: `inherit`
- When `inherit` is selected, omit `context` from frontmatter (it is the default behavior)
- When `fork` is selected, equivalent to `--context fork`

### FR-4: Agent Name Input

Prompt for an optional agent name:

```
? Agent name (optional, press Enter to skip):
```

- Accept any non-empty string
- When skipped, omit `agent` field from frontmatter
- Maps to `--agent <name>` flag

### ~~FR-5: Memory Scope Selection~~ (Removed by CHORE-013)

~~Prompt for memory scope. When the `agent` template is selected, present this as a default-populated selection. For other templates, present as optional.~~

**Removed:** The `memory` field is agent-only and does not belong in skill templates. The memory scope prompt and `--memory` CLI option were removed in CHORE-013. See `requirements/chores/CHORE-013-fix-scaffold-template-schema.md`.

### ~~FR-6: Model Selection~~ (Removed by CHORE-013)

~~Prompt for model selection. When the `agent` template is selected, present as a default-populated selection. For other templates, present as optional.~~

**Removed:** The `model` field is agent-only and does not belong in skill templates. The model selection prompt and `--model` CLI option were removed in CHORE-013. See `requirements/chores/CHORE-013-fix-scaffold-template-schema.md`.

### FR-7: Hooks Configuration

Prompt for hooks only when the selected template is `basic` or `forked` (the `with-hooks` template includes hooks automatically, `internal` does not typically use hooks):

```
? Include hook configuration examples? (y/N)
```

- Default: No
- When yes, equivalent to `--hooks` flag

### FR-8: Minimal Mode Selection

Prompt for minimal mode:

```
? Use minimal template (shorter, without educational guidance)? (y/N)
```

- Default: No
- Maps to `--minimal` flag

### FR-9: Description Input

Prompt for an optional skill description:

```
? Skill description (optional, press Enter to skip):
```

- Accept any non-empty string
- When skipped, use the template's default description placeholder
- Maps to `-d`/`--description` flag

### FR-10: Argument Hint Input

Prompt for an optional argument hint:

```
? Argument hint (optional, press Enter to skip):
  Example: <query> [--deep]
```

- Accept any non-empty string up to 200 characters
- If input exceeds 200 characters, display inline error and re-prompt
- When skipped, omit `argument-hint` from frontmatter
- Maps to `--argument-hint <hint>` flag

### FR-11: Allowed Tools Input

Prompt for optional allowed tools:

```
? Allowed tools (comma-separated, press Enter to skip):
  Examples: Read, Write, Bash, Glob, Grep
```

- Accept comma-separated tool names
- When skipped, omit `allowed-tools` from frontmatter
- Maps to `-a`/`--allowed-tools` flag

### FR-12: Configuration Summary

Before generating the skill, display a summary of all selected options:

```
Scaffold configuration:
  Name:           my-skill
  Template:       basic
  Context:        fork
  Minimal:        no
  Description:    A skill that does something
  Argument hint:  <query> [--deep]
  License:        MIT

Proceed? (Y/n)
```

Only display fields that were set (skip fields left at their defaults or skipped).

- Default: Yes
- If user declines, return to the first prompt (template selection)
- If user confirms, proceed with scaffold generation

### FR-13: TTY Detection and Graceful Fallback

- Detect whether stdin is a TTY before launching interactive prompts
- If stdin is not a TTY (e.g., piped input, CI environment), display an error:
  `Error: --interactive requires a TTY. Use explicit flags for non-interactive environments.`
- Exit with code 1

## Output Format

The interactive flow produces terminal prompts. Final output matches existing scaffold command output:

```
? Select a template type: basic
? Context type: fork
? Agent name (optional, press Enter to skip): code-reviewer
? Include hook configuration examples? (y/N) N
? Use minimal template? (y/N) N
? Skill description (optional, press Enter to skip): Reviews code for best practices
? Argument hint (optional, press Enter to skip): <file-or-directory>
? Allowed tools (comma-separated, press Enter to skip): Read, Glob, Grep
? License (optional, press Enter to skip): MIT
? Compatibility (optional, press Enter to skip):
? Metadata (optional, key=value, press Enter to skip):

Scaffold configuration:
  Name:           my-skill
  Template:       basic
  Context:        fork
  Agent:          code-reviewer
  Description:    Reviews code for best practices
  Argument hint:  <file-or-directory>
  Allowed tools:  Read, Glob, Grep
  License:        MIT

Proceed? (Y/n) Y

Created skill "my-skill" at ~/.claude/skills/my-skill/
Using "basic" template
```

## Non-Functional Requirements

### NFR-1: Performance
- Prompts should appear immediately with no perceptible delay
- Scaffold generation time unchanged from non-interactive mode

### NFR-2: Error Handling
- Handle Ctrl+C gracefully during prompts — display `Scaffold cancelled.` and exit with code 0
- Handle EOF on stdin — same as Ctrl+C behavior
- Validate text inputs (e.g., agent name should not contain invalid characters)

### NFR-3: Accessibility
- Prompt text should be clear and concise
- Default values should be indicated in prompt text
- All prompts should be navigable with keyboard (arrow keys for selection, Enter to confirm)

### NFR-4: Prompt Library
- Use a well-maintained prompt library compatible with Node.js
- Recommended: `@inquirer/prompts` (modern, ESM-compatible, tree-shakeable)
- Alternative: `inquirer` (established, widely used)

## Dependencies

- FEAT-017 (Agent Template Type) — `--argument-hint` flag must exist before interactive mode can expose it. ~~Agent template, `--memory`, and `--model` flags were removed in CHORE-013.~~
- CHORE-013 (Fix Scaffold Template Schema) — removes agent template and agent-only fields; adds `--license`, `--compatibility`, `--metadata`
- Prompt library: `@inquirer/prompts` (or `inquirer`)
- Existing scaffold command infrastructure (`src/commands/scaffold.ts`)
- Existing template generator (`src/templates/skill-md.ts`)
- Existing scaffold API (`src/api/scaffold.ts`)

## Edge Cases

1. **Ctrl+C during prompts**: Exit gracefully with message, no partial files created
2. **Non-TTY environment**: Error with helpful message suggesting explicit flags
3. **`--interactive` with conflicting template flags**: Warn and ignore the template flags
4. **User declines summary confirmation**: Restart prompt flow from the beginning
5. **Empty skill name with `--interactive`**: Still require `<name>` as positional argument (do not prompt for name)
6. **`--interactive` combined with `--project`/`--personal`**: These output-location flags are respected alongside interactive mode
7. **Very long description input**: Accept as-is — let the template generator handle truncation if needed
8. **Argument hint over 200 characters**: Display inline validation error and re-prompt
9. ~~**`agent` template selected**: Memory defaults to `project`, model defaults to `sonnet`, hooks prompt is skipped~~ (Removed by CHORE-013)

## Testing Requirements

### Unit Tests
- TTY detection logic
- Flag conflict detection and warning (including `--argument-hint`, `--license`, `--compatibility`, `--metadata`)
- Prompt flow produces correct `TemplateOptions` for each template type
- Conditional prompt logic (e.g., hooks prompt skipped for `with-hooks` and `internal` templates)
- Argument hint input validates 200-character max length
- License, compatibility, and metadata prompts produce correct options
- Summary display formatting includes argument hint, license, compatibility, and metadata when set

### Integration Tests
- Full interactive flow produces valid skill directory
- Generated skill passes `asm validate`
- Flag override warning displayed when conflicting flags provided
- Non-TTY fallback produces correct error

### Manual Testing
- Run `asm scaffold test-skill -i` and walk through all prompts
- Verify each template type (`basic`, `forked`, `with-hooks`, `internal`) produces correct output
- Verify license, compatibility, and metadata prompts work correctly
- Test Ctrl+C at each prompt stage
- Test in non-TTY environment (e.g., `echo | asm scaffold test-skill -i`)
- Test `--interactive` combined with `--project` and `--force`

## Future Enhancements

- Prompt for skill name if not provided as a positional argument
- Preset profiles (e.g., `--interactive --preset security-audit`)
- Remember last-used selections
- Multi-select for allowed tools from a predefined list

## Acceptance Criteria

- [x] `--interactive` / `-i` flag is accepted by `asm scaffold`
- [x] Interactive prompts guide user through template type, context, agent, hooks, minimal, description, argument hint, allowed tools, license, compatibility, and metadata
- ~~[x] `agent` template type is available in template selection~~ (Removed by CHORE-013)
- ~~[x] Memory and model prompts default to populated values for `agent` template~~ (Removed by CHORE-013)
- [x] Argument hint input validates max length of 200 characters
- [x] Conditional prompts are skipped when not applicable to the selected template
- [x] Configuration summary is displayed before scaffold generation
- [x] Generated skill matches what would be produced with equivalent explicit flags
- [x] Works when combined with `<name>`, `--project`, `--personal`, `--output`, `--force`
- [x] Warning displayed when `--interactive` is combined with template-content flags
- [x] Falls back gracefully with error message if stdin is not a TTY
- [x] Ctrl+C during prompts exits cleanly without partial files
- [x] Help text documents the `--interactive` / `-i` flag
- [x] Tests cover prompt flow logic and edge cases
- [x] License, compatibility, and metadata prompts added to interactive flow (CHORE-013)
