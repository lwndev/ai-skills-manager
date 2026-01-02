/**
 * File enumeration utilities for uninstall operations
 *
 * This module provides streaming file enumeration for memory-efficient
 * processing of skill directories. It uses async generators to avoid
 * loading all file information into memory at once.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { FileInfo } from '../types/uninstall';

/**
 * Summary of a skill's files and directories
 */
export interface SkillSummary {
  /** Total number of files (not including directories) */
  fileCount: number;
  /** Total number of directories */
  directoryCount: number;
  /** Total size of all files in bytes */
  totalSize: number;
  /** Number of symbolic links found */
  symlinkCount: number;
  /** Number of files with multiple hard links */
  hardLinkCount: number;
}

/**
 * Result of resource limit check
 */
export type ResourceLimitResult = ResourceLimitOk | ResourceLimitExceeded;

export interface ResourceLimitOk {
  type: 'ok';
}

export interface ResourceLimitExceeded {
  type: 'exceeded';
  /** Warning messages describing which limits were exceeded */
  warnings: string[];
  /** Whether --force is required to proceed */
  requiresForce: boolean;
}

/**
 * Resource limits for skill directories
 */
const RESOURCE_LIMITS = {
  /** Maximum number of files before requiring --force */
  MAX_FILES: 10000,
  /** Maximum total size in bytes before requiring --force (1 GB) */
  MAX_SIZE: 1024 * 1024 * 1024,
};

/**
 * Enumerate all files in a skill directory
 *
 * Uses an async generator to stream file information without loading
 * everything into memory. Does NOT follow symlinks - uses lstat() to
 * get file information without resolving symlink targets.
 *
 * @param skillPath - Full path to the skill directory
 * @yields FileInfo for each file and directory found
 */
export async function* enumerateSkillFiles(skillPath: string): AsyncGenerator<FileInfo> {
  // Use a stack for iterative directory traversal (avoids deep recursion)
  const stack: { dir: string; relativePath: string }[] = [{ dir: skillPath, relativePath: '' }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let entries: string[];
    try {
      entries = await fs.readdir(current.dir);
    } catch {
      // Skip directories we can't read
      continue;
    }

    for (const entry of entries) {
      const absolutePath = path.join(current.dir, entry);
      const relativePath = current.relativePath ? path.join(current.relativePath, entry) : entry;

      try {
        // Use lstat to NOT follow symlinks
        const stats = await fs.lstat(absolutePath);

        const fileInfo: FileInfo = {
          relativePath,
          absolutePath,
          size: stats.size,
          isDirectory: stats.isDirectory(),
          isSymlink: stats.isSymbolicLink(),
          linkCount: stats.nlink,
        };

        yield fileInfo;

        // Add subdirectories to stack (but don't follow symlinks to directories)
        if (stats.isDirectory() && !stats.isSymbolicLink()) {
          stack.push({ dir: absolutePath, relativePath });
        }
      } catch {
        // Skip files we can't stat
        continue;
      }
    }
  }
}

/**
 * Get a summary of all files in a skill directory
 *
 * Uses streaming enumeration for memory efficiency, then aggregates
 * the results into summary statistics.
 *
 * @param skillPath - Full path to the skill directory
 * @returns Summary of file counts and sizes
 */
export async function getSkillSummary(skillPath: string): Promise<SkillSummary> {
  const summary: SkillSummary = {
    fileCount: 0,
    directoryCount: 0,
    totalSize: 0,
    symlinkCount: 0,
    hardLinkCount: 0,
  };

  for await (const fileInfo of enumerateSkillFiles(skillPath)) {
    if (fileInfo.isSymlink) {
      summary.symlinkCount++;
    }

    if (fileInfo.isDirectory) {
      summary.directoryCount++;
    } else {
      summary.fileCount++;
      summary.totalSize += fileInfo.size;

      // Regular files with nlink > 1 have hard links
      if (!fileInfo.isSymlink && fileInfo.linkCount > 1) {
        summary.hardLinkCount++;
      }
    }
  }

  return summary;
}

/**
 * Collect all files into an array
 *
 * Convenience function that collects all file info from the async generator
 * into an array. Use with caution for large directories - prefer streaming
 * enumeration for memory efficiency.
 *
 * @param skillPath - Full path to the skill directory
 * @returns Array of all FileInfo objects
 */
export async function collectSkillFiles(skillPath: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  for await (const fileInfo of enumerateSkillFiles(skillPath)) {
    files.push(fileInfo);
  }

  return files;
}

/**
 * Check if a skill directory exceeds resource limits
 *
 * Large skills (>10,000 files or >1 GB) may indicate unexpected content
 * like node_modules or large binaries. These require --force to proceed.
 *
 * @param summary - Skill summary from getSkillSummary()
 * @returns Result indicating whether limits are exceeded
 */
export function checkResourceLimits(summary: SkillSummary): ResourceLimitResult {
  const warnings: string[] = [];

  if (summary.fileCount > RESOURCE_LIMITS.MAX_FILES) {
    warnings.push(
      `Skill contains ${summary.fileCount.toLocaleString()} files ` +
        `(limit: ${RESOURCE_LIMITS.MAX_FILES.toLocaleString()}). ` +
        'This may indicate unexpected content like node_modules.'
    );
  }

  if (summary.totalSize > RESOURCE_LIMITS.MAX_SIZE) {
    const sizeGB = (summary.totalSize / (1024 * 1024 * 1024)).toFixed(2);
    warnings.push(
      `Skill size is ${sizeGB} GB (limit: 1 GB). ` +
        'This may indicate large binaries or unexpected content.'
    );
  }

  if (warnings.length > 0) {
    return {
      type: 'exceeded',
      warnings,
      requiresForce: true,
    };
  }

  return { type: 'ok' };
}

/**
 * Format a file size in bytes to a human-readable string
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 KB", "2.3 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, unitIndex);

  // Use 2 decimal places for KB and above, 0 for bytes
  const decimals = unitIndex > 0 ? 2 : 0;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}
