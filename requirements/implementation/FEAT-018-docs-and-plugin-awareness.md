# Implementation Plan: Documentation Updates & Plugin System Awareness

## Overview

This plan updates ASM's user-facing documentation, help text, and template guidance to reflect Claude Code's current behavior: skills/slash-commands unification (v2.1.3), the plugin system (v2.0.12+), auto-approval for simple skills (v2.1.19), and skill size budget awareness (v2.1.32).

This is a text-only feature — no validation, generation logic, or frontmatter changes. All modifications are to help strings, template guidance comments, and test assertions.

The implementation is split into 3 phases: CLI help text updates, template guidance additions, and comprehensive testing.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-018   | [#54](https://github.com/lwndev/ai-skills-manager/issues/54) | [FEAT-018-docs-and-plugin-awareness.md](../features/FEAT-018-docs-and-plugin-awareness.md) | Low | Low | Pending |

## Recommended Build Sequence

### Phase 1: CLI Help Text Updates
**Feature:** [FEAT-018](../features/FEAT-018-docs-and-plugin-awareness.md) | [#54](https://github.com/lwndev/ai-skills-manager/issues/54)
**Status:** ✅ Complete

#### Rationale
- **Low risk, high visibility**: CLI help text is the first thing users see — updating it first ensures the primary term "skill" is established
- **No code dependencies**: Help strings are standalone text with no coupling to template generation
- **Quick verification**: `asm --help`, `asm scaffold --help`, etc. can be tested immediately
- **Establishes terminology baseline**: Ensures consistent language before updating the more detailed template guidance

#### Implementation Steps
1. Update the main CLI description in `src/cli.ts` (line 21):
   - **From:** `'AI Skills Manager - CLI tool for managing Claude Code Agent Skills'`
   - **To:** `'AI Skills Manager (ASM) - Create, validate, and distribute Claude Code skills.\n\nSkills are markdown files that extend Claude Code\'s capabilities, appearing as\nslash commands in the Claude Code interface.'`
2. Update `src/commands/package.ts` help text (lines 61-93) — add a section after "Excluded Files" and before "Exit Codes":
   ```
   Distribution:
     ASM packages (.skill files) are for standalone skill distribution.
     For distribution that includes hooks, MCP servers, or multiple coordinated
     components, consider the Claude Code plugin system instead.
     See: https://code.claude.com/docs/en/plugins
   ```
3. Update `src/commands/list.ts` help text (lines 56-88) — add a note after the "Scopes" section and before "Recursive Discovery":
   ```
   Skills:
     Listed skills correspond to what Claude Code shows in the /skills menu.
     Skills with user-invocable: false are loaded but hidden from this listing.
   ```
4. Review `src/commands/scaffold.ts` help text (lines 38-84) — already uses "skill" consistently; add a note to the existing "Note" section:
   ```
   Skills auto-load from .claude/skills/ directories and appear as slash
   commands in Claude Code.
   ```
5. Scan all error messages in `src/` and `README.md` for standalone "slash command" references — the codebase exploration confirms none exist in either location, so no changes needed

#### Deliverables
- [x] Updated `src/cli.ts` — main CLI description with skills-as-slash-commands explanation
- [x] Updated `src/commands/package.ts` — plugin system distribution note
- [x] Updated `src/commands/list.ts` — /skills menu correspondence note
- [x] Updated `src/commands/scaffold.ts` — skills auto-load note

---

### Phase 2: Template Guidance Updates
**Feature:** [FEAT-018](../features/FEAT-018-docs-and-plugin-awareness.md) | [#54](https://github.com/lwndev/ai-skills-manager/issues/54)
**Status:** ✅ Complete

#### Rationale
- **Core of the feature**: Template guidance is where skill developers spend the most time reading documentation
- **Depends on Phase 1 terminology**: The same "skill" terminology established in Phase 1 should be consistent in templates
- **Five template types to update**: Each needs targeted additions based on its purpose (basic, forked, with-hooks, internal, agent)
- **Minimal templates excluded**: FEAT-016's minimal mode bypasses `generateBody()` entirely, so no minimal-mode changes needed

#### Implementation Steps

**Step 1: Add new guidance sections to `getTemplateGuidance()` in `src/templates/skill-md.ts`**

**Design decision — FR-2 vs FR-6 scope conflict:** FR-2 states DISTRIBUTION OPTIONS "should appear in the guidance block of all verbose templates (not minimal)." However, FR-6's per-template summary table only lists plugin mentions for basic, with-hooks, and agent — omitting forked and internal. This plan follows FR-6's per-template table as the more granular and intentional specification. Forked skills are typically project-internal (no distribution need), and internal skills are helper utilities (not independently distributed). If FR-2's blanket scope is preferred, adding DISTRIBUTION OPTIONS to forked and internal is a trivial addition.

For each template type, add the following targeted sections to the end of its guidance block (before the closing backtick). The exact additions per template:

**Basic template** (default case, lines 456-465) — add auto-approval note, size budget, plugin mention:
```
PERMISSIONS NOTE:
Skills that don't declare additional allowed-tools or hooks are automatically
approved by Claude Code without user confirmation (since v2.1.19). This means
minimal skills load faster with less friction. Only add allowed-tools and hooks
when your skill actually needs them.

SIZE CONSIDERATIONS:
Claude Code allocates approximately 2% of the context window for skill
descriptions. For a 200k token context window, this is ~4000 tokens shared
across ALL loaded skills. Keep your skill's description and body concise
to avoid crowding out other skills. A good target is under 500 lines.

DISTRIBUTION OPTIONS:
Skills can be distributed as ASM packages (.skill files) or as Claude Code
plugins. Plugins support broader distribution including commands, agents,
hooks, and MCP servers via plugin marketplaces. For simple skills, ASM
packages are sufficient. See: https://code.claude.com/docs/en/plugins
```

**Note:** The basic template is the most common starting point, so it gets the fullest guidance. This block is ~19 lines including blank separators, within the NFR-2 target of <20 lines per template.

**Forked template** (lines 242-277) — add auto-approval note and size budget (no plugin mention since forked skills are typically project-internal):
```
PERMISSIONS NOTE:
Skills that don't declare additional allowed-tools or hooks are automatically
approved by Claude Code without user confirmation (since v2.1.19). This means
minimal skills load faster with less friction. Only add allowed-tools and hooks
when your skill actually needs them.

SIZE CONSIDERATIONS:
Claude Code allocates approximately 2% of the context window for skill
descriptions. For a 200k token context window, this is ~4000 tokens shared
across ALL loaded skills. Keep your skill's description and body concise
to avoid crowding out other skills. A good target is under 500 lines.
```

**With-hooks template** (lines 321-408) — add note that hooks opt out of auto-approval, size budget, and plugin mention:
```
PERMISSIONS NOTE:
Skills with hooks are NOT auto-approved — users will be prompted to confirm
before this skill loads (unlike simple skills without hooks, which auto-approve
since v2.1.19). This is expected for hooks since they execute shell commands.

SIZE CONSIDERATIONS:
Claude Code allocates approximately 2% of the context window for skill
descriptions. For a 200k token context window, this is ~4000 tokens shared
across ALL loaded skills. Keep your skill's description and body concise
to avoid crowding out other skills. A good target is under 500 lines.

DISTRIBUTION OPTIONS:
Skills can be distributed in two ways:
1. ASM packages (.skill files) — standalone skill distribution via asm package/install
2. Claude Code plugins — broader distribution including commands, agents, hooks,
   and MCP servers via plugin marketplaces

For skills with hooks or complex multi-component setups, the Claude Code plugin
system may be a better fit than standalone ASM packages.
See: https://code.claude.com/docs/en/plugins
```

**Internal template** (lines 279-319) — add note about /skills visibility:
```
VISIBILITY NOTE:
Skills with user-invocable: false don't appear in the /skills menu in Claude
Code. They are loaded but only accessible to other skills that reference them.

SIZE CONSIDERATIONS:
Claude Code allocates approximately 2% of the context window for skill
descriptions. For a 200k token context window, this is ~4000 tokens shared
across ALL loaded skills. Keep your skill's description and body concise
to avoid crowding out other skills. A good target is under 500 lines.
```

**Agent template** (lines 410-453) — add plugin mention and agent-specific distribution note:
```
PERMISSIONS NOTE:
Agent skills with allowed-tools are NOT auto-approved — users will be prompted
to confirm before this agent loads (since agents typically declare tools).

SIZE CONSIDERATIONS:
Claude Code allocates approximately 2% of the context window for skill
descriptions. For a 200k token context window, this is ~4000 tokens shared
across ALL loaded skills. Keep your skill's description and body concise
to avoid crowding out other skills. A good target is under 500 lines.

DISTRIBUTION OPTIONS:
Skills can be distributed in two ways:
1. ASM packages (.skill files) — standalone skill distribution via asm package/install
2. Claude Code plugins — broader distribution including commands, agents, hooks,
   and MCP servers via plugin marketplaces

For agents that bundle multiple skills, hooks, or MCP servers, consider the
Claude Code plugin system for distribution.
See: https://code.claude.com/docs/en/plugins
```

**Step 2: Verify minimal templates are not affected**

Confirm that `generateMinimalBody()` (lines 491-507) does NOT call `getTemplateGuidance()` — it doesn't, since it only generates `# Name`, `## Overview`, `## Instructions`, `## Examples`. No changes needed.

**Step 3: Review the main guidance block in `generateBody()` (lines 542-616)**

The main HTML comment block already uses "skill" terminology consistently. No "slash command" references exist in this block. No changes needed to the main guidance block itself — the template-specific additions from Step 1 are inserted via `getTemplateGuidance()` which is already embedded in the comment block (line 546).

#### Deliverables
- [x] Updated `src/templates/skill-md.ts` — basic template: auto-approval + size budget + plugin distribution
- [x] Updated `src/templates/skill-md.ts` — forked template: auto-approval + size budget
- [x] Updated `src/templates/skill-md.ts` — with-hooks template: hooks opt-out note + size budget + plugin distribution
- [x] Updated `src/templates/skill-md.ts` — internal template: /skills visibility note + size budget
- [x] Updated `src/templates/skill-md.ts` — agent template: permissions note + size budget + plugin distribution
- [x] Verified minimal templates unaffected

---

### Phase 3: Tests and Verification
**Feature:** [FEAT-018](../features/FEAT-018-docs-and-plugin-awareness.md) | [#54](https://github.com/lwndev/ai-skills-manager/issues/54)
**Status:** ✅ Complete

#### Rationale
- **Depends on Phases 1-2**: All text changes must be in place before testing
- **Snapshot-style verification**: Tests check for presence of specific guidance sections in generated output
- **Backward compatibility**: Existing tests must continue to pass — since we only added text to guidance comments, existing assertions should be unaffected
- **Final gate**: `npm run quality` must pass

#### Implementation Steps
1. Add unit tests to `tests/unit/templates/skill-md.test.ts` for new guidance content:
   - **Terminology test**: Generate all 5 template types (basic, forked, with-hooks, internal, agent) in verbose mode and assert none contain "slash command" as a standalone concept (i.e., not as part of "appearing as slash commands")
   - **Auto-approval in basic**: Generate basic verbose template, assert output contains "auto-approved" or "automatically approved"
   - **Auto-approval in forked**: Generate forked verbose template, assert output contains "auto-approved" or "automatically approved"
   - **Hooks opt-out in with-hooks**: Generate with-hooks verbose template, assert output contains "NOT auto-approved"
   - **Size budget in all verbose**: Generate each template type in verbose mode, assert output contains "2% of the context window" or "SIZE CONSIDERATIONS"
   - **Plugin mention in basic**: Generate basic verbose template, assert output contains "DISTRIBUTION OPTIONS" and "plugin"
   - **Plugin mention in with-hooks**: Generate with-hooks verbose template, assert output contains "DISTRIBUTION OPTIONS" and "plugin"
   - **Plugin mention in agent**: Generate agent verbose template, assert output contains "DISTRIBUTION OPTIONS" and "plugin"
   - **No plugin in forked**: Generate forked verbose template, assert output does NOT contain "DISTRIBUTION OPTIONS"
   - **No plugin in internal**: Generate internal verbose template, assert output does NOT contain "DISTRIBUTION OPTIONS"
   - **Internal visibility note**: Generate internal verbose template, assert output contains "/skills menu" or "user-invocable: false"
   - **Minimal NOT affected**: Generate each template type with `minimal: true`, assert output does NOT contain "PERMISSIONS NOTE", "SIZE CONSIDERATIONS", or "DISTRIBUTION OPTIONS"
2. Add integration tests to verify scaffolded skills with updated guidance still pass validation:
   - Scaffold a basic verbose skill, verify output passes `validate()`
   - Scaffold a with-hooks verbose skill, verify output passes `validate()`
   - All existing scaffold integration tests continue to pass
3. Add CLI help text tests (or update existing ones):
   - In `tests/unit/commands/scaffold.test.ts`: Verify help text contains "auto-load from .claude/skills/"
   - In `tests/unit/commands/package.test.ts` (or equivalent): Verify help text contains "plugin" and "standalone skill distribution"
   - In `tests/unit/commands/list.test.ts` (or equivalent): Verify help text contains "/skills menu"
4. Verify external link `https://code.claude.com/docs/en/plugins` resolves (manual `curl` check or browser verification during manual review)
5. Run `npm run quality` to verify:
   - All tests pass
   - Lint is clean (no unused variables, consistent formatting)
   - Coverage thresholds met
   - No audit failures

#### Deliverables
- [x] Updated `tests/unit/templates/skill-md.test.ts` — terminology, auto-approval, size budget, plugin guidance, minimal exclusion tests
- [x] Updated `tests/unit/commands/scaffold.test.ts` — scaffold help text assertions
- [x] Updated `tests/unit/commands/package.test.ts` — package help text assertions
- [x] Updated `tests/unit/commands/list.test.ts` — list help text assertions
- [x] Updated `tests/integration/api/scaffold.test.ts` — validation still passes with updated guidance
- [x] Verified external link `https://code.claude.com/docs/en/plugins` resolves
- [x] `npm run quality` passes

---

## Shared Infrastructure

### Modified Modules

| Module | Change |
|--------|--------|
| `src/cli.ts` | Updated main CLI description |
| `src/commands/scaffold.ts` | Added skills auto-load note to help text |
| `src/commands/package.ts` | Added plugin system distribution note to help text |
| `src/commands/list.ts` | Added /skills menu correspondence note to help text |
| `src/templates/skill-md.ts` | Added guidance sections to all 5 template types in `getTemplateGuidance()` |

### No New Dependencies
This feature requires no new packages. All changes are text modifications to existing modules.

---

## Testing Strategy

### Unit Tests
- Terminology consistency: no standalone "slash command" in any generated output
- Auto-approval note present in basic and forked verbose templates
- Hooks opt-out note present in with-hooks verbose template
- Size budget warning present in all 5 verbose template types
- Plugin distribution section present in basic, with-hooks, and agent verbose templates
- Plugin distribution section absent from forked and internal verbose templates
- Internal visibility note present in internal verbose template
- Minimal templates: none of the new guidance sections appear
- CLI help text: scaffold contains "auto-load", package contains "plugin", list contains "/skills menu"

### Integration Tests
- Scaffolded skills with updated guidance still pass `asm validate`
- All existing scaffold integration tests continue to pass

### Manual Review
- `asm --help` shows updated description
- `asm scaffold --help` shows auto-load note
- `asm package --help` shows plugin distribution note
- `asm list --help` shows /skills correspondence note
- Read through generated templates for clarity and consistency

---

## Dependencies and Prerequisites

### Code Dependencies
- FEAT-014 (Frontmatter Schema v2) — ✅ Complete — new fields already documented in existing guidance
- FEAT-017 (Agent Template) — ✅ Complete — agent template guidance block exists and will be extended

### Existing Files Modified
- `src/cli.ts` — main CLI entry point (33 lines)
- `src/commands/scaffold.ts` — scaffold command definition (~290 lines)
- `src/commands/package.ts` — package command definition (~200 lines)
- `src/commands/list.ts` — list command definition (~200 lines)
- `src/templates/skill-md.ts` — template generation engine (~634 lines)

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Template guidance becomes too verbose | Medium | Medium | Keep additions concise (<20 lines per template per FR requirement); size budget warning is itself mindful of budget |
| Existing snapshot-style tests break due to text changes | Low | Medium | Tests assert specific content, not exact strings — additions don't remove existing text |
| External links go stale | Low | Low | Link text is descriptive enough to be useful even if URL breaks |
| Help text formatting breaks in narrow terminals | Low | Low | Keep lines under 80 characters; test with `asm --help` visually |

---

## Success Criteria

### Per-Phase Criteria
- [x] Phase 1: All CLI `--help` commands show updated text with consistent "skill" terminology
- [x] Phase 2: All 5 verbose template types include targeted guidance additions; minimal templates unaffected
- [x] Phase 3: All tests pass, `npm run quality` green

### Overall Success (from Requirements)
- [x] "Slash command" not used as a standalone concept in any user-facing text
- [x] "Skill" used as primary term throughout
- [x] Plugin system relationship documented in template guidance
- [x] Auto-approval behavior noted in relevant templates
- [x] Skill size budget warning in all verbose templates
- [x] CLI help text updated for all commands
- [x] Minimal templates not affected by guidance additions
- [x] All external links are valid
- [x] All existing tests continue to pass
- [x] `npm run quality` passes

---

## Code Organization

```
src/
├── cli.ts                     # MODIFY: main description (FR-5)
├── commands/
│   ├── scaffold.ts            # MODIFY: help text auto-load note (FR-5)
│   ├── package.ts             # MODIFY: help text plugin distribution note (FR-5)
│   └── list.ts                # MODIFY: help text /skills menu note (FR-5)
└── templates/
    └── skill-md.ts            # MODIFY: getTemplateGuidance() for all 5 types (FR-2, FR-3, FR-4, FR-6)

tests/
├── unit/
│   ├── commands/
│   │   ├── scaffold.test.ts   # UPDATE: scaffold help text assertions
│   │   ├── package.test.ts    # UPDATE: package help text assertions (plugin mention)
│   │   └── list.test.ts       # UPDATE: list help text assertions (/skills menu)
│   └── templates/
│       └── skill-md.test.ts   # UPDATE: guidance content tests, terminology tests, minimal exclusion tests
└── integration/
    └── api/
        └── scaffold.test.ts   # UPDATE: validation still passes with updated guidance
```
