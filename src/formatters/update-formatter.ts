/**
 * Output formatters for the update command
 *
 * Provides formatting for:
 * - Progress messages during update phases
 * - Version comparison display (current vs new)
 * - Change summary with file diffs
 * - Backup information and status
 * - Confirmation prompts
 * - Success output with update stats
 * - Rollback messages (success and failure)
 * - Dry-run preview output
 * - Quiet mode output
 * - Error messages with suggestions
 * - Security warnings (hard links, locks)
 * - Progress indicators (bar and spinner)
 */

import type {
  UpdateSuccess,
  UpdateDryRunPreview,
  UpdateRolledBack,
  UpdateRollbackFailed,
  UpdateCancelled,
  UpdateError,
  VersionInfo,
  VersionComparison,
  FileChange,
  BackupInfo,
  DowngradeInfo,
  ChangeSummary,
  HardLinkInfo,
  UpdateLockFile,
} from '../types/update';
import { success, error, warning, info } from '../utils/output';
import { formatFileSize } from '../utils/archiver';

/**
 * Update stages for progress messages
 */
export type UpdateStage =
  | 'locating'
  | 'validating-package'
  | 'comparing'
  | 'creating-backup'
  | 'removing-old'
  | 'extracting-new'
  | 'validating-updated'
  | 'cleaning-up'
  | 'complete';

/**
 * Spinner frames for indeterminate progress
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Progress bar configuration
 */
const PROGRESS_BAR_WIDTH = 20;
const PROGRESS_FILLED_CHAR = '█';
const PROGRESS_EMPTY_CHAR = '░';

/**
 * Format progress message for an update stage
 *
 * @param stage - Current update stage
 * @param detail - Optional detail (e.g., file being processed)
 * @returns Formatted progress message
 */
export function formatUpdateProgress(stage: UpdateStage, detail?: string): string {
  switch (stage) {
    case 'locating':
      return info('Locating installed skill...');
    case 'validating-package':
      return info('Validating new package...');
    case 'comparing':
      return info('Comparing versions...');
    case 'creating-backup':
      return detail ? info(`Creating backup: ${detail}`) : info('Creating backup...');
    case 'removing-old':
      return info('Removing old version...');
    case 'extracting-new':
      return info('Extracting new version...');
    case 'validating-updated':
      return info('Validating updated skill...');
    case 'cleaning-up':
      return info('Cleaning up...');
    case 'complete':
      return success('Update complete!');
    default:
      return info('Processing...');
  }
}

/**
 * Format current (installed) version information
 *
 * @param versionInfo - Information about the installed skill
 * @returns Formatted current version display
 */
export function formatCurrentVersion(versionInfo: VersionInfo): string {
  const lines: string[] = [];

  lines.push('Current version:');
  lines.push(`   Location: ${versionInfo.path}`);
  lines.push(`   Files: ${versionInfo.fileCount} (${formatFileSize(versionInfo.size)})`);
  if (versionInfo.lastModified) {
    lines.push(`   Modified: ${versionInfo.lastModified}`);
  }
  if (versionInfo.description) {
    lines.push(`   Description: ${versionInfo.description}`);
  }

  return lines.join('\n');
}

/**
 * Format new package version information
 *
 * @param versionInfo - Information about the new package
 * @returns Formatted new version display
 */
export function formatNewVersion(versionInfo: VersionInfo): string {
  const lines: string[] = [];

  lines.push('New version:');
  lines.push(`   Package: ${versionInfo.path}`);
  lines.push(`   Files: ${versionInfo.fileCount} (${formatFileSize(versionInfo.size)})`);
  if (versionInfo.description) {
    lines.push(`   Description: ${versionInfo.description}`);
  }

  return lines.join('\n');
}

/**
 * Format a single file change line
 *
 * @param change - File change information
 * @returns Formatted change line
 */
export function formatFileChangeLine(change: FileChange): string {
  switch (change.changeType) {
    case 'added':
      return `   + ${change.path} (added, ${formatFileSize(change.sizeAfter)})`;
    case 'removed':
      return `   - ${change.path} (removed)`;
    case 'modified': {
      const sizeStr =
        change.sizeDelta >= 0
          ? `+${formatFileSize(change.sizeDelta)}`
          : `-${formatFileSize(Math.abs(change.sizeDelta))}`;
      return `   ~ ${change.path} (modified, ${sizeStr})`;
    }
    default:
      return `   ? ${change.path}`;
  }
}

