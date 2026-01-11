/**
 * Public createPackage API function.
 *
 * Creates a .skill package file from a skill directory.
 * Validates the skill before packaging unless skipValidation is set.
 *
 * @module api/package
 */

import { PackageOptions, PackageResult, ValidationIssue } from '../types/api';
import { ValidationError, PackageError, FileSystemError } from '../errors';
import { checkAborted } from '../utils/abort-signal';
import { hasErrorCode } from '../utils/error-helpers';
import { validate } from './validate';
import {
  generatePackage,
  resolveOutputPath,
  checkForOverwrite,
  getPackageName,
} from '../generators/packager';
import { PackageOptions as GeneratorPackageOptions } from '../types/package';

/**
 * Creates a .skill package from a skill directory.
 *
 * This function:
 * 1. Validates the skill (unless `skipValidation` is true)
 * 2. Creates a .skill package (ZIP archive) containing the skill files
 * 3. Returns the package path and size
 *
 * The package file name is derived from the skill name and placed in the
 * specified output directory (or current directory by default).
 *
 * @param options - Configuration for creating the package
 * @returns Result with the package path and size
 * @throws ValidationError if the skill fails validation (unless skipValidation is true)
 * @throws PackageError for packaging failures
 * @throws FileSystemError for permission errors or directory issues
 * @throws CancellationError if the operation is cancelled via signal
 *
 * @example
 * ```typescript
 * import { createPackage, ValidationError } from 'ai-skills-manager';
 *
 * // Create a package with validation
 * const result = await createPackage({
 *   path: './my-skill'
 * });
 * console.log(`Package created: ${result.packagePath} (${result.size} bytes)`);
 *
 * // Skip validation
 * const result2 = await createPackage({
 *   path: './my-skill',
 *   skipValidation: true
 * });
 *
 * // Specify output directory
 * const result3 = await createPackage({
 *   path: './my-skill',
 *   output: './packages'
 * });
 *
 * // Force overwrite existing package
 * const result4 = await createPackage({
 *   path: './my-skill',
 *   force: true
 * });
 *
 * // With cancellation support
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 5000);
 *
 * try {
 *   await createPackage({
 *     path: './my-skill',
 *     signal: controller.signal
 *   });
 * } catch (e) {
 *   if (e instanceof CancellationError) {
 *     console.log('Packaging was cancelled');
 *   }
 * }
 *
 * // Handle validation errors
 * try {
 *   await createPackage({ path: './invalid-skill' });
 * } catch (e) {
 *   if (e instanceof ValidationError) {
 *     for (const issue of e.issues) {
 *       console.error(`[${issue.code}] ${issue.message}`);
 *     }
 *   }
 * }
 * ```
 */
export async function createPackage(options: PackageOptions): Promise<PackageResult> {
  const { path, output, skipValidation = false, force = false, signal } = options;

  // Check for cancellation at start
  checkAborted(signal);

  // Step 1: Validate the skill (unless skipped)
  if (!skipValidation) {
    const validationResult = await validate(path);

    // Check for cancellation after validation
    checkAborted(signal);

    if (!validationResult.valid) {
      // Transform validation errors to ValidationIssue array for the error
      const issues: ValidationIssue[] = validationResult.errors;
      throw new ValidationError('Skill validation failed', issues);
    }
  }

  // Step 2: Check if output file exists (before attempting to package)
  const packageName = getPackageName(path);
  const packagePath = resolveOutputPath(output, packageName);

  const overwriteCheck = await checkForOverwrite(packagePath);
  if (overwriteCheck.exists && !force) {
    throw new FileSystemError(
      `Package already exists: ${packagePath}. Use force: true to overwrite.`,
      packagePath
    );
  }

  // Check for cancellation before packaging
  checkAborted(signal);

  // Step 3: Create the package
  try {
    const generatorOptions: GeneratorPackageOptions = {
      outputPath: output,
      force,
      skipValidation: true, // We already validated above
    };

    const result = await generatePackage(path, generatorOptions);

    // Check for cancellation after packaging
    checkAborted(signal);

    // Handle the generator result
    if (!result.success || !result.packagePath) {
      // The generator can return success: false for various reasons
      // Since we already checked for overwrite, this would be an unexpected error
      const errorMessage = result.errors[0] || 'Unknown packaging error';
      throw new PackageError(errorMessage);
    }

    return {
      packagePath: result.packagePath,
      size: result.size,
      fileCount: result.fileCount,
    };
  } catch (error) {
    // Re-throw our own errors
    if (
      error instanceof ValidationError ||
      error instanceof PackageError ||
      error instanceof FileSystemError
    ) {
      throw error;
    }

    // Check if it's a CancellationError (re-throw)
    if (error instanceof Error && error.name === 'CancellationError') {
      throw error;
    }

    // Handle filesystem errors
    if (hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM')) {
      throw new FileSystemError(`Permission denied: "${path}"`, path);
    }

    if (hasErrorCode(error, 'ENOENT')) {
      throw new FileSystemError(`Skill directory not found: "${path}"`, path);
    }

    // Wrap other errors as PackageError
    const message = error instanceof Error ? error.message : String(error);
    throw new PackageError(`Failed to create package: ${message}`);
  }
}
