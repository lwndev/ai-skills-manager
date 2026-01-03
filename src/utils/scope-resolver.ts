/**
 * Scope and path resolution utilities for skill installation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ScopeInfo, PathValidationResult, PathErrorCode } from '../types/scope';

/**
 * Default project skills directory relative to cwd
 */
const PROJECT_SKILLS_DIR = '.claude/skills';

/**
 * Default personal skills directory relative to home
 */
const PERSONAL_SKILLS_DIR = '.claude/skills';

/**
 * Expands tilde (~) to the user's home directory
 * Handles both Unix-style ~/path and Windows-style ~\path
 *
 * @param inputPath - Path that may contain tilde
 * @returns Path with tilde expanded to home directory
 */
export function expandTilde(inputPath: string): string {
  if (!inputPath) {
    return inputPath;
  }

  // Handle ~ at the start of the path
  if (inputPath === '~') {
    return os.homedir();
  }

  // Handle ~/path or ~\path
  if (inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

/**
 * Gets the project skills directory path
 * Returns .claude/skills/ relative to current working directory
 *
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns Absolute path to project skills directory
 */
export function getProjectSkillsDir(cwd?: string): string {
  const workingDir = cwd || process.cwd();
  return path.join(workingDir, PROJECT_SKILLS_DIR);
}

/**
 * Gets the personal skills directory path
 * Returns ~/.claude/skills/ with tilde expanded
 *
 * @param homedir - Home directory override (defaults to os.homedir())
 * @returns Absolute path to personal skills directory
 */
export function getPersonalSkillsDir(homedir?: string): string {
  const home = homedir ?? os.homedir();
  return path.join(home, PERSONAL_SKILLS_DIR);
}

/**
 * Resolves a scope option to a ScopeInfo object
 *
 * @param scope - The scope option value ('project', 'personal', or custom path)
 * @param cwd - Current working directory for project scope (defaults to process.cwd())
 * @param homedir - Home directory for personal scope (defaults to os.homedir())
 * @returns Resolved scope information
 */
export function resolveScope(scope: string | undefined, cwd?: string, homedir?: string): ScopeInfo {
  // Default to project scope if not specified
  if (!scope) {
    return {
      type: 'project',
      path: getProjectSkillsDir(cwd),
    };
  }

  // Handle named scopes
  const normalizedScope = scope.toLowerCase().trim();

  if (normalizedScope === 'project') {
    return {
      type: 'project',
      path: getProjectSkillsDir(cwd),
    };
  }

  if (normalizedScope === 'personal') {
    return {
      type: 'personal',
      path: getPersonalSkillsDir(homedir),
    };
  }

  // Handle custom path
  const expandedPath = expandTilde(scope);
  const absolutePath = path.isAbsolute(expandedPath)
    ? expandedPath
    : path.resolve(cwd || process.cwd(), expandedPath);

  return {
    type: 'custom',
    path: absolutePath,
    originalInput: scope,
  };
}

/**
 * Resolves the full installation path for a skill
 *
 * @param scopeInfo - Resolved scope information
 * @param skillName - Name of the skill to install
 * @returns Full absolute path where the skill will be installed
 */
export function resolveInstallPath(scopeInfo: ScopeInfo, skillName: string): string {
  return path.join(scopeInfo.path, skillName);
}

/**
 * Validates an installation target path
 * Checks if the path exists, is a directory, and is writable
 *
 * @param targetPath - Path to validate
 * @returns Validation result with detailed status
 */
export async function validateInstallPath(targetPath: string): Promise<PathValidationResult> {
  const errors: string[] = [];
  let exists = false;
  let isDirectory = false;
  let writable = false;
  let parentExists = false;

  try {
    // Check if path exists
    const stats = await fs.stat(targetPath);
    exists = true;
    isDirectory = stats.isDirectory();

    if (!isDirectory) {
      errors.push(
        `Path is a file, not a directory: ${targetPath}. ` +
          `Please specify a directory path or remove the existing file.`
      );
      return {
        valid: false,
        exists,
        isDirectory,
        writable: false,
        parentExists: true,
        errors,
      };
    }

    // Check if writable
    try {
      await fs.access(targetPath, fs.constants.W_OK);
      writable = true;
    } catch {
      errors.push(
        `Permission denied: Cannot write to ${targetPath}. ` +
          `Check directory permissions or try a different location.`
      );
    }

    parentExists = true;
  } catch {
    // Path doesn't exist - check parent directory
    const parentDir = path.dirname(targetPath);

    try {
      const parentStats = await fs.stat(parentDir);
      parentExists = parentStats.isDirectory();

      if (!parentExists) {
        errors.push(
          `Parent path is a file, not a directory: ${parentDir}. ` +
            `Please specify a valid directory path.`
        );
      } else {
        // Check if parent is writable (we can create the target)
        try {
          await fs.access(parentDir, fs.constants.W_OK);
          writable = true;
        } catch {
          errors.push(
            `Permission denied: Cannot create directory at ${targetPath}. ` +
              `Check parent directory permissions or try a different location.`
          );
        }
      }
    } catch {
      // Parent doesn't exist - we'll try to create it recursively
      // This is not an error since ensureDirectoryExists can handle it
      parentExists = false;
      writable = true; // Assume writable until proven otherwise
    }
  }

  return {
    valid: errors.length === 0,
    exists,
    isDirectory: isDirectory || !exists, // Non-existent paths are "directories" (will become one)
    writable,
    parentExists,
    errors,
  };
}

/**
 * Ensures a directory exists, creating it recursively if needed
 * Creates with standard directory permissions (755)
 *
 * @param dirPath - Directory path to create
 * @throws FileSystemError if directory cannot be created
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true, mode: 0o755 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to create directory ${dirPath}: ${message}`);
  }
}

/**
 * Gets a human-readable description of a scope
 *
 * @param scopeInfo - Scope information
 * @returns Human-readable scope description
 */
export function getScopeDescription(scopeInfo: ScopeInfo): string {
  switch (scopeInfo.type) {
    case 'project':
      return 'project (.claude/skills/)';
    case 'personal':
      return 'personal (~/.claude/skills/)';
    case 'custom':
      return `custom (${scopeInfo.originalInput || scopeInfo.path})`;
  }
}

/**
 * Normalizes a path for consistent comparison
 * Handles cross-platform differences
 *
 * @param inputPath - Path to normalize
 * @returns Normalized absolute path
 */
export function normalizePath(inputPath: string): string {
  const expanded = expandTilde(inputPath);
  return path.normalize(path.resolve(expanded));
}

/**
 * Checks if a path is within another path (for security validation)
 *
 * @param childPath - Potential child path
 * @param parentPath - Potential parent path
 * @returns True if childPath is within parentPath
 */
export function isPathWithin(childPath: string, parentPath: string): boolean {
  const normalizedChild = normalizePath(childPath);
  const normalizedParent = normalizePath(parentPath);

  // Ensure parent path ends with separator for accurate prefix matching
  const parentWithSep = normalizedParent.endsWith(path.sep)
    ? normalizedParent
    : normalizedParent + path.sep;

  return normalizedChild.startsWith(parentWithSep) || normalizedChild === normalizedParent;
}

/**
 * Gets appropriate error code for a path validation error
 *
 * @param error - Error message
 * @returns Appropriate error code
 */
export function getPathErrorCode(error: string): PathErrorCode {
  if (error.includes('is a file')) {
    return PathErrorCode.PATH_IS_FILE;
  }
  if (error.includes('Permission denied')) {
    return PathErrorCode.PERMISSION_DENIED;
  }
  if (error.includes('Parent') || error.includes('not found')) {
    return PathErrorCode.PARENT_NOT_FOUND;
  }
  return PathErrorCode.INVALID_PATH;
}
