/**
 * CLI command tests for the install command
 *
 * These tests verify the `asm install` command behavior including:
 * - Command line argument parsing
 * - Exit codes
 * - Output formats (normal, quiet, dry-run)
 * - Error handling
 * - Help text
 * - Installation to different scopes
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('asm install command', () => {
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
  const fixturesPath = path.join(process.cwd(), 'tests', 'fixtures', 'skills');
  let tempDir: string;
  let packagePath: string;

  beforeAll(async () => {
    // Ensure the CLI is built
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-install-cmd-'));

    // Create a valid .skill package from the valid-skill fixture
    const skillPath = path.join(fixturesPath, 'valid-skill');
    const outputDir = path.join(tempDir, 'packages');
    await fs.mkdir(outputDir);

    // Use asm package to create a test package
    execSync(`node "${cliPath}" package "${skillPath}" --output "${outputDir}" --skip-validation`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    // Find the created package
    const files = await fs.readdir(outputDir);
    const skillFile = files.find((f) => f.endsWith('.skill'));
    if (!skillFile) {
      throw new Error('Failed to create test package');
    }
    packagePath = path.join(outputDir, skillFile);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to run CLI command and capture output
   */
  function runCli(
    args: string,
    options: { expectSuccess?: boolean } = {}
  ): {
    stdout: string;
    stderr: string;
    exitCode: number;
  } {
    const { expectSuccess = true } = options;
    try {
      const stdout = execSync(`node "${cliPath}" ${args}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      return { stdout, stderr: '', exitCode: 0 };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; status?: number };
      if (expectSuccess) {
        throw error;
      }
      return {
        stdout: execError.stdout || '',
        stderr: execError.stderr || '',
        exitCode: execError.status || 1,
      };
    }
  }

  describe('help and usage', () => {
    it('displays help with --help flag', () => {
      const { stdout } = runCli('install --help');

      expect(stdout).toContain('Install a Claude Code skill from a .skill package file');
      expect(stdout).toContain('--scope');
      expect(stdout).toContain('--force');
      expect(stdout).toContain('--dry-run');
      expect(stdout).toContain('--quiet');
      expect(stdout).toContain('Examples:');
      expect(stdout).toContain('Installation Process:');
      expect(stdout).toContain('Exit Codes:');
      expect(stdout).toContain('Security:');
    });

    it('shows install command in main help', () => {
      const { stdout } = runCli('--help');

      expect(stdout).toContain('install');
    });
  });

  describe('successful installation', () => {
    it('installs a valid package successfully', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      const { stdout, exitCode } = runCli(`install "${packagePath}" --scope "${installDir}"`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Skill installed successfully');

      // Verify skill was installed
      const files = await fs.readdir(installDir);
      expect(files).toContain('valid-skill');

      // Verify SKILL.md exists
      const skillMd = path.join(installDir, 'valid-skill', 'SKILL.md');
      await expect(fs.access(skillMd)).resolves.toBeUndefined();
    });

    it('returns exit code 0 for successful install', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      const { exitCode } = runCli(`install "${packagePath}" --scope "${installDir}"`);

      expect(exitCode).toBe(0);
    });

    it('shows installation details on success', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      const { stdout } = runCli(`install "${packagePath}" --scope "${installDir}"`);

      expect(stdout).toContain('Name:');
      expect(stdout).toContain('Path:');
      expect(stdout).toContain('Files:');
      expect(stdout).toContain('Size:');
    });

    it('shows security warning on success', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      const { stdout } = runCli(`install "${packagePath}" --scope "${installDir}"`);

      expect(stdout).toContain('Security note:');
      expect(stdout).toContain('trusted sources');
    });

    it('shows next steps on success', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      const { stdout } = runCli(`install "${packagePath}" --scope "${installDir}"`);

      expect(stdout).toContain('Next steps:');
      expect(stdout).toContain('asm validate');
    });
  });

  describe('dry-run mode', () => {
    it('shows preview without installing with --dry-run', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      const { stdout, exitCode } = runCli(
        `install "${packagePath}" --scope "${installDir}" --dry-run`
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Dry run');
      expect(stdout).toContain('Would install:');
      expect(stdout).toContain('Files to install:');

      // Verify no files were created
      await expect(fs.access(installDir)).rejects.toThrow();
    });

    it('supports -n shorthand for --dry-run', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      const { stdout, exitCode } = runCli(`install "${packagePath}" --scope "${installDir}" -n`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Dry run');
    });
  });

  describe('quiet mode', () => {
    it('produces minimal output with --quiet flag', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      const { stdout, exitCode } = runCli(
        `install "${packagePath}" --scope "${installDir}" --quiet`
      );

      expect(exitCode).toBe(0);
      // In quiet mode, should just output the skill path
      expect(stdout.trim()).toContain('valid-skill');
      // Should NOT contain verbose output
      expect(stdout).not.toContain('Next steps:');
    });

    it('supports -q shorthand for --quiet', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      const { stdout, exitCode } = runCli(`install "${packagePath}" --scope "${installDir}" -q`);

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toContain('valid-skill');
    });
  });

  describe('force overwrite', () => {
    it('overwrites existing skill with --force flag', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      // First install
      runCli(`install "${packagePath}" --scope "${installDir}"`);

      // Second install with force
      const { exitCode, stdout } = runCli(
        `install "${packagePath}" --scope "${installDir}" --force`
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Skill installed successfully');
      expect(stdout).toContain('overwritten');
    });

    it('supports -f shorthand for --force', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      // First install
      runCli(`install "${packagePath}" --scope "${installDir}"`);

      // Second install with force shorthand
      const { exitCode } = runCli(`install "${packagePath}" --scope "${installDir}" -f`);

      expect(exitCode).toBe(0);
    });
  });

  describe('installation scope', () => {
    it('installs to custom scope path with --scope', async () => {
      const customPath = path.join(tempDir, 'custom-install-path');

      const { exitCode, stdout } = runCli(`install "${packagePath}" --scope "${customPath}"`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain(customPath);

      // Verify skill exists at custom path
      const skillDir = path.join(customPath, 'valid-skill');
      const stats = await fs.stat(skillDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('supports -s shorthand for --scope', async () => {
      const customPath = path.join(tempDir, 'custom-install-path');

      const { exitCode } = runCli(`install "${packagePath}" -s "${customPath}"`);

      expect(exitCode).toBe(0);

      const skillDir = path.join(customPath, 'valid-skill');
      await expect(fs.access(skillDir)).resolves.toBeUndefined();
    });

    it('creates scope directory if it does not exist', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'path', 'skills');

      const { exitCode } = runCli(`install "${packagePath}" --scope "${nestedPath}"`);

      expect(exitCode).toBe(0);

      const skillDir = path.join(nestedPath, 'valid-skill');
      await expect(fs.access(skillDir)).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('fails with exit code for non-existent package', () => {
      const { exitCode, stdout } = runCli('install "/path/that/does/not/exist.skill"', {
        expectSuccess: false,
      });

      // Should be exit code 2 (FILE_SYSTEM_ERROR)
      expect(exitCode).toBe(2);
      expect(stdout).toContain('Error:');
    });

    it('fails for invalid package extension', async () => {
      const invalidPath = path.join(tempDir, 'not-a-skill.zip');
      await fs.writeFile(invalidPath, 'not a real zip');

      const { exitCode, stdout } = runCli(`install "${invalidPath}"`, {
        expectSuccess: false,
      });

      expect(exitCode).toBeGreaterThan(0);
      expect(stdout).toContain('Error:');
    });

    it('shows clear error messages', () => {
      const { stdout } = runCli('install "/nonexistent/path.skill"', {
        expectSuccess: false,
      });

      expect(stdout).toContain('Error:');
    });

    it('handles quiet mode errors correctly', () => {
      const { stdout, exitCode } = runCli('install "/nonexistent/path.skill" --quiet', {
        expectSuccess: false,
      });

      expect(exitCode).toBeGreaterThan(0);
      expect(stdout).toContain('FAIL');
    });
  });

  describe('combined options', () => {
    it('handles multiple shorthand options together', async () => {
      const customPath = path.join(tempDir, 'combined-options');

      const { exitCode, stdout } = runCli(`install "${packagePath}" -s "${customPath}" -q`);

      expect(exitCode).toBe(0);
      // Quiet mode should just output path
      expect(stdout.trim()).toContain('valid-skill');
    });

    it('handles force and quiet together', async () => {
      const customPath = path.join(tempDir, 'force-quiet');

      // First install
      runCli(`install "${packagePath}" -s "${customPath}"`);

      // Force overwrite in quiet mode
      const { exitCode, stdout } = runCli(`install "${packagePath}" -s "${customPath}" -f -q`);

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toContain('valid-skill');
    });

    it('handles dry-run and quiet together', async () => {
      const customPath = path.join(tempDir, 'dryrun-quiet');

      const { exitCode, stdout } = runCli(`install "${packagePath}" -s "${customPath}" -n`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Dry run');
    });
  });

  describe('skill naming', () => {
    it('uses skill name from package for installation directory', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      const { stdout } = runCli(`install "${packagePath}" --scope "${installDir}"`);

      expect(stdout).toContain('valid-skill');

      // Verify directory name matches skill name
      const skillDir = path.join(installDir, 'valid-skill');
      const stats = await fs.stat(skillDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('file extraction', () => {
    it('extracts all files from package', async () => {
      const installDir = path.join(tempDir, 'install-target', '.claude', 'skills');

      runCli(`install "${packagePath}" --scope "${installDir}"`);

      // Verify SKILL.md was extracted
      const skillMdPath = path.join(installDir, 'valid-skill', 'SKILL.md');
      await expect(fs.access(skillMdPath)).resolves.toBeUndefined();

      // Read and verify content exists
      const content = await fs.readFile(skillMdPath, 'utf-8');
      expect(content).toContain('name:');
    });
  });
});