/**
 * Format change summary with file diffs
 *
 * @param comparison - Version comparison results
 * @param maxFiles - Maximum number of files to show per category (default: 10)
 * @returns Formatted change summary
 */
export function formatChangeSummary(comparison: VersionComparison, maxFiles: number = 10): string {
  const lines: string[] = [];

  lines.push('Changes:');

  // Show added files
  for (const change of comparison.filesAdded.slice(0, maxFiles)) {
    lines.push(formatFileChangeLine(change));
  }
  if (comparison.filesAdded.length > maxFiles) {
    lines.push(`   ... and ${comparison.filesAdded.length - maxFiles} more added files`);
  }

  // Show modified files
  for (const change of comparison.filesModified.slice(0, maxFiles)) {
    lines.push(formatFileChangeLine(change));
  }
  if (comparison.filesModified.length > maxFiles) {
    lines.push(`   ... and ${comparison.filesModified.length - maxFiles} more modified files`);
  }

  // Show removed files
  for (const change of comparison.filesRemoved.slice(0, maxFiles)) {
    lines.push(formatFileChangeLine(change));
  }
  if (comparison.filesRemoved.length > maxFiles) {
    lines.push(`   ... and ${comparison.filesRemoved.length - maxFiles} more removed files`);
  }

  // If no changes
  if (
    comparison.filesAdded.length === 0 &&
    comparison.filesModified.length === 0 &&
    comparison.filesRemoved.length === 0
  ) {
    lines.push('   No file changes detected');
  }

  return lines.join('\n');
}

/**
 * Format backup information
 *
 * @param backupInfo - Backup details
 * @param willBeRemoved - Whether backup will be removed after success
 * @returns Formatted backup info
 */
export function formatBackupInfo(backupInfo: BackupInfo, willBeRemoved: boolean = true): string {
  const lines: string[] = [];

  lines.push(`Backup location: ${backupInfo.path}`);
  if (!willBeRemoved) {
    lines.push('   (backup will be kept)');
  }

  return lines.join('\n');
}

/**
 * Format confirmation prompt with full update summary
 *
 * @param skillName - Name of the skill being updated
 * @param currentVersion - Current version information
 * @param newVersion - New version information
 * @param comparison - Version comparison results
 * @param backupPath - Path where backup will be created
 * @returns Formatted confirmation prompt
 */
export function formatConfirmationPrompt(
  skillName: string,
  currentVersion: VersionInfo,
  newVersion: VersionInfo,
  comparison: VersionComparison,
  backupPath: string
): string {
  const lines: string[] = [];

  lines.push(`Updating skill: ${skillName}`);
  lines.push('');
  lines.push(formatCurrentVersion(currentVersion));
  lines.push('');
  lines.push(formatNewVersion(newVersion));
  lines.push('');
  lines.push(formatChangeSummary(comparison));
  lines.push('');
  lines.push(`Backup location: ${backupPath}`);
  lines.push('');
  lines.push('This will replace the installed skill with the new version.');

  return lines.join('\n');
}

/**
 * Format downgrade warning message
 *
 * @param downgradeInfo - Downgrade detection information
 * @returns Formatted downgrade warning
 */
