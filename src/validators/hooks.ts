/**
 * Hooks field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be an object when present (not array, not primitive)
 * - Known hook keys: PreToolUse, PostToolUse, Stop
 * - Each hook value must be a string or array of strings
 * - Unknown keys generate warnings, not errors (future-proofing)
 */

/**
 * Result type for hooks validation that includes optional warnings
 */
export type HooksValidationResult =
  | { valid: true; warnings?: string[] }
  | { valid: false; error: string };

const KNOWN_HOOKS = ['PreToolUse', 'PostToolUse', 'Stop'];

/**
 * Check if a value is a valid hook value (string or array of strings)
 */
function isValidHookValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'string');
  }
  return false;
}

/**
 * Validate the hooks field value
 *
 * @param value - The hooks field value (undefined if absent)
 * @returns Validation result with optional warnings for unknown keys
 */
export function validateHooks(value: unknown): HooksValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Must be an object when present
  if (typeof value !== 'object' || Array.isArray(value)) {
    return {
      valid: false,
      error: `Field 'hooks' must be an object if specified.`,
    };
  }

  const hooks = value as Record<string, unknown>;
  const warnings: string[] = [];

  // Validate each hook entry
  for (const [key, hookValue] of Object.entries(hooks)) {
    // Check for unknown keys (warning, not error)
    if (!KNOWN_HOOKS.includes(key)) {
      warnings.push(`Unknown hook '${key}' in hooks field. Known hooks: ${KNOWN_HOOKS.join(', ')}`);
    }

    // Validate hook value format
    if (!isValidHookValue(hookValue)) {
      return {
        valid: false,
        error: `Hook '${key}' must be a string or array of strings.`,
      };
    }
  }

  return warnings.length > 0 ? { valid: true, warnings } : { valid: true };
}
