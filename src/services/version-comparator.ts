/**
 * Version comparator for update operations (FEAT-008)
 *
 * This service compares installed skills with new packages to provide
 * diff summaries for user decision-making. It supports streaming comparison
 * for memory efficiency with large skills (>1000 files).
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { enumerateSkillFiles } from '../generators/file-enumerator';
import {
  openZipArchive,
  getZipEntries,
  readEntryAsText,
  getZipRootDirectory,
} from '../utils/extractor';
import { parseFrontmatter } from '../utils/frontmatter-parser';
import { hashFile, hashBuffer } from '../utils/hash';
import type {
  VersionComparison,
  FileChange,
  SkillMetadata,
  DowngradeInfo,
  ChangeSummary,
  VersionInfo,
} from '../types/update';

/**
 * Options for comparison operations
 */
export interface ComparisonOptions {
  /** Use hash comparison for files with matching sizes (more accurate but slower) */
  thorough?: boolean;
  /** Maximum files to hold in memory before streaming (default: 1000) */
  memoryThreshold?: number;
}

/**
 * Internal representation of a file for comparison
 */
interface ComparableFile {
  relativePath: string;
  size: number;
  getHash?: () => Promise<string>;
}

/**
 * Compare installed skill with new package
 *
 * Main entry point for version comparison. Provides a complete diff
 * including files added, removed, and modified.
 *
 * @param installedPath - Full path to the installed skill directory
 * @param newPackagePath - Full path to the new .skill package
 * @param options - Optional configuration
 * @returns Comparison of changes between versions
 */
export async function compareVersions(
  installedPath: string,
  newPackagePath: string,
  options?: ComparisonOptions
): Promise<VersionComparison> {
  const thorough = options?.thorough ?? false;
  const memoryThreshold = options?.memoryThreshold ?? 1000;

  // Collect file information from both sources
  const installedFiles = await collectInstalledFiles(installedPath, thorough);
  const newFiles = await collectPackageFiles(newPackagePath, thorough);

  // Check if we should use streaming comparison
  const totalFiles = installedFiles.size + newFiles.size;
  if (totalFiles > memoryThreshold) {
    // For very large skills, use streaming comparison
    return streamingCompare(installedFiles, newFiles, thorough);
  }

  // Calculate the diff
  return calculateDiff(installedFiles, newFiles, thorough);
}

/**
 * Extract metadata from a skill's SKILL.md
 *
 * @param skillPath - Full path to the skill directory
 * @returns Extracted metadata
 */
export async function extractMetadata(skillPath: string): Promise<SkillMetadata> {
  const skillMdPath = path.join(skillPath, 'SKILL.md');

  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');
    const result = parseFrontmatter(content);

    if (!result.success || !result.data) {
      // Return minimal metadata from directory name
      return {
        name: path.basename(skillPath),
      };
    }

    // Get file modification time for lastModified
    const stats = await fs.stat(skillMdPath);

    return {
      name: result.data.name ?? path.basename(skillPath),
      description: result.data.description,
      version: typeof result.data.version === 'string' ? result.data.version : undefined,
      lastModified: stats.mtime.toISOString(),
    };
  } catch {
    // SKILL.md doesn't exist or can't be read
    return {
      name: path.basename(skillPath),
    };
  }
}

/**
 * Extract metadata from a package's SKILL.md
 *
 * @param packagePath - Full path to the .skill package
 * @returns Extracted metadata
 */
export async function extractPackageMetadata(packagePath: string): Promise<SkillMetadata> {
  try {
    const archive = openZipArchive(packagePath);
    const rootDir = getZipRootDirectory(archive);

    if (!rootDir) {
      return { name: path.basename(packagePath, '.skill') };
    }

    const skillMdPath = `${rootDir}/SKILL.md`;
    const content = readEntryAsText(archive, skillMdPath);

    if (!content) {
      return { name: rootDir };
    }

    const result = parseFrontmatter(content);

    if (!result.success || !result.data) {
      return { name: rootDir };
    }

    // Get package file modification time
    const stats = await fs.stat(packagePath);

    return {
      name: result.data.name ?? rootDir,
      description: result.data.description,
      version: typeof result.data.version === 'string' ? result.data.version : undefined,
      lastModified: stats.mtime.toISOString(),
    };
  } catch {
    return { name: path.basename(packagePath, '.skill') };
  }
}

/**
 * Detect if updating would be a downgrade
 *
 * Compares modification dates and version strings to detect potential downgrades.
 *
 * @param installed - Metadata of installed skill
 * @param newPkg - Metadata of new package
 * @returns Downgrade information if detected, null otherwise
 */
