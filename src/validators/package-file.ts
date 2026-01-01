/**
 * Package file validation for skill installation
 *
 * Validates that a .skill package file:
 * 1. Exists and is accessible
 * 2. Has the correct .skill extension
 * 3. Is a valid ZIP archive
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { isValidZipArchive } from '../utils/extractor';

/**
 * Result of a package file validation check
 */
export interface PackageFileValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Resolved absolute path to the package file */
  packagePath?: string;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Validate that a package file exists and is accessible
 *
 * @param packagePath - Path to the .skill package file
 * @returns Validation result indicating if the file exists
 */
export async function validatePackageExists(
  packagePath: string
): Promise<PackageFileValidationResult> {
  // Handle empty path
  if (!packagePath || packagePath.trim() === '') {
    return {
      valid: false,
      error: 'Package path cannot be empty',
    };
  }

  // Resolve to absolute path
  const absolutePath = path.resolve(packagePath);

  // Check if file exists and is accessible
  try {
    const stats = await fs.stat(absolutePath);

    if (!stats.isFile()) {
      return {
        valid: false,
        packagePath: absolutePath,
        error: `Path is not a file: ${absolutePath}`,
      };
    }

    return {
      valid: true,
      packagePath: absolutePath,
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return {
        valid: false,
        packagePath: absolutePath,
        error: `Package file not found: ${absolutePath}`,
      };
    }

    if (nodeError.code === 'EACCES') {
      return {
        valid: false,
        packagePath: absolutePath,
        error: `Permission denied: ${absolutePath}`,
      };
    }

    return {
      valid: false,
      packagePath: absolutePath,
      error: `Failed to access package file: ${nodeError.message}`,
    };
  }
}

/**
 * Validate that a package file has the .skill extension
 *
 * @param packagePath - Path to the package file
 * @returns Validation result indicating if the extension is correct
 */
export function validatePackageExtension(packagePath: string): PackageFileValidationResult {
  // Handle empty path
  if (!packagePath || packagePath.trim() === '') {
    return {
      valid: false,
      error: 'Package path cannot be empty',
    };
  }

  const absolutePath = path.resolve(packagePath);
  const extension = path.extname(absolutePath).toLowerCase();

  if (extension !== '.skill') {
    return {
      valid: false,
      packagePath: absolutePath,
      error: `Invalid package extension "${extension}". Expected ".skill"`,
    };
  }

  return {
    valid: true,
    packagePath: absolutePath,
  };
}

/**
 * Validate that a package file is a valid ZIP archive
 *
 * @param packagePath - Path to the package file
 * @returns Validation result indicating if the file is a valid ZIP
 */
export function validatePackageFormat(packagePath: string): PackageFileValidationResult {
  // Handle empty path
  if (!packagePath || packagePath.trim() === '') {
    return {
      valid: false,
      error: 'Package path cannot be empty',
    };
  }

  const absolutePath = path.resolve(packagePath);

  try {
    const isValid = isValidZipArchive(absolutePath);

    if (!isValid) {
      return {
        valid: false,
        packagePath: absolutePath,
        error: 'Package file is not a valid ZIP archive',
      };
    }

    return {
      valid: true,
      packagePath: absolutePath,
    };
  } catch (error) {
    const err = error as Error;
    return {
      valid: false,
      packagePath: absolutePath,
      error: `Failed to validate package format: ${err.message}`,
    };
  }
}

/**
 * Perform all package file validations in sequence
 *
 * Validates:
 * 1. File exists and is accessible
 * 2. File has .skill extension
 * 3. File is a valid ZIP archive
 *
 * @param packagePath - Path to the .skill package file
 * @returns Validation result with the first error encountered, or success
 */
export async function validatePackageFile(
  packagePath: string
): Promise<PackageFileValidationResult> {
  // Check if file exists
  const existsResult = await validatePackageExists(packagePath);
  if (!existsResult.valid) {
    return existsResult;
  }

  const absolutePath = existsResult.packagePath as string;

  // Check extension
  const extensionResult = validatePackageExtension(absolutePath);
  if (!extensionResult.valid) {
    return extensionResult;
  }

  // Check ZIP format
  const formatResult = validatePackageFormat(absolutePath);
  if (!formatResult.valid) {
    return formatResult;
  }

  return {
    valid: true,
    packagePath: absolutePath,
  };
}
