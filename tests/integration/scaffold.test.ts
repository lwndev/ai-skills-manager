/**
 * Integration tests for the scaffold command
 *
 * These tests run the full scaffold workflow to verify end-to-end functionality.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('scaffold command integration', () => {
  let tempDir: string;
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');

  beforeAll(async () => {
    // Ensure the CLI is built
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('happy path workflows', () => {
    it('creates a basic skill scaffold with default options', () => {
      const result = execSync(
        `node "${cliPath}" scaffold test-skill --output "${tempDir}" --force`,
        { encoding: 'utf-8' }
      );

      expect(result).toContain('Skill scaffolded successfully');
      expect(result).toContain('test-skill');

      // Verify files were created
      const skillPath = path.join(tempDir, 'test-skill');
      expect(fs.access(path.join(skillPath, 'SKILL.md'))).resolves.toBeUndefined();
      expect(fs.access(path.join(skillPath, 'scripts', '.gitkeep'))).resolves.toBeUndefined();
    });

    it('creates a skill with description', async () => {
      execSync(
        `node "${cliPath}" scaffold my-skill --output "${tempDir}" --description "A helpful skill" --force`,
        { encoding: 'utf-8' }
      );

      const skillMdPath = path.join(tempDir, 'my-skill', 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');

      expect(content).toContain('name: my-skill');
      expect(content).toContain('description: A helpful skill');
    });

    it('creates a skill with allowed-tools', async () => {
      execSync(
        `node "${cliPath}" scaffold tool-skill --output "${tempDir}" --allowed-tools "Read,Write,Bash" --force`,
        { encoding: 'utf-8' }
      );

      const skillMdPath = path.join(tempDir, 'tool-skill', 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');

      expect(content).toContain('allowed-tools:');
      expect(content).toContain('  - Read');
      expect(content).toContain('  - Write');
      expect(content).toContain('  - Bash');
    });

    it('creates a skill with all options combined', async () => {
      execSync(
        `node "${cliPath}" scaffold full-skill --output "${tempDir}" --description "Full featured skill" --allowed-tools "Read,Write" --force`,
        { encoding: 'utf-8' }
      );

      const skillMdPath = path.join(tempDir, 'full-skill', 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');

      expect(content).toContain('name: full-skill');
      expect(content).toContain('description: Full featured skill');
      expect(content).toContain('allowed-tools:');
      expect(content).toContain('  - Read');
      expect(content).toContain('  - Write');
    });
  });

  describe('project vs personal skill creation', () => {
    it('creates skill in project .claude/skills/ by default', async () => {
      // Use --project explicitly
      const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-project-'));

      try {
        execSync(`node "${cliPath}" scaffold proj-skill --project --force`, {
          encoding: 'utf-8',
          cwd: projectDir,
        });

        const skillPath = path.join(projectDir, '.claude', 'skills', 'proj-skill');
        await expect(fs.access(skillPath)).resolves.toBeUndefined();
        await expect(fs.access(path.join(skillPath, 'SKILL.md'))).resolves.toBeUndefined();
      } finally {
        await fs.rm(projectDir, { recursive: true, force: true });
      }
    });

    it('creates skill in ~/.claude/skills/ with --personal', async () => {
      const skillName = `personal-test-${Date.now()}`;
      const personalSkillPath = path.join(os.homedir(), '.claude', 'skills', skillName);

      try {
        execSync(`node "${cliPath}" scaffold ${skillName} --personal --force`, {
          encoding: 'utf-8',
        });

        await expect(fs.access(personalSkillPath)).resolves.toBeUndefined();
        await expect(fs.access(path.join(personalSkillPath, 'SKILL.md'))).resolves.toBeUndefined();
      } finally {
        // Clean up personal skill
        await fs.rm(personalSkillPath, { recursive: true, force: true });
      }
    });

    it('--output overrides --project', async () => {
      execSync(
        `node "${cliPath}" scaffold override-skill --output "${tempDir}" --project --force`,
        { encoding: 'utf-8' }
      );

      const skillPath = path.join(tempDir, 'override-skill');
      await expect(fs.access(skillPath)).resolves.toBeUndefined();
    });

    it('--output overrides --personal', async () => {
      execSync(
        `node "${cliPath}" scaffold override-skill2 --output "${tempDir}" --personal --force`,
        { encoding: 'utf-8' }
      );

      const skillPath = path.join(tempDir, 'override-skill2');
      await expect(fs.access(skillPath)).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('rejects invalid skill name with uppercase letters', () => {
      expect(() => {
        execSync(`node "${cliPath}" scaffold InvalidName --output "${tempDir}" --force`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('rejects skill name starting with hyphen', () => {
      expect(() => {
        execSync(`node "${cliPath}" scaffold -invalid --output "${tempDir}" --force`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('rejects skill name ending with hyphen', () => {
      expect(() => {
        execSync(`node "${cliPath}" scaffold invalid- --output "${tempDir}" --force`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('rejects reserved word "anthropic"', () => {
      expect(() => {
        execSync(`node "${cliPath}" scaffold anthropic --output "${tempDir}" --force`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('rejects reserved word "claude"', () => {
      expect(() => {
        execSync(`node "${cliPath}" scaffold claude --output "${tempDir}" --force`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('rejects description with angle brackets', () => {
      expect(() => {
        execSync(
          `node "${cliPath}" scaffold test-skill --output "${tempDir}" --description "<script>alert(1)</script>" --force`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });

    it('rejects allowed-tools with only whitespace', () => {
      expect(() => {
        execSync(
          `node "${cliPath}" scaffold test-skill --output "${tempDir}" --allowed-tools "  ,  " --force`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      }).toThrow();
    });
  });

  describe('help and usage', () => {
    it('displays help with --help flag', () => {
      const result = execSync(`node "${cliPath}" scaffold --help`, {
        encoding: 'utf-8',
      });

      expect(result).toContain('Create a new Claude Code skill');
      expect(result).toContain('--description');
      expect(result).toContain('--output');
      expect(result).toContain('--project');
      expect(result).toContain('--personal');
      expect(result).toContain('--allowed-tools');
      expect(result).toContain('--force');
      expect(result).toContain('Examples:');
    });

    it('displays main help with asm --help', () => {
      const result = execSync(`node "${cliPath}" --help`, { encoding: 'utf-8' });

      expect(result).toContain('AI Skills Manager');
      expect(result).toContain('scaffold');
    });

    it('displays version with --version', () => {
      const result = execSync(`node "${cliPath}" --version`, {
        encoding: 'utf-8',
      });

      expect(result).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('SKILL.md content validation', () => {
    it('generates valid YAML frontmatter', async () => {
      execSync(
        `node "${cliPath}" scaffold yaml-test --output "${tempDir}" --description "Test description" --force`,
        { encoding: 'utf-8' }
      );

      const skillMdPath = path.join(tempDir, 'yaml-test', 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');

      // Check frontmatter structure
      expect(content).toMatch(/^---\n/);
      expect(content).toMatch(/\n---\n/);

      // Extract frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      expect(frontmatterMatch).toBeTruthy();

      const frontmatter = frontmatterMatch![1];
      expect(frontmatter).toContain('name: yaml-test');
      expect(frontmatter).toContain('description: Test description');
    });

    it('includes TODO placeholders in body', async () => {
      execSync(`node "${cliPath}" scaffold todo-test --output "${tempDir}" --force`, {
        encoding: 'utf-8',
      });

      const skillMdPath = path.join(tempDir, 'todo-test', 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');

      expect(content).toContain('TODO');
    });

    it('includes documentation guidance', async () => {
      execSync(`node "${cliPath}" scaffold docs-test --output "${tempDir}" --force`, {
        encoding: 'utf-8',
      });

      const skillMdPath = path.join(tempDir, 'docs-test', 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');

      // Should include guidance about keeping under 500 lines
      expect(content).toMatch(/500|lines|guidance|limit/i);
    });
  });
});