export function detectDowngrade(
  installed: SkillMetadata,
  newPkg: SkillMetadata
): DowngradeInfo | null {
  // Check version strings if both are available
  if (installed.version && newPkg.version) {
    // Simple string comparison - semantic versioning comparison could be added
    if (installed.version > newPkg.version) {
      return {
        isDowngrade: true,
        message: `Installed version (${installed.version}) is newer than package version (${newPkg.version})`,
      };
    }
  }

  // Check modification dates if both are available
  if (installed.lastModified && newPkg.lastModified) {
    const installedDate = new Date(installed.lastModified);
    const newDate = new Date(newPkg.lastModified);

    if (installedDate > newDate) {
      return {
        isDowngrade: true,
        installedDate: installed.lastModified,
        newDate: newPkg.lastModified,
        message: `Installed skill is newer than package (installed: ${formatDate(installedDate)}, package: ${formatDate(newDate)})`,
      };
    }
  }

  return null;
}

/**
 * Get version information for a skill directory
 *
 * @param skillPath - Full path to the skill directory
 * @returns Version information
 */
export async function getInstalledVersionInfo(skillPath: string): Promise<VersionInfo> {
  const metadata = await extractMetadata(skillPath);
  let fileCount = 0;
  let totalSize = 0;

  for await (const file of enumerateSkillFiles(skillPath)) {
    if (!file.isDirectory && !file.isSymlink) {
      fileCount++;
      totalSize += file.size;
    }
  }

  return {
    path: skillPath,
    fileCount,
    size: totalSize,
    lastModified: metadata.lastModified,
    description: metadata.description,
  };
}

/**
 * Get version information for a package
 *
 * @param packagePath - Full path to the .skill package
 * @returns Version information
 */
export async function getPackageVersionInfo(packagePath: string): Promise<VersionInfo> {
  const metadata = await extractPackageMetadata(packagePath);
  const archive = openZipArchive(packagePath);
  const entries = getZipEntries(archive);
  const rootDir = getZipRootDirectory(archive);

  let fileCount = 0;
  let totalSize = 0;

  for (const entry of entries) {
    if (!entry.isDirectory) {
      // Only count files within the root directory
      if (rootDir && entry.entryName.startsWith(`${rootDir}/`)) {
        fileCount++;
        totalSize += entry.header.size;
      }
    }
  }

  const stats = await fs.stat(packagePath);

  return {
    path: packagePath,
    fileCount,
    size: totalSize,
    lastModified: stats.mtime.toISOString(),
    description: metadata.description,
  };
}

/**
 * Summarize changes from a version comparison
 *
 * @param comparison - Version comparison result
 * @returns Summary of changes
 */
export function summarizeChanges(comparison: VersionComparison): ChangeSummary {
  let bytesAdded = 0;
  let bytesRemoved = 0;

  // Sum bytes from added files
  for (const file of comparison.filesAdded) {
    bytesAdded += file.sizeAfter;
  }

  // Sum bytes from removed files
  for (const file of comparison.filesRemoved) {
    bytesRemoved += file.sizeBefore;
  }

  // Sum bytes from modified files (positive deltas = added, negative = removed)
  for (const file of comparison.filesModified) {
    if (file.sizeDelta > 0) {
      bytesAdded += file.sizeDelta;
    } else {
      bytesRemoved += Math.abs(file.sizeDelta);
    }
  }

  return {
    addedCount: comparison.addedCount,
    removedCount: comparison.removedCount,
    modifiedCount: comparison.modifiedCount,
    bytesAdded,
    bytesRemoved,
    netSizeChange: comparison.sizeChange,
  };
}

/**
 * Format a file change for display
 *
 * @param change - File change information
 * @returns Formatted string for display
 */
export function formatDiffLine(change: FileChange): string {
  const prefix = getChangePrefix(change.changeType);
  const sizePart = formatSizeChange(change);

  return `${prefix} ${change.path}${sizePart}`;
}

/**
 * Async generator for streaming file comparison
 *
 * Yields changes incrementally for memory-efficient processing of large skills.
 *
 * @param installedPath - Full path to the installed skill directory
 * @param newPackagePath - Full path to the new .skill package
 * @param options - Optional configuration
 * @yields File changes as they are detected
 */
