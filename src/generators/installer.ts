/**
 * Core installation generator for skill packages
 *
 * Handles the installation workflow:
 * 1. Open and validate package
 * 2. Check for existing skill at target
 * 3. Extract package to target directory
 * 4. Run post-installation validation
 * 5. Rollback on failure
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type AdmZip from 'adm-zip';
import {
  openZipArchive,
  getZipEntries,
  getZipRootDirectory,
  getTotalUncompressedSize,
} from '../utils/extractor';
import { validatePackageStructure, validateNameMatch } from './install-validator';
import { validateForPackaging } from './package-validator';
import {
  resolveScope,
  resolveInstallPath,
  validateInstallPath,
  ensureDirectoryExists,
} from '../utils/scope-resolver';
import {
  InstallOptions,
  InstallResult,
  DryRunPreview,
  ExistingSkillInfo,
  FileComparison,
  ExtractedFileInfo,
} from '../types/install';
import { InvalidPackageError, PackageValidationError, FileSystemError } from '../utils/errors';

/**
 * Result when installation requires user confirmation for overwrite
 */
export interface OverwriteRequired {
  /** Indicates overwrite confirmation is needed */
  requiresOverwrite: true;
  /** Name of the existing skill */
  skillName: string;
  /** Path to the existing skill */
  existingPath: string;
  /** File comparison details */
  files: FileComparison[];
}

/**
 * Extract result with statistics
 */
interface ExtractResult {
  /** Number of files extracted */
  fileCount: number;
  /** Total bytes extracted */
  totalSize: number;
  /** List of extracted file paths */
  files: string[];
}

/**
 * Install a skill from a package file
 *
 * @param packagePath - Path to the .skill package file
 * @param options - Installation options
 * @returns Installation result or overwrite requirement
 */
