/**
 * Type definitions for skill update operations (FEAT-008)
 */

import type { UninstallScope } from '../validators/uninstall-scope.js';

/**
 * Update scope types
 * - 'project': Update skill in .claude/skills/ in current directory
 * - 'personal': Update skill in ~/.claude/skills/
 * - string: Custom path for update operations (API only)
 */
export type UpdateScope = UninstallScope | string;

/**
 * Options for update operations
 */
export interface UpdateOptions {
  /** Target scope (project or personal) */
  scope: UpdateScope;
  /** Skip confirmation prompt */
  force: boolean;
  /** Preview what would be updated without making changes */
  dryRun: boolean;
  /** Minimal output mode */
  quiet: boolean;
  /** Skip backup creation (not recommended) */
  noBackup: boolean;
  /** Keep backup after successful update */
  keepBackup: boolean;
  /** Override current working directory (for testing) */
  cwd?: string;
  /** Override home directory (for testing) */
  homedir?: string;
}

/**
 * Type discriminants for reliable type narrowing
 */
export type UpdateSuccessType = 'update-success';
export type UpdateDryRunPreviewType = 'update-dry-run-preview';
export type UpdateRolledBackType = 'update-rolled-back';
export type UpdateRollbackFailedType = 'update-rollback-failed';
export type UpdateCancelledType = 'update-cancelled';

/**
 * Result of a successful update operation
 */
export interface UpdateSuccess {
  /** Type discriminant for reliable type narrowing */
  type: UpdateSuccessType;
  /** Name of the updated skill */
  skillName: string;
  /** Path where the skill is installed */
  path: string;
  /** File count before update */
  previousFileCount: number;
  /** File count after update */
  currentFileCount: number;
  /** Size in bytes before update */
  previousSize: number;
  /** Size in bytes after update */
  currentSize: number;
  /** Path to the backup file (if created) */
  backupPath?: string;
  /** Whether the backup will be removed (unless --keep-backup) */
  backupWillBeRemoved: boolean;
}

/**
 * Preview of what would be updated in dry-run mode
 */
export interface UpdateDryRunPreview {
  /** Type discriminant for reliable type narrowing */
  type: UpdateDryRunPreviewType;
  /** Name of the skill being previewed */
  skillName: string;
  /** Path where the skill is installed */
  path: string;
  /** Current skill information */
  currentVersion: VersionInfo;
  /** New package information */
  newVersion: VersionInfo;
  /** Comparison of changes */
  comparison: VersionComparison;
  /** Path where backup would be created */
  backupPath: string;
}

/**
 * Result when update failed but rollback succeeded
 */
export interface UpdateRolledBack {
  /** Type discriminant for reliable type narrowing */
  type: UpdateRolledBackType;
  /** Name of the skill that was rolled back */
  skillName: string;
  /** Path where the skill is installed */
  path: string;
  /** Reason the update failed */
  failureReason: string;
  /** Path to the backup file (kept for manual recovery) */
  backupPath?: string;
}

/**
 * Result when both update and rollback failed (critical error)
 */
export interface UpdateRollbackFailed {
  /** Type discriminant for reliable type narrowing */
  type: UpdateRollbackFailedType;
  /** Name of the skill in broken state */
  skillName: string;
  /** Path where the skill was installed */
  path: string;
  /** Reason the update failed */
  updateFailureReason: string;
  /** Reason the rollback failed */
  rollbackFailureReason: string;
  /** Path to the backup file (if available for manual recovery) */
  backupPath?: string;
  /** Manual recovery instructions */
  recoveryInstructions: string;
}

/**
 * Result when update was cancelled by user or signal
 */
export interface UpdateCancelled {
  /** Type discriminant for reliable type narrowing */
  type: UpdateCancelledType;
  /** Name of the skill that was being updated */
  skillName: string;
  /** Reason for cancellation */
  reason: 'user-cancelled' | 'interrupted';
  /** Whether any cleanup was performed */
  cleanupPerformed: boolean;
}

/**
 * Union type of all possible update operation results
 */
export type UpdateResultUnion =
  | UpdateSuccess
  | UpdateDryRunPreview
  | UpdateRolledBack
  | UpdateRollbackFailed
  | UpdateCancelled;

/**
 * Information about a skill version (current or new)
 */
export interface VersionInfo {
  /** Path to the skill or package */
  path: string;
  /** Number of files */
  fileCount: number;
  /** Total size in bytes */
  size: number;
  /** Last modified timestamp (ISO-8601) */
  lastModified?: string;
  /** Description from SKILL.md (if available) */
  description?: string;
}

