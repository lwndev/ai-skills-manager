/**
 * Pre-removal validation for uninstall operations
 *
 * This module provides validation checks that run before skill removal.
 * These are primarily informational - they generate warnings but don't
 * block uninstallation (except for unexpected files which require --force).
 */

import * as path from 'path';
import { validateSkill } from './validate';
import { enumerateSkillFiles } from './file-enumerator';
import { FileInfo } from '../types/uninstall';

/**
 * Result of pre-removal validation
 */
export interface PreRemovalResult {
  /** Whether the skill passed validation (informational only) */
  valid: boolean;
  /** Warnings from validation (displayed to user) */
  warnings: string[];
  /** Skill name from SKILL.md if found */
  skillName?: string;
}

/**
 * Result of unexpected file detection
 */
export type UnexpectedFilesResult = UnexpectedFilesNone | UnexpectedFilesFound;

export interface UnexpectedFilesNone {
  type: 'none';
}

export interface UnexpectedFilesFound {
  type: 'found';
  /** Description of unexpected files found */
  warnings: string[];
  /** List of detected unexpected files/directories */
  detected: UnexpectedFile[];
  /** Whether --force is required to proceed */
  requiresForce: boolean;
}

/**
 * Information about an unexpected file
 */
export interface UnexpectedFile {
  /** Type of unexpected content */
  type: 'git-directory' | 'node-modules' | 'large-binary' | 'temp-file';
  /** Relative path within the skill directory */
  path: string;
  /** Size in bytes (for files) */
  size?: number;
}

/**
 * Threshold for "large binary" detection (10 MB)
 */
const LARGE_BINARY_THRESHOLD = 10 * 1024 * 1024;

/**
 * Patterns for temporary files
 */
const TEMP_FILE_PATTERNS = [
  /\.swp$/,
  /\.swo$/,
  /~$/,
  /^\.DS_Store$/,
  /^Thumbs\.db$/,
  /\.tmp$/,
  /\.temp$/,
];

/**
 * Validate a skill before removal
 *
 * Runs the standard skill validation to check for issues with the skill.
 * This is informational only - warnings are displayed but don't block removal.
 *
 * @param skillPath - Full path to the skill directory
 * @returns Validation result with warnings
 */
export async function validateBeforeRemoval(skillPath: string): Promise<PreRemovalResult> {
  const warnings: string[] = [];
  let skillName: string | undefined;

  try {
    // Run the standard skill validation
    const result = await validateSkill(skillPath);

    skillName = result.skillName;

    if (!result.valid) {
      // Add validation errors as warnings
      for (const error of result.errors) {
        warnings.push(`Validation: ${error}`);
      }
    }

    return {
      valid: result.valid,
      warnings,
      skillName,
    };
  } catch (error) {
    // Validation errors are informational
    const message = error instanceof Error ? error.message : 'Unknown error';
    warnings.push(`Could not validate skill: ${message}`);

    return {
      valid: false,
      warnings,
      skillName,
    };
  }
}

/**
 * Detect unexpected files in a skill directory
 *
 * Checks for files that shouldn't typically be in a skill directory:
 * - .git directory (suggests this is a git repository)
 * - node_modules directory (suggests development dependencies)
 * - Large binaries (>10 MB, suggests bundled assets)
 * - Temporary files (.swp, ~, etc.)
 *
 * Presence of these files requires --force to proceed.
 *
 * @param skillPath - Full path to the skill directory
 * @returns Result indicating whether unexpected files were found
 */
export async function detectUnexpectedFiles(skillPath: string): Promise<UnexpectedFilesResult> {
  const detected: UnexpectedFile[] = [];
  const warnings: string[] = [];

  let hasGitDir = false;
  let hasNodeModules = false;
  let largeBinaryCount = 0;
  let tempFileCount = 0;

  for await (const fileInfo of enumerateSkillFiles(skillPath)) {
    // Check for .git directory
    if (!hasGitDir && isGitDirectory(fileInfo)) {
      hasGitDir = true;
      detected.push({
        type: 'git-directory',
        path: fileInfo.relativePath,
      });
    }

    // Check for node_modules
    if (!hasNodeModules && isNodeModules(fileInfo)) {
      hasNodeModules = true;
      detected.push({
        type: 'node-modules',
        path: fileInfo.relativePath,
      });
    }

    // Check for large binaries (only non-directories, non-symlinks)
    if (!fileInfo.isDirectory && !fileInfo.isSymlink && isLargeBinary(fileInfo)) {
      largeBinaryCount++;
      // Only record first 5 to avoid overwhelming output
      if (detected.filter((d) => d.type === 'large-binary').length < 5) {
        detected.push({
          type: 'large-binary',
          path: fileInfo.relativePath,
          size: fileInfo.size,
        });
      }
    }

    // Check for temp files
    if (!fileInfo.isDirectory && isTempFile(fileInfo)) {
      tempFileCount++;
      // Only record first 5 to avoid overwhelming output
      if (detected.filter((d) => d.type === 'temp-file').length < 5) {
        detected.push({
          type: 'temp-file',
          path: fileInfo.relativePath,
        });
      }
    }
  }

  // Build warnings
  if (hasGitDir) {
    warnings.push(
      'Skill contains a .git directory. ' +
        'This may be a development repository rather than an installed skill.'
    );
  }

  if (hasNodeModules) {
    warnings.push(
      'Skill contains node_modules directory. ' +
        'This may indicate development dependencies that should be removed first.'
    );
  }

  if (largeBinaryCount > 0) {
    warnings.push(
      `Skill contains ${largeBinaryCount} file(s) larger than 10 MB. ` +
        'These may be bundled assets or build artifacts.'
    );
  }

  if (tempFileCount > 0) {
    warnings.push(
      `Skill contains ${tempFileCount} temporary file(s). ` +
        'These should typically be cleaned up before distribution.'
    );
  }

  if (detected.length > 0) {
    return {
      type: 'found',
      warnings,
      detected,
      requiresForce: true,
    };
  }

  return { type: 'none' };
}

/**
 * Check if a file entry is the .git directory
 */
function isGitDirectory(fileInfo: FileInfo): boolean {
  const name = path.basename(fileInfo.relativePath);
  return name === '.git' && fileInfo.isDirectory;
}

/**
 * Check if a file entry is the node_modules directory
 */
function isNodeModules(fileInfo: FileInfo): boolean {
  const name = path.basename(fileInfo.relativePath);
  return name === 'node_modules' && fileInfo.isDirectory;
}

/**
 * Check if a file is a large binary (>10 MB)
 */
function isLargeBinary(fileInfo: FileInfo): boolean {
  return fileInfo.size > LARGE_BINARY_THRESHOLD;
}

/**
 * Check if a file is a temporary file
 */
function isTempFile(fileInfo: FileInfo): boolean {
  const name = path.basename(fileInfo.relativePath);
  return TEMP_FILE_PATTERNS.some((pattern) => pattern.test(name));
}
