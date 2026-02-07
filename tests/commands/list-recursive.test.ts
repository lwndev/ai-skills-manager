/**
 * CLI command tests for the list command with recursive options (FEAT-012 Phase 4)
 *
 * Tests the `asm list` command behavior with --recursive and --depth options.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('asm list --recursive command', () => {
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
  let tempDir: string;
  let originalCwd: string;

  beforeAll(async () => {
    // Ensure the CLI is built
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-list-recursive-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
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

  /**
   * Helper to create a skill directory with SKILL.md
   */
  async function createSkill(
    baseDir: string,
    name: string,
    options: { description?: string; version?: string } = {}
  ): Promise<string> {
    const skillDir = path.join(baseDir, name);
    await fs.mkdir(skillDir, { recursive: true });

    const metadata = options.version ? `\nmetadata:\n  version: ${options.version}` : '';
    const content = `---
name: ${name}
description: ${options.description || `Description for ${name}`}${metadata}
---

# ${name}
`;

    await fs.writeFile(path.join(skillDir, 'SKILL.md'), content);
    return skillDir;
  }

  /**
   * Helper to create .claude/skills directory
   */
  async function createSkillsDir(...pathParts: string[]): Promise<string> {
    const skillsDir = path.join(tempDir, ...pathParts, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    return skillsDir;
  }

  describe('help and usage', () => {
    it('displays help with --help flag including recursive options', () => {
      const { stdout } = runCli('list --help');

      expect(stdout).toContain('--recursive');
      expect(stdout).toContain('--depth');
      expect(stdout).toContain('Discover skills in nested .claude/skills directories');
      expect(stdout).toContain('Maximum depth for recursive discovery');
    });

    it('shows recursive examples in help', () => {
      const { stdout } = runCli('list --help');

      expect(stdout).toContain('asm list --recursive');
      expect(stdout).toContain('asm list --recursive --depth 2');
    });
  });

  describe('option parsing', () => {
    it('accepts -r short form for recursive', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'test-skill');

      const { stdout, exitCode } = runCli('list -r --scope project');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');
    });

    it('accepts --recursive long form', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'test-skill');

      const { stdout, exitCode } = runCli('list --recursive --scope project');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');
    });

    it('accepts -d short form for depth', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'test-skill');

      const { stdout, exitCode } = runCli('list -r -d 1 --scope project');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');
    });

    it('accepts --depth long form', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'test-skill');

      const { stdout, exitCode } = runCli('list --recursive --depth 1 --scope project');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('test-skill');
    });
  });

  describe('depth validation', () => {
    it('rejects depth less than 0', () => {
      const { stderr, exitCode } = runCli('list --recursive --depth -1 --scope project', {
        expectSuccess: false,
      });

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid depth');
    });

    it('rejects depth greater than 10', () => {
      const { stderr, exitCode } = runCli('list --recursive --depth 11 --scope project', {
        expectSuccess: false,
      });

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid depth');
    });

    it('rejects non-numeric depth', () => {
      const { stderr, exitCode } = runCli('list --recursive --depth abc --scope project', {
        expectSuccess: false,
      });

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Invalid depth');
    });

    it('accepts depth of 0', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'test-skill');

      const { exitCode } = runCli('list --recursive --depth 0 --scope project');

      expect(exitCode).toBe(0);
    });

    it('accepts depth of 10', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'test-skill');

      const { exitCode } = runCli('list --recursive --depth 10 --scope project');

      expect(exitCode).toBe(0);
    });
  });

  describe('recursive discovery output', () => {
    it('shows root skills without location prefix', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill', { description: 'Root skill' });

      const { stdout } = runCli('list --recursive --scope project');

      expect(stdout).toContain('root-skill');
      expect(stdout).toContain('Root skill');
      expect(stdout).toContain('.claude/skills');
    });

    it('shows nested skills with location in group header', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const nestedSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(nestedSkillsDir, 'api-helpers');

      const { stdout } = runCli('list --recursive --scope project');

      expect(stdout).toContain('root-skill');
      expect(stdout).toContain('api-helpers');
      // Check for location in header
      expect(stdout).toContain('packages/api/.claude/skills');
    });

    it('groups skills by location', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-1');
      await createSkill(rootSkillsDir, 'root-2');

      const apiSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(apiSkillsDir, 'api-1');
      await createSkill(apiSkillsDir, 'api-2');

      const { stdout } = runCli('list --recursive --scope project');

      // Both root skills should be under one header
      expect(stdout).toContain('root-1');
      expect(stdout).toContain('root-2');

      // Both api skills should be under one header
      expect(stdout).toContain('api-1');
      expect(stdout).toContain('api-2');
    });
  });

  describe('JSON output with location', () => {
    it('includes location field in JSON output for nested skills', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill', { version: '1.0.0' });

      const nestedSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(nestedSkillsDir, 'nested-skill', { version: '2.0.0' });

      const { stdout } = runCli('list --recursive --scope project --json');

      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('depthLimitReached');
      expect(result.skills).toHaveLength(2);

      const rootSkill = result.skills.find((s: { name: string }) => s.name === 'root-skill');
      expect(rootSkill.location).toBeUndefined();

      const nestedSkill = result.skills.find((s: { name: string }) => s.name === 'nested-skill');
      expect(nestedSkill.location).toBeDefined();
      expect(nestedSkill.location).toContain('packages/api/.claude/skills');
    });

    it('outputs plain array without --recursive', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const { stdout } = runCli('list --scope project --json');

      const result = JSON.parse(stdout);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('root-skill');
    });

    it('includes depthLimitReached: false when limit not reached', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const { stdout } = runCli('list --recursive --scope project --json');

      const result = JSON.parse(stdout);
      expect(result.depthLimitReached).toBe(false);
    });

    it('includes depthLimitReached: true when limit is reached', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'depth-0');

      const level1Dir = await createSkillsDir('level1');
      await createSkill(level1Dir, 'depth-1');

      const level2Dir = await createSkillsDir('level1', 'level2');
      await createSkill(level2Dir, 'depth-2');

      const { stdout } = runCli('list --recursive --depth 1 --scope project --json');

      const result = JSON.parse(stdout);
      expect(result.depthLimitReached).toBe(true);
      // depth-2 should not be included since depth limit is 1
      const names = result.skills.map((s: { name: string }) => s.name);
      expect(names).toContain('depth-0');
      expect(names).toContain('depth-1');
      expect(names).not.toContain('depth-2');
    });
  });

  describe('quiet mode with recursive', () => {
    it('outputs only skill names in quiet mode', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const nestedSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(nestedSkillsDir, 'nested-skill');

      const { stdout } = runCli('list --recursive --scope project --quiet');

      const lines = stdout.trim().split('\n');
      expect(lines).toContain('root-skill');
      expect(lines).toContain('nested-skill');
      // Should not contain location or other info
      expect(stdout).not.toContain('.claude/skills');
    });
  });

  describe('depth limiting', () => {
    it('depth 0 only shows root skills', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const nestedSkillsDir = await createSkillsDir('level1');
      await createSkill(nestedSkillsDir, 'nested-skill');

      const { stdout } = runCli('list --recursive --depth 0 --scope project');

      expect(stdout).toContain('root-skill');
      expect(stdout).not.toContain('nested-skill');
    });

    it('depth 1 shows root and first level', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'depth-0');

      const level1Dir = await createSkillsDir('level1');
      await createSkill(level1Dir, 'depth-1');

      const level2Dir = await createSkillsDir('level1', 'level2');
      await createSkill(level2Dir, 'depth-2');

      const { stdout } = runCli('list --recursive --depth 1 --scope project');

      expect(stdout).toContain('depth-0');
      expect(stdout).toContain('depth-1');
      expect(stdout).not.toContain('depth-2');
    });
  });

  describe('non-recursive mode', () => {
    it('does not show nested skills without --recursive', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const nestedSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(nestedSkillsDir, 'nested-skill');

      const { stdout } = runCli('list --scope project');

      expect(stdout).toContain('root-skill');
      expect(stdout).not.toContain('nested-skill');
    });
  });

  describe('empty results', () => {
    it('shows no skills message when recursive finds nothing', async () => {
      // No skills directories created

      const { stdout } = runCli('list --recursive --scope project');

      expect(stdout).toContain('No skills installed');
    });
  });

  describe('depth limit warning', () => {
    it('shows warning when depth limit prevents scanning subdirectories', async () => {
      // Create skills at depths 0, 1, 2
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'depth-0');

      const level1Dir = await createSkillsDir('level1');
      await createSkill(level1Dir, 'depth-1');

      // Create a directory at depth 2 that would be skipped with depth 1
      const level2Dir = await createSkillsDir('level1', 'level2');
      await createSkill(level2Dir, 'depth-2');

      // Depth 1 should trigger warning because level2 exists
      const { stdout } = runCli('list --recursive --depth 1 --scope project');

      expect(stdout).toContain('Some directories were not scanned due to depth limit');
      expect(stdout).toContain('--depth 2');
    });

    it('does not show warning when all directories are scanned', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'depth-0');

      const level1Dir = await createSkillsDir('level1');
      await createSkill(level1Dir, 'depth-1');

      // Depth 2 should be enough to scan everything
      const { stdout } = runCli('list --recursive --depth 2 --scope project');

      expect(stdout).not.toContain('Some directories were not scanned due to depth limit');
    });

    it('does not show warning in JSON mode', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'depth-0');

      const level1Dir = await createSkillsDir('level1');
      await createSkill(level1Dir, 'depth-1');

      const level2Dir = await createSkillsDir('level1', 'level2');
      await createSkill(level2Dir, 'depth-2');

      const { stdout } = runCli('list --recursive --depth 1 --scope project --json');

      // JSON output should be valid JSON, not contain the warning text
      expect(stdout).not.toContain('Some directories were not scanned');
      const result = JSON.parse(stdout);
      expect(result).toHaveProperty('skills');
      expect(result.depthLimitReached).toBe(true);
    });

    it('does not show warning in quiet mode', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'depth-0');

      const level1Dir = await createSkillsDir('level1');
      await createSkill(level1Dir, 'depth-1');

      const level2Dir = await createSkillsDir('level1', 'level2');
      await createSkill(level2Dir, 'depth-2');

      const { stdout } = runCli('list --recursive --depth 1 --scope project --quiet');

      expect(stdout).not.toContain('Some directories were not scanned');
    });

    it('does not show warning when not using recursive mode', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'depth-0');

      // Nested directories exist but not using --recursive
      const level1Dir = await createSkillsDir('level1');
      await createSkill(level1Dir, 'depth-1');

      const { stdout } = runCli('list --scope project');

      expect(stdout).not.toContain('Some directories were not scanned');
    });
  });
});