/**
 * Comparison of changes between installed skill and new package
 */
export interface VersionComparison {
  /** Files that exist in new package but not in installed skill */
  filesAdded: FileChange[];
  /** Files that exist in installed skill but not in new package */
  filesRemoved: FileChange[];
  /** Files that exist in both but have different content */
  filesModified: FileChange[];
  /** Number of files added */
  addedCount: number;
  /** Number of files removed */
  removedCount: number;
  /** Number of files modified */
  modifiedCount: number;
  /** Net size change in bytes (positive = larger, negative = smaller) */
  sizeChange: number;
}

/**
 * Information about a file change
 */
export interface FileChange {
  /** Relative path within the skill directory */
  path: string;
  /** Type of change */
  changeType: 'added' | 'removed' | 'modified';
  /** Size before update (0 for added files) */
  sizeBefore: number;
  /** Size after update (0 for removed files) */
  sizeAfter: number;
  /** Size difference in bytes */
  sizeDelta: number;
}

/**
 * Information about a created backup
 */
export interface BackupInfo {
  /** Path to the backup file */
  path: string;
  /** Timestamp when backup was created (ISO-8601) */
  timestamp: string;
  /** Size of the backup in bytes */
  size: number;
  /** Number of files in the backup */
  fileCount: number;
}

/**
 * Result of backup creation operation
 */
export interface BackupResult {
  /** Whether backup was created successfully */
  success: boolean;
  /** Path to the backup file */
  path: string;
  /** Size of the backup in bytes */
  size: number;
  /** Number of files included in backup */
  fileCount: number;
  /** Error message if backup failed */
  error?: string;
}

/**
 * Result of validating the backup directory
 */
export interface BackupDirValidation {
  /** Whether the backup directory is valid and ready */
  valid: boolean;
  /** Errors that prevent backup creation */
  errors: string[];
  /** Warnings that should be shown to user */
  warnings: string[];
}

/**
 * Result of checking backup directory writability
 */
export interface BackupWritabilityResult {
  /** Whether the backup directory is writable */
  writable: boolean;
  /** Error message if not writable */
  error?: string;
}

/**
 * Metadata extracted from SKILL.md
 */
export interface SkillMetadata {
  /** Skill name from frontmatter or directory */
  name: string;
  /** Description from frontmatter */
  description?: string;
  /** Version string from frontmatter (if available) */
  version?: string;
  /** Last modified timestamp */
  lastModified?: string;
}

/**
 * Information about a potential downgrade
 */
export interface DowngradeInfo {
  /** Whether this appears to be a downgrade */
  isDowngrade: boolean;
  /** Date of installed skill (if known) */
  installedDate?: string;
  /** Date of new package (if known) */
  newDate?: string;
  /** Warning message to show user */
  message: string;
}

/**
 * Summary of changes between versions
 */
export interface ChangeSummary {
  /** Number of files added */
  addedCount: number;
  /** Number of files removed */
  removedCount: number;
  /** Number of files modified */
  modifiedCount: number;
  /** Total bytes added (sum of added + increased size) */
  bytesAdded: number;
  /** Total bytes removed (sum of removed + decreased size) */
  bytesRemoved: number;
  /** Net size change */
  netSizeChange: number;
}

/**
 * Exit codes for the update command (FR-11)
 */
export const UpdateExitCodes = {
  /** Skill updated successfully */
  SUCCESS: 0,
  /** Skill not found */
  NOT_FOUND: 1,
  /** File system error (permission denied, disk full, etc.) */
  FILESYSTEM_ERROR: 2,
  /** User cancelled update */
  CANCELLED: 3,
  /** Invalid new package */
  INVALID_PACKAGE: 4,
  /** Security error (path traversal, invalid name, etc.) */
  SECURITY_ERROR: 5,
  /** Rollback performed (update failed but rollback succeeded) */
  ROLLED_BACK: 6,
  /** Rollback failed (critical error state) */
  ROLLBACK_FAILED: 7,
} as const;

export type UpdateExitCode = (typeof UpdateExitCodes)[keyof typeof UpdateExitCodes];

/**
 * Union type for all update-related errors
 */
export type UpdateError =
  | SkillNotFoundUpdateError
  | SecurityUpdateError
  | FileSystemUpdateError
  | ValidationUpdateError
  | PackageMismatchUpdateError
  | BackupCreationUpdateError
  | RollbackUpdateError
  | CriticalUpdateError
  | TimeoutUpdateError;

