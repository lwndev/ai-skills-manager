/**
 * Tests for update formatter
 */

import {
  formatUpdateProgress,
  formatCurrentVersion,
  formatNewVersion,
  formatFileChangeLine,
  formatChangeSummary,
  formatBackupInfo,
  formatConfirmationPrompt,
  formatDowngradeWarning,
  formatUpdateSuccess,
  formatRollbackSuccess,
  formatRollbackFailed,
  formatDryRun,
  formatQuietOutput,
  formatError,
  formatHardLinkWarning,
  formatLockConflict,
  formatProgressBar,
  formatProgressSpinner,
  shouldShowProgress,
  formatCancellation,
  formatChangeSummaryStats,
  formatUpdateOutput,
  formatSkillFound,
  formatPackageValid,
  formatInvalidPackageError,
  formatBackupCreated,
  formatNoBackupWarning,
} from '../../../src/formatters/update-formatter';
import type {
  UpdateSuccess,
  UpdateDryRunPreview,
  UpdateRolledBack,
  UpdateRollbackFailed,
  UpdateError,
  VersionInfo,
  VersionComparison,
  FileChange,
  BackupInfo,
  DowngradeInfo,
  ChangeSummary,
  HardLinkInfo,
  UpdateLockFile,
} from '../../../src/types/update';

