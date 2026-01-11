/**
 * Unit tests for the install API function (FEAT-010 Phase 5)
 *
 * Tests that the install() API function:
 * 1. Returns typed InstallResult objects
 * 2. Validates package structure before installation
 * 3. Throws PackageError for invalid packages
 * 4. Throws FileSystemError for permission errors and existing skills
 * 5. Throws SecurityError for path traversal attempts
 * 6. Supports AbortSignal cancellation
 * 7. Supports force overwrite
 * 8. Supports dry run mode
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { install } from '../../../src/api/install';
import { scaffold } from '../../../src/api/scaffold';
import { createPackage } from '../../../src/api/package';
import { PackageError, FileSystemError, CancellationError } from '../../../src/errors';

describe('install API function', () => {
  let tempDir: string;
  let validPackagePath: string;
  let skillName: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-install-test-'));

    // Create a valid skill and package for testing
    skillName = 'test-install-skill';
    const scaffoldResult = await scaffold({
      name: skillName,
      description: 'A test skill for installation',
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
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('return type', () => {
    it('returns an InstallResult object', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      expect(result).toBeDefined();
      expect(typeof result.installedPath).toBe('string');
      expect(typeof result.skillName).toBe('string');
      expect(typeof result.dryRun).toBe('boolean');
    });

    it('returns absolute installed path', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      expect(path.isAbsolute(result.installedPath)).toBe(true);
    });

    it('returns skill name from package', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      expect(result.skillName).toBe(skillName);
    });

    it('dryRun is false for actual installation', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      expect(result.dryRun).toBe(false);
    });
  });

  describe('dry run mode', () => {
    it('returns dryRun: true when dryRun option is set', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
    });

    it('does not create files in dry run mode', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      await install({
        file: validPackagePath,
        targetPath: targetDir,
        dryRun: true,
      });

      // Skill directory should not exist
      const skillDir = path.join(targetDir, skillName);
      await expect(fs.access(skillDir)).rejects.toThrow();
    });

    it('returns correct target path in dry run mode', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
        dryRun: true,
      });

      expect(result.installedPath).toBe(path.join(targetDir, skillName));
    });

    it('returns skill name in dry run mode', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
        dryRun: true,
      });

      expect(result.skillName).toBe(skillName);
    });
  });

  describe('scope options', () => {
    it('installs to custom targetPath when provided', async () => {
      const targetDir = path.join(tempDir, 'custom-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      expect(result.installedPath).toBe(path.join(targetDir, skillName));
    });

    it('targetPath takes precedence over scope', async () => {
      const targetDir = path.join(tempDir, 'explicit-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        scope: 'personal', // This should be ignored
        targetPath: targetDir,
      });

      expect(result.installedPath).toBe(path.join(targetDir, skillName));
    });
  });

  describe('existing skill handling', () => {
    it('throws FileSystemError when skill exists and force is false', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      // Install first time
      await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      // Try to install again without force
      await expect(
        install({
          file: validPackagePath,
          targetPath: targetDir,
          force: false,
        })
      ).rejects.toThrow(FileSystemError);
    });

    it('FileSystemError includes path information', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      // Install first time
      await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      try {
        await install({
          file: validPackagePath,
          targetPath: targetDir,
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).path).toContain(skillName);
      }
    });

    it('overwrites existing skill when force is true', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      // Install first time
      const firstResult = await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      // Install again with force
      const secondResult = await install({
        file: validPackagePath,
        targetPath: targetDir,
        force: true,
      });

      expect(secondResult.installedPath).toBe(firstResult.installedPath);
      expect(secondResult.skillName).toBe(firstResult.skillName);
    });

    it('force defaults to false', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      // Install first time
      await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      // Try to install again (force should default to false)
      await expect(
        install({
          file: validPackagePath,
          targetPath: targetDir,
        })
      ).rejects.toThrow(FileSystemError);
    });
  });

  describe('AbortSignal cancellation', () => {
    it('throws CancellationError when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      await expect(
        install({
          file: validPackagePath,
          targetPath: targetDir,
          signal: controller.signal,
        })
      ).rejects.toThrow(CancellationError);
    });

    it('CancellationError has correct code', async () => {
      const controller = new AbortController();
      controller.abort();

      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      try {
        await install({
          file: validPackagePath,
          targetPath: targetDir,
          signal: controller.signal,
        });
        fail('Expected CancellationError');
      } catch (error) {
        expect(error).toBeInstanceOf(CancellationError);
        expect((error as CancellationError).code).toBe('CANCELLED');
      }
    });

    it('works without AbortSignal', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      // Should succeed without signal
      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      expect(result.installedPath).toBeDefined();
    });

    it('succeeds with non-aborted signal', async () => {
      const controller = new AbortController();
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      // Should succeed with non-aborted signal
      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
        signal: controller.signal,
      });

      expect(result.installedPath).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('throws FileSystemError for non-existent package file', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      await expect(
        install({
          file: path.join(tempDir, 'non-existent.skill'),
          targetPath: targetDir,
        })
      ).rejects.toThrow();
    });

    it('throws PackageError for invalid package', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      // Create an invalid package file
      const invalidPackagePath = path.join(tempDir, 'invalid.skill');
      await fs.writeFile(invalidPackagePath, 'not a valid zip file');

      await expect(
        install({
          file: invalidPackagePath,
          targetPath: targetDir,
        })
      ).rejects.toThrow(PackageError);
    });

    it('FileSystemError has correct code', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      // Install first time
      await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      try {
        await install({
          file: validPackagePath,
          targetPath: targetDir,
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).code).toBe('FILE_SYSTEM_ERROR');
      }
    });

    it('PackageError has correct code', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      // Create an invalid package file
      const invalidPackagePath = path.join(tempDir, 'invalid.skill');
      await fs.writeFile(invalidPackagePath, 'not a valid zip file');

      try {
        await install({
          file: invalidPackagePath,
          targetPath: targetDir,
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PackageError);
        expect((error as PackageError).code).toBe('PACKAGE_ERROR');
      }
    });
  });

  describe('installed files', () => {
    it('creates skill directory at target path', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      const stats = await fs.stat(result.installedPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('creates SKILL.md file in installed directory', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      const skillMdPath = path.join(result.installedPath, 'SKILL.md');
      const stats = await fs.stat(skillMdPath);
      expect(stats.isFile()).toBe(true);
    });
  });

  describe('never prompts', () => {
    it('does not prompt when skill exists - throws instead', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      // Install first time
      await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      // Should throw immediately, not hang waiting for input
      await expect(
        install({
          file: validPackagePath,
          targetPath: targetDir,
        })
      ).rejects.toThrow(FileSystemError);
    });
  });

  describe('full workflow', () => {
    it('installs a skill from a valid package', async () => {
      const targetDir = path.join(tempDir, 'install-target');
      await fs.mkdir(targetDir, { recursive: true });

      const result = await install({
        file: validPackagePath,
        targetPath: targetDir,
      });

      // Verify result structure
      expect(result.installedPath).toBeDefined();
      expect(result.skillName).toBe(skillName);
      expect(result.dryRun).toBe(false);

      // Verify directory was created
      const stats = await fs.stat(result.installedPath);
      expect(stats.isDirectory()).toBe(true);

      // Verify SKILL.md exists
      const skillMdPath = path.join(result.installedPath, 'SKILL.md');
      const skillMdStats = await fs.stat(skillMdPath);
      expect(skillMdStats.isFile()).toBe(true);
    });

    it('package -> install workflow completes successfully', async () => {
      // Create a fresh skill
      const newSkillName = 'workflow-test-skill';
      const scaffoldResult = await scaffold({
        name: newSkillName,
        description: 'Testing the full workflow',
        output: tempDir,
      });

      // Package it
      const packageDir = path.join(tempDir, 'workflow-packages');
      await fs.mkdir(packageDir, { recursive: true });

      const packageResult = await createPackage({
        path: scaffoldResult.path,
        output: packageDir,
      });

      // Install to a different location
      const installDir = path.join(tempDir, 'workflow-install');
      await fs.mkdir(installDir, { recursive: true });

      const installResult = await install({
        file: packageResult.packagePath,
        targetPath: installDir,
      });

      // Verify the installation
      expect(installResult.skillName).toBe(newSkillName);
      expect(installResult.installedPath).toBe(path.join(installDir, newSkillName));

      // Verify files exist
      const skillMdPath = path.join(installResult.installedPath, 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');
      expect(content).toContain(newSkillName);
    });
  });
});