export async function installSkill(
  packagePath: string,
  options: InstallOptions = {}
): Promise<InstallResult | DryRunPreview | OverwriteRequired> {
  const { scope, force = false, dryRun = false } = options;

  // Open the package archive
  let archive: AdmZip;
  try {
    archive = openZipArchive(packagePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new InvalidPackageError(packagePath, `Failed to open package: ${message}`);
  }

  // Validate package structure
  const structureResult = validatePackageStructure(archive);
  if (!structureResult.valid) {
    throw new InvalidPackageError(
      packagePath,
      structureResult.error || 'Invalid package structure'
    );
  }

  // Validate name match
  const nameResult = validateNameMatch(archive);
  if (!nameResult.valid) {
    throw new InvalidPackageError(packagePath, nameResult.error || 'Name mismatch');
  }

  const skillName = structureResult.rootDirectory as string;

  // Resolve installation scope and target path
  const scopeInfo = resolveScope(scope);
  const targetPath = resolveInstallPath(scopeInfo, skillName);

  // Validate target path
  const pathValidation = await validateInstallPath(targetPath);
  if (!pathValidation.valid && pathValidation.exists) {
    // Path exists but is invalid (e.g., it's a file)
    throw new FileSystemError(pathValidation.errors.join('; '));
  }

  // Check for existing skill
  const existingSkill = await checkExistingSkill(targetPath);

  // Handle dry-run mode
  if (dryRun) {
    return createDryRunPreview(archive, skillName, targetPath, existingSkill);
  }

  // Handle existing skill without force flag
  if (existingSkill.exists && !force) {
    const fileComparisons = await compareFiles(archive, skillName, targetPath);
    return {
      requiresOverwrite: true,
      skillName,
      existingPath: targetPath,
      files: fileComparisons,
    };
  }

  // Backup existing skill if overwriting
  let backupPath: string | undefined;
  if (existingSkill.exists) {
    backupPath = await backupExistingSkill(targetPath);
  }

  try {
    // Ensure target directory exists
    await ensureDirectoryExists(targetPath);

    // Extract the skill to target
    const extractResult = await extractSkillToTarget(archive, skillName, targetPath);

    // Run post-installation validation
    const validationResult = await postInstallValidation(targetPath);
    if (!validationResult.valid) {
      // Rollback on validation failure
      await rollbackInstallation(targetPath, backupPath);
      throw new PackageValidationError(
        'Post-installation validation failed',
        validationResult.errors
      );
    }

    // Clean up backup if installation succeeded
    if (backupPath) {
      await cleanupBackup(backupPath);
    }

    return {
      success: true,
      skillPath: targetPath,
      skillName,
      fileCount: extractResult.fileCount,
      size: extractResult.totalSize,
      wasOverwritten: existingSkill.exists,
      errors: [],
    };
  } catch (error) {
    // Rollback on any error
    if (backupPath) {
      await rollbackInstallation(targetPath, backupPath);
    }
    throw error;
  }
}

/**
 * Check if a skill already exists at the target path
 *
 * @param targetPath - Path to check
 * @returns Information about existing skill
 */
export async function checkExistingSkill(targetPath: string): Promise<ExistingSkillInfo> {
  try {
    await fs.access(targetPath);
    const stats = await fs.stat(targetPath);

    if (!stats.isDirectory()) {
      return {
        exists: true,
        path: targetPath,
        files: [],
      };
    }

    // List existing files
    const files = await listFilesRecursively(targetPath);

    return {
      exists: true,
      path: targetPath,
      files,
    };
  } catch {
    return {
      exists: false,
      path: targetPath,
      files: [],
    };
  }
}

/**
 * Backup an existing skill to a temporary directory
 *
 * @param targetPath - Path to the existing skill
 * @returns Path to the backup directory
 */
export async function backupExistingSkill(targetPath: string): Promise<string> {
  const backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-backup-'));

  try {
    await copyDirectory(targetPath, backupDir);
    return backupDir;
  } catch (error) {
    // Clean up partial backup on failure
    await cleanupBackup(backupDir);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new FileSystemError(`Failed to backup existing skill: ${message}`);
  }
}

/**
 * Extract skill files from archive to target directory
 *
 * Extracts files while stripping the root directory from paths,
 * so files end up directly in the target directory.
 *
 * @param archive - The AdmZip instance
 * @param skillName - Name of the skill (root directory in archive)
 * @param targetPath - Target directory path
 * @returns Extraction statistics
 */
export async function extractSkillToTarget(
  archive: AdmZip,
  skillName: string,
  targetPath: string
): Promise<ExtractResult> {
  const entries = getZipEntries(archive);
  const rootPrefix = `${skillName}/`;
  const extractedFiles: string[] = [];
  let totalSize = 0;
  let fileCount = 0;

  for (const entry of entries) {
    // Skip entries not in the skill directory
    if (!entry.entryName.startsWith(rootPrefix)) {
      continue;
    }

    // Get relative path within skill directory
    const relativePath = entry.entryName.slice(rootPrefix.length);

    // Skip empty paths (the root directory itself)
    if (!relativePath) {
      continue;
    }

    const destPath = path.join(targetPath, relativePath);

    if (entry.isDirectory) {
      // Create directory
      await fs.mkdir(destPath, { recursive: true, mode: 0o755 });
    } else {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(destPath), { recursive: true, mode: 0o755 });

      // Extract file content
      const content = entry.getData();
      await fs.writeFile(destPath, content, { mode: 0o644 });

      extractedFiles.push(relativePath);
      totalSize += entry.header.size;
      fileCount++;
    }
  }

  return {
    fileCount,
    totalSize,
    files: extractedFiles,
  };
}

/**
 * Run post-installation validation on the installed skill
 *
 * @param skillPath - Path to the installed skill
 * @returns Validation result
 */
export async function postInstallValidation(
  skillPath: string
): Promise<{ valid: boolean; errors: string[] }> {
  try {
    const result = await validateForPackaging(skillPath, false);
    return {
      valid: result.valid,
      errors: result.errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      errors: [`Post-installation validation failed: ${message}`],
    };
  }
}

/**
 * Rollback an installation by removing the target and restoring backup
 *
 * @param targetPath - Path to the installed skill to remove
 * @param backupPath - Path to the backup to restore (optional)
 */
