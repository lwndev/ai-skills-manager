/**
 * allowed-tools field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Accept array of non-empty strings (post-normalization, parser already converts strings to arrays)
 * - Validate each entry is a non-empty string
 * - Do NOT reject entries based on a fixed tool name list — accept any valid tool permission pattern
 * - Error for non-array types, arrays containing non-strings or empty strings
 */

import { validateToolEntry } from './tool-patterns';

/**
 * Result type for allowed-tools validation that includes optional warnings
 */
export type AllowedToolsValidationResult =
  | { valid: true; warnings?: string[] }
  | { valid: false; error: string };

/**
 * Validate the allowed-tools field value
 *
 * @param value - The allowed-tools field value (undefined if absent)
 * @returns Validation result with optional warnings
 */
export function validateAllowedTools(value: unknown): AllowedToolsValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be an array (parser normalizes strings to arrays)
  if (!Array.isArray(value)) {
    return {
      valid: false,
      error: `Field 'allowed-tools' must be an array of strings. Got type "${typeof value}".`,
    };
  }

  // Validate each entry
  for (let i = 0; i < value.length; i++) {
    const entry = value[i];

    if (typeof entry !== 'string') {
      return {
        valid: false,
        error: `Field 'allowed-tools' array must contain only strings. Found non-string entry at index ${i}.`,
      };
    }

    if (!validateToolEntry(entry)) {
      return {
        valid: false,
        error: `Field 'allowed-tools' array contains an empty string at index ${i}. Each entry must be a non-empty tool permission pattern.`,
      };
    }
  }

  // Warn about managed policy constraint when allowed-tools is present
  if (value.length > 0) {
    return {
      valid: true,
      warnings: [
        "allowed-tools cannot override managed policy 'ask' rules (Claude Code v2.1.74+). Tools restricted by managed policy will still require user approval regardless of allowed-tools.",
      ],
    };
  }

  return { valid: true };
}
