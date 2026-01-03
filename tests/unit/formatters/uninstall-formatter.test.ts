/**
 * Tests for uninstall formatter
 */

import {
  formatDiscoveryProgress,
  formatSkillFound,
  formatFileList,
  formatConfirmationPrompt,
  formatMultiSkillConfirmation,
  formatRemovalProgress,
  formatRemovalHeader,
  formatSuccess,
  formatMultiSuccess,
  formatError,
  formatSecurityError,
  formatInvalidSkillNameError,
  formatInvalidScopeError,
  formatDryRun,
  formatQuietOutput,
  formatQuietError,
  formatPartialFailure,
  formatCancellation,
  formatHardLinkWarning,
  formatMissingSkillMdWarning,
  formatToctouWarning,
  formatUninstallOutput,
} from '../../../src/formatters/uninstall-formatter';
import type {
  UninstallResult,
  UninstallFailure,
  MultiUninstallResult,
  DryRunPreview,
  SkillInfo,
  FileInfo,
  UninstallError,
} from '../../../src/types/uninstall';
import type { RemovalProgress } from '../../../src/generators/uninstaller';

describe('Uninstall Formatter', () => {
  describe('formatDiscoveryProgress', () => {
    it('formats discovery progress message', () => {
      const output = formatDiscoveryProgress('my-skill', '.claude/skills');

      expect(output).toContain('Uninstalling skill: my-skill');
      expect(output).toContain('Locating skill');
      expect(output).toContain('.claude/skills');
    });
  });

  describe('formatSkillFound', () => {
    it('formats skill found message', () => {
      const output = formatSkillFound('.claude/skills/my-skill');

      expect(output).toContain('Found: .claude/skills/my-skill');
    });
  });

  describe('formatFileList', () => {
    it('formats list of files with sizes', () => {
      const files: FileInfo[] = [
        {
          relativePath: 'SKILL.md',
          absolutePath: '/path/SKILL.md',
          size: 2100,
          isDirectory: false,
          isSymlink: false,
          linkCount: 1,
        },
        {
          relativePath: 'reference.md',
          absolutePath: '/path/reference.md',
          size: 4500,
          isDirectory: false,
          isSymlink: false,
          linkCount: 1,
        },
        {
          relativePath: 'scripts',
          absolutePath: '/path/scripts',
          size: 0,
          isDirectory: true,
          isSymlink: false,
          linkCount: 1,
        },
      ];

      const output = formatFileList(files);

      expect(output).toContain('SKILL.md');
      expect(output).toContain('2.1 KB');
      expect(output).toContain('reference.md');
      expect(output).toContain('4.4 KB');
      // Should not include directories
      expect(output).not.toContain('scripts');
    });

    it('truncates long file lists', () => {
      const files: FileInfo[] = Array.from({ length: 20 }, (_, i) => ({
        relativePath: `file${i}.md`,
        absolutePath: `/path/file${i}.md`,
        size: 100,
        isDirectory: false,
        isSymlink: false,
        linkCount: 1,
      }));

      const output = formatFileList(files);

      expect(output).toContain('file0.md');
      expect(output).toContain('... and 5 more files');
    });

    it('respects custom maxFiles option', () => {
      const files: FileInfo[] = Array.from({ length: 10 }, (_, i) => ({
        relativePath: `file${i}.md`,
        absolutePath: `/path/file${i}.md`,
        size: 100,
        isDirectory: false,
        isSymlink: false,
        linkCount: 1,
      }));

      const output = formatFileList(files, { maxFiles: 3 });

      expect(output).toContain('file0.md');
      expect(output).toContain('file1.md');
      expect(output).toContain('file2.md');
      expect(output).toContain('... and 7 more files');
    });
  });

  describe('formatConfirmationPrompt', () => {
    it('formats single skill confirmation prompt', () => {
      const skillInfo: SkillInfo = {
        name: 'my-skill',
        path: '.claude/skills/my-skill',
        files: [
          {
            relativePath: 'SKILL.md',
            absolutePath: '/path/SKILL.md',
            size: 2100,
            isDirectory: false,
            isSymlink: false,
            linkCount: 1,
          },
          {
            relativePath: 'reference.md',
            absolutePath: '/path/reference.md',
            size: 4500,
            isDirectory: false,
            isSymlink: false,
            linkCount: 1,
          },
        ],
        totalSize: 6600,
        hasSkillMd: true,
        warnings: [],
      };

      const output = formatConfirmationPrompt(skillInfo);

      expect(output).toContain('Files to be removed');
      expect(output).toContain('SKILL.md');
      expect(output).toContain('reference.md');
      expect(output).toContain('Total: 2 files');
      expect(output).toContain('This action cannot be undone');
    });

    it('includes warnings in prompt', () => {
      const skillInfo: SkillInfo = {
        name: 'my-skill',
        path: '.claude/skills/my-skill',
        files: [],
        totalSize: 0,
        hasSkillMd: true,
        warnings: ['Skill contains .git directory', 'Skill contains node_modules'],
      };

      const output = formatConfirmationPrompt(skillInfo);

      expect(output).toContain('Skill contains .git directory');
      expect(output).toContain('Skill contains node_modules');
    });
  });

  describe('formatMultiSkillConfirmation', () => {
    it('formats multi-skill confirmation prompt', () => {
      const skills: SkillInfo[] = [
        {
          name: 'skill-one',
          path: '.claude/skills/skill-one',
          files: [
            {
              relativePath: 'SKILL.md',
              absolutePath: '/path/SKILL.md',
              size: 1000,
              isDirectory: false,
              isSymlink: false,
              linkCount: 1,
            },
          ],
          totalSize: 1000,
          hasSkillMd: true,
          warnings: [],
        },
        {
          name: 'skill-two',
          path: '.claude/skills/skill-two',
          files: [
            {
              relativePath: 'SKILL.md',
              absolutePath: '/path/SKILL.md',
              size: 2000,
              isDirectory: false,
              isSymlink: false,
              linkCount: 1,
            },
            {
              relativePath: 'data.json',
              absolutePath: '/path/data.json',
              size: 500,
              isDirectory: false,
              isSymlink: false,
              linkCount: 1,
            },
          ],
          totalSize: 2500,
          hasSkillMd: true,
          warnings: [],
        },
      ];

      const output = formatMultiSkillConfirmation(skills);

      expect(output).toContain('Skills to be removed');
      expect(output).toContain('1. skill-one (1 files');
      expect(output).toContain('2. skill-two (2 files');
      expect(output).toContain('Total: 3 files');
      expect(output).toContain('This action cannot be undone');
    });
  });

  describe('formatRemovalProgress', () => {
    it('formats successful file removal', () => {
      const progress: RemovalProgress = {
        currentPath: '/path/to/SKILL.md',
        relativePath: 'SKILL.md',
        success: true,
        processedCount: 1,
        totalCount: 5,
      };

      const output = formatRemovalProgress(progress);

      expect(output).toContain('Removed: SKILL.md');
    });

    it('formats skipped file with error', () => {
      const progress: RemovalProgress = {
        currentPath: '/path/to/locked.md',
        relativePath: 'locked.md',
        success: false,
        errorMessage: 'permission denied',
        processedCount: 2,
        totalCount: 5,
      };

      const output = formatRemovalProgress(progress);

      expect(output).toContain('Skipped: locked.md');
      expect(output).toContain('permission denied');
    });
  });

  describe('formatRemovalHeader', () => {
    it('formats removal header', () => {
      const output = formatRemovalHeader('my-skill');

      expect(output).toContain('Removing my-skill');
    });
  });

  describe('formatSuccess', () => {
    it('formats successful uninstall result', () => {
      const result: UninstallResult = {
        success: true,
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        filesRemoved: 4,
        bytesFreed: 7800,
      };

      const output = formatSuccess(result);

      expect(output).toContain('Successfully uninstalled skill: my-skill');
      expect(output).toContain('Removed: 4 files');
      expect(output).toContain('7.6 KB');
      expect(output).toContain('Location was: .claude/skills/my-skill');
    });
  });

  describe('formatMultiSuccess', () => {
    it('formats multi-skill success result', () => {
      const result: MultiUninstallResult = {
        succeeded: [
          {
            success: true,
            skillName: 'skill-one',
            path: '/path/one',
            filesRemoved: 3,
            bytesFreed: 3000,
          },
          {
            success: true,
            skillName: 'skill-two',
            path: '/path/two',
            filesRemoved: 5,
            bytesFreed: 5000,
          },
        ],
        failed: [],
        totalFilesRemoved: 8,
        totalBytesFreed: 8000,
      };

      const output = formatMultiSuccess(result);

      expect(output).toContain('Successfully uninstalled 2 skills');
      expect(output).toContain('Total removed: 8 files');
    });

    it('returns empty string when there are failures', () => {
      const result: MultiUninstallResult = {
        succeeded: [
          {
            success: true,
            skillName: 'skill-one',
            path: '/path/one',
            filesRemoved: 3,
            bytesFreed: 3000,
          },
        ],
        failed: [
          {
            success: false,
            skillName: 'skill-two',
            error: { type: 'skill-not-found', skillName: 'skill-two', searchedPath: '/path' },
          },
        ],
        totalFilesRemoved: 3,
        totalBytesFreed: 3000,
      };

      const output = formatMultiSuccess(result);

      // formatMultiSuccess only shows when all succeed
      expect(output).toBe('');
    });
  });

  describe('formatError', () => {
    it('formats skill not found error', () => {
      const err: UninstallError = {
        type: 'skill-not-found',
        skillName: 'missing-skill',
        searchedPath: '.claude/skills',
      };

      const output = formatError(err, 'missing-skill');

      expect(output).toContain("Skill 'missing-skill' not found");
      expect(output).toContain('Suggestions');
      expect(output).toContain('Check the skill name spelling');
      expect(output).toContain('Try a different scope');
    });

    it('formats validation error', () => {
      const err: UninstallError = {
        type: 'validation-error',
        field: 'skillName',
        message: 'Invalid skill name format',
      };

      const output = formatError(err, 'bad-name');

      expect(output).toContain('Invalid skill name format');
    });

    it('formats filesystem error', () => {
      const err: UninstallError = {
        type: 'filesystem-error',
        operation: 'delete',
        path: '/path/to/file',
        message: 'permission denied',
      };

      const output = formatError(err, 'my-skill');

      expect(output).toContain('File system error during delete');
      expect(output).toContain('permission denied');
      expect(output).toContain('Path: /path/to/file');
    });

    it('formats timeout error', () => {
      const err: UninstallError = {
        type: 'timeout',
        operationName: 'uninstall',
        timeoutMs: 300000,
      };

      const output = formatError(err, 'my-skill');

      expect(output).toContain('Operation timed out after 300000ms');
      expect(output).toContain('too large');
    });

    it('formats partial removal error', () => {
      const err: UninstallError = {
        type: 'partial-removal',
        skillName: 'my-skill',
        filesRemoved: 3,
        filesRemaining: 2,
        lastError: 'permission denied',
      };

      const output = formatError(err, 'my-skill');

      expect(output).toContain('Partial removal of skill: my-skill');
      expect(output).toContain('Removed: 3 files');
      expect(output).toContain('Remaining: 2 files');
      expect(output).toContain('permission denied');
      expect(output).toContain('Manual cleanup may be required');
    });

    it('formats security error', () => {
      const err: UninstallError = {
        type: 'security-error',
        reason: 'symlink-escape',
        details: 'Symlink target: /etc/passwd',
      };

      const output = formatError(err, 'my-skill');

      expect(output).toContain('Security Error');
      expect(output).toContain('symlink pointing outside');
    });
  });

  describe('formatSecurityError', () => {
    it('formats path traversal error', () => {
      const err = {
        type: 'security-error' as const,
        reason: 'path-traversal',
        details: 'Invalid path',
      };

      const output = formatSecurityError(err);

      expect(output).toContain('Invalid skill name');
      expect(output).toContain('only lowercase letters, numbers, and hyphens');
      expect(output).toContain('Not contain path separators');
      expect(output).toContain('exit code 5');
    });

    it('formats symlink escape error', () => {
      const err = {
        type: 'security-error' as const,
        reason: 'symlink-escape',
        details: 'Skill path: .claude/skills/evil\nSymlink target: /etc/passwd',
      };

      const output = formatSecurityError(err);

      expect(output).toContain('symlink pointing outside the allowed scope');
      expect(output).toContain('malicious skill or misconfiguration');
      expect(output).toContain('will NOT be removed');
    });

    it('formats hard link detected error', () => {
      const err = {
        type: 'security-error' as const,
        reason: 'hard-link-detected',
        details: 'File shared.js has 3 hard links',
      };

      const output = formatSecurityError(err);

      expect(output).toContain('files with multiple hard links');
      expect(output).toContain('affect all linked locations');
      expect(output).toContain('--force to proceed');
    });

    it('formats containment violation error', () => {
      const err = {
        type: 'security-error' as const,
        reason: 'containment-violation',
        details: 'Path escapes to /etc',
      };

      const output = formatSecurityError(err);

      expect(output).toContain('File path escapes skill directory');
      expect(output).toContain('will NOT be removed');
    });

    it('formats case mismatch error', () => {
      const err = {
        type: 'security-error' as const,
        reason: 'case-mismatch',
        details: 'Input: my-skill\nActual: MY-SKILL',
      };

      const output = formatSecurityError(err);

      expect(output).toContain('Directory name case mismatch');
      expect(output).toContain('case-insensitive filesystems');
      expect(output).toContain('substitution attack');
    });
  });

  describe('formatInvalidSkillNameError', () => {
    it('formats invalid skill name error with suggestions', () => {
      const output = formatInvalidSkillNameError('../../../etc/passwd');

      expect(output).toContain("Invalid skill name '../../../etc/passwd'");
      expect(output).toContain('only lowercase letters, numbers, and hyphens');
      expect(output).toContain('Not contain path separators');
      expect(output).toContain('Not be longer than 64 characters');
      expect(output).toContain('exit code 5');
    });
  });

  describe('formatInvalidScopeError', () => {
    it('formats invalid scope error with valid options', () => {
      const output = formatInvalidScopeError('/custom/path');

      expect(output).toContain("Invalid scope '/custom/path'");
      expect(output).toContain('Only the following scopes are supported');
      expect(output).toContain('--scope project');
      expect(output).toContain('--scope personal');
    });
  });

  describe('formatDryRun', () => {
    it('formats dry-run preview', () => {
      const preview: DryRunPreview = {
        type: 'dry-run-preview',
        skillName: 'my-skill',
        files: [
          {
            relativePath: 'SKILL.md',
            absolutePath: '/path/SKILL.md',
            size: 2100,
            isDirectory: false,
            isSymlink: false,
            linkCount: 1,
          },
          {
            relativePath: 'reference.md',
            absolutePath: '/path/reference.md',
            size: 4500,
            isDirectory: false,
            isSymlink: false,
            linkCount: 1,
          },
        ],
        totalSize: 6600,
      };

      const output = formatDryRun(preview, '.claude/skills');

      expect(output).toContain('Dry run: my-skill');
      expect(output).toContain('Uninstallation preview');
      expect(output).toContain('Location: .claude/skills/my-skill');
      expect(output).toContain('Status: Skill found');
      expect(output).toContain('Files that would be removed');
      expect(output).toContain('SKILL.md');
      expect(output).toContain('Total: 2 files');
      expect(output).toContain('No changes made (dry run mode)');
    });
  });

  describe('formatQuietOutput', () => {
    it('formats quiet success for project scope', () => {
      const result: UninstallResult = {
        success: true,
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        filesRemoved: 4,
        bytesFreed: 7800,
      };

      const output = formatQuietOutput(result, 'project');

      expect(output).toContain('my-skill uninstalled from .claude/skills/');
      expect(output).toContain('4 files');
      expect(output).toContain('7.6 KB');
    });

    it('formats quiet success for personal scope', () => {
      const result: UninstallResult = {
        success: true,
        skillName: 'my-skill',
        path: '~/.claude/skills/my-skill',
        filesRemoved: 2,
        bytesFreed: 1000,
      };

      const output = formatQuietOutput(result, 'personal');

      expect(output).toContain('my-skill uninstalled from ~/.claude/skills/');
    });
  });

  describe('formatQuietError', () => {
    it('formats quiet error for not found', () => {
      const err: UninstallError = {
        type: 'skill-not-found',
        skillName: 'missing',
        searchedPath: '/path',
      };

      const output = formatQuietError('missing', err);

      expect(output).toContain('missing: not found');
    });

    it('formats quiet error for partial removal', () => {
      const err: UninstallError = {
        type: 'partial-removal',
        skillName: 'my-skill',
        filesRemoved: 3,
        filesRemaining: 2,
        lastError: 'error',
      };

      const output = formatQuietError('my-skill', err);

      expect(output).toContain('partial removal (3/5 files)');
    });
  });

  describe('formatPartialFailure', () => {
    it('formats partial failure with both successes and failures', () => {
      const result: MultiUninstallResult = {
        succeeded: [
          {
            success: true,
            skillName: 'skill-one',
            path: '/path/one',
            filesRemoved: 3,
            bytesFreed: 3000,
          },
        ],
        failed: [
          {
            success: false,
            skillName: 'skill-two',
            error: { type: 'skill-not-found', skillName: 'skill-two', searchedPath: '/path' },
          },
          {
            success: false,
            skillName: 'skill-three',
            error: {
              type: 'filesystem-error',
              operation: 'delete',
              path: '/path',
              message: 'denied',
            },
          },
        ],
        totalFilesRemoved: 3,
        totalBytesFreed: 3000,
      };

      const output = formatPartialFailure(result);

      expect(output).toContain('Uninstalled 1 skill(s)');
      expect(output).toContain('skill-one');
      expect(output).toContain('Failed to uninstall 2 skill(s)');
      expect(output).toContain('skill-two');
      expect(output).toContain('not found');
      expect(output).toContain('skill-three');
      expect(output).toContain('Partial failure');
    });
  });

  describe('formatCancellation', () => {
    it('formats cancellation message', () => {
      const output = formatCancellation();

      expect(output).toContain('Cancelled');
      expect(output).toContain('No changes made');
    });
  });

  describe('formatHardLinkWarning', () => {
    it('formats hard link warning with file list', () => {
      const files = [
        { path: 'shared-utils/common.js', linkCount: 2 },
        { path: 'shared-utils/helpers.js', linkCount: 3 },
      ];

      const output = formatHardLinkWarning('shared-utils', files);

      expect(output).toContain('Uninstalling skill: shared-utils');
      expect(output).toContain('files with multiple hard links');
      expect(output).toContain('common.js (2 hard links)');
      expect(output).toContain('helpers.js (3 hard links)');
      expect(output).toContain('affect all linked locations');
      expect(output).toContain('--force to proceed');
    });

    it('truncates long list of hard-linked files', () => {
      const files = Array.from({ length: 15 }, (_, i) => ({
        path: `file${i}.js`,
        linkCount: 2,
      }));

      const output = formatHardLinkWarning('many-links', files);

      expect(output).toContain('file0.js');
      expect(output).toContain('... and 5 more files');
    });
  });

  describe('formatMissingSkillMdWarning', () => {
    it('formats missing SKILL.md warning', () => {
      const output = formatMissingSkillMdWarning('suspicious-dir');

      expect(output).toContain("'suspicious-dir' does not appear to be a valid skill");
      expect(output).toContain('no SKILL.md');
      expect(output).toContain('--force');
    });
  });

  describe('formatToctouWarning', () => {
    it('formats TOCTOU warning', () => {
      const output = formatToctouWarning(3);

      expect(output).toContain('3 file(s) skipped due to TOCTOU violation');
      expect(output).toContain('race condition attack');
      expect(output).toContain('audit log');
    });
  });

  describe('formatUninstallOutput', () => {
    it('returns quiet output when quiet option is true for success', () => {
      const result: UninstallResult = {
        success: true,
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        filesRemoved: 4,
        bytesFreed: 7800,
      };

      const output = formatUninstallOutput(result, { quiet: true, scope: 'project' });

      expect(output).toContain('my-skill uninstalled from .claude/skills/');
    });

    it('returns full success output when quiet is false', () => {
      const result: UninstallResult = {
        success: true,
        skillName: 'my-skill',
        path: '.claude/skills/my-skill',
        filesRemoved: 4,
        bytesFreed: 7800,
      };

      const output = formatUninstallOutput(result, { quiet: false });

      expect(output).toContain('Successfully uninstalled skill: my-skill');
    });

    it('returns quiet error output when quiet is true for failure', () => {
      const failure: UninstallFailure = {
        success: false,
        skillName: 'missing-skill',
        error: { type: 'skill-not-found', skillName: 'missing-skill', searchedPath: '/path' },
      };

      const output = formatUninstallOutput(failure, { quiet: true });

      expect(output).toContain('missing-skill: not found');
    });

    it('returns full error output when quiet is false for failure', () => {
      const failure: UninstallFailure = {
        success: false,
        skillName: 'missing-skill',
        error: {
          type: 'skill-not-found',
          skillName: 'missing-skill',
          searchedPath: '.claude/skills',
        },
      };

      const output = formatUninstallOutput(failure, { quiet: false });

      expect(output).toContain("Skill 'missing-skill' not found");
      expect(output).toContain('Suggestions');
    });
  });
});
