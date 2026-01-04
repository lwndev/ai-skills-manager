/**
 * Snapshot tests for update formatter output
 *
 * These tests verify that formatter output matches the requirements document exactly.
 * Snapshot updates require explicit approval and must update both snapshots and
 * requirements doc if output format changes.
 *
 * Uses custom serializer to handle ANSI color codes consistently.
 */

import {
  formatUpdateSuccess,
  formatRollbackSuccess,
  formatRollbackFailed,
  formatDryRun,
  formatQuietOutput,
  formatDowngradeWarning,
  formatError,
  formatConfirmationPrompt,
  formatChangeSummary,
  formatHardLinkWarning,
  formatLockConflict,
  formatProgressBar,
  formatBackupCreated,
  formatNoBackupWarning,
  formatInvalidPackageError,
  formatCancelledUpdate,
} from '../../../src/formatters/update-formatter';
import type {
  UpdateSuccess,
  UpdateRolledBack,
  UpdateRollbackFailed,
  UpdateDryRunPreview,
  UpdateCancelled,
  UpdateError,
  VersionInfo,
  VersionComparison,
  DowngradeInfo,
  HardLinkInfo,
  UpdateLockFile,
} from '../../../src/types/update';

// Custom serializer to strip ANSI codes for consistent snapshots
const stripAnsi = (str: string): string => {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
};

// Snapshot serializer configuration
expect.addSnapshotSerializer({
  test: (val) => typeof val === 'string',
  print: (val) => stripAnsi(val as string),
});

