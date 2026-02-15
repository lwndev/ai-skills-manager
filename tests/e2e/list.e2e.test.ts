/**
 * E2E tests for the list command.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  CLI_PATH,
  runCli,
  scaffoldSkill,
  packageSkill,
  createTempDir,
  cleanupDir,
} from './helpers';

describe('list e2e', () => {
  let tempDir: string;

  beforeAll(async () => {
    await fs.access(CLI_PATH);
  });

  beforeEach(async () => {
    tempDir = await createTempDir('list-e2e-');
  });

  afterEach(async () => {
    await cleanupDir(tempDir);
  });

  /** Install a skill into projectDir/.claude/skills/ and return projectDir. */
  function installSkillToProject(name: string, extraScaffoldFlags = ''): string {
    const { skillDir } = scaffoldSkill(name, tempDir, extraScaffoldFlags);
    const pkgDir = path.join(tempDir, 'packages');
    const { packagePath, result: pkgResult } = packageSkill(skillDir, pkgDir);
    expect(pkgResult.exitCode).toBe(0);

    const projectDir = path.join(tempDir, `project-${name}`);
    const installDir = path.join(projectDir, '.claude', 'skills');
    const installResult = runCli(`install "${packagePath}" -s "${installDir}" --force`);
    expect(installResult.exitCode).toBe(0);
    return projectDir;
  }

  // ── 7.1 Basic listing ──────────────────────────────────────────────

  describe('basic listing', () => {
    it('lists installed skills', () => {
      const projectDir = installSkillToProject('test-list');

      const result = runCli('list', { cwd: projectDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test-list');
    });

    it('supports the "ls" alias', () => {
      const projectDir = installSkillToProject('test-ls');

      const result = runCli('ls', { cwd: projectDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test-ls');
    });

    it('shows project-only with -s project', () => {
      const projectDir = installSkillToProject('test-proj-only');

      const result = runCli('list -s project', { cwd: projectDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test-proj-only');
    });

    it('shows message when no skills installed', async () => {
      const emptyProject = path.join(tempDir, 'empty');
      await fs.mkdir(emptyProject, { recursive: true });
      const result = runCli('list -s project', { cwd: emptyProject });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/no skills/i);
    });

    it('exits 1 for invalid scope', () => {
      const result = runCli('list -s invalid', { cwd: tempDir });
      expect(result.exitCode).toBe(1);
    });
  });

  // ── 7.2 Output modes ───────────────────────────────────────────────

  describe('output modes', () => {
    it('outputs valid JSON array with -j', () => {
      const projectDir = installSkillToProject('test-json-list');

      const result = runCli('list -j -s project', { cwd: projectDir });
      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThanOrEqual(1);
      const names = parsed.map((s: { name: string }) => s.name);
      expect(names).toContain('test-json-list');
    });

    it('outputs names only with -q', () => {
      const projectDir = installSkillToProject('test-quiet-list');

      const result = runCli('list -q -s project', { cwd: projectDir });
      expect(result.exitCode).toBe(0);

      const lines = result.stdout.trim().split('\n');
      expect(lines).toContain('test-quiet-list');
    });

    it('filters JSON output by scope', () => {
      const projectDir = installSkillToProject('test-json-scope');

      const result = runCli('list -j -s project', { cwd: projectDir });
      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout);
      for (const skill of parsed) {
        expect(skill.scope).toBe('project');
      }
    });
  });

  // ── 7.4 Display ────────────────────────────────────────────────────

  describe('display', () => {
    it('truncates long descriptions', () => {
      const longDesc = 'a'.repeat(120);
      const projectDir = installSkillToProject('test-trunc', `-d "${longDesc}"`);

      const result = runCli('list -s project', { cwd: projectDir });
      expect(result.exitCode).toBe(0);
      // The full 120-char description should not appear untruncated
      expect(result.stdout).not.toContain(longDesc);
      expect(result.stdout).toContain('...');
    });

    it('shows version from metadata', () => {
      const projectDir = installSkillToProject('test-ver-display', '--metadata version=2.0');

      const result = runCli('list -s project', { cwd: projectDir });
      expect(result.exitCode).toBe(0);
      // Metadata value 2.0 may be displayed as "2" or "2.0"
      expect(result.stdout).toMatch(/\(v2(\.0)?\)/);
    });
  });
});
