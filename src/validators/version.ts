/**
 * Version field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be non-empty string if present → error otherwise
 */

import { ValidationResult } from './name';

/**
 * Validate the version field value
 *
 * @param value - The version field value (undefined if absent)
 * @returns Validation result
 */
export function validateVersion(value: unknown): ValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be a string when present
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `Field 'version' must be a non-empty string if specified. Got type "${typeof value}".`,
    };
  }

  // Check for empty string
  if (value.trim() === '') {
    return {
      valid: false,
      error: `Field 'version' must be a non-empty string if specified.`,
    };
  }

  return { valid: true };
}
