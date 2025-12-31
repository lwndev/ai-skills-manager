/**
 * Output formatters for the package command
 *
 * Provides formatting for:
 * - Progress messages during packaging
 * - Success output with package stats
 * - Error messages
 * - Overwrite confirmation prompts
 * - Quiet mode output
 */

import { PackageResult } from '../types/package';
import { success, error, info, warning } from '../utils/output';
import { formatFileSize } from '../utils/archiver';
import { ValidationFailedError } from '../utils/errors';

/**
 * Packaging stages for progress messages
 */
export type PackageStage =
  | 'validating'
  | 'checking'
  | 'creating'
  | 'adding'
  | 'finalizing'
  | 'complete';

/**
 * Format progress message for a packaging stage
 *
 * @param stage - Current packaging stage
 * @param detail - Optional detail (e.g., file being added)
 * @returns Formatted progress message
 */
export function formatPackageProgress(stage: PackageStage, detail?: string): string {
  switch (stage) {
    case 'validating':
      return info('Validating skill...');
    case 'checking':
      return info('Checking for existing package...');
    case 'creating':
      return info('Creating package archive...');
    case 'adding':
      return detail ? info(`Adding: ${detail}`) : info('Adding files...');
    case 'finalizing':
      return info('Finalizing package...');
    case 'complete':
      return success('Package created successfully!');
    default:
      return info('Processing...');
  }
}

/**
 * Format success output with package statistics
 *
 * @param result - Package result with success details
 * @returns Formatted success output
 */
export function formatPackageSuccess(result: PackageResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(success('Package created successfully!'));
  lines.push('');

  // Package details
  lines.push('Package details:');
  lines.push(`  Path: ${result.packagePath}`);
  lines.push(`  Files: ${result.fileCount}`);
  lines.push(`  Size: ${formatFileSize(result.size)}`);
  lines.push('');

  // Next steps
  lines.push('Next steps:');
  lines.push('  1. Share the .skill file with others');
  lines.push('  2. Install with: asm install <package-path>');
  lines.push('');
  lines.push('Documentation:');
  lines.push('  https://docs.claude.com/en/docs/claude-code/skills');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format error message for packaging failures
 *
 * @param err - Error that occurred
 * @returns Formatted error message
 */
export function formatPackageError(err: Error): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(error(err.message));

  // Add validation errors if available
  if (err instanceof ValidationFailedError && err.validationErrors.length > 0) {
    lines.push('');
    lines.push('Validation errors:');
    for (const validationError of err.validationErrors) {
      lines.push(`  • ${validationError}`);
    }
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Format overwrite confirmation prompt
 *
 * @param existingPath - Path to existing package file
 * @returns Formatted prompt message
 */
export function formatOverwritePrompt(existingPath: string): string {
  return warning(`Package already exists: ${existingPath}\nOverwrite?`);
}

/**
 * Format quiet mode output (minimal)
 *
 * @param result - Package result
 * @returns Single line output
 */
export function formatQuietOutput(result: PackageResult): string {
  if (result.success) {
    return result.packagePath || 'Package created';
  } else {
    return `FAIL: ${result.errors.join(', ') || 'Unknown error'}`;
  }
}

/**
 * Format output based on options
 *
 * @param result - Package result
 * @param options - Output options
 * @returns Formatted output string
 */
export function formatPackageOutput(result: PackageResult, options: { quiet?: boolean }): string {
  if (options.quiet) {
    return formatQuietOutput(result);
  }
  return formatPackageSuccess(result);
}
