/**
 * Safe file deletion utilities
 *
 * This module provides secure deletion functions that verify path containment
 * before each operation and handle symlinks correctly. All deletions are
 * performed with TOCTOU protection and progress reporting.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { verifyBeforeDeletion, verifyContainment } from '../generators/path-verifier';
import { enumerateSkillFiles } from '../generators/file-enumerator';
import { FileInfo } from '../types/uninstall';

/**
 * Result of a single file deletion
 */
export type SafeDeleteResult = DeleteSuccess | DeleteSkipped | DeleteError;

export interface DeleteSuccess {
  type: 'success';
  /** Path that was deleted */
  path: string;
  /** Type of path that was deleted */
  pathType: 'file' | 'directory' | 'symlink';
  /** Size of deleted file (0 for directories/symlinks) */
  size: number;
}

export interface DeleteSkipped {
  type: 'skipped';
  /** Path that was skipped */
  path: string;
  /** Reason for skipping */
  reason: 'verification-failed' | 'not-exists' | 'containment-violation' | 'not-empty';
  /** Human-readable message */
  message: string;
}

export interface DeleteError {
  type: 'error';
  /** Path where error occurred */
  path: string;
  /** Error message */
  message: string;
}

/**
 * Progress update during recursive deletion
 */
export interface DeleteProgress {
  /** Current file being processed */
  currentPath: string;
  /** Relative path within skill directory */
  relativePath: string;
  /** Result of the deletion attempt */
  result: SafeDeleteResult;
  /** Number of files/directories processed so far */
  processedCount: number;
  /** Total files/directories to process (if known) */
  totalCount?: number;
}

/**
 * Summary of a recursive deletion operation
 */
export interface DeleteSummary {
  /** Number of files successfully deleted */
  filesDeleted: number;
  /** Number of directories successfully deleted */
  directoriesDeleted: number;
  /** Number of symlinks successfully deleted */
  symlinksDeleted: number;
  /** Total bytes freed */
  bytesFreed: number;
  /** Number of items skipped */
  skipped: number;
  /** Number of errors encountered */
  errors: number;
  /** List of error messages (limited to first 10) */
  errorMessages: string[];
  /** Whether the skill directory itself was deleted */
  skillDirectoryDeleted: boolean;
}

/**
 * Delay in milliseconds before retrying a locked file deletion
 */
const LOCKED_FILE_RETRY_DELAY_MS = 100;

/**
 * Delay for retry attempts
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Internal result type that includes the original error for retry logic.
 * This is never exposed externally - it's converted to SafeDeleteResult before returning.
 */
interface InternalDeleteAttempt {
  result: SafeDeleteResult;
  originalError?: unknown;
}

/**
 * Check if an error indicates a locked file
 */
function isFileLocked(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }
  const code = (error as { code: unknown }).code;
  // EBUSY: resource busy or locked (Windows/macOS)
  // ETXTBSY: text file busy (Unix)
  // EACCES with specific conditions can also indicate lock
  return code === 'EBUSY' || code === 'ETXTBSY';
}

/**
 * Safely delete a single file with containment verification
 *
 * Verifies the file is still within the skill directory before deletion.
 * Uses fs.unlink() for files and symlinks, fs.rmdir() for empty directories.
 * Retries once if file is locked by another process.
 *
 * @param basePath - The containing skill directory
 * @param filePath - Path to the file to delete
 * @returns Result of the deletion attempt
 */
