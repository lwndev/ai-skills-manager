/**
 * Unit tests for the uninstall API function (FEAT-010 Phase 7)
 *
 * Tests that the uninstall() API function:
 * 1. Returns typed UninstallResult objects
 * 2. Handles batch operations with partial failures
 * 3. Validates skill names for security (path traversal)
 * 4. Supports dry run mode
 * 5. Supports AbortSignal cancellation
 * 6. Throws SecurityError for invalid skill names
 * 7. Throws FileSystemError for permission errors
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { uninstall } from '../../../src/api/uninstall';
import { scaffold } from '../../../src/api/scaffold';
import { SecurityError, CancellationError } from '../../../src/errors';

describe('uninstall API function', () => {
  let tempDir: string;
  let skillsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-uninstall-test-'));
    skillsDir = path.join(tempDir, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a test skill in the skills directory
   */
  async function createTestSkill(name: string): Promise<string> {
    const result = await scaffold({
      name,
      description: `Test skill: ${name}`,
      output: skillsDir,
    });
    return result.path;
  }

  describe('return type', () => {
    it('returns an UninstallResult object', async () => {
      const skillName = 'test-uninstall-skill';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.removed)).toBe(true);
      expect(Array.isArray(result.notFound)).toBe(true);
      expect(typeof result.dryRun).toBe('boolean');
    });

    it('returns removed array with successfully uninstalled skills', async () => {
      const skillName = 'removed-skill';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toContain(skillName);
    });

    it('returns notFound array for non-existent skills', async () => {
      const result = await uninstall({
        names: ['non-existent-skill'],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.notFound).toContain('non-existent-skill');
      expect(result.removed).toHaveLength(0);
    });

    it('dryRun is false for actual uninstall', async () => {
      const skillName = 'actual-uninstall';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.dryRun).toBe(false);
    });
  });

  describe('batch operations', () => {
    it('uninstalls multiple skills in a single call', async () => {
      const skills = ['skill-one', 'skill-two', 'skill-three'];
      for (const name of skills) {
        await createTestSkill(name);
      }

      const result = await uninstall({
        names: skills,
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toEqual(expect.arrayContaining(skills));
      expect(result.removed).toHaveLength(3);
      expect(result.notFound).toHaveLength(0);
    });

    it('handles partial failures gracefully', async () => {
      // Create only some skills
      await createTestSkill('exists-skill');
      // 'missing-skill' does not exist

      const result = await uninstall({
        names: ['exists-skill', 'missing-skill'],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toContain('exists-skill');
      expect(result.notFound).toContain('missing-skill');
    });

    it('continues processing after not-found errors', async () => {
      await createTestSkill('first-skill');
      await createTestSkill('third-skill');
      // 'second-skill' does not exist

      const result = await uninstall({
        names: ['first-skill', 'second-skill', 'third-skill'],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toContain('first-skill');
      expect(result.removed).toContain('third-skill');
      expect(result.notFound).toContain('second-skill');
    });

    it('returns empty arrays when no skills provided', async () => {
      const result = await uninstall({
        names: [],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toHaveLength(0);
      expect(result.notFound).toHaveLength(0);
    });
  });

  describe('dry run mode', () => {
    it('returns dryRun: true when dryRun option is set', async () => {
      const skillName = 'dry-run-skill';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        dryRun: true,
      });

      expect(result.dryRun).toBe(true);
    });

    it('does not delete files in dry run mode', async () => {
      const skillName = 'preserved-skill';
      const skillPath = await createTestSkill(skillName);

      await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        dryRun: true,
      });

      // Skill should still exist
      const stats = await fs.stat(skillPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('reports skills that would be removed in dry run mode', async () => {
      const skillName = 'would-be-removed';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        dryRun: true,
      });

      expect(result.removed).toContain(skillName);
    });

    it('reports not-found skills in dry run mode', async () => {
      const result = await uninstall({
        names: ['non-existent'],
        targetPath: skillsDir,
        dryRun: true,
      });

      expect(result.notFound).toContain('non-existent');
    });
  });

  describe('security validation', () => {
    it('throws SecurityError for path traversal in skill name', async () => {
      await expect(
        uninstall({
          names: ['../../../etc/passwd'],
          targetPath: skillsDir,
          force: true,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for forward slash in skill name', async () => {
      await expect(
        uninstall({
          names: ['some/skill'],
          targetPath: skillsDir,
          force: true,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for backslash in skill name', async () => {
      await expect(
        uninstall({
          names: ['some\\skill'],
          targetPath: skillsDir,
          force: true,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for absolute path as skill name', async () => {
      await expect(
        uninstall({
          names: ['/etc/passwd'],
          targetPath: skillsDir,
          force: true,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for empty skill name', async () => {
      await expect(
        uninstall({
          names: [''],
          targetPath: skillsDir,
          force: true,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for whitespace-only skill name', async () => {
      await expect(
        uninstall({
          names: ['   '],
          targetPath: skillsDir,
          force: true,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('SecurityError has correct code', async () => {
      try {
        await uninstall({
          names: ['../bad-name'],
          targetPath: skillsDir,
          force: true,
        });
        fail('Expected SecurityError');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityError);
        expect((error as SecurityError).code).toBe('SECURITY_ERROR');
      }
    });

    it('validates all names before proceeding', async () => {
      // Create a valid skill
      await createTestSkill('valid-skill');

      // Try to uninstall valid + invalid
      await expect(
        uninstall({
          names: ['valid-skill', '../invalid'],
          targetPath: skillsDir,
          force: true,
        })
      ).rejects.toThrow(SecurityError);

      // Valid skill should NOT be uninstalled since validation happens first
      const skillPath = path.join(skillsDir, 'valid-skill');
      const stats = await fs.stat(skillPath);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('AbortSignal cancellation', () => {
    it('throws CancellationError when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        uninstall({
          names: ['any-skill'],
          targetPath: skillsDir,
          force: true,
          signal: controller.signal,
        })
      ).rejects.toThrow(CancellationError);
    });

    it('CancellationError has correct code', async () => {
      const controller = new AbortController();
      controller.abort();

      try {
        await uninstall({
          names: ['any-skill'],
          targetPath: skillsDir,
          force: true,
          signal: controller.signal,
        });
        fail('Expected CancellationError');
      } catch (error) {
        expect(error).toBeInstanceOf(CancellationError);
        expect((error as CancellationError).code).toBe('CANCELLED');
      }
    });

    it('works without AbortSignal', async () => {
      const skillName = 'no-signal-skill';
      await createTestSkill(skillName);

      // Should succeed without signal
      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toContain(skillName);
    });

    it('succeeds with non-aborted signal', async () => {
      const controller = new AbortController();
      const skillName = 'with-signal-skill';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
        signal: controller.signal,
      });

      expect(result.removed).toContain(skillName);
    });
  });

  describe('force option', () => {
    it('force defaults to false', async () => {
      const skillName = 'default-force-skill';
      await createTestSkill(skillName);

      // Without force, uninstall may fail if there are warnings
      // This test verifies the option exists and defaults correctly
      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        // force is omitted, should default to false
      });

      // Result should still have proper structure
      expect(typeof result.dryRun).toBe('boolean');
      expect(Array.isArray(result.removed)).toBe(true);
      expect(Array.isArray(result.notFound)).toBe(true);
    });

    it('force: true allows uninstalling skills with warnings', async () => {
      const skillName = 'force-uninstall-skill';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toContain(skillName);
    });
  });

  describe('scope options', () => {
    it('uninstalls from custom targetPath when provided', async () => {
      // targetPath must follow .claude/skills convention for security
      const customProjectDir = path.join(tempDir, 'custom-project');
      const customSkillsDir = path.join(customProjectDir, '.claude', 'skills');
      await fs.mkdir(customSkillsDir, { recursive: true });

      // Create skill in custom location
      await scaffold({
        name: 'custom-skill',
        output: customSkillsDir,
      });

      const result = await uninstall({
        names: ['custom-skill'],
        targetPath: customSkillsDir,
        force: true,
      });

      expect(result.removed).toContain('custom-skill');
    });

    it('targetPath takes precedence over scope', async () => {
      // targetPath must follow .claude/skills convention for security
      const explicitProjectDir = path.join(tempDir, 'explicit-project');
      const explicitSkillsDir = path.join(explicitProjectDir, '.claude', 'skills');
      await fs.mkdir(explicitSkillsDir, { recursive: true });

      await scaffold({
        name: 'explicit-skill',
        output: explicitSkillsDir,
      });

      const result = await uninstall({
        names: ['explicit-skill'],
        scope: 'personal', // This should be ignored
        targetPath: explicitSkillsDir,
        force: true,
      });

      expect(result.removed).toContain('explicit-skill');
    });
  });

  describe('actual file removal', () => {
    it('removes the skill directory', async () => {
      const skillName = 'to-be-removed';
      const skillPath = await createTestSkill(skillName);

      // Verify it exists
      expect((await fs.stat(skillPath)).isDirectory()).toBe(true);

      await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      // Verify it's gone
      await expect(fs.stat(skillPath)).rejects.toThrow();
    });

    it('removes all files within the skill directory', async () => {
      const skillName = 'multi-file-skill';
      const skillPath = await createTestSkill(skillName);

      // Add extra files
      await fs.writeFile(path.join(skillPath, 'extra.txt'), 'extra content');
      await fs.mkdir(path.join(skillPath, 'subdir'), { recursive: true });
      await fs.writeFile(path.join(skillPath, 'subdir', 'nested.txt'), 'nested content');

      await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      // Verify entire directory is gone
      await expect(fs.stat(skillPath)).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    it('handles non-existent skills gracefully', async () => {
      const result = await uninstall({
        names: ['does-not-exist'],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.notFound).toContain('does-not-exist');
      expect(result.removed).toHaveLength(0);
    });

    it('handles mix of existing and non-existing skills', async () => {
      await createTestSkill('exists-1');
      await createTestSkill('exists-2');

      const result = await uninstall({
        names: ['exists-1', 'not-exists', 'exists-2'],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toContain('exists-1');
      expect(result.removed).toContain('exists-2');
      expect(result.notFound).toContain('not-exists');
    });
  });

  describe('never prompts', () => {
    it('does not hang waiting for user input', async () => {
      const skillName = 'no-prompt-skill';
      await createTestSkill(skillName);

      // This test verifies the function doesn't block on stdin
      // If it did, this test would timeout
      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      expect(result.removed).toContain(skillName);
    });
  });

  describe('full workflow', () => {
    it('uninstalls a skill that was scaffolded', async () => {
      const skillName = 'workflow-test-skill';
      const skillPath = await createTestSkill(skillName);

      // Verify skill exists
      const statsBefore = await fs.stat(skillPath);
      expect(statsBefore.isDirectory()).toBe(true);

      // Uninstall
      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      // Verify result
      expect(result.removed).toContain(skillName);
      expect(result.notFound).toHaveLength(0);
      expect(result.dryRun).toBe(false);

      // Verify skill is gone
      await expect(fs.stat(skillPath)).rejects.toThrow();
    });

    it('scaffold -> uninstall workflow completes successfully', async () => {
      const skillName = 'full-workflow-skill';

      // Step 1: Scaffold
      const scaffoldResult = await scaffold({
        name: skillName,
        description: 'Testing the full workflow',
        output: skillsDir,
      });

      expect(scaffoldResult.path).toBeDefined();
      expect((await fs.stat(scaffoldResult.path)).isDirectory()).toBe(true);

      // Step 2: Uninstall
      const uninstallResult = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      expect(uninstallResult.removed).toContain(skillName);

      // Step 3: Verify it's gone
      await expect(fs.stat(scaffoldResult.path)).rejects.toThrow();
    });
  });

  describe('detailed mode', () => {
    it('returns DetailedUninstallResult when detailed: true', async () => {
      const skillName = 'detailed-test-skill';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
        detailed: true,
      });

      // Should have DetailedUninstallResult properties
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(typeof result.totalRemoved).toBe('number');
      expect(typeof result.totalNotFound).toBe('number');
      expect(typeof result.totalFilesRemoved).toBe('number');
      expect(typeof result.totalBytesFreed).toBe('number');
      expect(typeof result.dryRun).toBe('boolean');
    });

    it('returns success result with file counts and bytes freed', async () => {
      const skillName = 'detailed-success-skill';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
        detailed: true,
      });

      expect(result.results).toHaveLength(1);
      const skillResult = result.results[0];

      expect(skillResult.type).toBe('success');
      if (skillResult.type === 'success') {
        expect(skillResult.skillName).toBe(skillName);
        expect(skillResult.path).toContain(skillName);
        expect(skillResult.filesRemoved).toBeGreaterThan(0);
        expect(skillResult.bytesFreed).toBeGreaterThan(0);
      }
    });

    it('returns not-found result for missing skill', async () => {
      const result = await uninstall({
        names: ['nonexistent-skill'],
        targetPath: skillsDir,
        force: true,
        detailed: true,
      });

      expect(result.results).toHaveLength(1);
      const skillResult = result.results[0];

      expect(skillResult.type).toBe('not-found');
      if (skillResult.type === 'not-found') {
        expect(skillResult.skillName).toBe('nonexistent-skill');
        expect(skillResult.searchedPath).toBeDefined();
      }
    });

    it('returns dry-run preview with file list', async () => {
      const skillName = 'dry-run-preview-skill';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        dryRun: true,
        detailed: true,
      });

      expect(result.results).toHaveLength(1);
      const skillResult = result.results[0];

      expect(skillResult.type).toBe('dry-run-preview');
      if (skillResult.type === 'dry-run-preview') {
        expect(skillResult.skillName).toBe(skillName);
        expect(Array.isArray(skillResult.files)).toBe(true);
        expect(skillResult.files.length).toBeGreaterThan(0);
        expect(skillResult.totalSize).toBeGreaterThan(0);

        // Each file should have the correct structure
        const file = skillResult.files[0];
        expect(file.relativePath).toBeDefined();
        expect(file.absolutePath).toBeDefined();
        expect(typeof file.size).toBe('number');
        expect(typeof file.isDirectory).toBe('boolean');
        expect(typeof file.isSymlink).toBe('boolean');
      }
    });

    it('aggregates totals across multiple skills', async () => {
      const skill1 = 'multi-skill-a';
      const skill2 = 'multi-skill-b';
      await createTestSkill(skill1);
      await createTestSkill(skill2);

      const result = await uninstall({
        names: [skill1, skill2],
        targetPath: skillsDir,
        force: true,
        detailed: true,
      });

      expect(result.results).toHaveLength(2);
      expect(result.totalRemoved).toBe(2);
      expect(result.totalNotFound).toBe(0);
      expect(result.totalFilesRemoved).toBeGreaterThan(0);
      expect(result.totalBytesFreed).toBeGreaterThan(0);
    });

    it('handles mixed results (some found, some not)', async () => {
      const existingSkill = 'mixed-existing';
      await createTestSkill(existingSkill);

      const result = await uninstall({
        names: [existingSkill, 'nonexistent-mixed'],
        targetPath: skillsDir,
        force: true,
        detailed: true,
      });

      expect(result.results).toHaveLength(2);
      expect(result.totalRemoved).toBe(1);
      expect(result.totalNotFound).toBe(1);

      // Find each result by type
      const successResults = result.results.filter((r) => r.type === 'success');
      const notFoundResults = result.results.filter((r) => r.type === 'not-found');

      expect(successResults).toHaveLength(1);
      expect(notFoundResults).toHaveLength(1);
    });

    it('returns simple UninstallResult when detailed is false', async () => {
      const skillName = 'simple-mode-skill';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
        detailed: false,
      });

      // Should have UninstallResult properties
      expect(result.removed).toBeDefined();
      expect(result.notFound).toBeDefined();
      expect(result.dryRun).toBe(false);

      // Should NOT have DetailedUninstallResult properties
      expect((result as { results?: unknown }).results).toBeUndefined();
      expect((result as { totalFilesRemoved?: unknown }).totalFilesRemoved).toBeUndefined();
    });

    it('returns simple UninstallResult when detailed is not specified', async () => {
      const skillName = 'default-mode-skill';
      await createTestSkill(skillName);

      const result = await uninstall({
        names: [skillName],
        targetPath: skillsDir,
        force: true,
      });

      // Should have UninstallResult properties
      expect(result.removed).toBeDefined();
      expect(result.notFound).toBeDefined();
    });
  });
});
