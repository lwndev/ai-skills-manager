/**
 * Integration tests for skill installation
 *
 * These tests verify the end-to-end installation workflow, including:
 * - Installing skills from valid .skill packages
 * - Testing scaffold → validate → package → install workflow
 * - Installation to different scopes (project, personal, custom)
 * - Overwrite handling and rollback
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';
import { generatePackage } from '../../src/generators/packager';
import {
  installSkill,
  isInstallResult,
  isDryRunPreview,
  isOverwriteRequired,
} from '../../src/generators/installer';
import { InvalidPackageError } from '../../src/utils/errors';

describe('install integration', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'install-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a skill using the scaffold command
   */
  async function scaffoldSkill(name: string): Promise<string> {
    execSync(
      `node "${cliPath}" scaffold "${name}" --output "${tempDir}" --description "Test skill for installation" --force`,
      { encoding: 'utf-8' }
    );
    return path.join(tempDir, name);
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
   * Helper to verify skill is installed correctly
   */
  async function verifyInstallation(skillPath: string, expectedFiles: string[]): Promise<void> {
    // Check directory exists
    const stats = await fs.stat(skillPath);
    expect(stats.isDirectory()).toBe(true);

    // Check expected files
    for (const file of expectedFiles) {
      const filePath = path.join(skillPath, file);
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }
  }

  describe('scaffold → validate → package → install workflow', () => {
    it('installs a freshly packaged skill', async () => {
      // Step 1: Scaffold
      const skillDir = await scaffoldSkill('workflow-skill');

      // Step 2: Validate (should pass)
      const validateResult = execSync(`node "${cliPath}" validate "${skillDir}" --quiet`, {
        encoding: 'utf-8',
      });
      expect(validateResult.trim()).toBe('PASS');

      // Step 3: Package
      const packagePath = await packageSkill(skillDir);

      // Step 4: Install to a new location
      const installDir = path.join(tempDir, 'installed');
      const result = await installSkill(packagePath, { scope: installDir });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      expect(result.success).toBe(true);
      expect(result.skillName).toBe('workflow-skill');
      expect(result.fileCount).toBeGreaterThan(0);

      // Verify installation
      await verifyInstallation(result.skillPath, ['SKILL.md']);

      // Validate the installed skill
      const installValidate = execSync(`node "${cliPath}" validate "${result.skillPath}" --quiet`, {
        encoding: 'utf-8',
      });
      expect(installValidate.trim()).toBe('PASS');
    });

    it('preserves file content through package → install cycle', async () => {
      const skillDir = await scaffoldSkill('content-preserve-skill');

      // Add custom content
      const customContent = '# Custom Content\n\nThis should be preserved.';
      await fs.writeFile(path.join(skillDir, 'custom.md'), customContent);

      const packagePath = await packageSkill(skillDir);

      const installDir = path.join(tempDir, 'installed');
      const result = await installSkill(packagePath, { scope: installDir });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      // Verify custom file was preserved
      const installedContent = await fs.readFile(path.join(result.skillPath, 'custom.md'), 'utf-8');
      expect(installedContent).toBe(customContent);
    });

    it('preserves directory structure through package → install cycle', async () => {
      const skillDir = await scaffoldSkill('structure-preserve-skill');

      // Add nested structure
      await fs.mkdir(path.join(skillDir, 'templates', 'nested'), { recursive: true });
      await fs.writeFile(path.join(skillDir, 'templates', 'base.txt'), 'base template');
      await fs.writeFile(path.join(skillDir, 'templates', 'nested', 'deep.txt'), 'deep template');

      const packagePath = await packageSkill(skillDir);

      const installDir = path.join(tempDir, 'installed');
      const result = await installSkill(packagePath, { scope: installDir });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      // Verify structure was preserved
      await verifyInstallation(result.skillPath, [
        'SKILL.md',
        'templates/base.txt',
        'templates/nested/deep.txt',
      ]);
    });
  });

  describe('installation scopes', () => {
    it('installs to project scope (.claude/skills/)', async () => {
      const skillDir = await scaffoldSkill('project-scope-skill');
      const packagePath = await packageSkill(skillDir);

      // Create a mock project directory
      const projectDir = path.join(tempDir, 'mock-project');
      await fs.mkdir(projectDir, { recursive: true });

      // Save current cwd and change to project dir
      const originalCwd = process.cwd();
      process.chdir(projectDir);

      try {
        const result = await installSkill(packagePath, { scope: 'project' });

        if (!isInstallResult(result)) {
          throw new Error('Expected InstallResult');
        }

        expect(result.skillPath).toContain('.claude/skills/');
        expect(result.skillPath).toContain('project-scope-skill');

        await verifyInstallation(result.skillPath, ['SKILL.md']);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('installs to custom path', async () => {
      const skillDir = await scaffoldSkill('custom-path-skill');
      const packagePath = await packageSkill(skillDir);

      const customDir = path.join(tempDir, 'custom', 'install', 'location');
      const result = await installSkill(packagePath, { scope: customDir });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      expect(result.skillPath).toBe(path.join(customDir, 'custom-path-skill'));
      await verifyInstallation(result.skillPath, ['SKILL.md']);
    });
  });

  describe('overwrite handling', () => {
    it('requires confirmation when skill exists and force is false', async () => {
      const skillDir = await scaffoldSkill('overwrite-skill');
      const packagePath = await packageSkill(skillDir);

      const installDir = path.join(tempDir, 'installed');

      // Install first time
      const result1 = await installSkill(packagePath, { scope: installDir, force: true });
      if (!isInstallResult(result1)) {
        throw new Error('Expected InstallResult');
      }

      // Try to install again without force
      const result2 = await installSkill(packagePath, { scope: installDir, force: false });

      if (!isOverwriteRequired(result2)) {
        throw new Error('Expected OverwriteRequired');
      }

      expect(result2.requiresOverwrite).toBe(true);
      expect(result2.skillName).toBe('overwrite-skill');
      expect(result2.files.length).toBeGreaterThan(0);
    });

    it('overwrites when force is true', async () => {
      const skillDir = await scaffoldSkill('force-overwrite-skill');

      // Add initial custom content
      await fs.writeFile(path.join(skillDir, 'version.txt'), 'version 1');
      const packagePath1 = await packageSkill(skillDir);

      const installDir = path.join(tempDir, 'installed');

      // Install version 1
      const result1 = await installSkill(packagePath1, { scope: installDir, force: true });
      if (!isInstallResult(result1)) {
        throw new Error('Expected InstallResult');
      }

      // Modify and repackage
      await fs.writeFile(path.join(skillDir, 'version.txt'), 'version 2');
      const packagePath2 = await packageSkill(skillDir, true);

      // Install version 2 with force
      const result2 = await installSkill(packagePath2, { scope: installDir, force: true });
      if (!isInstallResult(result2)) {
        throw new Error('Expected InstallResult');
      }

      expect(result2.wasOverwritten).toBe(true);

      // Verify new content
      const content = await fs.readFile(path.join(result2.skillPath, 'version.txt'), 'utf-8');
      expect(content).toBe('version 2');
    });
  });

  describe('dry-run mode', () => {
    it('shows preview without installing', async () => {
      const skillDir = await scaffoldSkill('dry-run-skill');
      const packagePath = await packageSkill(skillDir);

      const installDir = path.join(tempDir, 'installed');
      const result = await installSkill(packagePath, { scope: installDir, dryRun: true });

      if (!isDryRunPreview(result)) {
        throw new Error('Expected DryRunPreview');
      }

      expect(result.skillName).toBe('dry-run-skill');
      expect(result.targetPath).toContain('dry-run-skill');
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.wouldOverwrite).toBe(false);

      // Verify nothing was installed
      const exists = await fs
        .access(result.targetPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('detects conflicts with existing files', async () => {
      const skillDir = await scaffoldSkill('conflict-detection-skill');
      const packagePath = await packageSkill(skillDir);

      const installDir = path.join(tempDir, 'installed');

      // Install first
      await installSkill(packagePath, { scope: installDir, force: true });

      // Dry run to check conflicts
      const result = await installSkill(packagePath, { scope: installDir, dryRun: true });

      if (!isDryRunPreview(result)) {
        throw new Error('Expected DryRunPreview');
      }

      expect(result.wouldOverwrite).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts).toContain('SKILL.md');
    });
  });

  describe('validation and error handling', () => {
    it('rejects package with invalid structure', async () => {
      // Create a package with no root directory
      const invalidPackagePath = path.join(tempDir, 'invalid.skill');
      const zip = new AdmZip();
      zip.addFile('SKILL.md', Buffer.from('---\nname: test\n---\n\n# Test'));
      zip.addFile('README.md', Buffer.from('# Readme'));
      zip.writeZip(invalidPackagePath);

      const installDir = path.join(tempDir, 'installed');

      await expect(installSkill(invalidPackagePath, { scope: installDir })).rejects.toThrow(
        InvalidPackageError
      );
    });

    it('rejects package with name mismatch', async () => {
      // Create a package with mismatched names
      const mismatchPackagePath = path.join(tempDir, 'mismatch.skill');
      const zip = new AdmZip();
      zip.addFile(
        'wrong-name/SKILL.md',
        Buffer.from('---\nname: correct-name\ndescription: Test\n---\n\n# Test')
      );
      zip.writeZip(mismatchPackagePath);

      const installDir = path.join(tempDir, 'installed');

      await expect(installSkill(mismatchPackagePath, { scope: installDir })).rejects.toThrow(
        InvalidPackageError
      );
    });

    it('rejects corrupted package file', async () => {
      const corruptPath = path.join(tempDir, 'corrupt.skill');
      await fs.writeFile(corruptPath, 'not a valid zip file');

      const installDir = path.join(tempDir, 'installed');

      await expect(installSkill(corruptPath, { scope: installDir })).rejects.toThrow(
        InvalidPackageError
      );
    });

    it('rejects non-existent package file', async () => {
      const installDir = path.join(tempDir, 'installed');

      await expect(
        installSkill('/non/existent/package.skill', { scope: installDir })
      ).rejects.toThrow(InvalidPackageError);
    });
  });

  describe('edge cases', () => {
    it('handles skill with deeply nested directories', async () => {
      const skillDir = await scaffoldSkill('deep-nested-skill');

      // Create deep nesting
      const deepPath = path.join(skillDir, 'a', 'b', 'c', 'd', 'e');
      await fs.mkdir(deepPath, { recursive: true });
      await fs.writeFile(path.join(deepPath, 'deep.txt'), 'Deep content');

      const packagePath = await packageSkill(skillDir);
      const installDir = path.join(tempDir, 'installed');

      const result = await installSkill(packagePath, { scope: installDir, force: true });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      // Verify deep file exists
      await verifyInstallation(result.skillPath, ['a/b/c/d/e/deep.txt']);
    });

    it('handles skill with binary files', async () => {
      const skillDir = await scaffoldSkill('binary-skill');

      // Create a binary file
      const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      await fs.writeFile(path.join(skillDir, 'icon.png'), binaryData);

      const packagePath = await packageSkill(skillDir);
      const installDir = path.join(tempDir, 'installed');

      const result = await installSkill(packagePath, { scope: installDir, force: true });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      // Verify binary file
      const installedBinary = await fs.readFile(path.join(result.skillPath, 'icon.png'));
      expect(installedBinary.equals(binaryData)).toBe(true);
    });

    it('handles skill with only SKILL.md', async () => {
      // Create minimal skill
      const skillDir = path.join(tempDir, 'minimal-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: minimal-skill\ndescription: Minimal\n---\n\n# Minimal'
      );

      const packagePath = await packageSkill(skillDir);
      const installDir = path.join(tempDir, 'installed');

      const result = await installSkill(packagePath, { scope: installDir, force: true });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(1);
    });

    it('handles skill with special characters in file names', async () => {
      const skillDir = await scaffoldSkill('special-chars-skill');
      await fs.writeFile(path.join(skillDir, 'file with spaces.txt'), 'content');
      await fs.writeFile(path.join(skillDir, 'file-with-dashes.txt'), 'content');

      const packagePath = await packageSkill(skillDir);
      const installDir = path.join(tempDir, 'installed');

      const result = await installSkill(packagePath, { scope: installDir, force: true });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      await verifyInstallation(result.skillPath, ['file with spaces.txt', 'file-with-dashes.txt']);
    });

    it('creates target directory if it does not exist', async () => {
      const skillDir = await scaffoldSkill('auto-create-skill');
      const packagePath = await packageSkill(skillDir);

      // Use deeply nested non-existent path
      const installDir = path.join(tempDir, 'deep', 'nested', 'install', 'path');

      const result = await installSkill(packagePath, { scope: installDir, force: true });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      expect(result.success).toBe(true);
      await verifyInstallation(result.skillPath, ['SKILL.md']);
    });
  });

  describe('installation statistics', () => {
    it('reports correct file count', async () => {
      const skillDir = await scaffoldSkill('stats-skill');

      // Add some files
      await fs.writeFile(path.join(skillDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(skillDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(skillDir, 'subdir'));
      await fs.writeFile(path.join(skillDir, 'subdir', 'file3.txt'), 'content3');

      const packagePath = await packageSkill(skillDir);
      const installDir = path.join(tempDir, 'installed');

      const result = await installSkill(packagePath, { scope: installDir, force: true });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      // Count should include SKILL.md + our 3 files + any scaffold files
      expect(result.fileCount).toBeGreaterThanOrEqual(4);
    });

    it('reports installation size', async () => {
      const skillDir = await scaffoldSkill('size-stats-skill');

      // Add a file with known content
      const knownContent = 'A'.repeat(1000);
      await fs.writeFile(path.join(skillDir, 'known-size.txt'), knownContent);

      const packagePath = await packageSkill(skillDir);
      const installDir = path.join(tempDir, 'installed');

      const result = await installSkill(packagePath, { scope: installDir, force: true });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      // Size should be at least 1000 bytes (our known content)
      expect(result.size).toBeGreaterThanOrEqual(1000);
    });
  });
});
