/**
 * Compatibility field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be a non-empty string when present
 * - Maximum length: 500 characters
 */

import { ValidationResult } from './name';

const MAX_LENGTH = 500;

/**
 * Validate the compatibility field value
 *
 * @param compatibility - The compatibility field value (undefined if absent)
 * @returns Validation result
 */
export function validateCompatibility(compatibility: unknown): ValidationResult {
  // Field is optional - absence is valid
  if (compatibility === undefined) {
    return { valid: true };
  }

  // Must be a string when present
  if (typeof compatibility !== 'string') {
    return {
      valid: false,
      error: 'Compatibility field must be a string',
    };
  }

  // Check for empty string
  if (compatibility.trim() === '') {
    return {
      valid: false,
      error: 'Compatibility field cannot be empty when present',
    };
  }

  // Check maximum length
  if (compatibility.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `Compatibility field must be ${MAX_LENGTH} characters or less (got ${compatibility.length})`,
    };
  }

  return { valid: true };
}
