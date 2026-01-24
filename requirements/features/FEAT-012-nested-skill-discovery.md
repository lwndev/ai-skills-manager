# Feature Requirements: Nested Skill Discovery

## Overview

Update ASM's skill discovery to support nested `.claude/skills` directories within subdirectories, matching Claude Code 2.1.6's behavior for monorepos and multi-project workspaces.

## Feature ID

`FEAT-012`

## GitHub Issue

[#34](https://github.com/lwndev/ai-skills-manager/issues/34)

## Priority

High - Compatibility with Claude Code 2.1.6+ behavior

## User Story

As a developer working in a monorepo or multi-project workspace, I want ASM to discover skills in nested `.claude/skills` directories so that I can manage skills scoped to subdirectories (e.g., `packages/foo/.claude/skills/`).

## Command Syntax

No new commands. This feature enhances existing `asm list` behavior.

```bash
asm list [options]
```

### Existing Options (unchanged)

- `--scope <all|project|personal>` - Filter by scope (default: all)
- `--json` - Output as JSON
- `--quiet` - Output skill names only

### New Options

- `--recursive` - Discover skills in nested `.claude/skills` directories (default: false)
- `--depth <number>` - Maximum directory depth to search when using `--recursive` (default: 3)

### Examples

```bash
# List skills including nested directories
asm list --recursive

# Limit search depth for large monorepos
asm list --recursive --depth 2

# JSON output with nested skills
asm list --recursive --json
```

## Functional Requirements

### FR-1: Nested Directory Discovery

- When `--recursive` is enabled, scan for `.claude/skills` directories within subdirectories of the project root
- Discovery should find patterns like:
  - `packages/foo/.claude/skills/`
  - `apps/web/.claude/skills/`
  - `libs/shared/.claude/skills/`
- Respect `.gitignore` patterns when scanning (skip `node_modules`, `dist`, etc.)
- Skip hidden directories (starting with `.`) except for `.claude`

### FR-2: Depth Limiting

- Default maximum depth of 3 directories from project root
- Allow user to override with `--depth` option
- Depth 0 = only root `.claude/skills` (current behavior)
- Depth 1 = root + immediate child directories
- Depth 2 = root + children + grandchildren
- etc.

### FR-3: Skill Location Tracking

- Each discovered skill must include its location path
- Location should be relative to project root for readability
- Example: `packages/api/.claude/skills/api-helpers`

### FR-4: Duplicate Detection

- Detect when the same skill name exists in multiple locations
- Do NOT treat duplicates as errors (this is valid in nested scopes)
- Differentiate duplicates by their location in output and data structures

### FR-5: Updated List Output

- Group skills by location when `--recursive` is used
- Show location path for each skill group
- Maintain backwards compatibility for non-recursive listing

### FR-6: Default Behavior Preservation

- Without `--recursive` flag, behavior is unchanged (only root `.claude/skills`)
- This ensures backwards compatibility

## Output Format

### Normal Output (with `--recursive`)

```
Project skills (.claude/skills/):
  my-skill (v1.0.0)
    A project-level skill

Project skills (packages/api/.claude/skills/):
  api-helpers (v2.1.0)
    Helper skill for API development

Project skills (packages/web/.claude/skills/):
  component-gen (v1.0.0)
    Component generation utilities
  api-helpers (v1.5.0)
    Web-specific API helpers

Personal skills (~/.claude/skills/):
  global-utils (v1.0.0)
    Global utility skill
```

### JSON Output (with `--recursive`)

```json
[
  {
    "name": "my-skill",
    "version": "1.0.0",
    "description": "A project-level skill",
    "scope": "project",
    "location": ".claude/skills/my-skill",
    "path": "/absolute/path/to/.claude/skills/my-skill"
  },
  {
    "name": "api-helpers",
    "version": "2.1.0",
    "description": "Helper skill for API development",
    "scope": "project",
    "location": "packages/api/.claude/skills/api-helpers",
    "path": "/absolute/path/to/packages/api/.claude/skills/api-helpers"
  }
]
```

## Non-Functional Requirements

### NFR-1: Performance

- Discovery should complete within 5 seconds for typical monorepos (<1000 directories)
- Use efficient directory traversal (avoid reading file contents during scan)
- Short-circuit when `.gitignore` patterns match directories

### NFR-2: Error Handling

- Permission denied on subdirectory: Log warning, continue scanning other directories
- Symlink loops: Detect and skip to prevent infinite recursion
- Malformed `.claude/skills` directory: Report issue, continue with other skills

### NFR-3: Gitignore Respect

- Read and parse `.gitignore` at project root
- Skip directories matching ignore patterns
- Always skip common patterns: `node_modules`, `dist`, `build`, `.git`, `vendor`

### NFR-4: Memory Efficiency

- Stream directory entries rather than loading all into memory
- Limit concurrent filesystem operations

## Dependencies

- Existing `list` API in `src/api/list.ts`
- Existing scope resolution in `src/utils/scope-resolver.ts`
- Consider using `ignore` package for `.gitignore` parsing (or similar)

## Edge Cases

1. **Symlink to skill directory**: Follow symlink, but detect loops
2. **Permission denied on nested directory**: Warn and skip, don't fail entirely
3. **Empty `.claude/skills` directory**: Include in scan, show no skills for that location
4. **Deeply nested monorepo**: Respect `--depth` limit, warn if hitting limit
5. **Same skill name in multiple locations**: Show all instances with locations, not an error
6. **Mixed case directory names**: Handle case-insensitive filesystems correctly
7. **`.claude/skills` inside `node_modules`**: Must be skipped (gitignore patterns)
8. **Workspace root has no `.claude/skills`**: Still scan nested directories if `--recursive`

## Testing Requirements

### Unit Tests

- Directory traversal logic with depth limiting
- Gitignore pattern matching
- Duplicate skill detection
- Location path formatting (relative to project root)
- Edge case handling (symlinks, permissions)

### Integration Tests

- Nested skill discovery in mock monorepo structure
- Depth limiting behavior
- Gitignore respect (node_modules skipping)
- JSON output format with locations
- Backwards compatibility (non-recursive mode unchanged)

### Manual Testing

- Test in real monorepo with nested `.claude/skills` directories
- Verify performance on large directory trees
- Test on case-insensitive filesystem (macOS)
- Verify gitignore patterns work correctly

## Future Enhancements

- Add `--include-path` option to filter by path pattern
- Add `--exclude-path` option to skip specific paths
- Workspace-aware discovery (respect npm/pnpm workspaces configuration)
- Watch mode for skill directory changes

## Acceptance Criteria

- [ ] `asm list --recursive` discovers skills in nested `.claude/skills` directories
- [ ] `--depth` option limits search depth correctly
- [ ] Skills display with their location paths in output
- [ ] Duplicate skill names in different locations are handled correctly
- [ ] `node_modules` and other gitignored directories are skipped
- [ ] JSON output includes `location` field for each skill
- [ ] Default behavior (without `--recursive`) is unchanged
- [ ] Performance is acceptable for typical monorepos (<5 seconds)
- [ ] Tests pass with >80% coverage
- [ ] Documentation updated for new options
