/**
 * Skill discovery and verification for uninstall operations
 *
 * This module provides functions to locate installed skills and verify
 * their validity before removal. It implements security-first discovery
 * with case sensitivity verification to prevent filesystem-based attacks.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ScopeInfo } from '../types/scope';

/**
 * Result of skill discovery operation
 */
export type SkillDiscoveryResult = SkillFound | SkillNotFound | SkillCaseMismatch;

/**
 * Skill was found at the expected location
 */
export interface SkillFound {
  type: 'found';
  /** Full path to the skill directory */
  path: string;
  /** Whether SKILL.md exists in the skill directory */
  hasSkillMd: boolean;
}

/**
 * Skill was not found at the expected location
 */
export interface SkillNotFound {
  type: 'not-found';
  /** Path where the skill was searched */
  searchedPath: string;
}

/**
 * Skill was found but with different case (security concern on case-insensitive filesystems)
 */
export interface SkillCaseMismatch {
  type: 'case-mismatch';
  /** The expected skill name (user input) */
  expectedName: string;
  /** The actual name found on the filesystem */
  actualName: string;
  /** Full path to the actual skill directory */
  actualPath: string;
}

/**
 * Result of case sensitivity verification
 */
export type CaseVerifyResult = CaseMatch | CaseMismatch | CaseVerifyError;

export interface CaseMatch {
  type: 'match';
}

export interface CaseMismatch {
  type: 'mismatch';
  expectedName: string;
  actualName: string;
}

export interface CaseVerifyError {
  type: 'error';
  message: string;
}

/**
 * Result of SKILL.md verification
 */
export type SkillMdResult = SkillMdPresent | SkillMdMissing | SkillMdError;

export interface SkillMdPresent {
  type: 'present';
  path: string;
}

export interface SkillMdMissing {
  type: 'missing';
  /** Warning message to display */
  warning: string;
}

export interface SkillMdError {
  type: 'error';
  message: string;
}

/**
 * Discover a skill in the specified scope
 *
 * Locates a skill directory and verifies it exists. Performs case-sensitivity
 * verification on case-insensitive filesystems to prevent substitution attacks.
 *
 * @param skillName - Validated skill name (must pass validation before calling)
 * @param scopeInfo - Resolved scope information with target directory
 * @returns Discovery result indicating found, not-found, or case-mismatch
 */
export async function discoverSkill(
  skillName: string,
  scopeInfo: ScopeInfo
): Promise<SkillDiscoveryResult> {
  const skillPath = path.join(scopeInfo.path, skillName);

  // Check if the directory exists
  try {
    const stats = await fs.stat(skillPath);

    if (!stats.isDirectory()) {
      // Path exists but is not a directory
      return {
        type: 'not-found',
        searchedPath: skillPath,
      };
    }

    // Verify case sensitivity
    const caseResult = await verifyCaseSensitivity(skillPath, skillName);

    if (caseResult.type === 'mismatch') {
      return {
        type: 'case-mismatch',
        expectedName: caseResult.expectedName,
        actualName: caseResult.actualName,
        actualPath: path.join(scopeInfo.path, caseResult.actualName),
      };
    }

    if (caseResult.type === 'error') {
      // Treat verification errors as not found for safety
      return {
        type: 'not-found',
        searchedPath: skillPath,
      };
    }

    // Check for SKILL.md
    const skillMdResult = await verifySkillMd(skillPath);
    const hasSkillMd = skillMdResult.type === 'present';

    return {
      type: 'found',
      path: skillPath,
      hasSkillMd,
    };
  } catch {
    // Directory doesn't exist - all errors treated as not found for safety
    return {
      type: 'not-found',
      searchedPath: skillPath,
    };
  }
}

/**
 * Verify that the skill name matches the filesystem case exactly
 *
 * On case-insensitive filesystems (macOS, Windows), a skill named "my-skill"
 * might match a directory named "My-Skill". This could be exploited to trick
 * a user into deleting a different skill. This function prevents that by
 * reading the parent directory and comparing names byte-for-byte.
 *
 * @param skillPath - Full path to the skill directory
 * @param expectedName - The expected skill name to match
 * @returns Verification result indicating match, mismatch, or error
 */
export async function verifyCaseSensitivity(
  skillPath: string,
  expectedName: string
): Promise<CaseVerifyResult> {
  const parentDir = path.dirname(skillPath);

  try {
    // Read the parent directory to get actual filesystem names
    const entries = await fs.readdir(parentDir);

    // Find the entry that matches case-insensitively
    const actualName = entries.find((entry) => entry.toLowerCase() === expectedName.toLowerCase());

    if (!actualName) {
      // No matching entry found (shouldn't happen if skillPath exists)
      return {
        type: 'error',
        message: `Entry not found in parent directory: ${expectedName}`,
      };
    }

    // Compare byte-for-byte
    if (actualName !== expectedName) {
      return {
        type: 'mismatch',
        expectedName,
        actualName,
      };
    }

    return { type: 'match' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      type: 'error',
      message: `Failed to verify case sensitivity: ${message}`,
    };
  }
}

/**
 * Verify that SKILL.md exists in the skill directory
 *
 * SKILL.md is the marker file for valid Claude Code skills. Its absence
 * suggests the directory might not be a skill (or was created incorrectly).
 * This is informational - a missing SKILL.md generates a warning but
 * doesn't block uninstallation (with --force).
 *
 * @param skillPath - Full path to the skill directory
 * @returns Verification result indicating present, missing, or error
 */
export async function verifySkillMd(skillPath: string): Promise<SkillMdResult> {
  const skillMdPath = path.join(skillPath, 'SKILL.md');

  try {
    const stats = await fs.stat(skillMdPath);

    if (stats.isFile()) {
      return {
        type: 'present',
        path: skillMdPath,
      };
    }

    // Exists but is not a file (e.g., directory)
    return {
      type: 'missing',
      warning: 'SKILL.md exists but is not a file. This directory may not be a valid skill.',
    };
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      return {
        type: 'missing',
        warning:
          'SKILL.md not found. This directory may not be a valid Claude Code skill. ' +
          'Use --force to proceed anyway.',
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      type: 'error',
      message: `Failed to check SKILL.md: ${message}`,
    };
  }
}

/**
 * Check if an error has a specific error code
 * Works with both standard Error objects and plain objects with code property
 * This is needed because Jest's environment may wrap errors differently
 */
function hasErrorCode(error: unknown, code: string): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: unknown }).code === code;
  }
  return false;
}
