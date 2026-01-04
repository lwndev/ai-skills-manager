/**
 * Audit logging utilities for security-relevant operations
 *
 * Provides logging of destructive operations like uninstall for
 * security auditing and troubleshooting. All entries are appended
 * to ~/.asm/audit.log with restricted permissions.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Operation status for audit entries
 */
export type AuditStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'PARTIAL'
  | 'CANCELLED'
  | 'SECURITY_BLOCKED'
  | 'NOT_FOUND'
  | 'TIMEOUT';

/**
 * Operation type for audit entries
 */
export type AuditOperation = 'UNINSTALL' | 'UPDATE';

/**
 * Update-specific status that extends the base status
 */
export type UpdateAuditStatus = 'SUCCESS' | 'FAILED' | 'ROLLED_BACK' | 'ROLLBACK_FAILED';

/**
 * Audit log entry for uninstall operations
 */
export interface AuditLogEntry {
  /** Type of operation */
  operation: AuditOperation;
  /** Skill name that was operated on */
  skillName: string;
  /** Scope where the operation occurred */
  scope: 'project' | 'personal';
  /** Status of the operation */
  status: AuditStatus;
  /** Number of files removed (for successful operations) */
  filesRemoved?: number;
  /** Bytes freed (for successful operations) */
  bytesFreed?: number;
  /** Error details (for failed operations) */
  errorDetails?: string;
  /** Full path to the skill directory */
  skillPath?: string;
}

/**
 * Audit log entry for update operations (NFR-6)
 * Format: [ISO-8601 timestamp] UPDATE <skill-name> <scope> <status> <details>
 */
export interface UpdateAuditLogEntry {
  /** Type of operation */
  operation: 'UPDATE';
  /** Skill name that was updated */
  skillName: string;
  /** Scope where the operation occurred */
  scope: 'project' | 'personal';
  /** Status of the operation */
  status: UpdateAuditStatus;
  /** Path to the source package file */
  packagePath: string;
  /** Path to the backup file (if created) */
  backupPath?: string;
  /** Number of files before update */
  previousFiles?: number;
  /** Number of files after update (on success) */
  currentFiles?: number;
  /** Error message (on failure) */
  error?: string;
  /** Whether --no-backup flag was used */
  noBackup?: boolean;
}

/**
 * Default directory for ASM data files
 */
const ASM_DATA_DIR = '.asm';

/**
 * Default audit log filename
 */
const AUDIT_LOG_FILE = 'audit.log';

/**
 * Permissions for audit log file (owner read/write only)
 */
const AUDIT_LOG_PERMISSIONS = 0o600;

/**
 * Permissions for ASM data directory
 */
const DATA_DIR_PERMISSIONS = 0o700;

/**
 * Optional override for the base directory (for testing)
 * Set via setAuditBaseDir() for testing purposes
 */
let baseDir: string | null = null;

/**
 * Set the base directory for audit logging (for testing)
 *
 * @param dir - Directory to use as base, or null to reset to default
 */
export function setAuditBaseDir(dir: string | null): void {
  baseDir = dir;
}

/**
 * Get the current base directory
 *
 * @returns The base directory (test override or home directory)
 */
function getBaseDir(): string {
  return baseDir ?? os.homedir();
}

/**
 * Get the path to the audit log file
 *
 * @returns Absolute path to ~/.asm/audit.log (or test override)
 */
export function getAuditLogPath(): string {
  return path.join(getBaseDir(), ASM_DATA_DIR, AUDIT_LOG_FILE);
}

/**
 * Get the path to the ASM data directory
 *
 * @returns Absolute path to ~/.asm (or test override)
 */
export function getAsmDataDir(): string {
  return path.join(getBaseDir(), ASM_DATA_DIR);
}

/**
 * Format an audit log entry as a single log line
 *
 * Format: [ISO-8601-timestamp] OPERATION skill-name scope STATUS key=value ...
 *
 * @param entry - Audit log entry to format
 * @returns Formatted log line (without trailing newline)
 *
 * @example
 * ```
 * [2026-01-01T12:34:56.789Z] UNINSTALL my-skill project SUCCESS removed=4 size=7800
 * [2026-01-01T12:35:00.000Z] UNINSTALL bad-skill personal SECURITY_BLOCKED error=symlink_escape
 * ```
 */
