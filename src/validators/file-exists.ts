/**
 * File existence validation for SKILL.md
 *
 * Rules:
 * - Path must exist (file or directory)
 * - If directory, must contain SKILL.md
 * - If file, must be named SKILL.md
 * - Returns resolved path and file content on success
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ValidationResult } from './name';

const SKILL_FILENAME = 'SKILL.md';

export interface FileExistsResult extends ValidationResult {
  /** Resolved absolute path to SKILL.md */
  resolvedPath?: string;
  /** Content of the SKILL.md file */
  content?: string;
}

/**
 * Validate that a skill path exists and contains SKILL.md
 *
 * @param skillPath - Path to skill directory or SKILL.md file
 * @returns Validation result with resolved path and content if valid
 */
export async function validateFileExists(skillPath: string): Promise<FileExistsResult> {
  // Handle empty path
  if (!skillPath || skillPath.trim() === '') {
    return {
      valid: false,
      error: 'Skill path cannot be empty',
    };
  }

  // Resolve to absolute path
  const absolutePath = path.resolve(skillPath);

  // Check if path exists
  try {
    const stats = await fs.stat(absolutePath);

    if (stats.isDirectory()) {
      // Path is a directory, look for SKILL.md inside
      const skillFilePath = path.join(absolutePath, SKILL_FILENAME);
      return await readSkillFile(skillFilePath);
    } else if (stats.isFile()) {
      // Path is a file, check if it's named SKILL.md
      const filename = path.basename(absolutePath);
      if (filename !== SKILL_FILENAME) {
        return {
          valid: false,
          error: `Expected file named "${SKILL_FILENAME}", got "${filename}"`,
        };
      }
      return await readSkillFile(absolutePath);
    } else {
      return {
        valid: false,
        error: `Path is neither a file nor a directory: ${absolutePath}`,
      };
    }
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
}

/**
 * Read the SKILL.md file and return its content
 *
 * @param filePath - Absolute path to SKILL.md
 * @returns Validation result with content if successful
 */
async function readSkillFile(filePath: string): Promise<FileExistsResult> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      valid: true,
      resolvedPath: filePath,
      content,
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return {
        valid: false,
        error: `SKILL.md not found in directory. Expected: ${filePath}`,
      };
    }

    if (nodeError.code === 'EACCES') {
      return {
        valid: false,
        error: `Permission denied reading SKILL.md: ${filePath}`,
      };
    }

    return {
      valid: false,
      error: `Failed to read SKILL.md: ${nodeError.message}`,
    };
  }
}
