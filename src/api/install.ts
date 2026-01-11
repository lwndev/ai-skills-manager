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
} from '../types/api';
import { PackageError, FileSystemError, SecurityError, CancellationError } from '../errors';
import { checkAborted } from '../utils/abort-signal';
import { hasErrorCode } from '../utils/error-helpers';
import { validateSkillName } from '../utils/skill-name-validation';
import {
  installSkill,
  isInstallResult,
  isDryRunPreview,
  isOverwriteRequired,
} from '../generators/installer';
import { InstallOptions as GeneratorInstallOptions } from '../types/install';

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
 *
 * @example
 * ```typescript
 * import { install, FileSystemError, PackageError } from 'ai-skills-manager';
 *
 * // Basic installation
 * const result = await install({
 *   file: './my-skill.skill'
 * });
 * console.log(`Installed ${result.skillName} to ${result.installedPath}`);
 *
 * // Install to personal scope
 * const result2 = await install({
 *   file: './my-skill.skill',
 *   scope: 'personal'
 * });
 *
 * // Install to custom path
 * const result3 = await install({
 *   file: './my-skill.skill',
 *   targetPath: '/custom/skills/path'
 * });
 *
 * // Force overwrite existing skill
 * const result4 = await install({
 *   file: './my-skill.skill',
 *   force: true
 * });
 *
 * // Dry run to preview installation
 * const preview = await install({
 *   file: './my-skill.skill',
 *   dryRun: true
 * });
 * console.log(`Would install ${preview.skillName} to ${preview.installedPath}`);
 *
 * // With cancellation support
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 5000);
 *
 * try {
 *   await install({
 *     file: './large-skill.skill',
 *     signal: controller.signal
 *   });
 * } catch (e) {
 *   if (e instanceof CancellationError) {
 *     console.log('Installation was cancelled');
 *   }
 * }
 *
 * // Handle errors
 * try {
 *   await install({ file: './my-skill.skill' });
 * } catch (e) {
 *   if (e instanceof FileSystemError) {
 *     console.error(`File error at ${e.path}: ${e.message}`);
 *   } else if (e instanceof PackageError) {
 *     console.error('Package error:', e.message);
 *   }
 * }
 * ```
 */
export async function install(options: ApiInstallOptions): Promise<ApiInstallResult> {
  const { file, scope, targetPath, force = false, dryRun = false, signal } = options;

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

    // Handle dry-run preview result
    if (isDryRunPreview(result)) {
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
    if (isOverwriteRequired(result)) {
      // Validate skill name for security
      validateSkillName(result.skillName);

      throw new FileSystemError(
        `Skill "${result.skillName}" already exists at ${result.existingPath}. Use force: true to overwrite.`,
        result.existingPath
      );
    }

    // Handle successful installation result
    if (isInstallResult(result)) {
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
