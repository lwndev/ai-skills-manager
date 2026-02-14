/**
 * E2E tests for cross-command lifecycle workflows.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  CLI_PATH,
  runCli,
  scaffoldSkill,
  packageSkill,
  createSkillManually,
  createTempDir,
  cleanupDir,
} from './helpers';

describe('lifecycle e2e', () => {
  let tempDir: string;

  beforeAll(async () => {
    await fs.access(CLI_PATH);
  });

  beforeEach(async () => {
    tempDir = await createTempDir('lifecycle-e2e-');
  });

  afterEach(async () => {
    await cleanupDir(tempDir);
  });

  // ── 8.1.1 Full lifecycle ────────────────────────────────────────────

  it('scaffold → validate → package → install → list → update → uninstall', async () => {
    const projectDir = path.join(tempDir, 'project');
    const installDir = path.join(projectDir, '.claude', 'skills');
    const pkgDir = path.join(tempDir, 'packages');

    // 1. Scaffold
    const { skillDir, result: scaffoldResult } = scaffoldSkill(
      'test-lifecycle',
      tempDir,
      '-d "Lifecycle test skill"'
    );
    expect(scaffoldResult.exitCode).toBe(0);

    // 2. Validate
    const validateResult = runCli(`validate "${skillDir}"`);
    expect(validateResult.exitCode).toBe(0);

    // 3. Package
    const { packagePath, result: pkgResult } = packageSkill(skillDir, pkgDir);
    expect(pkgResult.exitCode).toBe(0);
    const stat = await fs.stat(packagePath);
    expect(stat.isFile()).toBe(true);

    // 4. Install
    const installResult = runCli(`install "${packagePath}" -s "${installDir}" --force`);
    expect(installResult.exitCode).toBe(0);

    // 5. List
    const listResult = runCli('list -s project', { cwd: projectDir });
    expect(listResult.exitCode).toBe(0);
    expect(listResult.stdout).toContain('test-lifecycle');

    // 6. Update (scaffold v2, package, then update)
    const v2Dir = path.join(tempDir, 'v2');
    const { skillDir: v2Skill } = scaffoldSkill(
      'test-lifecycle',
      v2Dir,
      '-d "Updated lifecycle skill"'
    );
    const v2PkgDir = path.join(tempDir, 'v2-packages');
    const { packagePath: v2Pkg, result: v2PkgResult } = packageSkill(v2Skill, v2PkgDir);
    expect(v2PkgResult.exitCode).toBe(0);

    const updateResult = runCli(`update test-lifecycle "${v2Pkg}" -f`, { cwd: projectDir });
    expect(updateResult.exitCode).toBe(0);

    // Verify the update applied
    const updatedContent = await fs.readFile(
      path.join(installDir, 'test-lifecycle', 'SKILL.md'),
      'utf-8'
    );
    expect(updatedContent).toContain('Updated lifecycle skill');

    // 7. Uninstall
    const uninstallResult = runCli('uninstall test-lifecycle -f', {
      cwd: projectDir,
    });
    expect(uninstallResult.exitCode).toBe(0);

    // Verify removed
    await expect(fs.access(path.join(installDir, 'test-lifecycle'))).rejects.toThrow();
  });

  // ── 8.2 Cross-scope ────────────────────────────────────────────────

  describe('cross-scope operations', () => {
    it('project and personal scopes coexist', () => {
      const { skillDir } = scaffoldSkill('test-cross', tempDir);
      const pkgDir = path.join(tempDir, 'packages');
      const { packagePath, result: pkgResult } = packageSkill(skillDir, pkgDir);
      expect(pkgResult.exitCode).toBe(0);

      const projectDir = path.join(tempDir, 'project');
      const projectInstallDir = path.join(projectDir, '.claude', 'skills');
      const personalInstallDir = path.join(tempDir, 'personal-skills');

      // Install to both scopes
      const projResult = runCli(`install "${packagePath}" -s "${projectInstallDir}" --force`);
      expect(projResult.exitCode).toBe(0);

      const persResult = runCli(`install "${packagePath}" -s "${personalInstallDir}" --force`);
      expect(persResult.exitCode).toBe(0);

      // Both directories should have the skill
      const projList = runCli('list -s project -q', { cwd: projectDir });
      expect(projList.stdout).toContain('test-cross');
    });

    it('scope-specific uninstall preserves other scope', async () => {
      const { skillDir } = scaffoldSkill('test-scope-uninst', tempDir);
      const pkgDir = path.join(tempDir, 'packages');
      const { packagePath, result: pkgResult } = packageSkill(skillDir, pkgDir);
      expect(pkgResult.exitCode).toBe(0);

      const projectDir = path.join(tempDir, 'project');
      const projectInstallDir = path.join(projectDir, '.claude', 'skills');
      const personalInstallDir = path.join(tempDir, 'personal-skills');

      // Install to both
      runCli(`install "${packagePath}" -s "${projectInstallDir}" --force`);
      runCli(`install "${packagePath}" -s "${personalInstallDir}" --force`);

      // Uninstall from project only
      const uninstResult = runCli('uninstall test-scope-uninst -f', {
        cwd: projectDir,
      });
      expect(uninstResult.exitCode).toBe(0);

      // Project copy gone
      await expect(fs.access(path.join(projectInstallDir, 'test-scope-uninst'))).rejects.toThrow();

      // Personal copy preserved
      const personalStat = await fs.stat(
        path.join(personalInstallDir, 'test-scope-uninst', 'SKILL.md')
      );
      expect(personalStat.isFile()).toBe(true);
    });
  });

  // ── 8.3 Spec field preservation ─────────────────────────────────────

  describe('spec field preservation', () => {
    it('license/compat/metadata survive full lifecycle', async () => {
      const { skillDir, result: scaffoldResult } = scaffoldSkill(
        'test-spec-life',
        tempDir,
        '--license MIT --compatibility "claude-code>=2.1" --metadata author=test --metadata category=utility'
      );
      expect(scaffoldResult.exitCode).toBe(0);

      // Validate
      expect(runCli(`validate "${skillDir}"`).exitCode).toBe(0);

      // Package
      const pkgDir = path.join(tempDir, 'packages');
      const { packagePath, result: pkgResult } = packageSkill(skillDir, pkgDir);
      expect(pkgResult.exitCode).toBe(0);

      // Install
      const projectDir = path.join(tempDir, 'project');
      const installDir = path.join(projectDir, '.claude', 'skills');
      expect(runCli(`install "${packagePath}" -s "${installDir}" --force`).exitCode).toBe(0);

      // Validate installed
      const installedSkill = path.join(installDir, 'test-spec-life');
      expect(runCli(`validate "${installedSkill}"`).exitCode).toBe(0);

      // Check content preserved
      const content = await fs.readFile(path.join(installedSkill, 'SKILL.md'), 'utf-8');
      expect(content).toContain('license: MIT');
      expect(content).toContain('compatibility: claude-code>=2.1');
      expect(content).toContain('author: test');
      expect(content).toContain('category: utility');
    });

    it('FEAT-014 fields survive full lifecycle', async () => {
      // Manually create a skill with FEAT-014 fields
      const skillDir = await createSkillManually(tempDir, 'test-feat014-life', {
        name: 'test-feat014-life',
        description: 'FEAT-014 lifecycle test',
        version: '"1.0.0"',
        tools: ['Read', 'Write'],
        color: 'blue',
        'keep-coding-instructions': true,
        'disable-model-invocation': true,
      });

      // Validate
      expect(runCli(`validate "${skillDir}"`).exitCode).toBe(0);

      // Package
      const pkgDir = path.join(tempDir, 'packages');
      const { packagePath, result: pkgResult } = packageSkill(skillDir, pkgDir);
      expect(pkgResult.exitCode).toBe(0);

      // Install
      const projectDir = path.join(tempDir, 'project');
      const installDir = path.join(projectDir, '.claude', 'skills');
      expect(runCli(`install "${packagePath}" -s "${installDir}" --force`).exitCode).toBe(0);

      // Validate installed
      const installed = path.join(installDir, 'test-feat014-life');
      expect(runCli(`validate "${installed}"`).exitCode).toBe(0);

      // Check fields preserved
      const content = await fs.readFile(path.join(installed, 'SKILL.md'), 'utf-8');
      expect(content).toContain('version:');
      expect(content).toContain('keep-coding-instructions: true');
      expect(content).toContain('disable-model-invocation: true');
    });
  });

  // ── 8.4 Output mode consistency ─────────────────────────────────────

  describe('output mode consistency', () => {
    it('quiet mode works across all commands', () => {
      const projectDir = path.join(tempDir, 'project');
      const installDir = path.join(projectDir, '.claude', 'skills');
      const pkgDir = path.join(tempDir, 'packages');

      // Scaffold (no -q flag)
      const { skillDir } = scaffoldSkill('test-quiet-all', tempDir);

      // Validate -q
      const valResult = runCli(`validate "${skillDir}" -q`);
      expect(valResult.exitCode).toBe(0);

      // Package -q
      const { packagePath } = packageSkill(skillDir, pkgDir, '-q');

      // Install -q
      const instResult = runCli(`install "${packagePath}" -s "${installDir}" --force -q`);
      expect(instResult.exitCode).toBe(0);

      // List -q
      const listResult = runCli('list -q -s project', { cwd: projectDir });
      expect(listResult.exitCode).toBe(0);
      expect(listResult.stdout.trim()).toContain('test-quiet-all');

      // Uninstall -q -f
      const uninstResult = runCli('uninstall test-quiet-all -q -f', {
        cwd: projectDir,
      });
      expect(uninstResult.exitCode).toBe(0);
    });

    it('JSON mode works across JSON-capable commands', () => {
      const projectDir = path.join(tempDir, 'project');
      const installDir = path.join(projectDir, '.claude', 'skills');
      const pkgDir = path.join(tempDir, 'packages');

      const { skillDir } = scaffoldSkill('test-json-all', tempDir);

      // Validate -j
      const valResult = runCli(`validate "${skillDir}" -j`);
      expect(valResult.exitCode).toBe(0);
      const valJson = JSON.parse(valResult.stdout);
      expect(valJson.valid).toBe(true);

      // Package + install
      const { packagePath } = packageSkill(skillDir, pkgDir);
      runCli(`install "${packagePath}" -s "${installDir}" --force`);

      // List -j
      const listResult = runCli('list -j -s project', { cwd: projectDir });
      expect(listResult.exitCode).toBe(0);
      const listJson = JSON.parse(listResult.stdout);
      expect(Array.isArray(listJson)).toBe(true);
    });
  });
});
