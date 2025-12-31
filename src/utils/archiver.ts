/**
 * ZIP archive creation utilities for skill packaging
 */

import archiver, { Archiver } from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import { isExcluded } from '../types/package';

/**
 * Extended archiver type that includes reference to output stream
 */
export interface ZipArchive extends Archiver {
  _outputStream?: fs.WriteStream;
}

/**
 * Creates a new ZIP archive stream that writes to the specified output path
 * @param outputPath - Path where the ZIP file will be created
 * @returns The archiver instance configured for ZIP compression
 */
export function createZipArchive(outputPath: string): ZipArchive {
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Maximum compression
  }) as ZipArchive;

  // Store reference to output stream for proper close handling
  archive._outputStream = output;

  archive.pipe(output);

  return archive;
}

/**
 * Adds a single file to the archive
 * @param archive - The archiver instance
 * @param filePath - Absolute path to the file on disk
 * @param archivePath - Path where the file should be stored in the archive
 */
export function addFileToArchive(archive: Archiver, filePath: string, archivePath: string): void {
  archive.file(filePath, { name: archivePath });
}

/**
 * Recursively adds a directory to the archive, respecting exclusion patterns
 * @param archive - The archiver instance
 * @param dirPath - Absolute path to the directory on disk
 * @param basePath - Base path prefix for files in the archive (e.g., 'skill-name/')
 * @returns Promise that resolves with the number of files added
 */
export async function addDirectoryToArchive(
  archive: Archiver,
  dirPath: string,
  basePath: string
): Promise<number> {
  let fileCount = 0;
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.join(basePath, entry.name);
    const normalizedRelative = relativePath.replace(/\\/g, '/');

    // Check exclusion using the relative path
    if (isExcluded(normalizedRelative)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively add subdirectory
      fileCount += await addDirectoryToArchive(archive, fullPath, relativePath);
    } else if (entry.isFile()) {
      // Add file to archive
      addFileToArchive(archive, fullPath, normalizedRelative);
      fileCount++;
    }
    // Skip symlinks and other special files
  }

  return fileCount;
}

/**
 * Finalizes and closes the archive
 * @param archive - The archiver instance to finalize
 * @returns Promise that resolves when the archive is completely written to disk
 */
export function finalizeArchive(archive: ZipArchive): Promise<void> {
  return new Promise((resolve, reject) => {
    const outputStream = archive._outputStream;

    if (outputStream) {
      // Wait for the output stream to close (file fully written to disk)
      outputStream.on('close', () => {
        resolve();
      });
    } else {
      // Fallback if no output stream reference
      archive.on('end', () => {
        resolve();
      });
    }

    archive.on('error', (err: Error) => {
      reject(err);
    });

    archive.on('warning', (err: Error & { code?: string }) => {
      // Only reject on actual errors, not warnings about file stats
      if (err.code !== 'ENOENT') {
        reject(err);
      }
    });

    archive.finalize();
  });
}

/**
 * Gets the finalized size of an archive after it's been written
 * @param archivePath - Path to the completed archive file
 * @returns Size of the archive in bytes
 */
export async function getArchiveSize(archivePath: string): Promise<number> {
  const stats = await fs.promises.stat(archivePath);
  return stats.size;
}

/**
 * Formats a file size in bytes to a human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 KB", "2.3 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
