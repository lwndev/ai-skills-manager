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
import {
  ValidateResult,
  DetailedValidateResult,
  ValidateOptions,
  ValidationIssue,
  ValidationWarning,
  ValidationCheckName,
} from '../types/api';
import { CheckName } from '../types/validation';

// Disable no-redeclare for TypeScript function overloads
/* eslint-disable no-redeclare */

/**
 * Categorize a warning message into a machine-readable code.
 *
 * Warnings originate from three sources in the validation pipeline:
 * - File size analysis: "Content size exceeds..."
 * - Model validation: "Unknown model '...' in model field..."
 * - Hooks validation: "Unknown hook key..."
 */
function categorizeWarningCode(message: string): string {
  if (message.includes('Unknown model')) {
    return 'UNKNOWN_MODEL';
  }
  if (message.includes('Unknown hook key')) {
    return 'UNKNOWN_HOOK_KEY';
  }
  if (message.includes('lines') || message.includes('tokens')) {
    return 'FILE_SIZE_WARNING';
  }
  return 'VALIDATION_WARNING';
}

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
  contextFormat: 'INVALID_CONTEXT_FORMAT',
  agentFormat: 'INVALID_AGENT_FORMAT',
  hooksFormat: 'INVALID_HOOKS_FORMAT',
  userInvocableFormat: 'INVALID_USER_INVOCABLE_FORMAT',
  memoryFormat: 'INVALID_MEMORY_FORMAT',
  skillsFormat: 'INVALID_SKILLS_FORMAT',
  modelFormat: 'INVALID_MODEL_FORMAT',
  permissionModeFormat: 'INVALID_PERMISSION_MODE_FORMAT',
  disallowedToolsFormat: 'INVALID_DISALLOWED_TOOLS_FORMAT',
  argumentHintFormat: 'INVALID_ARGUMENT_HINT_FORMAT',
  keepCodingInstructionsFormat: 'INVALID_KEEP_CODING_INSTRUCTIONS_FORMAT',
  toolsFormat: 'INVALID_TOOLS_FORMAT',
  colorFormat: 'INVALID_COLOR_FORMAT',
  disableModelInvocationFormat: 'INVALID_DISABLE_MODEL_INVOCATION_FORMAT',
  versionFormat: 'INVALID_VERSION_FORMAT',
  allowedToolsFormat: 'INVALID_ALLOWED_TOOLS_FORMAT',
};

/**
 * Transforms internal validation result to public API format (simple mode).
 *
 * The internal validation result has errors as strings and check details
 * in a separate structure. The public API expects typed ValidationIssue
 * objects with machine-readable codes.
 */
function transformToSimpleResult(
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
        code: categorizeWarningCode(warningMessage),
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
 * Transforms internal validation result to detailed API format.
 *
 * Returns the full check-by-check structure for CLI output and detailed analysis.
 */
function transformToDetailedResult(
  internalResult: Awaited<ReturnType<typeof validateSkill>>
): DetailedValidateResult {
  // Cast the checks to the public type (they have the same structure)
  const checks = internalResult.checks as Record<
    ValidationCheckName,
    { passed: boolean; error?: string }
  >;

  return {
    valid: internalResult.valid,
    skillPath: internalResult.skillPath,
    skillName: internalResult.skillName,
    checks,
    errors: internalResult.errors,
    warnings: internalResult.warnings,
  };
}

/**
 * Validates a skill at the specified path.
 *
 * @param path - Path to the skill directory or SKILL.md file
 * @param options - Options with `detailed: true` to get detailed results
 * @returns Detailed validation result with check-by-check results
 *
 * @example
 * ```typescript
 * import { validate } from 'ai-skills-manager';
 *
 * // Get detailed check-by-check results (for CLI output)
 * const detailed = await validate('./my-skill', { detailed: true });
 * console.log(`Skill: ${detailed.skillName}`);
 * console.log(`Path: ${detailed.skillPath}`);
 *
 * for (const [checkName, check] of Object.entries(detailed.checks)) {
 *   const status = check.passed ? 'PASS' : 'FAIL';
 *   console.log(`  ${checkName}: ${status}`);
 *   if (check.error) {
 *     console.log(`    Error: ${check.error}`);
 *   }
 * }
 * ```
 */
export async function validate(
  path: string,
  options: { detailed: true }
): Promise<DetailedValidateResult>;

/**
 * Validates a skill at the specified path.
 *
 * @param path - Path to the skill directory or SKILL.md file
 * @param options - Options (optional)
 * @returns Simple validation result with valid flag, errors, and warnings
 *
 * @example
 * ```typescript
 * import { validate } from 'ai-skills-manager';
 *
 * // Get simple result (default)
 * const result = await validate('./my-skill');
 *
 * if (result.valid) {
 *   console.log('Skill is valid!');
 * } else {
 *   for (const error of result.errors) {
 *     console.error(`[${error.code}] ${error.message}`);
 *   }
 * }
 * ```
 */
export async function validate(
  path: string,
  options?: { detailed?: false } | ValidateOptions
): Promise<ValidateResult>;

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
 * a result object with `valid: false` and details about what failed.
 *
 * @param path - Path to the skill directory or SKILL.md file
 * @param options - Optional configuration. Use `{ detailed: true }` for check-by-check results.
 * @returns Validation result (simple or detailed based on options)
 */
export async function validate(
  path: string,
  options?: ValidateOptions
): Promise<ValidateResult | DetailedValidateResult> {
  const internalResult = await validateSkill(path);

  if (options?.detailed) {
    return transformToDetailedResult(internalResult);
  }

  return transformToSimpleResult(internalResult, path);
}