export async function safeUnlink(basePath: string, filePath: string): Promise<SafeDeleteResult> {
  // Verify containment and get current file state
  const verification = await verifyBeforeDeletion(basePath, filePath);

  if (verification.type === 'error') {
    return {
      type: 'error',
      path: filePath,
      message: verification.message,
    };
  }

  if (verification.type === 'failed') {
    return {
      type: 'skipped',
      path: filePath,
      reason:
        verification.reason === 'not-exists'
          ? 'not-exists'
          : verification.reason === 'containment-violation'
            ? 'containment-violation'
            : 'verification-failed',
      message: verification.message,
    };
  }

  // Now we know the file exists and is within bounds - delete it
  const attemptDelete = async (): Promise<InternalDeleteAttempt> => {
    try {
      if (verification.pathType === 'directory') {
        // Try to remove as empty directory
        try {
          await fs.rmdir(filePath);
          return {
            result: {
              type: 'success',
              path: filePath,
              pathType: 'directory',
              size: 0,
            },
          };
        } catch (error) {
          if (hasErrorCode(error, 'ENOTEMPTY')) {
            return {
              result: {
                type: 'skipped',
                path: filePath,
                reason: 'not-empty',
                message: 'Directory is not empty (will be retried after contents are deleted)',
              },
            };
          }
          throw error;
        }
      } else {
        // Files and symlinks use unlink
        await fs.unlink(filePath);
        return {
          result: {
            type: 'success',
            path: filePath,
            pathType: verification.pathType,
            size: verification.size,
          },
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        result: {
          type: 'error',
          path: filePath,
          message: `Failed to delete: ${message}`,
        },
        originalError: error,
      };
    }
  };

  // First attempt
  let attempt = await attemptDelete();

  // Retry once if file is locked
  if (attempt.result.type === 'error' && isFileLocked(attempt.originalError)) {
    await delay(LOCKED_FILE_RETRY_DELAY_MS);
    attempt = await attemptDelete();

    // If still locked, provide a helpful message
    if (attempt.result.type === 'error' && isFileLocked(attempt.originalError)) {
      return {
        type: 'skipped',
        path: filePath,
        reason: 'verification-failed',
        message: 'File is locked by another process. Skipping after retry.',
      };
    }
  }

  return attempt.result;
}

/**
 * Safely delete a skill directory and all its contents
 *
 * Deletes files first, then directories bottom-up. Does NOT follow symlinks
 * (directory symlinks are deleted as files, not descended into). Verifies
 * each file before deletion to prevent TOCTOU attacks.
 *
 * @param skillPath - Full path to the skill directory
 * @yields Progress updates for each file/directory processed
 */
export async function* safeRecursiveDelete(skillPath: string): AsyncGenerator<DeleteProgress> {
  // Collect all files and directories first
  // We need to delete files before directories, and directories bottom-up
  const files: FileInfo[] = [];
  const directories: FileInfo[] = [];

  for await (const fileInfo of enumerateSkillFiles(skillPath)) {
    if (fileInfo.isDirectory && !fileInfo.isSymlink) {
      directories.push(fileInfo);
    } else {
      // Files and symlinks (including directory symlinks)
      files.push(fileInfo);
    }
  }

  // Sort directories by depth (deepest first) for bottom-up deletion
  directories.sort((a, b) => {
    const depthA = a.relativePath.split(path.sep).length;
    const depthB = b.relativePath.split(path.sep).length;
    return depthB - depthA;
  });

  const total = files.length + directories.length + 1; // +1 for skill directory itself
  let processed = 0;

  // Delete all files and symlinks first
  for (const file of files) {
    const result = await safeUnlink(skillPath, file.absolutePath);
    processed++;

    yield {
      currentPath: file.absolutePath,
      relativePath: file.relativePath,
      result,
      processedCount: processed,
      totalCount: total,
    };
  }

  // Delete directories bottom-up
  for (const dir of directories) {
    const result = await safeUnlink(skillPath, dir.absolutePath);
    processed++;

    yield {
      currentPath: dir.absolutePath,
      relativePath: dir.relativePath,
      result,
      processedCount: processed,
      totalCount: total,
    };
  }

  // Finally, delete the skill directory itself
  // Verify it's within the expected scope one more time
  const containment = verifyContainment(path.dirname(skillPath), skillPath);

  if (containment.type === 'valid') {
    try {
      await fs.rmdir(skillPath);
      processed++;

      yield {
        currentPath: skillPath,
        relativePath: '.',
        result: {
          type: 'success',
          path: skillPath,
          pathType: 'directory',
          size: 0,
        },
        processedCount: processed,
        totalCount: total,
      };
    } catch (error) {
      processed++;
      const message = error instanceof Error ? error.message : 'Unknown error';

      yield {
        currentPath: skillPath,
        relativePath: '.',
        result: {
          type: 'error',
          path: skillPath,
          message: `Failed to delete skill directory: ${message}`,
        },
        processedCount: processed,
        totalCount: total,
      };
    }
  } else {
    processed++;

    yield {
      currentPath: skillPath,
      relativePath: '.',
      result: {
        type: 'skipped',
        path: skillPath,
        reason: 'containment-violation',
        message: 'Skill directory path failed containment check',
      },
      processedCount: processed,
      totalCount: total,
    };
  }
}

/**
 * Execute a complete skill deletion and return a summary
 *
 * Convenience function that runs safeRecursiveDelete and aggregates
 * the results into a summary. Use the generator directly if you need
 * to show progress or handle interrupts.
 *
 * @param skillPath - Full path to the skill directory
 * @returns Summary of the deletion operation
 */
export async function executeSkillDeletion(skillPath: string): Promise<DeleteSummary> {
  const summary: DeleteSummary = {
    filesDeleted: 0,
    directoriesDeleted: 0,
    symlinksDeleted: 0,
    bytesFreed: 0,
    skipped: 0,
    errors: 0,
    errorMessages: [],
    skillDirectoryDeleted: false,
  };

  const MAX_ERROR_MESSAGES = 10;

  for await (const progress of safeRecursiveDelete(skillPath)) {
    const { result, relativePath } = progress;

    if (result.type === 'success') {
      if (result.pathType === 'directory') {
        summary.directoriesDeleted++;
        if (relativePath === '.') {
          summary.skillDirectoryDeleted = true;
        }
      } else if (result.pathType === 'symlink') {
        summary.symlinksDeleted++;
      } else {
        summary.filesDeleted++;
        summary.bytesFreed += result.size;
      }
    } else if (result.type === 'skipped') {
      summary.skipped++;
    } else if (result.type === 'error') {
      summary.errors++;
      if (summary.errorMessages.length < MAX_ERROR_MESSAGES) {
        summary.errorMessages.push(`${relativePath}: ${result.message}`);
      }
    }
  }

  return summary;
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
