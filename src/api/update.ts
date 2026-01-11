/**
 * Public update API function.
 *
 * Updates an installed skill from a new .skill package file.
 * Creates a backup before updating and supports rollback on failure.
 *
 * @module api/update
 */

import * as path from 'path';
import { UpdateOptions as ApiUpdateOptions, UpdateResult as ApiUpdateResult } from '../types/api';
import {
  PackageError,
  FileSystemError,
  SecurityError,
  CancellationError,
  ValidationError,
} from '../errors';
import { checkAborted } from '../utils/abort-signal';
import { updateSkill, UpdateError as GeneratorUpdateError } from '../generators/updater';
import { UpdateOptions as GeneratorUpdateOptions, UpdateResultUnion } from '../types/update';

/**
 * Checks if an error has a specific error code.
 */
function hasErrorCode(error: unknown, code: string): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === code;
}

/**
 * Validates a skill name for security.
 * Rejects names that could be used for path traversal.
 */
function validateSkillName(name: string): void {
  // Check for path traversal attempts
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new SecurityError(`Invalid skill name: "${name}" contains path traversal characters`);
  }

  // Check for absolute path indicators
  if (path.isAbsolute(name)) {
    throw new SecurityError(`Invalid skill name: "${name}" appears to be an absolute path`);
  }
}

/**
 * Maps internal update error to public error types.
 */
function mapUpdateError(error: GeneratorUpdateError): Error {
  const updateError = error.updateError;

  switch (updateError.type) {
    case 'skill-not-found':
      return new FileSystemError(
        `Skill "${updateError.skillName}" not found at ${updateError.searchedPath}`,
        updateError.searchedPath
      );

    case 'security-error':
      return new SecurityError(
        `Security violation (${updateError.reason}): ${updateError.details}`
      );

    case 'filesystem-error':
      return new FileSystemError(
        `File system error during ${updateError.operation}: ${updateError.message}`,
        updateError.path
      );

    case 'validation-error':
      // Package content errors should be PackageError
      if (updateError.field === 'packageContent' || updateError.field === 'packagePath') {
        return new PackageError(updateError.message);
      }
      return new ValidationError(updateError.message, [
        {
          code: `INVALID_${updateError.field.toUpperCase()}`,
          message: updateError.message,
          path: updateError.details?.[0],
        },
      ]);

    case 'package-mismatch':
      return new PackageError(updateError.message);

    case 'backup-creation-error':
      return new FileSystemError(
        `Backup creation failed: ${updateError.reason}`,
        updateError.backupPath
      );

    case 'rollback-error':
      // Update failed but rollback succeeded - report the update failure
      return new PackageError(`Update failed: ${updateError.updateFailureReason}`);

    case 'critical-error':
      // Both update and rollback failed - critical error
      return new FileSystemError(
        `Critical error: Update failed (${updateError.updateFailureReason}) and rollback also failed (${updateError.rollbackFailureReason}). ${updateError.recoveryInstructions}`,
        updateError.skillPath
      );

    case 'timeout':
      return new FileSystemError(
        `Operation '${updateError.operationName}' timed out after ${updateError.timeoutMs}ms`,
        updateError.operationName
      );

    default:
      return new PackageError('Unknown update error');
  }
}

/**
 * Updates an installed skill from a new .skill package file.
 *
 * This function:
 * 1. Finds the existing skill installation
 * 2. Creates a backup before updating
 * 3. Validates the new package
 * 4. Replaces the installed skill with the new version
 * 5. Rolls back on failure (restores from backup)
 *
 * @param options - Configuration for the update
 * @returns Result with the updated path, versions, and backup info
 * @throws FileSystemError if skill not found or permission errors
 * @throws PackageError for invalid packages or update failures
 * @throws SecurityError for invalid skill names or path traversal
 * @throws ValidationError if the new package fails validation
 * @throws CancellationError if the operation is cancelled via signal
 *
 * @example
 * ```typescript
 * import { update, FileSystemError, PackageError } from 'ai-skills-manager';
 *
 * // Basic update
 * const result = await update({
 *   name: 'my-skill',
 *   file: './my-skill-v2.skill'
 * });
 * console.log(`Updated ${result.updatedPath}`);
 *
 * // Update in personal scope
 * const result2 = await update({
 *   name: 'my-skill',
 *   file: './my-skill-v2.skill',
 *   scope: 'personal'
 * });
 *
 * // Force update (skip confirmation, allow downgrade)
 * const result3 = await update({
 *   name: 'my-skill',
 *   file: './my-skill-older.skill',
 *   force: true
 * });
 *
 * // Dry run to preview update
 * const preview = await update({
 *   name: 'my-skill',
 *   file: './my-skill-v2.skill',
 *   dryRun: true
 * });
 * console.log(`Would update to ${preview.updatedPath}`);
 *
 * // Keep backup after update
 * const result4 = await update({
 *   name: 'my-skill',
 *   file: './my-skill-v2.skill',
 *   keepBackup: true
 * });
 * console.log(`Backup at: ${result4.backupPath}`);
 *
 * // With cancellation support
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 5000);
 *
 * try {
 *   await update({
 *     name: 'my-skill',
 *     file: './my-skill-v2.skill',
 *     signal: controller.signal
 *   });
 * } catch (e) {
 *   if (e instanceof CancellationError) {
 *     console.log('Update was cancelled');
 *   }
 * }
 *
 * // Handle errors
 * try {
 *   await update({
 *     name: 'my-skill',
 *     file: './my-skill-v2.skill'
 *   });
 * } catch (e) {
 *   if (e instanceof FileSystemError) {
 *     console.error(`File error at ${e.path}: ${e.message}`);
 *   } else if (e instanceof PackageError) {
 *     console.error('Package error:', e.message);
 *   }
 * }
 * ```
 */