/**
 * Error: Skill directory doesn't exist
 */
export interface SkillNotFoundUpdateError {
  type: 'skill-not-found';
  skillName: string;
  searchedPath: string;
}

/**
 * Error: Security violation detected
 */
export interface SecurityUpdateError {
  type: 'security-error';
  reason:
    | 'path-traversal'
    | 'symlink-escape'
    | 'hard-link-detected'
    | 'containment-violation'
    | 'case-mismatch'
    | 'zip-bomb'
    | 'zip-entry-escape';
  details: string;
}

/**
 * Error: File system operation failed
 */
export interface FileSystemUpdateError {
  type: 'filesystem-error';
  operation: 'read' | 'write' | 'delete' | 'stat' | 'readdir' | 'rename' | 'extract';
  path: string;
  message: string;
}

/**
 * Error: Validation failed
 */
export interface ValidationUpdateError {
  type: 'validation-error';
  field: 'skillName' | 'scope' | 'packagePath' | 'packageContent';
  message: string;
  details?: string[];
}

/**
 * Error: Package skill name doesn't match installed skill
 */
export interface PackageMismatchUpdateError {
  type: 'package-mismatch';
  installedSkillName: string;
  packageSkillName: string;
  message: string;
}

/**
 * Error: Backup creation failed
 */
export interface BackupCreationUpdateError {
  type: 'backup-creation-error';
  backupPath: string;
  reason: string;
}

/**
 * Error: Update failed but rollback succeeded
 */
export interface RollbackUpdateError {
  type: 'rollback-error';
  skillName: string;
  updateFailureReason: string;
  rollbackSucceeded: true;
  backupPath?: string;
}

/**
 * Error: Both update and rollback failed (critical state)
 */
export interface CriticalUpdateError {
  type: 'critical-error';
  skillName: string;
  skillPath: string;
  updateFailureReason: string;
  rollbackFailureReason: string;
  backupPath?: string;
  recoveryInstructions: string;
}

/**
 * Error: Operation exceeded time limit
 */
export interface TimeoutUpdateError {
  type: 'timeout';
  operationName: string;
  timeoutMs: number;
}

/**
 * Lock file content for concurrent access prevention (FR-17)
 */
export interface UpdateLockFile {
  /** Process ID of the owning process */
  pid: number;
  /** Timestamp when lock was acquired (ISO-8601) */
  timestamp: string;
  /** Operation type */
  operationType: 'update';
  /** Package path being applied */
  packagePath: string;
}

/**
 * Result of attempting to acquire an update lock
 */
export interface LockAcquisitionResult {
  /** Whether the lock was acquired */
  acquired: boolean;
  /** Path to the lock file */
  lockPath: string;
  /** If not acquired, the PID of the owning process */
  ownerPid?: number;
  /** If not acquired, whether the lock appears stale */
  isStale?: boolean;
  /** Error message if lock acquisition failed */
  error?: string;
}

/**
 * Hard link information for security checks (FR-16)
 */
export interface HardLinkInfo {
  /** File path relative to skill directory */
  path: string;
  /** Number of hard links */
  linkCount: number;
}

/**
 * Result of hard link detection
 */
export interface HardLinkCheckResult {
  /** Whether any hard links were detected */
  hasHardLinks: boolean;
  /** Files with link count > 1 */
  hardLinkedFiles: HardLinkInfo[];
  /** Whether --force is required to proceed */
  requiresForce: boolean;
}

/**
 * Phase tracking for signal handling and rollback (NFR-7)
 */
export type UpdatePhase =
  | 'validation'
  | 'discovery'
  | 'package-validation'
  | 'security-check'
  | 'comparison'
  | 'backup'
  | 'confirmation'
  | 'execution'
  | 'post-validation'
  | 'cleanup';

/**
 * State tracking for update operation
 */
export interface UpdateState {
  /** Current phase of the operation */
  phase: UpdatePhase;
  /** Skill name being updated */
  skillName: string;
  /** Path to the skill directory */
  skillPath: string;
  /** Path to the new package */
  packagePath: string;
  /** Path to temporary renamed directory (during execution) */
  tempPath?: string;
  /** Path to backup file (if created) */
  backupPath?: string;
  /** Whether lock has been acquired */
  lockAcquired: boolean;
  /** Path to lock file (if created) */
  lockPath?: string;
}
