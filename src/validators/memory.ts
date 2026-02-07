/**
 * Memory field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be one of "user", "project", "local" when present
 */

import { ValidationResult } from './name';

const VALID_MEMORY_VALUES = ['user', 'project', 'local'] as const;

/**
 * Validate the memory field value
 *
 * @param value - The memory field value (undefined if absent)
 * @returns Validation result
 */
export function validateMemory(value: unknown): ValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be a string when present
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `Field 'memory' must be one of: ${VALID_MEMORY_VALUES.join(', ')}. Got type "${typeof value}".`,
    };
  }

  // Must be one of the valid enum values
  if (!VALID_MEMORY_VALUES.includes(value as (typeof VALID_MEMORY_VALUES)[number])) {
    return {
      valid: false,
      error: `Field 'memory' must be one of: ${VALID_MEMORY_VALUES.join(', ')}. Got "${value}".`,
    };
  }

  return { valid: true };
}
