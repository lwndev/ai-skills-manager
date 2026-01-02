/**
 * Integration tests for skill uninstallation
 *
 * These tests verify the end-to-end uninstallation workflow, including:
 * - Uninstalling skills from project and personal scopes
 * - Testing scaffold → install → uninstall workflow
 * - Dry-run mode verification
 * - Audit logging verification
 * - Security checks (symlinks, hard links)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { generatePackage } from '../../src/generators/packager';
import { installSkill, isInstallResult } from '../../src/generators/installer';
import {
  uninstallSkill,
  uninstallMultipleSkills,
  isDryRunPreview,
} from '../../src/generators/uninstaller';
import { setAuditBaseDir, getAuditLogPath } from '../../src/utils/audit-logger';

describe('uninstall integration', () => {
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
  let tempDir: string;

  beforeAll(async () => {
    // Ensure the CLI is built
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uninstall-integration-'));

    // Use parameter injection instead of global mocking
    // Set audit base dir for audit logging tests
    setAuditBaseDir(tempDir);

    // Create .claude/skills directory structure
    await fs.mkdir(path.join(tempDir, '.claude', 'skills'), { recursive: true });
  });

  afterEach(async () => {
    // Reset audit base dir
    setAuditBaseDir(null);

    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a skill using the scaffold command
   */
  async function scaffoldSkill(name: string): Promise<string> {
    const skillDir = path.join(tempDir, 'scaffolded', name);
    await fs.mkdir(path.join(tempDir, 'scaffolded'), { recursive: true });

    execSync(
      `node "${cliPath}" scaffold "${name}" --output "${path.join(tempDir, 'scaffolded')}" --description "Test skill for uninstall" --force`,
      { encoding: 'utf-8' }
    );
    return skillDir;
  }

  /**
   * Helper to create a package from a skill
   */
  async function packageSkill(skillDir: string): Promise<string> {
    const outputDir = path.join(tempDir, 'packages');
    await fs.mkdir(outputDir, { recursive: true });

    const result = await generatePackage(skillDir, { outputPath: outputDir, force: true });
    if (!result.success) {
      throw new Error(`Failed to package skill: ${result.errors.join(', ')}`);
    }

    return result.packagePath as string;
  }

  /**
   * Helper to install a skill to the temp skills directory
   */
  async function installSkillToTemp(packagePath: string): Promise<string> {
    const installDir = path.join(tempDir, '.claude', 'skills');
    const result = await installSkill(packagePath, { scope: installDir });

    if (!isInstallResult(result)) {
      throw new Error('Expected InstallResult');
    }

    return result.skillPath;
  }

  /**
   * Helper to create a skill directly (without scaffold/package)
   */
  async function createDirectSkill(name: string): Promise<string> {
    const skillPath = path.join(tempDir, '.claude', 'skills', name);
    await fs.mkdir(skillPath, { recursive: true });

    await fs.writeFile(
      path.join(skillPath, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Direct test skill\n---\n\n# ${name}\n\nTest content.`
    );

    await fs.writeFile(path.join(skillPath, 'README.md'), `# ${name}`);

    // Add some additional files
    await fs.mkdir(path.join(skillPath, 'templates'), { recursive: true });
    await fs.writeFile(path.join(skillPath, 'templates', 'template.txt'), 'Template content');

    return skillPath;
  }

  describe('scaffold → package → install → uninstall workflow', () => {
    it('completes the full skill lifecycle', async () => {
      // Step 1: Scaffold
      const skillDir = await scaffoldSkill('lifecycle-skill');

      // Step 2: Package
      const packagePath = await packageSkill(skillDir);

      // Step 3: Install
      const installedPath = await installSkillToTemp(packagePath);

      // Verify installed
      const installedStats = await fs.stat(installedPath);
      expect(installedStats.isDirectory()).toBe(true);

      // Step 4: Uninstall
      const result = await uninstallSkill('lifecycle-skill', {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      expect(isDryRunPreview(result)).toBe(false);
      if (!isDryRunPreview(result)) {
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.skillName).toBe('lifecycle-skill');
          expect(result.filesRemoved).toBeGreaterThan(0);
        }
      }

      // Verify uninstalled
      await expect(fs.access(installedPath)).rejects.toThrow();
    });

    it('preserves other skills when uninstalling one', async () => {
      // Install two skills
      await createDirectSkill('keep-skill');
      await createDirectSkill('remove-skill');

      // Uninstall one
      const result = await uninstallSkill('remove-skill', {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      expect(isDryRunPreview(result)).toBe(false);
      if (!isDryRunPreview(result)) {
        expect(result.success).toBe(true);
      }

      // Verify the other skill is still there
      const keepPath = path.join(tempDir, '.claude', 'skills', 'keep-skill');
      const keepStats = await fs.stat(keepPath);
      expect(keepStats.isDirectory()).toBe(true);

      // Verify removed skill is gone
      const removePath = path.join(tempDir, '.claude', 'skills', 'remove-skill');
      await expect(fs.access(removePath)).rejects.toThrow();
    });
  });

  describe('dry-run mode', () => {
    it('shows what would be removed without removing', async () => {
      const skillPath = await createDirectSkill('dry-run-test');

      const result = await uninstallSkill('dry-run-test', {
        scope: 'project',
        force: false,
        dryRun: true,
        quiet: false,
        cwd: tempDir,
      });

      expect(isDryRunPreview(result)).toBe(true);
      if (isDryRunPreview(result)) {
        expect(result.skillName).toBe('dry-run-test');
        expect(result.files.length).toBeGreaterThan(0);
      }

      // Skill should still exist
      const stats = await fs.stat(skillPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('shows accurate file count and size', async () => {
      const skillPath = await createDirectSkill('size-test');

      // Add a known-size file
      await fs.writeFile(path.join(skillPath, 'known-size.txt'), 'x'.repeat(1000));

      const result = await uninstallSkill('size-test', {
        scope: 'project',
        force: false,
        dryRun: true,
        quiet: false,
        cwd: tempDir,
      });

      expect(isDryRunPreview(result)).toBe(true);
      if (isDryRunPreview(result)) {
        expect(result.totalSize).toBeGreaterThanOrEqual(1000);
      }
    });
  });

  describe('multiple skills', () => {
    it('uninstalls multiple skills in order', async () => {
      await createDirectSkill('multi-1');
      await createDirectSkill('multi-2');
      await createDirectSkill('multi-3');

      const result = await uninstallMultipleSkills(['multi-1', 'multi-2', 'multi-3'], {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      expect(result.succeeded.length).toBe(3);
      expect(result.failed.length).toBe(0);

      // Verify all removed
      for (const name of ['multi-1', 'multi-2', 'multi-3']) {
        const skillPath = path.join(tempDir, '.claude', 'skills', name);
        await expect(fs.access(skillPath)).rejects.toThrow();
      }
    });

    it('continues after partial failure', async () => {
      await createDirectSkill('exists-1');
      // Don't create 'not-exists'
      await createDirectSkill('exists-2');

      const result = await uninstallMultipleSkills(['exists-1', 'not-exists', 'exists-2'], {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      expect(result.succeeded.length).toBe(2);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].skillName).toBe('not-exists');
    });
  });

  describe('audit logging', () => {
    it('logs successful uninstall', async () => {
      await createDirectSkill('audit-success');

      await uninstallSkill('audit-success', {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      const logPath = getAuditLogPath();
      const logContent = await fs.readFile(logPath, 'utf-8');

      expect(logContent).toContain('UNINSTALL');
      expect(logContent).toContain('audit-success');
      expect(logContent).toContain('SUCCESS');
    });

    it('logs failed uninstall', async () => {
      await uninstallSkill('does-not-exist', {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      const logPath = getAuditLogPath();
      const logContent = await fs.readFile(logPath, 'utf-8');

      expect(logContent).toContain('UNINSTALL');
      expect(logContent).toContain('does-not-exist');
      expect(logContent).toContain('NOT_FOUND');
    });
  });

  describe('force flag requirements', () => {
    it('requires --force for skill without SKILL.md', async () => {
      // Create directory without SKILL.md
      const skillPath = path.join(tempDir, '.claude', 'skills', 'no-skillmd');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, 'file.txt'), 'content');

      // Without force should fail
      const withoutForce = await uninstallSkill('no-skillmd', {
        scope: 'project',
        force: false,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      expect(isDryRunPreview(withoutForce)).toBe(false);
      if (!isDryRunPreview(withoutForce)) {
        expect(withoutForce.success).toBe(false);
      }

      // With force should succeed
      const withForce = await uninstallSkill('no-skillmd', {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      expect(isDryRunPreview(withForce)).toBe(false);
      if (!isDryRunPreview(withForce)) {
        expect(withForce.success).toBe(true);
      }
    });
  });

  describe('security: symlinks', () => {
    it('removes symlinks without following them', async () => {
      const skillPath = await createDirectSkill('symlink-skill');

      // Create a target file outside the skill
      const targetPath = path.join(tempDir, 'external-target.txt');
      await fs.writeFile(targetPath, 'External content');

      // Create symlink inside skill pointing to external file
      const symlinkPath = path.join(skillPath, 'external-link.txt');
      await fs.symlink(targetPath, symlinkPath);

      const result = await uninstallSkill('symlink-skill', {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      expect(isDryRunPreview(result)).toBe(false);
      if (!isDryRunPreview(result)) {
        expect(result.success).toBe(true);
      }

      // Skill should be removed
      await expect(fs.access(skillPath)).rejects.toThrow();

      // External target should still exist
      const targetContent = await fs.readFile(targetPath, 'utf-8');
      expect(targetContent).toBe('External content');
    });
  });

  describe('edge cases', () => {
    it('handles empty skill directory', async () => {
      // Create empty skill directory (with only SKILL.md)
      const skillPath = path.join(tempDir, '.claude', 'skills', 'empty-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), '# Empty');

      const result = await uninstallSkill('empty-skill', {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      expect(isDryRunPreview(result)).toBe(false);
      if (!isDryRunPreview(result)) {
        expect(result.success).toBe(true);
      }
      await expect(fs.access(skillPath)).rejects.toThrow();
    });

    it('handles deeply nested directories', async () => {
      const skillPath = path.join(tempDir, '.claude', 'skills', 'deep-skill');
      const deepPath = path.join(skillPath, 'a', 'b', 'c', 'd', 'e');
      await fs.mkdir(deepPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), '# Deep');
      await fs.writeFile(path.join(deepPath, 'deep-file.txt'), 'Deep content');

      const result = await uninstallSkill('deep-skill', {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      expect(isDryRunPreview(result)).toBe(false);
      if (!isDryRunPreview(result)) {
        expect(result.success).toBe(true);
      }
      await expect(fs.access(skillPath)).rejects.toThrow();
    });

    it('handles files with special characters', async () => {
      const skillPath = path.join(tempDir, '.claude', 'skills', 'special-chars');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), '# Special');
      await fs.writeFile(path.join(skillPath, 'file with spaces.txt'), 'spaces');
      await fs.writeFile(path.join(skillPath, 'file-with-dashes.txt'), 'dashes');
      await fs.writeFile(path.join(skillPath, 'file_with_underscores.txt'), 'underscores');

      const result = await uninstallSkill('special-chars', {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
        cwd: tempDir,
      });

      expect(isDryRunPreview(result)).toBe(false);
      if (!isDryRunPreview(result)) {
        expect(result.success).toBe(true);
      }
      await expect(fs.access(skillPath)).rejects.toThrow();
    });
  });
});
