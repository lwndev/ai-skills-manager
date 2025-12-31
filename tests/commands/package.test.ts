/**
 * CLI command tests for the package command
 *
 * These tests verify the `asm package` command behavior including:
 * - Command line argument parsing
 * - Exit codes
 * - Output formats (normal, quiet)
 * - Error handling
 * - Help text
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('asm package command', () => {
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
  const fixturesPath = path.join(process.cwd(), 'tests', 'fixtures', 'skills');
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-package-cmd-'));
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
      const { stdout } = runCli('package --help');

      expect(stdout).toContain('Package a Claude Code skill into a distributable .skill file');
      expect(stdout).toContain('--output');
      expect(stdout).toContain('--force');
      expect(stdout).toContain('--skip-validation');
      expect(stdout).toContain('--quiet');
      expect(stdout).toContain('Examples:');
      expect(stdout).toContain('Packaging Process:');
      expect(stdout).toContain('Excluded Files:');
      expect(stdout).toContain('Exit Codes:');
    });

    it('shows package command in main help', () => {
      const { stdout } = runCli('--help');

      expect(stdout).toContain('package');
    });
  });

  describe('successful packaging', () => {
    it('packages a valid skill successfully', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { stdout, exitCode } = runCli(
        `package "${skillPath}" --output "${outputDir}" --skip-validation`
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Package created successfully');
      expect(stdout).toContain('.skill');

      // Verify package was created
      const files = await fs.readdir(outputDir);
      expect(files.some((f) => f.endsWith('.skill'))).toBe(true);
    });

    it('returns exit code 0 for successful package', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { exitCode } = runCli(
        `package "${skillPath}" --output "${outputDir}" --skip-validation`
      );

      expect(exitCode).toBe(0);
    });

    it('shows package details on success', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { stdout } = runCli(`package "${skillPath}" --output "${outputDir}" --skip-validation`);

      expect(stdout).toContain('Path:');
      expect(stdout).toContain('Files:');
      expect(stdout).toContain('Size:');
    });

    it('shows next steps on success', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { stdout } = runCli(`package "${skillPath}" --output "${outputDir}" --skip-validation`);

      expect(stdout).toContain('Next steps:');
      expect(stdout).toContain('asm install');
    });
  });

  describe('quiet mode', () => {
    it('produces minimal output with --quiet flag', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { stdout, exitCode } = runCli(
        `package "${skillPath}" --output "${outputDir}" --skip-validation --quiet`
      );

      expect(exitCode).toBe(0);
      // In quiet mode, should just output the package path
      expect(stdout.trim()).toContain('.skill');
      // Should NOT contain verbose output
      expect(stdout).not.toContain('Next steps:');
    });

    it('supports -q shorthand for --quiet', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { stdout, exitCode } = runCli(
        `package "${skillPath}" --output "${outputDir}" --skip-validation -q`
      );

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toContain('.skill');
    });
  });

  describe('force overwrite', () => {
    it('overwrites existing package with --force flag', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      // Create first package
      runCli(`package "${skillPath}" --output "${outputDir}" --skip-validation`);

      // Create second package with force
      const { exitCode } = runCli(
        `package "${skillPath}" --output "${outputDir}" --skip-validation --force`
      );

      expect(exitCode).toBe(0);
    });

    it('supports -f shorthand for --force', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      // Create first package
      runCli(`package "${skillPath}" --output "${outputDir}" --skip-validation`);

      // Create second package with force
      const { exitCode } = runCli(
        `package "${skillPath}" --output "${outputDir}" --skip-validation -f`
      );

      expect(exitCode).toBe(0);
    });
  });

  describe('validation integration', () => {
    it('runs validation by default', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { stdout, exitCode } = runCli(`package "${skillPath}" --output "${outputDir}"`);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Validating');
    });

    it('skips validation with --skip-validation flag', async () => {
      // Create an invalid skill
      const skillDir = path.join(tempDir, 'invalid-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: Invalid_Name
description: Has <invalid> brackets
---

# Invalid
`
      );

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      // Should succeed with --skip-validation
      const { exitCode } = runCli(
        `package "${skillDir}" --output "${outputDir}" --skip-validation`
      );

      expect(exitCode).toBe(0);
    });

    it('supports -s shorthand for --skip-validation', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { exitCode } = runCli(`package "${skillPath}" --output "${outputDir}" -s`);

      expect(exitCode).toBe(0);
    });

    it('fails with exit code 1 when validation fails', async () => {
      const skillPath = path.join(fixturesPath, 'missing-name');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { exitCode, stdout } = runCli(`package "${skillPath}" --output "${outputDir}"`, {
        expectSuccess: false,
      });

      expect(exitCode).toBe(1);
      expect(stdout).toContain('Skill validation failed');
    });
  });

  describe('error handling', () => {
    it('fails with exit code for non-existent path', () => {
      const { exitCode, stdout } = runCli('package "/path/that/does/not/exist"', {
        expectSuccess: false,
      });

      // Should be exit code 2 (FILE_SYSTEM_ERROR) per spec
      expect(exitCode).toBe(2);
      expect(stdout).toContain('Error:');
    });

    it('fails when path has no SKILL.md', async () => {
      const emptyDir = path.join(tempDir, 'empty-dir');
      await fs.mkdir(emptyDir);

      const { exitCode, stdout } = runCli(`package "${emptyDir}"`, {
        expectSuccess: false,
      });

      // Should be exit code 2 (FILE_SYSTEM_ERROR) per spec
      expect(exitCode).toBe(2);
      expect(stdout).toContain('SKILL.md');
    });

    it('shows clear error messages', async () => {
      const { stdout } = runCli('package "/nonexistent/path"', {
        expectSuccess: false,
      });

      // Normal mode shows Error: format
      expect(stdout).toContain('Error:');
      expect(stdout).toContain('does not exist');
    });

    it('handles quiet mode errors correctly', () => {
      const { stdout, exitCode } = runCli('package "/nonexistent/path" --quiet', {
        expectSuccess: false,
      });

      expect(exitCode).toBeGreaterThan(0);
      expect(stdout).toContain('FAIL');
    });
  });

  describe('output directory', () => {
    it('uses custom output directory with --output', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const customOutput = path.join(tempDir, 'custom-output');

      const { exitCode, stdout } = runCli(
        `package "${skillPath}" --output "${customOutput}" --skip-validation`
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain(customOutput);

      // Verify file exists in custom location
      const files = await fs.readdir(customOutput);
      expect(files.some((f) => f.endsWith('.skill'))).toBe(true);
    });

    it('supports -o shorthand for --output', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const customOutput = path.join(tempDir, 'custom-output');

      const { exitCode } = runCli(`package "${skillPath}" -o "${customOutput}" --skip-validation`);

      expect(exitCode).toBe(0);

      const files = await fs.readdir(customOutput);
      expect(files.some((f) => f.endsWith('.skill'))).toBe(true);
    });

    it('creates output directory if it does not exist', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const nestedOutput = path.join(tempDir, 'nested', 'path', 'output');

      const { exitCode } = runCli(
        `package "${skillPath}" --output "${nestedOutput}" --skip-validation`
      );

      expect(exitCode).toBe(0);

      const files = await fs.readdir(nestedOutput);
      expect(files.some((f) => f.endsWith('.skill'))).toBe(true);
    });
  });

  describe('package naming', () => {
    it('uses skill directory name for package name', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { stdout } = runCli(`package "${skillPath}" --output "${outputDir}" --skip-validation`);

      expect(stdout).toContain('valid-skill.skill');
    });

    it('handles SKILL.md path input correctly', async () => {
      const skillMdPath = path.join(fixturesPath, 'valid-skill', 'SKILL.md');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { exitCode, stdout } = runCli(
        `package "${skillMdPath}" --output "${outputDir}" --skip-validation`
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain('valid-skill.skill');
    });
  });

  describe('combined options', () => {
    it('handles multiple shorthand options together', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      const { exitCode, stdout } = runCli(`package "${skillPath}" -o "${outputDir}" -s -q`);

      expect(exitCode).toBe(0);
      // Quiet mode should just output path
      expect(stdout.trim()).toContain('.skill');
    });

    it('handles force and quiet together', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir);

      // Create first package
      runCli(`package "${skillPath}" -o "${outputDir}" -s`);

      // Force overwrite in quiet mode
      const { exitCode, stdout } = runCli(`package "${skillPath}" -o "${outputDir}" -s -f -q`);

      expect(exitCode).toBe(0);
      expect(stdout.trim()).toContain('.skill');
    });
  });
});
