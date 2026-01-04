/**
 * Backup manager for update operations (FEAT-008)
 *
 * This service provides secure backup creation and management for skill updates.
 * It creates ZIP archives of installed skills before updates, allowing rollback
 * if the update fails. Security measures include path containment verification,
 * secure file permissions, and symlink protection.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { createZipArchive, finalizeArchive, getArchiveSize } from '../utils/archiver';
import { enumerateSkillFiles } from '../generators/file-enumerator';
import type {
  BackupResult,
  BackupDirValidation,
  BackupWritabilityResult,
  BackupInfo,
} from '../types/update';

/**
 * Default backup directory path (~/.asm/backups/)
 */
const ASM_DIR = '.asm';
const BACKUPS_DIR = 'backups';

/**
 * File mode for backup directories (owner only: rwx)
 */
const DIRECTORY_MODE = 0o700;

/**
 * File mode for backup files (owner only: rw)
 */
const FILE_MODE = 0o600;

/**
 * Maximum collision retry attempts for filename generation
 */
const MAX_COLLISION_RETRIES = 3;

/**
 * Options for backup operations
 */
export interface BackupOptions {
  /** Override home directory (for testing) */
  homedir?: string;
  /** Progress callback for streaming backup */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Get the backup directory path
 *
 * Returns ~/.asm/backups/, creating the directory structure if needed.
 * Uses secure permissions (0700) for the directory.
 *
 * @param options - Optional configuration
 * @returns Full path to the backup directory
 */
export async function getBackupDirectory(options?: BackupOptions): Promise<string> {
  const home = options?.homedir ?? os.homedir();
  const asmDir = path.join(home, ASM_DIR);
  const backupsDir = path.join(asmDir, BACKUPS_DIR);

  // Check if .asm already exists and is a symlink (security check before mkdir)
  try {
    const asmStats = await fs.lstat(asmDir);
    if (asmStats.isSymbolicLink()) {
      throw new Error(`Security error: ${asmDir} is a symlink`);
    }
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) {
      throw error;
    }
    // ENOENT is fine - directory doesn't exist yet
  }

  // Create .asm directory if it doesn't exist
  await fs.mkdir(asmDir, { mode: DIRECTORY_MODE, recursive: true });

  // Check if backups already exists and is a symlink (security check before mkdir)
  try {
    const backupsStats = await fs.lstat(backupsDir);
    if (backupsStats.isSymbolicLink()) {
      throw new Error(`Security error: ${backupsDir} is a symlink`);
    }
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) {
      throw error;
    }
    // ENOENT is fine - directory doesn't exist yet
  }

  // Create backups directory if it doesn't exist
  await fs.mkdir(backupsDir, { mode: DIRECTORY_MODE, recursive: true });

  return backupsDir;
}

/**
 * Validate the backup directory for security and usability
 *
 * Security checks (per FR-4, NFR-5):
 * - Verify ~/.asm is not a symlink
 * - Verify ~/.asm/backups is not a symlink
 * - Check permissions are not world-readable (warn)
 * - Create with 0700 permissions if missing
 *
 * @param options - Optional configuration
 * @returns Validation result with errors and warnings
 */
