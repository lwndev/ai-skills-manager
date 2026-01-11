/**
 * Public validate API function.
 *
 * Validates a skill directory and returns a typed result.
 * This function never throws for validation failures - it returns
 * a result object with the valid flag and any issues found.
 *
 * @module api/validate
 */

import { validateSkill } from '../generators/validate';
import { ValidateResult, ValidationIssue, ValidationWarning } from '../types/api';
import { CheckName } from '../types/validation';

/**
 * Map of check names to machine-readable error codes.
 */
const CHECK_TO_CODE: Record<CheckName, string> = {
  fileExists: 'FILE_NOT_FOUND',
  frontmatterValid: 'INVALID_FRONTMATTER',
  requiredFields: 'MISSING_REQUIRED_FIELD',
  allowedProperties: 'INVALID_PROPERTY',
  nameFormat: 'INVALID_NAME_FORMAT',
  descriptionFormat: 'INVALID_DESCRIPTION_FORMAT',
  compatibilityFormat: 'INVALID_COMPATIBILITY_FORMAT',
  nameMatchesDirectory: 'NAME_DIRECTORY_MISMATCH',
};

/**
 * Transforms internal validation result to public API format.
 *
 * The internal validation result has errors as strings and check details
 * in a separate structure. The public API expects typed ValidationIssue
 * objects with machine-readable codes.
 */
function transformToApiResult(
  internalResult: Awaited<ReturnType<typeof validateSkill>>,
  skillPath: string
): ValidateResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationWarning[] = [];

  // Transform check failures to ValidationIssue objects
  for (const [checkName, check] of Object.entries(internalResult.checks)) {
    if (!check.passed && check.error) {
      errors.push({
        code: CHECK_TO_CODE[checkName as CheckName] || 'UNKNOWN_ERROR',
        message: check.error,
        path: skillPath,
      });
    }
  }

  // Transform warnings to ValidationWarning objects
  if (internalResult.warnings) {
    for (const warningMessage of internalResult.warnings) {
      warnings.push({
        code: 'FILE_SIZE_WARNING',
        message: warningMessage,
        path: skillPath,
      });
    }
  }

  return {
    valid: internalResult.valid,
    errors,
    warnings,
  };
}

/**
 * Validates a skill at the specified path.
 *
 * Runs all validation checks on the skill directory:
 * - File existence (SKILL.md must exist)
 * - Frontmatter validity (valid YAML)
 * - Required fields (name, description)
 * - Property validation (only allowed frontmatter keys)
 * - Name format (valid skill name)
 * - Description format (non-empty)
 * - Compatibility format (valid semver range if specified)
 * - Name matches directory (frontmatter name equals directory name)
 *
 * This function never throws for validation failures. Instead, it returns
 * a result object with `valid: false` and an array of issues describing
 * what failed.
 *
 * @param path - Path to the skill directory or SKILL.md file
 * @returns Validation result with valid flag, errors, and warnings
 *
 * @example
 * ```typescript
 * import { validate } from 'ai-skills-manager';
 *
 * const result = await validate('./my-skill');
 *
 * if (result.valid) {
 *   console.log('Skill is valid!');
 * } else {
 *   for (const error of result.errors) {
 *     console.error(`[${error.code}] ${error.message}`);
 *   }
 * }
 *
 * // Check warnings even if valid
 * for (const warning of result.warnings) {
 *   console.warn(`[${warning.code}] ${warning.message}`);
 * }
 * ```
 */
export async function validate(path: string): Promise<ValidateResult> {
  const internalResult = await validateSkill(path);
  return transformToApiResult(internalResult, path);
}
