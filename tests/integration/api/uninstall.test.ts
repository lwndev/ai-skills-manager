/**
 * Integration tests for the uninstall API function (FEAT-010 Phase 7)
 *
 * These tests verify end-to-end behavior of the uninstall() API function
 * with real filesystem operations, including:
 * - Skills are correctly removed from the filesystem
 * - API behavior is consistent with CLI behavior
 * - Full workflow from scaffold to uninstall works
 * - Batch uninstall with partial failures
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { uninstall } from '../../../src/api/uninstall';
import { scaffold } from '../../../src/api/scaffold';
import { createPackage } from '../../../src/api/package';
import { install } from '../../../src/api/install';
import { list } from '../../../src/api/list';
import { SecurityError, CancellationError } from '../../../src/errors';
import { execSync } from 'child_process';

describe('uninstall API integration', () => {
  let tempDir: string;
  let skillsDir: string;
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');

  beforeAll(async () => {
    // Ensure CLI is built
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-uninstall-integration-'));
    skillsDir = path.join(tempDir, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a test skill
   */
  async function createTestSkill(name: string, description?: string): Promise<string> {
    const result = await scaffold({
      name,
      description: description || `Test skill: ${name}`,
      output: skillsDir,
    });
    return result.path;
  }

  describe('skill removal verification', () => {
    it('completely removes skill directory', async () => {
      const skillName = 'complete-removal-test';
      const skillPath = await createTestSkill(skillName);

      // Verify skill exists
      expect((await fs.stat(skillPath)).isDirectory()).toBe(true);

      // Uninstall
      await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      // Verify skill is completely removed
      await expect(fs.stat(skillPath)).rejects.toThrow();
    });

    it('removes all nested files and directories', async () => {
      const skillName = 'nested-removal-test';
      const skillPath = await createTestSkill(skillName);

      // Add nested structure
      const nestedDir = path.join(skillPath, 'a', 'b', 'c');
      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(path.join(nestedDir, 'deep.txt'), 'deep content');
      await fs.writeFile(path.join(skillPath, 'scripts', 'extra.sh'), '#!/bin/bash\necho "test"');

      // Uninstall
      await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      // Verify all nested content is removed
      await expect(fs.stat(skillPath)).rejects.toThrow();
    });

    it('skill no longer appears in list after uninstall', async () => {
      const skillName = 'list-removal-test';
      await createTestSkill(skillName);

      // Verify skill is in list
      const beforeList = await list({ targetPath: skillsDir });
      expect(beforeList.some((s) => s.name === skillName)).toBe(true);

      // Uninstall
      await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      // Verify skill is not in list
      const afterList = await list({ targetPath: skillsDir });
      expect(afterList.some((s) => s.name === skillName)).toBe(false);
    });
  });

  describe('consistency with CLI uninstall', () => {
    it('API uninstall produces same result as CLI uninstall', async () => {
      // Create two identical skills in a project structure
      // The CLI only supports 'project' or 'personal' scope, not custom paths
      const projectRoot = path.join(tempDir, 'test-project');
      const projectSkillsDir = path.join(projectRoot, '.claude', 'skills');
      await fs.mkdir(projectSkillsDir, { recursive: true });

      const apiSkillName = 'api-uninstall-skill';
      const cliSkillName = 'cli-uninstall-skill';

      // Scaffold directly to the project skills directory
      await scaffold({
        name: apiSkillName,
        output: projectSkillsDir,
      });
      await scaffold({
        name: cliSkillName,
        output: projectSkillsDir,
      });

      // Uninstall via API using targetPath
      const apiResult = await uninstall({
        names: [apiSkillName],
        targetPath: projectSkillsDir,
        force: true,
      });

      // Uninstall via CLI using project scope with cwd override
      execSync(`node "${cliPath}" uninstall "${cliSkillName}" --scope project --force`, {
        encoding: 'utf-8',
        cwd: projectRoot,
      });

      // Both should be removed
      await expect(fs.stat(path.join(projectSkillsDir, apiSkillName))).rejects.toThrow();
      await expect(fs.stat(path.join(projectSkillsDir, cliSkillName))).rejects.toThrow();

      // API result should indicate success
      expect(apiResult.removed).toContain(apiSkillName);
    });
  });

  describe('scaffold -> package -> install -> uninstall workflow', () => {
    it('full lifecycle works end-to-end', async () => {
      const skillName = 'lifecycle-skill';

      // Step 1: Scaffold
      const scaffoldResult = await scaffold({
        name: skillName,
        description: 'Testing full lifecycle',
        output: tempDir,
      });
      expect(scaffoldResult.path).toBeDefined();

      // Step 2: Package
      const packageDir = path.join(tempDir, 'packages');
      await fs.mkdir(packageDir, { recursive: true });

      const packageResult = await createPackage({
        path: scaffoldResult.path,
        output: packageDir,
      });
      expect(packageResult.packagePath).toBeDefined();

      // Step 3: Install to skills directory
      const installResult = await install({
        file: packageResult.packagePath,
        targetPath: skillsDir,
      });
      expect(installResult.installedPath).toBeDefined();

      // Verify skill is installed
      const installedSkillPath = path.join(skillsDir, skillName);
      expect((await fs.stat(installedSkillPath)).isDirectory()).toBe(true);

      // Step 4: Uninstall
      const uninstallResult = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      expect(uninstallResult.removed).toContain(skillName);
      expect(uninstallResult.notFound).toHaveLength(0);

      // Verify skill is completely removed
      await expect(fs.stat(installedSkillPath)).rejects.toThrow();
    });
  });

  describe('batch uninstall', () => {
    it('uninstalls multiple skills in one call', async () => {
      const skills = ['batch-skill-1', 'batch-skill-2', 'batch-skill-3'];

      // Create all skills
      for (const name of skills) {
        await createTestSkill(name);
      }

      // Verify all exist
      for (const name of skills) {
        const skillPath = path.join(skillsDir, name);
        expect((await fs.stat(skillPath)).isDirectory()).toBe(true);
      }

      // Uninstall all at once
      const result = await uninstall({
        names: skills,
        targetPath: skillsDir,
        force: true,
      });

      // Verify results
      expect(result.removed).toHaveLength(3);
      expect(result.removed).toEqual(expect.arrayContaining(skills));
      expect(result.notFound).toHaveLength(0);

      // Verify all are removed
      for (const name of skills) {
        const skillPath = path.join(skillsDir, name);
        await expect(fs.stat(skillPath)).rejects.toThrow();
      }
    });

    it('handles partial success in batch operations', async () => {
      // Create only some skills
      await createTestSkill('batch-exists-1');
      await createTestSkill('batch-exists-2');
      // 'batch-missing' does not exist

      const result = await uninstall({
        names: ['batch-exists-1', 'batch-missing', 'batch-exists-2'],
        targetPath: skillsDir,
        force: true,
      });

      // Check results
      expect(result.removed).toContain('batch-exists-1');
      expect(result.removed).toContain('batch-exists-2');
      expect(result.notFound).toContain('batch-missing');

      // Verify removed skills are gone
      await expect(fs.stat(path.join(skillsDir, 'batch-exists-1'))).rejects.toThrow();
      await expect(fs.stat(path.join(skillsDir, 'batch-exists-2'))).rejects.toThrow();
    });

    it('continues after not-found errors', async () => {
      await createTestSkill('continue-first');
      await createTestSkill('continue-last');

      const result = await uninstall({
        names: ['continue-first', 'continue-middle-missing', 'continue-last'],
        targetPath: skillsDir,
        force: true,
      });

      // Should have processed all skills
      expect(result.removed).toContain('continue-first');
      expect(result.removed).toContain('continue-last');
      expect(result.notFound).toContain('continue-middle-missing');
    });
  });

  describe('dry run mode', () => {
    it('does not remove files in dry run', async () => {
      const skillName = 'dry-run-preserved';
      const skillPath = await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
      expect(result.removed).toContain(skillName);

      // Skill should still exist
      expect((await fs.stat(skillPath)).isDirectory()).toBe(true);
    });

    it('reports what would be removed without changes', async () => {
      const skills = ['dry-batch-1', 'dry-batch-2'];
      for (const name of skills) {
        await createTestSkill(name);
      }

      const result = await uninstall({
        names: skills,
        targetPath: skillsDir,
        dryRun: true,
      });

      // All should be reported as removed
      expect(result.removed).toEqual(expect.arrayContaining(skills));

      // But all should still exist
      for (const name of skills) {
        const skillPath = path.join(skillsDir, name);
        expect((await fs.stat(skillPath)).isDirectory()).toBe(true);
      }
    });
  });

  describe('AbortSignal cancellation', () => {
    it('respects pre-aborted signal', async () => {
      const skillName = 'abort-test';
      await createTestSkill(skillName);

      const controller = new AbortController();
      controller.abort();

      await expect(
        uninstall({
          names: [skillName],
          targetPath: skillsDir,
          force: true,
          signal: controller.signal,
        })
      ).rejects.toThrow(CancellationError);

      // Skill should NOT be removed
      const skillPath = path.join(skillsDir, skillName);
      expect((await fs.stat(skillPath)).isDirectory()).toBe(true);
    });

    it('completes successfully with non-aborted signal', async () => {
      const skillName = 'no-abort-test';
      await createTestSkill(skillName);

      const controller = new AbortController();

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
        signal: controller.signal,
      });

      expect(result.removed).toContain(skillName);

      // Skill should be removed
      await expect(fs.stat(path.join(skillsDir, skillName))).rejects.toThrow();
    });
  });

  describe('security validation', () => {
    it('rejects path traversal attempts', async () => {
      await expect(
        uninstall({
          names: ['../../../etc/passwd'],
          targetPath: skillsDir,
          force: true,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('does not delete files outside skills directory on traversal attempt', async () => {
      // Create a file outside skills directory
      const outsideFile = path.join(tempDir, 'outside.txt');
      await fs.writeFile(outsideFile, 'should not be deleted');

      try {
        await uninstall({
          names: ['../outside.txt'],
          targetPath: skillsDir,
          force: true,
        });
      } catch {
        // Expected to throw
      }

      // File should still exist
      expect((await fs.stat(outsideFile)).isFile()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('handles non-existent skills gracefully', async () => {
      const result = await uninstall({
        names: ['completely-fictional-skill'],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.notFound).toContain('completely-fictional-skill');
      expect(result.removed).toHaveLength(0);
    });
  });

  describe('result object', () => {
    it('removed array contains exact skill names', async () => {
      const skillName = 'exact-name-skill';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toEqual([skillName]);
    });

    it('notFound array contains exact skill names', async () => {
      const missingName = 'exact-missing-skill';

      const result = await uninstall({
        names: [missingName],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.notFound).toEqual([missingName]);
    });

    it('maintains order in removed array', async () => {
      const skills = ['z-skill', 'a-skill', 'm-skill'];
      for (const name of skills) {
        await createTestSkill(name);
      }

      const result = await uninstall({
        names: skills,
        targetPath: skillsDir,
        force: true,
      });

      // Should maintain input order
      expect(result.removed).toEqual(skills);
    });
  });

  describe('complex skills', () => {
    it('removes skill with many files', async () => {
      const skillName = 'many-files-skill';
      const skillPath = await createTestSkill(skillName);

      // Add many files
      for (let i = 0; i < 20; i++) {
        await fs.writeFile(path.join(skillPath, `file-${i}.txt`), `content ${i}`);
      }

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toContain(skillName);
      await expect(fs.stat(skillPath)).rejects.toThrow();
    });

    it('removes skill with deep nesting', async () => {
      const skillName = 'deep-nesting-skill';
      const skillPath = await createTestSkill(skillName);

      // Create deeply nested structure
      let currentPath = skillPath;
      for (let i = 0; i < 10; i++) {
        currentPath = path.join(currentPath, `level-${i}`);
        await fs.mkdir(currentPath, { recursive: true });
        await fs.writeFile(path.join(currentPath, 'file.txt'), `level ${i}`);
      }

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toContain(skillName);
      await expect(fs.stat(skillPath)).rejects.toThrow();
    });
  });

  describe('concurrent safety', () => {
    it('handles multiple uninstalls of same skill gracefully', async () => {
      const skillName = 'concurrent-test-skill';
      await createTestSkill(skillName);

      // Try to uninstall the same skill twice concurrently
      const results = await Promise.allSettled([
        uninstall({
          names: [skillName],
          targetPath: skillsDir,
          force: true,
        }),
        uninstall({
          names: [skillName],
          targetPath: skillsDir,
          force: true,
        }),
      ]);

      // At least one should succeed, the other may report not-found
      const successes = results.filter((r) => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThanOrEqual(1);

      // Skill should be gone
      await expect(fs.stat(path.join(skillsDir, skillName))).rejects.toThrow();
    });
  });
});