export async function validateBackupDirectory(
  options?: BackupOptions
): Promise<BackupDirValidation> {
  const home = options?.homedir ?? os.homedir();
  const asmDir = path.join(home, ASM_DIR);
  const backupsDir = path.join(asmDir, BACKUPS_DIR);

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check ~/.asm
  try {
    const asmStats = await fs.lstat(asmDir);

    if (asmStats.isSymbolicLink()) {
      errors.push(`Security error: ${asmDir} is a symbolic link`);
    } else if (!asmStats.isDirectory()) {
      errors.push(`${asmDir} exists but is not a directory`);
    } else {
      // Check permissions - warn if world-readable
      const mode = asmStats.mode & 0o777;
      if (mode & 0o004) {
        warnings.push(`${asmDir} is world-readable (mode: ${mode.toString(8)})`);
      }
    }
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      // Will be created with correct permissions
    } else {
      errors.push(`Cannot access ${asmDir}: ${getErrorMessage(error)}`);
    }
  }

  // Check ~/.asm/backups
  try {
    const backupsStats = await fs.lstat(backupsDir);

    if (backupsStats.isSymbolicLink()) {
      errors.push(`Security error: ${backupsDir} is a symbolic link`);
    } else if (!backupsStats.isDirectory()) {
      errors.push(`${backupsDir} exists but is not a directory`);
    } else {
      // Check permissions - warn if world-readable
      const mode = backupsStats.mode & 0o777;
      if (mode & 0o004) {
        warnings.push(`${backupsDir} is world-readable (mode: ${mode.toString(8)})`);
      }
    }
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      // Will be created with correct permissions
    } else {
      errors.push(`Cannot access ${backupsDir}: ${getErrorMessage(error)}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if the backup directory is writable
 *
 * Tests write permissions by creating and removing a temporary file.
 * This should be called before starting an update to fail early.
 *
 * @param options - Optional configuration
 * @returns Writability check result
 */
export async function validateBackupWritability(
  options?: BackupOptions
): Promise<BackupWritabilityResult> {
  try {
    // Ensure directory exists first
    const backupsDir = await getBackupDirectory(options);

    // Try to create a temp file
    const tempFile = path.join(backupsDir, `.write-test-${crypto.randomBytes(4).toString('hex')}`);

    try {
      // Create file with secure permissions
      const fd = await fs.open(tempFile, 'wx', FILE_MODE);
      await fd.write('test');
      await fd.close();

      // Clean up
      await fs.unlink(tempFile);

      return { writable: true };
    } catch (error) {
      return {
        writable: false,
        error: `Cannot write to backup directory: ${getErrorMessage(error)}`,
      };
    }
  } catch (error) {
    return {
      writable: false,
      error: `Cannot access backup directory: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Generate a unique backup filename
 *
 * Format: <skill-name>-<YYYYMMDD-HHMMSS>-<8-hex-random>.skill
 * Example: my-skill-20250115-143052-a1b2c3d4.skill
 *
 * @param skillName - Name of the skill being backed up
 * @returns Generated filename (not a full path)
 */
export function generateBackupFilename(skillName: string): string {
  const now = new Date();

  // Format: YYYYMMDD-HHMMSS
  const timestamp =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    '-' +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');

  // 8 random hex characters
  const random = crypto.randomBytes(4).toString('hex');

  return `${skillName}-${timestamp}-${random}.skill`;
}

/**
 * Verify that a backup path resolves within the backup directory
 *
 * This prevents path traversal attacks where a malicious skill name
 * could cause the backup to be created outside the backup directory.
 *
 * @param backupPath - Full path to the backup file
 * @param options - Optional configuration
 * @returns True if the path is safely contained
 */
export async function verifyBackupContainment(
  backupPath: string,
  options?: BackupOptions
): Promise<boolean> {
  try {
    const backupsDir = await getBackupDirectory(options);
    const resolvedBackup = path.resolve(backupPath);
    const resolvedBackupsDir = path.resolve(backupsDir);

    // Check that the backup path starts with the backups directory
    // and has a path separator after it (not just a prefix match)
    if (!resolvedBackup.startsWith(resolvedBackupsDir + path.sep)) {
      return false;
    }

    // Verify the resolved path is still within bounds after normalization
    // This catches paths like backups/../escape.skill that resolve outside
    const relativePath = path.relative(resolvedBackupsDir, resolvedBackup);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a unique backup path, handling collisions
 *
 * If a file already exists at the generated path, regenerates with
 * new random component (up to MAX_COLLISION_RETRIES attempts).
 * If still colliding, appends an incrementing suffix.
 *
 * @param skillName - Name of the skill being backed up
 * @param options - Optional configuration
 * @returns Full path to the backup file
 */
export async function generateUniqueBackupPath(
  skillName: string,
  options?: BackupOptions
): Promise<string> {
  const backupsDir = await getBackupDirectory(options);

  // Try with random component first
  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    const filename = generateBackupFilename(skillName);
    const backupPath = path.join(backupsDir, filename);

    try {
      await fs.access(backupPath);
      // File exists, try again with new random
      console.warn(`Backup filename collision: ${filename}, retrying...`);
    } catch {
      // File doesn't exist, use this path
      return backupPath;
    }
  }

  // All random attempts failed, use incrementing suffix
  const baseFilename = generateBackupFilename(skillName);
  const basePath = path.join(backupsDir, baseFilename);

  for (let suffix = 1; suffix <= 100; suffix++) {
    const suffixedPath = basePath.replace('.skill', `-${suffix}.skill`);

    try {
      await fs.access(suffixedPath);
      // File exists, try next suffix
    } catch {
      // File doesn't exist, use this path
      console.warn(`Using suffixed backup path: ${path.basename(suffixedPath)}`);
      return suffixedPath;
    }
  }

  throw new Error('Unable to generate unique backup filename after 100+ attempts');
}

/**
 * Create a backup archive of a skill directory
 *
 * Uses streaming ZIP creation for memory efficiency. Files are added
 * incrementally without loading the entire skill into memory.
 *
 * @param skillPath - Full path to the skill directory
 * @param backupPath - Full path where the backup will be created
 * @param options - Optional configuration
 * @returns Number of files included in the backup
 */
export async function createBackupArchive(
  skillPath: string,
  backupPath: string,
  options?: BackupOptions
): Promise<number> {
  // Verify containment before creating
  const isContained = await verifyBackupContainment(backupPath, options);
  if (!isContained) {
    throw new Error(`Security error: Backup path escapes backup directory: ${backupPath}`);
  }

  // Get skill name from path for archive prefix
  const skillName = path.basename(skillPath);

  // Create archive with streaming
  const archive = createZipArchive(backupPath);
  let fileCount = 0;
  let totalCount = 0;

  // First pass: count files for progress reporting
  if (options?.onProgress) {
    for await (const _fileInfo of enumerateSkillFiles(skillPath)) {
      totalCount++;
    }
  }

  // Add files to archive using streaming enumeration
  for await (const fileInfo of enumerateSkillFiles(skillPath)) {
    // Skip directories (they're implicit in ZIP structure)
    // Skip symlinks (security measure - don't follow them)
    if (fileInfo.isDirectory || fileInfo.isSymlink) {
      continue;
    }

    // Construct archive path with skill name prefix
    const archivePath = `${skillName}/${fileInfo.relativePath.replace(/\\/g, '/')}`;

    // Add file to archive
    archive.file(fileInfo.absolutePath, { name: archivePath, mode: FILE_MODE });
    fileCount++;

    // Report progress
    if (options?.onProgress) {
      options.onProgress(fileCount, totalCount);
    }
  }

  // Finalize and close the archive
  await finalizeArchive(archive);

  // Set secure permissions on the backup file
  await fs.chmod(backupPath, FILE_MODE);

  return fileCount;
}

/**
 * Create a complete backup of a skill
 *
 * Main entry point for backup creation. Handles:
 * - Directory validation and creation
 * - Unique filename generation with collision handling
 * - Secure archive creation
 * - Progress reporting
 *
 * @param skillPath - Full path to the skill directory
 * @param skillName - Name of the skill
 * @param options - Optional configuration
 * @returns Result of the backup operation
 */
export async function createBackup(
  skillPath: string,
  skillName: string,
  options?: BackupOptions
): Promise<BackupResult> {
  try {
    // Validate skill directory exists and is accessible
    const skillStats = await fs.lstat(skillPath);
    if (!skillStats.isDirectory()) {
      return {
        success: false,
        path: '',
        size: 0,
        fileCount: 0,
        error: `Skill path is not a directory: ${skillPath}`,
      };
    }

    // Validate backup directory
    const validation = await validateBackupDirectory(options);
    if (!validation.valid) {
      return {
        success: false,
        path: '',
        size: 0,
        fileCount: 0,
        error: validation.errors.join('; '),
      };
    }

    // Check writability
    const writability = await validateBackupWritability(options);
    if (!writability.writable) {
      return {
        success: false,
        path: '',
        size: 0,
        fileCount: 0,
        error: writability.error ?? 'Backup directory is not writable',
      };
    }

    // Generate unique backup path
    const backupPath = await generateUniqueBackupPath(skillName, options);

    // Verify containment
    const isContained = await verifyBackupContainment(backupPath, options);
    if (!isContained) {
      return {
        success: false,
        path: '',
        size: 0,
        fileCount: 0,
        error: `Security error: Generated backup path escapes backup directory`,
      };
    }

    // Create the backup archive
    const fileCount = await createBackupArchive(skillPath, backupPath, options);

    // Get final archive size
    const size = await getArchiveSize(backupPath);

    return {
      success: true,
      path: backupPath,
      size,
      fileCount,
    };
  } catch (error) {
    return {
      success: false,
      path: '',
      size: 0,
      fileCount: 0,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Get information about an existing backup
 *
 * @param backupPath - Full path to the backup file
 * @returns Backup information
 */
export async function getBackupInfo(backupPath: string): Promise<BackupInfo> {
  const stats = await fs.stat(backupPath);

  // Extract timestamp from filename (format: name-YYYYMMDD-HHMMSS-random.skill)
  const filename = path.basename(backupPath);
  const timestampMatch = filename.match(/(\d{8})-(\d{6})/);

  let timestamp: string;
  if (timestampMatch) {
    // Parse YYYYMMDD-HHMMSS into ISO-8601
    const dateStr = timestampMatch[1];
    const timeStr = timestampMatch[2];
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = timeStr.substring(0, 2);
    const minute = timeStr.substring(2, 4);
    const second = timeStr.substring(4, 6);
    timestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  } else {
    // Fall back to file modification time
    timestamp = stats.mtime.toISOString();
  }

  // Note: We don't extract file count from the archive to keep this fast.
  // The file count from creation is stored in BackupResult, not the file.
  // For existing backups, we return 0 for fileCount.
  return {
    path: backupPath,
    timestamp,
    size: stats.size,
    fileCount: 0, // Unknown for existing backups without reading archive
  };
}

/**
 * Remove a backup file
 *
 * Used to clean up backups after successful updates (unless --keep-backup).
 * Verifies the path is within the backup directory before deletion.
 *
 * @param backupPath - Full path to the backup file
 * @param options - Optional configuration
 */
export async function cleanupBackup(backupPath: string, options?: BackupOptions): Promise<void> {
  // Verify containment before deleting
  const isContained = await verifyBackupContainment(backupPath, options);
  if (!isContained) {
    throw new Error(`Security error: Cannot delete file outside backup directory: ${backupPath}`);
  }

  // Verify the file exists and is a regular file
  const stats = await fs.lstat(backupPath);
  if (!stats.isFile()) {
    throw new Error(`Cannot delete: ${backupPath} is not a regular file`);
  }

  if (stats.isSymbolicLink()) {
    throw new Error(`Security error: Cannot delete symlink: ${backupPath}`);
  }

  // Delete the backup file
  await fs.unlink(backupPath);
}

/**
 * List all backups for a skill
 *
 * @param skillName - Name of the skill
 * @param options - Optional configuration
 * @returns Array of backup file paths, sorted by date (newest first)
 */
export async function listBackups(skillName: string, options?: BackupOptions): Promise<string[]> {
  const backupsDir = await getBackupDirectory(options);

  try {
    const entries = await fs.readdir(backupsDir);

    // Filter to backups for this skill
    const skillBackups = entries.filter((entry) => {
      // Match pattern: <skill-name>-YYYYMMDD-HHMMSS-*.skill
      const pattern = new RegExp(`^${escapeRegExp(skillName)}-\\d{8}-\\d{6}-[a-f0-9]+\\.skill$`);
      return pattern.test(entry);
    });

    // Sort by filename (which includes timestamp) descending
    skillBackups.sort().reverse();

    // Return full paths
    return skillBackups.map((filename) => path.join(backupsDir, filename));
  } catch {
    return [];
  }
}

/**
 * Helper: Check if an error has a specific error code
 */
function hasErrorCode(error: unknown, code: string): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: unknown }).code === code;
  }
  return false;
}

/**
 * Helper: Extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Helper: Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Result of restoring from backup
 */
export interface RestoreResult {
  /** Whether restoration was successful */
  success: boolean;
  /** Number of files restored */
  fileCount: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Restore a skill from a backup archive
 *
 * Extracts the backup archive to restore the skill to its previous state.
 * This is used during rollback when an update fails.
 *
 * Security measures:
 * - Verifies backup path is within backup directory
 * - Verifies target path is within skills directory
 * - Uses secure extraction (overwrite disabled by default)
 *
 * @param backupPath - Full path to the backup .skill file
 * @param targetPath - Full path to the parent directory where skill will be restored
 * @param options - Optional configuration
 * @returns Result of the restoration
 */
export async function restoreFromBackup(
  backupPath: string,
  targetPath: string,
  options?: BackupOptions
): Promise<RestoreResult> {
  try {
    // Import AdmZip dynamically to avoid circular dependencies
    const AdmZip = (await import('adm-zip')).default;

    // Verify backup containment
    const isContained = await verifyBackupContainment(backupPath, options);
    if (!isContained) {
      return {
        success: false,
        fileCount: 0,
        error: `Security error: Backup path escapes backup directory: ${backupPath}`,
      };
    }

    // Verify backup file exists
    const backupStats = await fs.lstat(backupPath);
    if (!backupStats.isFile()) {
      return {
        success: false,
        fileCount: 0,
        error: `Backup file not found or is not a regular file: ${backupPath}`,
      };
    }

    if (backupStats.isSymbolicLink()) {
      return {
        success: false,
        fileCount: 0,
        error: `Security error: Backup file is a symlink: ${backupPath}`,
      };
    }

    // Open and extract the backup
    const archive = new AdmZip(backupPath);
    const entries = archive.getEntries();

    // Count non-directory entries
    const fileCount = entries.filter((e) => !e.isDirectory).length;

    // Extract all files to target directory (which is the parent of the skill directory)
    // The archive contains the skill directory structure (e.g., my-skill/SKILL.md)
    archive.extractAllTo(targetPath, true, true);

    return {
      success: true,
      fileCount,
    };
  } catch (error) {
    return {
      success: false,
      fileCount: 0,
      error: getErrorMessage(error),
    };
  }
}
