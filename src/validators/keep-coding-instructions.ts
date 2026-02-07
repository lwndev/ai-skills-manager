/**
 * Keep-coding-instructions field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be boolean if present → error for non-boolean types
 */

import { ValidationResult } from './name';

/**
 * Validate the keep-coding-instructions field value
 *
 * @param value - The keep-coding-instructions field value (undefined if absent)
 * @returns Validation result
 */
export function validateKeepCodingInstructions(value: unknown): ValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be a boolean when present
  if (typeof value !== 'boolean') {
    return {
      valid: false,
      error: `Field 'keep-coding-instructions' must be a boolean (true or false), got "${typeof value}".`,
    };
  }

  return { valid: true };
}
