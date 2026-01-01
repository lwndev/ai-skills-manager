/**
 * ZIP archive extraction utilities for skill installation
 */

import AdmZip from 'adm-zip';
import type { IZipEntry } from 'adm-zip';

/**
 * Re-export IZipEntry for consumers
 */
export type { IZipEntry };

/**
 * Opens a ZIP archive from the specified path
 * @param packagePath - Path to the .skill package file
 * @returns AdmZip instance for the archive
 * @throws Error if the file cannot be opened
 */
export function openZipArchive(packagePath: string): AdmZip {
  return new AdmZip(packagePath);
}

/**
 * Validates that a file is a valid ZIP archive
 * @param packagePath - Path to the file to validate
 * @returns true if the file is a valid ZIP archive, false otherwise
 */
export function isValidZipArchive(packagePath: string): boolean {
  try {
    const archive = new AdmZip(packagePath);
    // test() returns true if archive is valid, false otherwise
    return archive.test() === true;
  } catch {
    return false;
  }
}

/**
 * Gets all entries from a ZIP archive
 * @param archive - The AdmZip instance
 * @returns Array of ZIP entries
 */
export function getZipEntries(archive: AdmZip): IZipEntry[] {
  return archive.getEntries();
}

/**
 * Extracts all contents of a ZIP archive to a target directory
 * @param archive - The AdmZip instance
 * @param targetDir - Directory where contents will be extracted
 * @param overwrite - Whether to overwrite existing files (default: true)
 * @returns Promise that resolves when extraction is complete
 */
export function extractToDirectory(
  archive: AdmZip,
  targetDir: string,
  overwrite: boolean = true
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      archive.extractAllToAsync(targetDir, overwrite, true, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Extracts a single entry to a target directory
 * @param archive - The AdmZip instance
 * @param entry - The entry to extract
 * @param targetDir - Directory where the entry will be extracted
 * @param maintainEntryPath - Whether to maintain the full entry path (default: true)
 * @param overwrite - Whether to overwrite existing files (default: true)
 * @returns true if extraction succeeded, false otherwise
 */
export function extractEntryToDirectory(
  archive: AdmZip,
  entry: IZipEntry,
  targetDir: string,
  maintainEntryPath: boolean = true,
  overwrite: boolean = true
): boolean {
  return archive.extractEntryTo(entry, targetDir, maintainEntryPath, overwrite, true);
}

/**
 * Detects the single root directory in a ZIP archive
 * Returns the root directory name if all entries share a common root,
 * or null if there's no single root directory.
 * @param archive - The AdmZip instance
 * @returns The root directory name (without trailing slash) or null
 */
export function getZipRootDirectory(archive: AdmZip): string | null {
  const entries = archive.getEntries();

  if (entries.length === 0) {
    return null;
  }

  // Find all unique top-level directories
  const topLevelDirs = new Set<string>();

  for (const entry of entries) {
    const entryName = entry.entryName;
    // Split the path and get the first segment
    const firstSlash = entryName.indexOf('/');

    if (firstSlash === -1) {
      // Entry at root level (not in a directory) - no single root
      return null;
    }

    const topLevel = entryName.substring(0, firstSlash);
    topLevelDirs.add(topLevel);
  }

  // Must have exactly one root directory
  if (topLevelDirs.size !== 1) {
    return null;
  }

  return Array.from(topLevelDirs)[0];
}

/**
 * Calculates the total uncompressed size of all entries in the archive
 * @param archive - The AdmZip instance
 * @returns Total uncompressed size in bytes
 */
export function getTotalUncompressedSize(archive: AdmZip): number {
  const entries = archive.getEntries();
  let totalSize = 0;

  for (const entry of entries) {
    if (!entry.isDirectory) {
      totalSize += entry.header.size;
    }
  }

  return totalSize;
}

/**
 * Reads a specific entry from the archive as text
 * @param archive - The AdmZip instance
 * @param entryPath - The path of the entry to read (e.g., "skill-name/SKILL.md")
 * @returns The text content of the entry, or null if not found
 */
export function readEntryAsText(archive: AdmZip, entryPath: string): string | null {
  const entry = archive.getEntry(entryPath);

  if (!entry || entry.isDirectory) {
    return null;
  }

  return archive.readAsText(entry);
}