export function formatAuditEntry(entry: AuditLogEntry): string {
  const timestamp = new Date().toISOString();
  const parts: string[] = [
    `[${timestamp}]`,
    entry.operation,
    entry.skillName,
    entry.scope,
    entry.status,
  ];

  // Add optional details as key=value pairs
  if (entry.filesRemoved !== undefined) {
    parts.push(`removed=${entry.filesRemoved}`);
  }

  if (entry.bytesFreed !== undefined) {
    parts.push(`size=${entry.bytesFreed}`);
  }

  if (entry.skillPath) {
    // Escape spaces in path for log parsing
    const escapedPath = entry.skillPath.replace(/ /g, '\\ ');
    parts.push(`path=${escapedPath}`);
  }

  if (entry.errorDetails) {
    // Replace spaces and newlines for single-line format
    const escapedDetails = entry.errorDetails.replace(/[\s\n]/g, '_').slice(0, 200);
    parts.push(`error=${escapedDetails}`);
  }

  return parts.join(' ');
}

/**
 * Ensure the ASM data directory exists with correct permissions
 *
 * Creates ~/.asm if it doesn't exist with permissions 0700.
 *
 * @throws Error if directory cannot be created
 */
async function ensureAsmDataDir(): Promise<void> {
  const dataDir = getAsmDataDir();

  try {
    await fs.mkdir(dataDir, { recursive: true, mode: DATA_DIR_PERMISSIONS });
  } catch (error) {
    // Directory may already exist - verify it's a directory
    try {
      const stats = await fs.stat(dataDir);
      if (!stats.isDirectory()) {
        throw new Error(`${dataDir} exists but is not a directory`);
      }
    } catch {
      // stat also failed, use the original error
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create ASM data directory: ${message}`);
    }
  }
}

/**
 * Log an uninstall operation to the audit log
 *
 * Creates the audit log file if it doesn't exist.
 * Uses append mode for atomic writes.
 *
 * @param entry - Audit log entry to record
 *
 * @example
 * ```typescript
 * await logUninstallOperation({
 *   operation: 'UNINSTALL',
 *   skillName: 'my-skill',
 *   scope: 'project',
 *   status: 'SUCCESS',
 *   filesRemoved: 4,
 *   bytesFreed: 7800,
 * });
 * ```
 */
export async function logUninstallOperation(entry: AuditLogEntry): Promise<void> {
  try {
    // Ensure data directory exists
    await ensureAsmDataDir();

    const logPath = getAuditLogPath();
    const logLine = formatAuditEntry(entry) + '\n';

    // Append to log file (creates if doesn't exist)
    // Using a file handle gives us more control over permissions
    let fileHandle: fs.FileHandle | undefined;

    try {
      // Try to open existing file for append
      fileHandle = await fs.open(logPath, 'a');
    } catch {
      // File doesn't exist - create with restricted permissions
      fileHandle = await fs.open(logPath, 'a', AUDIT_LOG_PERMISSIONS);
    }

    try {
      await fileHandle.write(logLine);
    } finally {
      await fileHandle.close();
    }
  } catch (error) {
    // Audit logging failures should not block the operation
    // Log to stderr for visibility but don't throw
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Warning: Failed to write audit log: ${message}`);
  }
}

/**
 * Read the audit log entries
 *
 * Reads and parses all entries from the audit log file.
 * Primarily for testing and debugging purposes.
 *
 * @param limit - Maximum number of entries to return (from end of file)
 * @returns Array of raw log lines (newest first if limit specified)
 */
export async function readAuditLog(limit?: number): Promise<string[]> {
  const logPath = getAuditLogPath();

  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    if (limit && lines.length > limit) {
      return lines.slice(-limit);
    }

    return lines;
  } catch {
    // File doesn't exist or can't be read
    return [];
  }
}

/**
 * Create an audit entry for a successful uninstall
 *
 * @param skillName - Name of the uninstalled skill
 * @param scope - Scope where skill was uninstalled
 * @param filesRemoved - Number of files removed
 * @param bytesFreed - Total bytes freed
 * @param skillPath - Path to the skill directory
 * @returns Audit log entry
 */
