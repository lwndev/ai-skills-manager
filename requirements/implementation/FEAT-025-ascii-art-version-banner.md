# Implementation Plan: ASCII Art Version Banner

## Overview
Add a branded ASCII art banner to `asm --version` with version, tagline, website, and license — plus clean up unused spinner/progress constants. This is a single-feature plan split into two phases: the banner implementation and the dead code cleanup.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-025 | [#127](https://github.com/lwndev/ai-skills-manager/issues/127) | [FEAT-025-ascii-art-version-banner.md](../features/FEAT-025-ascii-art-version-banner.md) | Low | Low | Pending |

## Recommended Build Sequence

### Phase 1: Version Banner Formatter and CLI Integration
**Feature:** [FEAT-025](../features/FEAT-025-ascii-art-version-banner.md) | [#127](https://github.com/lwndev/ai-skills-manager/issues/127)
**Status:** ✅ Complete

#### Rationale
- Core deliverable — the banner formatter and CLI wiring must land first
- Establishes the output mode dispatch pattern for `--version` (normal / quiet / JSON / non-TTY)
- All tests depend on the formatter existing

#### Implementation Steps

1. **Create `src/formatters/version-formatter.ts`**
   - Define `ASM_ASCII_ART` string constant with the stylized logo
   - Define `ASM_TAGLINE = 'Create. Validate. Distribute.'`
   - Define `ASM_WEBSITE = 'ai-skills-manager.app'`
   - Define `MIN_BANNER_WIDTH` constant (widest line of the ASCII art + small margin)
   - Implement `formatVersionBanner(version: string, license: string): string`
     - Combines ASCII art + version + tagline + website + license
   - Implement `formatVersionQuiet(version: string): string`
     - Returns plain version string (e.g., `1.8.3`)
   - Implement `formatVersionJSON(version: string, license: string): string`
     - Returns `JSON.stringify({ version, license })`
   - Implement `formatVersionOutput(version: string, license: string, options: { quiet?: boolean; json?: boolean }): string`
     - Dispatcher: JSON → quiet → check TTY and terminal width → banner or fallback to quiet
     - Non-TTY detection: `process.stdout.isTTY`
     - Narrow terminal detection: `process.stdout.columns < MIN_BANNER_WIDTH`

2. **Override `--version` in `src/cli.ts`**
   - Remove the `.version(packageJson.version)` call
   - Add `-V, --version` as a root-level option via `.option('-V, --version', 'Display version')`
   - Add a `.hook('preAction')` or check in a root `.action()` to intercept `--version`
     - Alternative: register a hidden `version` command, or use Commander's `configureOutput` — choose simplest approach during implementation
   - Read `license` field from the already-parsed `packageJson`
   - Call `formatVersionOutput()` with the appropriate options, `console.log()` the result, then `process.exit(0)`

3. **Write unit tests: `tests/unit/formatters/version-formatter.test.ts`**
   - `formatVersionBanner()` returns string containing ASCII art, version, tagline, website, license
   - `formatVersionQuiet()` returns plain version string only
   - `formatVersionJSON()` returns valid JSON with `version` and `license` keys
   - `formatVersionOutput()` with `{ json: true }` delegates to JSON formatter
   - `formatVersionOutput()` with `{ quiet: true }` delegates to quiet formatter
   - `formatVersionOutput()` with neither flag returns banner (mock `process.stdout.isTTY = true` and sufficient `columns`)
   - Non-TTY fallback: mock `process.stdout.isTTY` as `undefined`, expect plain version
   - Narrow terminal fallback: mock `process.stdout.columns` below `MIN_BANNER_WIDTH`, expect plain version
   - Missing/empty license string: returns `Unknown` or omits license line

4. **Update existing integration test in `tests/integration/scaffold.test.ts`**
   - The existing `displays version with --version` test expects `result.toMatch(/\d+\.\d+\.\d+/)` — this will still pass since the banner includes the version string; verify and adjust if needed

5. **Add e2e tests in `tests/e2e/` (existing version test file or new)**
   - `asm --version` output contains version number
   - `asm --version | cat` (piped, non-TTY) outputs plain version only
   - `asm --version -q` outputs plain version only
   - `asm --version -j` outputs valid JSON

6. **Run `npm run quality`** to verify lint, tests, and audit pass

#### Deliverables
- [x] `src/formatters/version-formatter.ts` — banner formatter with normal/quiet/JSON/TTY logic
- [x] `src/cli.ts` — custom `--version` handling replacing Commander default
- [x] `tests/unit/formatters/version-formatter.test.ts` — unit tests (14 tests)
- [x] `tests/e2e/version.e2e.test.ts` — e2e tests (5 tests)
- [x] Integration test verified (scaffold.test.ts `--version` test still passes)

---

### Phase 2: Dead Code Cleanup
**Feature:** [FEAT-025](../features/FEAT-025-ascii-art-version-banner.md) | [#127](https://github.com/lwndev/ai-skills-manager/issues/127)
**Status:** Pending

#### Rationale
- Isolated cleanup that doesn't affect banner functionality
- Separate phase keeps the banner PR reviewable on its own
- Low risk — constants are confirmed unused (never referenced outside their declarations)

#### Implementation Steps

1. **Verify no references to the target constants**
   - Grep for `SPINNER_FRAMES`, `PROGRESS_BAR_WIDTH`, `PROGRESS_FILLED_CHAR`, `PROGRESS_EMPTY_CHAR` across the entire codebase
   - Confirm they appear only in `src/formatters/update-formatter.ts` declarations

2. **Remove from `src/formatters/update-formatter.ts`**
   - Delete the `SPINNER_FRAMES` constant (line 55)
   - Delete `PROGRESS_BAR_WIDTH`, `PROGRESS_FILLED_CHAR`, `PROGRESS_EMPTY_CHAR` constants (lines 60-62)
   - Delete associated JSDoc comments (lines 52-54, 57-59)

3. **Run `npm run quality`** to confirm no breakage

#### Deliverables
- [ ] `src/formatters/update-formatter.ts` — unused constants removed
- [ ] All existing tests still pass

---

## Shared Infrastructure
None — this feature is self-contained. The version formatter follows the same dispatcher pattern used by existing formatters (`validate-formatter.ts`, `install-formatter.ts`) but doesn't share code with them.

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | Formatter functions in isolation | `vitest` — mock `process.stdout.isTTY` and `process.stdout.columns` |
| Integration | CLI invocation via `execSync` | Existing `scaffold.test.ts` pattern — invoke `node cliPath --version` |
| E2E | Full build + invoke | `node dist/cli.js --version`, piped output, `-q`, `-j` flags |
| Cleanup | No regressions from constant removal | `npm run quality` — existing test suite |

## Dependencies and Prerequisites
- `commander` (already installed) — need to confirm the approach for overriding default `--version` behavior works cleanly with the installed version
- No new dependencies

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Commander `.version()` override breaks `-V` flag registration | Med | Low | Test early; fallback to Commander's `configureOutput` or a hidden subcommand |
| ASCII art looks broken in some terminal emulators | Low | Low | Use simple ASCII characters only (no Unicode box-drawing); test in multiple terminals |
| Removing unused constants breaks something unexpected | Low | Very Low | Grep-verify zero references before removal; run full test suite |

## Success Criteria
- `asm --version` displays branded ASCII art with version, tagline, website, and license
- Quiet, JSON, non-TTY, and narrow-terminal modes all produce appropriate fallback output
- No new runtime dependencies
- `npm run quality` passes
- Unused spinner/progress constants removed from `update-formatter.ts`

## Code Organization
```
src/
├── cli.ts                          # Modified — custom --version handling
└── formatters/
    ├── version-formatter.ts        # New — banner art + output mode dispatch
    └── update-formatter.ts         # Modified — dead code removal

tests/
├── unit/formatters/
│   └── version-formatter.test.ts   # New — unit tests
├── integration/
│   └── scaffold.test.ts            # Verify existing --version test still passes
└── e2e/
    └── (version tests)             # New or extended — e2e version output tests
```
