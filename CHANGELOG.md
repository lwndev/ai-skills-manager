# Changelog

All notable changes to AI Skills Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.3] - 2026-03-14

### Added

- **ASCII art version banner** (FEAT-025): `asm --version` now displays a branded ASCII art banner with version, tagline, website, and license info. Supports quiet (`-q`), JSON (`-j`), non-TTY, and narrow-terminal fallback modes (#127)
- **Site repo publish notification** (CHORE-035): Publish workflow now sends a repository dispatch event to notify the site repo on new releases (#125)

### Removed

- **Dead progress bar/spinner code**: Removed unused `formatProgressBar()`, `formatProgressSpinner()` functions and their constants from `update-formatter.ts` (#127)

## [1.8.2] - 2026-03-13

### Changed

- **Migrated test suite from Jest to Vitest** (FEAT-024): Replaced Jest with Vitest as the test runner, updated all test files to use Vitest APIs (`vi.fn()`, `vi.mock()`, `vi.doMock()`), converted Jest config to `vitest.config.ts`, and removed Jest dependencies (#121)
- **Added managed policy warning for allowed-tools** (CHORE-033): Validation now warns when a skill's `allowed-tools` field could bypass managed policy `ask` rules (#122)

### Fixed

- **CI release notes generation**: Use explicit previous tag for release notes generation to ensure correct diff range (5ca35da)

### Compatibility

- Updated changelog tracker to Claude Code v2.1.74 — no ASM code changes required

## [1.8.1] - 2026-03-11

### Added

- **Automated changelog check workflow** (FEAT-022): GitHub Actions workflow that monitors the Claude Code changelog for changes that may impact ASM, automatically creating compatibility tracking issues (#95)
- **YAML linting** (CHORE-030): Integrated `eslint-plugin-yml` into ESLint flat config; YAML files (`.github/workflows/*.yml`) are now linted via `npm run lint` and `npm run quality` (#114)

### Changed

- **Reduced changelog check false positives** (FEAT-023): Enhanced LLM prompt with architectural boundary descriptions, added source file citation requirement, upgraded analysis model to Sonnet 4.6, and added codebase grep pre-filter (#112)
- **Renamed changelog-check workflow** (CHORE-032): Workflow file renamed to `claude-code-changelog-check` for clarity (#118)
- **Standardized permission error test assertions** (CHORE-028): Consistent assertion style across all API test files (#113)
- **Tightened permission error assertions** (CHORE-029): Test assertions now verify the file/skill path is included in permission error messages (#115)
- **Converted `.catch()` inline assertions** (CHORE-031): Replaced inline `.catch()` assertion patterns with `expect().rejects` style across test suite (#116)

### Fixed

- **ajv ReDoS vulnerability** (CHORE-023): Bumped ajv from 6.12.6 to 6.14.0 to resolve moderate-severity GHSA-2g4f-4pwh-qvx6 (#100)
- **minimatch ReDoS vulnerability**: Added minimatch override to resolve high-severity GHSA-3ppc-4f35-3m26 in eslint, jest, and archiver dependency trees (#97)
- **npm audit vulnerabilities**: Resolved 32 transitive vulnerabilities in eslint and jest dependency trees (#93)

### Compatibility

- Verified compatibility with Claude Code v2.1.63 (#106), v2.1.69 (#107), v2.1.70 (#108), v2.1.71 (#109) — no ASM code changes required

## [1.8.0] - 2026-02-15

### Breaking Changes

- **Removed `agent` template type** (CHORE-013): The `--template agent` scaffold variant has been removed. Skills and subagents are distinct systems — agent-specific scaffolding belongs in `.claude/agents/`, not `.claude/skills/`. Use `basic`, `forked`, `with-hooks`, or `internal` templates instead.
- **Removed `--memory` and `--model` scaffold flags** (CHORE-013): These flags produced agent-only frontmatter fields that are not valid in skill files. Remove `--memory` and `--model` from any scripts or CI commands that use `asm scaffold`.
- **Removed 5 agent-only frontmatter validators** (CHORE-013): The `memory`, `skills`, `model`, `permissionMode`, and `disallowedTools` fields are no longer accepted in skill frontmatter. Skills using these fields will fail the "Allowed properties" validation check. Move agent-specific fields to `.claude/agents/` files instead.

### Added

- **`--license` scaffold flag** (CHORE-013): Set the `license` field in generated SKILL.md frontmatter (e.g., `--license MIT`)
- **`--compatibility` scaffold flag** (CHORE-013): Set the `compatibility` field in generated SKILL.md frontmatter (max 500 chars)
- **`--metadata` scaffold flag** (CHORE-013): Set metadata key-value pairs in generated SKILL.md frontmatter (repeatable, e.g., `--metadata author="Jane Doe"`)
- **Interactive prompts for spec fields** (CHORE-013): `asm scaffold --interactive` now prompts for license, compatibility, and metadata
- **E2E test suite** (FEAT-020): 100 automated end-to-end tests across 8 test files covering all 7 CLI commands (`scaffold`, `validate`, `package`, `install`, `uninstall`, `update`, `list`) plus cross-command lifecycle workflows
- **Manual test plan** (FEAT-020): Structured pre-release test plan with 225+ manual test cases organized by command (`docs/asm/manual-test-plan.md`)
- **Type guard unit tests** (CHORE-014): Tests for all 15 exported type guard functions (`isUpdateSuccess`, `isInstallResult`, `isUninstallSuccess`, and their detailed variants)
- **API test coverage improvements** (CHORE-015, CHORE-016, CHORE-017, CHORE-018, CHORE-019): Added unit tests for error mapping, result transformation, detailed mode, and permission error paths across install, update, uninstall, and scaffold APIs

### Changed

- **Validation pipeline simplified** (CHORE-013): Reduced from 25 checks to 20 by removing 5 agent-only field validators (`memory`, `skills`, `model`, `permissionMode`, `disallowedTools`)
- **`compatibility` max length corrected** (CHORE-013): Increased from 100 to 500 characters to match the agentskills.io specification
- **`argument-hint` scaffold max length corrected** (CHORE-013): Increased from 100 to 200 characters to match the existing validator
- **`license` scaffold cap removed** (CHORE-013): Removed artificial 100-character limit; the agentskills.io spec defines no maximum
- **Interactive scaffold updated** (CHORE-013): Removed `agent` template choice, memory scope prompt, and model selection prompt
- **Interactive metadata prompt redesigned** (CHORE-021): Replaced comma-separated single-line input with a multi-entry loop prompt for better discoverability and per-entry validation

### Fixed

- **Compatibility validation inconsistency** (BUG-001): Interactive prompt now trims whitespace before checking length, matching the CLI's `validateCompatibility()` behavior
- **Metadata comma parsing** (BUG-002): Interactive metadata values containing commas are no longer incorrectly split into separate key-value pairs

### Removed

- `src/validators/disallowed-tools.ts` — agent-only validator
- `src/validators/memory.ts` — agent-only validator
- `src/validators/model.ts` — agent-only validator
- `src/validators/permission-mode.ts` — agent-only validator
- `src/validators/skills.ts` — agent-only validator
- Dead code path in interactive metadata validation (CHORE-020): Removed unreachable silent-skip logic that was guarded by an upstream validator

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
