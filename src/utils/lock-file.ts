/**
 * Lock file utilities for preventing concurrent operations
 *
 * This module provides a simple locking mechanism to prevent concurrent
 * uninstall operations on the same skill, which could lead to race conditions
 * and undefined behavior.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/** Lock file extension */
const LOCK_EXTENSION = '.asm-uninstall.lock';

/** Maximum age of a lock file before it's considered stale (5 minutes) */
const MAX_LOCK_AGE_MS = 5 * 60 * 1000;

/**
 * Result of attempting to acquire a lock
 */
export interface LockResult {
  /** Whether the lock was acquired */
  acquired: boolean;
  /** Path to the lock file */
  lockPath: string;
  /** If not acquired, reason why */
  reason?: 'already-locked' | 'filesystem-error';
  /** If not acquired, error message */
  message?: string;
}

/**
 * Try to acquire a lock for an uninstall operation on a skill directory
 *
 * Creates a lock file in the skill's parent directory to indicate that
 * an uninstall operation is in progress. The lock file contains the
 * process PID and timestamp.
 *
 * @param skillPath - Path to the skill directory being uninstalled
 * @returns Result indicating whether the lock was acquired
 */
export async function acquireUninstallLock(skillPath: string): Promise<LockResult> {
  const skillName = path.basename(skillPath);
  const parentDir = path.dirname(skillPath);
  const lockPath = path.join(parentDir, `${skillName}${LOCK_EXTENSION}`);

  try {
    // Check if lock already exists
    try {
      const stats = await fs.stat(lockPath);
      const age = Date.now() - stats.mtimeMs;

      // If lock is stale (older than MAX_LOCK_AGE_MS), remove it
      if (age > MAX_LOCK_AGE_MS) {
        await fs.unlink(lockPath);
      } else {
        // Lock exists and is not stale - concurrent operation in progress
        const lockContent = await fs.readFile(lockPath, 'utf-8');
        return {
          acquired: false,
          lockPath,
          reason: 'already-locked',
          message: `Skill "${skillName}" is currently being uninstalled by another process. ${lockContent}`,
        };
      }
    } catch (error) {
      // Lock file doesn't exist, which is fine
      if (hasErrorCode(error, 'ENOENT')) {
        // Good, no existing lock
      } else {
        throw error;
      }
    }

    // Create the lock file
    const lockContent = JSON.stringify({
      pid: process.pid,
      timestamp: new Date().toISOString(),
      skillPath,
    });

    // Use exclusive flag to prevent race conditions
    await fs.writeFile(lockPath, lockContent, { flag: 'wx' });

    return {
      acquired: true,
      lockPath,
    };
  } catch (error) {
    // If the file was created by another process between our check and write
    if (hasErrorCode(error, 'EEXIST')) {
      return {
        acquired: false,
        lockPath,
        reason: 'already-locked',
        message: `Skill "${skillName}" is currently being uninstalled by another process.`,
      };
    }

    // Other filesystem errors
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      acquired: false,
      lockPath,
      reason: 'filesystem-error',
      message: `Failed to acquire lock: ${message}`,
    };
  }
}

/**
 * Release an uninstall lock
 *
 * Removes the lock file. This should be called after the uninstall operation
 * completes, regardless of success or failure.
 *
 * @param lockPath - Path to the lock file to release
 */
export async function releaseUninstallLock(lockPath: string): Promise<void> {
  try {
    await fs.unlink(lockPath);
  } catch {
    // Ignore errors when releasing lock - file may have already been removed
    // by cleanup or if the skill directory was deleted
  }
}

/**
 * Check if a lock file exists for a skill
 *
 * @param skillPath - Path to the skill directory
 * @returns True if a lock exists and is not stale
 */
export async function hasUninstallLock(skillPath: string): Promise<boolean> {
  const skillName = path.basename(skillPath);
  const parentDir = path.dirname(skillPath);
  const lockPath = path.join(parentDir, `${skillName}${LOCK_EXTENSION}`);

  try {
    const stats = await fs.stat(lockPath);
    const age = Date.now() - stats.mtimeMs;

    // Lock is considered active if it's not stale
    return age <= MAX_LOCK_AGE_MS;
  } catch {
    return false;
  }
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
