# Implementation Plan: Discovery Gitignore Alignment

## Overview

This plan removes `.gitignore` filtering from ASM's recursive skill discovery (`asm list --recursive`), aligning with Claude Code v2.0.28+ behavior where skill discovery does not respect `.gitignore`. The change also reduces the hardcoded skip list to only `node_modules` and `.git`, and removes the `ignore` package dependency.

This is a behavioral correction to FEAT-012's Phase 2 (Gitignore Support), which is now being reversed to match Claude Code's updated discovery semantics.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-015   | [#53](https://github.com/lwndev/ai-skills-manager/issues/53) | [FEAT-015-discovery-gitignore-alignment.md](../features/FEAT-015-discovery-gitignore-alignment.md) | Medium | Low | Pending |

## Recommended Build Sequence

### Phase 1: Remove Gitignore Integration from Discovery
**Feature:** [FEAT-015](../features/FEAT-015-discovery-gitignore-alignment.md) | [#53](https://github.com/lwndev/ai-skills-manager/issues/53)
**Status:** ✅ Complete

#### Rationale
- **Core behavioral change**: The gitignore filtering in `nested-discovery.ts` and the `loadGitignore()` call in `list.ts` are the primary code paths to modify
- **Reduces the hardcoded skip list**: Only `node_modules` and `.git` remain — `dist`, `build`, `vendor`, `coverage`, and `__pycache__` are removed since they could legitimately contain `.claude/skills`
- **Removes the `ignore` type dependency from traversal**: The `Ignore` type import and optional `ignore` parameter in `DiscoveryOptions` are no longer needed

#### Implementation Steps
1. Update `HARDCODED_SKIP_DIRS` in `src/utils/nested-discovery.ts` (line 18-26):
   - Remove `dist`, `build`, `vendor`, `coverage`, `__pycache__` from the set
   - Keep only `node_modules` and `.git`
2. Remove the `Ignore` type import from `src/utils/nested-discovery.ts` (line 12)
3. Remove the `ignore` property from the `DiscoveryOptions` interface in `src/utils/nested-discovery.ts`
4. Remove the gitignore check block in `findNestedSkillDirectories()` (approximately lines 218-224 — the `if (options?.ignore)` block)
5. Update `listProjectSkillsRecursively()` in `src/api/list.ts` (lines 283-289):
   - Remove the `loadGitignore()` call (line 284)
   - Remove the `ignore: ignore ?? undefined` option from `collectNestedSkillDirectories()` call (line 288)
6. Remove the `loadGitignore` import from `src/api/list.ts` (line 24)

#### Deliverables
- [x] Updated `src/utils/nested-discovery.ts` — reduced skip list, removed gitignore integration
- [x] Updated `src/api/list.ts` — removed `loadGitignore()` call and import

---

### Phase 2: Remove Gitignore Parser and Dependency
**Feature:** [FEAT-015](../features/FEAT-015-discovery-gitignore-alignment.md) | [#53](https://github.com/lwndev/ai-skills-manager/issues/53)
**Status:** ✅ Complete

#### Rationale
- **Dead code removal**: With gitignore integration removed in Phase 1, the `gitignore-parser.ts` utility and the `ignore` package are unused
- **Cleaner dependency footprint**: Removing `ignore` from `package.json` reduces the attack surface and dependency maintenance burden
- **Separate phase**: Isolates the dependency removal from the behavioral change, making review clearer

#### Implementation Steps
1. Delete `src/utils/gitignore-parser.ts` (83 lines — entire file)
2. Delete `tests/unit/utils/gitignore-parser.test.ts` (the dedicated test file for the deleted utility)
3. Remove `ignore` from `dependencies` in `package.json`
4. Run `npm install` to update `package-lock.json`
5. Verify no remaining imports of `gitignore-parser` or `ignore` in `src/`:
   - `grep -r "gitignore-parser" src/` should return nothing
   - `grep -r "from 'ignore'" src/` should return nothing

#### Deliverables
- [x] Deleted `src/utils/gitignore-parser.ts`
- [x] Deleted `tests/unit/utils/gitignore-parser.test.ts`
- [x] Updated `package.json` — `ignore` dependency removed
- [x] Updated `package-lock.json` — lock file reflects removal

---

### Phase 3: Update Tests for New Behavior
**Feature:** [FEAT-015](../features/FEAT-015-discovery-gitignore-alignment.md) | [#53](https://github.com/lwndev/ai-skills-manager/issues/53)
**Status:** Pending

#### Rationale
- **Tests must reflect the new behavior**: Existing tests assert gitignore filtering works — these need to be removed or inverted
- **New tests verify the change**: Explicitly test that directories previously skipped by `.gitignore` are now discovered
- **Skip list tests need updating**: Tests asserting `dist`, `build`, `vendor` are skipped must be removed or inverted
- **Final phase**: Ensures all tests pass before declaring the feature complete

#### Implementation Steps
1. Update `tests/unit/utils/nested-discovery.test.ts`:
   - **Remove** the entire "gitignore integration" test group (~7 tests) that test the `ignore` option
   - **Remove** individual skip-pattern tests for `dist`, `build`, `vendor`, `coverage`, `__pycache__`
   - **Add** tests verifying `dist`, `build`, `vendor` directories ARE traversed (not skipped)
   - **Add** test verifying discovery does not read `.gitignore` files (no filesystem access to `.gitignore`)
   - **Keep** tests for `node_modules` and `.git` skipping (these remain hardcoded)
   - **Keep** all depth limiting, symlink, permission, and async generator tests (unchanged)
2. Update `tests/performance/nested-discovery.perf.test.ts`:
   - Remove any gitignore-related performance tests or fixture setup
   - Verify performance tests still pass with the reduced skip list
3. Update `tests/integration/api/list-recursive.test.ts`:
   - Remove or update any tests that assert gitignore filtering behavior
   - Add integration test: create a directory that would match `.gitignore` with `.claude/skills`, verify it's discovered
4. Update `tests/commands/list-recursive.test.ts`:
   - Remove or update any CLI tests that depend on gitignore filtering
5. Run `npm run quality` to verify:
   - All tests pass
   - Lint passes
   - Coverage remains above threshold

#### Deliverables
- [ ] Updated `tests/unit/utils/nested-discovery.test.ts` — gitignore tests removed, new no-gitignore tests added
- [ ] Updated `tests/performance/nested-discovery.perf.test.ts` — gitignore references removed
- [ ] Updated `tests/integration/api/list-recursive.test.ts` — behavior aligned
- [ ] Updated `tests/commands/list-recursive.test.ts` — behavior aligned
- [ ] `npm run quality` passes

---

## Shared Infrastructure

### Modified Utilities
1. **Nested Discovery** (`src/utils/nested-discovery.ts`)
   - Reduced `HARDCODED_SKIP_DIRS` set: `node_modules`, `.git` only
   - Removed `ignore` option from `DiscoveryOptions`
   - Removed gitignore check in traversal loop

### Removed Utilities
1. **Gitignore Parser** (`src/utils/gitignore-parser.ts`) — deleted entirely

### Removed Dependencies
1. **`ignore` package** — removed from `package.json`

---

## Testing Strategy

### Unit Tests
- Discovery finds `.claude/skills` in `dist/`, `build/`, `vendor/` directories
- Discovery still skips `node_modules` and `.git`
- No `.gitignore` file is read during discovery
- Depth limiting still works correctly
- Symlink loop detection unchanged
- Permission error handling unchanged

### Integration Tests
- Create test fixture with a directory that would match `.gitignore` containing `.claude/skills`
- Verify skill is discovered with `--recursive`
- Verify `node_modules/.claude/skills` is still skipped
- Non-recursive discovery unchanged

### Performance Tests
- Existing performance tests updated to reflect reduced skip list
- Verify completion within 5 seconds for large directory trees

---

## Dependencies and Prerequisites

### Removed Dependencies
- `ignore` (^7.0.5) — gitignore pattern matching, no longer needed

### Code Dependencies
- FEAT-012 (Nested Skill Discovery) — this feature modifies FEAT-012's implementation

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Users see unexpected skills from previously-hidden directories | Low | Medium | This is the intended behavior change; matches Claude Code v2.0.28+ |
| Scanning more directories degrades performance | Low | Low | Depth limit (default 3) bounds traversal; removing gitignore parsing is itself a performance improvement |
| Removing `dist`/`build`/`vendor` from skip list causes noise | Low | Low | These directories rarely contain `.claude/skills`; depth limit prevents deep scanning |
| Test coverage drops below threshold | Medium | Low | Replace removed gitignore tests with equivalent no-gitignore tests |

---

## Success Criteria

### Per-Phase Criteria
- [ ] Phase 1: Gitignore integration removed from discovery and API paths
- [ ] Phase 2: `gitignore-parser.ts` deleted, `ignore` package removed
- [ ] Phase 3: All tests updated, `npm run quality` passes

### Overall Success (from Requirements)
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

---

## Code Organization

```
src/
├── api/
│   └── list.ts                # MODIFY: remove loadGitignore() call
├── commands/
│   └── list.ts                # NO CHANGE
├── types/
│   └── api.ts                 # NO CHANGE
└── utils/
    ├── nested-discovery.ts    # MODIFY: reduce skip list, remove ignore option
    └── gitignore-parser.ts    # DELETE

tests/
├── unit/
│   └── utils/
│       ├── nested-discovery.test.ts  # UPDATE: remove gitignore tests, add new tests
│       └── gitignore-parser.test.ts  # DELETE
├── integration/
│   └── api/
│       └── list-recursive.test.ts    # UPDATE: align with new behavior
├── commands/
│   └── list-recursive.test.ts        # UPDATE: align with new behavior
└── performance/
    └── nested-discovery.perf.test.ts  # UPDATE: remove gitignore references
```
