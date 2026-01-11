/**
 * Error helper utilities for the API layer.
 *
 * @module utils/error-helpers
 */

/**
 * Checks if an error has a specific error code property.
 *
 * This is useful for identifying Node.js filesystem errors and other
 * errors that use the `code` property for error classification.
 *
 * @param error - The error to check
 * @param code - The error code to match (e.g., 'EACCES', 'ENOENT')
 * @returns true if the error has the specified code
 *
 * @example
 * ```typescript
 * try {
 *   await fs.readFile(path);
 * } catch (error) {
 *   if (hasErrorCode(error, 'ENOENT')) {
 *     throw new FileSystemError(`File not found: ${path}`, path);
 *   }
 *   if (hasErrorCode(error, 'EACCES')) {
 *     throw new FileSystemError(`Permission denied: ${path}`, path);
 *   }
 *   throw error;
 * }
 * ```
 */
export function hasErrorCode(error: unknown, code: string): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === code;
}
