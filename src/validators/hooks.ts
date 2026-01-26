/**
 * Hooks field validation
 *
 * Rules:
 * - Optional field (absence is valid)
 * - Must be an object when present (not array, not primitive)
 * - Known hook keys: PreToolUse, PostToolUse, Stop
 * - Each hook value can be:
 *   - A string (simple script path)
 *   - An array of strings (multiple simple script paths)
 *   - An array of hook config objects (Claude Code nested format with matcher/hooks)
 * - Unknown keys generate warnings, not errors (future-proofing)
 *
 * The Claude Code nested format looks like:
 * ```yaml
 * hooks:
 *   PreToolUse:
 *     - matcher: "*"
 *       hooks:
 *         - type: command
 *           command: echo "..."
 * ```
 */

/**
 * Result type for hooks validation that includes optional warnings
 */
export type HooksValidationResult =
  | { valid: true; warnings?: string[] }
  | { valid: false; error: string };

const KNOWN_HOOKS = ['PreToolUse', 'PostToolUse', 'Stop'];

/**
 * Check if an object looks like a Claude Code hook config entry
 * (has type, command, matcher, hooks, or other hook config fields)
 */
function isHookConfigObject(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }
  const record = obj as Record<string, unknown>;
  // Look for common hook config fields
  return (
    'type' in record ||
    'command' in record ||
    'matcher' in record ||
    'hooks' in record ||
    'once' in record
  );
}

/**
 * Check if a value is a valid hook value
 * Supports:
 * - string (simple script path)
 * - array of strings (multiple simple script paths)
 * - array of objects (Claude Code nested format)
 */
function isValidHookValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return true;
  }
  if (Array.isArray(value)) {
    // Empty array is valid
    if (value.length === 0) {
      return true;
    }
    // Check if it's an array of strings (simple format)
    if (value.every((item) => typeof item === 'string')) {
      return true;
    }
    // Check if it's an array of hook config objects (Claude Code format)
    if (value.every((item) => isHookConfigObject(item))) {
      return true;
    }
    // Mixed or invalid array content
    return false;
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
        error: `Hook '${key}' must be a string, array of strings, or array of hook config objects.`,
      };
    }
  }

  return warnings.length > 0 ? { valid: true, warnings } : { valid: true };
}
