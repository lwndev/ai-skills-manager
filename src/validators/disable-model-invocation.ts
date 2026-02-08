/**
 * Disable-model-invocation field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be boolean if present → error for non-boolean types
 */

import { ValidationResult } from './name';

/**
 * Validate the disable-model-invocation field value
 *
 * @param value - The disable-model-invocation field value (undefined if absent)
 * @returns Validation result
 */
export function validateDisableModelInvocation(value: unknown): ValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be a boolean when present
  if (typeof value !== 'boolean') {
    return {
      valid: false,
      error: `Field 'disable-model-invocation' must be a boolean (true or false). Got type "${typeof value}".`,
    };
  }

  return { valid: true };
}
