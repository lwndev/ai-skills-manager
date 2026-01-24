/**
 * Output formatters for the validate command
 *
 * Provides three output formats:
 * - Normal: Verbose check-by-check output with details
 * - Quiet: Single line pass/fail output
 * - JSON: Structured JSON output for programmatic use
 */

import { DetailedValidateResult, ValidationCheckName } from '../types/api';
import { success, error, warning } from '../utils/output';

/**
 * Human-readable names for each check
 */
const CHECK_NAMES: Record<ValidationCheckName, string> = {
  fileExists: 'File existence',
  frontmatterValid: 'Frontmatter validity',
  requiredFields: 'Required fields',
  allowedProperties: 'Allowed properties',
  nameFormat: 'Name format',
  descriptionFormat: 'Description format',
  compatibilityFormat: 'Compatibility format',
  nameMatchesDirectory: 'Name matches directory',
  contextFormat: 'Context format',
  agentFormat: 'Agent format',
  hooksFormat: 'Hooks format',
  userInvocableFormat: 'User-invocable format',
};

/**
 * Format validation result in normal (verbose) mode
 *
 * Shows each check with pass/fail status and error details
 */
export function formatNormal(result: DetailedValidateResult): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`Validating skill at: ${result.skillPath}`);
  if (result.skillName) {
    lines.push(`Skill name: ${result.skillName}`);
  }
  lines.push('');

  // Individual check results
  const checkOrder: ValidationCheckName[] = [
    'fileExists',
    'frontmatterValid',
    'requiredFields',
    'allowedProperties',
    'nameFormat',
    'descriptionFormat',
    'compatibilityFormat',
    'contextFormat',
    'agentFormat',
    'hooksFormat',
    'userInvocableFormat',
    'nameMatchesDirectory',
  ];

  for (const checkName of checkOrder) {
    const check = result.checks[checkName];
    const displayName = CHECK_NAMES[checkName];

    if (check.passed) {
      lines.push(success(displayName));
    } else {
      lines.push(error(displayName));
      if (check.error) {
        lines.push(`  ${check.error}`);
      }
    }
  }

  lines.push('');

  // Display warnings (if any)
  if (result.warnings && result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warn of result.warnings) {
      lines.push(warning(warn));
    }
    lines.push('');
  }

  // Final status
  if (result.valid) {
    lines.push(success('Skill is valid!'));
  } else {
    lines.push(error(`Skill validation failed with ${result.errors.length} error(s)`));
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Format validation result in quiet mode
 *
 * Shows only a single line with pass/fail status
 */
export function formatQuiet(result: DetailedValidateResult): string {
  if (result.valid) {
    return 'PASS';
  } else {
    return `FAIL: ${result.errors.length} error(s)`;
  }
}

/**
 * Format validation result as JSON
 *
 * Returns the full DetailedValidateResult as formatted JSON
 */
export function formatJSON(result: DetailedValidateResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format and output validation result based on options
 *
 * @param result - Validation result to format
 * @param options - Output options (quiet, json)
 */
export function formatValidationOutput(
  result: DetailedValidateResult,
  options: { quiet?: boolean; json?: boolean }
): string {
  if (options.json) {
    return formatJSON(result);
  } else if (options.quiet) {
    return formatQuiet(result);
  } else {
    return formatNormal(result);
  }
}
