/**
 * Core packaging generator for skill packaging
 *
 * Creates .skill files (ZIP archives) from skill directories.
 * Handles validation, file exclusion, overwrite detection, and archive creation.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PackageOptions, PackageResult } from '../types/package';
import { validateForPackaging, PackageValidationResult } from './package-validator';
import { getSkillName } from '../validators/skill-path';
import {
  createZipArchive,
  addDirectoryToArchive,
  finalizeArchive,
  getArchiveSize,
  formatFileSize,
} from '../utils/archiver';
import { PathValidationError, ValidationFailedError, FileSystemError } from '../utils/errors';

/**
 * Result of checking if a package already exists
 */
export interface OverwriteCheckResult {
  /** Whether the file exists and would be overwritten */
  exists: boolean;
  /** The full path to the package file */
  packagePath: string;
}

/**
 * Resolve the output path for the package
 *
 * @param outputDir - Output directory (or undefined for current directory)
 * @param packageName - Name of the package (skill name)
 * @returns Absolute path to the output .skill file
 */
export function resolveOutputPath(outputDir: string | undefined, packageName: string): string {
  const fileName = `${packageName}.skill`;
  const baseDir = outputDir ? path.resolve(outputDir) : process.cwd();
  return path.join(baseDir, fileName);
}

/**
 * Check if a package file already exists
 *
 * @param packagePath - Path where the package would be created
 * @returns Result indicating if overwrite is needed
 */
export async function checkForOverwrite(packagePath: string): Promise<OverwriteCheckResult> {
  try {
    await fs.access(packagePath);
    return { exists: true, packagePath };
  } catch {
    return { exists: false, packagePath };
  }
}

/**
 * Generate a .skill package from a skill directory
 *
 * @param skillPath - Path to skill directory or SKILL.md file
 * @param options - Packaging options
 * @returns Package result with success status and package info
 */
export async function generatePackage(
  skillPath: string,
  options: PackageOptions = {}
): Promise<PackageResult> {
  const { outputPath, force = false, skipValidation = false } = options;

  // Step 1: Validate skill path and content
  const validationResult: PackageValidationResult = await validateForPackaging(
    skillPath,
    skipValidation
  );

  if (!validationResult.valid) {
    // Determine if this is a path error or validation error
    if (!validationResult.skillDir) {
      throw new PathValidationError(validationResult.errors[0] || 'Invalid skill path');
    }
    throw new ValidationFailedError('Skill validation failed', validationResult.errors);
  }

  // At this point, skillDir is defined since validation passed
  const skillDir = validationResult.skillDir as string;
  const skillName = validationResult.skillName || getSkillName(skillDir);

  // Step 2: Determine output path
  const packagePath = resolveOutputPath(outputPath, skillName);

  // Step 3: Check for existing file
  const overwriteCheck = await checkForOverwrite(packagePath);

  if (overwriteCheck.exists && !force) {
    // Return a result indicating overwrite is needed
    // The command layer will handle prompting the user
    return {
      success: false,
      packagePath,
      fileCount: 0,
      size: 0,
      errors: [`Package already exists: ${packagePath}`],
      requiresOverwrite: true,
    };
  }

  // Step 4: Ensure output directory exists
  const outputDir = path.dirname(packagePath);
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    throw new FileSystemError(`Failed to create output directory: ${nodeError.message}`);
  }

  // Step 5: Create ZIP archive
  try {
    const archive = createZipArchive(packagePath);

    // Add skill directory with skill name as root folder in archive
    const fileCount = await addDirectoryToArchive(archive, skillDir, skillName);

    // Finalize the archive
    await finalizeArchive(archive);

    // Step 6: Get package size
    const size = await getArchiveSize(packagePath);

    return {
      success: true,
      packagePath,
      fileCount,
      size,
      errors: [],
    };
  } catch (error) {
    // Clean up partial file on error
    try {
      await fs.unlink(packagePath);
    } catch {
      // Ignore cleanup errors
    }

    const nodeError = error as Error;
    throw new FileSystemError(`Failed to create package: ${nodeError.message}`);
  }
}

/**
 * Format package size for display
 *
 * @param bytes - Size in bytes
 * @returns Human-readable size string
 */
export function calculatePackageSize(bytes: number): string {
  return formatFileSize(bytes);
}

/**
 * Extract package name from skill path
 *
 * Uses the skill directory name as the package name.
 *
 * @param skillPath - Path to skill directory
 * @returns Package name (skill directory basename)
 */
export function getPackageName(skillPath: string): string {
  return getSkillName(path.resolve(skillPath));
}
