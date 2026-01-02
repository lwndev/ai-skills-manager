/**
 * Security checks for uninstall operations
 *
 * This module provides security validation functions to detect symlink escapes,
 * hard links, and other potential security issues before file deletion. These
 * checks prevent unintended file system modifications and path traversal attacks.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { isPathWithin } from '../utils/scope-resolver';
import { enumerateSkillFiles } from './file-enumerator';

/**
 * Result of symlink safety check for the skill directory itself
 */
export type SymlinkCheckResult = SymlinkSafe | SymlinkEscape | SymlinkCheckError;

export interface SymlinkSafe {
  type: 'safe';
  /** Whether the skill directory is a symlink */
  isSymlink: boolean;
  /** If symlink, the resolved target path */
  resolvedPath?: string;
}

export interface SymlinkEscape {
  type: 'escape';
  /** The symlink's target path that escapes the scope */
  targetPath: string;
  /** The scope boundary that was violated */
  scopeBoundary: string;
}

export interface SymlinkCheckError {
  type: 'error';
  message: string;
}

/**
 * Information about a symlink found within the skill directory
 */
export interface SymlinkInfo {
  /** Relative path within the skill directory */
  relativePath: string;
  /** Absolute path to the symlink */
  absolutePath: string;
  /** Whether this is a directory symlink */
  isDirectorySymlink: boolean;
  /** The target path of the symlink */
  targetPath: string;
  /** Whether the target escapes the skill directory */
  escapesScope: boolean;
  /** Warning message for this symlink */
  warning: string;
}

/**
 * Information about a hard-linked file
 */
export interface HardLinkInfo {
  /** Relative path within the skill directory */
  relativePath: string;
  /** Absolute path to the file */
  absolutePath: string;
  /** Number of hard links to this file */
  linkCount: number;
}

/**
 * Warning about hard links requiring --force
 */
export interface HardLinkWarning {
  /** Total number of files with hard links */
  count: number;
  /** List of affected files (limited to first 10) */
  files: HardLinkInfo[];
  /** Warning message */
  message: string;
}

/**
 * Check if the skill directory itself is a safe symlink
 *
 * A skill directory that is a symlink is not inherently dangerous, but we must
 * verify that its target is within the expected scope. If the symlink points
 * outside the scope (e.g., to /etc or another user's directory), it's a
 * potential security issue.
 *
 * @param skillPath - Full path to the skill directory
 * @param scopePath - The scope boundary path (e.g., ~/.claude/skills)
 * @returns Safety check result
 */
export async function checkSymlinkSafety(
  skillPath: string,
  scopePath: string
): Promise<SymlinkCheckResult> {
  try {
    // Check if the skill path itself is a symlink
    const stats = await fs.lstat(skillPath);

    if (!stats.isSymbolicLink()) {
      // Not a symlink, safe
      return {
        type: 'safe',
        isSymlink: false,
      };
    }

    // It's a symlink - resolve the target and check containment
    const targetPath = await fs.realpath(skillPath);

    // Verify the resolved path is within the scope
    if (!isPathWithin(targetPath, scopePath)) {
      return {
        type: 'escape',
        targetPath,
        scopeBoundary: scopePath,
      };
    }

    return {
      type: 'safe',
      isSymlink: true,
      resolvedPath: targetPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      type: 'error',
      message: `Failed to check symlink safety: ${message}`,
    };
  }
}

/**
 * Find all symlinks within the skill directory
 *
 * This generator yields information about each symlink found, including
 * whether it escapes the skill directory scope. Directory symlinks are
 * flagged specially since they should not be descended into during deletion
 * (just removed as files).
 *
 * @param skillPath - Full path to the skill directory
 * @yields SymlinkInfo for each symlink found
 */
export async function* checkDirectorySymlinks(skillPath: string): AsyncGenerator<SymlinkInfo> {
  for await (const fileInfo of enumerateSkillFiles(skillPath)) {
    if (!fileInfo.isSymlink) {
      continue;
    }

    // Get the symlink target
    let targetPath: string;
    let isDirectorySymlink = false;

    try {
      // Read the symlink target (relative or absolute)
      const linkTarget = await fs.readlink(fileInfo.absolutePath);

      // Resolve to absolute path
      if (path.isAbsolute(linkTarget)) {
        targetPath = linkTarget;
      } else {
        targetPath = path.resolve(path.dirname(fileInfo.absolutePath), linkTarget);
      }

      // Check if target is a directory (if it exists)
      try {
        const targetStats = await fs.stat(fileInfo.absolutePath);
        isDirectorySymlink = targetStats.isDirectory();
      } catch {
        // Target doesn't exist or can't be accessed - treat as non-directory
        isDirectorySymlink = false;
      }
    } catch {
      // Can't read symlink - skip with generic info
      targetPath = '<unreadable>';
    }

    // Check if symlink target escapes the skill directory
    const escapesScope = targetPath !== '<unreadable>' && !isPathWithin(targetPath, skillPath);

    // Generate appropriate warning
    let warning: string;
    if (escapesScope) {
      warning =
        `Symlink points outside skill directory: ${targetPath}. ` +
        'This symlink will be removed but its target will NOT be deleted.';
    } else if (isDirectorySymlink) {
      warning = 'Directory symlink will be removed as a file, not descended into.';
    } else {
      warning = 'Symlink will be removed (target file is preserved).';
    }

    yield {
      relativePath: fileInfo.relativePath,
      absolutePath: fileInfo.absolutePath,
      isDirectorySymlink,
      targetPath,
      escapesScope,
      warning,
    };
  }
}

