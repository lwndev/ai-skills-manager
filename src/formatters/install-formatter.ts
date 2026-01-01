/**
 * Output formatters for the install command
 *
 * Provides formatting for:
 * - Progress messages during installation
 * - Success output with install stats
 * - Error messages
 * - Overwrite confirmation prompts
 * - Dry-run preview output
 * - Security warnings
 * - Quiet mode output
 */

import { InstallResult, DryRunPreview, FileComparison } from '../types/install';
import { success, error, info, warning } from '../utils/output';
import { formatFileSize } from '../utils/archiver';
import { PackageValidationError, InvalidPackageError } from '../utils/errors';

/**
 * Installation stages for progress messages
 */
export type InstallStage =
  | 'opening'
  | 'validating'
  | 'checking'
  | 'extracting'
  | 'verifying'
  | 'complete';

/**
 * Validation check for progress display
 */
export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

/**
 * Format progress message for an installation stage
 *
 * @param stage - Current installation stage
 * @param detail - Optional detail (e.g., file being extracted)
 * @returns Formatted progress message
 */
export function formatInstallProgress(stage: InstallStage, detail?: string): string {
  switch (stage) {
    case 'opening':
      return info('Opening package...');
    case 'validating':
      return info('Validating package structure...');
    case 'checking':
      return detail
        ? info(`Checking for existing skill at ${detail}...`)
        : info('Checking for existing skill...');
    case 'extracting':
      return info('Extracting files...');
    case 'verifying':
      return info('Verifying installation...');
    case 'complete':
      return success('Skill installed successfully!');
    default:
      return info('Processing...');
  }
}

/**
 * Format validation progress with check results
 *
 * @param checks - Array of validation checks and results
 * @returns Formatted validation output
 */
export function formatValidationProgress(checks: ValidationCheck[]): string {
  const lines: string[] = [];
  lines.push(info('Package validation:'));

  for (const check of checks) {
    const icon = check.passed ? '  ✓' : '  ✗';
    const detail = check.detail ? ` (${check.detail})` : '';
    lines.push(`${icon} ${check.name}${detail}`);
  }

  return lines.join('\n');
}

/**
 * Format extraction progress for a file
 *
 * @param file - File being extracted
 * @param current - Current file number
 * @param total - Total number of files
 * @returns Formatted progress message
 */
export function formatExtractionProgress(file: string, current: number, total: number): string {
  return info(`Extracting (${current}/${total}): ${file}`);
}

/**
 * Format success output with installation statistics
 *
 * @param result - Installation result with success details
 * @returns Formatted success output
 */
export function formatInstallSuccess(result: InstallResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(success('Skill installed successfully!'));
  lines.push('');

  // Installation details
  lines.push('Installation details:');
  lines.push(`  Name: ${result.skillName}`);
  lines.push(`  Path: ${result.skillPath}`);
  lines.push(`  Files: ${result.fileCount}`);
  lines.push(`  Size: ${formatFileSize(result.size)}`);
  if (result.wasOverwritten) {
    lines.push('  Note: Previous version was overwritten');
  }
  lines.push('');

  // Security warning
  lines.push(formatSecurityWarning());
  lines.push('');

  // Next steps
  lines.push(formatNextSteps());

  return lines.join('\n');
}

/**
 * Format error message for installation failures
 *
 * @param err - Error that occurred
 * @returns Formatted error message
 */