export function formatDowngradeWarning(downgradeInfo: DowngradeInfo): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(warning('This appears to be a downgrade'));
  if (downgradeInfo.installedDate) {
    lines.push(`   Current version date: ${downgradeInfo.installedDate}`);
  }
  if (downgradeInfo.newDate) {
    lines.push(`   New package date: ${downgradeInfo.newDate}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format update success message
 *
 * @param result - Successful update result
 * @param scope - The scope used (project or personal)
 * @returns Formatted success output
 */
export function formatUpdateSuccess(result: UpdateSuccess, scope: string = 'project'): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(success(`Successfully updated skill: ${result.skillName}`));
  lines.push(
    `   Previous: ${result.previousFileCount} files, ${formatFileSize(result.previousSize)}`
  );
  lines.push(`   Current: ${result.currentFileCount} files, ${formatFileSize(result.currentSize)}`);

  if (result.backupPath) {
    const backupNote = result.backupWillBeRemoved ? ' (will be removed)' : ' (kept)';
    lines.push(`   Backup: ${result.backupPath}${backupNote}`);
  }

  lines.push('');
  lines.push('To restore the previous version, use:');

  const scopeArg = scope === 'personal' ? '--scope personal' : '--scope project';
  if (result.backupPath) {
    lines.push(`   asm install ${result.backupPath} ${scopeArg} --force`);
  } else {
    lines.push('   (no backup available - previous version cannot be restored)');
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Format rollback success message
 *
 * @param result - Rollback result
 * @returns Formatted rollback success output
 */
export function formatRollbackSuccess(result: UpdateRolledBack): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('Post-update validation failed:');
  lines.push(`   ${result.failureReason}`);
  lines.push('');
  lines.push('Rolling back...');
  lines.push('   Removing failed installation...');
  lines.push('   Restoring previous version...');
  lines.push('   Verifying restoration...');
  lines.push('');
  lines.push(warning(`Rollback successful: ${result.skillName} restored to previous version`));
  if (result.backupPath) {
    lines.push(`   Backup kept at: ${result.backupPath}`);
  }
  lines.push('');
  lines.push(error('Update failed (exit code 6)'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format rollback failed (critical error) message
 *
 * @param result - Rollback failure result
 * @returns Formatted critical error output
 */
export function formatRollbackFailed(result: UpdateRollbackFailed): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(error('CRITICAL: Rollback failed - manual intervention required'));
  lines.push('');
  lines.push('Update failed:');
  lines.push(`   ${result.updateFailureReason}`);
  lines.push('');
  lines.push('Rollback failed:');
  lines.push(`   ${result.rollbackFailureReason}`);
  lines.push('');
  lines.push('Skill state:');
  lines.push(`   Name: ${result.skillName}`);
  lines.push(`   Path: ${result.path}`);
  if (result.backupPath) {
    lines.push(`   Backup: ${result.backupPath}`);
  }
  lines.push('');
  lines.push('Recovery instructions:');
  lines.push(`   ${result.recoveryInstructions}`);
  lines.push('');
  lines.push(error('Update failed (exit code 7)'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format dry-run preview output
 *
 * @param preview - Dry-run preview data
 * @returns Formatted dry-run output
 */
export function formatDryRun(preview: UpdateDryRunPreview): string {
  const lines: string[] = [];

  lines.push(`Dry run: ${preview.skillName}`);
  lines.push('');
  lines.push('Update preview:');
  lines.push(`   Skill: ${preview.skillName}`);
  lines.push(`   Location: ${preview.path}`);
  lines.push('');
  lines.push('Current version:');
  lines.push(
    `   Files: ${preview.currentVersion.fileCount} (${formatFileSize(preview.currentVersion.size)})`
  );
  if (preview.currentVersion.lastModified) {
    lines.push(`   Modified: ${preview.currentVersion.lastModified}`);
  }
  lines.push('');
  lines.push('New version:');
  lines.push(`   Package: ${preview.newVersion.path}`);
  lines.push(
    `   Files: ${preview.newVersion.fileCount} (${formatFileSize(preview.newVersion.size)})`
  );
  lines.push('');
  lines.push('Changes that would be made:');

  // Show changes
  for (const change of preview.comparison.filesAdded.slice(0, 10)) {
    lines.push(formatFileChangeLine(change));
  }
  if (preview.comparison.filesAdded.length > 10) {
    lines.push(`   ... and ${preview.comparison.filesAdded.length - 10} more added files`);
  }

  for (const change of preview.comparison.filesModified.slice(0, 10)) {
    lines.push(formatFileChangeLine(change));
  }
  if (preview.comparison.filesModified.length > 10) {
    lines.push(`   ... and ${preview.comparison.filesModified.length - 10} more modified files`);
  }

  for (const change of preview.comparison.filesRemoved.slice(0, 10)) {
    lines.push(formatFileChangeLine(change));
  }
  if (preview.comparison.filesRemoved.length > 10) {
    lines.push(`   ... and ${preview.comparison.filesRemoved.length - 10} more removed files`);
  }

  if (
    preview.comparison.filesAdded.length === 0 &&
    preview.comparison.filesModified.length === 0 &&
    preview.comparison.filesRemoved.length === 0
  ) {
    lines.push('   No file changes detected');
  }

  lines.push('');
  lines.push('Backup would be created at:');
  lines.push(`   ${preview.backupPath}`);
  lines.push('');
  lines.push(info('No changes made (dry run mode)'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format quiet mode output (single line)
 *
 * @param result - Update result
 * @returns Single line output
 */
export function formatQuietOutput(result: UpdateSuccess): string {
  return `${result.skillName} updated (${result.previousFileCount} -> ${result.currentFileCount} files, ${formatFileSize(result.previousSize)} -> ${formatFileSize(result.currentSize)})`;
}

/**
 * Format error message based on error type
 *
 * @param err - Update error
 * @returns Formatted error message
 */
export function formatError(err: UpdateError): string {
  const lines: string[] = [];

  switch (err.type) {
    case 'skill-not-found':
      lines.push('');
      lines.push(error(`Skill '${err.skillName}' not found in ${err.searchedPath}`));
      lines.push('');
      lines.push('Suggestions:');
      lines.push('  - Check the skill name spelling');
      lines.push(`  - Verify the skill is installed: ls ${err.searchedPath}`);
      lines.push('  - Try a different scope: asm update <skill> <package> --scope personal');
      lines.push('');
      lines.push(error('Update failed'));
      lines.push('');
      break;

    case 'security-error':
      lines.push(formatSecurityError(err.reason, err.details));
      break;

    case 'filesystem-error':
      lines.push('');
      lines.push(error(`File system error during ${err.operation}: ${err.message}`));
      lines.push(`   Path: ${err.path}`);
      lines.push('');
      lines.push(error('Update failed (no changes made)'));
      lines.push('');
      break;

    case 'validation-error':
      lines.push('');
      lines.push(error(err.message));
      if (err.details && err.details.length > 0) {
        lines.push('');
        for (const detail of err.details) {
          lines.push(`   - ${detail}`);
        }
      }
      lines.push('');
      lines.push(error('Update failed'));
      lines.push('');
      break;

    case 'package-mismatch':
      lines.push('');
      lines.push(error('Package skill name does not match installed skill'));
      lines.push(`   Installed skill: ${err.installedSkillName}`);
      lines.push(`   Package skill: ${err.packageSkillName}`);
      lines.push('');
      lines.push('Use the correct package for this skill, or install as a new skill:');
      lines.push(`   asm install <package> --scope <scope>`);
      lines.push('');
      lines.push(error('Update failed (no changes made)'));
      lines.push('');
      break;

    case 'backup-creation-error':
      lines.push('');
      lines.push(error('Failed to create backup'));
      lines.push(`   Path: ${err.backupPath}`);
      lines.push(`   Reason: ${err.reason}`);
      lines.push('');
      lines.push('Suggestions:');
      lines.push('  - Check disk space: df -h ~/.asm');
      lines.push('  - Check permissions: ls -la ~/.asm/backups/');
      lines.push('  - Use --no-backup to skip backup (not recommended)');
      lines.push('');
      lines.push(error('Update failed (no changes made)'));
      lines.push('');
      break;

    case 'rollback-error':
      // This is handled by formatRollbackSuccess
      lines.push('');
      lines.push(warning(`Update failed, but rollback succeeded: ${err.skillName}`));
      lines.push(`   Reason: ${err.updateFailureReason}`);
      if (err.backupPath) {
        lines.push(`   Backup kept at: ${err.backupPath}`);
      }
      lines.push('');
      lines.push(error('Update failed (exit code 6)'));
      lines.push('');
      break;

    case 'critical-error':
      // This is handled by formatRollbackFailed
      lines.push('');
      lines.push(error(`CRITICAL: Update and rollback both failed for ${err.skillName}`));
      lines.push(`   Update failure: ${err.updateFailureReason}`);
      lines.push(`   Rollback failure: ${err.rollbackFailureReason}`);
      lines.push(`   Skill path: ${err.skillPath}`);
      if (err.backupPath) {
        lines.push(`   Backup: ${err.backupPath}`);
      }
      lines.push('');
      lines.push('Recovery:');
      lines.push(`   ${err.recoveryInstructions}`);
      lines.push('');
      lines.push(error('Update failed (exit code 7)'));
      lines.push('');
      break;

    case 'timeout':
      lines.push('');
      lines.push(error(`Operation timed out: ${err.operationName}`));
      lines.push(`   Timeout: ${err.timeoutMs}ms`);
      lines.push('');
      lines.push('Suggestions:');
      lines.push('  - The skill or package may be too large');
      lines.push('  - Check file system performance');
      lines.push('  - Try again when system is less busy');
      lines.push('');
      lines.push(error('Update failed (no changes made)'));
      lines.push('');
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
 * @param reason - Security error reason
 * @param details - Additional details
 * @returns Formatted security error
 */
function formatSecurityError(
  reason:
    | 'path-traversal'
    | 'symlink-escape'
    | 'hard-link-detected'
    | 'containment-violation'
    | 'case-mismatch'
    | 'zip-bomb'
    | 'zip-entry-escape',
  details: string
): string {
  const lines: string[] = [];

  lines.push('');

  switch (reason) {
    case 'path-traversal':
      lines.push(error('Security Error: Path traversal detected'));
      lines.push('');
      lines.push(`   ${details}`);
      break;

    case 'symlink-escape':
      lines.push(error('Security Error: Symlink points outside allowed scope'));
      lines.push('');
      lines.push(`   ${details}`);
      lines.push('');
      lines.push('This could indicate a malicious skill or misconfiguration.');
      break;

    case 'hard-link-detected':
      lines.push(warning('Warning: Skill contains files with multiple hard links'));
      lines.push('');
      lines.push(`   ${details}`);
      lines.push('');
      lines.push('Use --force to proceed anyway.');
      break;

    case 'containment-violation':
      lines.push(error('Security Error: File path escapes skill directory'));
      lines.push('');
      lines.push(`   ${details}`);
      break;

    case 'case-mismatch':
      lines.push(error('Security Error: Skill name case mismatch'));
      lines.push('');
      lines.push(`   ${details}`);
      lines.push('');
      lines.push('On case-insensitive filesystems, this could indicate a');
      lines.push('symlink substitution attack.');
      break;

    case 'zip-bomb':
      lines.push(error('Security Error: Potential ZIP bomb detected'));
      lines.push('');
      lines.push(`   ${details}`);
      lines.push('');
      lines.push('The package has an unusually high compression ratio.');
      break;

    case 'zip-entry-escape':
      lines.push(error('Security Error: Package contains path traversal entries'));
      lines.push('');
      lines.push(`   ${details}`);
      lines.push('');
      lines.push('The package may be malicious.');
      break;

    default:
      lines.push(error(`Security Error: ${reason}`));
      lines.push(`   ${details}`);
  }

  lines.push('');
  lines.push(error('Update aborted (exit code 5)'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format hard link warning
 *
 * @param skillName - Name of the skill
 * @param files - Files with multiple hard links
 * @returns Formatted hard link warning
 */
export function formatHardLinkWarning(skillName: string, files: HardLinkInfo[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`Updating skill: ${skillName}`);
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
  lines.push('Updating these files will affect all linked locations.');
  lines.push('Use --force to proceed anyway.');
  lines.push('');
  lines.push(error('Update requires --force'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format lock conflict error
 *
 * @param lockInfo - Information about the existing lock
 * @returns Formatted lock conflict message
 */
export function formatLockConflict(lockInfo: UpdateLockFile): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(error('Update already in progress'));
  lines.push('');
  lines.push(`   Process ID: ${lockInfo.pid}`);
  lines.push(`   Started: ${lockInfo.timestamp}`);
  lines.push(`   Package: ${lockInfo.packagePath}`);
  lines.push('');
  lines.push('If the previous update was interrupted, remove the lock file:');
  lines.push('   rm <skill-dir>/.asm-update.lock');
  lines.push('');
  lines.push(error('Update failed'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format progress bar for determinate operations
 *
 * @param current - Current progress value
 * @param total - Total value
 * @param label - Label to show with progress bar
 * @returns Formatted progress bar string
 */
export function formatProgressBar(current: number, total: number, label: string): string {
  const percentage = total > 0 ? Math.min(100, Math.floor((current / total) * 100)) : 0;
  const filledWidth = Math.floor((percentage / 100) * PROGRESS_BAR_WIDTH);
  const emptyWidth = PROGRESS_BAR_WIDTH - filledWidth;

  const filled = PROGRESS_FILLED_CHAR.repeat(filledWidth);
  const empty = PROGRESS_EMPTY_CHAR.repeat(emptyWidth);

  return `[${filled}${empty}] ${percentage}% ${label}`;
}

/**
 * Format progress spinner for indeterminate operations
 *
 * @param stage - Current operation stage description
 * @param frameIndex - Current animation frame index (0-9)
 * @returns Formatted spinner string
 */
export function formatProgressSpinner(stage: string, frameIndex: number = 0): string {
  const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
  return `${frame} ${stage}`;
}

/**
 * Check if enough time has elapsed to show progress indicator (2 second threshold per NFR-1)
 *
 * @param startTime - Timestamp when operation started (from Date.now())
 * @param thresholdMs - Threshold in milliseconds (default: 2000)
 * @returns True if progress should be shown
 */
export function shouldShowProgress(startTime: number, thresholdMs: number = 2000): boolean {
  return Date.now() - startTime >= thresholdMs;
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
 * Format change summary statistics
 *
 * @param summary - Change summary with counts and sizes
 * @returns Formatted summary statistics
 */
export function formatChangeSummaryStats(summary: ChangeSummary): string {
  const lines: string[] = [];

  lines.push('Summary:');
  if (summary.addedCount > 0) {
    lines.push(`   + ${summary.addedCount} file${summary.addedCount === 1 ? '' : 's'} added`);
  }
  if (summary.modifiedCount > 0) {
    lines.push(
      `   ~ ${summary.modifiedCount} file${summary.modifiedCount === 1 ? '' : 's'} modified`
    );
  }
  if (summary.removedCount > 0) {
    lines.push(`   - ${summary.removedCount} file${summary.removedCount === 1 ? '' : 's'} removed`);
  }

  if (summary.netSizeChange !== 0) {
    const sign = summary.netSizeChange > 0 ? '+' : '-';
    lines.push(`   Net size change: ${sign}${formatFileSize(Math.abs(summary.netSizeChange))}`);
  }

  return lines.join('\n');
}

/**
 * Format update output based on result type and options
 *
 * @param result - Update result (success, dry-run, rollback, or rollback-failed)
 * @param options - Output options
 * @returns Formatted output string
 */
export function formatUpdateOutput(
  result:
    | UpdateSuccess
    | UpdateDryRunPreview
    | UpdateRolledBack
    | UpdateRollbackFailed
    | UpdateCancelled,
  options: { quiet?: boolean; scope?: string } = {}
): string {
  switch (result.type) {
    case 'update-success':
      if (options.quiet) {
        return formatQuietOutput(result);
      }
      return formatUpdateSuccess(result, options.scope);

    case 'update-dry-run-preview':
      return formatDryRun(result);

    case 'update-rolled-back':
      return formatRollbackSuccess(result);

    case 'update-rollback-failed':
      return formatRollbackFailed(result);

    case 'update-cancelled':
      return formatCancelledUpdate(result);

    default:
      return error('Unknown result type');
  }
}

/**
 * Format cancelled update message
 *
 * @param result - Cancelled update result
 * @returns Formatted cancellation message
 */
export function formatCancelledUpdate(result: UpdateCancelled): string {
  const lines: string[] = [];

  lines.push('');

  if (result.reason === 'interrupted') {
    lines.push(warning(`Update of '${result.skillName}' was interrupted`));
  } else {
    lines.push(info(`Update of '${result.skillName}' was cancelled`));
  }

  lines.push('');

  if (result.cleanupPerformed) {
    lines.push('Cleanup completed. No changes were made.');
  } else {
    lines.push('No changes were made.');
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Format skill found message during discovery
 *
 * @param skillPath - Path where skill was found
 * @returns Formatted found message
 */
export function formatSkillFound(skillPath: string): string {
  return `   Found: ${skillPath}`;
}

/**
 * Format package valid message
 *
 * @returns Formatted valid message
 */
export function formatPackageValid(): string {
  return '   Package valid';
}

/**
 * Format invalid package error
 *
 * @param packagePath - Path to the invalid package
 * @param errors - List of validation errors
 * @returns Formatted invalid package error
 */
export function formatInvalidPackageError(packagePath: string, errors: string[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(error(`Invalid package '${packagePath}'`));
  for (const err of errors) {
    lines.push(`   - ${err}`);
  }
  lines.push('');
  lines.push(error('Update failed (no changes made)'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format backup creation message
 *
 * @param backupPath - Path where backup was saved
 * @returns Formatted backup message
 */
export function formatBackupCreated(backupPath: string): string {
  const lines: string[] = [];
  lines.push('Creating backup...');
  lines.push(`   Backup saved to: ${backupPath}`);
  return lines.join('\n');
}

/**
 * Format no-backup warning
 *
 * @returns Formatted warning about no backup
 */
export function formatNoBackupWarning(): string {
  return warning(
    'Warning: Proceeding without backup. If the update fails, the previous version cannot be automatically restored.'
  );
}
