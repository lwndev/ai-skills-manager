/**
 * Type definitions for skill uninstall operations
 */

import type { UninstallScope } from '../validators/uninstall-scope.js';

/**
 * Options for uninstall operations
 */
export interface UninstallOptions {
  /** Installation scope (project or personal) */
  scope: UninstallScope;
  /** Skip confirmation prompt */
  force: boolean;
  /** Preview what would be removed without making changes */
  dryRun: boolean;
  /** Minimal output mode */
  quiet: boolean;
  /** Skill names to uninstall */
  skillNames: string[];
  /** Override current working directory (for testing) */
  cwd?: string;
  /** Override home directory (for testing) */
  homedir?: string;
}

/**
 * Result of a successful uninstall operation for a single skill
 */
export interface UninstallResult {
  /** Whether the uninstall succeeded */
  success: true;
  /** Name of the uninstalled skill */
  skillName: string;
  /** Path that was removed */
  path: string;
  /** Number of files removed */
  filesRemoved: number;
  /** Total bytes freed */
  bytesFreed: number;
}

/**
 * Result of a failed uninstall operation
 */
export interface UninstallFailure {
  /** Whether the uninstall succeeded */
  success: false;
  /** Name of the skill that failed to uninstall */
  skillName: string;
  /** Error that occurred */
  error: UninstallError;
}

/**
 * Combined result type for single skill uninstall
 */
export type SingleUninstallResult = UninstallResult | UninstallFailure;

/**
 * Result of uninstalling multiple skills
 */
export interface MultiUninstallResult {
  /** Skills that were successfully uninstalled */
  succeeded: UninstallResult[];
  /** Skills that failed to uninstall */
  failed: UninstallFailure[];
  /** Total files removed across all successful uninstalls */
  totalFilesRemoved: number;
  /** Total bytes freed across all successful uninstalls */
  totalBytesFreed: number;
}

/**
 * Preview of what would be removed in dry-run mode
 */
export interface DryRunPreview {
  /** Discriminant for type-safe handling */
  type: 'dry-run-preview';
  /** Skill name being previewed */
  skillName: string;
  /** List of files that would be removed */
  files: FileInfo[];
  /** Total size of all files */
  totalSize: number;
}

/**
 * Information about a file in the skill directory
 */
export interface FileInfo {
  /** Relative path within the skill directory */
  relativePath: string;
  /** Absolute path on the file system */
  absolutePath: string;
  /** File size in bytes */
  size: number;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Whether this is a symbolic link */
  isSymlink: boolean;
  /** Number of hard links (for regular files) */
  linkCount: number;
}

/**
 * Information about a discovered skill
 */
export interface SkillInfo {
  /** Skill name */
  name: string;
  /** Full path to the skill directory */
  path: string;
  /** List of files in the skill directory */
  files: FileInfo[];
  /** Total size of all files */
  totalSize: number;
  /** Whether SKILL.md exists */
  hasSkillMd: boolean;
  /** Any warnings detected during discovery */
  warnings: string[];
}

/**
 * Union type for all uninstall-related errors
 */
export type UninstallError =
  | SkillNotFoundError
  | SecurityError
  | FileSystemError
  | ValidationError
  | PartialRemovalError
  | TimeoutError;

/**
 * Error: Skill directory doesn't exist
 */
export interface SkillNotFoundError {
  type: 'skill-not-found';
  skillName: string;
  searchedPath: string;
}

/**
 * Error: Security violation detected
 */
export interface SecurityError {
  type: 'security-error';
  reason:
    | 'path-traversal'
    | 'symlink-escape'
    | 'hard-link-detected'
    | 'containment-violation'
    | 'case-mismatch';
  details: string;
}

/**
 * Error: File system operation failed
 */
export interface FileSystemError {
  type: 'filesystem-error';
  operation: 'read' | 'delete' | 'stat' | 'readdir';
  path: string;
  message: string;
}

/**
 * Error: Validation failed
 */
export interface ValidationError {
  type: 'validation-error';
  field: 'skillName' | 'scope';
  message: string;
}

/**
 * Error: Some files were removed but operation didn't complete
 */
export interface PartialRemovalError {
  type: 'partial-removal';
  skillName: string;
  filesRemoved: number;
  filesRemaining: number;
  lastError: string;
}

/**
 * Error: Operation exceeded time limit
 */
export interface TimeoutError {
  type: 'timeout';
  operationName: string;
  timeoutMs: number;
}

/**
 * Exit codes for the uninstall command
 */
export const UninstallExitCodes = {
  /** Success */
  SUCCESS: 0,
  /** Skill not found */
  NOT_FOUND: 1,
  /** File system error */
  FILESYSTEM_ERROR: 2,
  /** User cancelled */
  CANCELLED: 3,
  /** Partial failure (some skills removed, some failed) */
  PARTIAL_FAILURE: 4,
  /** Security error */
  SECURITY_ERROR: 5,
} as const;

export type UninstallExitCode = (typeof UninstallExitCodes)[keyof typeof UninstallExitCodes];
