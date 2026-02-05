# Implementation Plan: ASMR Mode CLI Animations

## Overview

This plan outlines the implementation of ASMR Mode, a set of calming, satisfying animations for the AI Skills Manager CLI. ASMR mode provides smooth visual feedback through gentle typing effects, satisfying progress patterns, and soothing completion sequences. The feature is entirely opt-in and maintains full backward compatibility with existing behavior.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-014   | [#48](https://github.com/lwndev/ai-skills-manager/issues/48) | [FEAT-014-cli-animations.md](../features/FEAT-014-cli-animations.md) | Low | Medium | Pending |

## Recommended Build Sequence

### Phase 1: Configuration System
**Feature:** [FEAT-014](../features/FEAT-014-cli-animations.md) | [#48](https://github.com/lwndev/ai-skills-manager/issues/48)
**Status:** ✅ Complete

#### Rationale
- **Foundation first**: All ASMR animations depend on knowing whether ASMR mode is enabled
- **Establishes precedence**: Sets up flag > env > config > default resolution pattern
- **Enables testing**: Other phases can be tested once config is working
- **Terminal detection**: Establishes TTY/piped output detection that gates all animations

#### Implementation Steps
1. Create `src/config/asmr.ts` with types for ASMR configuration:
   - `AsmrConfig` interface: `{ enabled: boolean, theme: string, sounds: boolean }`
   - `AsmrTheme` type for theme names
2. Implement config file loading from `~/.asm/config.json`:
   - Create directory if needed on first write
   - Handle missing file gracefully (use defaults)
   - Validate JSON structure
3. Implement environment variable detection (`ASM_ASMR=1|0`)
4. Add global CLI flags to Commander program in `src/cli.ts`:
   - `--asmr` flag to enable ASMR mode
   - `--no-asmr` flag to disable ASMR mode
5. Implement `resolveAsmrConfig()` function with precedence:
   - CLI flag (highest)
   - Environment variable
   - Config file
   - Default: disabled (lowest)
6. Implement terminal capability detection in `src/utils/terminal.ts`:
   - `isTTY()` - Check `process.stdout.isTTY`
   - `isCI()` - Check `CI` env variable
   - `supportsUnicode()` - Check terminal encoding
   - `getTerminalWidth()` - Get column count
   - `isNoColor()` - Check `NO_COLOR` env variable
7. Create `shouldEnableAnimations()` function combining config + terminal state
8. Write unit tests for config resolution and terminal detection

#### Deliverables
- [x] `src/config/asmr.ts` - ASMR configuration loading and resolution
- [x] `src/utils/terminal.ts` - Terminal capability detection
- [x] `src/types/asmr.ts` - Type definitions for ASMR config
- [x] `tests/unit/config/asmr.test.ts` - Config resolution tests
- [x] `tests/unit/utils/terminal.test.ts` - Terminal detection tests
- [x] Updated `src/cli.ts` with global `--asmr`/`--no-asmr` flags

---

### Phase 2: Animation Utilities Core
**Feature:** [FEAT-014](../features/FEAT-014-cli-animations.md) | [#48](https://github.com/lwndev/ai-skills-manager/issues/48)
**Status:** ✅ Complete

#### Rationale
- **Core animation primitives**: Builds the foundation for all visual effects
- **Spinner themes**: Implements the most visible ASMR feature (smooth spinners)
- **Timing utilities**: Provides frame rate control for calming animations
- **Reusable across commands**: All commands will use these utilities

#### Implementation Steps
1. Create `src/utils/asmr/spinner.ts` with spinner themes:
   - Define spinner frame arrays for each theme (wave, pulse, breathe, cascade, orbit)
   - Define ASCII fallbacks for each theme
   - Implement `Spinner` class with:
     - `start(message)` - Begin spinner with message
     - `update(message)` - Update message while spinning
     - `succeed(message)` - Stop with success
     - `fail(message)` - Stop with failure
     - `stop()` - Stop without status
   - Use 120ms frame interval (calmer than typical 80ms)
   - Handle cursor visibility (hide on start, show on stop)
2. Create `src/utils/asmr/typewriter.ts`:
   - `typewrite(text, options)` - Display text character by character
   - Default 15ms delay per character
   - Max 60 characters for effect (longer messages skip effect)
   - Support skip on keypress (stdin listener)
   - Return immediately if not TTY
3. Create `src/utils/asmr/timing.ts`:
   - `sleep(ms)` - Promise-based delay
   - `frameDelay()` - Standard frame interval (120ms)
   - `characterDelay()` - Typewriter delay (15ms)
4. Create `src/utils/asmr/index.ts` to export all utilities
5. Write unit tests for spinner frame cycling and typewriter timing

#### Deliverables
- [x] `src/utils/asmr/spinner.ts` - Spinner implementation with themes
- [x] `src/utils/asmr/typewriter.ts` - Typewriter effect
- [x] `src/utils/asmr/timing.ts` - Timing utilities
- [x] `src/utils/asmr/index.ts` - Module exports
- [x] `tests/unit/utils/asmr/spinner.test.ts` - Spinner tests
- [x] `tests/unit/utils/asmr/typewriter.test.ts` - Typewriter tests

---

### Phase 3: Progress Bars and Completion Sequences
**Feature:** [FEAT-014](../features/FEAT-014-cli-animations.md) | [#48](https://github.com/lwndev/ai-skills-manager/issues/48)
**Status:** ✅ Complete

#### Rationale
- **Visual feedback for operations**: Progress bars show advancement through multi-step operations
- **Satisfying completion**: Completion sequences provide satisfying closure
- **Builds on Phase 2**: Uses timing utilities and spinner patterns from Phase 2

#### Implementation Steps
1. Create `src/utils/asmr/progress.ts`:
   - `ProgressBar` class with gradient fill:
     - Constructor: `new ProgressBar(total, options)`
     - `update(current)` - Update progress
     - `complete()` - Finish with animation
     - `fail()` - Finish with error state
   - Gradient characters: `█▓▒░·`
   - Optional shimmer effect (alternating frames)
   - Respect terminal width
   - ASCII fallback: `[####····]`
2. Create `src/utils/asmr/completion.ts`:
   - `showCascade(message)` - Diamond cascade animation
   - `showSweep(message)` - Clean sweep with lines
   - Max 800ms total duration
   - Configuration to select style
3. Create `src/utils/asmr/banner.ts`:
   - `showAsmrBanner()` - Display `· asmr mode ·` once per session
   - Track session state to avoid duplicate banners
   - `showCompletionSummary(stats)` - Formatted operation summary
   - `showAsciiArt()` - Optional verbose mode ASCII art
4. Write unit tests for progress bar rendering and completion timing

#### Deliverables
- [x] `src/utils/asmr/progress.ts` - Progress bar with gradient fill
- [x] `src/utils/asmr/completion.ts` - Completion sequence animations
- [x] `src/utils/asmr/banner.ts` - Session banner and summaries
- [x] `tests/unit/utils/asmr/progress.test.ts` - Progress bar tests
- [x] `tests/unit/utils/asmr/completion.test.ts` - Completion animation tests
- [x] `tests/unit/utils/asmr/banner.test.ts` - Banner and summary tests

---

### Phase 4: Message Formatting and Error States
**Feature:** [FEAT-014](../features/FEAT-014-cli-animations.md) | [#48](https://github.com/lwndev/ai-skills-manager/issues/48)
**Status:** ✅ Complete

#### Rationale
- **Calming messaging**: Provides soothing operation messages and error states
- **User experience polish**: Transforms potentially frustrating errors into calm guidance
- **Confirmation prompts**: Enhances interactive prompts with cleaner styling

#### Implementation Steps
1. Create `src/utils/asmr/messages.ts`:
   - Define message pools by operation type:
     - Install: "Preparing workspace...", "Arranging files...", etc.
     - Update: "Refreshing gently...", "Applying changes...", etc.
     - Package: "Bundling carefully...", "Wrapping up...", etc.
     - Scaffold: "Laying the foundation...", "Shaping the structure...", etc.
   - `getLoadingMessage(operation, index)` - Get message for operation
   - `cycleMessages(operation, spinner)` - Auto-cycle messages with spinner
2. Create `src/utils/asmr/errors.ts`:
   - `formatCalmError(error, suggestion)` - Format error with calm presentation
   - Dotted border: `·  ·  ·`
   - Include "Try:" suggestion when available
   - No harsh symbols or alarming language
3. Update `src/utils/prompts.ts`:
   - Add ASMR-styled confirmation prompts
   - Clean bordered style with `━━━` lines
   - `[y] yes  [n] no` button-style options
   - Respect `shouldEnableAnimations()` to fall back to standard prompts
4. Write tests for message cycling and error formatting

#### Deliverables
- [x] `src/utils/asmr/messages.ts` - Loading message pools and cycling
- [x] `src/utils/asmr/errors.ts` - Calm error formatting
- [x] Updated `src/utils/prompts.ts` - ASMR-styled confirmations
- [x] `tests/unit/utils/asmr/messages.test.ts` - Message pool tests
- [x] `tests/unit/utils/asmr/errors.test.ts` - Error formatting tests

---

### Phase 5: Command Integration
**Feature:** [FEAT-014](../features/FEAT-014-cli-animations.md) | [#48](https://github.com/lwndev/ai-skills-manager/issues/48)
**Status:** ✅ Complete

#### Rationale
- **Apply animations to real commands**: Integrates all ASMR utilities into actual CLI commands
- **Final integration**: Brings together all phases into working features
- **Backward compatibility verification**: Ensures default behavior unchanged

#### Implementation Steps
1. Update `src/formatters/install-formatter.ts`:
   - Add ASMR mode variants for all progress stages
   - Use spinner with install-specific messages
   - Show typewriter effect for success message
   - Display completion sequence on success
2. Update `src/formatters/update-formatter.ts`:
   - Same pattern as install formatter
   - Update-specific loading messages
3. Update `src/formatters/package-formatter.ts`:
   - Package-specific loading messages
   - Progress bar for file addition
4. Update `src/formatters/validate-formatter.ts`:
   - Spinner during validation
   - Calm error presentation for validation failures
5. Update command handlers to pass ASMR config to formatters:
   - `src/commands/install.ts`
   - `src/commands/update.ts`
   - `src/commands/package.ts`
   - `src/commands/validate.ts`
   - `src/commands/scaffold.ts`
   - `src/commands/uninstall.ts`
   - `src/commands/list.ts`
6. Add integration tests verifying ASMR mode output
7. Verify all existing tests pass without modification (backward compatibility)

#### Deliverables
- [x] `src/utils/asmr-output.ts` - High-level ASMR output helpers for commands
- [x] `tests/integration/asmr-mode.test.ts` - Integration tests (20 tests)
- [x] Verification that all existing tests pass

Note: Rather than invasively modifying all formatters, we created reusable ASMR output helpers that commands can adopt incrementally. The existing formatters remain unchanged for backward compatibility.

---

### Phase 6: Sound Cues and Polish
**Feature:** [FEAT-014](../features/FEAT-014-cli-animations.md) | [#48](https://github.com/lwndev/ai-skills-manager/issues/48)
**Status:** ✅ Complete

#### Rationale
- **Optional enhancement**: Sound cues are opt-in for users who want audio feedback
- **Final polish**: Addresses edge cases and terminal compatibility
- **Documentation**: Completes the feature with user-facing docs

#### Implementation Steps
1. Create `src/utils/asmr/sounds.ts`:
   - `playCompletionSound()` - Terminal bell (`\a`) on success
   - Check `asmrSounds` config setting (disabled by default)
   - Only trigger on success, not errors
2. Implement edge case handling:
   - Narrow terminal width (<40 chars): minimal animations, no banners
   - Windows cmd.exe: ASCII-safe character sets
   - Rapid commands (<500ms apart): skip completion animations
3. Add screen reader detection (if possible) to disable animations
4. Create manual testing checklist:
   - macOS Terminal
   - iTerm2
   - VS Code integrated terminal
   - With `NO_COLOR=1`
   - With piped output
5. Update README.md with ASMR mode documentation:
   - Configuration options
   - Available themes
   - Examples
6. Run full test suite to verify no regressions

#### Deliverables
- [x] `src/utils/asmr/sounds.ts` - Terminal bell integration
- [x] Edge case handling in animation utilities
- [x] Updated README.md with ASMR mode documentation
- [x] Manual testing verification
- [x] All tests passing

---

## Shared Infrastructure

### New Utilities
- `src/config/asmr.ts` - Configuration loading and resolution
- `src/utils/terminal.ts` - Terminal capability detection
- `src/utils/asmr/*.ts` - Animation utility modules

### Existing Utilities to Update
- `src/utils/output.ts` - Add ASMR-aware output functions
- `src/utils/prompts.ts` - Add ASMR-styled prompts
- `src/cli.ts` - Add global `--asmr`/`--no-asmr` flags

### Configuration File Structure
```json
{
  "asmr": true,
  "asmrTheme": "wave",
  "asmrSounds": false
}
```

Location: `~/.asm/config.json`

---

## Testing Strategy

### Unit Tests
- Config resolution precedence (flag > env > config > default)
- Terminal capability detection
- Spinner frame cycling for each theme
- Typewriter effect timing
- Progress bar gradient rendering
- Message pool cycling
- Error formatting

### Integration Tests
- Full command execution with `--asmr` flag
- Output verification with ASMR mode enabled/disabled
- Piped output behavior (animations disabled)
- CI environment detection (`CI=true` disables animations)

### Manual Tests
- Visual verification of all spinner themes
- Test on macOS Terminal, iTerm2, VS Code terminal
- Test with `NO_COLOR=1` environment variable
- Verify calming feel and smooth animations
- Test typewriter effect skip behavior

---

## Dependencies and Prerequisites

### External Dependencies
- No new npm dependencies required
- Uses built-in Node.js APIs:
  - `process.stdout.isTTY`
  - `process.stdout.columns`
  - `readline` (already used for prompts)

### Prerequisites
- Existing CLI infrastructure (Commander.js)
- Existing formatter pattern
- Existing output utilities

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Breaking existing test output | High | Medium | Phase 5 explicitly verifies backward compatibility |
| Terminal compatibility issues | Medium | Medium | ASCII fallbacks for all animations |
| Performance impact from animations | Low | Low | NFR-1 specifies max 50ms latency |
| Flaky tests from timing-dependent code | Medium | Medium | Mock timers in tests, avoid real delays |
| Windows terminal issues | Medium | Low | Test on Windows, ASCII fallbacks |

---

## Success Criteria

### Per-Phase Criteria
- All unit tests passing
- No regression in existing tests
- Code follows project style guidelines

### Overall Success
- [x] `--asmr` flag enables ASMR mode for a single command
- [x] `--no-asmr` flag disables ASMR mode
- [x] `ASM_ASMR=1` enables ASMR mode globally
- [x] Config file `asmr: true` enables ASMR mode
- [x] Precedence order is respected (flag > env > config > default)
- [x] Default behavior with no settings matches current output exactly
- [x] Smooth spinners display with calming animations
- [x] Typewriter effect works for key messages
- [x] Progress bars show smooth gradient fill
- [x] Completion sequences display satisfying patterns
- [x] Error states are calm and reassuring
- [x] Animations disabled when output is piped
- [x] Animations disabled when `NO_COLOR=1` is set
- [x] Animations disabled when `CI=true` is set
- [x] All existing tests pass without modification
- [x] New tests cover animation utilities and configuration

---

## Code Organization

```
src/
├── cli.ts                      # Add --asmr/--no-asmr global flags
├── config/
│   └── asmr.ts                 # ASMR config loading (new)
├── utils/
│   ├── terminal.ts             # Terminal detection (new)
│   ├── output.ts               # Update with ASMR support
│   ├── prompts.ts              # Update with ASMR prompts
│   └── asmr/                   # Animation utilities (new)
│       ├── index.ts
│       ├── spinner.ts
│       ├── typewriter.ts
│       ├── progress.ts
│       ├── completion.ts
│       ├── banner.ts
│       ├── messages.ts
│       ├── errors.ts
│       ├── sounds.ts
│       └── timing.ts
├── formatters/                 # Update existing formatters
│   ├── install-formatter.ts
│   ├── update-formatter.ts
│   ├── package-formatter.ts
│   └── validate-formatter.ts
└── types/
    └── asmr.ts                 # ASMR type definitions (new)

tests/
├── config/
│   └── asmr.test.ts
├── utils/
│   ├── terminal.test.ts
│   └── asmr/
│       ├── spinner.test.ts
│       ├── typewriter.test.ts
│       ├── progress.test.ts
│       └── messages.test.ts
└── integration/
    └── asmr-mode.test.ts
```