export function formatInstallError(err: Error): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(error(err.message));

  // Add validation errors if available
  if (err instanceof PackageValidationError && err.validationErrors.length > 0) {
    lines.push('');
    lines.push('Validation errors:');
    for (const validationError of err.validationErrors) {
      lines.push(`  - ${validationError}`);
    }
  }

  // Add package-specific info if available
  if (err instanceof InvalidPackageError) {
    lines.push('');
    lines.push('Ensure the package was created with `asm package`.');
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Format overwrite confirmation prompt
 *
 * @param skillName - Name of the existing skill
 * @param existingPath - Path to existing skill
 * @param files - File comparison details
 * @returns Formatted prompt message
 */
export function formatOverwritePrompt(
  skillName: string,
  existingPath: string,
  files: FileComparison[]
): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(warning(`Skill "${skillName}" already exists at:`));
  lines.push(`  ${existingPath}`);
  lines.push('');

  // Show file changes summary
  const modifiedCount = files.filter((f) => f.existsInTarget && f.wouldModify).length;
  const newCount = files.filter((f) => !f.existsInTarget).length;
  const unchangedCount = files.filter((f) => f.existsInTarget && !f.wouldModify).length;

  lines.push('Changes:');
  if (newCount > 0) {
    lines.push(`  + ${newCount} new file${newCount === 1 ? '' : 's'}`);
  }
  if (modifiedCount > 0) {
    lines.push(`  ~ ${modifiedCount} modified file${modifiedCount === 1 ? '' : 's'}`);
  }
  if (unchangedCount > 0) {
    lines.push(`  = ${unchangedCount} unchanged file${unchangedCount === 1 ? '' : 's'}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format dry-run output showing what would be installed
 *
 * @param preview - Dry-run preview data
 * @returns Formatted dry-run output
 */
export function formatDryRunOutput(preview: DryRunPreview): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(info('Dry run - no files were modified'));
  lines.push('');

  lines.push('Would install:');
  lines.push(`  Name: ${preview.skillName}`);
  lines.push(`  Path: ${preview.targetPath}`);
  lines.push(`  Files: ${preview.files.filter((f) => !f.isDirectory).length}`);
  lines.push(`  Size: ${formatFileSize(preview.totalSize)}`);
  lines.push('');

  if (preview.wouldOverwrite) {
    lines.push(warning('Would overwrite existing skill'));
    if (preview.conflicts.length > 0) {
      lines.push('');
      lines.push('Conflicting files:');
      for (const conflict of preview.conflicts.slice(0, 10)) {
        lines.push(`  - ${conflict}`);
      }
      if (preview.conflicts.length > 10) {
        lines.push(`  ... and ${preview.conflicts.length - 10} more`);
      }
    }
    lines.push('');
  }

  // Show files that would be installed
  lines.push('Files to install:');
  const regularFiles = preview.files.filter((f) => !f.isDirectory);
  for (const file of regularFiles.slice(0, 15)) {
    lines.push(`  ${file.path} (${formatFileSize(file.size)})`);
  }
  if (regularFiles.length > 15) {
    lines.push(`  ... and ${regularFiles.length - 15} more files`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format quiet mode output (minimal)
 *
 * @param result - Installation result
 * @returns Single line output
 */
export function formatQuietOutput(result: InstallResult): string {
  if (result.success) {
    return result.skillPath;
  } else {
    return `FAIL: ${result.errors.join(', ') || 'Unknown error'}`;
  }
}

/**
 * Format security warning about untrusted packages
 *
 * @returns Security warning message
 */
export function formatSecurityWarning(): string {
  const lines: string[] = [];
  lines.push(warning('Security note:'));
  lines.push('  Skills can execute code and access files. Only install');
  lines.push('  packages from trusted sources. Review SKILL.md before');
  lines.push('  using the skill.');
  return lines.join('\n');
}

/**
 * Format next steps after installation
 *
 * @returns Next steps guidance
 */
export function formatNextSteps(): string {
  const lines: string[] = [];
  lines.push('Next steps:');
  lines.push('  1. Review the installed SKILL.md file');
  lines.push('  2. Test the skill by invoking it in Claude Code');
  lines.push('  3. Validate with: asm validate <skill-path>');
  lines.push('');
  lines.push('Documentation:');
  lines.push('  https://docs.claude.com/en/docs/claude-code/skills');
  return lines.join('\n');
}

/**
 * Format output based on options
 *
 * @param result - Installation result
 * @param options - Output options
 * @returns Formatted output string
 */
export function formatInstallOutput(result: InstallResult, options: { quiet?: boolean }): string {
  if (options.quiet) {
    return formatQuietOutput(result);
  }
  return formatInstallSuccess(result);
}
