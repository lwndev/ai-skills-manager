# Changelog

All notable changes to AI Skills Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.1] - 2026-02-13

### Breaking Changes

- **Removed `agent` template type** (CHORE-013): The `--template agent` scaffold variant has been removed. Skills and subagents are distinct systems — agent-specific scaffolding belongs in `.claude/agents/`, not `.claude/skills/`. Use `basic`, `forked`, `with-hooks`, or `internal` templates instead.
- **Removed `--memory` and `--model` scaffold flags** (CHORE-013): These flags produced agent-only frontmatter fields that are not valid in skill files. Remove `--memory` and `--model` from any scripts or CI commands that use `asm scaffold`.
- **Removed 5 agent-only frontmatter validators** (CHORE-013): The `memory`, `skills`, `model`, `permissionMode`, and `disallowedTools` fields are no longer accepted in skill frontmatter. Skills using these fields will fail the "Allowed properties" validation check. Move agent-specific fields to `.claude/agents/` files instead.

### Added

- **`--license` scaffold flag** (CHORE-013): Set the `license` field in generated SKILL.md frontmatter (e.g., `--license MIT`)
- **`--compatibility` scaffold flag** (CHORE-013): Set the `compatibility` field in generated SKILL.md frontmatter (max 500 chars)
- **`--metadata` scaffold flag** (CHORE-013): Set metadata key-value pairs in generated SKILL.md frontmatter (repeatable, e.g., `--metadata author="Jane Doe"`)
- **Interactive prompts for spec fields** (CHORE-013): `asm scaffold --interactive` now prompts for license, compatibility, and metadata

### Changed

- **Validation pipeline simplified** (CHORE-013): Reduced from 25 checks to 20 by removing 5 agent-only field validators (`memory`, `skills`, `model`, `permissionMode`, `disallowedTools`)
- **`compatibility` max length corrected** (CHORE-013): Increased from 100 to 500 characters to match the agentskills.io specification
- **`argument-hint` scaffold max length corrected** (CHORE-013): Increased from 100 to 200 characters to match the existing validator
- **`license` scaffold cap removed** (CHORE-013): Removed artificial 100-character limit; the agentskills.io spec defines no maximum
- **Interactive scaffold updated** (CHORE-013): Removed `agent` template choice, memory scope prompt, and model selection prompt

### Removed

- `src/validators/disallowed-tools.ts` — agent-only validator
- `src/validators/memory.ts` — agent-only validator
- `src/validators/model.ts` — agent-only validator
- `src/validators/permission-mode.ts` — agent-only validator
- `src/validators/skills.ts` — agent-only validator

## [1.7.0] - 2026-02-08

### Added

- **Skill Template System** (FEAT-013): New `--template` flag for `asm scaffold` with five template variants: `basic` (default), `forked` (isolated context), `with-hooks` (hook configuration examples), `internal` (non-user-invocable helper), and `agent` (autonomous agent with model, memory, and tool config)
- **Scaffold Frontmatter Flags** (FEAT-013): New flags `--context fork`, `--agent <name>`, `--no-user-invocable`, and `--hooks` for fine-grained control over generated SKILL.md frontmatter
- **Agent Template Type** (FEAT-017): New `agent` template variant and scaffold flags `--memory <scope>`, `--model <name>`, and `--argument-hint <hint>` for creating custom Claude Code agent skills
- **Minimal Scaffold Mode** (FEAT-016): New `--minimal` flag generates shorter, production-ready templates without educational guidance text
- **Interactive Scaffold Mode** (FEAT-019): New `--interactive` / `-i` flag launches a guided prompt-driven workflow for template selection and configuration
- **Frontmatter Schema v2** (FEAT-014): 11 new field validators for Claude Code v2.0.30–v2.1.33 fields: `memory`, `skills`, `model`, `permissionMode`, `disallowedTools`, `argument-hint`, `keep-coding-instructions`, `tools`, `color`, `disable-model-invocation`, `version`
- **Advanced Allowed-Tools Patterns** (FEAT-014): Validation now accepts `Task(AgentName)`, `mcp__server__*`, `${CLAUDE_PLUGIN_ROOT}`, and `Bash(git:*)` colon syntax in allowed-tools
- **Nested Skill Discovery** (FEAT-012): New `asm list --recursive` flag discovers skills in nested `.claude/skills` directories for monorepos and workspaces
- **Recursive Depth Control** (FEAT-012): New `--depth <0-10>` flag limits recursive discovery traversal depth (default: 3)
- **Depth Limit Warning** (CHORE-008): `asm list --recursive` now warns when max depth is reached and subdirectories remain unscanned
- **Recursive JSON Metadata** (CHORE-009): `asm list --recursive --json` now returns a result object with `depthLimitReached` metadata instead of a raw array