describe('Update Formatter', () => {
  describe('formatUpdateProgress', () => {
    it('formats locating stage', () => {
      const output = formatUpdateProgress('locating');
      expect(output).toContain('Locating installed skill');
    });

    it('formats validating-package stage', () => {
      const output = formatUpdateProgress('validating-package');
      expect(output).toContain('Validating new package');
    });

    it('formats comparing stage', () => {
      const output = formatUpdateProgress('comparing');
      expect(output).toContain('Comparing versions');
    });

    it('formats creating-backup stage with detail', () => {
      const output = formatUpdateProgress('creating-backup', 'SKILL.md');
      expect(output).toContain('Creating backup: SKILL.md');
    });

    it('formats creating-backup stage without detail', () => {
      const output = formatUpdateProgress('creating-backup');
      expect(output).toContain('Creating backup...');
    });

    it('formats removing-old stage', () => {
      const output = formatUpdateProgress('removing-old');
      expect(output).toContain('Removing old version');
    });

    it('formats extracting-new stage', () => {
      const output = formatUpdateProgress('extracting-new');
      expect(output).toContain('Extracting new version');
    });

    it('formats validating-updated stage', () => {
      const output = formatUpdateProgress('validating-updated');
      expect(output).toContain('Validating updated skill');
    });

    it('formats cleaning-up stage', () => {
      const output = formatUpdateProgress('cleaning-up');
      expect(output).toContain('Cleaning up');
    });

    it('formats complete stage', () => {
      const output = formatUpdateProgress('complete');
      expect(output).toContain('Update complete');
    });

    it('formats unknown stage with default message', () => {
      // Test the default case for unknown stage types
      const output = formatUpdateProgress('unknown-stage' as 'locating');
      expect(output).toContain('Processing');
    });
  });

  describe('formatCurrentVersion', () => {
    it('formats current version with all fields', () => {
      const versionInfo: VersionInfo = {
        path: '.claude/skills/my-skill',
        fileCount: 5,
        size: 8200,
        lastModified: '2025-01-10 14:30:00',
        description: 'A useful skill',
      };

      const output = formatCurrentVersion(versionInfo);

      expect(output).toContain('Current version:');
      expect(output).toContain('Location: .claude/skills/my-skill');
      expect(output).toContain('Files: 5 (8.0 KB)');
      expect(output).toContain('Modified: 2025-01-10 14:30:00');
      expect(output).toContain('Description: A useful skill');
    });

    it('formats current version without optional fields', () => {
      const versionInfo: VersionInfo = {
        path: '.claude/skills/my-skill',
        fileCount: 3,
        size: 1024,
      };

      const output = formatCurrentVersion(versionInfo);

      expect(output).toContain('Current version:');
      expect(output).toContain('Location: .claude/skills/my-skill');
      expect(output).toContain('Files: 3 (1.0 KB)');
      expect(output).not.toContain('Modified:');
      expect(output).not.toContain('Description:');
    });
  });

  describe('formatNewVersion', () => {
    it('formats new version with all fields', () => {
      const versionInfo: VersionInfo = {
        path: './my-skill-v2.skill',
        fileCount: 6,
        size: 9400,
        description: 'Updated skill',
      };

      const output = formatNewVersion(versionInfo);

      expect(output).toContain('New version:');
      expect(output).toContain('Package: ./my-skill-v2.skill');
      expect(output).toContain('Files: 6 (9.2 KB)');
      expect(output).toContain('Description: Updated skill');
    });

    it('formats new version without description', () => {
      const versionInfo: VersionInfo = {
        path: './my-skill.skill',
        fileCount: 4,
        size: 5000,
      };

      const output = formatNewVersion(versionInfo);

      expect(output).toContain('New version:');
      expect(output).toContain('Package: ./my-skill.skill');
      expect(output).not.toContain('Description:');
    });
  });

  describe('formatFileChangeLine', () => {
    it('formats added file', () => {
      const change: FileChange = {
        path: 'templates/advanced.md',
        changeType: 'added',
        sizeBefore: 0,
        sizeAfter: 1400,
        sizeDelta: 1400,
      };

      const output = formatFileChangeLine(change);

      expect(output).toContain('+ templates/advanced.md');
      expect(output).toContain('added');
      expect(output).toContain('1.4 KB');
    });

    it('formats removed file', () => {
      const change: FileChange = {
        path: 'old-template.md',
        changeType: 'removed',
        sizeBefore: 800,
        sizeAfter: 0,
        sizeDelta: -800,
      };

      const output = formatFileChangeLine(change);

      expect(output).toContain('- old-template.md');
      expect(output).toContain('removed');
    });

    it('formats modified file with size increase', () => {
      const change: FileChange = {
        path: 'SKILL.md',
        changeType: 'modified',
        sizeBefore: 2000,
        sizeAfter: 2050,
        sizeDelta: 50,
      };

      const output = formatFileChangeLine(change);

      expect(output).toContain('~ SKILL.md');
      expect(output).toContain('modified');
      expect(output).toContain('+50 B');
    });

    it('formats modified file with size decrease', () => {
      const change: FileChange = {
        path: 'scripts/helper.py',
        changeType: 'modified',
        sizeBefore: 1000,
        sizeAfter: 800,
        sizeDelta: -200,
      };

      const output = formatFileChangeLine(change);

      expect(output).toContain('~ scripts/helper.py');
      expect(output).toContain('modified');
      expect(output).toContain('-200 B');
    });

    it('formats unknown change type gracefully', () => {
      // Test the default case for unknown change types
      const change = {
        path: 'unknown-file.txt',
        changeType: 'unknown' as 'added', // Cast to bypass type check
        sizeBefore: 0,
        sizeAfter: 0,
        sizeDelta: 0,
      };

      const output = formatFileChangeLine(change);

      expect(output).toContain('?');
      expect(output).toContain('unknown-file.txt');
    });
  });

  describe('formatChangeSummary', () => {
    it('formats comparison with all change types', () => {
      const comparison: VersionComparison = {
        filesAdded: [
          {
            path: 'new-file.md',
            changeType: 'added',
            sizeBefore: 0,
            sizeAfter: 1000,
            sizeDelta: 1000,
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
          {
            path: 'old-file.md',
            changeType: 'removed',
            sizeBefore: 500,
            sizeAfter: 0,
            sizeDelta: -500,
          },
        ],
        addedCount: 1,
        removedCount: 1,
        modifiedCount: 1,
        sizeChange: 600,
      };

      const output = formatChangeSummary(comparison);

      expect(output).toContain('Changes:');
      expect(output).toContain('+ new-file.md');
      expect(output).toContain('~ SKILL.md');
      expect(output).toContain('- old-file.md');
    });

    it('formats empty comparison', () => {
      const comparison: VersionComparison = {
        filesAdded: [],
        filesModified: [],
        filesRemoved: [],
        addedCount: 0,
        removedCount: 0,
        modifiedCount: 0,
        sizeChange: 0,
      };

      const output = formatChangeSummary(comparison);

      expect(output).toContain('Changes:');
      expect(output).toContain('No file changes detected');
    });

    it('truncates long file lists', () => {
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

      const output = formatChangeSummary(comparison, 10);

      expect(output).toContain('file0.md');
      expect(output).toContain('file9.md');
      expect(output).toContain('... and 5 more added files');
    });

    it('truncates modified files list when exceeding maxFiles', () => {
      const comparison: VersionComparison = {
        filesAdded: [],
        filesModified: Array.from({ length: 15 }, (_, i) => ({
          path: `modified${i}.md`,
          changeType: 'modified' as const,
          sizeBefore: 100,
          sizeAfter: 200,
          sizeDelta: 100,
        })),
        filesRemoved: [],
        addedCount: 0,
        removedCount: 0,
        modifiedCount: 15,
        sizeChange: 1500,
      };

      const output = formatChangeSummary(comparison, 10);

      expect(output).toContain('modified0.md');
      expect(output).toContain('modified9.md');
      expect(output).toContain('... and 5 more modified files');
    });

    it('truncates removed files list when exceeding maxFiles', () => {
      const comparison: VersionComparison = {
        filesAdded: [],
        filesModified: [],
        filesRemoved: Array.from({ length: 12 }, (_, i) => ({
          path: `removed${i}.md`,
          changeType: 'removed' as const,
          sizeBefore: 100,
          sizeAfter: 0,
          sizeDelta: -100,
        })),
        addedCount: 0,
        removedCount: 12,
        modifiedCount: 0,
        sizeChange: -1200,
      };

      const output = formatChangeSummary(comparison, 10);

      expect(output).toContain('removed0.md');
      expect(output).toContain('removed9.md');
      expect(output).toContain('... and 2 more removed files');
    });
  });

  describe('formatBackupInfo', () => {
    it('formats backup info that will be removed', () => {
      const backupInfo: BackupInfo = {
        path: '~/.asm/backups/my-skill-20250115-143000.skill',
        timestamp: '2025-01-15T14:30:00.000Z',
        size: 8000,
        fileCount: 5,
      };

      const output = formatBackupInfo(backupInfo, true);

      expect(output).toContain('Backup location: ~/.asm/backups/my-skill-20250115-143000.skill');
      expect(output).not.toContain('will be kept');
    });

    it('formats backup info that will be kept', () => {
      const backupInfo: BackupInfo = {
        path: '~/.asm/backups/my-skill-20250115-143000.skill',
        timestamp: '2025-01-15T14:30:00.000Z',
        size: 8000,
        fileCount: 5,
      };

      const output = formatBackupInfo(backupInfo, false);

      expect(output).toContain('Backup location: ~/.asm/backups/my-skill-20250115-143000.skill');
      expect(output).toContain('backup will be kept');
    });
  });

  describe('formatConfirmationPrompt', () => {
    it('formats full confirmation prompt', () => {
      const currentVersion: VersionInfo = {
        path: '.claude/skills/my-skill',
        fileCount: 4,
        size: 7800,
        lastModified: '2025-01-10 14:30:00',
      };

      const newVersion: VersionInfo = {
        path: './my-skill-v2.skill',
        fileCount: 5,
        size: 9200,
      };

      const comparison: VersionComparison = {
        filesAdded: [
          { path: 'new.md', changeType: 'added', sizeBefore: 0, sizeAfter: 1400, sizeDelta: 1400 },
        ],
        filesModified: [],
        filesRemoved: [],
        addedCount: 1,
        removedCount: 0,
        modifiedCount: 0,
        sizeChange: 1400,
      };

      const output = formatConfirmationPrompt(
        'my-skill',
        currentVersion,
        newVersion,
        comparison,
        '~/.asm/backups/my-skill-20250115.skill'
      );

      expect(output).toContain('Updating skill: my-skill');
      expect(output).toContain('Current version:');
      expect(output).toContain('New version:');
      expect(output).toContain('Changes:');
      expect(output).toContain('Backup location:');
      expect(output).toContain('This will replace the installed skill');
    });
  });

  describe('formatDowngradeWarning', () => {
    it('formats downgrade warning with dates', () => {
      const downgradeInfo: DowngradeInfo = {
        isDowngrade: true,
        installedDate: '2025-01-15',
        newDate: '2025-01-10',
        message: 'New package is older than installed version',
      };

      const output = formatDowngradeWarning(downgradeInfo);

      expect(output).toContain('This appears to be a downgrade');
      expect(output).toContain('Current version date: 2025-01-15');
      expect(output).toContain('New package date: 2025-01-10');
    });

    it('formats downgrade warning without dates', () => {
      const downgradeInfo: DowngradeInfo = {
        isDowngrade: true,
        message: 'Package appears older',
      };

      const output = formatDowngradeWarning(downgradeInfo);

      expect(output).toContain('This appears to be a downgrade');
      expect(output).not.toContain('Current version date:');
    });
  });

  describe('formatUpdateSuccess', () => {
    it('formats successful update with backup', () => {
      const result: UpdateSuccess = {
        type: 'update-success',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        previousFileCount: 4,
        currentFileCount: 5,
        previousSize: 7800,
        currentSize: 9200,
        backupPath: '~/.asm/backups/my-skill-20250115.skill',
        backupWillBeRemoved: true,
      };

      const output = formatUpdateSuccess(result);

      expect(output).toContain('Successfully updated skill: my-skill');
      expect(output).toContain('Previous: 4 files, 7.6 KB');
      expect(output).toContain('Current: 5 files, 9.0 KB');
      expect(output).toContain('Backup: ~/.asm/backups/my-skill-20250115.skill (will be removed)');
      expect(output).toContain('To restore the previous version');
      expect(output).toContain('asm install');
    });

    it('formats successful update with backup kept', () => {
      const result: UpdateSuccess = {
        type: 'update-success',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        previousFileCount: 4,
        currentFileCount: 5,
        previousSize: 7800,
        currentSize: 9200,
        backupPath: '~/.asm/backups/my-skill-20250115.skill',
        backupWillBeRemoved: false,
      };

      const output = formatUpdateSuccess(result);

      expect(output).toContain('Backup: ~/.asm/backups/my-skill-20250115.skill (kept)');
    });

    it('formats successful update without backup', () => {
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

      expect(output).toContain('Successfully updated skill: my-skill');
      expect(output).toContain('no backup available');
    });

    it('includes correct scope in restore command', () => {
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

      expect(output).toContain('--scope personal');
    });
  });

  describe('formatRollbackSuccess', () => {
    it('formats successful rollback', () => {
      const result: UpdateRolledBack = {
        type: 'update-rolled-back',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        failureReason: 'SKILL.md: Invalid format at line 15',
        backupPath: '~/.asm/backups/my-skill-20250115.skill',
      };

      const output = formatRollbackSuccess(result);

      expect(output).toContain('Post-update validation failed');
      expect(output).toContain('Invalid format at line 15');
      expect(output).toContain('Rolling back');
      expect(output).toContain('Removing failed installation');
      expect(output).toContain('Restoring previous version');
      expect(output).toContain('Rollback successful: my-skill restored');
      expect(output).toContain('Backup kept at: ~/.asm/backups/my-skill-20250115.skill');
      expect(output).toContain('exit code 6');
    });

    it('formats rollback without backup path', () => {
      const result: UpdateRolledBack = {
        type: 'update-rolled-back',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        failureReason: 'Validation failed',
      };

      const output = formatRollbackSuccess(result);

      expect(output).toContain('Rollback successful');
      expect(output).not.toContain('Backup kept at');
    });
  });

  describe('formatRollbackFailed', () => {
    it('formats critical rollback failure', () => {
      const result: UpdateRollbackFailed = {
        type: 'update-rollback-failed',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        updateFailureReason: 'Extraction failed',
        rollbackFailureReason: 'Backup file corrupted',
        backupPath: '~/.asm/backups/my-skill-20250115.skill',
        recoveryInstructions: 'Manually restore from backup or reinstall skill',
      };

      const output = formatRollbackFailed(result);

      expect(output).toContain('CRITICAL: Rollback failed');
      expect(output).toContain('manual intervention required');
      expect(output).toContain('Update failed');
      expect(output).toContain('Extraction failed');
      expect(output).toContain('Rollback failed');
      expect(output).toContain('Backup file corrupted');
      expect(output).toContain('Name: my-skill');
      expect(output).toContain('Path: .claude/skills/my-skill');
      expect(output).toContain('Backup: ~/.asm/backups/my-skill-20250115.skill');
      expect(output).toContain('Recovery instructions');
      expect(output).toContain('Manually restore from backup');
      expect(output).toContain('exit code 7');
    });
  });

  describe('formatDryRun', () => {
    it('formats dry-run preview', () => {
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

      expect(output).toContain('Dry run: my-skill');
      expect(output).toContain('Update preview');
      expect(output).toContain('Skill: my-skill');
      expect(output).toContain('Location: .claude/skills/my-skill');
      expect(output).toContain('Current version:');
      expect(output).toContain('Files: 4 (7.6 KB)');
      expect(output).toContain('Modified: 2025-01-10 14:30:00');
      expect(output).toContain('New version:');
      expect(output).toContain('Package: ./my-skill-v2.skill');
      expect(output).toContain('Files: 5 (9.0 KB)');
      expect(output).toContain('Changes that would be made');
      expect(output).toContain('+ templates/advanced.md');
      expect(output).toContain('~ SKILL.md');
      expect(output).toContain('- old-template.md');
      expect(output).toContain('Backup would be created at');
      expect(output).toContain('No changes made (dry run mode)');
    });

    it('formats dry-run with no changes', () => {
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

      expect(output).toContain('No file changes detected');
    });

    it('truncates long file lists in dry-run output', () => {
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
          path: './my-skill-v2.skill',
          fileCount: 20,
          size: 20000,
        },
        comparison: {
          filesAdded: Array.from({ length: 15 }, (_, i) => ({
            path: `new-file${i}.md`,
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
        },
        backupPath: '~/.asm/backups/my-skill.skill',
      };

      const output = formatDryRun(preview);

      expect(output).toContain('new-file0.md');
      expect(output).toContain('new-file9.md');
      expect(output).toContain('... and 5 more added files');
    });
  });

  describe('formatQuietOutput', () => {
    it('formats quiet success output', () => {
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

      expect(output).toBe('my-skill updated (4 -> 5 files, 7.6 KB -> 9.0 KB)');
    });
  });

  describe('formatError', () => {
    it('formats skill not found error', () => {
      const err: UpdateError = {
        type: 'skill-not-found',
        skillName: 'missing-skill',
        searchedPath: '.claude/skills',
      };

      const output = formatError(err);

      expect(output).toContain("Skill 'missing-skill' not found in .claude/skills");
      expect(output).toContain('Suggestions');
      expect(output).toContain('Check the skill name spelling');
      expect(output).toContain('ls .claude/skills');
      expect(output).toContain('Try a different scope');
      expect(output).toContain('Update failed');
    });

    it('formats security error with path traversal', () => {
      const err: UpdateError = {
        type: 'security-error',
        reason: 'path-traversal',
        details: 'Attempted to access ../../../etc/passwd',
      };

      const output = formatError(err);

      expect(output).toContain('Security Error: Path traversal detected');
      expect(output).toContain('../../../etc/passwd');
      expect(output).toContain('exit code 5');
    });

    it('formats security error with symlink escape', () => {
      const err: UpdateError = {
        type: 'security-error',
        reason: 'symlink-escape',
        details: 'Symlink points to /etc/passwd',
      };

      const output = formatError(err);

      expect(output).toContain('Symlink points outside allowed scope');
      expect(output).toContain('malicious skill or misconfiguration');
    });

    it('formats security error with case mismatch', () => {
      const err: UpdateError = {
        type: 'security-error',
        reason: 'case-mismatch',
        details: 'Input: my-skill, Actual: MY-SKILL',
      };

      const output = formatError(err);

      expect(output).toContain('Skill name case mismatch');
      expect(output).toContain('symlink substitution attack');
    });

    it('formats security error with zip bomb', () => {
      const err: UpdateError = {
        type: 'security-error',
        reason: 'zip-bomb',
        details: 'Compression ratio exceeds 100:1',
      };

      const output = formatError(err);

      expect(output).toContain('ZIP bomb detected');
      expect(output).toContain('high compression ratio');
    });

    it('formats filesystem error', () => {
      const err: UpdateError = {
        type: 'filesystem-error',
        operation: 'write',
        path: '/path/to/file',
        message: 'Permission denied',
      };

      const output = formatError(err);

      expect(output).toContain('File system error during write');
      expect(output).toContain('Permission denied');
      expect(output).toContain('Path: /path/to/file');
    });

    it('formats validation error with details', () => {
      const err: UpdateError = {
        type: 'validation-error',
        field: 'packageContent',
        message: 'Invalid package structure',
        details: ['Missing SKILL.md', 'No files found'],
      };

      const output = formatError(err);

      expect(output).toContain('Invalid package structure');
      expect(output).toContain('Missing SKILL.md');
      expect(output).toContain('No files found');
    });

    it('formats package mismatch error', () => {
      const err: UpdateError = {
        type: 'package-mismatch',
        installedSkillName: 'my-skill',
        packageSkillName: 'other-skill',
        message: 'Package skill name does not match',
      };

      const output = formatError(err);

      expect(output).toContain('Package skill name does not match installed skill');
      expect(output).toContain('Installed skill: my-skill');
      expect(output).toContain('Package skill: other-skill');
      expect(output).toContain('install as a new skill');
    });

    it('formats backup creation error', () => {
      const err: UpdateError = {
        type: 'backup-creation-error',
        backupPath: '~/.asm/backups/my-skill.skill',
        reason: 'Disk full',
      };

      const output = formatError(err);

      expect(output).toContain('Failed to create backup');
      expect(output).toContain('Path: ~/.asm/backups/my-skill.skill');
      expect(output).toContain('Reason: Disk full');
      expect(output).toContain('Check disk space');
      expect(output).toContain('--no-backup');
    });

    it('formats timeout error', () => {
      const err: UpdateError = {
        type: 'timeout',
        operationName: 'backup',
        timeoutMs: 120000,
      };

      const output = formatError(err);

      expect(output).toContain('Operation timed out: backup');
      expect(output).toContain('Timeout: 120000ms');
      expect(output).toContain('skill or package may be too large');
    });

    it('formats rollback error', () => {
      const err: UpdateError = {
        type: 'rollback-error',
        skillName: 'my-skill',
        updateFailureReason: 'Extraction failed',
        rollbackSucceeded: true,
        backupPath: '~/.asm/backups/my-skill.skill',
      };

      const output = formatError(err);

      expect(output).toContain('rollback succeeded');
      expect(output).toContain('my-skill');
      expect(output).toContain('Extraction failed');
      expect(output).toContain('Backup kept at');
      expect(output).toContain('exit code 6');
    });

    it('formats critical error', () => {
      const err: UpdateError = {
        type: 'critical-error',
        skillName: 'my-skill',
        skillPath: '.claude/skills/my-skill',
        updateFailureReason: 'Extraction failed',
        rollbackFailureReason: 'Backup corrupted',
        backupPath: '~/.asm/backups/my-skill.skill',
        recoveryInstructions: 'Manually restore from backup',
      };

      const output = formatError(err);

      expect(output).toContain('CRITICAL');
      expect(output).toContain('Update and rollback both failed');
      expect(output).toContain('Extraction failed');
      expect(output).toContain('Backup corrupted');
      expect(output).toContain('Skill path: .claude/skills/my-skill');
      expect(output).toContain('Recovery');
      expect(output).toContain('exit code 7');
    });

    it('formats unknown error type gracefully', () => {
      // Test the default case for unknown error types
      const err = {
        type: 'unknown-error-type',
      } as unknown as UpdateError;

      const output = formatError(err);

      expect(output).toContain('Unknown error occurred');
    });
  });

  describe('formatHardLinkWarning', () => {
    it('formats hard link warning with file list', () => {
      const files: HardLinkInfo[] = [
        { path: 'shared-utils/common.js', linkCount: 2 },
        { path: 'shared-utils/helpers.js', linkCount: 3 },
      ];

      const output = formatHardLinkWarning('my-skill', files);

      expect(output).toContain('Updating skill: my-skill');
      expect(output).toContain('files with multiple hard links');
      expect(output).toContain('common.js (2 hard links)');
      expect(output).toContain('helpers.js (3 hard links)');
      expect(output).toContain('affect all linked locations');
      expect(output).toContain('--force to proceed');
      expect(output).toContain('Update requires --force');
    });

    it('truncates long list of hard-linked files', () => {
      const files: HardLinkInfo[] = Array.from({ length: 15 }, (_, i) => ({
        path: `file${i}.js`,
        linkCount: 2,
      }));

      const output = formatHardLinkWarning('my-skill', files);

      expect(output).toContain('file0.js');
      expect(output).toContain('file9.js');
      expect(output).toContain('... and 5 more files');
    });
  });

  describe('formatLockConflict', () => {
    it('formats lock conflict error', () => {
      const lockInfo: UpdateLockFile = {
        pid: 12345,
        timestamp: '2025-01-15T14:30:00.000Z',
        operationType: 'update',
        packagePath: './new-version.skill',
      };

      const output = formatLockConflict(lockInfo);

      expect(output).toContain('Update already in progress');
      expect(output).toContain('Process ID: 12345');
      expect(output).toContain('Started: 2025-01-15T14:30:00.000Z');
      expect(output).toContain('Package: ./new-version.skill');
      expect(output).toContain('remove the lock file');
      expect(output).toContain('.asm-update.lock');
    });
  });

  describe('formatProgressBar', () => {
    it('formats 0% progress', () => {
      const output = formatProgressBar(0, 100, 'Backing up files');

      expect(output).toContain('[');
      expect(output).toContain(']');
      expect(output).toContain('0%');
      expect(output).toContain('Backing up files');
    });

    it('formats 50% progress', () => {
      const output = formatProgressBar(50, 100, 'Extracting');

      expect(output).toContain('50%');
      expect(output).toContain('Extracting');
      // Should have 10 filled and 10 empty (20 total)
      expect(output).toMatch(/\[.{20}\]/);
    });

    it('formats 100% progress', () => {
      const output = formatProgressBar(100, 100, 'Complete');

      expect(output).toContain('100%');
      expect(output).toContain('Complete');
    });

    it('handles edge case of 0 total', () => {
      const output = formatProgressBar(0, 0, 'Empty');

      expect(output).toContain('0%');
    });

    it('caps at 100%', () => {
      const output = formatProgressBar(150, 100, 'Over');

      expect(output).toContain('100%');
    });
  });

  describe('formatProgressSpinner', () => {
    it('formats spinner with stage description', () => {
      const output = formatProgressSpinner('Validating package', 0);

      expect(output).toContain('Validating package');
      // Should contain a spinner character
      expect(output).toMatch(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    });

    it('cycles through spinner frames', () => {
      const frame0 = formatProgressSpinner('Loading', 0);
      const frame1 = formatProgressSpinner('Loading', 1);
      const frame5 = formatProgressSpinner('Loading', 5);

      // Different frames should produce different output
      expect(frame0).not.toBe(frame1);
      expect(frame0).not.toBe(frame5);
    });
  });

  describe('shouldShowProgress', () => {
    it('returns false before threshold', () => {
      const startTime = Date.now();
      const result = shouldShowProgress(startTime, 2000);

      expect(result).toBe(false);
    });

    it('returns true after threshold', () => {
      const startTime = Date.now() - 3000; // 3 seconds ago
      const result = shouldShowProgress(startTime, 2000);

      expect(result).toBe(true);
    });

    it('uses default 2 second threshold', () => {
      const startTime = Date.now() - 2500; // 2.5 seconds ago
      const result = shouldShowProgress(startTime);

      expect(result).toBe(true);
    });
  });

  describe('formatCancellation', () => {
    it('formats cancellation message', () => {
      const output = formatCancellation();

      expect(output).toContain('Cancelled');
      expect(output).toContain('No changes made');
    });
  });

  describe('formatChangeSummaryStats', () => {
    it('formats summary with all change types', () => {
      const summary: ChangeSummary = {
        addedCount: 3,
        removedCount: 1,
        modifiedCount: 2,
        bytesAdded: 5000,
        bytesRemoved: 1000,
        netSizeChange: 4000,
      };

      const output = formatChangeSummaryStats(summary);

      expect(output).toContain('Summary:');
      expect(output).toContain('+ 3 files added');
      expect(output).toContain('~ 2 files modified');
      expect(output).toContain('- 1 file removed');
      expect(output).toContain('Net size change: +3.9 KB');
    });

    it('formats summary with size decrease', () => {
      const summary: ChangeSummary = {
        addedCount: 0,
        removedCount: 2,
        modifiedCount: 0,
        bytesAdded: 0,
        bytesRemoved: 3000,
        netSizeChange: -3000,
      };

      const output = formatChangeSummaryStats(summary);

      expect(output).toContain('- 2 files removed');
      expect(output).toContain('Net size change: -2.9 KB');
    });

    it('handles singular file counts', () => {
      const summary: ChangeSummary = {
        addedCount: 1,
        removedCount: 0,
        modifiedCount: 1,
        bytesAdded: 100,
        bytesRemoved: 0,
        netSizeChange: 100,
      };

      const output = formatChangeSummaryStats(summary);

      expect(output).toContain('+ 1 file added');
      expect(output).toContain('~ 1 file modified');
    });
  });

  describe('formatUpdateOutput', () => {
    it('formats success result normally', () => {
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

      const output = formatUpdateOutput(result);

      expect(output).toContain('Successfully updated skill');
    });

    it('formats success result in quiet mode', () => {
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

      const output = formatUpdateOutput(result, { quiet: true });

      expect(output).toBe('my-skill updated (4 -> 5 files, 7.6 KB -> 9.0 KB)');
    });

    it('formats dry-run preview', () => {
      const preview: UpdateDryRunPreview = {
        type: 'update-dry-run-preview',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        currentVersion: { path: '.claude/skills/my-skill', fileCount: 4, size: 7800 },
        newVersion: { path: './new.skill', fileCount: 5, size: 9200 },
        comparison: {
          filesAdded: [],
          filesModified: [],
          filesRemoved: [],
          addedCount: 0,
          removedCount: 0,
          modifiedCount: 0,
          sizeChange: 0,
        },
        backupPath: '~/.asm/backups/test.skill',
      };

      const output = formatUpdateOutput(preview);

      expect(output).toContain('Dry run:');
      expect(output).toContain('No changes made');
    });

    it('formats rolled-back result', () => {
      const result: UpdateRolledBack = {
        type: 'update-rolled-back',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        failureReason: 'Validation failed',
      };

      const output = formatUpdateOutput(result);

      expect(output).toContain('Rollback successful');
    });

    it('formats rollback-failed result', () => {
      const result: UpdateRollbackFailed = {
        type: 'update-rollback-failed',
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        updateFailureReason: 'Update error',
        rollbackFailureReason: 'Rollback error',
        recoveryInstructions: 'Manual recovery needed',
      };

      const output = formatUpdateOutput(result);

      expect(output).toContain('CRITICAL');
    });
  });

  describe('formatSkillFound', () => {
    it('formats skill found message', () => {
      const output = formatSkillFound('.claude/skills/my-skill');

      expect(output).toContain('Found: .claude/skills/my-skill');
    });
  });

  describe('formatPackageValid', () => {
    it('formats package valid message', () => {
      const output = formatPackageValid();

      expect(output).toContain('Package valid');
    });
  });

  describe('formatInvalidPackageError', () => {
    it('formats invalid package error with errors', () => {
      const output = formatInvalidPackageError('./bad.skill', [
        'Missing required file: SKILL.md',
        'Package appears to be corrupted',
      ]);

      expect(output).toContain("Invalid package './bad.skill'");
      expect(output).toContain('Missing required file: SKILL.md');
      expect(output).toContain('Package appears to be corrupted');
      expect(output).toContain('Update failed (no changes made)');
    });
  });

  describe('formatBackupCreated', () => {
    it('formats backup created message', () => {
      const output = formatBackupCreated('~/.asm/backups/my-skill-20250115.skill');

      expect(output).toContain('Creating backup');
      expect(output).toContain('Backup saved to: ~/.asm/backups/my-skill-20250115.skill');
    });
  });

  describe('formatNoBackupWarning', () => {
    it('formats no backup warning', () => {
      const output = formatNoBackupWarning();

      expect(output).toContain('Warning');
      expect(output).toContain('Proceeding without backup');
      expect(output).toContain('cannot be automatically restored');
    });
  });
});
