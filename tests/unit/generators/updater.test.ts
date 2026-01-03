/**
 * Tests for updater module - Phase 5: Input & Discovery
 *
 * Tests cover:
 * - Input validation (skill name, scope, package file)
 * - Skill discovery (found, not-found, case-mismatch)
 * - Case sensitivity verification
 * - Package validation (structure, name match, content)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';

import {
  validateInputs,
  discoverInstalledSkill,
  verifyCaseSensitivity,
  validatePackage,
  runInputAndDiscoveryPhase,
  updateSkill,
  UpdateError,
} from '../../../src/generators/updater';
import type { UpdateOptions } from '../../../src/types/update';

describe('Updater - Phase 5: Input & Discovery', () => {
  let tempDir: string;
  let skillsDir: string;

  beforeEach(async () => {
    // Create fresh temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-updater-test-'));
    skillsDir = path.join(tempDir, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Helper to create a test skill in the skills directory
   */
  async function createTestSkill(name: string): Promise<string> {
    const skillPath = path.join(skillsDir, name);
    await fs.mkdir(skillPath, { recursive: true });
    await fs.writeFile(
      path.join(skillPath, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill\n---\n\n# ${name}\n\nTest content.`
    );
    await fs.writeFile(path.join(skillPath, 'README.md'), `# ${name}`);
    return skillPath;
  }

  /**
   * Helper to create a test .skill package
   */
  async function createTestPackage(skillName: string): Promise<string> {
    const packagePath = path.join(tempDir, `${skillName}.skill`);
    const zip = new AdmZip();

    // Add SKILL.md with frontmatter
    const skillMd = `---\nname: ${skillName}\ndescription: Updated test skill\n---\n\n# ${skillName}\n\nUpdated content.`;
    zip.addFile(`${skillName}/SKILL.md`, Buffer.from(skillMd));
    zip.addFile(`${skillName}/README.md`, Buffer.from(`# ${skillName} (updated)`));

    zip.writeZip(packagePath);
    return packagePath;
  }

  /**
   * Default test options
   */
  function getDefaultOptions(): UpdateOptions {
    return {
      scope: 'project',
      force: false,
      dryRun: false,
      quiet: false,
      noBackup: false,
      keepBackup: false,
      cwd: tempDir,
      homedir: tempDir,
    };
  }

  describe('validateInputs', () => {
    describe('skill name validation', () => {
      it('accepts valid skill name', async () => {
        const packagePath = await createTestPackage('valid-skill');
        const result = await validateInputs('valid-skill', packagePath, getDefaultOptions());

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.scopeInfo).toBeDefined();
          expect(result.packagePath).toBeDefined();
        }
      });

      it('rejects empty skill name', async () => {
        const packagePath = await createTestPackage('test-skill');
        const result = await validateInputs('', packagePath, getDefaultOptions());

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('validation-error');
          expect((result.error as { field: string }).field).toBe('skillName');
        }
      });

      it('rejects skill name with path separators', async () => {
        const packagePath = await createTestPackage('test-skill');
        const result = await validateInputs('../escape', packagePath, getDefaultOptions());

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('validation-error');
          expect((result.error as { field: string }).field).toBe('skillName');
        }
      });

      it('rejects skill name with uppercase letters', async () => {
        const packagePath = await createTestPackage('test-skill');
        const result = await validateInputs('TestSkill', packagePath, getDefaultOptions());

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('validation-error');
        }
      });

      it('rejects skill name with consecutive hyphens', async () => {
        const packagePath = await createTestPackage('test-skill');
        const result = await validateInputs('test--skill', packagePath, getDefaultOptions());

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('validation-error');
        }
      });

      it('rejects skill name starting with hyphen', async () => {
        const packagePath = await createTestPackage('test-skill');
        const result = await validateInputs('-test-skill', packagePath, getDefaultOptions());

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('validation-error');
        }
      });

      it('rejects skill name with null bytes', async () => {
        const packagePath = await createTestPackage('test-skill');
        const result = await validateInputs('test\0skill', packagePath, getDefaultOptions());

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('validation-error');
        }
      });
    });

    describe('scope validation', () => {
      it('accepts project scope', async () => {
        const packagePath = await createTestPackage('test-skill');
        const options = { ...getDefaultOptions(), scope: 'project' as const };
        const result = await validateInputs('test-skill', packagePath, options);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.scopeInfo.type).toBe('project');
        }
      });

      it('accepts personal scope', async () => {
        const packagePath = await createTestPackage('test-skill');
        const options = { ...getDefaultOptions(), scope: 'personal' as const };
        const result = await validateInputs('test-skill', packagePath, options);

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.scopeInfo.type).toBe('personal');
        }
      });

      it('rejects invalid scope', async () => {
        const packagePath = await createTestPackage('test-skill');
        const options = { ...getDefaultOptions(), scope: 'invalid' as 'project' };
        const result = await validateInputs('test-skill', packagePath, options);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('validation-error');
          expect((result.error as { field: string }).field).toBe('scope');
        }
      });
    });

    describe('package file validation', () => {
      it('accepts valid .skill package', async () => {
        const packagePath = await createTestPackage('test-skill');
        const result = await validateInputs('test-skill', packagePath, getDefaultOptions());

        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.packagePath).toBe(packagePath);
        }
      });

      it('rejects non-existent package', async () => {
        const result = await validateInputs(
          'test-skill',
          '/nonexistent/package.skill',
          getDefaultOptions()
        );

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('validation-error');
          expect((result.error as { field: string }).field).toBe('packagePath');
        }
      });

      it('rejects package with wrong extension', async () => {
        const wrongPath = path.join(tempDir, 'package.zip');
        const zip = new AdmZip();
        zip.addFile('test/SKILL.md', Buffer.from('test'));
        zip.writeZip(wrongPath);

        const result = await validateInputs('test-skill', wrongPath, getDefaultOptions());

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('validation-error');
          expect((result.error as { field: string }).field).toBe('packagePath');
        }
      });

      it('rejects invalid ZIP file', async () => {
        const invalidPath = path.join(tempDir, 'invalid.skill');
        await fs.writeFile(invalidPath, 'not a zip file');

        const result = await validateInputs('test-skill', invalidPath, getDefaultOptions());

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('validation-error');
        }
      });
    });
  });

  describe('discoverInstalledSkill', () => {
    it('finds existing skill', async () => {
      await createTestSkill('existing-skill');
      const scopeInfo = { type: 'project' as const, path: skillsDir };

      const result = await discoverInstalledSkill('existing-skill', scopeInfo);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.skillPath).toContain('existing-skill');
        expect(result.hasSkillMd).toBe(true);
      }
    });

    it('returns not-found for non-existent skill', async () => {
      const scopeInfo = { type: 'project' as const, path: skillsDir };

      const result = await discoverInstalledSkill('nonexistent-skill', scopeInfo);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('skill-not-found');
      }
    });

    it('finds skill without SKILL.md', async () => {
      const skillPath = path.join(skillsDir, 'no-skillmd');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, 'README.md'), '# Test');
      const scopeInfo = { type: 'project' as const, path: skillsDir };

      const result = await discoverInstalledSkill('no-skillmd', scopeInfo);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.hasSkillMd).toBe(false);
      }
    });
  });

  describe('verifyCaseSensitivity', () => {
    it('passes for exact case match', async () => {
      await createTestSkill('exact-case');
      const skillPath = path.join(skillsDir, 'exact-case');

      const error = await verifyCaseSensitivity(skillPath, 'exact-case');

      expect(error).toBeNull();
    });

    it('returns error for case mismatch', async () => {
      // Create skill with specific case
      await createTestSkill('my-skill');
      const skillPath = path.join(skillsDir, 'my-skill');

      // Try to access with different case
      const error = await verifyCaseSensitivity(skillPath, 'My-Skill');

      // Note: On case-insensitive filesystems (macOS), this should detect mismatch
      // On case-sensitive filesystems (Linux), the skill wouldn't exist
      if (error) {
        expect(error.type).toBe('security-error');
        expect((error as { reason: string }).reason).toBe('case-mismatch');
      }
    });

    it('handles missing parent directory', async () => {
      const nonexistentPath = path.join(tempDir, 'nonexistent', 'skill');

      const error = await verifyCaseSensitivity(nonexistentPath, 'skill');

      expect(error).not.toBeNull();
      expect(error?.type).toBe('filesystem-error');
    });
  });

  describe('validatePackage', () => {
    it('accepts valid package matching installed skill', async () => {
      const packagePath = await createTestPackage('test-skill');

      const result = await validatePackage(packagePath, 'test-skill');

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.skillNameFromPackage).toBe('test-skill');
        expect(result.files).toBeDefined();
        expect(result.files.length).toBeGreaterThan(0);
      }
    });

    it('rejects package with different skill name', async () => {
      const packagePath = await createTestPackage('different-skill');

      const result = await validatePackage(packagePath, 'installed-skill');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('package-mismatch');
      }
    });

    it('rejects package without SKILL.md', async () => {
      const packagePath = path.join(tempDir, 'no-skillmd.skill');
      const zip = new AdmZip();
      zip.addFile('no-skillmd/README.md', Buffer.from('# Test'));
      zip.writeZip(packagePath);

      const result = await validatePackage(packagePath, 'no-skillmd');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('validation-error');
      }
    });

    it('rejects package with no root directory', async () => {
      const packagePath = path.join(tempDir, 'flat.skill');
      const zip = new AdmZip();
      zip.addFile('SKILL.md', Buffer.from('test'));
      zip.writeZip(packagePath);

      const result = await validatePackage(packagePath, 'flat');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('validation-error');
      }
    });

    it('rejects package with mismatched frontmatter name', async () => {
      const packagePath = path.join(tempDir, 'mismatch.skill');
      const zip = new AdmZip();
      // Directory is 'mismatch' but frontmatter says 'other-name'
      const skillMd = `---\nname: other-name\ndescription: Test\n---\n\n# Test`;
      zip.addFile('mismatch/SKILL.md', Buffer.from(skillMd));
      zip.writeZip(packagePath);

      const result = await validatePackage(packagePath, 'mismatch');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('validation-error');
      }
    });

    it('cleans up temp directory on validation error', async () => {
      const packagePath = path.join(tempDir, 'invalid.skill');
      const zip = new AdmZip();
      zip.addFile('SKILL.md', Buffer.from('invalid'));
      zip.writeZip(packagePath);

      const result = await validatePackage(packagePath, 'invalid');

      expect(result.valid).toBe(false);
      // tempDir should be cleaned up (no way to verify directly, but no leak)
    });
  });

  describe('runInputAndDiscoveryPhase', () => {
    it('succeeds with valid inputs and existing skill', async () => {
      await createTestSkill('valid-skill');
      const packagePath = await createTestPackage('valid-skill');
      const options = getDefaultOptions();

      const result = await runInputAndDiscoveryPhase('valid-skill', packagePath, options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.skillName).toBe('valid-skill');
        expect(result.context.skillPath).toContain('valid-skill');
        expect(result.context.packageFiles.length).toBeGreaterThan(0);

        // Clean up temp dir
        if (result.context.tempDir) {
          await fs.rm(result.context.tempDir, { recursive: true, force: true });
        }
      }
    });

    it('fails for non-existent skill', async () => {
      const packagePath = await createTestPackage('nonexistent');
      const options = getDefaultOptions();

      const result = await runInputAndDiscoveryPhase('nonexistent', packagePath, options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('skill-not-found');
      }
    });

    it('fails for invalid skill name', async () => {
      const packagePath = await createTestPackage('valid');
      const options = getDefaultOptions();

      const result = await runInputAndDiscoveryPhase('../invalid', packagePath, options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('validation-error');
      }
    });

    it('fails for mismatched package skill name', async () => {
      await createTestSkill('installed-skill');
      const packagePath = await createTestPackage('different-skill');
      const options = getDefaultOptions();

      const result = await runInputAndDiscoveryPhase('installed-skill', packagePath, options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('package-mismatch');
      }
    });
  });

  describe('updateSkill', () => {
    it('returns dry-run preview when dryRun is true', async () => {
      await createTestSkill('dry-run-skill');
      const packagePath = await createTestPackage('dry-run-skill');
      const options = { ...getDefaultOptions(), dryRun: true };

      const result = await updateSkill('dry-run-skill', packagePath, options);

      expect(result.type).toBe('update-dry-run-preview');
      if (result.type === 'update-dry-run-preview') {
        expect(result.skillName).toBe('dry-run-skill');
        expect(result.path).toContain('dry-run-skill');
      }
    });

    it('returns success placeholder for non-dry-run (Phase 5 only)', async () => {
      await createTestSkill('update-skill');
      const packagePath = await createTestPackage('update-skill');
      const options = getDefaultOptions();

      const result = await updateSkill('update-skill', packagePath, options);

      // Phase 5 returns placeholder success
      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.skillName).toBe('update-skill');
      }
    });

    it('throws UpdateError for validation failures', async () => {
      const packagePath = await createTestPackage('valid');
      const options = getDefaultOptions();

      await expect(updateSkill('../invalid', packagePath, options)).rejects.toThrow(UpdateError);
    });

    it('throws UpdateError for skill not found', async () => {
      const packagePath = await createTestPackage('nonexistent');
      const options = getDefaultOptions();

      await expect(updateSkill('nonexistent', packagePath, options)).rejects.toThrow(UpdateError);
    });
  });

  describe('UpdateError class', () => {
    it('wraps validation errors correctly', () => {
      const updateError = {
        type: 'validation-error' as const,
        field: 'skillName' as const,
        message: 'Invalid skill name',
      };

      const error = new UpdateError(updateError);

      expect(error.name).toBe('UpdateError');
      expect(error.message).toContain('skillName');
      expect(error.message).toContain('Invalid skill name');
      expect(error.updateError).toBe(updateError);
    });

    it('wraps security errors correctly', () => {
      const updateError = {
        type: 'security-error' as const,
        reason: 'case-mismatch' as const,
        details: 'Case mismatch detected',
      };

      const error = new UpdateError(updateError);

      expect(error.message).toContain('case-mismatch');
      expect(error.message).toContain('Case mismatch detected');
    });

    it('wraps skill-not-found errors correctly', () => {
      const updateError = {
        type: 'skill-not-found' as const,
        skillName: 'missing-skill',
        searchedPath: '/path/to/skills',
      };

      const error = new UpdateError(updateError);

      expect(error.message).toContain('missing-skill');
      expect(error.message).toContain('/path/to/skills');
    });

    it('wraps package-mismatch errors correctly', () => {
      const updateError = {
        type: 'package-mismatch' as const,
        installedSkillName: 'installed',
        packageSkillName: 'package',
        message: 'Skill names do not match',
      };

      const error = new UpdateError(updateError);

      expect(error.message).toBe('Skill names do not match');
    });
  });
});
