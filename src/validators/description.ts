/**
 * Skill description validation
 *
 * Rules:
 * - Non-empty
 * - Maximum length: 1024 characters
 * - Cannot contain angle brackets (< or >) to prevent XML injection
 */

import { ValidationResult } from './name';

const MAX_LENGTH = 1024;

export function validateDescription(description: string): ValidationResult {
  // Check for empty description
  if (!description || description.trim() === '') {
    return {
      valid: false,
      error: 'Description cannot be empty',
    };
  }

  // Check maximum length
  if (description.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `Description must be ${MAX_LENGTH} characters or less (got ${description.length})`,
    };
  }

  // Check for angle brackets (XML tag prevention)
  if (description.includes('<') || description.includes('>')) {
    return {
      valid: false,
      error: 'Description cannot contain angle brackets (< or >)',
    };
  }

  return { valid: true };
}
