/**
 * Public install API function.
 *
 * Installs a skill from a .skill package file.
 * Validates the package and extracts it to the target directory.
 *
 * @module api/install
 */

import {
  InstallOptions as ApiInstallOptions,
  InstallResult as ApiInstallResult,
  DetailedInstallResult,
  DetailedInstallSuccess,
  DetailedInstallDryRunPreview,
  DetailedInstallOverwriteRequired,
  InstallFileInfo,
  InstallFileComparison,
} from '../types/api';
import { PackageError, FileSystemError, SecurityError, CancellationError } from '../errors';
import { checkAborted } from '../utils/abort-signal';
import { hasErrorCode } from '../utils/error-helpers';
import { validateSkillName } from '../utils/skill-name-validation';
import {
  installSkill,
  isInstallResult as isInternalInstallResult,
  isDryRunPreview as isInternalDryRunPreview,
  isOverwriteRequired as isInternalOverwriteRequired,
} from '../generators/installer';
import { InstallOptions as GeneratorInstallOptions } from '../types/install';

// Disable no-redeclare for TypeScript function overloads
/* eslint-disable no-redeclare */

/**
 * Installs a skill from a .skill package file.
 *
 * @param options - Configuration with `detailed: true` to get detailed results
 * @returns Detailed result with discriminated union for type-safe handling
 *
 * @example
 * ```typescript
 * import { install, isInstallResult, isDryRunPreview, isOverwriteRequired } from 'ai-skills-manager';
 *
 * // Get detailed results for CLI output
 * const result = await install({
 *   file: './my-skill.skill',
 *   detailed: true
 * });
 *
 * if (result.type === 'install-success') {
 *   console.log(`Installed ${result.skillName}: ${result.fileCount} files`);
 * } else if (result.type === 'install-dry-run-preview') {
 *   console.log(`Would install ${result.skillName} to ${result.targetPath}`);
 * } else if (result.type === 'install-overwrite-required') {
 *   console.log(`Skill ${result.skillName} already exists at ${result.existingPath}`);
 * }
 * ```
 */
export async function install(
  options: ApiInstallOptions & { detailed: true }
): Promise<DetailedInstallResult>;

/**
 * Installs a skill from a .skill package file.
 *
 * @param options - Configuration for the installation
 * @returns Simple result with the installed path, skill name, and version
 *
 * @example
 * ```typescript
 * import { install, FileSystemError, PackageError } from 'ai-skills-manager';
 *
 * // Basic installation (default simple mode)
 * const result = await install({
 *   file: './my-skill.skill'
 * });
 * console.log(`Installed ${result.skillName} to ${result.installedPath}`);
 * ```
 */
export async function install(
  options: ApiInstallOptions & { detailed?: false }
): Promise<ApiInstallResult>;

/**
 * Installs a skill from a .skill package file.
 *
 * This function:
 * 1. Validates the package structure
 * 2. Extracts the package to the target directory
 * 3. Runs post-installation validation
 * 4. Rolls back on failure
 *
 * @param options - Configuration for the installation
 * @returns Result with the installed path, skill name, and version
 * @throws PackageError for invalid or corrupted packages
 * @throws FileSystemError for permission errors or if skill already exists (without force)
 * @throws SecurityError for path traversal attempts
 * @throws CancellationError if the operation is cancelled via signal
 */
export async function install(
  options: ApiInstallOptions
): Promise<ApiInstallResult | DetailedInstallResult> {
  const {
    file,
    scope,
    targetPath,
    force = false,
    dryRun = false,
    signal,
    detailed = false,
  } = options;

  // Check for cancellation at start
  checkAborted(signal);

  // Build generator options
  const generatorOptions: GeneratorInstallOptions = {
    scope: targetPath || scope,
    force,
    dryRun,
  };

  try {
    // Check for cancellation before calling generator
    checkAborted(signal);

    // Call the generator
    const result = await installSkill(file, generatorOptions);

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
      error instanceof CancellationError
    ) {
      throw error;
    }

    // Check if it's an internal CancellationError (re-throw)
    if (error instanceof Error && error.name === 'CancellationError') {
      throw new CancellationError(error.message);
    }

    // Handle filesystem errors
    if (hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM')) {
      throw new FileSystemError(`Permission denied: "${file}"`, file);
    }

    if (hasErrorCode(error, 'ENOENT')) {
      throw new FileSystemError(`Package file not found: "${file}"`, file);
    }

    // Handle internal package errors
    if (error instanceof Error) {
      const message = error.message;

      // Map internal errors to public error types
      if (
        message.includes('Invalid package') ||
        message.includes('Failed to open package') ||
        message.includes('Name mismatch')
      ) {
        throw new PackageError(message);
      }

      if (message.includes('Path traversal')) {
        throw new SecurityError(message);
      }

      if (
        message.includes('Post-installation validation failed') ||
        message.includes('Failed to')
      ) {
        throw new PackageError(message);
      }
    }

    // Wrap other errors as PackageError
    const message = error instanceof Error ? error.message : String(error);
    throw new PackageError(`Installation failed: ${message}`);
  }
}

