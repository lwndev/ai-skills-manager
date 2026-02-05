# Feature Requirements: ASMR Mode CLI Animations

## Overview

Add satisfying, calming animations to the AI Skills Manager CLI inspired by ASMR aesthetics. Instead of flashy emojis, ASMR mode provides smooth visual feedback with gentle typing effects, satisfying progress patterns, and soothing completion sequences that make CLI operations feel polished and pleasant.

## Feature ID
`FEAT-014`

## GitHub Issue
[#48](https://github.com/lwndev/ai-skills-manager/issues/48)

## Priority
Low - Quality of life improvement for CLI user experience

## User Story

As a CLI user, I want smooth, satisfying visual feedback during operations so that the tool feels polished and waiting for longer operations becomes a pleasant experience.

## Configuration

### Global Flag
```bash
asm <command> --asmr     # Enable ASMR mode for this command
asm <command> --no-asmr  # Explicitly disable ASMR mode
```

### Environment Variable
```bash
export ASM_ASMR=1   # Enable ASMR mode globally
export ASM_ASMR=0   # Disable ASMR mode globally
```

### Config File (~/.asm/config.json)
```json
{
  "asmr": true,
  "asmrTheme": "default"
}
```

**Precedence order (highest to lowest):**
1. Command-line flag (`--asmr` / `--no-asmr`)
2. Environment variable (`ASM_ASMR`)
3. Config file setting
4. Default: disabled

## Functional Requirements

### FR-1: Smooth Spinners

Replace the current Braille spinner with satisfying alternatives when ASMR mode is enabled:

| Theme | Frames | Feel |
|-------|--------|------|
| `default` | `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` | Current behavior (backward compatible) |
| `wave` | `▁▂▃▄▅▆▇█▇▆▅▄▃▂▁` | Gentle rising and falling wave |
| `pulse` | `○◔◑◕●◕◑◔○` | Smooth circular pulse |
| `breathe` | `·∙●∙·` | Calm breathing rhythm |
| `cascade` | `⣀⣤⣶⣿⣶⣤⣀` | Satisfying fill pattern |
| `orbit` | `◐◓◑◒` | Smooth orbital rotation |

### FR-2: Typewriter Effect

Display output with a gentle typewriter effect for key messages:

```bash
# Standard mode
✓ Skill 'my-skill' installed!

# ASMR mode (characters appear with 15ms delay)
✓ S·k·i·l·l· ·'·m·y·-·s·k·i·l·l·'· ·i·n·s·t·a·l·l·e·d·!
```

Configuration:
- Default delay: 15ms per character
- Max message length for effect: 60 characters
- Skip effect for long outputs

### FR-3: Satisfying Progress Bars

Enhanced progress bars with smooth fill animations:

```bash
# Standard mode
[████████░░░░░░░░░░░░] 40% Extracting files...

# ASMR mode - smooth gradient fill
[████████▓▒░░░░░░░░░░] 40% Extracting files...

# ASMR mode - with subtle shimmer (alternating frames)
[████████▓▒░░░░░░░░░░] 40%
[████████▒▓░░░░░░░░░░] 40%
```

Progress bar characters:
- Filled: `█`
- Gradient: `▓▒░`
- Empty: `·` (softer than standard `░`)

### FR-4: Completion Sequences

Display satisfying completion animations:

```bash
# Standard mode
✓ Skill installed!

# ASMR mode - gentle cascade
        ·
       ···
      ·····
     ·······
    ·········
   ···········
  ✓ Skill installed!
   ···········
    ·········
     ·······
      ·····
       ···
        ·

# ASMR mode - clean sweep (simpler alternative)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Skill installed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### FR-5: Calming Loading Messages

Rotate through soothing loading messages:

```bash
○ Preparing workspace...
◔ Organizing files gently...
◑ Almost there...
◕ Finishing touches...
```

**Message pools by operation:**
- **Install**: "Preparing workspace...", "Arranging files...", "Setting things up...", "Nearly ready..."
- **Update**: "Refreshing gently...", "Applying changes...", "Smoothing things over..."
- **Package**: "Bundling carefully...", "Wrapping up...", "Sealing the package..."
- **Scaffold**: "Laying the foundation...", "Shaping the structure...", "Adding the details..."

### FR-6: Gentle Error States

Provide calm, reassuring error messages:

```bash
# Standard mode
✗ Error: Skill not found

# ASMR mode
  ·  ·  ·
  Skill 'my-skill' wasn't found.

  Try: asm list
  ·  ·  ·
```

### FR-7: Soft Confirmations

Minimal, clean confirmation prompts:

```bash
# Standard mode
Update skill 'my-skill'? (y/N)

# ASMR mode
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Update 'my-skill'?

  This will replace the current version.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [y] yes  [n] no
```

### FR-8: Ambient Sound Cues (Optional)

Optional terminal bell integration for satisfying feedback:

```json
{
  "asmr": true,
  "asmrSounds": true
}
```

- Single soft bell on completion (`\a`)
- Disabled by default
- Only triggers on success, not errors

## Output Format

### ASMR Mode Banner (shown once per session)
```
· asmr mode ·
```

### Operation Complete Summary
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━
       Operation Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Skills installed    3
  Skills updated      1
  Warnings            0

━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### ASCII Art Banner (Optional, with --verbose)
```

   __ _ ___ _ __ ___
  / _` / __| '_ ` _ \
 | (_| \__ \ | | | | |
  \__,_|___/_| |_| |_|

  skills manager

```

## Non-Functional Requirements

### NFR-1: Performance
- Animations must not add more than 50ms latency to any operation
- Spinner frame rate: 120ms (slower, more calming than typical 80ms)
- Typewriter effect: 15ms per character (skippable with any keypress)
- Completion sequences: max 800ms total duration

### NFR-2: Terminal Compatibility
- Detect terminal capabilities (Unicode support)
- Fall back to simpler ASCII patterns if needed:
  - Wave: `-=+*+=- `
  - Progress: `[####····]`
- Respect `NO_COLOR` and `TERM=dumb` environment variables
- Support both TTY and piped output (disable animations when piped)

### NFR-3: Accessibility
- All animations are purely decorative; information is always conveyed in text
- Typewriter effect can be skipped with any keypress
- Provide `--no-asmr` flag for users who prefer standard output
- Animations do not interfere with screen readers

### NFR-4: Backward Compatibility
- Default behavior (ASMR mode disabled) must match current output exactly
- Existing scripts parsing ASM output must continue to work
- All current tests must pass without modification

## Dependencies

- Terminal detection utilities (built-in Node.js `process.stdout.isTTY`)
- Configuration loading from `~/.asm/config.json`
- No external animation libraries required

## Edge Cases

1. **Non-TTY output (piped)**: Disable all animations, use standard output
2. **Narrow terminal width (<40 chars)**: Use minimal animations, no banners
3. **CI/CD environments**: Auto-detect and disable animations (`CI=true`)
4. **Windows cmd.exe**: Use ASCII-safe character sets
5. **Screen reader detected**: Disable animations entirely
6. **Config file missing**: Use defaults (ASMR mode disabled)
7. **Conflicting flags**: `--asmr --no-asmr` should use last specified
8. **Rapid successive commands**: Skip completion animations if < 500ms apart

## Testing Requirements

### Unit Tests

**Animation utilities (`src/utils/asmr.ts`):**
- Spinner frame cycling for each theme
- Typewriter effect timing
- Progress bar gradient rendering
- Terminal capability detection

**Configuration (`src/config/asmr.ts`):**
- Flag parsing precedence
- Environment variable handling
- Config file loading
- Default fallbacks

### Integration Tests

- Full command execution with `--asmr` flag
- Output verification with ASMR mode enabled/disabled
- Piped output behavior
- CI environment detection
- Typewriter skip on keypress

### Manual Testing

- Visual verification of all spinner themes
- Test on macOS Terminal, iTerm2, VS Code terminal
- Test with `NO_COLOR=1` environment variable
- Verify calming feel and smooth animations
- Test typewriter effect skip behavior

## Future Enhancements

- Additional themes: `rain`, `sand`, `leaves`
- Adjustable animation speed via config
- Custom completion messages
- Integration with terminal color schemes
- Haptic feedback on supported devices (future macOS terminals)

## Acceptance Criteria

- [ ] `--asmr` flag enables ASMR mode for a single command
- [ ] `--no-asmr` flag disables ASMR mode
- [ ] `ASM_ASMR=1` enables ASMR mode globally
- [ ] Config file `asmr: true` enables ASMR mode
- [ ] Precedence order is respected (flag > env > config > default)
- [ ] Default behavior with no settings matches current output exactly
- [ ] Smooth spinners display with calming animations
- [ ] Typewriter effect works for key messages
- [ ] Typewriter effect can be skipped with keypress
- [ ] Progress bars show smooth gradient fill
- [ ] Completion sequences display satisfying patterns
- [ ] Error states are calm and reassuring
- [ ] Animations disabled when output is piped
- [ ] Animations disabled when `NO_COLOR=1` is set
- [ ] Animations disabled when `CI=true` is set
- [ ] All existing tests pass without modification
- [ ] New tests cover animation utilities and configuration
- [ ] ASMR mode banner shows once per session
