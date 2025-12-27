/**
 * Frontmatter key validation
 *
 * Rules:
 * - Only allowed top-level keys: name, description, license, allowed-tools, metadata
 * - Reject any unexpected top-level keys
 */

import { ValidationResult } from './name';

const ALLOWED_KEYS = new Set([
  'name',
  'description',
  'license',
  'allowed-tools',
  'metadata',
]);

export interface FrontmatterData {
  [key: string]: unknown;
}

export function validateFrontmatterKeys(
  frontmatter: FrontmatterData
): ValidationResult {
  const keys = Object.keys(frontmatter);

  // Check for empty frontmatter
  if (keys.length === 0) {
    return {
      valid: false,
      error: 'Frontmatter cannot be empty',
    };
  }

  // Check for unexpected keys
  const unexpectedKeys = keys.filter((key) => !ALLOWED_KEYS.has(key));

  if (unexpectedKeys.length > 0) {
    return {
      valid: false,
      error:
        `Unexpected frontmatter keys: ${unexpectedKeys.join(', ')}. ` +
        `Allowed keys are: ${Array.from(ALLOWED_KEYS).join(', ')}`,
    };
  }

  return { valid: true };
}
