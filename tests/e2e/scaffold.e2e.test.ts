/**
 * E2E tests for the scaffold command.
 */

import * as fs from 'fs/promises';
import { CLI_PATH, runCli, scaffoldSkill, createTempDir, cleanupDir } from './helpers';

describe('scaffold e2e', () => {
  let tempDir: string;

  beforeAll(async () => {
    await fs.access(CLI_PATH);
  });

  beforeEach(async () => {
    tempDir = await createTempDir('scaffold-e2e-');
  });

  afterEach(async () => {
    await cleanupDir(tempDir);
  });

  // ── 1.2 Template types ──────────────────────────────────────────────

  describe('template types', () => {
    it('scaffolds a basic template (default)', async () => {
      const { result, skillDir } = scaffoldSkill('test-basic', tempDir, '-t basic');
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('name: test-basic');
      expect(content).not.toContain('context: fork');
    });

    it('scaffolds a forked template with context:fork and tools', async () => {
      const { result, skillDir } = scaffoldSkill('test-forked', tempDir, '-t forked');
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('context: fork');
      expect(content).toContain('Read');
      expect(content).toContain('Glob');
      expect(content).toContain('Grep');
    });

    it('scaffolds a with-hooks template', async () => {
      const { result, skillDir } = scaffoldSkill('test-hooks', tempDir, '-t with-hooks');
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('hooks');
    });

    it('scaffolds an internal template (user-invocable: false)', async () => {
      const { result, skillDir } = scaffoldSkill('test-internal', tempDir, '-t internal');
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('user-invocable: false');
    });

    it('rejects an invalid template type', () => {
      const result = runCli(`scaffold test-bad --output "${tempDir}" -t agent --force`);
      expect(result.exitCode).toBe(1);
    });
  });

  // ── 1.3 Spec fields ────────────────────────────────────────────────

  describe('spec fields', () => {
    it('includes --license in frontmatter', async () => {
      const { result, skillDir } = scaffoldSkill('test-license', tempDir, '--license MIT');
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('license: MIT');
    });

    it('includes --compatibility in frontmatter', async () => {
      const { result, skillDir } = scaffoldSkill(
        'test-compat',
        tempDir,
        '--compatibility "claude-code>=2.1"'
      );
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('compatibility: claude-code>=2.1');
    });

    it('includes multi-entry --metadata in frontmatter', async () => {
      const { result, skillDir } = scaffoldSkill(
        'test-meta',
        tempDir,
        '--metadata author=test --metadata category=utility'
      );
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('metadata:');
      expect(content).toContain('author: test');
      expect(content).toContain('category: utility');
    });

    it('combines all spec fields', async () => {
      const { result, skillDir } = scaffoldSkill(
        'test-allspec',
        tempDir,
        '--license Apache-2.0 --compatibility "claude-code>=2.0" --metadata version=1.0'
      );
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('license: Apache-2.0');
      expect(content).toContain('compatibility: claude-code>=2.0');
      expect(content).toContain('version: 1.0');
    });

    it('handles metadata with equals in value', async () => {
      const { result, skillDir } = scaffoldSkill('test-meta-eq', tempDir, '--metadata "expr=a=b"');
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('expr: a=b');
    });
  });

  // ── 1.4 Removed fields ─────────────────────────────────────────────

  describe('removed fields', () => {
    it('rejects --model flag', () => {
      const result = runCli(
        `scaffold test-model --output "${tempDir}" -d "Model" --model sonnet --force`
      );
      expect(result.exitCode).not.toBe(0);
      const output = result.stdout + result.stderr;
      expect(output).toMatch(/unknown option/i);
    });

    it('rejects --memory flag', () => {
      const result = runCli(
        `scaffold test-memory --output "${tempDir}" -d "Memory" --memory project --force`
      );
      expect(result.exitCode).not.toBe(0);
      const output = result.stdout + result.stderr;
      expect(output).toMatch(/unknown option/i);
    });
  });

  // ── 1.5 Additional options ──────────────────────────────────────────

  describe('additional options', () => {
    it('sets user-invocable: false with --no-user-invocable', async () => {
      const { result, skillDir } = scaffoldSkill('test-noinvoke', tempDir, '--no-user-invocable');
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('user-invocable: false');
    });

    it('sets --argument-hint in frontmatter', async () => {
      const { result, skillDir } = scaffoldSkill(
        'test-hint',
        tempDir,
        '--argument-hint "<file-path>"'
      );
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('argument-hint:');
    });

    it('uses --minimal for shorter template', async () => {
      const { result: fullResult, skillDir: fullDir } = scaffoldSkill('test-full', tempDir);
      const { result: minResult, skillDir: minDir } = scaffoldSkill(
        'test-minimal',
        tempDir,
        '--minimal'
      );
      expect(fullResult.exitCode).toBe(0);
      expect(minResult.exitCode).toBe(0);

      const fullContent = await fs.readFile(`${fullDir}/SKILL.md`, 'utf-8');
      const minContent = await fs.readFile(`${minDir}/SKILL.md`, 'utf-8');
      expect(minContent.length).toBeLessThan(fullContent.length);
    });

    it('sets --context fork in frontmatter', async () => {
      const { result, skillDir } = scaffoldSkill('test-ctx', tempDir, '--context fork');
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('context: fork');
    });

    it('sets --agent in frontmatter', async () => {
      const { result, skillDir } = scaffoldSkill(
        'test-agent-field',
        tempDir,
        '--agent "CLI extension"'
      );
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('agent:');
    });

    it('includes hooks section with --hooks', async () => {
      const { result, skillDir } = scaffoldSkill('test-hooks-flag', tempDir, '--hooks');
      expect(result.exitCode).toBe(0);

      const content = await fs.readFile(`${skillDir}/SKILL.md`, 'utf-8');
      expect(content).toContain('hooks:');
    });
  });

  // ── 1.6 Validation edge cases ───────────────────────────────────────

  describe('validation edge cases', () => {
    it('rejects a name that is too long (>64 chars)', () => {
      const longName =
        'a-very-long-skill-name-that-exceeds-the-maximum-allowed-length-of-sixty-four';
      const result = runCli(`scaffold ${longName} --output "${tempDir}" -d "Long" --force`);
      expect(result.exitCode).toBe(1);
    });

    it('rejects an argument-hint that is too long (>200 chars)', () => {
      const longHint = 'x'.repeat(201);
      const result = runCli(
        `scaffold test-long-hint --output "${tempDir}" -d "Hint" --argument-hint "${longHint}" --force`
      );
      expect(result.exitCode).toBe(1);
    });

    it('rejects reserved word "claude" in compound name', () => {
      const result = runCli(`scaffold my-claude-skill --output "${tempDir}" -d "Reserved" --force`);
      expect(result.exitCode).toBe(1);
    });

    it('rejects reserved word "anthropic" in name', () => {
      const result = runCli(
        `scaffold anthropic-helper --output "${tempDir}" -d "Reserved" --force`
      );
      expect(result.exitCode).toBe(1);
    });

    it('rejects a description that is too long (>1024 chars)', () => {
      const longDesc = 'x'.repeat(1025);
      const result = runCli(
        `scaffold test-long-desc --output "${tempDir}" -d "${longDesc}" --force`
      );
      expect(result.exitCode).toBe(1);
    });

    it('rejects compatibility that is too long (>500 chars)', () => {
      const longCompat = 'x'.repeat(501);
      const result = runCli(
        `scaffold test-long-compat --output "${tempDir}" -d "Compat" --compatibility "${longCompat}" --force`
      );
      expect(result.exitCode).toBe(1);
    });

    it('rejects an empty metadata key', () => {
      const result = runCli(
        `scaffold test-empty-key --output "${tempDir}" -d "Bad" --metadata "=value" --force`
      );
      expect(result.exitCode).toBe(1);
    });
  });
});
