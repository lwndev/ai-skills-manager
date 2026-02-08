/**
 * Color field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be one of: "blue", "cyan", "green", "yellow", "magenta", "red"
 */

import { ValidationResult, truncateForDisplay } from './name';

const VALID_COLORS = ['blue', 'cyan', 'green', 'yellow', 'magenta', 'red'] as const;

/**
 * Validate the color field value
 *
 * @param value - The color field value (undefined if absent)
 * @returns Validation result
 */
export function validateColor(value: unknown): ValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be a string when present
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `Field 'color' must be one of: ${VALID_COLORS.join(', ')}. Got type "${typeof value}".`,
    };
  }

  // Must be one of the valid enum values
  if (!VALID_COLORS.includes(value as (typeof VALID_COLORS)[number])) {
    return {
      valid: false,
      error: `Field 'color' must be one of: ${VALID_COLORS.join(', ')}. Got "${truncateForDisplay(value)}".`,
    };
  }

  return { valid: true };
}
