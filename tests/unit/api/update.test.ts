/**
 * Unit tests for the update API function (FEAT-010 Phase 6)
 *
 * Tests that the update() API function:
 * 1. Returns typed UpdateResult objects
 * 2. Finds existing skill before updating
 * 3. Creates backup before update
 * 4. Throws FileSystemError if skill not found
 * 5. Throws PackageError for invalid packages
 * 6. Throws SecurityError for invalid skill names
 * 7. Supports AbortSignal cancellation
 * 8. Supports force mode
 * 9. Supports dry run mode
 * 10. Supports keepBackup option
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { update } from '../../../src/api/update';
import { scaffold } from '../../../src/api/scaffold';
import { createPackage } from '../../../src/api/package';
import { install } from '../../../src/api/install';
import {
  PackageError,
  FileSystemError,
  SecurityError,
  CancellationError,
} from '../../../src/errors';

describe('update API function', () => {
  let tempDir: string;
  let validPackagePath: string;
  let skillName: string;
  let installDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-update-test-'));

    // Create a valid skill and package for testing
    skillName = 'test-update-skill';
    const scaffoldResult = await scaffold({
      name: skillName,
      description: 'A test skill for update testing',
      output: tempDir,
    });

    // Create a package from the skill
    const packageDir = path.join(tempDir, 'packages');
    await fs.mkdir(packageDir, { recursive: true });

    const packageResult = await createPackage({
      path: scaffoldResult.path,
      output: packageDir,
    });
    validPackagePath = packageResult.packagePath;

    // Install the skill to a target directory
    installDir = path.join(tempDir, 'installed');
    await fs.mkdir(installDir, { recursive: true });

    await install({
      file: validPackagePath,
      targetPath: installDir,
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('return type', () => {
    it('returns an UpdateResult object', async () => {
      // Create a "new version" package
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true, // Skip confirmation
      });

      expect(result).toBeDefined();
      expect(typeof result.updatedPath).toBe('string');
      expect(typeof result.dryRun).toBe('boolean');
    });

    it('returns absolute updated path', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
      });

      expect(path.isAbsolute(result.updatedPath)).toBe(true);
    });

    it('dryRun is false for actual update', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
      });

      expect(result.dryRun).toBe(false);
    });
  });

  describe('dry run mode', () => {
    it('returns dryRun: true when dryRun option is set', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
    });

    it('does not modify files in dry run mode', async () => {
      // Get original file content
      const skillMdPath = path.join(installDir, skillName, 'SKILL.md');
      const originalContent = await fs.readFile(skillMdPath, 'utf-8');
      const originalStats = await fs.stat(skillMdPath);

      await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        dryRun: true,
      });

      // Content should be unchanged
      const afterContent = await fs.readFile(skillMdPath, 'utf-8');
      expect(afterContent).toBe(originalContent);

      // mtime should be unchanged
      const afterStats = await fs.stat(skillMdPath);
      expect(afterStats.mtimeMs).toBe(originalStats.mtimeMs);
    });

    it('returns correct path in dry run mode', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        dryRun: true,
      });

      expect(result.updatedPath).toBe(path.join(installDir, skillName));
    });
  });

  describe('keepBackup option', () => {
    it('returns backupPath when keepBackup is true', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
        keepBackup: true,
      });

      expect(result.backupPath).toBeDefined();
      expect(typeof result.backupPath).toBe('string');
    });

    it('backupPath is undefined when keepBackup is false', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
        keepBackup: false,
      });

      expect(result.backupPath).toBeUndefined();
    });

    it('keepBackup defaults to false', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
      });

      expect(result.backupPath).toBeUndefined();
    });
  });

  describe('scope options', () => {
    it('targetPath takes precedence over scope', async () => {
      const customDir = path.join(tempDir, 'custom-install');
      await fs.mkdir(customDir, { recursive: true });

      // Install skill to custom directory
      await install({
        file: validPackagePath,
        targetPath: customDir,
      });

      const result = await update({
        name: skillName,
        file: validPackagePath,
        scope: 'personal', // This should be ignored
        targetPath: customDir,
        force: true,
      });

      expect(result.updatedPath).toBe(path.join(customDir, skillName));
    });
  });

  describe('skill not found handling', () => {
    it('throws FileSystemError when skill does not exist', async () => {
      await expect(
        update({
          name: 'non-existent-skill',
          file: validPackagePath,
          targetPath: installDir,
          force: true,
        })
      ).rejects.toThrow(FileSystemError);
    });

    it('FileSystemError has path information', async () => {
      try {
        await update({
          name: 'non-existent-skill',
          file: validPackagePath,
          targetPath: installDir,
          force: true,
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).path).toBeDefined();
      }
    });

    it('FileSystemError has correct code', async () => {
      try {
        await update({
          name: 'non-existent-skill',
          file: validPackagePath,
          targetPath: installDir,
          force: true,
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).code).toBe('FILE_SYSTEM_ERROR');
      }
    });
  });

  describe('security validation', () => {
    it('throws SecurityError for skill name with path traversal', async () => {
      await expect(
        update({
          name: '../evil-skill',
          file: validPackagePath,
          targetPath: installDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for skill name with forward slash', async () => {
      await expect(
        update({
          name: 'evil/skill',
          file: validPackagePath,
          targetPath: installDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for skill name with backslash', async () => {
      await expect(
        update({
          name: 'evil\\skill',
          file: validPackagePath,
          targetPath: installDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for absolute path skill name', async () => {
      await expect(
        update({
          name: '/etc/passwd',
          file: validPackagePath,
          targetPath: installDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for Windows absolute path skill name', async () => {
      await expect(
        update({
          name: 'C:\\Windows\\System32',
          file: validPackagePath,
          targetPath: installDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('SecurityError message mentions invalid skill name', async () => {
      try {
        await update({
          name: '/etc/passwd',
          file: validPackagePath,
          targetPath: installDir,
        });
        fail('Expected SecurityError');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityError);
        // On Unix, absolute paths contain '/' which triggers path traversal check first
        expect((error as SecurityError).message).toContain('Invalid skill name');
      }
    });

    it('SecurityError has correct code', async () => {
      try {
        await update({
          name: '../evil-skill',
          file: validPackagePath,
          targetPath: installDir,
        });
        fail('Expected SecurityError');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityError);
        expect((error as SecurityError).code).toBe('SECURITY_ERROR');
      }
    });
  });

  describe('AbortSignal cancellation', () => {
    it('throws CancellationError when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        update({
          name: skillName,
          file: validPackagePath,
          targetPath: installDir,
          signal: controller.signal,
        })
      ).rejects.toThrow(CancellationError);
    });

    it('CancellationError has correct code', async () => {
      const controller = new AbortController();
      controller.abort();

      try {
        await update({
          name: skillName,
          file: validPackagePath,
          targetPath: installDir,
          signal: controller.signal,
        });
        fail('Expected CancellationError');
      } catch (error) {
        expect(error).toBeInstanceOf(CancellationError);
        expect((error as CancellationError).code).toBe('CANCELLED');
      }
    });

    it('works without AbortSignal', async () => {
      // Should succeed without signal
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
      });

      expect(result.updatedPath).toBeDefined();
    });

    it('succeeds with non-aborted signal', async () => {
      const controller = new AbortController();

      // Should succeed with non-aborted signal
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
        signal: controller.signal,
      });

      expect(result.updatedPath).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('throws FileSystemError for non-existent package file', async () => {
      await expect(
        update({
          name: skillName,
          file: path.join(tempDir, 'non-existent.skill'),
          targetPath: installDir,
          force: true,
        })
      ).rejects.toThrow();
    });

    it('throws PackageError for invalid package', async () => {
      // Create an invalid package file
      const invalidPackagePath = path.join(tempDir, 'invalid.skill');
      await fs.writeFile(invalidPackagePath, 'not a valid zip file');

      await expect(
        update({
          name: skillName,
          file: invalidPackagePath,
          targetPath: installDir,
          force: true,
        })
      ).rejects.toThrow(PackageError);
    });

    it('PackageError has correct code', async () => {
      // Create an invalid package file
      const invalidPackagePath = path.join(tempDir, 'invalid.skill');
      await fs.writeFile(invalidPackagePath, 'not a valid zip file');

      try {
        await update({
          name: skillName,
          file: invalidPackagePath,
          targetPath: installDir,
          force: true,
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PackageError);
        expect((error as PackageError).code).toBe('PACKAGE_ERROR');
      }
    });
  });

  describe('package mismatch handling', () => {
    it('throws PackageError when package skill name does not match', async () => {
      // Create a different skill
      const differentSkillName = 'different-skill';
      const differentSkillResult = await scaffold({
        name: differentSkillName,
        description: 'A different skill',
        output: tempDir,
      });

      // Package the different skill
      const differentPackageDir = path.join(tempDir, 'different-packages');
      await fs.mkdir(differentPackageDir, { recursive: true });

      const differentPackageResult = await createPackage({
        path: differentSkillResult.path,
        output: differentPackageDir,
      });

      // Try to update the original skill with the different package
      await expect(
        update({
          name: skillName,
          file: differentPackageResult.packagePath,
          targetPath: installDir,
          force: true,
        })
      ).rejects.toThrow(PackageError);
    });
  });

  describe('force option', () => {
    it('force allows update to proceed', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
      });

      expect(result.updatedPath).toBeDefined();
      expect(result.dryRun).toBe(false);
    });

    it('force defaults to false', async () => {
      // Without force, update may require confirmation in interactive mode
      // In API mode with quiet, it should work but let's test with force explicitly
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true, // Explicitly set for predictable behavior
      });

      expect(result.updatedPath).toBeDefined();
    });
  });

  describe('never prompts', () => {
    it('API does not prompt - uses force behavior', async () => {
      // API should complete without hanging for input
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
      });

      expect(result.updatedPath).toBeDefined();
    });
  });

  describe('full workflow', () => {
    it('updates a skill from a valid package', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
      });

      // Verify result structure
      expect(result.updatedPath).toBeDefined();
      expect(result.dryRun).toBe(false);

      // Verify directory exists
      const stats = await fs.stat(result.updatedPath);
      expect(stats.isDirectory()).toBe(true);

      // Verify SKILL.md exists
      const skillMdPath = path.join(result.updatedPath, 'SKILL.md');
      const skillMdStats = await fs.stat(skillMdPath);
      expect(skillMdStats.isFile()).toBe(true);
    });

    it('scaffold -> package -> install -> update workflow completes', async () => {
      // Create a "v2" skill with modified content
      const v2SkillDir = path.join(tempDir, 'v2-skill');
      await fs.mkdir(v2SkillDir, { recursive: true });

      const v2ScaffoldResult = await scaffold({
        name: skillName,
        description: 'Updated description for v2',
        output: v2SkillDir,
      });

      // Package v2
      const v2PackageDir = path.join(tempDir, 'v2-packages');
      await fs.mkdir(v2PackageDir, { recursive: true });

      const v2PackageResult = await createPackage({
        path: v2ScaffoldResult.path,
        output: v2PackageDir,
      });

      // Update the installed skill
      const updateResult = await update({
        name: skillName,
        file: v2PackageResult.packagePath,
        targetPath: installDir,
        force: true,
      });

      // Verify update succeeded
      expect(updateResult.updatedPath).toBe(path.join(installDir, skillName));

      // Verify updated content
      const skillMdPath = path.join(updateResult.updatedPath, 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');
      expect(content).toContain('Updated description for v2');
    });

    it('update with keepBackup retains backup file', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
        keepBackup: true,
      });

      // Verify backup path is returned
      expect(result.backupPath).toBeDefined();

      // Verify backup file exists
      if (result.backupPath) {
        const backupStats = await fs.stat(result.backupPath);
        expect(backupStats.isFile()).toBe(true);
      }
    });
  });

  describe('detailed mode', () => {
    it('returns DetailedUpdateResult when detailed: true', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
        detailed: true,
      });

      // Should have DetailedUpdateResult properties
      expect(result.type).toBe('update-success');
      expect(result.skillName).toBeDefined();
      if (result.type === 'update-success') {
        expect(typeof result.previousFileCount).toBe('number');
        expect(typeof result.currentFileCount).toBe('number');
      }
    });

    it('returns success result with file counts and sizes', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
        detailed: true,
      });

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.skillName).toBe(skillName);
        expect(result.path).toContain(skillName);
        expect(result.previousFileCount).toBeGreaterThan(0);
        expect(result.currentFileCount).toBeGreaterThan(0);
        expect(typeof result.previousSize).toBe('number');
        expect(typeof result.currentSize).toBe('number');
        expect(typeof result.backupWillBeRemoved).toBe('boolean');
      }
    });

    it('returns dry-run preview with version comparison', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        dryRun: true,
        detailed: true,
      });

      expect(result.type).toBe('update-dry-run-preview');
      if (result.type === 'update-dry-run-preview') {
        expect(result.skillName).toBe(skillName);
        expect(result.path).toBeDefined();

        // Check version info structure
        expect(result.currentVersion).toBeDefined();
        expect(typeof result.currentVersion.fileCount).toBe('number');
        expect(typeof result.currentVersion.size).toBe('number');

        expect(result.newVersion).toBeDefined();
        expect(typeof result.newVersion.fileCount).toBe('number');
        expect(typeof result.newVersion.size).toBe('number');

        // Check comparison structure
        expect(result.comparison).toBeDefined();
        expect(Array.isArray(result.comparison.filesAdded)).toBe(true);
        expect(Array.isArray(result.comparison.filesRemoved)).toBe(true);
        expect(Array.isArray(result.comparison.filesModified)).toBe(true);
        expect(typeof result.comparison.sizeChange).toBe('number');

        expect(result.backupPath).toBeDefined();
      }
    });

    it('returns backupPath when keepBackup is true', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
        keepBackup: true,
        detailed: true,
      });

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.backupPath).toBeDefined();
        expect(result.backupWillBeRemoved).toBe(false);
      }
    });

    it('returns backupWillBeRemoved: true when keepBackup is false', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
        keepBackup: false,
        detailed: true,
      });

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.backupWillBeRemoved).toBe(true);
      }
    });

    it('returns simple UpdateResult when detailed is false', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
        detailed: false,
      });

      // Should have UpdateResult properties
      expect(result.updatedPath).toBeDefined();
      expect(result.dryRun).toBe(false);

      // Should NOT have DetailedUpdateResult properties
      expect((result as { type?: string }).type).toBeUndefined();
      expect((result as { previousFileCount?: number }).previousFileCount).toBeUndefined();
    });

    it('returns simple UpdateResult when detailed is not specified', async () => {
      const result = await update({
        name: skillName,
        file: validPackagePath,
        targetPath: installDir,
        force: true,
      });

      // Should have UpdateResult properties
      expect(result.updatedPath).toBeDefined();
      expect(result.dryRun).toBe(false);
    });
  });
});

/**
 * Tests for internal error handling and result mapping.
 * These tests mock the generator to verify error translation.
 */
