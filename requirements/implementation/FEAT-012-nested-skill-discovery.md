# Implementation Plan: Nested Skill Discovery

## Overview

This plan implements support for discovering skills in nested `.claude/skills` directories within subdirectories, inspired by Claude Code 2.1.6's automatic discovery behavior. The feature adds `--recursive` and `--depth` options to the `asm list` command.

### Relationship to Claude Code 2.1.6

Claude Code 2.1.6 introduced automatic, context-dependent discovery: skills in nested `.claude/skills` directories are discovered "when working with files in subdirectories" ([CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)). While the changelog doesn't specify the intended use case, this feature is likely designed for monorepos and multi-project workspaces.

ASM takes a different approach—explicit CLI flags (`--recursive`, `--depth`) that give users direct control over nested discovery. This design choice:

- Maintains backwards compatibility (default behavior unchanged)
- Provides predictable, user-controlled scanning scope
- Enables integration into scripts and CI workflows with consistent behavior

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-012   | [#34](https://github.com/lwndev/ai-skills-manager/issues/34) | [FEAT-012-nested-skill-discovery.md](../features/FEAT-012-nested-skill-discovery.md) | High | Medium | ✅ Complete |

## Recommended Build Sequence

### Phase 1: Core Types and Directory Traversal
**Feature:** [FEAT-012](../features/FEAT-012-nested-skill-discovery.md) | [#34](https://github.com/lwndev/ai-skills-manager/issues/34)
**Status:** ✅ Complete

#### Rationale
- **Foundation first**: Types must be defined before implementing logic
- **Traversal is the core challenge**: Efficient, safe directory walking is the heart of this feature
- **Enables testing**: Once traversal works, subsequent phases can be tested independently
- **Reusable utility**: The nested directory scanner can be used by other features in the future

#### Implementation Steps
1. Add `location` field to `InstalledSkill` type in `src/types/api.ts`
   - Type: `string` (optional for backwards compatibility)
   - Contains relative path from project root (e.g., `packages/api/.claude/skills/my-skill`)
2. Add `RecursiveListOptions` extending `ListOptions` in `src/types/api.ts`:
   - `recursive?: boolean` - Enable nested directory discovery
   - `depth?: number` - Maximum depth to traverse (default: 3)
3. Create `src/utils/nested-discovery.ts` with:
   - `findNestedSkillDirectories(rootDir: string, maxDepth: number): AsyncGenerator<string>`
   - Iterative stack-based traversal (matches existing `file-enumerator.ts` pattern)
   - Skip hidden directories (except `.claude`)
   - Skip common build/dependency directories (hardcoded: `node_modules`, `dist`, `build`, `.git`, `vendor`, `coverage`, `__pycache__`)
   - Respect `maxDepth` parameter
   - Handle symlink loops using visited set with inode tracking
   - Yield absolute paths to `.claude/skills` directories found
4. Write unit tests for `nested-discovery.ts`:
   - Depth limiting (0, 1, 2, 3)
   - Skipping hidden directories
   - Skipping hardcoded ignore patterns
   - Symlink loop detection
   - Permission denied handling (continue scanning)

#### Deliverables
- [x] Updated `src/types/api.ts` with `location` field and recursive options
- [x] New `src/utils/nested-discovery.ts` - nested directory scanner
- [x] New `tests/unit/utils/nested-discovery.test.ts` - unit tests (28 tests)

---

### Phase 2: Gitignore Support
**Feature:** [FEAT-012](../features/FEAT-012-nested-skill-discovery.md) | [#34](https://github.com/lwndev/ai-skills-manager/issues/34)
**Status:** ✅ Complete

#### Rationale
- **Builds on Phase 1**: Extends the directory traversal with pattern filtering
- **Performance optimization**: Skipping gitignored directories prevents scanning large `node_modules` trees
- **User expectation**: Developers expect gitignored paths to be excluded
- **Separate phase**: Allows core functionality to work without this dependency

#### Implementation Steps
1. Add `ignore` package as a dependency (`npm install ignore`)
2. Create `src/utils/gitignore-parser.ts` with:
   - `loadGitignore(projectRoot: string): Promise<Ignore | null>`
   - Read and parse `.gitignore` from project root
   - Return null if no `.gitignore` exists (graceful degradation)
   - Cache result for performance (single load per operation)
3. Update `nested-discovery.ts` to accept optional `Ignore` instance:
   - `findNestedSkillDirectories(rootDir, maxDepth, ignore?)`
   - Test each directory path against ignore patterns before descending
   - Convert absolute paths to relative for pattern matching
4. Write unit tests for gitignore integration:
   - Standard patterns (`node_modules/`, `dist/`)
   - Negation patterns (`!important/`)
   - Nested `.gitignore` files (optional future enhancement, not required)
   - Missing `.gitignore` file handling

#### Deliverables
- [x] New dependency: `ignore` package (already present v7.0.5)
- [x] New `src/utils/gitignore-parser.ts` - gitignore parsing utility
- [x] Updated `src/utils/nested-discovery.ts` - gitignore integration (done in Phase 1)
- [x] New `tests/unit/utils/gitignore-parser.test.ts` - unit tests (15 tests)
- [x] Updated `tests/unit/utils/nested-discovery.test.ts` - gitignore tests (5 additional tests)

---

### Phase 3: API Integration
**Feature:** [FEAT-012](../features/FEAT-012-nested-skill-discovery.md) | [#34](https://github.com/lwndev/ai-skills-manager/issues/34)
**Status:** ✅ Complete

#### Rationale
- **Core API update**: The `list()` function is the public interface
- **Maintains backwards compatibility**: Default behavior unchanged without `--recursive`
- **Populates location field**: Skills from nested directories need location tracking
- **Foundation for CLI**: Command layer depends on this working

#### Implementation Steps
1. Update `list()` function signature in `src/api/list.ts`:
   - Accept `recursive` and `depth` options
   - Preserve existing behavior when `recursive` is false/undefined
2. Implement nested discovery in `list()`:
   - When `recursive: true` and `scope` includes `'project'`:
     - Load gitignore patterns from project root
     - Call `findNestedSkillDirectories()` with depth limit
     - For each found `.claude/skills` directory, call existing `listSkillsInDirectory()`
     - Set `location` field to relative path from project root
   - Personal scope (`~/.claude/skills`) is never recursively scanned (no nested projects in home)
3. Update `listSkillsInDirectory()` to accept optional `relativePath` parameter:
   - When provided, populate `location` field on returned skills
   - Compute relative location: `path.join(relativePath, skillName)`
4. Handle duplicate skill names:
   - Do NOT deduplicate (same name in different locations is valid)
   - Skills differentiated by `location` field
5. Write integration tests:
   - Non-recursive mode unchanged
   - Recursive discovery finds nested skills
   - Location field populated correctly
   - Duplicate names in different locations preserved

#### Deliverables
- [x] Updated `src/api/list.ts` - recursive discovery implementation
- [x] New `tests/integration/api/list-recursive.test.ts` - integration tests (16 tests)
- [x] Existing `tests/unit/api/list.test.ts` - unit tests already passing (no changes needed)

---

### Phase 4: CLI Command Updates
**Feature:** [FEAT-012](../features/FEAT-012-nested-skill-discovery.md) | [#34](https://github.com/lwndev/ai-skills-manager/issues/34)
**Status:** ✅ Complete

#### Rationale
- **User-facing interface**: CLI is how users interact with the feature
- **Output formatting**: Grouped output makes nested skills readable
- **Final integration point**: Connects API to user experience

#### Implementation Steps
1. Update `registerListCommand()` in `src/commands/list.ts`:
   - Add `-r, --recursive` option (boolean, default: false)
   - Add `-d, --depth <number>` option (integer, default: 3)
   - Add validation: depth must be 0-10, only valid with `--recursive`
2. Update `handleList()` to pass new options to API:
   - Pass `recursive` and `depth` to `list()` call
3. Update `formatNormalOutput()` for recursive mode:
   - Group skills by their `location` path
   - Show location path in section headers (e.g., `Project skills (packages/api/.claude/skills/):`)
   - Sort groups: root first, then alphabetically by location
4. Update JSON output:
   - Include `location` field in each skill object
   - No structural changes needed (already an array)
5. Update quiet mode:
   - Continue showing just skill names (behavior unchanged)
   - Consider future enhancement: `skill-name@location` format (out of scope for now)
6. Update help text with new options and examples:
   - Document `--recursive` and `--depth` options
   - Add examples from requirements doc
7. Write CLI tests:
   - Command parsing for new options
   - Depth validation
   - Output format verification

#### Deliverables
- [x] Updated `src/commands/list.ts` - new options and output formatting
- [x] New `tests/commands/list-recursive.test.ts` - CLI integration tests (20 tests)
- [x] Help text updated with recursive options and examples

---

### Phase 5: Performance and Edge Cases
**Feature:** [FEAT-012](../features/FEAT-012-nested-skill-discovery.md) | [#34](https://github.com/lwndev/ai-skills-manager/issues/34)
**Status:** ✅ Complete

#### Rationale
- **Production readiness**: Edge cases must be handled gracefully
- **Performance validation**: Must meet <5 second requirement
- **Robustness**: Handle real-world directory structures

#### Implementation Steps
1. Add symlink loop detection improvements:
   - Track visited directories by device + inode (not just path)
   - Handle cross-filesystem symlinks
2. Add permission error handling:
   - Log warning (via existing output utilities) and continue on EACCES/EPERM
   - Don't fail entire operation for one inaccessible directory
3. Add depth limit warning:
   - If max depth reached and subdirectories exist, warn user
   - Suggest increasing `--depth` if needed
4. Performance testing:
   - Create test fixture with 1000 directories
   - Verify completion within 5 seconds
   - Profile and optimize if needed (consider parallel stat calls)
5. Edge case testing:
   - Empty `.claude/skills` directories (include, show zero skills)
   - `.claude/skills` inside gitignored path (must be skipped)
   - Case-insensitive filesystem handling (already covered by existing code)
   - Workspace root without `.claude/skills` (still scan nested)

#### Deliverables
- [x] `src/utils/nested-discovery.ts` - symlink and permission handling already implemented in Phase 1
- [x] New `tests/performance/nested-discovery.perf.test.ts` - performance validation (6 tests)
- [x] Edge cases already covered in existing tests (symlink loops, permission errors, broken symlinks)

---

## Shared Infrastructure

### New Utilities
1. **Nested Discovery** (`src/utils/nested-discovery.ts`)
   - Async generator for directory traversal
   - Follows existing `file-enumerator.ts` patterns
   - Reusable for future recursive operations

2. **Gitignore Parser** (`src/utils/gitignore-parser.ts`)
   - Wrapper around `ignore` package
   - Project-root aware loading
   - Graceful degradation when no `.gitignore`

### Type Extensions
- `InstalledSkill.location` - relative path for nested skills
- `ListOptions.recursive` - enable nested discovery
- `ListOptions.depth` - maximum traversal depth

---

## Testing Strategy

### Unit Tests
- Directory traversal with depth limiting
- Gitignore pattern matching
- Hidden directory skipping
- Symlink loop detection
- Location path formatting

### Integration Tests
- End-to-end list with recursive flag
- Mock monorepo structure with nested `.claude/skills`
- JSON output format verification
- Backwards compatibility (non-recursive unchanged)

### Performance Tests
- 1000 directory structure scan
- Target: <5 seconds completion

### Manual Testing
- Real monorepo with pnpm workspaces
- macOS case-insensitive filesystem
- Large `node_modules` skipping verification

---

## Dependencies and Prerequisites

### New Dependencies
- `ignore` (^5.x) - Gitignore pattern matching

### Existing Dependencies (Utilized)
- `fs/promises` - Async filesystem operations
- `path` - Path manipulation

### Code Dependencies
- `src/api/list.ts` - Extend existing list API
- `src/commands/list.ts` - Extend existing list command
- `src/utils/scope-resolver.ts` - Project root resolution
- `src/utils/frontmatter-parser.ts` - Skill metadata extraction

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Performance degradation on large repos | High | Medium | Default depth limit (3), gitignore respect, hardcoded skip patterns |
| Symlink loops causing infinite traversal | High | Low | Device+inode tracking, visited set |
| Breaking existing behavior | High | Low | Non-recursive default, extensive backwards compatibility tests |
| Permission errors failing entire scan | Medium | Medium | Continue on error, warn user, return partial results |
| Gitignore edge cases | Low | Medium | Use well-tested `ignore` package, comprehensive tests |

---

## Success Criteria

### Per-Phase Criteria
- [x] Phase 1: Nested directories discovered correctly with depth limiting
- [x] Phase 2: Gitignored directories skipped
- [x] Phase 3: API returns skills with location field
- [x] Phase 4: CLI displays grouped output with locations
- [x] Phase 5: Edge cases handled, performance acceptable

### Overall Success (from Requirements)
- [x] `asm list --recursive` discovers skills in nested `.claude/skills` directories
- [x] `--depth` option limits search depth correctly
- [x] Skills display with their location paths in output
- [x] Duplicate skill names in different locations handled correctly
- [x] `node_modules` and other gitignored directories skipped
- [x] JSON output includes `location` field for each skill
- [x] Default behavior (without `--recursive`) unchanged
- [x] Performance acceptable for typical monorepos (<5 seconds) - 1000 dirs in 95ms
- [x] Tests pass with >80% coverage
- [x] Documentation updated for new options (help text)

---

## Code Organization

```
src/
├── api/
│   └── list.ts              # Updated with recursive support
├── commands/
│   └── list.ts              # Updated with --recursive, --depth options
├── types/
│   └── api.ts               # Updated with location field, recursive options
└── utils/
    ├── nested-discovery.ts  # NEW: Nested directory traversal
    └── gitignore-parser.ts  # NEW: Gitignore loading utility

tests/
├── unit/
│   ├── api/
│   │   └── list.test.ts     # Updated unit tests
│   └── utils/
│       ├── nested-discovery.test.ts  # NEW
│       └── gitignore-parser.test.ts  # NEW
├── integration/
│   ├── api/
│   │   └── list-recursive.test.ts    # NEW
│   └── commands/
│       └── list-recursive.test.ts    # NEW
└── performance/
    └── nested-discovery.perf.test.ts # NEW
```