/**
 * Transform generator result to simple API result.
 */
function transformToSimpleResult(
  result: ReturnType<typeof installSkill> extends Promise<infer T> ? T : never
): ApiInstallResult {
  // Handle dry-run preview result
  if (isInternalDryRunPreview(result)) {
    // Validate skill name for security
    validateSkillName(result.skillName);

    return {
      installedPath: result.targetPath,
      skillName: result.skillName,
      version: undefined, // Dry run doesn't extract version
      dryRun: true,
    };
  }

  // Handle overwrite-required result
  if (isInternalOverwriteRequired(result)) {
    // Validate skill name for security
    validateSkillName(result.skillName);

    throw new FileSystemError(
      `Skill "${result.skillName}" already exists at ${result.existingPath}. Use force: true to overwrite.`,
      result.existingPath
    );
  }

  // Handle successful installation result
  if (isInternalInstallResult(result)) {
    // Validate skill name for security
    validateSkillName(result.skillName);

    return {
      installedPath: result.skillPath,
      skillName: result.skillName,
      version: undefined, // Version extraction is not implemented in the generator
      dryRun: false,
    };
  }

  // Should never reach here due to exhaustive type checking
  throw new PackageError('Unexpected installation result');
}

/**
 * Transform generator result to detailed API result.
 */
function transformToDetailedResult(
  result: ReturnType<typeof installSkill> extends Promise<infer T> ? T : never
): DetailedInstallResult {
  // Handle dry-run preview result
  if (isInternalDryRunPreview(result)) {
    // Validate skill name for security
    validateSkillName(result.skillName);

    const files: InstallFileInfo[] = result.files.map((f) => ({
      path: f.path,
      size: f.size,
      isDirectory: f.isDirectory,
    }));

    const preview: DetailedInstallDryRunPreview = {
      type: 'install-dry-run-preview',
      skillName: result.skillName,
      targetPath: result.targetPath,
      files,
      totalSize: result.totalSize,
      wouldOverwrite: result.wouldOverwrite,
      conflicts: result.conflicts,
    };
    return preview;
  }

  // Handle overwrite-required result
  if (isInternalOverwriteRequired(result)) {
    // Validate skill name for security
    validateSkillName(result.skillName);

    const files: InstallFileComparison[] = result.files.map((f) => ({
      path: f.path,
      existsInTarget: f.existsInTarget,
      packageSize: f.packageSize,
      targetSize: f.targetSize,
      wouldModify: f.wouldModify,
    }));

    const overwrite: DetailedInstallOverwriteRequired = {
      type: 'install-overwrite-required',
      skillName: result.skillName,
      existingPath: result.existingPath,
      files,
    };
    return overwrite;
  }

  // Handle successful installation result
  if (isInternalInstallResult(result)) {
    // Validate skill name for security
    validateSkillName(result.skillName);

    const success: DetailedInstallSuccess = {
      type: 'install-success',
      skillPath: result.skillPath,
      skillName: result.skillName,
      fileCount: result.fileCount,
      size: result.size,
      wasOverwritten: result.wasOverwritten,
    };
    return success;
  }

  // Should never reach here due to exhaustive type checking
  throw new PackageError('Unexpected installation result');
}

// Export type guards for consumers
export { isInternalInstallResult as isInstallResult };
export { isInternalDryRunPreview as isDryRunPreview };
export { isInternalOverwriteRequired as isOverwriteRequired };

/**
 * Type guard for DetailedInstallSuccess.
 */
export function isDetailedInstallSuccess(
  result: DetailedInstallResult
): result is DetailedInstallSuccess {
  return result.type === 'install-success';
}

/**
 * Type guard for DetailedInstallDryRunPreview.
 */
export function isDetailedInstallDryRunPreview(
  result: DetailedInstallResult
): result is DetailedInstallDryRunPreview {
  return result.type === 'install-dry-run-preview';
}

/**
 * Type guard for DetailedInstallOverwriteRequired.
 */
export function isDetailedInstallOverwriteRequired(
  result: DetailedInstallResult
): result is DetailedInstallOverwriteRequired {
  return result.type === 'install-overwrite-required';
}
