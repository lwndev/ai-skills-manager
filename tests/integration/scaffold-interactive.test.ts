/**
 * Integration tests for the interactive scaffold workflow (FEAT-019 Phase 3)
 *
 * Tests interactive-specific CLI behavior (non-TTY error, flag conflict precedence)
 * via real CLI invocations. Also validates scaffold output for all template types
 * as a baseline — the interactive prompt flow itself is tested via unit tests
 * with mocked prompts since integration tests cannot simulate a real TTY.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('scaffold --interactive integration', () => {
  let tempDir: string;
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');

  beforeAll(async () => {
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-interactive-integration-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('non-TTY environment', () => {
    it('produces error and exit code 1 when stdin is not a TTY', () => {
      let exitCode = 0;
      let stderr = '';
      try {
        // Pipe input to force non-TTY
        execSync(
          `echo "" | node "${cliPath}" scaffold test-skill --output "${tempDir}" --interactive`,
          {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );
      } catch (error) {
        const execError = error as { status: number; stderr?: string; stdout?: string };
        exitCode = execError.status;
        stderr = (execError.stderr ?? '') + (execError.stdout ?? '');
      }

      expect(exitCode).toBe(1);
      expect(stderr).toContain('--interactive requires a TTY');
    });
  });

  describe('flag conflict precedence', () => {
    it('non-TTY error takes precedence over flag conflict warning', () => {
      let output = '';
      try {
        // In non-TTY the TTY check fires before the flag conflict warning.
        // The flag conflict warning path is covered by unit tests with a mocked TTY.
        execSync(
          `echo "" | node "${cliPath}" scaffold test-skill --output "${tempDir}" --interactive --template forked`,
          {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );
      } catch (error) {
        const execError = error as { status: number; stderr?: string; stdout?: string };
        output = (execError.stderr ?? '') + (execError.stdout ?? '');
      }

      // In non-TTY, the TTY check fires first before flag check
      expect(output).toContain('--interactive requires a TTY');
    });
  });

  describe('scaffold output baseline (reference for interactive equivalence)', () => {
    it('explicit-flag scaffold produces valid skill directory', async () => {
      execSync(
        `node "${cliPath}" scaffold basic-skill --output "${tempDir}" --template basic --force`,
        { encoding: 'utf-8' }
      );

      const skillPath = path.join(tempDir, 'basic-skill');
      await expect(fs.access(path.join(skillPath, 'SKILL.md'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(skillPath, 'scripts', '.gitkeep'))).resolves.toBeUndefined();
    });

    it('explicit-flag agent scaffold produces valid skill', async () => {
      execSync(
        `node "${cliPath}" scaffold agent-skill --output "${tempDir}" --template agent --memory project --model sonnet --force`,
        { encoding: 'utf-8' }
      );

      const skillPath = path.join(tempDir, 'agent-skill');
      const content = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');

      expect(content).toContain('name: agent-skill');
      expect(content).toContain('memory: project');
      expect(content).toContain('model: sonnet');
    });

    it('generated skill passes asm validate', async () => {
      execSync(
        `node "${cliPath}" scaffold valid-skill --output "${tempDir}" --description "A test skill" --force`,
        { encoding: 'utf-8' }
      );

      const skillPath = path.join(tempDir, 'valid-skill');
      const result = execSync(`node "${cliPath}" validate "${skillPath}"`, {
        encoding: 'utf-8',
      });

      expect(result).toContain('valid');
    });

    it('agent skill passes asm validate', async () => {
      execSync(
        `node "${cliPath}" scaffold agent-valid --output "${tempDir}" --template agent --memory project --model sonnet --description "Agent skill" --force`,
        { encoding: 'utf-8' }
      );

      const skillPath = path.join(tempDir, 'agent-valid');
      const result = execSync(`node "${cliPath}" validate "${skillPath}"`, {
        encoding: 'utf-8',
      });

      expect(result).toContain('valid');
    });

    it('forked skill with hooks passes asm validate', async () => {
      execSync(
        `node "${cliPath}" scaffold forked-hooks --output "${tempDir}" --template forked --hooks --description "Forked with hooks" --force`,
        { encoding: 'utf-8' }
      );

      const skillPath = path.join(tempDir, 'forked-hooks');
      const result = execSync(`node "${cliPath}" validate "${skillPath}"`, {
        encoding: 'utf-8',
      });

      expect(result).toContain('valid');
    });
  });

  describe('output-location flags (respected alongside --interactive)', () => {
    it('--output flag places skill in specified directory', async () => {
      const customDir = path.join(tempDir, 'custom');
      await fs.mkdir(customDir, { recursive: true });

      execSync(`node "${cliPath}" scaffold output-skill --output "${customDir}" --force`, {
        encoding: 'utf-8',
      });

      const skillPath = path.join(customDir, 'output-skill');
      await expect(fs.access(path.join(skillPath, 'SKILL.md'))).resolves.toBeUndefined();
    });

    it('--project flag creates skill in .claude/skills/', async () => {
      const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-project-int-'));

      try {
        execSync(`node "${cliPath}" scaffold proj-int-skill --project --force`, {
          encoding: 'utf-8',
          cwd: projectDir,
        });

        const skillPath = path.join(projectDir, '.claude', 'skills', 'proj-int-skill');
        await expect(fs.access(path.join(skillPath, 'SKILL.md'))).resolves.toBeUndefined();
      } finally {
        await fs.rm(projectDir, { recursive: true, force: true });
      }
    });

    it('--force overwrites existing skill directory', async () => {
      // Create skill first
      execSync(
        `node "${cliPath}" scaffold force-skill --output "${tempDir}" --description "Original" --force`,
        { encoding: 'utf-8' }
      );

      // Overwrite with --force
      execSync(
        `node "${cliPath}" scaffold force-skill --output "${tempDir}" --description "Updated" --force`,
        { encoding: 'utf-8' }
      );

      const skillPath = path.join(tempDir, 'force-skill');
      const content = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
      expect(content).toContain('description: Updated');
    });
  });

  describe('all template types produce valid skills', () => {
    it.each([
      ['basic', {}],
      ['forked', { template: 'forked' }],
      ['with-hooks', { template: 'with-hooks' }],
      ['internal', { template: 'internal' }],
      ['agent', { template: 'agent', memory: 'project', model: 'sonnet' }],
    ] as [string, Record<string, string>][])(
      '%s template produces valid skill that passes validate',
      async (templateName, extraFlags) => {
        const flags = Object.entries(extraFlags)
          .map(([key, value]) => `--${key} ${value}`)
          .join(' ');

        const skillName = `${templateName}-equiv`;
        execSync(`node "${cliPath}" scaffold ${skillName} --output "${tempDir}" ${flags} --force`, {
          encoding: 'utf-8',
        });

        const skillPath = path.join(tempDir, skillName);
        await expect(fs.access(path.join(skillPath, 'SKILL.md'))).resolves.toBeUndefined();

        const result = execSync(`node "${cliPath}" validate "${skillPath}"`, {
          encoding: 'utf-8',
        });
        expect(result).toContain('valid');
      }
    );
  });
});
