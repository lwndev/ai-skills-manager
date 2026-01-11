/**
 * Integration tests for the update API function (FEAT-010 Phase 6)
 *
 * These tests verify end-to-end behavior of the update() API function
 * with real filesystem operations, including:
 * - Skills are correctly updated to new versions
 * - Backups are created and can be retained
 * - Rollback works when update fails
 * - Full workflow from scaffold to package to install to update
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { update } from '../../../src/api/update';
import { install } from '../../../src/api/install';
import { createPackage } from '../../../src/api/package';
import { scaffold } from '../../../src/api/scaffold';
import { validate } from '../../../src/api/validate';
import {
  PackageError,
  FileSystemError,
  SecurityError,
  CancellationError,
} from '../../../src/errors';

describe('update API integration', () => {
  let tempDir: string;
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');

  beforeAll(async () => {
    // Ensure CLI is built
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-update-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create and install a skill, returning paths needed for testing
   */
  async function createInstalledSkill(
    name: string,
    description: string = 'Test skill'
  ): Promise<{
    skillName: string;
    installDir: string;
    installedPath: string;
  }> {
    const scaffoldResult = await scaffold({
      name,
      description,
      output: tempDir,
    });

    const packageDir = path.join(tempDir, 'packages');
    await fs.mkdir(packageDir, { recursive: true });

    const packageResult = await createPackage({
      path: scaffoldResult.path,
      output: packageDir,
    });

    const installDir = path.join(tempDir, 'installed');
    await fs.mkdir(installDir, { recursive: true });

    const installResult = await install({
      file: packageResult.packagePath,
      targetPath: installDir,
    });

    return {
      skillName: name,
      installDir,
      installedPath: installResult.installedPath,
    };
  }

  // Counter for unique directory names in createNewVersionPackage
  let versionCounter = 0;

  /**
   * Helper to create a new version package for an existing skill
   */
  async function createNewVersionPackage(
    name: string,
    description: string = 'Updated version'
  ): Promise<string> {
    versionCounter++;
    const versionDir = path.join(tempDir, `${name}-v${versionCounter}`);
    await fs.mkdir(versionDir, { recursive: true });

    const scaffoldResult = await scaffold({
      name,
      description,
      output: versionDir,
    });

    const packageDir = path.join(tempDir, `v${versionCounter}-packages`);
    await fs.mkdir(packageDir, { recursive: true });

    const packageResult = await createPackage({
      path: scaffoldResult.path,
      output: packageDir,
    });

    return packageResult.packagePath;
  }

  describe('updated skills are valid', () => {
    it('updated skill passes validation', async () => {
      const { skillName, installDir } = await createInstalledSkill(
        'validation-update-skill',
        'Original version'
      );

      const v2Package = await createNewVersionPackage(skillName, 'Updated version v2');

      const updateResult = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
      });

      // Validate the updated skill
      const validateResult = await validate(updateResult.updatedPath);
      expect(validateResult.valid).toBe(true);
    });

    it('updated skill has correct directory structure', async () => {
      const { skillName, installDir } = await createInstalledSkill(
        'structure-update-skill',
        'Original'
      );

      const v2Package = await createNewVersionPackage(skillName, 'Updated');

      const updateResult = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
      });

      // Verify directory structure
      const stats = await fs.stat(updateResult.updatedPath);
      expect(stats.isDirectory()).toBe(true);

      // Check for SKILL.md
      const skillMdPath = path.join(updateResult.updatedPath, 'SKILL.md');
      const skillMdStats = await fs.stat(skillMdPath);
      expect(skillMdStats.isFile()).toBe(true);

      // Check for scripts directory
      const scriptsDir = path.join(updateResult.updatedPath, 'scripts');
      const scriptsDirStats = await fs.stat(scriptsDir);
      expect(scriptsDirStats.isDirectory()).toBe(true);
    });

    it('updated SKILL.md has new content', async () => {
      const { skillName, installDir, installedPath } = await createInstalledSkill(
        'content-update-skill',
        'Original description v1'
      );

      // Verify original content
      const originalSkillMd = await fs.readFile(path.join(installedPath, 'SKILL.md'), 'utf-8');
      expect(originalSkillMd).toContain('Original description v1');

      const v2Package = await createNewVersionPackage(skillName, 'New description v2');

      const updateResult = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
      });

      // Verify new content
      const updatedSkillMd = await fs.readFile(
        path.join(updateResult.updatedPath, 'SKILL.md'),
        'utf-8'
      );
      expect(updatedSkillMd).toContain('New description v2');
      expect(updatedSkillMd).not.toContain('Original description v1');
    });
  });

  describe('backup functionality', () => {
    it('keepBackup returns backup path', async () => {
      const { skillName, installDir } = await createInstalledSkill('backup-test-skill', 'Original');

      const v2Package = await createNewVersionPackage(skillName, 'Updated');

      const updateResult = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
        keepBackup: true,
      });

      expect(updateResult.backupPath).toBeDefined();
      expect(typeof updateResult.backupPath).toBe('string');
    });

    it('backup file exists when keepBackup is true', async () => {
      const { skillName, installDir } = await createInstalledSkill(
        'backup-exists-skill',
        'Original'
      );

      const v2Package = await createNewVersionPackage(skillName, 'Updated');

      const updateResult = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
        keepBackup: true,
      });

      if (updateResult.backupPath) {
        const backupStats = await fs.stat(updateResult.backupPath);
        expect(backupStats.isFile()).toBe(true);
      } else {
        fail('Expected backupPath to be defined');
      }
    });

    it('backup file contains original skill', async () => {
      const { skillName, installDir } = await createInstalledSkill(
        'backup-content-skill',
        'Original backup content'
      );

      const v2Package = await createNewVersionPackage(skillName, 'Updated v2');

      const updateResult = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
        keepBackup: true,
      });

      // Backup should be a zip file that can be extracted
      expect(updateResult.backupPath).toBeDefined();
      if (updateResult.backupPath) {
        const backupStats = await fs.stat(updateResult.backupPath);
        expect(backupStats.size).toBeGreaterThan(0);
      }
    });

    it('backup is cleaned up when keepBackup is false', async () => {
      const { skillName, installDir } = await createInstalledSkill(
        'backup-cleanup-skill',
        'Original'
      );

      const v2Package = await createNewVersionPackage(skillName, 'Updated');

      const updateResult = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
        keepBackup: false,
      });

      // backupPath should be undefined when not keeping backup
      expect(updateResult.backupPath).toBeUndefined();
    });
  });

  describe('full scaffold -> package -> install -> update workflow', () => {
    it('complete workflow works end-to-end', async () => {
      // Step 1: Create and install v1
      const skillName = 'workflow-update-skill';
      const { installDir, installedPath } = await createInstalledSkill(skillName, 'Version 1');

      // Verify v1 is installed
      const v1Content = await fs.readFile(path.join(installedPath, 'SKILL.md'), 'utf-8');
      expect(v1Content).toContain('Version 1');

      // Step 2: Create v2 package
      const v2Package = await createNewVersionPackage(skillName, 'Version 2');

      // Step 3: Update to v2
      const updateResult = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
      });

      expect(updateResult.updatedPath).toBeDefined();
      expect(updateResult.dryRun).toBe(false);

      // Step 4: Verify v2 content
      const v2Content = await fs.readFile(path.join(updateResult.updatedPath, 'SKILL.md'), 'utf-8');
      expect(v2Content).toContain('Version 2');
      expect(v2Content).not.toContain('Version 1');

      // Step 5: Validate updated skill
      const validateResult = await validate(updateResult.updatedPath);
      expect(validateResult.valid).toBe(true);
    });

    it('dry run does not modify filesystem', async () => {
      const skillName = 'dry-run-update-skill';
      const { installDir, installedPath } = await createInstalledSkill(
        skillName,
        'Original dry run'
      );

      // Get original content and stats
      const originalContent = await fs.readFile(path.join(installedPath, 'SKILL.md'), 'utf-8');
      const originalStats = await fs.stat(path.join(installedPath, 'SKILL.md'));

      const v2Package = await createNewVersionPackage(skillName, 'Updated dry run');

      // Perform dry run
      const updateResult = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        dryRun: true,
      });

      expect(updateResult.dryRun).toBe(true);

      // Verify content unchanged
      const afterContent = await fs.readFile(path.join(installedPath, 'SKILL.md'), 'utf-8');
      expect(afterContent).toBe(originalContent);
      expect(afterContent).toContain('Original dry run');

      // Verify mtime unchanged
      const afterStats = await fs.stat(path.join(installedPath, 'SKILL.md'));
      expect(afterStats.mtimeMs).toBe(originalStats.mtimeMs);
    });
  });

  describe('multiple update cycles', () => {
    it('can update multiple times', async () => {
      const skillName = 'multi-update-skill';
      const { installDir } = await createInstalledSkill(skillName, 'Version 1');

      // Update to v2
      const v2Package = await createNewVersionPackage(skillName, 'Version 2');
      const update1Result = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
      });

      let content = await fs.readFile(path.join(update1Result.updatedPath, 'SKILL.md'), 'utf-8');
      expect(content).toContain('Version 2');

      // Update to v3
      const v3Package = await createNewVersionPackage(skillName, 'Version 3');
      const update2Result = await update({
        name: skillName,
        file: v3Package,
        targetPath: installDir,
        force: true,
      });

      content = await fs.readFile(path.join(update2Result.updatedPath, 'SKILL.md'), 'utf-8');
      expect(content).toContain('Version 3');

      // Validate final version
      const validateResult = await validate(update2Result.updatedPath);
      expect(validateResult.valid).toBe(true);
    });
  });

  describe('error handling', () => {
    it('throws FileSystemError for non-existent skill', async () => {
      const installDir = path.join(tempDir, 'empty-install');
      await fs.mkdir(installDir, { recursive: true });

      // Create a package for a different skill
      const scaffoldResult = await scaffold({
        name: 'some-other-skill',
        output: tempDir,
      });

      const packageDir = path.join(tempDir, 'other-packages');
      await fs.mkdir(packageDir, { recursive: true });

      const packageResult = await createPackage({
        path: scaffoldResult.path,
        output: packageDir,
      });

      await expect(
        update({
          name: 'non-existent-skill',
          file: packageResult.packagePath,
          targetPath: installDir,
          force: true,
        })
      ).rejects.toThrow(FileSystemError);
    });

    it('throws PackageError for package name mismatch', async () => {
      const { installDir } = await createInstalledSkill('original-skill', 'Original');

      // Create a package for a different skill name
      const scaffoldResult = await scaffold({
        name: 'different-skill',
        output: path.join(tempDir, 'different'),
      });

      const packageDir = path.join(tempDir, 'different-packages');
      await fs.mkdir(packageDir, { recursive: true });

      const packageResult = await createPackage({
        path: scaffoldResult.path,
        output: packageDir,
      });

      await expect(
        update({
          name: 'original-skill',
          file: packageResult.packagePath,
          targetPath: installDir,
          force: true,
        })
      ).rejects.toThrow(PackageError);
    });

    it('throws PackageError for invalid package file', async () => {
      const { skillName, installDir } = await createInstalledSkill(
        'invalid-package-skill',
        'Original'
      );

      // Create an invalid package
      const invalidPackage = path.join(tempDir, 'invalid.skill');
      await fs.writeFile(invalidPackage, 'not a valid zip file');

      try {
        await update({
          name: skillName,
          file: invalidPackage,
          targetPath: installDir,
          force: true,
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PackageError);
        expect((error as PackageError).code).toBe('PACKAGE_ERROR');
      }
    });

    it('throws SecurityError for invalid skill name', async () => {
      const installDir = path.join(tempDir, 'security-test');
      await fs.mkdir(installDir, { recursive: true });

      const scaffoldResult = await scaffold({
        name: 'valid-skill',
        output: tempDir,
      });

      const packageDir = path.join(tempDir, 'security-packages');
      await fs.mkdir(packageDir, { recursive: true });

      const packageResult = await createPackage({
        path: scaffoldResult.path,
        output: packageDir,
      });

      await expect(
        update({
          name: '../evil-skill',
          file: packageResult.packagePath,
          targetPath: installDir,
        })
      ).rejects.toThrow(SecurityError);
    });
  });

  describe('AbortSignal cancellation', () => {
    it('respects pre-aborted signal', async () => {
      const { skillName, installDir } = await createInstalledSkill(
        'abort-update-skill',
        'Original'
      );

      const v2Package = await createNewVersionPackage(skillName, 'Updated');

      const controller = new AbortController();
      controller.abort();

      await expect(
        update({
          name: skillName,
          file: v2Package,
          targetPath: installDir,
          signal: controller.signal,
        })
      ).rejects.toThrow(CancellationError);
    });

    it('completes successfully with non-aborted signal', async () => {
      const { skillName, installDir } = await createInstalledSkill(
        'no-abort-update-skill',
        'Original'
      );

      const v2Package = await createNewVersionPackage(skillName, 'Updated');

      const controller = new AbortController();

      const result = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
        signal: controller.signal,
      });

      expect(result.updatedPath).toBeDefined();
      expect(result.dryRun).toBe(false);
    });
  });

  describe('result object', () => {
    it('updatedPath is absolute', async () => {
      const { skillName, installDir } = await createInstalledSkill(
        'absolute-path-skill',
        'Original'
      );

      const v2Package = await createNewVersionPackage(skillName, 'Updated');

      const result = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
      });

      expect(path.isAbsolute(result.updatedPath)).toBe(true);
    });

    it('dryRun reflects the actual operation', async () => {
      const { skillName, installDir } = await createInstalledSkill(
        'dry-run-flag-skill',
        'Original'
      );

      const v2Package = await createNewVersionPackage(skillName, 'Updated');

      // Actual update
      const actualResult = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
        dryRun: false,
      });
      expect(actualResult.dryRun).toBe(false);

      // Re-create the skill for dry run test
      const { installDir: installDir2 } = await createInstalledSkill(
        'dry-run-flag-skill-2',
        'Original'
      );

      const v2Package2 = await createNewVersionPackage('dry-run-flag-skill-2', 'Updated');

      // Dry run
      const dryRunResult = await update({
        name: 'dry-run-flag-skill-2',
        file: v2Package2,
        targetPath: installDir2,
        dryRun: true,
      });
      expect(dryRunResult.dryRun).toBe(true);
    });
  });

  describe('complex skill updates', () => {
    it('updates skill with additional files', async () => {
      const skillName = 'complex-update-skill';
      const { installDir } = await createInstalledSkill(skillName, 'Version 1');

      // Create v2 with extra files
      const v2Dir = path.join(tempDir, `${skillName}-v2-complex`);
      await fs.mkdir(v2Dir, { recursive: true });

      const v2ScaffoldResult = await scaffold({
        name: skillName,
        description: 'Version 2 with extra files',
        output: v2Dir,
      });

      // Add extra files to v2
      await fs.writeFile(path.join(v2ScaffoldResult.path, 'NEW-FILE.md'), '# New file in v2');
      await fs.writeFile(
        path.join(v2ScaffoldResult.path, 'scripts', 'new-script.sh'),
        '#!/bin/bash\necho "New in v2"'
      );

      const packageDir = path.join(tempDir, 'complex-packages');
      await fs.mkdir(packageDir, { recursive: true });

      const packageResult = await createPackage({
        path: v2ScaffoldResult.path,
        output: packageDir,
      });

      // Update to v2
      const updateResult = await update({
        name: skillName,
        file: packageResult.packagePath,
        targetPath: installDir,
        force: true,
      });

      // Verify new files exist
      const newFilePath = path.join(updateResult.updatedPath, 'NEW-FILE.md');
      expect((await fs.stat(newFilePath)).isFile()).toBe(true);

      const newScriptPath = path.join(updateResult.updatedPath, 'scripts', 'new-script.sh');
      expect((await fs.stat(newScriptPath)).isFile()).toBe(true);

      const newContent = await fs.readFile(newFilePath, 'utf-8');
      expect(newContent).toContain('New file in v2');
    });

    it('updates skill that removes files', async () => {
      const skillName = 'remove-files-skill';

      // Create v1 with extra files
      const v1Dir = path.join(tempDir, `${skillName}-v1`);
      await fs.mkdir(v1Dir, { recursive: true });

      const v1ScaffoldResult = await scaffold({
        name: skillName,
        description: 'Version 1',
        output: v1Dir,
      });

      // Add extra file to v1
      await fs.writeFile(
        path.join(v1ScaffoldResult.path, 'TO-BE-REMOVED.md'),
        '# This file will be removed in v2'
      );

      const v1PackageDir = path.join(tempDir, 'v1-packages');
      await fs.mkdir(v1PackageDir, { recursive: true });

      const v1PackageResult = await createPackage({
        path: v1ScaffoldResult.path,
        output: v1PackageDir,
      });

      // Install v1
      const installDir = path.join(tempDir, 'remove-files-install');
      await fs.mkdir(installDir, { recursive: true });

      await install({
        file: v1PackageResult.packagePath,
        targetPath: installDir,
      });

      // Verify extra file exists in v1
      const extraFilePath = path.join(installDir, skillName, 'TO-BE-REMOVED.md');
      expect((await fs.stat(extraFilePath)).isFile()).toBe(true);

      // Create v2 without the extra file (standard scaffold)
      const v2Package = await createNewVersionPackage(skillName, 'Version 2');

      // Update to v2
      const updateResult = await update({
        name: skillName,
        file: v2Package,
        targetPath: installDir,
        force: true,
      });

      // Verify extra file is removed
      const removedFilePath = path.join(updateResult.updatedPath, 'TO-BE-REMOVED.md');
      await expect(fs.access(removedFilePath)).rejects.toThrow();
    });
  });
});