### Changed

- **Frontmatter Validation** (FEAT-011): Added support for Claude Code 2.1.x frontmatter fields: `context`, `agent`, `hooks`, `user-invocable`
- **Discovery Behavior** (FEAT-015): Recursive discovery no longer respects `.gitignore` patterns, aligning with Claude Code v2.0.28+ behavior; hardcoded skip list trimmed to only `.git` and `node_modules`
- **YAML List Format** (#35): `allowed-tools` field now supports YAML-style list format in addition to comma-separated inline format
- **Documentation & Plugin Awareness** (FEAT-018): Updated CLI help text, template guidance, and documentation to reflect Claude Code's skills/slash-commands unification, plugin system, auto-approval behavior, and skill size budget
- **Template Guidance** (FEAT-017, FEAT-018): All templates updated with documentation for new frontmatter fields, permissions model, and plugin distribution

### Fixed

- **Flaky Performance Test** (CHORE-010): Replaced unreliable wall-clock timing comparison in depth-limiting test with behavioral assertion
- **Test Stability**: Fixed flaky progress threshold test using fake timers; replaced non-null assertions with type-narrowing guards in tests

## [1.6.0] - 2026-01-11

### Added

- **Programmatic API**: All CLI functionality is now available as importable Node.js functions for use in GUI applications and third-party integrations
  - `scaffold()` - Create new skill directories programmatically
  - `validate()` - Validate skills and receive typed results
  - `createPackage()` - Create .skill packages with cancellation support
  - `install()` - Install skills with dry-run and force options
  - `update()` - Update skills with backup and rollback support
  - `uninstall()` - Batch uninstall with partial failure handling
  - `list()` - List installed skills with scope filtering
- **Typed Error Handling**: All API functions throw typed errors that can be caught with `instanceof`
  - `AsmError` - Base error class with machine-readable `code` property
  - `ValidationError` - Contains `issues` array with validation details
  - `FileSystemError` - Contains `path` property indicating error location
  - `PackageError` - For package creation and extraction failures
  - `SecurityError` - For path traversal and invalid name attempts
  - `CancellationError` - For operations cancelled via AbortSignal
- **AbortSignal Support**: Long-running operations (`createPackage`, `install`, `update`, `uninstall`) support cancellation via `AbortSignal`
- **Dry Run Mode**: `install`, `update`, and `uninstall` functions support `dryRun` option to preview changes
- **TypeScript Types**: Full TypeScript type definitions for all API options, results, and error classes
- **CLI List Command**: New `asm list` command to list installed skills
- **Package Entry Point**: Proper ESM/CommonJS dual format support via `package.json` exports field

### Changed

- CLI commands now use the programmatic API internally (thin wrapper pattern)
- CLI output and exit codes remain unchanged for backward compatibility

## [1.5.1] - 2025-01-10

### Fixed

- Minor documentation updates and test improvements

## [1.5.0] - 2025-01-09

### Added

- Update command with backup and automatic rollback on failure
- Support for keeping backups after successful updates

## [1.4.2] - 2025-01-08

### Fixed

- Uninstall command reliability improvements

## [1.4.1] - 2025-01-07

### Fixed

- Package extraction security improvements

## [1.4.0] - 2025-01-06

### Added

- Uninstall command for removing installed skills
- Batch uninstall support for multiple skills

## [1.3.0] - 2025-01-05

### Added

- Install command for .skill package files
- Dry-run mode for preview without changes

## [1.2.0] - 2025-01-04

### Added

- Package command for creating .skill distribution files
- Skip validation option for packaging

## [1.1.2] - 2025-01-03

### Fixed

- Validation edge cases for frontmatter parsing

## [1.1.1] - 2025-01-02

### Fixed

- Scaffold command path resolution

## [1.1.0] - 2025-01-01

### Added

- Validate command with JSON output support
- Quiet mode for CI/CD integration

## [1.0.0] - 2024-12-30

### Added

- Initial release
- Scaffold command for creating new skills
- Support for project and personal scopes
- SKILL.md template generation
