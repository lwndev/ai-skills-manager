/**
 * User-invocable field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be a boolean when present (not string "true"/"false")
 */

import { ValidationResult } from './name';

/**
 * Validate the user-invocable field value
 *
 * @param value - The user-invocable field value (undefined if absent)
 * @returns Validation result
 */
export function validateUserInvocable(value: unknown): ValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be a boolean when present
  if (typeof value !== 'boolean') {
    return {
      valid: false,
      error: `Field 'user-invocable' must be a boolean (true or false). Got type "${typeof value}".`,
    };
  }

  return { valid: true };
}
