/**
 * Skill path validation for packaging
 *
 * Rules:
 * - Path must exist and be accessible
 * - Path must be a directory (or point to SKILL.md, in which case parent directory is used)
 * - Directory must contain SKILL.md
 * - Returns resolved skill directory path on success
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const SKILL_FILENAME = 'SKILL.md';

/**
 * Result of skill path validation
 */
export interface SkillPathValidationResult {
  /** Whether the path is valid */
  valid: boolean;
  /** Resolved absolute path to the skill directory */
  skillDir?: string;
  /** Resolved absolute path to SKILL.md */
  skillFilePath?: string;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Validate that a path is a valid skill directory for packaging
 *
 * Handles two input cases:
 * 1. Path to a directory containing SKILL.md
 * 2. Path to SKILL.md file directly (uses parent directory)
 *
 * @param inputPath - Path to skill directory or SKILL.md file
 * @returns Validation result with resolved directory path if valid
 */
export async function validateSkillPath(inputPath: string): Promise<SkillPathValidationResult> {
  // Handle empty path
  if (!inputPath || inputPath.trim() === '') {
    return {
      valid: false,
      error: 'Skill path cannot be empty',
    };
  }

  // Resolve to absolute path
  const absolutePath = path.resolve(inputPath);

  // Check if path exists
  let stats;
  try {
    stats = await fs.stat(absolutePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return {
        valid: false,
        error: `Path does not exist: ${absolutePath}`,
      };
    }

    if (nodeError.code === 'EACCES') {
      return {
        valid: false,
        error: `Permission denied: ${absolutePath}`,
      };
    }

    return {
      valid: false,
      error: `Failed to access path: ${nodeError.message}`,
    };
  }

  // Determine skill directory and SKILL.md path
  let skillDir: string;
  let skillFilePath: string;

  if (stats.isFile()) {
    // Path points to a file - check if it's SKILL.md
    const filename = path.basename(absolutePath);
    if (filename !== SKILL_FILENAME) {
      return {
        valid: false,
        error: `Expected path to skill directory or ${SKILL_FILENAME} file, got "${filename}"`,
      };
    }
    // Use parent directory as skill directory
    skillDir = path.dirname(absolutePath);
    skillFilePath = absolutePath;
  } else if (stats.isDirectory()) {
    // Path is a directory - look for SKILL.md inside
    skillDir = absolutePath;
    skillFilePath = path.join(skillDir, SKILL_FILENAME);
  } else {
    return {
      valid: false,
      error: `Path is neither a file nor a directory: ${absolutePath}`,
    };
  }

  // Verify SKILL.md exists in the skill directory
  try {
    const skillFileStats = await fs.stat(skillFilePath);
    if (!skillFileStats.isFile()) {
      return {
        valid: false,
        error: `${SKILL_FILENAME} exists but is not a file: ${skillFilePath}`,
      };
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return {
        valid: false,
        error: `${SKILL_FILENAME} not found in skill directory: ${skillDir}`,
      };
    }

    if (nodeError.code === 'EACCES') {
      return {
        valid: false,
        error: `Permission denied reading ${SKILL_FILENAME}: ${skillFilePath}`,
      };
    }

    return {
      valid: false,
      error: `Failed to access ${SKILL_FILENAME}: ${nodeError.message}`,
    };
  }

  return {
    valid: true,
    skillDir,
    skillFilePath,
  };
}

/**
 * Extract skill name from skill directory path
 *
 * @param skillDir - Absolute path to skill directory
 * @returns The skill name (directory basename)
 */
export function getSkillName(skillDir: string): string {
  return path.basename(skillDir);
}