export async function* streamFileComparison(
  installedPath: string,
  newPackagePath: string,
  options?: ComparisonOptions
): AsyncGenerator<FileChange> {
  const thorough = options?.thorough ?? false;

  // Build maps of files from both sources
  const installedFiles = await collectInstalledFiles(installedPath, thorough);
  const newFiles = await collectPackageFiles(newPackagePath, thorough);

  // Yield added and modified files
  for (const [relativePath, newFile] of newFiles) {
    const installedFile = installedFiles.get(relativePath);

    if (!installedFile) {
      // File added
      yield {
        path: relativePath,
        changeType: 'added',
        sizeBefore: 0,
        sizeAfter: newFile.size,
        sizeDelta: newFile.size,
      };
    } else if (installedFile.size !== newFile.size) {
      // File modified (size differs)
      yield {
        path: relativePath,
        changeType: 'modified',
        sizeBefore: installedFile.size,
        sizeAfter: newFile.size,
        sizeDelta: newFile.size - installedFile.size,
      };
    } else if (thorough && installedFile.getHash && newFile.getHash) {
      // Same size but need to check hash
      const installedHash = await installedFile.getHash();
      const newHash = await newFile.getHash();

      if (installedHash !== newHash) {
        yield {
          path: relativePath,
          changeType: 'modified',
          sizeBefore: installedFile.size,
          sizeAfter: newFile.size,
          sizeDelta: 0,
        };
      }
    }
  }

  // Yield removed files
  for (const [relativePath, installedFile] of installedFiles) {
    if (!newFiles.has(relativePath)) {
      yield {
        path: relativePath,
        changeType: 'removed',
        sizeBefore: installedFile.size,
        sizeAfter: 0,
        sizeDelta: -installedFile.size,
      };
    }
  }
}

// ============================================================================
// Internal helper functions
// ============================================================================

/**
 * Collect file information from an installed skill directory
 */
async function collectInstalledFiles(
  skillPath: string,
  thorough: boolean
): Promise<Map<string, ComparableFile>> {
  const files = new Map<string, ComparableFile>();

  for await (const file of enumerateSkillFiles(skillPath)) {
    // Skip directories and symlinks
    if (file.isDirectory || file.isSymlink) {
      continue;
    }

    const comparableFile: ComparableFile = {
      relativePath: file.relativePath,
      size: file.size,
    };

    if (thorough) {
      // Add lazy hash getter
      comparableFile.getHash = () => hashFile(file.absolutePath);
    }

    files.set(file.relativePath, comparableFile);
  }

  return files;
}

/**
 * Collect file information from a package
 */
async function collectPackageFiles(
  packagePath: string,
  thorough: boolean
): Promise<Map<string, ComparableFile>> {
  const files = new Map<string, ComparableFile>();
  const archive = openZipArchive(packagePath);
  const entries = getZipEntries(archive);
  const rootDir = getZipRootDirectory(archive);

  if (!rootDir) {
    return files;
  }

  const rootPrefix = `${rootDir}/`;

  for (const entry of entries) {
    // Skip directories
    if (entry.isDirectory) {
      continue;
    }

    // Only include files under the root directory
    if (!entry.entryName.startsWith(rootPrefix)) {
      continue;
    }

    // Get relative path (remove root directory prefix)
    const relativePath = entry.entryName.substring(rootPrefix.length);

    // Skip empty paths (the root directory entry itself)
    if (!relativePath) {
      continue;
    }

    const comparableFile: ComparableFile = {
      relativePath,
      size: entry.header.size,
    };

    if (thorough) {
      // Add lazy hash getter
      comparableFile.getHash = () => {
        const buffer = entry.getData();
        return Promise.resolve(hashBuffer(buffer));
      };
    }

    files.set(relativePath, comparableFile);
  }

  return files;
}

/**
 * Calculate diff between two file maps
 */
async function calculateDiff(
  installedFiles: Map<string, ComparableFile>,
  newFiles: Map<string, ComparableFile>,
  thorough: boolean
): Promise<VersionComparison> {
  const filesAdded: FileChange[] = [];
  const filesRemoved: FileChange[] = [];
  const filesModified: FileChange[] = [];
  let sizeChange = 0;

  // Find added and modified files
  for (const [relativePath, newFile] of newFiles) {
    const installedFile = installedFiles.get(relativePath);

    if (!installedFile) {
      // File added
      filesAdded.push({
        path: relativePath,
        changeType: 'added',
        sizeBefore: 0,
        sizeAfter: newFile.size,
        sizeDelta: newFile.size,
      });
      sizeChange += newFile.size;
    } else if (installedFile.size !== newFile.size) {
      // File modified (size differs)
      filesModified.push({
        path: relativePath,
        changeType: 'modified',
        sizeBefore: installedFile.size,
        sizeAfter: newFile.size,
        sizeDelta: newFile.size - installedFile.size,
      });
      sizeChange += newFile.size - installedFile.size;
    } else if (thorough && installedFile.getHash && newFile.getHash) {
      // Same size but need to check hash
      const installedHash = await installedFile.getHash();
      const newHash = await newFile.getHash();

      if (installedHash !== newHash) {
        filesModified.push({
          path: relativePath,
          changeType: 'modified',
          sizeBefore: installedFile.size,
          sizeAfter: newFile.size,
          sizeDelta: 0,
        });
        // No size change
      }
    }
  }

  // Find removed files
  for (const [relativePath, installedFile] of installedFiles) {
    if (!newFiles.has(relativePath)) {
      filesRemoved.push({
        path: relativePath,
        changeType: 'removed',
        sizeBefore: installedFile.size,
        sizeAfter: 0,
        sizeDelta: -installedFile.size,
      });
      sizeChange -= installedFile.size;
    }
  }

  return {
    filesAdded,
    filesRemoved,
    filesModified,
    addedCount: filesAdded.length,
    removedCount: filesRemoved.length,
    modifiedCount: filesModified.length,
    sizeChange,
  };
}

