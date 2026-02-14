/**
 * E2E tests for the uninstall command.
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

describe('uninstall e2e', () => {
  let tempDir: string;

  beforeAll(async () => {
    await fs.access(CLI_PATH);
  });

  beforeEach(async () => {
    tempDir = await createTempDir('uninstall-e2e-');
  });

  afterEach(async () => {
    await cleanupDir(tempDir);
  });

  /** Scaffold, package, and install a skill. Returns the install base dir. */
  function installSkillForTest(name: string): string {
    const { skillDir } = scaffoldSkill(name, tempDir);
    const pkgDir = path.join(tempDir, 'packages');
    const { packagePath, result: pkgResult } = packageSkill(skillDir, pkgDir);
    expect(pkgResult.exitCode).toBe(0);

    const installBase = path.join(tempDir, 'project');
    const installDir = path.join(installBase, '.claude', 'skills');
    const installResult = runCli(`install "${packagePath}" -s "${installDir}" --force`);
    expect(installResult.exitCode).toBe(0);
    return installBase;
  }

  // ── 5.3 Security ───────────────────────────────────────────────────

  describe('security', () => {
    it('rejects invalid characters (exit 5)', () => {
      const result = runCli('uninstall "skill;rm -rf" -f');
      expect(result.exitCode).toBe(5);
    });

    it('rejects uppercase name (exit 5)', () => {
      const result = runCli('uninstall TestSkill -f');
      expect(result.exitCode).toBe(5);
    });

    it('rejects absolute path (exit 5)', () => {
      const result = runCli('uninstall "/etc/passwd" -f');
      expect(result.exitCode).toBe(5);
    });

    it('rejects path traversal (exit 5)', () => {
      const result = runCli('uninstall "../escape" -f');
      expect(result.exitCode).toBe(5);
    });
  });

  // ── 5.4 Error cases ────────────────────────────────────────────────

  describe('error cases', () => {
    it('exits 1 for non-existent skill', () => {
      const projectDir = path.join(tempDir, 'empty-project');
      const result = runCli('uninstall no-such-skill -f', {
        cwd: projectDir,
      });
      expect(result.exitCode).toBe(1);
    });

    it('exits 5 for custom scope path', () => {
      const result = runCli(`uninstall test-basic -s /custom/path -f`);
      expect(result.exitCode).toBe(5);
    });

    it('exits non-zero for quiet mode without force', () => {
      const result = runCli('uninstall test-basic -q');
      expect(result.exitCode).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 5.1 Basic uninstall ─────────────────────────────────────────────

  describe('basic operations', () => {
    it('force-uninstalls an installed skill', async () => {
      const projectDir = installSkillForTest('test-uninst');
      const skillPath = path.join(projectDir, '.claude', 'skills', 'test-uninst');

      // Verify it exists first
      const stat = await fs.stat(skillPath);
      expect(stat.isDirectory()).toBe(true);

      const result = runCli('uninstall test-uninst -f', {
        cwd: projectDir,
      });
      expect(result.exitCode).toBe(0);

      // Verify removed
      await expect(fs.access(skillPath)).rejects.toThrow();
    });

    it('dry-run shows preview without removing', async () => {
      const projectDir = installSkillForTest('test-dry-uninst');
      const skillPath = path.join(projectDir, '.claude', 'skills', 'test-dry-uninst');

      const result = runCli('uninstall test-dry-uninst -n', {
        cwd: projectDir,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/dry.run|preview|would/i);

      // Verify still exists
      const stat = await fs.stat(skillPath);
      expect(stat.isDirectory()).toBe(true);
    });
  });
});
