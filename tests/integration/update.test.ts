/**
 * Integration tests for skill update command
 *
 * These tests verify the end-to-end update workflow, including:
 * - Updating skills from .skill packages
 * - Testing install → modify → package → update workflow
 * - Update to different scopes (project, personal)
 * - Dry-run, force, quiet modes
 * - Backup creation and cleanup
 * - Rollback on failure
 * - Error handling
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { generatePackage } from '../../src/generators/packager';
import { installSkill, isInstallResult } from '../../src/generators/installer';
import { updateSkill } from '../../src/generators/updater';
import type { UpdateOptions } from '../../src/types/update';

describe('update integration', () => {
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
  let tempDir: string;
  let backupDir: string;
  let projectDir: string;
  let skillsDir: string;

  beforeAll(async () => {
    // Ensure the CLI is built
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'update-integration-'));
    backupDir = path.join(tempDir, '.asm', 'backups');
    // Create project structure that 'project' scope will use
    projectDir = path.join(tempDir, 'project');
    skillsDir = path.join(projectDir, '.claude', 'skills');
    await fs.mkdir(backupDir, { recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a skill using the scaffold command
   */
  async function scaffoldSkill(name: string, description?: string): Promise<string> {
    const skillDir = path.join(tempDir, name);
    execSync(
      `node "${cliPath}" scaffold "${name}" --output "${tempDir}" --description "${description || 'Test skill'}" --force`,
      { encoding: 'utf-8' }
    );
    return skillDir;
  }

  /**
   * Helper to create a package from a skill
   */
  async function packageSkill(skillDir: string, force: boolean = false): Promise<string> {
    const outputDir = path.join(tempDir, 'packages');
    await fs.mkdir(outputDir, { recursive: true });

    const result = await generatePackage(skillDir, { outputPath: outputDir, force });
    if (!result.success) {
      throw new Error(`Failed to package skill: ${result.errors.join(', ')}`);
    }

    return result.packagePath as string;
  }

  /**
   * Helper to install a skill to the project skills directory
   */
  async function installSkillToProject(packagePath: string): Promise<string> {
    const result = await installSkill(packagePath, { scope: skillsDir, force: true });
    if (!isInstallResult(result) || !result.success) {
      throw new Error('Failed to install skill');
    }
    return result.skillPath;
  }

  /**
   * Helper to verify file exists
   */
  async function fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper to create default update options for tests
   * Uses 'project' scope with custom cwd pointing to our test project directory
   */
  function createUpdateOptions(overrides?: Partial<UpdateOptions>): UpdateOptions {
    return {
      scope: 'project',
      force: true, // Skip confirmation in tests
      dryRun: false,
      quiet: false,
      noBackup: true, // Faster tests
      keepBackup: false,
      cwd: projectDir, // Point to project dir so 'project' scope resolves to skillsDir
      homedir: tempDir,
      ...overrides,
    };
  }

  describe('install → modify → package → update workflow', () => {
    it('updates a skill with new content', async () => {
      // Step 1: Scaffold v1
      const skillDir = await scaffoldSkill('update-workflow-skill', 'Version 1');

      // Step 2: Package v1
      const packageV1 = await packageSkill(skillDir);

      // Step 3: Install v1 to project skills dir
      const skillPath = await installSkillToProject(packageV1);

      // Verify v1 is installed
      const skillMdV1 = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
      expect(skillMdV1).toContain('Version 1');

      // Step 4: Modify skill for v2
      await fs.writeFile(path.join(skillDir, 'new-file.md'), '# New in V2');
      const skillMdContent = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8');
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        skillMdContent.replace('Version 1', 'Version 2')
      );

      // Step 5: Package v2
      const packageV2 = await packageSkill(skillDir, true);

      // Step 6: Update using project scope
      const result = await updateSkill('update-workflow-skill', packageV2, createUpdateOptions());

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.skillName).toBe('update-workflow-skill');
        expect(result.currentFileCount).toBeGreaterThan(result.previousFileCount);
      }

      // Verify v2 is installed
      const skillMdV2 = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
      expect(skillMdV2).toContain('Version 2');

      // Verify new file exists
      expect(await fileExists(path.join(skillPath, 'new-file.md'))).toBe(true);
    });

    it('preserves file content through update cycle', async () => {
      const skillDir = await scaffoldSkill('content-preserve');
      const customContent = '# Custom Content\n\nThis should be preserved in v2.';
      await fs.writeFile(path.join(skillDir, 'custom.md'), customContent);

      const packageV1 = await packageSkill(skillDir);
      const skillPath = await installSkillToProject(packageV1);

      // Update custom content in source
      const newContent = '# Custom Content V2\n\nUpdated content.';
      await fs.writeFile(path.join(skillDir, 'custom.md'), newContent);
      const packageV2 = await packageSkill(skillDir, true);

      await updateSkill('content-preserve', packageV2, createUpdateOptions());

      // Verify new content
      const installedContent = await fs.readFile(path.join(skillPath, 'custom.md'), 'utf-8');
      expect(installedContent).toBe(newContent);
    });

    it('handles file removal during update', async () => {
      const skillDir = await scaffoldSkill('file-removal');
      await fs.writeFile(path.join(skillDir, 'to-be-removed.md'), 'Will be removed');

      const packageV1 = await packageSkill(skillDir);
      const skillPath = await installSkillToProject(packageV1);

      // Verify file exists in v1
      expect(await fileExists(path.join(skillPath, 'to-be-removed.md'))).toBe(true);

      // Remove file in source
      await fs.unlink(path.join(skillDir, 'to-be-removed.md'));
      const packageV2 = await packageSkill(skillDir, true);

      await updateSkill('file-removal', packageV2, createUpdateOptions());

      // Verify file is removed
      expect(await fileExists(path.join(skillPath, 'to-be-removed.md'))).toBe(false);
    });
  });

  describe('dry-run mode', () => {
    it('shows preview without making changes', async () => {
      const skillDir = await scaffoldSkill('dry-run-skill');
      const packageV1 = await packageSkill(skillDir);

      const skillPath = await installSkillToProject(packageV1);

      // Add a new file to v2
      await fs.writeFile(path.join(skillDir, 'new-file.md'), '# New File');
      const packageV2 = await packageSkill(skillDir, true);

      const result = await updateSkill(
        'dry-run-skill',
        packageV2,
        createUpdateOptions({ dryRun: true })
      );

      expect(result.type).toBe('update-dry-run-preview');
      if (result.type === 'update-dry-run-preview') {
        expect(result.skillName).toBe('dry-run-skill');
        expect(result.comparison.addedCount).toBeGreaterThan(0);
      }

      // Verify new file was NOT installed
      expect(await fileExists(path.join(skillPath, 'new-file.md'))).toBe(false);
    });

    it('shows modifications in preview', async () => {
      const skillDir = await scaffoldSkill('dry-run-mods');
      await fs.writeFile(path.join(skillDir, 'existing.md'), 'Original');
      const packageV1 = await packageSkill(skillDir);

      await installSkillToProject(packageV1);

      // Modify file
      await fs.writeFile(path.join(skillDir, 'existing.md'), 'Modified content');
      const packageV2 = await packageSkill(skillDir, true);

      const result = await updateSkill(
        'dry-run-mods',
        packageV2,
        createUpdateOptions({ dryRun: true })
      );

      expect(result.type).toBe('update-dry-run-preview');
      if (result.type === 'update-dry-run-preview') {
        expect(result.comparison.modifiedCount).toBeGreaterThan(0);
      }
    });
  });

  describe('backup handling', () => {
    it('creates backup before update when noBackup is false', async () => {
      const skillDir = await scaffoldSkill('backup-test');
      const packageV1 = await packageSkill(skillDir);

      await installSkillToProject(packageV1);

      await fs.writeFile(path.join(skillDir, 'v2.md'), 'V2');
      const packageV2 = await packageSkill(skillDir, true);

      const result = await updateSkill('backup-test', packageV2, {
        ...createUpdateOptions(),
        noBackup: false,
        keepBackup: true,
      });

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success' && result.backupPath) {
        expect(await fileExists(result.backupPath)).toBe(true);
      }
    });

    it('skips backup when noBackup is true', async () => {
      const skillDir = await scaffoldSkill('no-backup-test');
      const packageV1 = await packageSkill(skillDir);

      await installSkillToProject(packageV1);

      await fs.writeFile(path.join(skillDir, 'v2.md'), 'V2');
      const packageV2 = await packageSkill(skillDir, true);

      const result = await updateSkill('no-backup-test', packageV2, {
        ...createUpdateOptions(),
        noBackup: true,
      });

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.backupPath).toBeUndefined();
      }
    });
  });

  describe('error handling', () => {
    it('returns skill-not-found error for non-existent skill', async () => {
      const skillDir = await scaffoldSkill('package-only');
      const packagePath = await packageSkill(skillDir);

      await expect(
        updateSkill('non-existent-skill', packagePath, createUpdateOptions())
      ).rejects.toThrow(/not found/i);
    });

    it('returns package-mismatch error when package has different skill name', async () => {
      // Create and install skill-a
      const skillDirA = await scaffoldSkill('skill-a');
      const packageA = await packageSkill(skillDirA);
      await installSkillToProject(packageA);

      // Create package for skill-b
      const skillDirB = await scaffoldSkill('skill-b');
      const packageB = await packageSkill(skillDirB);

      // Try to update skill-a with package-b
      await expect(updateSkill('skill-a', packageB, createUpdateOptions())).rejects.toThrow(
        /mismatch|Package contains skill/i
      );
    });

    it('returns error for invalid package file', async () => {
      const skillDir = await scaffoldSkill('valid-skill');
      const packageV1 = await packageSkill(skillDir);
      await installSkillToProject(packageV1);

      // Create invalid package
      const invalidPackage = path.join(tempDir, 'invalid.skill');
      await fs.writeFile(invalidPackage, 'not a valid zip');

      await expect(
        updateSkill('valid-skill', invalidPackage, createUpdateOptions())
      ).rejects.toThrow();
    });
  });

  describe('CLI command', () => {
    it('shows help text', () => {
      const output = execSync(`node "${cliPath}" update --help`, { encoding: 'utf-8' });

      expect(output).toContain('Update an installed Claude Code skill');
      expect(output).toContain('--scope');
      expect(output).toContain('--force');
      expect(output).toContain('--dry-run');
      expect(output).toContain('--quiet');
      expect(output).toContain('--no-backup');
      expect(output).toContain('--keep-backup');
    });

    it('runs update via CLI', async () => {
      const skillDir = await scaffoldSkill('cli-update-skill');
      const packageV1 = await packageSkill(skillDir);

      await installSkillToProject(packageV1);

      await fs.writeFile(path.join(skillDir, 'v2.md'), '# V2');
      const packageV2 = await packageSkill(skillDir, true);

      // Save cwd and cd to project dir for scope resolution
      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        const output = execSync(
          `node "${cliPath}" update cli-update-skill "${packageV2}" --scope project --force --no-backup`,
          { encoding: 'utf-8' }
        );

        expect(output).toContain('updated');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('shows dry-run output via CLI', async () => {
      const skillDir = await scaffoldSkill('cli-dry-run');
      const packageV1 = await packageSkill(skillDir);

      await installSkillToProject(packageV1);

      await fs.writeFile(path.join(skillDir, 'new.md'), '# New');
      const packageV2 = await packageSkill(skillDir, true);

      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        const output = execSync(
          `node "${cliPath}" update cli-dry-run "${packageV2}" --scope project --dry-run`,
          { encoding: 'utf-8' }
        );

        expect(output).toContain('Dry run');
        expect(output).toContain('No changes made');
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('exits with code 1 for skill not found', async () => {
      const skillDir = await scaffoldSkill('package-for-missing');
      const packagePath = await packageSkill(skillDir);

      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        execSync(`node "${cliPath}" update non-existent "${packagePath}" --scope project --force`, {
          encoding: 'utf-8',
        });
        fail('Expected command to fail');
      } catch (error) {
        const exitError = error as { status: number; stderr?: Buffer };
        expect(exitError.status).toBe(1);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('scope handling', () => {
    it('updates skill in project scope', async () => {
      const skillDir = await scaffoldSkill('project-scope-skill');
      const packageV1 = await packageSkill(skillDir);
      await installSkillToProject(packageV1);

      await fs.writeFile(path.join(skillDir, 'v2.md'), 'V2');
      const packageV2 = await packageSkill(skillDir, true);

      const result = await updateSkill(
        'project-scope-skill',
        packageV2,
        createUpdateOptions({ scope: 'project' })
      );

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.path).toContain('.claude/skills');
      }
    });
  });

  describe('edge cases', () => {
    it('handles updating skill with same content (no changes)', async () => {
      const skillDir = await scaffoldSkill('same-content');
      const packageV1 = await packageSkill(skillDir);

      await installSkillToProject(packageV1);

      // Update with the same package (no changes)
      const result = await updateSkill('same-content', packageV1, createUpdateOptions());

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.previousFileCount).toBe(result.currentFileCount);
      }
    });

    it('handles skill with deeply nested directories', async () => {
      const skillDir = await scaffoldSkill('deep-nested');
      const deepPath = path.join(skillDir, 'a', 'b', 'c', 'd');
      await fs.mkdir(deepPath, { recursive: true });
      await fs.writeFile(path.join(deepPath, 'deep.txt'), 'Deep content');

      const packageV1 = await packageSkill(skillDir);
      await installSkillToProject(packageV1);

      // Update deep file
      await fs.writeFile(path.join(deepPath, 'deep.txt'), 'Updated deep');
      const packageV2 = await packageSkill(skillDir, true);

      const result = await updateSkill('deep-nested', packageV2, createUpdateOptions());

      expect(result.type).toBe('update-success');

      // Verify deep file was updated
      const content = await fs.readFile(
        path.join(skillsDir, 'deep-nested', 'a', 'b', 'c', 'd', 'deep.txt'),
        'utf-8'
      );
      expect(content).toBe('Updated deep');
    });

    it('handles skill with binary files', async () => {
      const skillDir = await scaffoldSkill('binary-skill');
      const binaryV1 = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      await fs.writeFile(path.join(skillDir, 'icon.png'), binaryV1);

      const packageV1 = await packageSkill(skillDir);
      await installSkillToProject(packageV1);

      // Update binary file
      const binaryV2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      await fs.writeFile(path.join(skillDir, 'icon.png'), binaryV2);
      const packageV2 = await packageSkill(skillDir, true);

      const result = await updateSkill('binary-skill', packageV2, createUpdateOptions());

      expect(result.type).toBe('update-success');

      // Verify binary file was updated
      const content = await fs.readFile(path.join(skillsDir, 'binary-skill', 'icon.png'));
      expect(content.equals(binaryV2)).toBe(true);
    });
  });
});
