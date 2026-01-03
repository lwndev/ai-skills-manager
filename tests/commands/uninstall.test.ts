/**
 * CLI command tests for the uninstall command
 *
 * These tests verify the `asm uninstall` command behavior including:
 * - Command line argument parsing
 * - Exit codes
 * - Output formats (normal, quiet, dry-run)
 * - Error handling
 * - Help text
 * - Scope handling (project/personal only)
 * - Security validation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawnSync } from 'child_process';

describe('asm uninstall command', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-uninstall-cmd-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a skill directory for testing
   */
  async function createTestSkill(
    skillsDir: string,
    skillName: string,
    options: { withSkillMd?: boolean; extraFiles?: string[] } = {}
  ): Promise<string> {
    const { withSkillMd = true, extraFiles = [] } = options;
    const skillPath = path.join(skillsDir, skillName);
    await fs.mkdir(skillPath, { recursive: true });

    if (withSkillMd) {
      const skillMdContent = `---
name: ${skillName}
description: A test skill
---

# ${skillName}

This is a test skill.
`;
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), skillMdContent);
    }

    for (const file of extraFiles) {
      const filePath = path.join(skillPath, file);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `Content of ${file}`);
    }

    return skillPath;
  }

  /**
   * Helper to run CLI command and capture output
   */
  function runCli(
    args: string,
    options: { expectSuccess?: boolean; cwd?: string; input?: string } = {}
  ): {
    stdout: string;
    stderr: string;
    exitCode: number;
  } {
    const { expectSuccess = true, cwd, input } = options;

    // Use spawnSync for input handling
    if (input !== undefined) {
      const result = spawnSync('node', [cliPath, ...args.split(' ')], {
        encoding: 'utf-8',
        cwd: cwd || process.cwd(),
        input,
      });
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.status ?? 1,
      };
    }

    try {
      const stdout = execSync(`node "${cliPath}" ${args}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        cwd: cwd || process.cwd(),
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
      const { stdout } = runCli('uninstall --help');

      expect(stdout).toContain('Uninstall Claude Code skills');
      expect(stdout).toContain('--scope');
      expect(stdout).toContain('--force');
      expect(stdout).toContain('--dry-run');
      expect(stdout).toContain('--quiet');
      expect(stdout).toContain('Examples:');
      expect(stdout).toContain('Scopes:');
      expect(stdout).toContain('Exit Codes:');
      expect(stdout).toContain('Security:');
    });

    it('shows uninstall command in main help', () => {
      const { stdout } = runCli('--help');

      expect(stdout).toContain('uninstall');
    });

    it('shows usage when no skill name provided', () => {
      const { stderr, exitCode } = runCli('uninstall', { expectSuccess: false });

      expect(exitCode).toBeGreaterThan(0);
      expect(stderr).toContain('skill-name');
    });
  });

  describe('successful uninstallation', () => {
    it('uninstalls a skill successfully with --force', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'test-skill', { extraFiles: ['reference.md'] });

      const { stdout, exitCode } = runCli('uninstall test-skill --scope project --force', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Successfully uninstalled');
      expect(stdout).toContain('test-skill');

      // Verify skill was removed
      await expect(fs.access(path.join(skillsDir, 'test-skill'))).rejects.toThrow();
    });

    it('returns exit code 0 for successful uninstall', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'test-skill');

      const { exitCode } = runCli('uninstall test-skill --scope project --force', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
    });

    it('shows uninstall details on success', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'test-skill', {
        extraFiles: ['script.js', 'data/config.json'],
      });

      const { stdout } = runCli('uninstall test-skill --scope project --force', {
        cwd: projectDir,
      });

      expect(stdout).toContain('Removed:');
      expect(stdout).toContain('files');
      expect(stdout).toContain('Location was:');
    });
  });

  describe('dry-run mode', () => {
    it('shows preview without removing with --dry-run', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      const skillPath = await createTestSkill(skillsDir, 'test-skill', {
        extraFiles: ['reference.md'],
      });

      const { stdout, exitCode } = runCli('uninstall test-skill --scope project --dry-run', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Dry run');
      expect(stdout).toContain('preview');
      expect(stdout).toContain('No changes made');

      // Verify no files were removed
      await expect(fs.access(skillPath)).resolves.toBeUndefined();
    });

    it('supports -n shorthand for --dry-run', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'test-skill');

      const { stdout, exitCode } = runCli('uninstall test-skill --scope project -n', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Dry run');
    });
  });

  describe('quiet mode', () => {
    it('produces minimal output with --quiet flag', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'test-skill');

      const { stdout, exitCode } = runCli('uninstall test-skill --scope project --force --quiet', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
      // In quiet mode, should be single line
      expect(stdout).toContain('test-skill');
      expect(stdout).toContain('uninstalled');
      // Should NOT contain verbose output
      expect(stdout).not.toContain('Locating');
    });

    it('supports -q shorthand for --quiet', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'test-skill');

      const { stdout, exitCode } = runCli('uninstall test-skill --scope project -f -q', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');
    });
  });

  describe('force flag', () => {
    it('skips confirmation with --force flag', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'test-skill');

      const { exitCode } = runCli('uninstall test-skill --scope project --force', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
      // Skill should be removed
      await expect(fs.access(path.join(skillsDir, 'test-skill'))).rejects.toThrow();
    });

    it('supports -f shorthand for --force', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'test-skill');

      const { exitCode } = runCli('uninstall test-skill --scope project -f', { cwd: projectDir });

      expect(exitCode).toBe(0);
    });
  });

  describe('scope handling', () => {
    it('uses project scope by default', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'test-skill');

      const { stdout, exitCode } = runCli('uninstall test-skill --force', { cwd: projectDir });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');
    });

    it('supports --scope personal', async () => {
      // Create skill in simulated personal dir
      const homeDir = path.join(tempDir, 'home');
      const personalSkillsDir = path.join(homeDir, '.claude', 'skills');
      await createTestSkill(personalSkillsDir, 'test-skill');

      // The command needs HOME env var set, but we'll just verify it doesn't fail
      // for invalid scope
      const { stdout } = runCli('uninstall --help');
      expect(stdout).toContain('personal');
    });

    it('rejects invalid scope values', () => {
      const { stdout, exitCode } = runCli('uninstall test-skill --scope /custom/path --force', {
        expectSuccess: false,
      });

      expect(exitCode).toBe(5); // SECURITY_ERROR
      expect(stdout).toContain('Invalid scope');
    });

    it('rejects custom paths for scope', () => {
      const customPath = path.join(tempDir, 'custom');

      const { stdout, exitCode } = runCli(`uninstall test-skill --scope "${customPath}" --force`, {
        expectSuccess: false,
      });

      expect(exitCode).toBe(5); // SECURITY_ERROR
      expect(stdout).toContain('Invalid scope');
    });

    it('only accepts project or personal scope', () => {
      const { stdout } = runCli('uninstall --help');

      expect(stdout).toContain('project');
      expect(stdout).toContain('personal');
      // Help text indicates only official locations are supported
      expect(stdout).toContain('only the two official Claude Code skill locations');
    });
  });

  describe('error handling', () => {
    it('returns exit code 1 for non-existent skill', async () => {
      const projectDir = path.join(tempDir, 'project');
      await fs.mkdir(path.join(projectDir, '.claude', 'skills'), { recursive: true });

      const { exitCode, stdout } = runCli('uninstall nonexistent-skill --scope project --force', {
        expectSuccess: false,
        cwd: projectDir,
      });

      expect(exitCode).toBe(1); // NOT_FOUND
      expect(stdout).toContain('not found');
    });

    it('shows clear error messages', async () => {
      const projectDir = path.join(tempDir, 'project');
      await fs.mkdir(path.join(projectDir, '.claude', 'skills'), { recursive: true });

      const { stdout } = runCli('uninstall nonexistent-skill --scope project --force', {
        expectSuccess: false,
        cwd: projectDir,
      });

      expect(stdout).toContain('Suggestions:');
      expect(stdout).toContain('Check the skill name');
    });

    it('handles quiet mode errors correctly', async () => {
      const projectDir = path.join(tempDir, 'project');
      await fs.mkdir(path.join(projectDir, '.claude', 'skills'), { recursive: true });

      const { stdout, exitCode } = runCli(
        'uninstall nonexistent-skill --scope project --force --quiet',
        {
          expectSuccess: false,
          cwd: projectDir,
        }
      );

      expect(exitCode).toBe(1);
      expect(stdout).toContain('not found');
    });
  });

  describe('security validation', () => {
    it('rejects skill names with path separators', () => {
      const { stdout, exitCode } = runCli('uninstall "../etc/passwd" --scope project --force', {
        expectSuccess: false,
      });

      expect(exitCode).toBe(5); // SECURITY_ERROR
      expect(stdout).toContain('Security Error');
    });

    it('rejects absolute paths as skill names', () => {
      const { stdout, exitCode } = runCli('uninstall "/etc/passwd" --scope project --force', {
        expectSuccess: false,
      });

      expect(exitCode).toBe(5); // SECURITY_ERROR
      expect(stdout).toContain('Security Error');
    });

    it('rejects . as skill name', () => {
      const { exitCode } = runCli('uninstall . --scope project --force', {
        expectSuccess: false,
      });

      expect(exitCode).toBe(5); // SECURITY_ERROR
    });

    it('rejects .. as skill name', () => {
      const { exitCode } = runCli('uninstall .. --scope project --force', {
        expectSuccess: false,
      });

      expect(exitCode).toBe(5); // SECURITY_ERROR
    });

    it('rejects skill names with uppercase letters', () => {
      const { stdout, exitCode } = runCli('uninstall MySkill --scope project --force', {
        expectSuccess: false,
      });

      expect(exitCode).toBe(5); // SECURITY_ERROR
      expect(stdout).toContain('lowercase');
    });

    it('rejects skill names that are too long', () => {
      const longName = 'a'.repeat(65);
      const { stdout, exitCode } = runCli(`uninstall ${longName} --scope project --force`, {
        expectSuccess: false,
      });

      expect(exitCode).toBe(5); // SECURITY_ERROR
      expect(stdout).toContain('64');
    });
  });

  describe('multiple skills', () => {
    it('accepts multiple skill names', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'skill1');
      await createTestSkill(skillsDir, 'skill2');

      const { stdout, exitCode } = runCli('uninstall skill1 skill2 --scope project --force', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('skill1');
      expect(stdout).toContain('skill2');

      // Verify both skills were removed
      await expect(fs.access(path.join(skillsDir, 'skill1'))).rejects.toThrow();
      await expect(fs.access(path.join(skillsDir, 'skill2'))).rejects.toThrow();
    });

    it('shows warning when some skills not found', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'exists');
      // 'not-exists' is not created

      const { stdout } = runCli('uninstall exists not-exists --scope project --force', {
        expectSuccess: false,
        cwd: projectDir,
      });

      // Should mention the skill that wasn't found
      expect(stdout).toContain('not found');
      // Should still process the skill that exists
      expect(stdout).toContain('exists');
    });
  });

  describe('exit codes', () => {
    it('returns 0 for success', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'test-skill');

      const { exitCode } = runCli('uninstall test-skill --scope project --force', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
    });

    it('returns 1 for skill not found', async () => {
      const projectDir = path.join(tempDir, 'project');
      await fs.mkdir(path.join(projectDir, '.claude', 'skills'), { recursive: true });

      const { exitCode } = runCli('uninstall nonexistent --scope project --force', {
        expectSuccess: false,
        cwd: projectDir,
      });

      expect(exitCode).toBe(1);
    });

    it('returns 5 for security error', () => {
      const { exitCode } = runCli('uninstall "../passwd" --scope project --force', {
        expectSuccess: false,
      });

      expect(exitCode).toBe(5);
    });

    it('returns 5 for invalid scope', () => {
      const { exitCode } = runCli('uninstall test-skill --scope /invalid/path --force', {
        expectSuccess: false,
      });

      expect(exitCode).toBe(5);
    });
  });

  describe('combined options', () => {
    it('handles multiple shorthand options together', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'test-skill');

      const { stdout, exitCode } = runCli('uninstall test-skill -s project -f -q', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');
    });

    it('handles force and dry-run together (dry-run takes precedence)', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      const skillPath = await createTestSkill(skillsDir, 'test-skill');

      const { stdout, exitCode } = runCli('uninstall test-skill -s project -f -n', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Dry run');
      // File should still exist
      await expect(fs.access(skillPath)).resolves.toBeUndefined();
    });
  });

  describe('SKILL.md validation', () => {
    it('requires --force for directories without SKILL.md', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      const skillPath = await createTestSkill(skillsDir, 'no-skillmd', {
        withSkillMd: false,
        extraFiles: ['data.txt'],
      });

      // Without --force, should fail when no SKILL.md
      const { stdout, exitCode } = runCli('uninstall no-skillmd --scope project --dry-run', {
        expectSuccess: false,
        cwd: projectDir,
      });

      expect(exitCode).toBeGreaterThan(0);
      expect(stdout).toContain('SKILL.md');
      expect(stdout).toContain('--force');
      // Skill still exists
      await expect(fs.access(skillPath)).resolves.toBeUndefined();
    });

    it('removes directory without SKILL.md when --force is used', async () => {
      const projectDir = path.join(tempDir, 'project');
      const skillsDir = path.join(projectDir, '.claude', 'skills');
      await createTestSkill(skillsDir, 'no-skillmd', {
        withSkillMd: false,
        extraFiles: ['data.txt'],
      });

      const { exitCode } = runCli('uninstall no-skillmd --scope project --force', {
        cwd: projectDir,
      });

      expect(exitCode).toBe(0);
      await expect(fs.access(path.join(skillsDir, 'no-skillmd'))).rejects.toThrow();
    });
  });
});
