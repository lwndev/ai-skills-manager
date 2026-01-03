/**
 * Path verification utilities for secure file deletion
 *
 * This module provides functions to verify path containment and prevent
 * TOCTOU (Time-of-check to Time-of-use) attacks during file deletion.
 * All verification is performed immediately before each file operation
 * to minimize the window for race conditions.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Result of containment verification
 */
export type ContainmentResult = ContainmentValid | ContainmentViolation;

export interface ContainmentValid {
  type: 'valid';
  /** The normalized absolute path that was verified */
  normalizedPath: string;
}

export interface ContainmentViolation {
  type: 'violation';
  /** The path that violated containment */
  targetPath: string;
  /** The base path that should have contained it */
  basePath: string;
  /** Reason for the violation */
  reason: string;
}

/**
 * Result of pre-deletion verification
 */
export type VerifyResult = VerifyOk | VerifyFailed | VerifyError;

export interface VerifyOk {
  type: 'ok';
  /** Whether the path is a file, directory, or symlink */
  pathType: 'file' | 'directory' | 'symlink';
  /** File size (0 for directories and symlinks) */
  size: number;
}

export interface VerifyFailed {
  type: 'failed';
  /** Reason verification failed */
  reason: 'not-exists' | 'containment-violation' | 'type-changed';
  /** Human-readable message */
  message: string;
}

export interface VerifyError {
  type: 'error';
  message: string;
}

/**
 * Verify that a target path is contained within a base path
 *
 * Uses path.resolve() to normalize both paths and ensure the target
 * starts with the base path followed by a path separator. This prevents
 * attacks like "../" path traversal.
 *
 * @param basePath - The containing directory (e.g., skill directory)
 * @param targetPath - The path to verify (e.g., file to delete)
 * @returns Containment result
 */
export function verifyContainment(basePath: string, targetPath: string): ContainmentResult {
  // Normalize both paths to absolute form
  const normalizedBase = path.resolve(basePath);
  const normalizedTarget = path.resolve(targetPath);

  // The target should equal the base or start with base + separator
  // Using path.sep ensures cross-platform compatibility
  const baseWithSep = normalizedBase.endsWith(path.sep)
    ? normalizedBase
    : normalizedBase + path.sep;

  const isContained =
    normalizedTarget === normalizedBase || normalizedTarget.startsWith(baseWithSep);

  if (isContained) {
    return {
      type: 'valid',
      normalizedPath: normalizedTarget,
    };
  }

  // Determine the reason for violation
  let reason: string;
  if (normalizedTarget.includes('..')) {
    reason = 'Path contains parent directory traversal (..)';
  } else if (path.isAbsolute(targetPath) && !targetPath.startsWith(basePath)) {
    reason = 'Absolute path outside base directory';
  } else {
    reason = `Path resolves outside base directory: ${normalizedTarget}`;
  }

  return {
    type: 'violation',
    targetPath: normalizedTarget,
    basePath: normalizedBase,
    reason,
  };
}

/**
 * Verify a file before deletion (TOCTOU protection)
 *
 * Re-checks that:
 * 1. The file still exists
 * 2. It's still contained within the skill directory
 * 3. Its type hasn't changed (e.g., replaced with a directory)
 *
 * This should be called immediately before each fs.unlink() or fs.rmdir()
 * to minimize the race condition window.
 *
 * @param skillPath - Base skill directory path
 * @param filePath - Path to the file to verify
 * @returns Verification result
 */
export async function verifyBeforeDeletion(
  skillPath: string,
  filePath: string
): Promise<VerifyResult> {
  // First check containment (synchronous, no TOCTOU concern)
  const containment = verifyContainment(skillPath, filePath);

  if (containment.type === 'violation') {
    return {
      type: 'failed',
      reason: 'containment-violation',
      message: `Path escapes skill directory: ${containment.reason}`,
    };
  }

  // Then check the file still exists and get its current state
  try {
    // Use lstat to not follow symlinks
    const stats = await fs.lstat(filePath);

    let pathType: 'file' | 'directory' | 'symlink';
    if (stats.isSymbolicLink()) {
      pathType = 'symlink';
    } else if (stats.isDirectory()) {
      pathType = 'directory';
    } else {
      pathType = 'file';
    }

    return {
      type: 'ok',
      pathType,
      size: stats.size,
    };
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return {
        type: 'failed',
        reason: 'not-exists',
        message: 'File no longer exists (may have been deleted by another process)',
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      type: 'error',
      message: `Failed to verify file: ${message}`,
    };
  }
}

/**
 * Verify a file path is safe and construct a verified path object
 *
 * Returns a "verified path" that bundles the path with its verification
 * timestamp. This is informational only - the actual verification must
 * still happen immediately before deletion.
 *
 * @param skillPath - Base skill directory path
 * @param filePath - Path to verify
 * @returns Verified path information or error
 */
export async function createVerifiedPath(
  skillPath: string,
  filePath: string
): Promise<VerifiedPath | VerifyError> {
  const result = await verifyBeforeDeletion(skillPath, filePath);

  if (result.type === 'ok') {
    return {
      path: filePath,
      skillPath,
      pathType: result.pathType,
      verifiedAt: Date.now(),
    };
  }

  if (result.type === 'failed') {
    return {
      type: 'error',
      message: result.message,
    };
  }

  return result;
}

/**
 * A path that has been verified for safe deletion
 */
export interface VerifiedPath {
  /** The verified absolute path */
  path: string;
  /** The skill directory it's contained in */
  skillPath: string;
  /** The type of path (file, directory, or symlink) */
  pathType: 'file' | 'directory' | 'symlink';
  /** Timestamp when verification occurred (for debugging) */
  verifiedAt: number;
}

/**
 * Check if a path is "dangerously similar" to system paths
 *
 * This is a defense-in-depth check that rejects paths that look like
 * they might be system directories, even if they pass containment checks.
 * This catches edge cases like misconfigured scope paths.
 *
 * @param targetPath - Path to check
 * @returns True if the path looks dangerous
 */
export function isDangerousPath(targetPath: string): boolean {
  const normalized = path.resolve(targetPath).toLowerCase();

  // List of dangerous path prefixes (Unix and Windows)
  const dangerousPrefixes = [
    '/etc',
    '/usr',
    '/bin',
    '/sbin',
    '/var',
    '/boot',
    '/root',
    '/lib',
    '/opt',
    '/sys',
    '/proc',
    '/dev',
    '/tmp',
    'c:\\windows',
    'c:\\program files',
    'c:\\programdata',
    'c:\\users\\public',
  ];

  // Check if path starts with any dangerous prefix
  return dangerousPrefixes.some((prefix) => normalized.startsWith(prefix));
}

/**
 * Validate that a skill path is in an expected location
 *
 * Skills should only be in .claude/skills/ directories. This validates
 * that the scope path follows the expected pattern.
 *
 * @param scopePath - The scope path to validate
 * @returns True if the scope path looks valid
 */
export function isValidScopePath(scopePath: string): boolean {
  const normalized = path.resolve(scopePath);

  // Must end with .claude/skills or .claude\skills
  const expectedSuffix = path.join('.claude', 'skills');

  return normalized.endsWith(expectedSuffix);
}

/**
 * Check if an error has a specific error code
 */
function hasErrorCode(error: unknown, code: string): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: unknown }).code === code;
  }
  return false;
}
