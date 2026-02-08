/**
 * Shared tool permission pattern validation
 *
 * Used by disallowedTools, tools, and allowed-tools validators.
 * Validation is relaxed: any non-empty string is considered a valid tool entry.
 * Claude Code handles runtime semantics for patterns like Task(AgentName),
 * mcp__server__*, ${CLAUDE_PLUGIN_ROOT}/path, and Bash(git:*).
 */

import { ValidationResult } from './name';

/**
 * Validate a single tool permission entry
 *
 * @param entry - A tool permission string
 * @returns true if the entry is a non-empty string
 */
export function validateToolEntry(entry: string): boolean {
  return entry.trim().length > 0;
}

/**
 * Validate a tool list field value (string or array of strings)
 *
 * @param fieldName - The field name for error messages
 * @param value - The field value (undefined if absent)
 * @returns Validation result
 */
export function validateToolList(fieldName: string, value: unknown): ValidationResult {
  // Field is optional - undefined or null is valid
  if (value === undefined || value === null) {
    return { valid: true };
  }

  // Accept non-empty string
  if (typeof value === 'string') {
    if (value.trim() === '') {
      return {
        valid: false,
        error: `Field '${fieldName}' must be a non-empty string or an array of strings.`,
      };
    }
    return { valid: true };
  }

  // Accept array of strings with per-entry validation
  if (Array.isArray(value)) {
    if (value.some((item) => typeof item !== 'string')) {
      return {
        valid: false,
        error: `Field '${fieldName}' array must contain only strings. Found non-string entries.`,
      };
    }
    for (let i = 0; i < value.length; i++) {
      if (!validateToolEntry(value[i] as string)) {
        return {
          valid: false,
          error: `Field '${fieldName}' array contains an empty string at index ${i}. Each entry must be a non-empty tool permission pattern.`,
        };
      }
    }
    return { valid: true };
  }

  return {
    valid: false,
    error: `Field '${fieldName}' must be a string or an array of strings. Got type "${typeof value}".`,
  };
}