export async function update(options: ApiUpdateOptions): Promise<ApiUpdateResult> {
  const {
    name,
    file,
    scope = 'project',
    targetPath,
    force = false,
    dryRun = false,
    keepBackup = false,
    signal,
  } = options;

  // Check for cancellation at start
  checkAborted(signal);

  // Validate skill name for security
  validateSkillName(name);

  // Build generator options
  // Pass targetPath as scope if provided; generator now supports custom paths
  const generatorOptions: GeneratorUpdateOptions = {
    scope: targetPath || scope,
    force,
    dryRun,
    quiet: true, // API never outputs to console
    noBackup: false, // Always create backup in API mode
    keepBackup,
  };

  try {
    // Check for cancellation before calling generator
    checkAborted(signal);

    // Call the generator
    const result: UpdateResultUnion = await updateSkill(name, file, generatorOptions);

    // Check for cancellation after generator completes
    checkAborted(signal);

    // Handle result based on type discriminant
    switch (result.type) {
      case 'update-success':
        return {
          updatedPath: result.path,
          previousVersion: undefined, // Version extraction not yet implemented
          newVersion: undefined,
          backupPath: result.backupPath,
          dryRun: false,
        };

      case 'update-dry-run-preview':
        return {
          updatedPath: result.path,
          previousVersion: undefined,
          newVersion: undefined,
          backupPath: result.backupPath,
          dryRun: true,
        };

      case 'update-cancelled':
        throw new CancellationError(
          result.reason === 'user-cancelled' ? 'Update cancelled by user' : 'Update was interrupted'
        );

      case 'update-rolled-back':
        // Update failed but rollback succeeded
        throw new PackageError(
          `Update failed: ${result.failureReason}. ` +
            `Skill restored to previous version.` +
            (result.backupPath ? ` Backup available at: ${result.backupPath}` : '')
        );

      case 'update-rollback-failed':
        // Critical: both update and rollback failed
        throw new FileSystemError(
          `Critical error: Update failed (${result.updateFailureReason}) and ` +
            `rollback also failed (${result.rollbackFailureReason}). ` +
            result.recoveryInstructions,
          result.path
        );

      default:
        throw new PackageError('Unexpected update result');
    }
  } catch (error) {
    // Re-throw our own errors
    if (
      error instanceof PackageError ||
      error instanceof FileSystemError ||
      error instanceof SecurityError ||
      error instanceof ValidationError ||
      error instanceof CancellationError
    ) {
      throw error;
    }

    // Handle internal CancellationError (re-throw as public)
    if (error instanceof Error && error.name === 'CancellationError') {
      throw new CancellationError(error.message);
    }

    // Handle generator UpdateError
    if (error instanceof GeneratorUpdateError) {
      throw mapUpdateError(error);
    }

    // Handle filesystem errors
    if (hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM')) {
      throw new FileSystemError(`Permission denied: ${file}`, file);
    }

    if (hasErrorCode(error, 'ENOENT')) {
      throw new FileSystemError(`File not found: ${file}`, file);
    }

    // Handle internal errors
    if (error instanceof Error) {
      const message = error.message;

      // Map internal errors to public error types
      if (
        message.includes('Invalid package') ||
        message.includes('Failed to open package') ||
        message.includes('Name mismatch') ||
        message.includes('Package contains')
      ) {
        throw new PackageError(message);
      }

      if (
        message.includes('Path traversal') ||
        message.includes('Security error') ||
        message.includes('case mismatch')
      ) {
        throw new SecurityError(message);
      }

      if (message.includes('not found') || message.includes('Not found')) {
        throw new FileSystemError(message, file);
      }

      if (message.includes('Validation error') || message.includes('validation failed')) {
        throw new ValidationError(message);
      }
    }

    // Wrap other errors as PackageError
    const message = error instanceof Error ? error.message : String(error);
    throw new PackageError(`Update failed: ${message}`);
  }
}
