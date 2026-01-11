/**
 * Public error classes for the AI Skills Manager programmatic API.
 *
 * These error classes are exported for consumers to use with instanceof checks
 * when handling errors from API functions.
 *
 * @example
 * ```typescript
 * import { install, ValidationError, FileSystemError } from 'ai-skills-manager';
 *
 * try {
 *   await install({ file: 'skill.skill' });
 * } catch (e) {
 *   if (e instanceof ValidationError) {
 *     console.error('Validation issues:', e.issues);
 *   } else if (e instanceof FileSystemError) {
 *     console.error('File error at:', e.path);
 *   }
 * }
 * ```
 *
 * @module errors
 */

import type { ValidationIssue } from './types/api';

/**
 * Error codes for machine-readable error identification.
 */
export type AsmErrorCode =
  | 'ASM_ERROR'
  | 'VALIDATION_ERROR'
  | 'FILE_SYSTEM_ERROR'
  | 'PACKAGE_ERROR'
  | 'SECURITY_ERROR'
  | 'CANCELLED';

/**
 * Base error class for all AI Skills Manager errors.
 *
 * All errors thrown by the programmatic API extend this class,
 * allowing consumers to catch all ASM errors with a single instanceof check.
 *
 * @example
 * ```typescript
 * try {
 *   await someApiFunction();
 * } catch (e) {
 *   if (e instanceof AsmError) {
 *     console.error(`ASM Error [${e.code}]: ${e.message}`);
 *   }
 * }
 * ```
 */
export class AsmError extends Error {
  /**
   * Machine-readable error code for programmatic error handling.
   */
  readonly code: AsmErrorCode;

  /**
   * Creates a new AsmError.
   *
   * @param message - Human-readable error message
   * @param code - Machine-readable error code (defaults to 'ASM_ERROR')
   */
  constructor(message: string, code: AsmErrorCode = 'ASM_ERROR') {
    super(message);
    this.name = 'AsmError';
    this.code = code;
    // Maintains proper stack trace for where error was thrown (V8 engines)
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error thrown when skill validation fails.
 *
 * Contains an array of validation issues describing what failed.
 * Thrown by `createPackage()` when validation is not skipped and the skill is invalid.
 *
 * @example
 * ```typescript
 * try {
 *   await createPackage({ path: './my-skill' });
 * } catch (e) {
 *   if (e instanceof ValidationError) {
 *     for (const issue of e.issues) {
 *       console.error(`[${issue.code}] ${issue.message}`);
 *       if (issue.path) {
 *         console.error(`  at: ${issue.path}`);
 *       }
 *     }
 *   }
 * }
 * ```
 */
export class ValidationError extends AsmError {
  /**
   * Array of validation issues that caused the error.
   */
  readonly issues: ValidationIssue[];

  /**
   * Creates a new ValidationError.
   *
   * @param message - Human-readable error message
   * @param issues - Array of validation issues
   */
  constructor(message: string, issues: ValidationIssue[] = []) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/**
 * Error thrown when a filesystem operation fails.
 *
 * Includes the path where the error occurred for debugging purposes.
 *
 * @example
 * ```typescript
 * try {
 *   await install({ file: 'skill.skill' });
 * } catch (e) {
 *   if (e instanceof FileSystemError) {
 *     console.error(`Failed at path: ${e.path}`);
 *   }
 * }
 * ```
 */
export class FileSystemError extends AsmError {
  /**
   * The filesystem path where the error occurred.
   */
  readonly path: string;

  /**
   * Creates a new FileSystemError.
   *
   * @param message - Human-readable error message
   * @param path - The filesystem path where the error occurred
   */
  constructor(message: string, path: string) {
    super(message, 'FILE_SYSTEM_ERROR');
    this.name = 'FileSystemError';
    this.path = path;
  }
}

/**
 * Error thrown when package operations fail.
 *
 * This includes failures during package creation, extraction, or validation
 * of .skill package files.
 *
 * @example
 * ```typescript
 * try {
 *   await install({ file: 'corrupted.skill' });
 * } catch (e) {
 *   if (e instanceof PackageError) {
 *     console.error('Package error:', e.message);
 *   }
 * }
 * ```
 */
export class PackageError extends AsmError {
  /**
   * Creates a new PackageError.
   *
   * @param message - Human-readable error message
   */
  constructor(message: string) {
    super(message, 'PACKAGE_ERROR');
    this.name = 'PackageError';
  }
}

/**
 * Error thrown when a security violation is detected.
 *
 * This includes path traversal attempts, invalid skill names,
 * and other security-related failures.
 *
 * @example
 * ```typescript
 * try {
 *   await scaffold({ name: '../../../etc/passwd' });
 * } catch (e) {
 *   if (e instanceof SecurityError) {
 *     console.error('Security violation:', e.message);
 *   }
 * }
 * ```
 */
export class SecurityError extends AsmError {
  /**
   * Creates a new SecurityError.
   *
   * @param message - Human-readable error message
   */
  constructor(message: string) {
    super(message, 'SECURITY_ERROR');
    this.name = 'SecurityError';
  }
}

/**
 * Error thrown when an operation is cancelled via AbortSignal.
 *
 * Functions that accept an `AbortSignal` parameter will throw this error
 * if the signal is aborted before or during the operation.
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 *
 * // Cancel after 5 seconds
 * setTimeout(() => controller.abort(), 5000);
 *
 * try {
 *   await install({
 *     file: 'large-skill.skill',
 *     signal: controller.signal
 *   });
 * } catch (e) {
 *   if (e instanceof CancellationError) {
 *     console.log('Installation was cancelled');
 *   }
 * }
 * ```
 */
export class CancellationError extends AsmError {
  /**
   * Creates a new CancellationError.
   *
   * @param message - Human-readable error message (defaults to 'Operation cancelled')
   */
  constructor(message: string = 'Operation cancelled') {
    super(message, 'CANCELLED');
    this.name = 'CancellationError';
  }
}
