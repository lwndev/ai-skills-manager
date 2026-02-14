/**
 * E2E tests for the update command.
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

describe('update e2e', () => {
  let tempDir: string;

  beforeAll(async () => {
    await fs.access(CLI_PATH);
  });

  beforeEach(async () => {
    tempDir = await createTempDir('update-e2e-');
  });

  afterEach(async () => {
    await cleanupDir(tempDir);
  });

  /**
   * Install a skill and prepare a new package for update.
   * Returns { projectDir, newPkg }.
   */
  function setupUpdate(name: string): { projectDir: string; newPkg: string } {
    // Scaffold + package v1
    const { skillDir: v1Dir } = scaffoldSkill(name, tempDir);
    const pkgDir = path.join(tempDir, 'packages');
    const { packagePath: v1Pkg, result: pkgResult } = packageSkill(v1Dir, pkgDir);
    expect(pkgResult.exitCode).toBe(0);

    // Install v1
    const projectDir = path.join(tempDir, 'project');
    const installDir = path.join(projectDir, '.claude', 'skills');
    const installResult = runCli(`install "${v1Pkg}" -s "${installDir}" --force`);
    expect(installResult.exitCode).toBe(0);

    // Create v2 (scaffold again with different description)
    const v2Out = path.join(tempDir, 'v2');
    const { skillDir: v2Dir } = scaffoldSkill(name, v2Out, '-d "Updated skill"');
    const v2PkgDir = path.join(tempDir, 'v2-packages');
    const { packagePath: v2Pkg, result: v2PkgResult } = packageSkill(v2Dir, v2PkgDir);
    expect(v2PkgResult.exitCode).toBe(0);

    return { projectDir, newPkg: v2Pkg };
  }

  // ── 6.1 CLI update ─────────────────────────────────────────────────

  describe('CLI update', () => {
    it('updates a skill with --force', () => {
      const { projectDir, newPkg } = setupUpdate('test-upd');

      const result = runCli(`update test-upd "${newPkg}" -f`, {
        cwd: projectDir,
      });
      expect(result.exitCode).toBe(0);
    });

    it('dry-run shows changes without applying', async () => {
      const { projectDir, newPkg } = setupUpdate('test-upd-dry');

      const result = runCli(`update test-upd-dry "${newPkg}" -n`, {
        cwd: projectDir,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/dry.run|preview|would/i);
    });

    it('quiet mode produces minimal output', () => {
      const { projectDir, newPkg } = setupUpdate('test-upd-quiet');

      const result = runCli(`update test-upd-quiet "${newPkg}" -q -f`, {
        cwd: projectDir,
      });
      expect(result.exitCode).toBe(0);
    });
  });

  // ── 6.2 Backup flags ───────────────────────────────────────────────

  describe('backup flags', () => {
    it('--keep-backup preserves backup', () => {
      const { projectDir, newPkg } = setupUpdate('test-keep-bak');

      const result = runCli(`update test-keep-bak "${newPkg}" -f --keep-backup`, {
        cwd: projectDir,
      });
      expect(result.exitCode).toBe(0);
    });

    it('--no-backup skips backup', () => {
      const { projectDir, newPkg } = setupUpdate('test-no-bak');

      const result = runCli(`update test-no-bak "${newPkg}" -f --no-backup`, { cwd: projectDir });
      expect(result.exitCode).toBe(0);
    });
  });

  // ── 6.4 Error cases ────────────────────────────────────────────────

  describe('error cases', () => {
    it('exits 1 when skill is not found', () => {
      const fakePkg = path.join(tempDir, 'fake.skill');
      // The skill doesn't exist in the project — should exit 1
      const projectDir = path.join(tempDir, 'empty-project');
      const result = runCli(`update no-such-skill "${fakePkg}" -f`, {
        cwd: projectDir,
      });
      expect(result.exitCode).toBe(1);
    });

    it('exits 4 for invalid package', async () => {
      // Install a skill first so we can attempt an update
      const { skillDir } = scaffoldSkill('test-inv-pkg', tempDir);
      const pkgDir = path.join(tempDir, 'packages');
      const { packagePath, result: pkgResult } = packageSkill(skillDir, pkgDir);
      expect(pkgResult.exitCode).toBe(0);

      const projectDir = path.join(tempDir, 'project');
      const installDir = path.join(projectDir, '.claude', 'skills');
      const installResult = runCli(`install "${packagePath}" -s "${installDir}" --force`);
      expect(installResult.exitCode).toBe(0);

      // Create an invalid package
      const badPkg = path.join(tempDir, 'bad.skill');
      await fs.writeFile(badPkg, 'not a zip', 'utf-8');

      const result = runCli(`update test-inv-pkg "${badPkg}" -f`, {
        cwd: projectDir,
      });
      expect(result.exitCode).toBe(4);
    });

    it('exits 5 for security violation (path traversal)', () => {
      const result = runCli(`update "../escape" "${tempDir}/fake.skill" -f`);
      expect(result.exitCode).toBe(5);
    });

    it('exits non-zero for quiet mode without force', () => {
      const result = runCli(`update test-basic "${tempDir}/fake.skill" -q`);
      expect(result.exitCode).toBeGreaterThanOrEqual(1);
    });
  });
});