export function createSuccessEntry(
  skillName: string,
  scope: 'project' | 'personal',
  filesRemoved: number,
  bytesFreed: number,
  skillPath: string
): AuditLogEntry {
  return {
    operation: 'UNINSTALL',
    skillName,
    scope,
    status: 'SUCCESS',
    filesRemoved,
    bytesFreed,
    skillPath,
  };
}

/**
 * Create an audit entry for a failed uninstall
 *
 * @param skillName - Name of the skill
 * @param scope - Scope where uninstall was attempted
 * @param status - Failure status
 * @param errorDetails - Details about the failure
 * @param skillPath - Path to the skill directory (if known)
 * @returns Audit log entry
 */
export function createFailureEntry(
  skillName: string,
  scope: 'project' | 'personal',
  status: Exclude<AuditStatus, 'SUCCESS'>,
  errorDetails: string,
  skillPath?: string
): AuditLogEntry {
  return {
    operation: 'UNINSTALL',
    skillName,
    scope,
    status,
    errorDetails,
    skillPath,
  };
}

/**
 * Create an audit entry for a partial removal
 *
 * @param skillName - Name of the skill
 * @param scope - Scope where uninstall was attempted
 * @param filesRemoved - Number of files successfully removed
 * @param filesRemaining - Number of files that couldn't be removed
 * @param errorDetails - Details about what went wrong
 * @param skillPath - Path to the skill directory
 * @returns Audit log entry
 */
export function createPartialEntry(
  skillName: string,
  scope: 'project' | 'personal',
  filesRemoved: number,
  filesRemaining: number,
  errorDetails: string,
  skillPath: string
): AuditLogEntry {
  return {
    operation: 'UNINSTALL',
    skillName,
    scope,
    status: 'PARTIAL',
    filesRemoved,
    errorDetails: `${filesRemaining} files remaining: ${errorDetails}`,
    skillPath,
  };
}

// ============================================================================
// UPDATE Operation Audit Logging (NFR-6)
// ============================================================================

/**
 * Format an update audit log entry as a single log line
 *
 * Format: [ISO-8601 timestamp] UPDATE <skill-name> <scope> <status> <JSON-details>
 *
 * @param entry - Update audit log entry to format
 * @returns Formatted log line (without trailing newline)
 *
 * @example
 * ```
 * [2026-01-01T12:34:56.789Z] UPDATE my-skill project SUCCESS {"packagePath":"/path/to/pkg.skill","backupPath":"/path/to/backup.skill","previousFiles":4,"currentFiles":5}
 * [2026-01-01T12:35:00.000Z] UPDATE my-skill personal ROLLED_BACK {"packagePath":"/path/to/pkg.skill","error":"Extraction failed"}
 * ```
 */
export function formatUpdateAuditEntry(entry: UpdateAuditLogEntry): string {
  const timestamp = new Date().toISOString();

  // Build the details JSON object
  const details: Record<string, unknown> = {
    packagePath: entry.packagePath,
  };

  if (entry.backupPath) {
    details.backupPath = entry.backupPath;
  }

  if (entry.previousFiles !== undefined) {
    details.previousFiles = entry.previousFiles;
  }

  if (entry.currentFiles !== undefined) {
    details.currentFiles = entry.currentFiles;
  }

  if (entry.error) {
    details.error = entry.error;
  }

  if (entry.noBackup) {
    details.noBackup = true;
  }

  const parts: string[] = [
    `[${timestamp}]`,
    entry.operation,
    entry.skillName,
    entry.scope,
    entry.status,
    JSON.stringify(details),
  ];

  return parts.join(' ');
}

/**
 * Log an update operation to the audit log
 *
 * Creates the audit log file if it doesn't exist.
 * Uses append mode for atomic writes.
 *
 * @param entry - Update audit log entry to record
 */
