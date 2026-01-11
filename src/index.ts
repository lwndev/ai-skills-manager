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
export type {
  ValidationIssue,
  ValidationWarning,
  ValidateResult,
  ValidateOptions,
  DetailedValidateResult,
  ValidationCheckName,
  ValidationCheckResult,
} from './types/api';

// Scaffold types
export type { ScaffoldOptions, ScaffoldResult } from './types/api';

// Package types
export type {
  PackageOptions as CreatePackageOptions,
  PackageResult as CreatePackageResult,
} from './types/api';

// Install types
export type {
  InstallOptions,
  InstallResult,
  DetailedInstallResult,
  DetailedInstallSuccess,
  DetailedInstallDryRunPreview,
  DetailedInstallOverwriteRequired,
  InstallFileInfo,
  InstallFileComparison,
} from './types/api';

// Install type guards
export {
  isInstallResult,
  isDryRunPreview,
  isOverwriteRequired,
  isDetailedInstallSuccess,
  isDetailedInstallDryRunPreview,
  isDetailedInstallOverwriteRequired,
} from './api/install';

// Update types
export type {
  UpdateOptions,
  UpdateResult,
  DetailedUpdateResult,
  DetailedUpdateSuccess,
  DetailedUpdateDryRunPreview,
  DetailedUpdateRolledBack,
  DetailedUpdateRollbackFailed,
  DetailedUpdateCancelled,
  UpdateFileChange,
  UpdateVersionInfo,
  UpdateVersionComparison,
} from './types/api';

// Update type guards
export {
  isUpdateSuccess,
  isUpdateDryRunPreview,
  isUpdateRolledBack,
  isUpdateRollbackFailed,
  isUpdateCancelled,
  isDetailedUpdateSuccess,
  isDetailedUpdateDryRunPreview,
  isDetailedUpdateRolledBack,
  isDetailedUpdateRollbackFailed,
  isDetailedUpdateCancelled,
} from './api/update';

// Uninstall types
export type {
  UninstallOptions,
  UninstallResult,
  DetailedUninstallResult,
  DetailedUninstallSuccess,
  DetailedUninstallNotFound,
  DetailedUninstallDryRunPreview,
  UninstallFileInfo,
} from './types/api';

// Uninstall type guards
export { isUninstallSuccess, isUninstallNotFound, isUninstallDryRunPreview } from './api/uninstall';

// List types
export type { ListOptions, InstalledSkill } from './types/api';
