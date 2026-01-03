/**
 * Output formatters for the uninstall command
 *
 * Provides formatting for:
 * - Progress messages during skill discovery and removal
 * - Confirmation prompts with file lists and sizes
 * - Success output with removal stats
 * - Error messages with suggestions
 * - Security error messages
 * - Dry-run preview output
 * - Quiet mode output
 * - Multi-skill summary output
 * - Partial failure output
 */

import type {
  UninstallResult,
  UninstallFailure,
  MultiUninstallResult,
  DryRunPreview,
  SkillInfo,
  FileInfo,
  UninstallError,
} from '../types/uninstall';
import type { RemovalProgress } from '../generators/uninstaller';
import { success, error, warning, info } from '../utils/output';
import { formatFileSize } from '../utils/archiver';

/**
 * Format discovery progress message
 *
 * @param skillName - Name of the skill being located
 * @param scopePath - Scope path being searched
 * @returns Formatted progress message
 */
export function formatDiscoveryProgress(skillName: string, scopePath: string): string {
  const lines: string[] = [];
  lines.push(`Uninstalling skill: ${skillName}`);
  lines.push('');
  lines.push(info('Locating skill...'));
  lines.push(`   Searching in: ${scopePath}`);
  return lines.join('\n');
}

/**
 * Format skill found message
 *
 * @param skillPath - Path where skill was found
 * @returns Formatted found message
 */
export function formatSkillFound(skillPath: string): string {
  return `   Found: ${skillPath}`;
}

/**
 * Format file list for display
 *
 * @param files - Array of file information
 * @param options - Formatting options
 * @returns Formatted file list
 */
export function formatFileList(
  files: FileInfo[],
  options: { indent?: number; maxFiles?: number } = {}
): string {
  const indent = ' '.repeat(options.indent ?? 3);
  const maxFiles = options.maxFiles ?? 15;
  const lines: string[] = [];

  // Filter to only show regular files (not directories)
  const regularFiles = files.filter((f) => !f.isDirectory);

  for (const file of regularFiles.slice(0, maxFiles)) {
    lines.push(`${indent}- ${file.relativePath} (${formatFileSize(file.size)})`);
  }

  if (regularFiles.length > maxFiles) {
    lines.push(`${indent}... and ${regularFiles.length - maxFiles} more files`);
  }

  return lines.join('\n');
}

/**
 * Format confirmation prompt for single skill
 *
 * @param skillInfo - Information about the skill to be removed
 * @returns Formatted confirmation prompt
 */
export function formatConfirmationPrompt(skillInfo: SkillInfo): string {
  const lines: string[] = [];
  const fileCount = skillInfo.files.filter((f) => !f.isDirectory).length;

  lines.push('');
  lines.push(info('Files to be removed:'));
  lines.push(formatFileList(skillInfo.files));
  lines.push('');
  lines.push(`   Total: ${fileCount} files, ${formatFileSize(skillInfo.totalSize)}`);
  lines.push('');
  lines.push(warning('This action cannot be undone.'));

  // Add warnings if present
  if (skillInfo.warnings.length > 0) {
    lines.push('');
    for (const warn of skillInfo.warnings) {
      lines.push(warning(warn));
    }
  }

  return lines.join('\n');
}

/**
 * Format confirmation prompt for multiple skills
 *
 * @param skills - Array of skill information
 * @returns Formatted multi-skill confirmation prompt
 */
export function formatMultiSkillConfirmation(skills: SkillInfo[]): string {
  const lines: string[] = [];
  let totalFiles = 0;
  let totalSize = 0;

  lines.push('');
  lines.push(info('Skills to be removed:'));

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];
    const fileCount = skill.files.filter((f) => !f.isDirectory).length;
    totalFiles += fileCount;
    totalSize += skill.totalSize;
    lines.push(
      `   ${i + 1}. ${skill.name} (${fileCount} files, ${formatFileSize(skill.totalSize)})`
    );
  }

  lines.push('');
  lines.push(`   Total: ${totalFiles} files, ${formatFileSize(totalSize)}`);
  lines.push('');
  lines.push(warning('This action cannot be undone.'));

  return lines.join('\n');
}

