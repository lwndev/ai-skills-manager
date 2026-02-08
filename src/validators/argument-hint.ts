/**
 * Argument hint field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be non-empty string if present → error otherwise
 * - Max length: 200 characters → error with current length info
 */

import { ValidationResult } from './name';

const MAX_LENGTH = 200;

/**
 * Validate the argument-hint field value
 *
 * @param value - The argument-hint field value (undefined if absent)
 * @returns Validation result
 */
export function validateArgumentHint(value: unknown): ValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be a string when present
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `Field 'argument-hint' must be a non-empty string if specified. Got type "${typeof value}".`,
    };
  }

  // Check for empty string
  if (value.trim() === '') {
    return {
      valid: false,
      error: `Field 'argument-hint' must be a non-empty string if specified.`,
    };
  }

  // Check max length
  if (value.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `Field 'argument-hint' must be at most ${MAX_LENGTH} characters. Got ${value.length} characters.`,
    };
  }

  return { valid: true };
}
