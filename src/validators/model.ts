/**
 * Model field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be non-empty string if present → error otherwise
 * - Return warning for unknown values not in known model list
 * - Extends shared ValidationResult with optional warnings
 */

import { ValidationResult, truncateForDisplay } from './name';

const KNOWN_MODELS = ['inherit', 'sonnet', 'opus', 'haiku'] as const;

/**
 * Result type for model validation that extends ValidationResult with optional warnings
 */
export type ModelValidationResult = ValidationResult & { warnings?: string[] };

/**
 * Validate the model field value
 *
 * @param value - The model field value (undefined if absent)
 * @returns Validation result with optional warnings for unknown model values
 */
export function validateModel(value: unknown): ModelValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be a string when present
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `Field 'model' must be a non-empty string if specified. Got type "${typeof value}".`,
    };
  }

  // Check for empty string
  if (value.trim() === '') {
    return {
      valid: false,
      error: `Field 'model' must be a non-empty string if specified.`,
    };
  }

  // Check for unknown model values (warning, not error)
  if (!KNOWN_MODELS.includes(value as (typeof KNOWN_MODELS)[number])) {
    return {
      valid: true,
      warnings: [
        `Unknown model '${truncateForDisplay(value)}' in model field. Known models: ${KNOWN_MODELS.join(', ')}`,
      ],
    };
  }

  return { valid: true };
}
