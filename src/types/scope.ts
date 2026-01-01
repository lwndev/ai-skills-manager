/**
 * Type definitions for scope and path resolution
 */

/**
 * Scope type categories
 * - 'project': Install to .claude/skills/ in current directory
 * - 'personal': Install to ~/.claude/skills/
 * - 'custom': Install to a user-specified path
 */
export type ScopeType = 'project' | 'personal' | 'custom';

/**
 * Resolved scope information
 */
export interface ScopeInfo {
  /** The type of scope */
  type: ScopeType;
  /** The resolved absolute path for the scope */
  path: string;
  /** Original user input (for error messages) */
  originalInput?: string;
}

/**
 * Result of validating an installation path
 */
export interface PathValidationResult {
  /** Whether the path is valid for installation */
  valid: boolean;
  /** Whether the path already exists */
  exists: boolean;
  /** Whether the path is writable */
  writable: boolean;
  /** Whether the path is a directory (false if it's a file) */
  isDirectory: boolean;
  /** Parent directory exists */
  parentExists: boolean;
  /** Validation errors encountered */
  errors: string[];
}

/**
 * Error codes for path-related errors
 */
export enum PathErrorCode {
  /** Path points to a file instead of a directory */
  PATH_IS_FILE = 'PATH_IS_FILE',
  /** Permission denied when accessing path */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** Parent directory does not exist and cannot be created */
  PARENT_NOT_FOUND = 'PARENT_NOT_FOUND',
  /** Invalid path format */
  INVALID_PATH = 'INVALID_PATH',
  /** Path is outside allowed directories */
  PATH_NOT_ALLOWED = 'PATH_NOT_ALLOWED',
}

/**
 * Path validation error with code for programmatic handling
 */
export interface PathValidationError {
  /** Error code for programmatic handling */
  code: PathErrorCode;
  /** Human-readable error message */
  message: string;
  /** The path that caused the error */
  path: string;
  /** Suggested fix for the error */
  suggestion?: string;
}
