/**
 * Public update API function.
 *
 * Updates an installed skill from a new .skill package file.
 * Creates a backup before updating and supports rollback on failure.
 *
 * @module api/update
 */

import {
  UpdateOptions as ApiUpdateOptions,
  UpdateResult as ApiUpdateResult,
  DetailedUpdateResult,
  DetailedUpdateSuccess,
  DetailedUpdateDryRunPreview,
  DetailedUpdateRolledBack,
  DetailedUpdateRollbackFailed,
  DetailedUpdateCancelled,
  UpdateFileChange,
  UpdateVersionInfo,
  UpdateVersionComparison,
} from '../types/api';
import {
  PackageError,
  FileSystemError,
  SecurityError,
  CancellationError,
  ValidationError,
} from '../errors';
import { checkAborted } from '../utils/abort-signal';
import { hasErrorCode } from '../utils/error-helpers';
import { validateSkillName } from '../utils/skill-name-validation';
import { updateSkill, UpdateError as GeneratorUpdateError } from '../generators/updater';
import { UpdateOptions as GeneratorUpdateOptions, UpdateResultUnion } from '../types/update';

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
 * Type guard functions for result type narrowing.
 */
function isUpdateSuccess(
  result: UpdateResultUnion
): result is { type: 'update-success' } & UpdateResultUnion {
  return result.type === 'update-success';
}

function isUpdateDryRunPreview(
  result: UpdateResultUnion
): result is { type: 'update-dry-run-preview' } & UpdateResultUnion {
  return result.type === 'update-dry-run-preview';
}

function isUpdateRolledBack(
  result: UpdateResultUnion
): result is { type: 'update-rolled-back' } & UpdateResultUnion {
  return result.type === 'update-rolled-back';
}

function isUpdateRollbackFailed(
  result: UpdateResultUnion
): result is { type: 'update-rollback-failed' } & UpdateResultUnion {
  return result.type === 'update-rollback-failed';
}

function isUpdateCancelled(
  result: UpdateResultUnion
): result is { type: 'update-cancelled' } & UpdateResultUnion {
  return result.type === 'update-cancelled';
}

/* eslint-disable no-redeclare */
/**
 * Updates an installed skill from a new .skill package file.
 *
 * @param options - Configuration with `detailed: true` to get detailed results
 * @returns Detailed result with discriminated union for type-safe handling
 *
 * @example
 * ```typescript
 * import { update } from 'ai-skills-manager';
 *
 * // Get detailed results for CLI output
 * const result = await update({
 *   name: 'my-skill',
 *   file: './my-skill-v2.skill',
 *   detailed: true
 * });
 *
 * if (result.type === 'update-success') {
 *   console.log(`Updated ${result.skillName}`);
 * } else if (result.type === 'update-dry-run-preview') {
 *   console.log(`Would update: ${result.comparison.filesModified.length} files`);
 * }
 * ```
 */
export async function update(
  options: ApiUpdateOptions & { detailed: true }
): Promise<DetailedUpdateResult>;

/**
 * Updates an installed skill from a new .skill package file.
 *
 * @param options - Configuration for the update operation
 * @returns Simple result with updated path and version info
 *
 * @example
 * ```typescript
 * import { update } from 'ai-skills-manager';
 *
 * // Simple result (default)
 * const result = await update({
 *   name: 'my-skill',
 *   file: './my-skill-v2.skill'
 * });
 * console.log(`Updated at ${result.updatedPath}`);
 * ```
 */
export async function update(
  options: ApiUpdateOptions & { detailed?: false }
): Promise<ApiUpdateResult>;

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
 */
