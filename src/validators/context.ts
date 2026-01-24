/**
 * Context field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be exactly "fork" when present
 */

import { ValidationResult } from './name';

/**
 * Validate the context field value
 *
 * @param value - The context field value (undefined if absent)
 * @returns Validation result
 */
export function validateContext(value: unknown): ValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be exactly "fork" when present
  if (value !== 'fork') {
    return {
      valid: false,
      error: `Field 'context' must be "fork" if specified, got "${String(value)}".`,
    };
  }

  return { valid: true };
}
