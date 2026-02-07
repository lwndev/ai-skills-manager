# Feature Requirements: Documentation Updates & Plugin System Awareness

## Overview

Update ASM's user-facing documentation, help text, and template guidance to reflect Claude Code's skills/slash-commands unification (v2.1.3), the plugin system (v2.0.12+), auto-approval behavior for simple skills (v2.1.19), and skill size budget awareness (v2.1.32).

This is a documentation and terminology feature — no validation or template generation logic changes, only text updates.

## Feature ID

`FEAT-018`

## GitHub Issues

- https://github.com/lwndev/ai-skills-manager/issues/54

## Priority

Low — Improves clarity and correctness of documentation but does not affect functionality

## Changelog References

| Version | Change |
|---------|--------|
| v2.1.32 | Skill character budget scales with context window (2% of context) |
| v2.1.19 | Skills without additional permissions or hooks allowed without approval |
| v2.1.3  | Merged slash commands and skills into unified model |
| v2.0.12 | Plugin system released (commands, agents, hooks, MCP servers from marketplaces) |
| v2.0.12 | Repository-level plugin config via `extraKnownMarketplaces` |

## User Story

As a skill developer reading ASM's help text and template guidance, I want the terminology and guidance to accurately reflect Claude Code's current behavior so that I'm not confused by outdated references to "slash commands" as a separate concept or unaware of the plugin system as an alternative distribution mechanism.

## Functional Requirements

### FR-1: Skills/Slash-Commands Unification Terminology

Update all user-facing text to reflect that skills and slash commands are now the same thing (v2.1.3):

**Affected locations:**
- CLI `--help` text for all commands
- Template guidance comments (HTML comment blocks in SKILL.md)
- Error messages that reference "skills" or "slash commands"
- README.md if it references the distinction

**Rules:**
- Use "skill" as the primary term
- Where the unified concept needs explanation, use: "Skills (which also appear as slash commands in Claude Code)"
- Remove any language suggesting they are separate systems
- Do not reference "slash commands" as a standalone concept

### FR-2: Plugin System Awareness in Template Guidance

Add a section to template guidance comments explaining the relationship between ASM's `.skill` package format and Claude Code's plugin system:

```markdown
DISTRIBUTION OPTIONS:
Skills can be distributed in two ways:
1. ASM packages (.skill files) — standalone skill distribution via asm package/install
2. Claude Code plugins — broader distribution including commands, agents, hooks,
   and MCP servers via plugin marketplaces

For simple skill-only distribution, ASM packages are sufficient.
For distribution that includes hooks, MCP servers, or multiple coordinated
components, consider the Claude Code plugin system instead.
See: https://code.claude.com/docs/en/plugins
```

This section should appear in the guidance block of all verbose templates (not minimal).

### FR-3: Auto-Approval Guidance

Update template guidance to note that simple skills are auto-approved:

```markdown
PERMISSIONS NOTE:
Skills that don't declare additional allowed-tools or hooks are automatically
approved by Claude Code without user confirmation (since v2.1.19). This means
minimal skills load faster with less friction. Only add allowed-tools and hooks
when your skill actually needs them.
```

### FR-4: Skill Size Budget Warning

Add guidance about the skill character budget:

```markdown
SIZE CONSIDERATIONS:
Claude Code allocates approximately 2% of the context window for skill
descriptions. For a 200k token context window, this is ~4000 tokens shared
across ALL loaded skills. Keep your skill's description and body concise
to avoid crowding out other skills. A good target is under 500 lines.
```

### FR-5: Update CLI Help Text

Update the main CLI help text and individual command descriptions:

**Main help (`asm --help`):**
```
AI Skills Manager (ASM) - Create, validate, and distribute Claude Code skills.

Skills are markdown files that extend Claude Code's capabilities, appearing as
slash commands in the Claude Code interface.
```

**`asm scaffold --help`:**
- Reference "skill" consistently (not "skill/slash command")
- Mention that skills auto-load from `.claude/skills/` directories

**`asm package --help`:**
- Note that `.skill` packages are for standalone skill distribution
- Mention plugin system as an alternative for complex distributions

**`asm list --help`:**
- Note that listed skills correspond to what Claude Code shows in `/skills`

### FR-6: Template Guidance Updates Summary

Update all template type guidance blocks with:

| Template | Additions |
|----------|-----------|
| `basic` | Auto-approval note, size budget, plugin mention |
| `forked` | Auto-approval note, size budget |
| `with-hooks` | Note that hooks opt out of auto-approval, plugin mention |
| `internal` | Note that `user-invocable: false` skills don't appear in `/skills` menu |
| `agent` (FEAT-016) | Plugin mention, agent-specific distribution considerations |

## Non-Functional Requirements

### NFR-1: Accuracy
- All version numbers and behavior descriptions must match the changelog
- Links to external documentation must be valid
- No speculative claims about future Claude Code behavior

### NFR-2: Conciseness
- Guidance additions should be brief and actionable
- Total template size increase should be minimal (target: <20 lines added per template)
- Size budget warning itself should be mindful of the budget it warns about

### NFR-3: Backward Compatibility
- All changes are text-only — no validation or generation logic changes
- Template output changes only affect guidance comments, not frontmatter
- Existing scaffolded skills remain valid

## Dependencies

- FEAT-015 (Frontmatter Schema v2) — new fields must be documented in guidance
- FEAT-016 (Agent Template) — agent template guidance must include these updates

## Edge Cases

1. **Minimal templates (FEAT-014)**: Minimal templates should NOT include the verbose guidance additions — they only have frontmatter and brief body
2. **External documentation links**: Links may go stale — include link text that's useful even if the URL breaks
3. **Version-specific behavior**: Note the minimum Claude Code version when behavior depends on it

## Testing Requirements

### Unit Tests

- Template generation output contains updated terminology
- No instances of "slash command" used as a standalone concept in generated output
- Plugin guidance section present in verbose templates
- Auto-approval note present in templates without hooks
- Size budget warning present in all verbose templates
- Minimal templates do NOT contain verbose guidance additions

### Integration Tests

- Scaffolded skills with updated guidance still pass `asm validate`
- CLI `--help` output uses correct terminology

### Manual Review

- Read through all help text for consistency
- Verify external links resolve
- Confirm guidance is clear and actionable

## Acceptance Criteria

- [ ] "Slash command" not used as a standalone concept in any user-facing text
- [ ] "Skill" used as primary term throughout
- [ ] Plugin system relationship documented in template guidance
- [ ] Auto-approval behavior noted in relevant templates
- [ ] Skill size budget warning in all verbose templates
- [ ] CLI help text updated for all commands
- [ ] Minimal templates not affected by guidance additions
- [ ] All external links are valid
- [ ] All existing tests continue to pass
- [ ] `npm run quality` passes
