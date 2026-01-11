/**
 * Integration tests for the install API function (FEAT-010 Phase 5)
 *
 * These tests verify end-to-end behavior of the install() API function
 * with real filesystem operations, including:
 * - Packages are correctly extracted to the target directory
 * - API behavior is consistent with CLI behavior
 * - Full workflow from scaffold to package to install works
 * - Rollback and cleanup on failure
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { install } from '../../../src/api/install';
import { createPackage } from '../../../src/api/package';
import { scaffold } from '../../../src/api/scaffold';
import { validate } from '../../../src/api/validate';
import { PackageError, FileSystemError, CancellationError } from '../../../src/errors';
import { execSync } from 'child_process';

describe('install API integration', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-install-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('installed skills are valid', () => {
    it('installed skill passes validation', async () => {
      // Create and package a skill
      const skillName = 'validation-test-skill';
      const scaffoldResult = await scaffold({
        name: skillName,
        description: 'Test skill for validation',
        output: tempDir,
      });

      const packageDir = path.join(tempDir, 'packages');
      await fs.mkdir(packageDir, { recursive: true });

      const packageResult = await createPackage({
        path: scaffoldResult.path,
        output: packageDir,
      });

      // Install to a new location
      const installDir = path.join(tempDir, 'installed');
      await fs.mkdir(installDir, { recursive: true });

      const installResult = await install({
        file: packageResult.packagePath,
        targetPath: installDir,
      });

      // Validate the installed skill
      const validateResult = await validate(installResult.installedPath);
      expect(validateResult.valid).toBe(true);
    });

    it('installed skill has correct directory structure', async () => {
      const skillName = 'structure-test-skill';
      const scaffoldResult = await scaffold({
        name: skillName,
        description: 'Test skill',
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

      // Verify directory structure
      const stats = await fs.stat(installResult.installedPath);
      expect(stats.isDirectory()).toBe(true);

      // Check for SKILL.md
      const skillMdPath = path.join(installResult.installedPath, 'SKILL.md');
      const skillMdStats = await fs.stat(skillMdPath);
      expect(skillMdStats.isFile()).toBe(true);

      // Check for scripts directory
      const scriptsDir = path.join(installResult.installedPath, 'scripts');
      const scriptsDirStats = await fs.stat(scriptsDir);
      expect(scriptsDirStats.isDirectory()).toBe(true);
    });

    it('installed SKILL.md has correct content', async () => {
      const skillName = 'content-test-skill';
      const description = 'Testing content preservation';
      const scaffoldResult = await scaffold({
        name: skillName,
        description,
        allowedTools: ['Read', 'Write', 'Bash'],
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

      // Read installed SKILL.md
      const skillMdPath = path.join(installResult.installedPath, 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');

      expect(content).toContain(`name: ${skillName}`);
      expect(content).toContain(`description: ${description}`);
      expect(content).toContain('allowed-tools:');
    });
  });

  describe('consistency with CLI install', () => {
    it('API install produces same result as CLI install', async () => {
      const skillName = 'consistency-skill';
      const scaffoldResult = await scaffold({
        name: skillName,
        description: 'Test consistency',
        output: tempDir,
      });

      const packageDir = path.join(tempDir, 'packages');
      await fs.mkdir(packageDir, { recursive: true });

      const packageResult = await createPackage({
        path: scaffoldResult.path,
        output: packageDir,
      });

      // Install using API
      const apiInstallDir = path.join(tempDir, 'api-install');
      await fs.mkdir(apiInstallDir, { recursive: true });

      const apiResult = await install({
        file: packageResult.packagePath,
        targetPath: apiInstallDir,
      });

      // Install using CLI
      const cliInstallDir = path.join(tempDir, 'cli-install');
      await fs.mkdir(cliInstallDir, { recursive: true });

      execSync(
        `node "${cliPath}" install "${packageResult.packagePath}" --scope "${cliInstallDir}" --force`,
        { encoding: 'utf-8' }
      );

      // Compare installed files
      const apiFiles = await listFilesRecursively(apiResult.installedPath);
      const cliFiles = await listFilesRecursively(path.join(cliInstallDir, skillName));

      expect(apiFiles.sort()).toEqual(cliFiles.sort());

      // Compare file contents
      for (const file of apiFiles) {
        const apiContent = await fs.readFile(path.join(apiResult.installedPath, file));
        const cliContent = await fs.readFile(path.join(cliInstallDir, skillName, file));
        expect(apiContent.equals(cliContent)).toBe(true);
      }
    });
  });

  describe('scaffold -> package -> install workflow', () => {
    it('full workflow works end-to-end', async () => {
      // Step 1: Scaffold
      const scaffoldResult = await scaffold({
        name: 'workflow-skill',
        description: 'Testing the full workflow',
        allowedTools: ['Read', 'Write'],
        output: tempDir,
      });

      expect(scaffoldResult.path).toBeDefined();

      // Step 2: Package
      const packageDir = path.join(tempDir, 'packages');
      await fs.mkdir(packageDir, { recursive: true });

      const packageResult = await createPackage({
        path: scaffoldResult.path,
        output: packageDir,
      });

      expect(packageResult.packagePath).toBeDefined();

      // Step 3: Install to a different location
      const installDir = path.join(tempDir, 'installed');
      await fs.mkdir(installDir, { recursive: true });

      const installResult = await install({
        file: packageResult.packagePath,
        targetPath: installDir,
      });

      expect(installResult.installedPath).toBeDefined();
      expect(installResult.skillName).toBe('workflow-skill');
      expect(installResult.dryRun).toBe(false);

      // Step 4: Validate installed skill
      const validateResult = await validate(installResult.installedPath);
      expect(validateResult.valid).toBe(true);
    });

    it('dry run does not modify filesystem', async () => {
      const scaffoldResult = await scaffold({
        name: 'dry-run-test',
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

      // Perform dry run
      const result = await install({
        file: packageResult.packagePath,
        targetPath: installDir,
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.skillName).toBe('dry-run-test');

      // Verify skill was NOT installed
      await expect(fs.access(result.installedPath)).rejects.toThrow();
    });
  });

  describe('multiple skills', () => {
    it('installs multiple skills independently', async () => {
      const skills = ['skill-alpha', 'skill-beta', 'skill-gamma'];
      const installDir = path.join(tempDir, 'installed');
      await fs.mkdir(installDir, { recursive: true });

      const packageDir = path.join(tempDir, 'packages');
      await fs.mkdir(packageDir, { recursive: true });

      // Create and install each skill
      const results = [];
      for (const name of skills) {
        const scaffoldResult = await scaffold({
          name,
          output: tempDir,
        });

        const packageResult = await createPackage({
          path: scaffoldResult.path,
          output: packageDir,
        });

        const installResult = await install({
          file: packageResult.packagePath,
          targetPath: installDir,
        });

        results.push(installResult);
      }

      // Verify all skills are installed
      expect(results.length).toBe(skills.length);

      for (let i = 0; i < skills.length; i++) {
        const expectedPath = path.join(installDir, skills[i]);
        expect(results[i].installedPath).toBe(expectedPath);
        expect(results[i].skillName).toBe(skills[i]);

        // Verify files exist
        const skillMdPath = path.join(expectedPath, 'SKILL.md');
        const stats = await fs.stat(skillMdPath);
        expect(stats.isFile()).toBe(true);
      }
    });
  });

  describe('AbortSignal cancellation', () => {
    it('respects pre-aborted signal', async () => {
      const scaffoldResult = await scaffold({
        name: 'abort-test',
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

      const controller = new AbortController();
      controller.abort();

      await expect(
        install({
          file: packageResult.packagePath,
          targetPath: installDir,
          signal: controller.signal,
        })
      ).rejects.toThrow(CancellationError);
    });

    it('completes successfully with non-aborted signal', async () => {
      const scaffoldResult = await scaffold({
        name: 'no-abort-test',
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

      const controller = new AbortController();

      const result = await install({
        file: packageResult.packagePath,
        targetPath: installDir,
        signal: controller.signal,
      });

      expect(result.installedPath).toBeDefined();
      expect(result.skillName).toBe('no-abort-test');
    });
  });

  describe('error handling', () => {
    it('throws PackageError for invalid package', async () => {
      const installDir = path.join(tempDir, 'installed');
      await fs.mkdir(installDir, { recursive: true });

      // Create an invalid package file
      const invalidPackage = path.join(tempDir, 'invalid.skill');
      await fs.writeFile(invalidPackage, 'not a valid zip');

      try {
        await install({
          file: invalidPackage,
          targetPath: installDir,
        });
        fail('Expected PackageError');
      } catch (error) {
        expect(error).toBeInstanceOf(PackageError);
        expect((error as PackageError).code).toBe('PACKAGE_ERROR');
      }
    });

    it('throws FileSystemError when skill exists without force', async () => {
      const scaffoldResult = await scaffold({
        name: 'exists-test',
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

      // First install
      await install({
        file: packageResult.packagePath,
        targetPath: installDir,
      });

      // Second install without force
      try {
        await install({
          file: packageResult.packagePath,
          targetPath: installDir,
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).code).toBe('FILE_SYSTEM_ERROR');
        expect((error as FileSystemError).path).toContain('exists-test');
      }
    });

    it('force option allows overwriting existing skill', async () => {
      const scaffoldResult = await scaffold({
        name: 'force-test',
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

      // First install
      const firstResult = await install({
        file: packageResult.packagePath,
        targetPath: installDir,
      });

      // Second install with force
      const secondResult = await install({
        file: packageResult.packagePath,
        targetPath: installDir,
        force: true,
      });

      expect(secondResult.installedPath).toBe(firstResult.installedPath);
      expect(secondResult.skillName).toBe(firstResult.skillName);

      // Verify skill still exists and is valid
      const validateResult = await validate(secondResult.installedPath);
      expect(validateResult.valid).toBe(true);
    });
  });

  describe('result object', () => {
    it('installedPath is absolute', async () => {
      const scaffoldResult = await scaffold({
        name: 'absolute-path-test',
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

      const result = await install({
        file: packageResult.packagePath,
        targetPath: installDir,
      });

      expect(path.isAbsolute(result.installedPath)).toBe(true);
    });

    it('skillName matches package content', async () => {
      const skillName = 'name-test-skill';
      const scaffoldResult = await scaffold({
        name: skillName,
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

      const result = await install({
        file: packageResult.packagePath,
        targetPath: installDir,
      });

      expect(result.skillName).toBe(skillName);
    });
  });

  describe('complex skill installation', () => {
    it('installs skill with additional files', async () => {
      const scaffoldResult = await scaffold({
        name: 'complex-skill',
        description: 'A skill with extra files',
        output: tempDir,
      });

      // Add extra files to the skill
      const scriptsDir = path.join(scaffoldResult.path, 'scripts');
      await fs.writeFile(path.join(scriptsDir, 'helper.sh'), '#!/bin/bash\necho "Hello"');
      await fs.writeFile(path.join(scaffoldResult.path, 'README.md'), '# Complex Skill');

      // Add a references directory
      const refsDir = path.join(scaffoldResult.path, 'references');
      await fs.mkdir(refsDir, { recursive: true });
      await fs.writeFile(path.join(refsDir, 'reference.md'), '# Reference Document');

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

      // Verify all files are installed
      const skillMdPath = path.join(installResult.installedPath, 'SKILL.md');
      expect((await fs.stat(skillMdPath)).isFile()).toBe(true);

      const helperPath = path.join(installResult.installedPath, 'scripts', 'helper.sh');
      expect((await fs.stat(helperPath)).isFile()).toBe(true);

      const readmePath = path.join(installResult.installedPath, 'README.md');
      expect((await fs.stat(readmePath)).isFile()).toBe(true);

      const refPath = path.join(installResult.installedPath, 'references', 'reference.md');
      expect((await fs.stat(refPath)).isFile()).toBe(true);

      // Verify content is preserved
      const helperContent = await fs.readFile(helperPath, 'utf-8');
      expect(helperContent).toContain('echo "Hello"');
    });

    it('installs skill with nested directory structure', async () => {
      const scaffoldResult = await scaffold({
        name: 'nested-skill',
        output: tempDir,
      });

      // Create nested structure
      const nestedDir = path.join(scaffoldResult.path, 'a', 'b', 'c');
      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(path.join(nestedDir, 'deep-file.txt'), 'Deep content');

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

      // Verify nested file exists
      const deepFilePath = path.join(installResult.installedPath, 'a', 'b', 'c', 'deep-file.txt');
      expect((await fs.stat(deepFilePath)).isFile()).toBe(true);

      const content = await fs.readFile(deepFilePath, 'utf-8');
      expect(content).toBe('Deep content');
    });
  });

  describe('file permissions', () => {
    it('preserves executable permissions on scripts', async () => {
      const scaffoldResult = await scaffold({
        name: 'permissions-skill',
        output: tempDir,
      });

      // Create an executable script
      const scriptPath = path.join(scaffoldResult.path, 'scripts', 'run.sh');
      await fs.writeFile(scriptPath, '#!/bin/bash\necho "Running"');
      await fs.chmod(scriptPath, 0o755);

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

      // Verify script is executable
      const installedScriptPath = path.join(installResult.installedPath, 'scripts', 'run.sh');
      const stats = await fs.stat(installedScriptPath);
      const mode = stats.mode & 0o777;

      // Script should be executable (at least by owner)
      expect(mode & 0o100).toBeTruthy();
    });
  });
});

/**
 * Helper function to recursively list files in a directory
 */
async function listFilesRecursively(dir: string, base: string = dir): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(base, fullPath);

    if (entry.isDirectory()) {
      const subFiles = await listFilesRecursively(fullPath, base);
      files.push(...subFiles);
    } else {
      files.push(relativePath);
    }
  }

  return files;
}