export async function rollbackInstallation(targetPath: string, backupPath?: string): Promise<void> {
  try {
    // Remove the failed installation
    await fs.rm(targetPath, { recursive: true, force: true });

    // Restore from backup if available
    if (backupPath) {
      await copyDirectory(backupPath, targetPath);
      await cleanupBackup(backupPath);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new FileSystemError(`Rollback failed: ${message}`);
  }
}

/**
 * Clean up a backup directory
 *
 * @param backupPath - Path to the backup to remove
 */
export async function cleanupBackup(backupPath: string): Promise<void> {
  try {
    await fs.rm(backupPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors - temp directories are cleaned up eventually
  }
}

/**
 * Get the skill name from a package archive
 *
 * @param archive - The AdmZip instance
 * @returns Skill name (root directory name)
 */
export function getSkillNameFromPackage(archive: AdmZip): string | null {
  return getZipRootDirectory(archive);
}

/**
 * Calculate the total uncompressed size of a package
 *
 * @param archive - The AdmZip instance
 * @returns Total size in bytes
 */
export function calculateInstallSize(archive: AdmZip): number {
  return getTotalUncompressedSize(archive);
}

/**
 * Create a dry-run preview of what would be installed
 *
 * @param archive - The AdmZip instance
 * @param skillName - Name of the skill
 * @param targetPath - Target installation path
 * @param existingSkill - Information about existing skill
 * @returns Dry-run preview
 */
async function createDryRunPreview(
  archive: AdmZip,
  skillName: string,
  targetPath: string,
  existingSkill: ExistingSkillInfo
): Promise<DryRunPreview> {
  const entries = getZipEntries(archive);
  const rootPrefix = `${skillName}/`;
  const files: ExtractedFileInfo[] = [];
  let totalSize = 0;

  for (const entry of entries) {
    if (!entry.entryName.startsWith(rootPrefix)) {
      continue;
    }

    const relativePath = entry.entryName.slice(rootPrefix.length);
    if (!relativePath) {
      continue;
    }

    files.push({
      path: relativePath,
      size: entry.header.size,
      isDirectory: entry.isDirectory,
    });

    if (!entry.isDirectory) {
      totalSize += entry.header.size;
    }
  }

  // Determine conflicts with existing files
  const conflicts: string[] = [];
  if (existingSkill.exists) {
    for (const file of files) {
      if (!file.isDirectory && existingSkill.files.includes(file.path)) {
        conflicts.push(file.path);
      }
    }
  }

  return {
    skillName,
    targetPath,
    files,
    totalSize,
    wouldOverwrite: existingSkill.exists,
    conflicts,
  };
}

/**
 * Compare package files with existing files at target
 *
 * @param archive - The AdmZip instance
 * @param skillName - Name of the skill
 * @param targetPath - Target directory path
 * @returns File comparison results
 */
async function compareFiles(
  archive: AdmZip,
  skillName: string,
  targetPath: string
): Promise<FileComparison[]> {
  const entries = getZipEntries(archive);
  const rootPrefix = `${skillName}/`;
  const comparisons: FileComparison[] = [];

  for (const entry of entries) {
    if (!entry.entryName.startsWith(rootPrefix) || entry.isDirectory) {
      continue;
    }

    const relativePath = entry.entryName.slice(rootPrefix.length);
    if (!relativePath) {
      continue;
    }

    const targetFilePath = path.join(targetPath, relativePath);
    let existsInTarget = false;
    let targetSize: number | undefined;
    let wouldModify = false;

    try {
      const stats = await fs.stat(targetFilePath);
      existsInTarget = true;
      targetSize = stats.size;
      // File would be modified if sizes differ
      wouldModify = stats.size !== entry.header.size;
    } catch {
      // File doesn't exist
      wouldModify = true; // New file counts as modification
    }

    comparisons.push({
      path: relativePath,
      existsInTarget,
      packageSize: entry.header.size,
      targetSize,
      wouldModify,
    });
  }

  return comparisons;
}

/**
 * List all files recursively in a directory
 *
 * @param dirPath - Directory to list
 * @param basePath - Base path for relative paths (defaults to dirPath)
 * @returns List of relative file paths
 */
async function listFilesRecursively(
  dirPath: string,
  basePath: string = dirPath
): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      if (entry.isDirectory()) {
        const subFiles = await listFilesRecursively(fullPath, basePath);
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }
  } catch {
    // Ignore errors reading directory
  }

  return files;
}

/**
 * Copy a directory recursively
 *
 * @param src - Source directory
 * @param dest - Destination directory
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Check if a result is an OverwriteRequired object
 */
export function isOverwriteRequired(
  result: InstallResult | DryRunPreview | OverwriteRequired
): result is OverwriteRequired {
  return 'requiresOverwrite' in result && result.requiresOverwrite === true;
}

/**
 * Check if a result is a DryRunPreview object
 */
export function isDryRunPreview(
  result: InstallResult | DryRunPreview | OverwriteRequired
): result is DryRunPreview {
  return 'wouldOverwrite' in result && !('success' in result);
}

/**
 * Check if a result is an InstallResult object
 */
export function isInstallResult(
  result: InstallResult | DryRunPreview | OverwriteRequired
): result is InstallResult {
  return 'success' in result;
}