/**
 * Streaming comparison for very large skills
 */
async function streamingCompare(
  installedFiles: Map<string, ComparableFile>,
  newFiles: Map<string, ComparableFile>,
  thorough: boolean
): Promise<VersionComparison> {
  // For streaming, we use the same logic but with async iteration
  // This is primarily for memory management when processing large results
  const filesAdded: FileChange[] = [];
  const filesRemoved: FileChange[] = [];
  const filesModified: FileChange[] = [];
  let sizeChange = 0;

  // Process in batches to avoid memory pressure
  const BATCH_SIZE = 100;
  let processed = 0;

  // Find added and modified files
  for (const [relativePath, newFile] of newFiles) {
    const installedFile = installedFiles.get(relativePath);

    if (!installedFile) {
      filesAdded.push({
        path: relativePath,
        changeType: 'added',
        sizeBefore: 0,
        sizeAfter: newFile.size,
        sizeDelta: newFile.size,
      });
      sizeChange += newFile.size;
    } else if (installedFile.size !== newFile.size) {
      filesModified.push({
        path: relativePath,
        changeType: 'modified',
        sizeBefore: installedFile.size,
        sizeAfter: newFile.size,
        sizeDelta: newFile.size - installedFile.size,
      });
      sizeChange += newFile.size - installedFile.size;
    } else if (thorough && installedFile.getHash && newFile.getHash) {
      const installedHash = await installedFile.getHash();
      const newHash = await newFile.getHash();

      if (installedHash !== newHash) {
        filesModified.push({
          path: relativePath,
          changeType: 'modified',
          sizeBefore: installedFile.size,
          sizeAfter: newFile.size,
          sizeDelta: 0,
        });
      }
    }

    processed++;
    if (processed % BATCH_SIZE === 0) {
      // Allow event loop to process (prevents blocking)
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  // Find removed files
  for (const [relativePath, installedFile] of installedFiles) {
    if (!newFiles.has(relativePath)) {
      filesRemoved.push({
        path: relativePath,
        changeType: 'removed',
        sizeBefore: installedFile.size,
        sizeAfter: 0,
        sizeDelta: -installedFile.size,
      });
      sizeChange -= installedFile.size;
    }

    processed++;
    if (processed % BATCH_SIZE === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return {
    filesAdded,
    filesRemoved,
    filesModified,
    addedCount: filesAdded.length,
    removedCount: filesRemoved.length,
    modifiedCount: filesModified.length,
    sizeChange,
  };
}

/**
 * Get display prefix for a change type
 */
function getChangePrefix(changeType: 'added' | 'removed' | 'modified'): string {
  switch (changeType) {
    case 'added':
      return '+';
    case 'removed':
      return '-';
    case 'modified':
      return '~';
  }
}

/**
 * Format size change for display
 */
function formatSizeChange(change: FileChange): string {
  if (change.changeType === 'added') {
    return ` (added, ${formatBytes(change.sizeAfter)})`;
  }

  if (change.changeType === 'removed') {
    return ` (removed, ${formatBytes(change.sizeBefore)})`;
  }

  if (change.sizeDelta === 0) {
    return ' (modified, same size)';
  }

  const sign = change.sizeDelta > 0 ? '+' : '';
  return ` (modified, ${sign}${formatBytes(change.sizeDelta)})`;
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  const absBytes = Math.abs(bytes);

  if (absBytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.floor(Math.log(absBytes) / Math.log(1024));
  const size = absBytes / Math.pow(1024, unitIndex);
  const decimals = unitIndex > 0 ? 2 : 0;

  const sign = bytes < 0 ? '-' : '';
  return `${sign}${size.toFixed(decimals)} ${units[unitIndex]}`;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
