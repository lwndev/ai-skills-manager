# Feature Requirements: ASCII Art Version Banner

## Overview
Add a branded ASCII art banner to the `asm --version` output, displaying the ASM logo alongside version, tagline, website, and license information. Also clean up unused spinner/progress constants from `update-formatter.ts`.

## Feature ID
`FEAT-025`

## GitHub Issue
[#127](https://github.com/lwndev/ai-skills-manager/issues/127)

## Priority
Low - Visual polish and branding enhancement; no functional impact on core operations.

## User Story
As a CLI user, I want to see a polished branded banner when I run `asm --version` so that the tool feels professional and I can quickly see version and project info at a glance.

## Command Syntax

```bash
asm --version
asm -V
```

### Options (existing global flags that affect behavior)
- `-q, --quiet` - Suppresses banner art; outputs plain version string only
- `-j, --json` - Outputs version info as JSON; no art

## Functional Requirements

### FR-1: ASCII Art Banner Display
- Override Commander's default `--version` behavior with a custom version action
- Display a stylized `ASM` ASCII art logo
- Below the art, display:
  - Version: read from `package.json` (e.g., `v1.8.3`)
  - Tagline: `Create. Validate. Distribute.`
  - Website: `ai-skills-manager.app`
  - License: read from `package.json` (e.g., `MIT`)
- Banner renders on `asm --version` and `asm -V`

### FR-2: Output Mode Suppression
- When quiet mode (`-q`) is active, output only the plain version string (e.g., `1.8.3`) with no art
- When JSON mode (`-j`) is active, output a JSON object: `{"version": "1.8.3", "license": "MIT"}`
- When stdout is not a TTY (piped output), output only the plain version string

### FR-3: Terminal Width Handling
- Detect terminal width before rendering
- If terminal width is less than the minimum required for the ASCII art (determine during implementation), fall back to plain version string output
- Ensure no line wrapping or broken art on narrow terminals

### FR-4: Cleanup Unused Constants
- Remove `SPINNER_FRAMES` constant from `src/formatters/update-formatter.ts` (line 55)
- Remove `PROGRESS_BAR_WIDTH`, `PROGRESS_FILLED_CHAR`, `PROGRESS_EMPTY_CHAR` constants from `src/formatters/update-formatter.ts` (lines 60-62)
- Verify no references exist elsewhere before removal

## Output Format

### Standard TTY output (`asm --version`)
```
    _    ____  __  __
   / \  / ___||  \/  |
  / _ \ \___ \| |\/| |
 / ___ \ ___) | |  | |
/_/   \_\____/|_|  |_|

  v1.8.3
  Create. Validate. Distribute.
  ai-skills-manager.app
  MIT License
```
*(ASCII art is illustrative; final design determined during implementation)*

### Quiet mode (`asm --version -q`)
```
1.8.3
```

### JSON mode (`asm --version -j`)
```json
{"version":"1.8.3","license":"MIT"}
```

### Non-TTY / piped output
```
1.8.3
```

## Non-Functional Requirements

### NFR-1: No Additional Dependencies
- ASCII art must be hardcoded or generated without adding runtime dependencies
- No `figlet`, `chalk`, or similar packages

### NFR-2: Performance
- Banner rendering must add no perceptible delay (< 5ms)
- No file I/O beyond the existing `package.json` read

### NFR-3: Maintainability
- ASCII art stored as a string constant in a dedicated formatter file (e.g., `src/formatters/version-formatter.ts`)
- Version and license read from `package.json` (single source of truth, already loaded in `cli.ts`)

## Dependencies
- `commander` - Already used; supports custom version handling via `.version()` options or action override
- No new dependencies

## Edge Cases
1. **Terminal width < art width**: Fall back to plain version string
2. **No TTY (piped to file/grep)**: Output plain version string only
3. **Quiet + JSON both specified**: JSON takes precedence (existing convention)
4. **package.json missing license field**: Display `License: Unknown` or omit the line

## Testing Requirements

### Unit Tests
- Banner formatter produces expected ASCII art string
- Quiet mode returns plain version string
- JSON mode returns valid JSON with version and license
- Non-TTY detection returns plain version string
- Narrow terminal falls back to plain output
- Missing license field handled gracefully

### Integration Tests
- `asm --version` outputs banner (TTY context)
- `asm --version -q` outputs plain version
- `asm --version -j` outputs valid JSON

### E2E Tests
- `node dist/cli.js --version` produces output containing the version number
- Piped output (`node dist/cli.js --version | cat`) produces plain version string

### Cleanup Verification
- Confirm `SPINNER_FRAMES`, `PROGRESS_BAR_WIDTH`, `PROGRESS_FILLED_CHAR`, `PROGRESS_EMPTY_CHAR` are removed
- Confirm no remaining references to removed constants

## Future Enhancements
- Color support with ANSI escape codes (respecting `NO_COLOR` env var)
- Seasonal or themed banners
- `asm banner` standalone command for display on demand

## Acceptance Criteria
- [ ] ASCII art banner displays on `asm --version` including version, tagline, website, and license
- [ ] Art suppressed in quiet (`-q`) mode — plain version only
- [ ] Art suppressed in JSON (`-j`) mode — JSON object only
- [ ] Art suppressed in non-TTY contexts (piped output)
- [ ] Graceful fallback on narrow terminals (no broken art)
- [ ] Unused `SPINNER_FRAMES` and progress bar constants cleaned up from `update-formatter.ts`
- [ ] No additional runtime dependencies introduced
- [ ] Unit, integration, and e2e tests cover new behavior
