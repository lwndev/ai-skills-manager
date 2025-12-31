/**
 * Type definitions for skill packaging
 */

/**
 * Options for the package command
 */
export interface PackageOptions {
  /** Output directory for the package file */
  outputPath?: string;
  /** Force overwrite if package already exists */
  force?: boolean;
  /** Skip pre-package validation */
  skipValidation?: boolean;
  /** Suppress output (quiet mode) */
  quiet?: boolean;
}

/**
 * Result of a packaging operation
 */
export interface PackageResult {
  /** Whether packaging succeeded */
  success: boolean;
  /** Path to the created package file */
  packagePath?: string;
  /** Number of files included in the package */
  fileCount: number;
  /** Total size of the package in bytes */
  size: number;
  /** Error messages if packaging failed */
  errors: string[];
  /** Whether the operation requires user confirmation to overwrite */
  requiresOverwrite?: boolean;
}

/**
 * Represents a file entry in the package
 */
export interface FileEntry {
  /** Relative path of the file within the skill */
  path: string;
  /** Size of the file in bytes */
  size: number;
  /** Whether this file was excluded from the package */
  excluded: boolean;
}

/**
 * File exclusion patterns for packaging
 * These patterns match files/directories that should not be included in packages
 */
export const EXCLUDED_PATTERNS: string[] = [
  '.git/',
  'node_modules/',
  '.DS_Store',
  '*.log',
  '__pycache__/',
  '*.pyc',
];

/**
 * Check if a file path should be excluded from packaging
 * @param filePath - The relative file path to check
 * @returns true if the file should be excluded
 */
export function isExcluded(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of EXCLUDED_PATTERNS) {
    // Directory pattern (ends with /)
    if (pattern.endsWith('/')) {
      const dirName = pattern.slice(0, -1);
      if (
        normalizedPath.startsWith(dirName + '/') ||
        normalizedPath.includes('/' + dirName + '/')
      ) {
        return true;
      }
    }
    // Glob pattern (starts with *)
    else if (pattern.startsWith('*')) {
      const extension = pattern.slice(1);
      if (normalizedPath.endsWith(extension)) {
        return true;
      }
    }
    // Exact match
    else {
      const fileName = normalizedPath.split('/').pop() || '';
      if (fileName === pattern) {
        return true;
      }
    }
  }

  return false;
}
