/**
 * AI Skills Manager - Programmatic API
 *
 * This module exports the public API for the AI Skills Manager,
 * enabling programmatic access to all skill management operations.
 *
 * @example
 * ```typescript
 * import {
 *   scaffold,
 *   validate,
 *   createPackage,
 *   install,
 *   update,
 *   uninstall,
 *   list,
 *   ValidationError,
 *   FileSystemError,
 * } from 'ai-skills-manager';
 *
 * // Create a new skill
 * const result = await scaffold({
 *   name: 'my-skill',
 *   description: 'A custom skill',
 *   scope: 'project',
 * });
 *
 * // Validate the skill
 * const validation = await validate(result.path);
 * if (!validation.valid) {
 *   console.error('Validation errors:', validation.errors);
 * }
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// API Functions
// ============================================================================

export { scaffold, validate, createPackage, install, update, uninstall, list } from './api';

// ============================================================================
// Error Classes
// ============================================================================

export {
  AsmError,
  ValidationError,
  FileSystemError,
  PackageError,
  SecurityError,
  CancellationError,
} from './errors';

export type { AsmErrorCode } from './errors';

// ============================================================================
// Types
// ============================================================================

// Common types
export type { ApiScope, ApiListScope, InstalledSkillScope } from './types/api';

// Validation types
export type { ValidationIssue, ValidationWarning, ValidateResult } from './types/api';

// Scaffold types
export type { ScaffoldOptions, ScaffoldResult } from './types/api';

// Package types
export type {
  PackageOptions as CreatePackageOptions,
  PackageResult as CreatePackageResult,
} from './types/api';

// Install types
export type { InstallOptions, InstallResult } from './types/api';

// Update types
export type { UpdateOptions, UpdateResult } from './types/api';

// Uninstall types
export type { UninstallOptions, UninstallResult } from './types/api';

// List types
export type { ListOptions, InstalledSkill } from './types/api';