describe('Update Formatter Snapshots', () => {
  describe('Success Output (requirements lines 233-270)', () => {
    it('matches expected success output format', () => {
      const result: UpdateSuccess = {
        type: 'update-success',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        previousFileCount: 4,
        currentFileCount: 5,
        previousSize: 7800,
        currentSize: 9200,
        backupPath: '~/.asm/backups/my-skill-20250115-143000-a1b2c3d4.skill',
        backupWillBeRemoved: true,
      };

      const output = formatUpdateSuccess(result);
      expect(output).toMatchSnapshot('success-output');
    });

    it('matches success output with backup kept', () => {
      const result: UpdateSuccess = {
        type: 'update-success',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        previousFileCount: 4,
        currentFileCount: 5,
        previousSize: 7800,
        currentSize: 9200,
        backupPath: '~/.asm/backups/my-skill-20250115-143000-a1b2c3d4.skill',
        backupWillBeRemoved: false,
      };

      const output = formatUpdateSuccess(result);
      expect(output).toMatchSnapshot('success-output-backup-kept');
    });

    it('matches success output without backup', () => {
      const result: UpdateSuccess = {
        type: 'update-success',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        previousFileCount: 4,
        currentFileCount: 5,
        previousSize: 7800,
        currentSize: 9200,
        backupWillBeRemoved: false,
      };

      const output = formatUpdateSuccess(result);
      expect(output).toMatchSnapshot('success-output-no-backup');
    });

    it('matches success output for personal scope', () => {
      const result: UpdateSuccess = {
        type: 'update-success',
        skillName: 'my-skill',
        path: '~/.claude/skills/my-skill',
        previousFileCount: 4,
        currentFileCount: 5,
        previousSize: 7800,
        currentSize: 9200,
        backupPath: '~/.asm/backups/my-skill-20250115.skill',
        backupWillBeRemoved: true,
      };

      const output = formatUpdateSuccess(result, 'personal');
      expect(output).toMatchSnapshot('success-output-personal-scope');
    });
  });

  describe('Error Output (requirements lines 272-302)', () => {
    it('matches skill not found error format', () => {
      const err: UpdateError = {
        type: 'skill-not-found',
        skillName: 'missing-skill',
        searchedPath: '.claude/skills',
      };

      const output = formatError(err);
      expect(output).toMatchSnapshot('error-skill-not-found');
    });

    it('matches security error format - path traversal', () => {
      const err: UpdateError = {
        type: 'security-error',
        reason: 'path-traversal',
        details: 'Attempted to access ../../../etc/passwd',
      };

      const output = formatError(err);
      expect(output).toMatchSnapshot('error-security-path-traversal');
    });

    it('matches security error format - symlink escape', () => {
      const err: UpdateError = {
        type: 'security-error',
        reason: 'symlink-escape',
        details: 'Symlink points to /etc/passwd',
      };

      const output = formatError(err);
      expect(output).toMatchSnapshot('error-security-symlink');
    });

    it('matches security error format - case mismatch', () => {
      const err: UpdateError = {
        type: 'security-error',
        reason: 'case-mismatch',
        details: 'Input: my-skill, Actual: MY-SKILL',
      };

      const output = formatError(err);
      expect(output).toMatchSnapshot('error-security-case-mismatch');
    });

    it('matches security error format - zip bomb', () => {
      const err: UpdateError = {
        type: 'security-error',
        reason: 'zip-bomb',
        details: 'Compression ratio exceeds 100:1',
      };

      const output = formatError(err);
      expect(output).toMatchSnapshot('error-security-zip-bomb');
    });

    it('matches package mismatch error format', () => {
      const err: UpdateError = {
        type: 'package-mismatch',
        installedSkillName: 'my-skill',
        packageSkillName: 'other-skill',
        message: 'Package skill name does not match',
      };

      const output = formatError(err);
      expect(output).toMatchSnapshot('error-package-mismatch');
    });

    it('matches backup creation error format', () => {
      const err: UpdateError = {
        type: 'backup-creation-error',
        backupPath: '~/.asm/backups/my-skill.skill',
        reason: 'Disk full',
      };

      const output = formatError(err);
      expect(output).toMatchSnapshot('error-backup-creation');
    });

    it('matches validation error format', () => {
      const err: UpdateError = {
        type: 'validation-error',
        field: 'packageContent',
        message: 'Invalid package structure',
        details: ['Missing SKILL.md', 'No files found'],
      };

      const output = formatError(err);
      expect(output).toMatchSnapshot('error-validation');
    });

    it('matches filesystem error format', () => {
      const err: UpdateError = {
        type: 'filesystem-error',
        operation: 'write',
        path: '/path/to/file',
        message: 'Permission denied',
      };

      const output = formatError(err);
      expect(output).toMatchSnapshot('error-filesystem');
    });

    it('matches timeout error format', () => {
      const err: UpdateError = {
        type: 'timeout',
        operationName: 'backup',
        timeoutMs: 120000,
      };

      const output = formatError(err);
      expect(output).toMatchSnapshot('error-timeout');
    });
  });

  describe('Rollback Output (requirements lines 304-334)', () => {
    it('matches rollback success format', () => {
      const result: UpdateRolledBack = {
        type: 'update-rolled-back',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        failureReason: 'SKILL.md: Invalid format at line 15',
        backupPath: '~/.asm/backups/my-skill-20250115-143000-a1b2c3d4.skill',
      };

      const output = formatRollbackSuccess(result);
      expect(output).toMatchSnapshot('rollback-success');
    });

    it('matches rollback success format without backup', () => {
      const result: UpdateRolledBack = {
        type: 'update-rolled-back',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        failureReason: 'Validation failed',
      };

      const output = formatRollbackSuccess(result);
      expect(output).toMatchSnapshot('rollback-success-no-backup');
    });

    it('matches rollback failed (critical error) format', () => {
      const result: UpdateRollbackFailed = {
        type: 'update-rollback-failed',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        updateFailureReason: 'Extraction failed midway',
        rollbackFailureReason: 'Backup file corrupted',
        backupPath: '~/.asm/backups/my-skill-20250115-143000-a1b2c3d4.skill',
        recoveryInstructions:
          'Manually restore from backup or reinstall skill using: asm install <package>',
      };

      const output = formatRollbackFailed(result);
      expect(output).toMatchSnapshot('rollback-failed-critical');
    });
  });

  describe('Dry-run Output (requirements lines 336-362)', () => {
    it('matches dry-run preview format with changes', () => {
      const preview: UpdateDryRunPreview = {
        type: 'update-dry-run-preview',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        currentVersion: {
          path: '.claude/skills/my-skill',
          fileCount: 4,
          size: 7800,
          lastModified: '2025-01-10 14:30:00',
        },
        newVersion: {
          path: './my-skill-v2.skill',
          fileCount: 5,
          size: 9200,
        },
        comparison: {
          filesAdded: [
            {
              path: 'templates/advanced.md',
              changeType: 'added',
              sizeBefore: 0,
              sizeAfter: 1400,
              sizeDelta: 1400,
            },
          ],
          filesModified: [
            {
              path: 'SKILL.md',
              changeType: 'modified',
              sizeBefore: 2000,
              sizeAfter: 2050,
              sizeDelta: 50,
            },
          ],
          filesRemoved: [
            {
              path: 'old-template.md',
              changeType: 'removed',
              sizeBefore: 800,
              sizeAfter: 0,
              sizeDelta: -800,
            },
          ],
          addedCount: 1,
          removedCount: 1,
          modifiedCount: 1,
          sizeChange: 650,
        },
        backupPath: '~/.asm/backups/my-skill-20250115.skill',
      };

      const output = formatDryRun(preview);
      expect(output).toMatchSnapshot('dry-run-with-changes');
    });

    it('matches dry-run preview format without changes', () => {
      const preview: UpdateDryRunPreview = {
        type: 'update-dry-run-preview',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        currentVersion: {
          path: '.claude/skills/my-skill',
          fileCount: 4,
          size: 7800,
        },
        newVersion: {
          path: './my-skill.skill',
          fileCount: 4,
          size: 7800,
        },
        comparison: {
          filesAdded: [],
          filesModified: [],
          filesRemoved: [],
          addedCount: 0,
          removedCount: 0,
          modifiedCount: 0,
          sizeChange: 0,
        },
        backupPath: '~/.asm/backups/my-skill.skill',
      };

      const output = formatDryRun(preview);
      expect(output).toMatchSnapshot('dry-run-no-changes');
    });
  });

  describe('Quiet Output (requirements lines 365-367)', () => {
    it('matches quiet mode single-line format', () => {
      const result: UpdateSuccess = {
        type: 'update-success',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        previousFileCount: 4,
        currentFileCount: 5,
        previousSize: 7800,
        currentSize: 9200,
        backupWillBeRemoved: true,
      };

      const output = formatQuietOutput(result);
      expect(output).toMatchSnapshot('quiet-output');
    });
  });

  describe('Downgrade Warning (requirements lines 369-381)', () => {
    it('matches downgrade warning format with dates', () => {
      const downgradeInfo: DowngradeInfo = {
        isDowngrade: true,
        installedDate: '2025-01-15',
        newDate: '2025-01-10',
        message: 'New package is older than installed version',
      };

      const output = formatDowngradeWarning(downgradeInfo);
      expect(output).toMatchSnapshot('downgrade-warning-with-dates');
    });

    it('matches downgrade warning format without dates', () => {
      const downgradeInfo: DowngradeInfo = {
        isDowngrade: true,
        message: 'Package appears older based on metadata',
      };

      const output = formatDowngradeWarning(downgradeInfo);
      expect(output).toMatchSnapshot('downgrade-warning-no-dates');
    });
  });

  describe('Confirmation Prompt', () => {
    it('matches confirmation prompt format', () => {
      const currentVersion: VersionInfo = {
        path: '.claude/skills/my-skill',
        fileCount: 4,
        size: 7800,
        lastModified: '2025-01-10 14:30:00',
        description: 'A useful skill',
      };

      const newVersion: VersionInfo = {
        path: './my-skill-v2.skill',
        fileCount: 5,
        size: 9200,
        description: 'Updated skill with new features',
      };

      const comparison: VersionComparison = {
        filesAdded: [
          { path: 'new.md', changeType: 'added', sizeBefore: 0, sizeAfter: 1400, sizeDelta: 1400 },
        ],
        filesModified: [
          {
            path: 'SKILL.md',
            changeType: 'modified',
            sizeBefore: 2000,
            sizeAfter: 2100,
            sizeDelta: 100,
          },
        ],
        filesRemoved: [],
        addedCount: 1,
        removedCount: 0,
        modifiedCount: 1,
        sizeChange: 1500,
      };

      const output = formatConfirmationPrompt(
        'my-skill',
        currentVersion,
        newVersion,
        comparison,
        '~/.asm/backups/my-skill-20250115.skill'
      );
      expect(output).toMatchSnapshot('confirmation-prompt');
    });
  });

  describe('Change Summary', () => {
    it('matches change summary with all types', () => {
      const comparison: VersionComparison = {
        filesAdded: [
          {
            path: 'new-file.md',
            changeType: 'added',
            sizeBefore: 0,
            sizeAfter: 1000,
            sizeDelta: 1000,
          },
          {
            path: 'another.md',
            changeType: 'added',
            sizeBefore: 0,
            sizeAfter: 500,
            sizeDelta: 500,
          },
        ],
        filesModified: [
          {
            path: 'SKILL.md',
            changeType: 'modified',
            sizeBefore: 2000,
            sizeAfter: 2100,
            sizeDelta: 100,
          },
        ],
        filesRemoved: [
          { path: 'old.md', changeType: 'removed', sizeBefore: 800, sizeAfter: 0, sizeDelta: -800 },
        ],
        addedCount: 2,
        removedCount: 1,
        modifiedCount: 1,
        sizeChange: 800,
      };

      const output = formatChangeSummary(comparison);
      expect(output).toMatchSnapshot('change-summary-all-types');
    });

    it('matches change summary with truncation', () => {
      const comparison: VersionComparison = {
        filesAdded: Array.from({ length: 15 }, (_, i) => ({
          path: `file${i}.md`,
          changeType: 'added' as const,
          sizeBefore: 0,
          sizeAfter: 100,
          sizeDelta: 100,
        })),
        filesModified: [],
        filesRemoved: [],
        addedCount: 15,
        removedCount: 0,
        modifiedCount: 0,
        sizeChange: 1500,
      };

      const output = formatChangeSummary(comparison, 5);
      expect(output).toMatchSnapshot('change-summary-truncated');
    });
  });

  describe('Hard Link Warning', () => {
    it('matches hard link warning format', () => {
      const files: HardLinkInfo[] = [
        { path: 'shared-utils/common.js', linkCount: 2 },
        { path: 'shared-utils/helpers.js', linkCount: 3 },
      ];

      const output = formatHardLinkWarning('my-skill', files);
      expect(output).toMatchSnapshot('hard-link-warning');
    });
  });

  describe('Lock Conflict', () => {
    it('matches lock conflict format', () => {
      const lockInfo: UpdateLockFile = {
        pid: 12345,
        timestamp: '2025-01-15T14:30:00.000Z',
        operationType: 'update',
        packagePath: './new-version.skill',
      };

      const output = formatLockConflict(lockInfo);
      expect(output).toMatchSnapshot('lock-conflict');
    });
  });

  describe('Progress Bar', () => {
    it('matches progress bar at 0%', () => {
      const output = formatProgressBar(0, 100, 'Backing up files...');
      expect(output).toMatchSnapshot('progress-bar-0');
    });

    it('matches progress bar at 50%', () => {
      const output = formatProgressBar(50, 100, 'Extracting...');
      expect(output).toMatchSnapshot('progress-bar-50');
    });

    it('matches progress bar at 100%', () => {
      const output = formatProgressBar(100, 100, 'Complete');
      expect(output).toMatchSnapshot('progress-bar-100');
    });
  });

  describe('Backup Messages', () => {
    it('matches backup created format', () => {
      const output = formatBackupCreated('~/.asm/backups/my-skill-20250115.skill');
      expect(output).toMatchSnapshot('backup-created');
    });

    it('matches no backup warning format', () => {
      const output = formatNoBackupWarning();
      expect(output).toMatchSnapshot('no-backup-warning');
    });
  });

  describe('Invalid Package Error', () => {
    it('matches invalid package error format', () => {
      const output = formatInvalidPackageError('./bad.skill', [
        'Missing required file: SKILL.md',
        'Package appears to be corrupted',
      ]);
      expect(output).toMatchSnapshot('invalid-package-error');
    });
  });

  describe('Cancelled Update', () => {
    it('matches user cancelled format', () => {
      const result: UpdateCancelled = {
        type: 'update-cancelled',
        skillName: 'my-skill',
        reason: 'user-cancelled',
        cleanupPerformed: true,
      };

      const output = formatCancelledUpdate(result);
      expect(output).toMatchSnapshot('cancelled-user');
    });

    it('matches interrupted format', () => {
      const result: UpdateCancelled = {
        type: 'update-cancelled',
        skillName: 'my-skill',
        reason: 'interrupted',
        cleanupPerformed: false,
      };

      const output = formatCancelledUpdate(result);
      expect(output).toMatchSnapshot('cancelled-interrupted');
    });
  });
});