export async function logUpdateOperation(entry: UpdateAuditLogEntry): Promise<void> {
  try {
    // Ensure data directory exists
    await ensureAsmDataDir();

    const logPath = getAuditLogPath();
    const logLine = formatUpdateAuditEntry(entry) + '\n';

    // Append to log file (creates if doesn't exist)
    let fileHandle: fs.FileHandle | undefined;

    try {
      // Try to open existing file for append
      fileHandle = await fs.open(logPath, 'a');
    } catch {
      // File doesn't exist - create with restricted permissions
      fileHandle = await fs.open(logPath, 'a', AUDIT_LOG_PERMISSIONS);
    }

    try {
      await fileHandle.write(logLine);
    } finally {
      await fileHandle.close();
    }
  } catch (error) {
    // Audit logging failures should not block the operation
    // Log to stderr for visibility but don't throw
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Warning: Failed to write audit log: ${message}`);
  }
}

/**
 * Create an update audit entry for a successful update
 *
 * @param skillName - Name of the updated skill
 * @param scope - Scope where update occurred
 * @param packagePath - Path to the source package
 * @param backupPath - Path to the backup file (if created)
 * @param previousFiles - File count before update
 * @param currentFiles - File count after update
 * @param noBackup - Whether --no-backup was used
 * @returns Update audit log entry
 */
export function createUpdateSuccessEntry(
  skillName: string,
  scope: 'project' | 'personal',
  packagePath: string,
  backupPath: string | undefined,
  previousFiles: number,
  currentFiles: number,
  noBackup: boolean = false
): UpdateAuditLogEntry {
  return {
    operation: 'UPDATE',
    skillName,
    scope,
    status: 'SUCCESS',
    packagePath,
    backupPath,
    previousFiles,
    currentFiles,
    noBackup: noBackup || undefined,
  };
}

/**
 * Create an update audit entry for a failed update
 *
 * @param skillName - Name of the skill
 * @param scope - Scope where update was attempted
 * @param packagePath - Path to the source package
 * @param error - Error message
 * @param backupPath - Path to the backup file (if created)
 * @param noBackup - Whether --no-backup was used
 * @returns Update audit log entry
 */
export function createUpdateFailedEntry(
  skillName: string,
  scope: 'project' | 'personal',
  packagePath: string,
  error: string,
  backupPath?: string,
  noBackup: boolean = false
): UpdateAuditLogEntry {
  return {
    operation: 'UPDATE',
    skillName,
    scope,
    status: 'FAILED',
    packagePath,
    backupPath,
    error,
    noBackup: noBackup || undefined,
  };
}

/**
 * Create an update audit entry for a rolled-back update
 *
 * @param skillName - Name of the skill
 * @param scope - Scope where update was attempted
 * @param packagePath - Path to the source package
 * @param error - Error that caused the rollback
 * @param backupPath - Path to the backup file (kept for recovery)
 * @param noBackup - Whether --no-backup was used
 * @returns Update audit log entry
 */
export function createUpdateRolledBackEntry(
  skillName: string,
  scope: 'project' | 'personal',
  packagePath: string,
  error: string,
  backupPath?: string,
  noBackup: boolean = false
): UpdateAuditLogEntry {
  return {
    operation: 'UPDATE',
    skillName,
    scope,
    status: 'ROLLED_BACK',
    packagePath,
    backupPath,
    error,
    noBackup: noBackup || undefined,
  };
}

/**
 * Create an update audit entry for a failed rollback (critical error)
 *
 * @param skillName - Name of the skill
 * @param scope - Scope where update was attempted
 * @param packagePath - Path to the source package
 * @param updateError - Error that caused the update to fail
 * @param rollbackError - Error that caused the rollback to fail
 * @param backupPath - Path to the backup file (for manual recovery)
 * @param noBackup - Whether --no-backup was used
 * @returns Update audit log entry
 */
export function createUpdateRollbackFailedEntry(
  skillName: string,
  scope: 'project' | 'personal',
  packagePath: string,
  updateError: string,
  rollbackError: string,
  backupPath?: string,
  noBackup: boolean = false
): UpdateAuditLogEntry {
  return {
    operation: 'UPDATE',
    skillName,
    scope,
    status: 'ROLLBACK_FAILED',
    packagePath,
    backupPath,
    error: `Update failed: ${updateError}. Rollback failed: ${rollbackError}`,
    noBackup: noBackup || undefined,
  };
}
