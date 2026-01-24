/**
 * Agent field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be a non-empty string when present
 */

import { ValidationResult } from './name';

/**
 * Validate the agent field value
 *
 * @param value - The agent field value (undefined if absent)
 * @returns Validation result
 */
export function validateAgent(value: unknown): ValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be a string when present
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `Field 'agent' must be a non-empty string if specified.`,
    };
  }

  // Check for empty string
  if (value.trim() === '') {
    return {
      valid: false,
      error: `Field 'agent' must be a non-empty string if specified.`,
    };
  }

  return { valid: true };
}
