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
import { validateCompatibility } from '../validators/compatibility';
import { validateDirectoryName } from '../validators/directory-name';
import { validateContext } from '../validators/context';
import { validateAgent } from '../validators/agent';
import { validateHooks } from '../validators/hooks';
import { validateUserInvocable } from '../validators/user-invocable';
import { validateArgumentHint } from '../validators/argument-hint';
import { validateKeepCodingInstructions } from '../validators/keep-coding-instructions';
import { validateTools } from '../validators/tools';
import { validateColor } from '../validators/color';
import { validateDisableModelInvocation } from '../validators/disable-model-invocation';
import { validateVersion } from '../validators/version';
import { validateAllowedTools } from '../validators/allowed-tools';
import { analyzeFileSize } from '../analyzers/file-size';

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
    compatibilityFormat: { passed: false },
    contextFormat: { passed: false },
    agentFormat: { passed: false },
    hooksFormat: { passed: false },
    userInvocableFormat: { passed: false },
    argumentHintFormat: { passed: false },
    keepCodingInstructionsFormat: { passed: false },
    toolsFormat: { passed: false },
    colorFormat: { passed: false },
    disableModelInvocationFormat: { passed: false },
    versionFormat: { passed: false },
    allowedToolsFormat: { passed: false },
    nameMatchesDirectory: { passed: false },
  };
}

/**
 * Build final validation result from checks
 */
function buildResult(
  skillPath: string,
  checks: Record<CheckName, { passed: boolean; error?: string }>,
  skillName?: string,
  warnings: string[] = []
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
    warnings,
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
 * 7. Compatibility format - Validate compatibility field
 * 8. Context format - Validate context field
 * 9. Agent format - Validate agent field
 * 10. Hooks format - Validate hooks field (with warnings)
 * 11. User-invocable format - Validate user-invocable field
 * 12-18. FEAT-014 fields - argumentHint, keepCodingInstructions, tools, color,
 *        disableModelInvocation, version, allowedTools
 * 19. Name matches directory - Validate name matches parent directory
 * 20. File size analysis - Generate warnings for large files
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

  // Step 7: Compatibility format check
  // Validates the optional compatibility field format
  const compatResult = validateCompatibility(frontmatter.compatibility);
  checks.compatibilityFormat = {
    passed: compatResult.valid,
    error: compatResult.error,
  };

  // Step 8: Context format check (Claude Code 2.1.x)
  // Validates the optional context field (must be "fork" if present)
  const contextResult = validateContext(frontmatter.context);
  checks.contextFormat = {
    passed: contextResult.valid,
    error: contextResult.error,
  };

  // Step 9: Agent format check (Claude Code 2.1.x)
  // Validates the optional agent field (must be non-empty string if present)
  const agentResult = validateAgent(frontmatter.agent);
  checks.agentFormat = {
    passed: agentResult.valid,
    error: agentResult.error,
  };

  // Step 10: Hooks format check (Claude Code 2.1.x)
  // Validates the optional hooks field and collects warnings for unknown keys
  const hooksResult = validateHooks(frontmatter.hooks);
  checks.hooksFormat = {
    passed: hooksResult.valid,
    error: hooksResult.valid ? undefined : hooksResult.error,
  };
  // Collect warnings from hooks validation
  const hooksWarnings = hooksResult.valid && hooksResult.warnings ? hooksResult.warnings : [];

  // Step 11: User-invocable format check (Claude Code 2.1.x)
  // Validates the optional user-invocable field (must be boolean if present)
  const userInvocableResult = validateUserInvocable(frontmatter['user-invocable']);
  checks.userInvocableFormat = {
    passed: userInvocableResult.valid,
    error: userInvocableResult.error,
  };

  // Step 12: Argument hint format check
  const argumentHintResult = validateArgumentHint(frontmatter['argument-hint']);
  checks.argumentHintFormat = {
    passed: argumentHintResult.valid,
    error: argumentHintResult.error,
  };

  // Step 13: Keep coding instructions format check
  const keepCodingResult = validateKeepCodingInstructions(frontmatter['keep-coding-instructions']);
  checks.keepCodingInstructionsFormat = {
    passed: keepCodingResult.valid,
    error: keepCodingResult.error,
  };

  // Step 14: Tools format check
  const toolsResult = validateTools(frontmatter.tools);
  checks.toolsFormat = {
    passed: toolsResult.valid,
    error: toolsResult.error,
  };

  // Step 15: Color format check
  const colorResult = validateColor(frontmatter.color);
  checks.colorFormat = {
    passed: colorResult.valid,
    error: colorResult.error,
  };

  // Step 16: Disable model invocation format check
  const disableModelResult = validateDisableModelInvocation(
    frontmatter['disable-model-invocation']
  );
  checks.disableModelInvocationFormat = {
    passed: disableModelResult.valid,
    error: disableModelResult.error,
  };

  // Step 17: Version format check
  const versionResult = validateVersion(frontmatter.version);
  checks.versionFormat = {
    passed: versionResult.valid,
    error: versionResult.error,
  };

  // Step 18: Allowed tools format check
  const allowedToolsResult = validateAllowedTools(frontmatter['allowed-tools']);
  checks.allowedToolsFormat = {
    passed: allowedToolsResult.valid,
    error: allowedToolsResult.error,
  };

  // Step 19: Name matches directory check
  // Validates that frontmatter name matches parent directory name
  if (
    typeof frontmatter.name === 'string' &&
    frontmatter.name.trim() !== '' &&
    fileResult.resolvedPath
  ) {
    const dirResult = validateDirectoryName(fileResult.resolvedPath, frontmatter.name);
    checks.nameMatchesDirectory = {
      passed: dirResult.valid,
      error: dirResult.error,
    };
  } else {
    // Skip if name is missing/empty (already reported in requiredFields)
    // or if resolvedPath is not available
    checks.nameMatchesDirectory = { passed: true };
  }

  // Step 20: File size analysis (generates warnings, not errors)
  // Analyze body content for size recommendations
  const fileSizeAnalysis = analyzeFileSize(parseResult.body || '');
  const warnings = [...hooksWarnings, ...fileSizeAnalysis.warnings];

  return buildResult(
    fileResult.resolvedPath || skillPath,
    checks,
    typeof frontmatter.name === 'string' ? frontmatter.name : undefined,
    warnings
  );
}