export async function update(
  options: ApiUpdateOptions
): Promise<ApiUpdateResult | DetailedUpdateResult> {
  /* eslint-enable no-redeclare */
  const {
    name,
    file,
    scope = 'project',
    targetPath,
    force = false,
    dryRun = false,
    keepBackup = false,
    signal,
    detailed = false,
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

    // Handle detailed mode
    if (detailed) {
      return transformToDetailedResult(result);
    }

    // Handle simple mode
    return transformToSimpleResult(result);
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
      throw new FileSystemError(`Permission denied: "${file}"`, file);
    }

    if (hasErrorCode(error, 'ENOENT')) {
      throw new FileSystemError(`File not found: "${file}"`, file);
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

/**
 * Transform generator result to simple API result.
 */
function transformToSimpleResult(result: UpdateResultUnion): ApiUpdateResult {
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
}

/**
 * Transform generator result to detailed API result.
 */
function transformToDetailedResult(result: UpdateResultUnion): DetailedUpdateResult {
  switch (result.type) {
    case 'update-success': {
      const success: DetailedUpdateSuccess = {
        type: 'update-success',
        skillName: result.skillName,
        path: result.path,
        previousFileCount: result.previousFileCount,
        currentFileCount: result.currentFileCount,
        previousSize: result.previousSize,
        currentSize: result.currentSize,
        backupPath: result.backupPath,
        backupWillBeRemoved: result.backupWillBeRemoved,
      };
      return success;
    }

    case 'update-dry-run-preview': {
      // Transform file changes
      const filesAdded: UpdateFileChange[] = result.comparison.filesAdded.map((f) => ({
        path: f.path,
        changeType: 'added' as const,
        sizeBefore: f.sizeBefore,
        sizeAfter: f.sizeAfter,
      }));

      const filesRemoved: UpdateFileChange[] = result.comparison.filesRemoved.map((f) => ({
        path: f.path,
        changeType: 'removed' as const,
        sizeBefore: f.sizeBefore,
        sizeAfter: f.sizeAfter,
      }));

      const filesModified: UpdateFileChange[] = result.comparison.filesModified.map((f) => ({
        path: f.path,
        changeType: 'modified' as const,
        sizeBefore: f.sizeBefore,
        sizeAfter: f.sizeAfter,
      }));

      const currentVersion: UpdateVersionInfo = {
        path: result.currentVersion.path,
        fileCount: result.currentVersion.fileCount,
        size: result.currentVersion.size,
        lastModified: result.currentVersion.lastModified,
      };

      const newVersion: UpdateVersionInfo = {
        path: result.newVersion.path,
        fileCount: result.newVersion.fileCount,
        size: result.newVersion.size,
        lastModified: result.newVersion.lastModified,
      };

      const comparison: UpdateVersionComparison = {
        filesAdded,
        filesRemoved,
        filesModified,
        sizeChange: result.comparison.sizeChange,
      };

      const preview: DetailedUpdateDryRunPreview = {
        type: 'update-dry-run-preview',
        skillName: result.skillName,
        path: result.path,
        currentVersion,
        newVersion,
        comparison,
        backupPath: result.backupPath,
      };
      return preview;
    }

    case 'update-rolled-back': {
      const rolledBack: DetailedUpdateRolledBack = {
        type: 'update-rolled-back',
        skillName: result.skillName,
        path: result.path,
        failureReason: result.failureReason,
        backupPath: result.backupPath,
      };
      return rolledBack;
    }

    case 'update-rollback-failed': {
      const failed: DetailedUpdateRollbackFailed = {
        type: 'update-rollback-failed',
        skillName: result.skillName,
        path: result.path,
        updateFailureReason: result.updateFailureReason,
        rollbackFailureReason: result.rollbackFailureReason,
        backupPath: result.backupPath,
        recoveryInstructions: result.recoveryInstructions,
      };
      return failed;
    }

    case 'update-cancelled': {
      const cancelled: DetailedUpdateCancelled = {
        type: 'update-cancelled',
        skillName: result.skillName,
        reason: result.reason,
        cleanupPerformed: result.cleanupPerformed,
      };
      return cancelled;
    }

    default:
      throw new PackageError('Unexpected update result');
  }
}

// Export type guards for consumers
export { isUpdateSuccess };
export { isUpdateDryRunPreview };
export { isUpdateRolledBack };
export { isUpdateRollbackFailed };
export { isUpdateCancelled };

/**
 * Type guard for DetailedUpdateSuccess.
 */
export function isDetailedUpdateSuccess(
  result: DetailedUpdateResult
): result is DetailedUpdateSuccess {
  return result.type === 'update-success';
}

/**
 * Type guard for DetailedUpdateDryRunPreview.
 */
export function isDetailedUpdateDryRunPreview(
  result: DetailedUpdateResult
): result is DetailedUpdateDryRunPreview {
  return result.type === 'update-dry-run-preview';
}

/**
 * Type guard for DetailedUpdateRolledBack.
 */
export function isDetailedUpdateRolledBack(
  result: DetailedUpdateResult
): result is DetailedUpdateRolledBack {
  return result.type === 'update-rolled-back';
}

/**
 * Type guard for DetailedUpdateRollbackFailed.
 */
export function isDetailedUpdateRollbackFailed(
  result: DetailedUpdateResult
): result is DetailedUpdateRollbackFailed {
  return result.type === 'update-rollback-failed';
}

/**
 * Type guard for DetailedUpdateCancelled.
 */
export function isDetailedUpdateCancelled(
  result: DetailedUpdateResult
): result is DetailedUpdateCancelled {
  return result.type === 'update-cancelled';
}