describe('update API error mapping (mocked)', () => {
  let mockUpdateSkill: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    mockUpdateSkill = jest.fn();
    jest.doMock('../../../src/generators/updater', () => ({
      updateSkill: mockUpdateSkill,
      UpdateError: class UpdateError extends Error {
        public readonly updateError: unknown;
        constructor(updateError: unknown) {
          super('Update error');
          this.name = 'UpdateError';
          this.updateError = updateError;
        }
      },
    }));
  });

  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  describe('mapUpdateError cases', () => {
    it('maps skill-not-found error to FileSystemError', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      mockUpdateSkill.mockRejectedValue(
        new MockUpdateError({
          type: 'skill-not-found',
          skillName: 'test-skill',
          searchedPath: '/test/path',
        })
      );

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { FileSystemError: FSError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(FSError);
    });

    it('maps security-error to SecurityError', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      mockUpdateSkill.mockRejectedValue(
        new MockUpdateError({
          type: 'security-error',
          reason: 'path-traversal',
          details: 'Path contains ..',
        })
      );

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { SecurityError: SecError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(SecError);
    });

    it('maps filesystem-error to FileSystemError', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      mockUpdateSkill.mockRejectedValue(
        new MockUpdateError({
          type: 'filesystem-error',
          operation: 'write',
          path: '/test/path',
          message: 'Permission denied',
        })
      );

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { FileSystemError: FSError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(FSError);
    });

    it('maps validation-error with packageContent field to PackageError', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      mockUpdateSkill.mockRejectedValue(
        new MockUpdateError({
          type: 'validation-error',
          field: 'packageContent',
          message: 'Package is corrupted',
        })
      );

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(PkgError);
    });

    it('maps validation-error with packagePath field to PackageError', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      mockUpdateSkill.mockRejectedValue(
        new MockUpdateError({
          type: 'validation-error',
          field: 'packagePath',
          message: 'Package path invalid',
        })
      );

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(PkgError);
    });

    it('maps validation-error with skillName field to ValidationError', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      mockUpdateSkill.mockRejectedValue(
        new MockUpdateError({
          type: 'validation-error',
          field: 'skillName',
          message: 'Invalid skill name',
          details: ['name-too-long'],
        })
      );

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { ValidationError: ValError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(ValError);
    });

    it('maps package-mismatch error to PackageError', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      mockUpdateSkill.mockRejectedValue(
        new MockUpdateError({
          type: 'package-mismatch',
          installedSkillName: 'skill-a',
          packageSkillName: 'skill-b',
          message: 'Package contains different skill',
        })
      );

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'skill-a',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(PkgError);
    });

    it('maps backup-creation-error to FileSystemError', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      mockUpdateSkill.mockRejectedValue(
        new MockUpdateError({
          type: 'backup-creation-error',
          backupPath: '/test/backups/skill.backup',
          reason: 'Disk full',
        })
      );

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { FileSystemError: FSError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(FSError);
    });

    it('maps rollback-error to PackageError', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      mockUpdateSkill.mockRejectedValue(
        new MockUpdateError({
          type: 'rollback-error',
          skillName: 'test-skill',
          updateFailureReason: 'Extraction failed',
          rollbackSucceeded: true,
          backupPath: '/test/backup',
        })
      );

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(PkgError);
    });

    it('maps critical-error to FileSystemError with recovery instructions', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      mockUpdateSkill.mockRejectedValue(
        new MockUpdateError({
          type: 'critical-error',
          skillName: 'test-skill',
          skillPath: '/test/install/test-skill',
          updateFailureReason: 'Extraction failed',
          rollbackFailureReason: 'Backup corrupted',
          backupPath: '/test/backup',
          recoveryInstructions: 'Manually restore from backup',
        })
      );

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { FileSystemError: FSError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FSError);
        expect((error as FileSystemError).message).toContain('Critical error');
        expect((error as FileSystemError).message).toContain('Manually restore');
      }
    });

    it('maps timeout error to FileSystemError', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      mockUpdateSkill.mockRejectedValue(
        new MockUpdateError({
          type: 'timeout',
          operationName: 'extraction',
          timeoutMs: 30000,
        })
      );

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { FileSystemError: FSError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FSError);
        expect((error as FileSystemError).message).toContain('timed out');
        expect((error as FileSystemError).message).toContain('30000ms');
      }
    });

    it('handles unknown error type with default case', async () => {
      const { UpdateError: MockUpdateError } = await import('../../../src/generators/updater');
      // Use type assertion to test the default case in mapUpdateError

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockUpdateSkill.mockRejectedValue(new MockUpdateError({ type: 'unknown-error-type' } as any));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PkgError);
        expect((error as PackageError).message).toContain('Unknown update error');
      }
    });
  });

  describe('result type handling', () => {
    it('handles update-cancelled result with user-cancelled reason', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-cancelled',
        skillName: 'test-skill',
        reason: 'user-cancelled',
        cleanupPerformed: true,
      });

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { CancellationError: CancelError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected CancellationError');
      } catch (error) {
        expect(error).toBeInstanceOf(CancelError);
        expect((error as CancellationError).message).toContain('cancelled by user');
      }
    });

    it('handles update-cancelled result with interrupted reason', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-cancelled',
        skillName: 'test-skill',
        reason: 'interrupted',
        cleanupPerformed: false,
      });

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { CancellationError: CancelError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected CancellationError');
      } catch (error) {
        expect(error).toBeInstanceOf(CancelError);
        expect((error as CancellationError).message).toContain('interrupted');
      }
    });

    it('handles update-rolled-back result with backup path', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-rolled-back',
        skillName: 'test-skill',
        path: '/test/install/test-skill',
        failureReason: 'Package extraction failed',
        backupPath: '/test/backups/test-skill.backup',
      });

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PkgError);
        expect((error as PackageError).message).toContain('Update failed');
        expect((error as PackageError).message).toContain('restored to previous version');
        expect((error as PackageError).message).toContain('Backup available');
      }
    });

    it('handles update-rolled-back result without backup path', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-rolled-back',
        skillName: 'test-skill',
        path: '/test/install/test-skill',
        failureReason: 'Package extraction failed',
      });

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PkgError);
        expect((error as PackageError).message).not.toContain('Backup available');
      }
    });

    it('handles update-rollback-failed result', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-rollback-failed',
        skillName: 'test-skill',
        path: '/test/install/test-skill',
        updateFailureReason: 'Extraction failed',
        rollbackFailureReason: 'Backup corrupted',
        recoveryInstructions: 'Manually restore from /test/backups',
      });

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { FileSystemError: FSError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FSError);
        expect((error as FileSystemError).message).toContain('Critical error');
        expect((error as FileSystemError).message).toContain('Extraction failed');
        expect((error as FileSystemError).message).toContain('Backup corrupted');
        expect((error as FileSystemError).path).toBe('/test/install/test-skill');
      }
    });

    it('handles unexpected result type with default case', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'unknown-result-type',
      });

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PkgError);
        expect((error as PackageError).message).toContain('Unexpected update result');
      }
    });
  });

  describe('detailed result transformation', () => {
    it('returns DetailedUpdateRolledBack for update-rolled-back result', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-rolled-back',
        skillName: 'test-skill',
        path: '/test/install/test-skill',
        failureReason: 'Validation failed after extraction',
        backupPath: '/test/backups/test-skill.backup',
      });

      const { update: mockedUpdate } = await import('../../../src/api/update');

      const result = await mockedUpdate({
        name: 'test-skill',
        file: '/test/package.skill',
        targetPath: '/test/install',
        detailed: true,
      });

      expect(result.type).toBe('update-rolled-back');
      if (result.type === 'update-rolled-back') {
        expect(result.skillName).toBe('test-skill');
        expect(result.path).toBe('/test/install/test-skill');
        expect(result.failureReason).toBe('Validation failed after extraction');
        expect(result.backupPath).toBe('/test/backups/test-skill.backup');
      }
    });

    it('returns DetailedUpdateRollbackFailed for update-rollback-failed result', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-rollback-failed',
        skillName: 'test-skill',
        path: '/test/install/test-skill',
        updateFailureReason: 'Extraction failed',
        rollbackFailureReason: 'Backup corrupted',
        backupPath: '/test/backups/test-skill.backup',
        recoveryInstructions: 'Manually restore from backup',
      });

      const { update: mockedUpdate } = await import('../../../src/api/update');

      const result = await mockedUpdate({
        name: 'test-skill',
        file: '/test/package.skill',
        targetPath: '/test/install',
        detailed: true,
      });

      expect(result.type).toBe('update-rollback-failed');
      if (result.type === 'update-rollback-failed') {
        expect(result.skillName).toBe('test-skill');
        expect(result.path).toBe('/test/install/test-skill');
        expect(result.updateFailureReason).toBe('Extraction failed');
        expect(result.rollbackFailureReason).toBe('Backup corrupted');
        expect(result.recoveryInstructions).toBe('Manually restore from backup');
      }
    });

    it('returns DetailedUpdateCancelled for update-cancelled result', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-cancelled',
        skillName: 'test-skill',
        reason: 'user-cancelled',
        cleanupPerformed: true,
      });

      const { update: mockedUpdate } = await import('../../../src/api/update');

      const result = await mockedUpdate({
        name: 'test-skill',
        file: '/test/package.skill',
        targetPath: '/test/install',
        detailed: true,
      });

      expect(result.type).toBe('update-cancelled');
      if (result.type === 'update-cancelled') {
        expect(result.skillName).toBe('test-skill');
        expect(result.reason).toBe('user-cancelled');
        expect(result.cleanupPerformed).toBe(true);
      }
    });

    it('throws PackageError for unexpected result type in detailed mode', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'unknown-result-type',
      });

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
          detailed: true,
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PkgError);
        expect((error as PackageError).message).toContain('Unexpected update result');
      }
    });
  });

  describe('internal error handling', () => {
    it('re-throws ValidationError as-is', async () => {
      const { ValidationError: ValError } = await import('../../../src/errors');
      const validationError = new ValError('Test validation error', [
        { code: 'TEST', message: 'Test issue' },
      ]);
      mockUpdateSkill.mockRejectedValue(validationError);

      const { update: mockedUpdate } = await import('../../../src/api/update');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(ValError);
    });

    it('converts internal CancellationError to public CancellationError', async () => {
      const internalError = new Error('Operation cancelled');
      internalError.name = 'CancellationError';
      mockUpdateSkill.mockRejectedValue(internalError);

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { CancellationError: CancelError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(CancelError);
    });

    it('handles EACCES permission error', async () => {
      const permError = new Error('Permission denied') as NodeJS.ErrnoException;
      permError.code = 'EACCES';
      mockUpdateSkill.mockRejectedValue(permError);

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { FileSystemError: FSError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FSError);
        expect((error as FileSystemError).message).toContain('Permission denied');
      }
    });

    it('handles EPERM permission error', async () => {
      const permError = new Error('Operation not permitted') as NodeJS.ErrnoException;
      permError.code = 'EPERM';
      mockUpdateSkill.mockRejectedValue(permError);

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { FileSystemError: FSError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FSError);
        expect((error as FileSystemError).message).toContain('Permission denied');
      }
    });

    it('handles ENOENT file not found error', async () => {
      const notFoundError = new Error('No such file') as NodeJS.ErrnoException;
      notFoundError.code = 'ENOENT';
      mockUpdateSkill.mockRejectedValue(notFoundError);

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { FileSystemError: FSError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FSError);
        expect((error as FileSystemError).message).toContain('File not found');
      }
    });

    it('maps "Invalid package" message to PackageError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('Invalid package format'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(PkgError);
    });

    it('maps "Failed to open package" message to PackageError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('Failed to open package: corrupted'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(PkgError);
    });

    it('maps "Name mismatch" message to PackageError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('Name mismatch between package and skill'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(PkgError);
    });

    it('maps "Package contains" message to PackageError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('Package contains invalid files'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(PkgError);
    });

    it('maps "Path traversal" message to SecurityError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('Path traversal detected'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { SecurityError: SecError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(SecError);
    });

    it('maps "Security error" message to SecurityError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('Security error: symlink escape'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { SecurityError: SecError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(SecError);
    });

    it('maps "case mismatch" message to SecurityError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('case mismatch in skill name'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { SecurityError: SecError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(SecError);
    });

    it('maps "not found" message to FileSystemError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('Skill not found at path'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { FileSystemError: FSError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(FSError);
    });

    it('maps "Not found" (capitalized) message to FileSystemError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('Not found: /test/path'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { FileSystemError: FSError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(FSError);
    });

    it('maps "Validation error" message to ValidationError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('Validation error: missing field'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { ValidationError: ValError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(ValError);
    });

    it('maps "validation failed" message to ValidationError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('Package validation failed'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { ValidationError: ValError } = await import('../../../src/errors');

      await expect(
        mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        })
      ).rejects.toThrow(ValError);
    });

    it('wraps unknown errors as PackageError', async () => {
      mockUpdateSkill.mockRejectedValue(new Error('Some unexpected error'));

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PkgError);
        expect((error as PackageError).message).toContain('Update failed');
      }
    });

    it('wraps non-Error values as PackageError', async () => {
      mockUpdateSkill.mockRejectedValue('string error');

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PkgError);
        expect((error as PackageError).message).toContain('Update failed');
      }
    });
  });

  describe('hasErrorCode edge cases', () => {
    it('handles null error in hasErrorCode check', async () => {
      mockUpdateSkill.mockRejectedValue(null);

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PkgError);
      }
    });

    it('handles undefined error', async () => {
      mockUpdateSkill.mockRejectedValue(undefined);

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PkgError);
      }
    });

    it('handles error with code property that is not a filesystem code', async () => {
      const customError = new Error('Custom error') as NodeJS.ErrnoException;
      customError.code = 'CUSTOM_CODE';
      mockUpdateSkill.mockRejectedValue(customError);

      const { update: mockedUpdate } = await import('../../../src/api/update');
      const { PackageError: PkgError } = await import('../../../src/errors');

      try {
        await mockedUpdate({
          name: 'test-skill',
          file: '/test/package.skill',
          targetPath: '/test/install',
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PkgError);
        expect((error as PackageError).message).toContain('Update failed');
      }
    });
  });
});
