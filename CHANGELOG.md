# Changelog

All notable changes to AI Skills Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
