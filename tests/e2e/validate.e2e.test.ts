/**
 * E2E tests for the validate command.
 */

import * as fs from 'fs/promises';
import {
  CLI_PATH,
  runCli,
  scaffoldSkill,
  createSkillManually,
  createTempDir,
  cleanupDir,
} from './helpers';

describe('validate e2e', () => {
  let tempDir: string;

  beforeAll(async () => {
    await fs.access(CLI_PATH);
  });

  beforeEach(async () => {
    tempDir = await createTempDir('validate-e2e-');
  });

  afterEach(async () => {
    await cleanupDir(tempDir);
  });

  // ── 2.4 Spec field validation ───────────────────────────────────────

  describe('spec field validation', () => {
    it('passes with valid license field', () => {
      const { skillDir } = scaffoldSkill('test-license', tempDir, '--license MIT');
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('passes with valid compatibility field', () => {
      const { skillDir } = scaffoldSkill(
        'test-compat',
        tempDir,
        '--compatibility "claude-code>=2.1"'
      );
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('passes with valid metadata field', () => {
      const { skillDir } = scaffoldSkill('test-meta', tempDir, '--metadata key=value');
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('fails when compatibility is too long (>500 chars)', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-long-compat', {
        name: 'test-long-compat',
        description: 'Test',
        compatibility: 'x'.repeat(501),
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });

    it('fails when compatibility is non-string', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-compat-num', {
        name: 'test-compat-num',
        description: 'Test',
        compatibility: 123,
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });

    it('fails when compatibility is empty string', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-compat-empty', {
        name: 'test-compat-empty',
        description: 'Test',
        compatibility: '""',
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });
  });

  // ── 2.5 Claude Code 2.1.x fields ───────────────────────────────────

  describe('Claude Code 2.1.x fields', () => {
    it('passes with valid context: fork', () => {
      const { skillDir } = scaffoldSkill('test-ctx', tempDir, '--context fork');
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('fails with invalid context value', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-ctx-bad', {
        name: 'test-ctx-bad',
        description: 'Test',
        context: 'invalid',
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });

    it('passes with valid agent field', () => {
      const { skillDir } = scaffoldSkill('test-agent', tempDir, '--agent "My agent"');
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('fails with invalid agent (non-string)', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-agent-bad', {
        name: 'test-agent-bad',
        description: 'Test',
        agent: 123,
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });

    it('passes with valid hooks', () => {
      const { skillDir } = scaffoldSkill('test-hooks', tempDir, '--hooks');
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('fails with invalid hooks (non-object)', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-hooks-bad', {
        name: 'test-hooks-bad',
        description: 'Test',
        hooks: '"bad"',
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });

    it('passes with user-invocable: false', () => {
      const { skillDir } = scaffoldSkill('test-noinvoke', tempDir, '--no-user-invocable');
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('fails with invalid user-invocable (non-boolean)', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-invocable-bad', {
        name: 'test-invocable-bad',
        description: 'Test',
        'user-invocable': '"yes"',
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });

    it('passes with valid argument-hint', () => {
      const { skillDir } = scaffoldSkill('test-arg-hint', tempDir, '--argument-hint "<path>"');
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('fails when argument-hint is too long (>200 chars)', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-hint-long', {
        name: 'test-hint-long',
        description: 'Test',
        'argument-hint': 'x'.repeat(201),
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });
  });

  // ── 2.6 FEAT-014 fields ────────────────────────────────────────────

  describe('FEAT-014 fields', () => {
    it('passes with valid version field', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-version', {
        name: 'test-version',
        description: 'Test',
        version: '"1.0.0"',
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('fails with invalid version (non-string)', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-version-bad', {
        name: 'test-version-bad',
        description: 'Test',
        version: 1.0,
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });

    it('passes with valid tools field', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-tools', {
        name: 'test-tools',
        description: 'Test',
        tools: ['Read', 'Write'],
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('fails with invalid tools (non-array number)', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-tools-bad', {
        name: 'test-tools-bad',
        description: 'Test',
        tools: 123,
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });

    it('passes with valid color field', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-color', {
        name: 'test-color',
        description: 'Test',
        color: 'blue',
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('passes with valid keep-coding-instructions', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-keep-coding', {
        name: 'test-keep-coding',
        description: 'Test',
        'keep-coding-instructions': true,
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('fails with invalid keep-coding-instructions (non-boolean)', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-keep-coding-bad', {
        name: 'test-keep-coding-bad',
        description: 'Test',
        'keep-coding-instructions': '"yes"',
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });

    it('passes with valid disable-model-invocation', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-disable-model', {
        name: 'test-disable-model',
        description: 'Test',
        'disable-model-invocation': true,
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(0);
    });

    it('fails with invalid disable-model-invocation (non-boolean)', async () => {
      const skillDir = await createSkillManually(tempDir, 'test-disable-bad', {
        name: 'test-disable-bad',
        description: 'Test',
        'disable-model-invocation': 1,
      });
      const result = runCli(`validate "${skillDir}"`);
      expect(result.exitCode).toBe(1);
    });
  });
});
