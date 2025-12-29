/**
 * Required fields validation for SKILL.md frontmatter
 *
 * Rules:
 * - 'name' field must be present and non-empty
 * - 'description' field must be present and non-empty
 */

import { ValidationResult } from './name';
import { ParsedFrontmatter } from '../types/validation';

export interface RequiredFieldsResult extends ValidationResult {
  /** Missing field names (if any) */
  missingFields?: string[];
}

/**
 * Validate that required fields are present in frontmatter
 *
 * @param frontmatter - Parsed frontmatter data
 * @returns Validation result with missing fields if invalid
 */
export function validateRequiredFields(frontmatter: ParsedFrontmatter): RequiredFieldsResult {
  const missingFields: string[] = [];

  // Check for 'name' field
  if (!hasNonEmptyValue(frontmatter.name)) {
    missingFields.push('name');
  }

  // Check for 'description' field
  if (!hasNonEmptyValue(frontmatter.description)) {
    missingFields.push('description');
  }

  if (missingFields.length > 0) {
    const fieldList = missingFields.join(', ');
    return {
      valid: false,
      error:
        missingFields.length === 1
          ? `Missing required field: ${fieldList}`
          : `Missing required fields: ${fieldList}`,
      missingFields,
    };
  }

  return { valid: true };
}

/**
 * Check if a value is present and non-empty
 *
 * @param value - Value to check
 * @returns True if value is a non-empty string
 */
function hasNonEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim() !== '';
  }

  // Non-string values are considered present
  // (validation of value type is handled by other validators)
  return true;
}
