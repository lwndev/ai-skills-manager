/**
 * disallowedTools field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Accept string (non-empty) → valid
 * - Accept array of strings → valid (including empty array)
 * - Error for non-string types, arrays containing non-strings
 */

import { ValidationResult } from './name';
import { validateToolList } from './tool-patterns';

/**
 * Validate the disallowedTools field value
 *
 * @param value - The disallowedTools field value (undefined if absent)
 * @returns Validation result
 */
export function validateDisallowedTools(value: unknown): ValidationResult {
  return validateToolList('disallowedTools', value);
}
