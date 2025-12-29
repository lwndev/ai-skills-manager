/**
 * Skill validation orchestrator
 *
 * Runs all validation checks in sequence and collects results.
 * Returns a comprehensive ValidationResult with all check statuses.
 */

import { ValidationResult, CheckName, ParsedFrontmatter } from '../types/validation';
import { validateFileExists } from '../validators/file-exists';
import { parseFrontmatter } from '../utils/frontmatter-parser';
import { validateRequiredFields } from '../validators/required-fields';
import { validateFrontmatterKeys } from '../validators/frontmatter';
import { validateName } from '../validators/name';
import { validateDescription } from '../validators/description';

/**
 * Initialize empty check results
 */
function initializeChecks(): Record<CheckName, { passed: boolean; error?: string }> {
  return {
    fileExists: { passed: false },
    frontmatterValid: { passed: false },
    requiredFields: { passed: false },
    allowedProperties: { passed: false },
    nameFormat: { passed: false },
    descriptionFormat: { passed: false },
  };
}

/**
 * Build final validation result from checks
 */
function buildResult(
  skillPath: string,
  checks: Record<CheckName, { passed: boolean; error?: string }>,
  skillName?: string
): ValidationResult {
  const errors = Object.values(checks)
    .filter(
      (check): check is { passed: boolean; error: string } =>
        !check.passed && typeof check.error === 'string'
    )
    .map((check) => check.error);

  // Check if all checks passed
  const allChecksPassed = Object.values(checks).every((check) => check.passed);

  return {
    valid: allChecksPassed,
    skillPath,
    skillName,
    checks,
    errors,
  };
}

/**
 * Validate a skill at the given path
 *
 * Runs all validation checks:
 * 1. File existence - Verify SKILL.md exists
 * 2. Frontmatter validity - Parse YAML frontmatter
 * 3. Required fields - Check name and description present
 * 4. Allowed properties - Check for unexpected keys
 * 5. Name format - Validate name format
 * 6. Description format - Validate description format
 *
 * @param skillPath - Path to skill directory or SKILL.md file
 * @returns Comprehensive validation result
 */
export async function validateSkill(skillPath: string): Promise<ValidationResult> {
  const checks = initializeChecks();

  // Step 1: File existence check
  const fileResult = await validateFileExists(skillPath);
  checks.fileExists = {
    passed: fileResult.valid,
    error: fileResult.error,
  };

  // Cannot continue without file
  // Note: Allow empty content to pass through so frontmatter parser can provide specific error
  if (!fileResult.valid || fileResult.content === undefined) {
    return buildResult(skillPath, checks);
  }

  // Step 2: Frontmatter validity check
  const parseResult = parseFrontmatter(fileResult.content);
  checks.frontmatterValid = {
    passed: parseResult.success,
    error: parseResult.error,
  };

  // Cannot continue without valid frontmatter
  if (!parseResult.success || !parseResult.data) {
    return buildResult(skillPath, checks);
  }

  const frontmatter: ParsedFrontmatter = parseResult.data;

  // Step 3: Required fields check
  const requiredResult = validateRequiredFields(frontmatter);
  checks.requiredFields = {
    passed: requiredResult.valid,
    error: requiredResult.error,
  };

  // Step 4: Allowed properties check
  const keysResult = validateFrontmatterKeys(frontmatter);
  checks.allowedProperties = {
    passed: keysResult.valid,
    error: keysResult.error,
  };

  // Step 5: Name format check (only if name exists)
  if (typeof frontmatter.name === 'string' && frontmatter.name.trim() !== '') {
    const nameResult = validateName(frontmatter.name);
    checks.nameFormat = {
      passed: nameResult.valid,
      error: nameResult.error,
    };
  } else {
    // Name is missing or empty - mark as passed (already reported in requiredFields)
    // This avoids duplicate errors
    checks.nameFormat = {
      passed: true,
    };
  }

  // Step 6: Description format check (only if description exists)
  if (typeof frontmatter.description === 'string' && frontmatter.description.trim() !== '') {
    const descResult = validateDescription(frontmatter.description);
    checks.descriptionFormat = {
      passed: descResult.valid,
      error: descResult.error,
    };
  } else {
    // Description is missing or empty - mark as passed (already reported in requiredFields)
    // This avoids duplicate errors
    checks.descriptionFormat = {
      passed: true,
    };
  }

  return buildResult(
    fileResult.resolvedPath || skillPath,
    checks,
    typeof frontmatter.name === 'string' ? frontmatter.name : undefined
  );
}