/**
 * Find all files with multiple hard links
 *
 * Files with nlink > 1 have multiple hard links, meaning the same inode
 * is referenced from multiple locations. Deleting the file in the skill
 * directory doesn't delete the data - it remains accessible from other
 * locations. This is a potential security concern worth warning about.
 *
 * @param skillPath - Full path to the skill directory
 * @yields HardLinkInfo for each hard-linked file found
 */
export async function* checkHardLinks(skillPath: string): AsyncGenerator<HardLinkInfo> {
  for await (const fileInfo of enumerateSkillFiles(skillPath)) {
    // Only regular files can have hard links (not directories or symlinks)
    if (fileInfo.isDirectory || fileInfo.isSymlink) {
      continue;
    }

    // nlink > 1 means multiple hard links exist
    if (fileInfo.linkCount > 1) {
      yield {
        relativePath: fileInfo.relativePath,
        absolutePath: fileInfo.absolutePath,
        linkCount: fileInfo.linkCount,
      };
    }
  }
}

/**
 * Detect hard links and generate a warning if found
 *
 * Aggregates hard link detections into a single warning. If any hard links
 * are found, returns a warning that requires --force to proceed.
 *
 * @param skillPath - Full path to the skill directory
 * @returns Warning if hard links found, null otherwise
 */
export async function detectHardLinkWarnings(skillPath: string): Promise<HardLinkWarning | null> {
  const hardLinks: HardLinkInfo[] = [];
  const MAX_REPORTED = 10;

  for await (const hardLink of checkHardLinks(skillPath)) {
    if (hardLinks.length < MAX_REPORTED) {
      hardLinks.push(hardLink);
    } else if (hardLinks.length === MAX_REPORTED) {
      // We've collected enough, but continue counting
      hardLinks.push(hardLink);
    }
  }

  if (hardLinks.length === 0) {
    return null;
  }

  const count = hardLinks.length;
  const filesWord = count === 1 ? 'file has' : 'files have';
  const moreText = count > MAX_REPORTED ? ` (showing first ${MAX_REPORTED})` : '';

  return {
    count,
    files: hardLinks.slice(0, MAX_REPORTED),
    message:
      `Warning: ${count} ${filesWord} multiple hard links${moreText}. ` +
      'These files exist in other locations and removing them here will not delete the data. ' +
      'Use --force to proceed.',
  };
}

/**
 * Aggregate result of all symlink checks
 */
export interface SymlinkCheckSummary {
  /** Total symlinks found */
  totalSymlinks: number;
  /** Number of symlinks that escape the skill directory */
  escapingSymlinks: number;
  /** Number of directory symlinks */
  directorySymlinks: number;
  /** List of escaping symlinks (for warning display) */
  escapingPaths: SymlinkInfo[];
  /** Whether any security concerns were found */
  hasSecurityConcerns: boolean;
  /** Summary warning message if concerns found */
  warning?: string;
}

/**
 * Get a summary of all symlinks in the skill directory
 *
 * Convenience function that aggregates symlink information into a summary.
 * Use this for generating warnings and confirmation prompts.
 *
 * @param skillPath - Full path to the skill directory
 * @returns Summary of symlink findings
 */
export async function getSymlinkSummary(skillPath: string): Promise<SymlinkCheckSummary> {
  let totalSymlinks = 0;
  let escapingSymlinks = 0;
  let directorySymlinks = 0;
  const escapingPaths: SymlinkInfo[] = [];

  for await (const symlink of checkDirectorySymlinks(skillPath)) {
    totalSymlinks++;

    if (symlink.isDirectorySymlink) {
      directorySymlinks++;
    }

    if (symlink.escapesScope) {
      escapingSymlinks++;
      escapingPaths.push(symlink);
    }
  }

  const hasSecurityConcerns = escapingSymlinks > 0;

  let warning: string | undefined;
  if (hasSecurityConcerns) {
    warning =
      `Found ${escapingSymlinks} symlink(s) pointing outside the skill directory. ` +
      'These symlinks will be removed but their targets will NOT be deleted.';
  }

  return {
    totalSymlinks,
    escapingSymlinks,
    directorySymlinks,
    escapingPaths,
    hasSecurityConcerns,
    warning,
  };
}
