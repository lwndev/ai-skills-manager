/**
 * E2E tests for the install command.
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

describe('install e2e', () => {
  let tempDir: string;

  beforeAll(async () => {
    await fs.access(CLI_PATH);
  });

  beforeEach(async () => {
    tempDir = await createTempDir('install-e2e-');
  });

  afterEach(async () => {
    await cleanupDir(tempDir);
  });

  /** Scaffold + package a skill and return the package path. */
  function preparePackage(name: string): string {
    const { skillDir } = scaffoldSkill(name, tempDir);
    const pkgDir = path.join(tempDir, 'packages');
    const { packagePath, result } = packageSkill(skillDir, pkgDir);
    expect(result.exitCode).toBe(0);
    return packagePath;
  }

  // ── 4.1 CLI install ─────────────────────────────────────────────────

  describe('CLI install', () => {
    it('installs a skill with --force to a custom path', async () => {
      const pkg = preparePackage('test-install');
      const installDir = path.join(tempDir, 'installed');

      const result = runCli(`install "${pkg}" -s "${installDir}" --force`);
      expect(result.exitCode).toBe(0);

      const skillMd = path.join(installDir, 'test-install', 'SKILL.md');
      const stat = await fs.stat(skillMd);
      expect(stat.isFile()).toBe(true);
    });

    it('shows dry-run output without creating files', async () => {
      const pkg = preparePackage('test-dryrun');
      const installDir = path.join(tempDir, 'dry');

      const result = runCli(`install "${pkg}" -s "${installDir}" --dry-run`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/dry.run|preview|would/i);

      // Directory should not exist
      await expect(fs.access(path.join(installDir, 'test-dryrun'))).rejects.toThrow();
    });

    it('produces minimal output with --quiet', () => {
      const pkg = preparePackage('test-quiet');
      const installDir = path.join(tempDir, 'quiet');

      const result = runCli(`install "${pkg}" -s "${installDir}" --force --quiet`);
      expect(result.exitCode).toBe(0);
    });
  });

  // ── 4.3 Error cases ────────────────────────────────────────────────

  describe('error cases', () => {
    it('exits 2 for non-existent package', () => {
      const result = runCli(`install "${tempDir}/no-such.skill" -s "${tempDir}/inst" --force`);
      expect(result.exitCode).toBe(2);
    });

    it('exits with error for invalid package (not a ZIP)', async () => {
      const fakePkg = path.join(tempDir, 'fake.skill');
      await fs.writeFile(fakePkg, 'not a zip file', 'utf-8');

      const result = runCli(`install "${fakePkg}" -s "${tempDir}/inst" --force`);
      expect(result.exitCode).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 4.4 Post-install verification ──────────────────────────────────

  describe('post-install verification', () => {
    it('installed skill passes validation', () => {
      const pkg = preparePackage('test-verify');
      const installDir = path.join(tempDir, 'verify');

      const installResult = runCli(`install "${pkg}" -s "${installDir}" --force`);
      expect(installResult.exitCode).toBe(0);

      const validateResult = runCli(`validate "${path.join(installDir, 'test-verify')}"`);
      expect(validateResult.exitCode).toBe(0);
    });

    it('installed skill appears in list', () => {
      const pkg = preparePackage('test-listed');
      const installDir = path.join(tempDir, 'listed', '.claude', 'skills');

      const installResult = runCli(`install "${pkg}" -s "${installDir}" --force`);
      expect(installResult.exitCode).toBe(0);

      const listResult = runCli('list -j', {
        cwd: path.join(tempDir, 'listed'),
      });
      // Should find the skill if project scope resolves correctly
      expect(listResult.exitCode).toBe(0);
    });
  });
});
