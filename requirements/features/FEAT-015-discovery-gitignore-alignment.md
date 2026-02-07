# Feature Requirements: Discovery Gitignore Alignment

## Overview

Update ASM's recursive skill discovery (`asm list --recursive`) to **not** respect `.gitignore` patterns when scanning for `.claude/skills` directories, aligning with Claude Code v2.0.28+ behavior where skill/agent/command discovery does not respect `.gitignore`.

This is a behavioral correction to FEAT-012, which implemented recursive discovery with `.gitignore` filtering. Claude Code changed this behavior in v2.0.28, and ASM should match.

## Feature ID

`FEAT-015`

## GitHub Issues

- https://github.com/lwndev/ai-skills-manager/issues/53

## Priority

Medium — Prevents false negatives where valid skills are missed during discovery

## Changelog Reference

| Version | Change |
|---------|--------|
| v2.0.28 | "Discovery of custom slash commands, subagents, and output styles no longer respects .gitignore" |

## User Story

As a developer using ASM in a monorepo, I want `asm list --recursive` to find all `.claude/skills` directories regardless of `.gitignore` patterns so that ASM's discovery matches what Claude Code itself discovers.

## Background

FEAT-012 implemented recursive skill discovery with these filtering rules:
- Respect `.gitignore` patterns when scanning
- Always skip `node_modules`, `dist`, `build`, `.git`, `vendor`

However, Claude Code v2.0.28 changed its own discovery behavior to **not** respect `.gitignore`. This means:
- A skill directory inside a `.gitignore`'d path (e.g., `generated/.claude/skills/`) is visible to Claude Code
- But ASM's `asm list --recursive` would skip it

This mismatch causes confusion when ASM reports fewer skills than Claude Code actually loads.

## Functional Requirements

### FR-1: Remove `.gitignore` Filtering from Recursive Discovery

- `asm list --recursive` must NOT read or apply `.gitignore` patterns
- All `.claude/skills` directories found within the depth limit should be reported
- This applies to both project-root `.gitignore` and nested `.gitignore` files

### FR-2: Maintain Hardcoded Skip List

Continue skipping directories that are never valid skill locations:

- `.git` — Git internal directory
- `node_modules` — npm dependencies (may contain `.claude/skills` from packages but these are not project skills)

These are skipped for **performance** and **correctness**, not because of `.gitignore`.

### FR-3: Remove `.gitignore`-Related Dependencies

- Remove `dist`, `build`, `vendor` from the hardcoded skip list (these could legitimately contain `.claude/skills` in some project structures)
- Remove any `.gitignore` parsing logic or `ignore` package dependency if it was added solely for this feature
- If the `ignore` package is used elsewhere, keep it but remove it from the discovery path

### FR-4: Update `--depth` Default Behavior

No change to `--depth` behavior. Default depth of 3 remains appropriate.

### FR-5: Add `--skip-dirs` Option (Optional Enhancement)

Consider adding an option for users who want to exclude specific directories:

```bash
asm list --recursive --skip-dirs node_modules,.git,vendor
```

- Provides user control without coupling to `.gitignore`
- Default skip list: `node_modules`, `.git`
- This requirement is optional — implement only if the removal of `.gitignore` filtering creates real usability issues

## Output Format

No changes to output format. Skills previously hidden by `.gitignore` filtering will now appear in results.

### Before (FEAT-012 behavior)
```
Project skills (.claude/skills/):
  my-skill
    A project-level skill

# generated/.claude/skills/ was skipped because "generated/" is in .gitignore
```

### After (FEAT-015 behavior)
```
Project skills (.claude/skills/):
  my-skill
    A project-level skill

Project skills (generated/.claude/skills/):
  gen-helper
    Generated code helper skill
```

## Non-Functional Requirements

### NFR-1: Performance
- Removing `.gitignore` parsing should slightly improve discovery performance
- Discovery without `.gitignore` filtering may scan more directories, but the depth limit keeps this bounded
- Discovery should still complete within 5 seconds for typical monorepos

### NFR-2: Backward Compatibility
- This is a **behavioral change** — previously skipped directories will now be scanned
- Users may see additional skills in `asm list --recursive` output that were previously hidden
- Non-recursive `asm list` is unaffected

## Dependencies

- FEAT-012 (Nested Skill Discovery) — this feature modifies FEAT-012's implementation

## Edge Cases

1. **`.claude/skills` inside `node_modules`**: Still skipped (hardcoded, not `.gitignore`)
2. **`.claude/skills` inside `dist/` or `build/`**: Now discovered (previously skipped)
3. **`.claude/skills` inside `.git/`**: Still skipped (hardcoded)
4. **Deeply nested directories**: Bounded by `--depth` limit, not `.gitignore`
5. **Very large directory trees**: Depth limit prevents runaway scanning
6. **Symlinked directories**: Existing symlink loop detection remains unchanged

## Testing Requirements

### Unit Tests

- Discovery finds `.claude/skills` in directories that would match `.gitignore`
- Discovery still skips `node_modules` and `.git`
- Discovery does NOT skip `dist`, `build`, `vendor` directories
- Depth limiting still works correctly
- No `.gitignore` file is read during discovery

### Integration Tests

- Create test fixture with `.gitignore`'d directory containing `.claude/skills`
- Verify skill is discovered with `--recursive`
- Verify `node_modules/.claude/skills` is still skipped
- Backward compatibility: non-recursive discovery unchanged

### Update Existing Tests

- Update any FEAT-012 tests that assert `.gitignore` filtering behavior
- Update test fixtures that rely on `.gitignore` patterns hiding skills
- Ensure test coverage remains above threshold

## Acceptance Criteria

- [ ] `asm list --recursive` does NOT read `.gitignore` files
- [ ] `.claude/skills` in `.gitignore`'d directories are discovered
- [ ] `node_modules` and `.git` directories are still skipped
- [ ] `dist`, `build`, `vendor` directories are scanned
- [ ] `--depth` limiting still works correctly
- [ ] Non-recursive `asm list` behavior is unchanged
- [ ] Performance within 5 seconds for typical monorepos
- [ ] Existing FEAT-012 tests updated for new behavior
- [ ] New tests verify `.gitignore` is not applied
- [ ] `npm run quality` passes
