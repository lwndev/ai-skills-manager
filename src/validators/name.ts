/**
 * Skill name validation
 *
 * Rules:
 * - Pattern: ^[a-z0-9]+(-[a-z0-9]+)*$ (lowercase alphanumeric with hyphens, no leading/trailing/consecutive hyphens)
 * - Maximum length: 64 characters
 * - Reserved words: "anthropic", "claude" (cannot be used as the name or as part of the name)
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_LENGTH = 64;
const RESERVED_WORDS = ['anthropic', 'claude'];

export function validateName(name: string): ValidationResult {
  // Check for empty name
  if (!name || name.trim() === '') {
    return {
      valid: false,
      error: 'Skill name cannot be empty',
    };
  }

  // Check maximum length
  if (name.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `Skill name must be ${MAX_LENGTH} characters or less (got ${name.length})`,
    };
  }

  // Check pattern (lowercase alphanumeric with hyphens)
  if (!NAME_PATTERN.test(name)) {
    return {
      valid: false,
      error:
        'Skill name must contain only lowercase letters, numbers, and hyphens. ' +
        'Cannot start or end with a hyphen, or have consecutive hyphens. ' +
        `Example: "my-skill-name" (got "${name}")`,
    };
  }

  // Check reserved words
  for (const reserved of RESERVED_WORDS) {
    if (name === reserved || name.includes(reserved)) {
      return {
        valid: false,
        error: `Skill name cannot contain reserved word "${reserved}"`,
      };
    }
  }

  return { valid: true };
}
