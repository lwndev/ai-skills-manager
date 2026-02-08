/**
 * Skills field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Accept string (non-empty) → valid
 * - Accept array of strings → valid (including empty array)
 * - Error for non-string types, arrays containing non-strings
 */

import { ValidationResult } from './name';

/**
 * Validate the skills field value
 *
 * @param value - The skills field value (undefined if absent)
 * @returns Validation result
 */
export function validateSkills(value: unknown): ValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Accept non-empty string
  if (typeof value === 'string') {
    if (value.trim() === '') {
      return {
        valid: false,
        error: `Field 'skills' must be a non-empty string or an array of strings.`,
      };
    }
    return { valid: true };
  }

  // Accept array of strings with per-entry validation
  if (Array.isArray(value)) {
    if (value.some((item) => typeof item !== 'string')) {
      return {
        valid: false,
        error: `Field 'skills' array must contain only strings. Found non-string entries.`,
      };
    }
    for (let i = 0; i < value.length; i++) {
      if (typeof value[i] === 'string' && (value[i] as string).trim() === '') {
        return {
          valid: false,
          error: `Field 'skills' array contains an empty string at index ${i}. Each entry must be a non-empty skill name.`,
        };
      }
    }
    return { valid: true };
  }

  return {
    valid: false,
    error: `Field 'skills' must be a string or an array of strings. Got type "${typeof value}".`,
  };
}
