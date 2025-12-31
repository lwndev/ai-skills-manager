/**
 * Pre-package validation for skill packaging
 *
 * Validates that a skill is ready for packaging by:
 * 1. Checking the skill path is valid
 * 2. Running full skill validation (unless skipValidation is true)
 *
 * This integrates the path validation from validators/skill-path.ts
 * with the skill content validation from generators/validate.ts
 */

import { validateSkillPath, SkillPathValidationResult } from '../validators/skill-path';
import { validateSkill } from './validate';
import { ValidationResult } from '../types/validation';

/**
 * Result of pre-package validation
 */
export interface PackageValidationResult {
  /** Whether the skill is valid and ready for packaging */
  valid: boolean;
  /** Resolved absolute path to the skill directory */
  skillDir?: string;
  /** Resolved absolute path to SKILL.md */
  skillFilePath?: string;
  /** Skill name extracted from frontmatter */
  skillName?: string;
  /** Array of error messages (if validation failed) */
  errors: string[];
  /** Whether validation was skipped */
  validationSkipped: boolean;
  /** Detailed validation result (if validation was run) */
  validationResult?: ValidationResult;
}

/**
 * Validate a skill for packaging
 *
 * @param skillPath - Path to skill directory or SKILL.md file
 * @param skipValidation - If true, skip content validation (only check path)
 * @returns Validation result with skill directory path and any errors
 */
export async function validateForPackaging(
  skillPath: string,
  skipValidation: boolean = false
): Promise<PackageValidationResult> {
  // Step 1: Validate the skill path
  const pathResult: SkillPathValidationResult = await validateSkillPath(skillPath);

  if (!pathResult.valid) {
    return {
      valid: false,
      errors: [pathResult.error || 'Invalid skill path'],
      validationSkipped: skipValidation,
    };
  }

  // At this point, pathResult.valid is true, so skillDir is defined
  const skillDir = pathResult.skillDir as string;
  const skillFilePath = pathResult.skillFilePath as string;

  // If validation is skipped, return success with just path info
  if (skipValidation) {
    return {
      valid: true,
      skillDir,
      skillFilePath,
      errors: [],
      validationSkipped: true,
    };
  }

  // Step 2: Run full skill validation
  const validationResult: ValidationResult = await validateSkill(skillDir);

  if (!validationResult.valid) {
    return {
      valid: false,
      skillDir,
      skillFilePath,
      errors: validationResult.errors,
      validationSkipped: false,
      validationResult,
    };
  }

  // All validations passed
  return {
    valid: true,
    skillDir,
    skillFilePath,
    skillName: validationResult.skillName,
    errors: [],
    validationSkipped: false,
    validationResult,
  };
}
