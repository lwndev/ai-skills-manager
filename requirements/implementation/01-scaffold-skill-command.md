# Implementation Plan: Scaffold Skill Command

## Overview

Implement the `asm scaffold` command that enables users to quickly create a new Claude Code skill with the required directory structure and SKILL.md file. This is the foundational CLI command for the AI Skills Manager, establishing patterns for CLI argument parsing, validation, file generation, and user output that future commands will follow.

The project is currently a fresh TypeScript setup with no existing CLI infrastructure. This implementation will introduce Commander.js for CLI parsing and establish the core patterns for all subsequent ASM commands.

## Features Summary

| Feature ID | GitHub Issue | Feature Document | Priority | Complexity | Status |
|------------|--------------|------------------|----------|------------|--------|
| FEAT-001   | [#1](https://github.com/lwndev/ai-skills-manager/issues/1) | [scaffold-skill-command.md](../features/scaffold-skill-command.md) | High | Medium | Pending |

## Recommended Build Sequence

### Phase 1: CLI Infrastructure & Entry Point
**Feature:** [FEAT-001](../features/scaffold-skill-command.md) | [#1](https://github.com/lwndev/ai-skills-manager/issues/1) (Foundation)
**Status:** Pending

#### Rationale
- Establishes the CLI framework that all commands will use
- Sets up Commander.js with the `asm` binary
- Creates the project structure pattern for commands
- Must be built first as all other phases depend on it

#### Implementation Steps
1. Install Commander.js dependency (`npm install commander`)
2. Create `src/cli.ts` as the main CLI entry point with Commander program setup
3. Update `package.json` with bin configuration for `asm` command
4. Create `src/commands/` directory structure for command modules
5. Create `src/commands/scaffold.ts` with basic command registration (skeleton)
6. Update `src/index.ts` to export programmatic API (optional)
7. Configure TypeScript to output executable with proper shebang

#### Deliverables
- [ ] `src/cli.ts` - Main CLI entry point
- [ ] `src/commands/scaffold.ts` - Scaffold command skeleton
- [ ] Updated `package.json` with `bin` field and commander dependency
- [ ] Working `asm --help` command

---

### Phase 2: Validation Logic
**Feature:** [FEAT-001](../features/scaffold-skill-command.md) | [#1](https://github.com/lwndev/ai-skills-manager/issues/1) (Core Validation)
**Status:** Pending

#### Rationale
- Validation is a discrete, testable unit that other phases depend on
- Establishing validation utilities early enables TDD for file generation
- These validators will be reused by future commands (validate, package)

#### Implementation Steps
1. Create `src/validators/` directory for validation modules
2. Implement `src/validators/name.ts` with skill name validation:
   - Regex pattern: `^[a-z0-9]+(-[a-z0-9]+)*$` (no start/end/consecutive hyphens)
   - Maximum length: 64 characters
   - Reserved words check: "anthropic", "claude"
3. Implement `src/validators/description.ts` with description validation:
   - Non-empty check
   - Maximum length: 1024 characters
   - Angle bracket rejection (`<` or `>`)
4. Implement `src/validators/frontmatter.ts` with frontmatter key validation:
   - Allowed keys: name, description, license, allowed-tools, metadata
   - Reject unexpected top-level keys
5. Create `src/validators/index.ts` barrel export
6. Write unit tests for all validators

#### Deliverables
- [ ] `src/validators/name.ts` - Skill name validation
- [ ] `src/validators/description.ts` - Description validation
- [ ] `src/validators/frontmatter.ts` - Frontmatter key validation
- [ ] `src/validators/index.ts` - Barrel export
- [ ] `tests/validators/name.test.ts` - Name validation tests
- [ ] `tests/validators/description.test.ts` - Description validation tests
- [ ] `tests/validators/frontmatter.test.ts` - Frontmatter validation tests

---

### Phase 3: Template & File Generation
**Feature:** [FEAT-001](../features/scaffold-skill-command.md) | [#1](https://github.com/lwndev/ai-skills-manager/issues/1) (File Operations)
**Status:** Pending

#### Rationale
- Builds on validation from Phase 2
- Core functionality that produces the actual skill scaffold
- Separating template from file I/O enables testing and future template variations

#### Implementation Steps
1. Create `src/templates/` directory for template modules
2. Implement `src/templates/skill-md.ts` with SKILL.md template generation:
   - Accept name, description, allowed-tools as parameters
   - Generate valid YAML frontmatter with proper escaping
   - Generate markdown body with TODO placeholders
   - Include 500-line guidance comment
3. Create `src/generators/` directory for file generation
4. Implement `src/generators/scaffold.ts`:
   - Create skill directory
   - Create SKILL.md from template
   - Create scripts/ directory with .gitkeep
   - Handle --project path (`.claude/skills/`)
   - Handle --personal path (`~/.claude/skills/`)
   - Handle --output path override
5. Add directory existence check with confirmation prompt
6. Implement --force flag to skip confirmation
7. Write unit tests for template generation

#### Deliverables
- [ ] `src/templates/skill-md.ts` - SKILL.md template generator
- [ ] `src/generators/scaffold.ts` - Directory and file creation logic
- [ ] `tests/templates/skill-md.test.ts` - Template generation tests
- [ ] `tests/generators/scaffold.test.ts` - Generator tests

---

### Phase 4: Command Integration & Output
**Feature:** [FEAT-001](../features/scaffold-skill-command.md) | [#1](https://github.com/lwndev/ai-skills-manager/issues/1) (User Interface)
**Status:** Pending

#### Rationale
- Integrates all previous phases into the complete command
- Implements user-facing output formatting
- Establishes error handling patterns for CLI commands

#### Implementation Steps
1. Complete `src/commands/scaffold.ts` with full command implementation:
   - Parse all arguments and options (name, --description, --output, --project, --personal, --allowed-tools, --force)
   - Wire up validators from Phase 2
   - Wire up generators from Phase 3
2. Create `src/utils/output.ts` for consistent output formatting:
   - Success checkmarks (✓)
   - Error formatting
   - Next steps display
3. Create `src/utils/errors.ts` for error types:
   - ValidationError
   - FileSystemError
   - UserCancelledError
4. Implement error handling for all edge cases:
   - Invalid name (with examples)
   - Invalid description (with requirements)
   - Permission denied
   - Existing directory (prompt or --force)
   - Disk full
5. Display success output with:
   - Created file structure
   - Next steps (numbered list)
   - Documentation links
6. Add --help text with examples

#### Deliverables
- [ ] `src/commands/scaffold.ts` - Complete command implementation
- [ ] `src/utils/output.ts` - Output formatting utilities
- [ ] `src/utils/errors.ts` - Error types and handling
- [ ] Working `asm scaffold <name>` with all options

---

### Phase 5: Testing & Documentation
**Feature:** [FEAT-001](../features/scaffold-skill-command.md) | [#1](https://github.com/lwndev/ai-skills-manager/issues/1) (Quality Assurance)
**Status:** Pending

#### Rationale
- Final phase ensures reliability and usability
- Integration tests verify end-to-end workflows
- Documentation enables user adoption

#### Implementation Steps
1. Set up Jest testing framework with TypeScript support
2. Complete unit tests for remaining modules (aim for >80% coverage)
3. Write integration tests:
   - Full scaffold workflow (happy path)
   - All option combinations
   - Error handling scenarios
   - Personal vs project skill creation
4. Create manual test checklist
5. Update README.md with:
   - Installation instructions
   - Usage examples
   - Command reference
6. Verify generated SKILL.md is valid (can be parsed by Claude)

#### Deliverables
- [ ] Jest configuration (`jest.config.js`)
- [ ] `tests/integration/scaffold.test.ts` - Integration tests
- [ ] Updated `README.md` with scaffold command documentation
- [ ] >80% test coverage

---

## Shared Infrastructure

Components that will be reused across future commands:

| Component | Location | Reused By |
|-----------|----------|-----------|
| Name validator | `src/validators/name.ts` | validate, package |
| Description validator | `src/validators/description.ts` | validate |
| Frontmatter validator | `src/validators/frontmatter.ts` | validate |
| Output formatting | `src/utils/output.ts` | All commands |
| Error types | `src/utils/errors.ts` | All commands |
| CLI setup pattern | `src/cli.ts` | All commands |

## Testing Strategy

### Unit Tests
- Validators: Test all valid/invalid inputs per specification
- Templates: Verify generated YAML is valid, escaping works
- Generators: Mock filesystem, verify correct files created

### Integration Tests
- Run full scaffold command in temp directories
- Verify file structure matches specification
- Test all flag combinations
- Test error conditions (existing dir, invalid inputs)

### Manual Testing
- Scaffold skill in various directories
- Verify Claude discovers and loads scaffolded skill
- Test on different Node.js versions

## Dependencies and Prerequisites

### External Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| commander | ^12.x | CLI argument parsing |
| jest | ^29.x | Testing framework |
| ts-jest | ^29.x | TypeScript support for Jest |
| @types/node | ^20.x | Node.js type definitions |

### Existing Requirements
- Node.js 18+ (for native fs/promises)
- TypeScript 5.5+ (already configured)

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| YAML escaping edge cases | Medium | Medium | Use yaml library for serialization; comprehensive test cases for special characters |
| Cross-platform path handling | Medium | Medium | Use path.join/path.resolve consistently; test on Windows |
| Home directory expansion (~) | Low | Medium | Use os.homedir() instead of tilde expansion |
| Permission errors on protected directories | Low | Low | Check write permissions before attempting creation; clear error messages |
| Template changes break existing skills | Medium | Low | Version templates; validate against Claude skill spec |

## Success Criteria

### Feature-Specific
- [ ] `asm scaffold my-skill` creates correct directory structure
- [ ] Generated SKILL.md has valid YAML frontmatter
- [ ] All validation rules enforced per specification
- [ ] All options (--description, --project, --personal, --allowed-tools, --force, --output) work correctly
- [ ] Error messages are clear and actionable
- [ ] Success output includes next steps and documentation links

### Overall Project
- [ ] >80% test coverage
- [ ] Command completes in <1 second
- [ ] Works on macOS, Linux, Windows
- [ ] README documents full usage

## Code Organization

```
src/
├── cli.ts                    # Main CLI entry point
├── index.ts                  # Programmatic API exports
├── commands/
│   └── scaffold.ts           # Scaffold command
├── validators/
│   ├── index.ts              # Barrel export
│   ├── name.ts               # Skill name validation
│   ├── description.ts        # Description validation
│   └── frontmatter.ts        # Frontmatter key validation
├── templates/
│   └── skill-md.ts           # SKILL.md template generator
├── generators/
│   └── scaffold.ts           # File/directory creation
└── utils/
    ├── output.ts             # Console output formatting
    └── errors.ts             # Error types

tests/
├── validators/
│   ├── name.test.ts
│   ├── description.test.ts
│   └── frontmatter.test.ts
├── templates/
│   └── skill-md.test.ts
├── generators/
│   └── scaffold.test.ts
└── integration/
    └── scaffold.test.ts
```