/**
 * Format removal progress for a single file
 *
 * @param progress - Removal progress update
 * @returns Formatted progress message
 */
export function formatRemovalProgress(progress: RemovalProgress): string {
  if (progress.success) {
    return `   ${success(`Removed: ${progress.relativePath}`)}`;
  } else {
    return `   ${warning(`Skipped: ${progress.relativePath} (${progress.errorMessage || 'unknown error'})`)}`;
  }
}

/**
 * Format removal header for a skill
 *
 * @param skillName - Name of the skill being removed
 * @returns Formatted header
 */
export function formatRemovalHeader(skillName: string): string {
  return info(`Removing ${skillName}...`);
}

/**
 * Format success output for single skill uninstall
 *
 * @param result - Successful uninstall result
 * @returns Formatted success output
 */
export function formatSuccess(result: UninstallResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(success(`Successfully uninstalled skill: ${result.skillName}`));
  lines.push(`   Removed: ${result.filesRemoved} files, ${formatFileSize(result.bytesFreed)}`);
  lines.push(`   Location was: ${result.path}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format success output for multiple skills
 *
 * @param result - Multi-skill uninstall result
 * @returns Formatted success output
 */
export function formatMultiSuccess(result: MultiUninstallResult): string {
  const lines: string[] = [];

  if (result.succeeded.length > 0 && result.failed.length === 0) {
    lines.push('');
    lines.push(success(`Successfully uninstalled ${result.succeeded.length} skills`));
    lines.push(
      `   Total removed: ${result.totalFilesRemoved} files, ${formatFileSize(result.totalBytesFreed)}`
    );
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format error message for uninstall failures
 *
 * @param err - Uninstall error
 * @param skillName - Name of the skill that failed
 * @returns Formatted error message
 */
export function formatError(err: UninstallError, skillName: string): string {
  const lines: string[] = [];

  switch (err.type) {
    case 'skill-not-found':
      lines.push('');
      lines.push(error(`Skill '${skillName}' not found in ${err.searchedPath}`));
      lines.push('');
      lines.push('Suggestions:');
      lines.push('  - Check the skill name spelling');
      lines.push(`  - Verify the skill is installed: ls ${err.searchedPath}`);
      lines.push('  - Try a different scope: asm uninstall <skill> --scope personal');
      lines.push('');
      break;

    case 'validation-error':
      lines.push('');
      lines.push(error(err.message));
      lines.push('');
      break;

    case 'filesystem-error':
      lines.push('');
      lines.push(error(`File system error during ${err.operation}: ${err.message}`));
      lines.push(`   Path: ${err.path}`);
      lines.push('');
      break;

    case 'timeout':
      lines.push('');
      lines.push(error(`Operation timed out after ${err.timeoutMs}ms`));
      lines.push('  The skill directory may be too large or the filesystem is slow.');
      lines.push('  Try again or remove the directory manually.');
      lines.push('');
      break;

    case 'partial-removal':
      lines.push('');
      lines.push(warning(`Partial removal of skill: ${err.skillName}`));
      lines.push(`   Removed: ${err.filesRemoved} files`);
      lines.push(`   Remaining: ${err.filesRemaining} files`);
      lines.push(`   Last error: ${err.lastError}`);
      lines.push('');
      lines.push('  Some files could not be removed. Check file permissions.');
      lines.push('  Manual cleanup may be required.');
      lines.push('');
      break;

    case 'security-error':
      lines.push(formatSecurityError(err));
      break;

    default:
      lines.push('');
      lines.push(error('Unknown error occurred'));
      lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format security error message
 *
 * @param err - Security error details
 * @returns Formatted security error message
 */
export function formatSecurityError(err: {
  type: 'security-error';
  reason: string;
  details: string;
}): string {
  const lines: string[] = [];

  lines.push('');

  switch (err.reason) {
    case 'path-traversal':
      lines.push(error('Security Error: Invalid skill name'));
      lines.push('');
      lines.push('Skill names must:');
      lines.push('  - Contain only lowercase letters, numbers, and hyphens');
      lines.push('  - Not contain path separators (/ or \\)');
      lines.push('  - Not be longer than 64 characters');
      break;

    case 'symlink-escape':
      lines.push(
        error('Security Error: Skill directory is a symlink pointing outside the allowed scope')
      );
      lines.push('');
      lines.push(`   ${err.details}`);
      lines.push('');
      lines.push('This could indicate a malicious skill or misconfiguration.');
      lines.push('The skill directory will NOT be removed.');
      break;

    case 'hard-link-detected':
      lines.push(warning('Warning: Skill contains files with multiple hard links'));
      lines.push('');
      lines.push(err.details);
      lines.push('');
      lines.push('Removing these files will affect all linked locations.');
      lines.push('Use --force to proceed anyway.');
      break;

    case 'containment-violation':
      lines.push(error('Security Error: File path escapes skill directory'));
      lines.push('');
      lines.push(`   ${err.details}`);
      lines.push('');
      lines.push('This may indicate a security issue. The file will NOT be removed.');
      break;

    case 'case-mismatch':
      lines.push(error('Security Error: Directory name case mismatch'));
      lines.push('');
      lines.push(`   ${err.details}`);
      lines.push('');
      lines.push('On case-insensitive filesystems, this could indicate a symlink');
      lines.push('substitution attack. The skill will NOT be removed.');
      break;

    default:
      lines.push(error(`Security Error: ${err.reason}`));
      lines.push(`   ${err.details}`);
  }

  lines.push('');
  lines.push(error('Uninstallation aborted (exit code 5)'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format security error for invalid skill name
 *
 * @param skillName - The invalid skill name
 * @returns Formatted error message
 */
export function formatInvalidSkillNameError(skillName: string): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(error(`Security Error: Invalid skill name '${skillName}'`));
  lines.push('');
  lines.push('Skill names must:');
  lines.push('  - Contain only lowercase letters, numbers, and hyphens');
  lines.push('  - Not contain path separators (/ or \\)');
  lines.push('  - Not be longer than 64 characters');
  lines.push('');
  lines.push(error('Uninstallation aborted (exit code 5)'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format invalid scope error
 *
 * @param invalidScope - The invalid scope value provided
 * @returns Formatted error message
 */
export function formatInvalidScopeError(invalidScope: string): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(error(`Invalid scope '${invalidScope}'`));
  lines.push('');
  lines.push('Only the following scopes are supported:');
  lines.push('  --scope project   .claude/skills/ (default)');
  lines.push('  --scope personal  ~/.claude/skills/');
  lines.push('');
  lines.push(error('Uninstallation failed'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format dry-run output showing what would be removed
 *
 * @param preview - Dry-run preview data
 * @param scopePath - Path where skill was found
 * @returns Formatted dry-run output
 */
export function formatDryRun(preview: DryRunPreview, scopePath: string): string {
  const lines: string[] = [];
  const fileCount = preview.files.filter((f) => !f.isDirectory).length;

  lines.push(`Dry run: ${preview.skillName}`);
  lines.push('');
  lines.push('Uninstallation preview:');
  lines.push(`   Location: ${scopePath}/${preview.skillName}`);
  lines.push('   Status: Skill found');
  lines.push('');
  lines.push('Files that would be removed:');
  lines.push(formatFileList(preview.files, { indent: 3 }));
  lines.push('');
  lines.push(`Total: ${fileCount} files, ${formatFileSize(preview.totalSize)}`);
  lines.push('');
  lines.push(info('No changes made (dry run mode)'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format quiet mode output (minimal)
 *
 * @param result - Uninstall result
 * @param scope - Scope that was used (project or personal)
 * @returns Single line output
 */
export function formatQuietOutput(result: UninstallResult, scope: string): string {
  const scopeDir = scope === 'personal' ? '~/.claude/skills/' : '.claude/skills/';
  return `${success(`${result.skillName} uninstalled from ${scopeDir} (${result.filesRemoved} files, ${formatFileSize(result.bytesFreed)})`)}`;
}

/**
 * Format quiet mode error output
 *
 * @param skillName - Name of the skill that failed
 * @param err - Error that occurred
 * @returns Single line error output
 */
export function formatQuietError(skillName: string, err: UninstallError): string {
  const message = getErrorSummary(err);
  return error(`${skillName}: ${message}`);
}

/**
 * Get a brief error summary for quiet mode
 *
 * @param err - Uninstall error
 * @returns Brief error message
 */
function getErrorSummary(err: UninstallError): string {
  switch (err.type) {
    case 'skill-not-found':
      return 'not found';
    case 'validation-error':
      return err.message;
    case 'filesystem-error':
      return `${err.operation} error`;
    case 'timeout':
      return 'timed out';
    case 'partial-removal':
      return `partial removal (${err.filesRemoved}/${err.filesRemoved + err.filesRemaining} files)`;
    case 'security-error':
      return `security: ${err.reason}`;
    default:
      return 'unknown error';
  }
}

/**
 * Format partial failure output for multiple skills
 *
 * @param result - Multi-skill uninstall result with both successes and failures
 * @returns Formatted partial failure output
 */
export function formatPartialFailure(result: MultiUninstallResult): string {
  const lines: string[] = [];

  lines.push('');

  if (result.succeeded.length > 0) {
    lines.push(success(`Uninstalled ${result.succeeded.length} skill(s):`));
    for (const s of result.succeeded) {
      lines.push(
        `   ${success(s.skillName)} (${s.filesRemoved} files, ${formatFileSize(s.bytesFreed)})`
      );
    }
    lines.push('');
  }

  if (result.failed.length > 0) {
    lines.push(error(`Failed to uninstall ${result.failed.length} skill(s):`));
    for (const f of result.failed) {
      lines.push(`   ${error(f.skillName)}: ${getErrorSummary(f.error)}`);
    }
    lines.push('');
  }

  lines.push(warning('Partial failure: some skills were not removed'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format cancellation message
 *
 * @returns Formatted cancellation message
 */
export function formatCancellation(): string {
  return '\nCancelled. No changes made.\n';
}

/**
 * Format hard link warning
 *
 * @param skillName - Name of the skill
 * @param files - Files with hard links (file path and link count)
 * @returns Formatted hard link warning
 */
export function formatHardLinkWarning(
  skillName: string,
  files: Array<{ path: string; linkCount: number }>
): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`Uninstalling skill: ${skillName}`);
  lines.push('');
  lines.push(warning('Warning: Skill contains files with multiple hard links'));
  lines.push('');
  lines.push('The following files exist in other locations on this filesystem:');
  for (const file of files.slice(0, 10)) {
    lines.push(`   - ${file.path} (${file.linkCount} hard links)`);
  }
  if (files.length > 10) {
    lines.push(`   ... and ${files.length - 10} more files`);
  }
  lines.push('');
  lines.push('Removing these files will affect all linked locations.');
  lines.push('Use --force to proceed anyway.');
  lines.push('');
  lines.push(error('Uninstallation requires --force'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format missing SKILL.md warning
 *
 * @param skillName - Name of the skill
 * @returns Formatted warning message
 */
export function formatMissingSkillMdWarning(skillName: string): string {
  return warning(
    `'${skillName}' does not appear to be a valid skill (no SKILL.md). Use --force to remove anyway.`
  );
}

/**
 * Format TOCTOU warning for skipped files
 *
 * @param skippedCount - Number of files skipped
 * @returns Formatted TOCTOU warning
 */
export function formatToctouWarning(skippedCount: number): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(warning(`Security Warning: ${skippedCount} file(s) skipped due to TOCTOU violation`));
  lines.push('   This may indicate a race condition attack or concurrent modification.');
  lines.push('   Check audit log for details: ~/.asm/audit.log');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format uninstall output based on options
 *
 * @param result - Uninstall result or failure
 * @param options - Output options
 * @returns Formatted output string
 */
export function formatUninstallOutput(
  result: UninstallResult | UninstallFailure,
  options: { quiet?: boolean; scope?: string }
): string {
  if ('success' in result && result.success === true) {
    if (options.quiet) {
      return formatQuietOutput(result as UninstallResult, options.scope || 'project');
    }
    return formatSuccess(result as UninstallResult);
  } else {
    const failure = result as UninstallFailure;
    if (options.quiet) {
      return formatQuietError(failure.skillName, failure.error);
    }
    return formatError(failure.error, failure.skillName);
  }
}
