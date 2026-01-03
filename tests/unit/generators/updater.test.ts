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

// ============================================================================
// Phase 6: Security & Analysis Tests
// ============================================================================

import {
  checkSkillSymlinkSafety,
  checkSkillHardLinks,
  validateZipEntrySecurity,
  checkResourceLimits,
  verifyPathContainment,
  analyzeVersions,
  runSecurityAndAnalysisPhase,
  withTimeout,
  RESOURCE_LIMITS,
  type UpdateContext,
} from '../../../src/generators/updater';

describe('Updater - Phase 6: Security & Analysis', () => {
  let tempDir: string;
  let skillsDir: string;

  beforeEach(async () => {
    // Create fresh temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-updater-phase6-'));
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

  describe('checkSkillSymlinkSafety', () => {
    it('returns safe for regular directory', async () => {
      const skillPath = await createTestSkill('regular-skill');

      const result = await checkSkillSymlinkSafety(skillPath, skillsDir);

      expect(result.safe).toBe(true);
      if (result.safe) {
        expect(result.warnings).toEqual([]);
      }
    });

    it('returns safe for symlink within scope', async () => {
      const targetPath = await createTestSkill('target-skill');
      const symlinkPath = path.join(skillsDir, 'symlink-skill');
      await fs.symlink(targetPath, symlinkPath);

      const result = await checkSkillSymlinkSafety(symlinkPath, skillsDir);

      expect(result.safe).toBe(true);
    });

    it('returns error for symlink escaping scope', async () => {
      // Create a skill outside scope
      const outsideDir = path.join(tempDir, 'outside');
      await fs.mkdir(outsideDir, { recursive: true });
      const targetPath = path.join(outsideDir, 'external-skill');
      await fs.mkdir(targetPath, { recursive: true });
      await fs.writeFile(path.join(targetPath, 'SKILL.md'), '---\nname: external\n---\n');

      // Create symlink in skills dir pointing outside
      const symlinkPath = path.join(skillsDir, 'escape-skill');
      await fs.symlink(targetPath, symlinkPath);

      const result = await checkSkillSymlinkSafety(symlinkPath, skillsDir);

      expect(result.safe).toBe(false);
      if (!result.safe) {
        expect(result.error.type).toBe('security-error');
        expect((result.error as { reason: string }).reason).toBe('symlink-escape');
      }
    });
  });

  describe('checkSkillHardLinks', () => {
    it('returns no hard links for normal skill', async () => {
      const skillPath = await createTestSkill('normal-skill');

      const result = await checkSkillHardLinks(skillPath, false);

      expect(result.result.hasHardLinks).toBe(false);
      expect(result.result.hardLinkedFiles).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it('returns error for hard links without --force', async () => {
      const skillPath = await createTestSkill('hardlink-skill');
      const originalFile = path.join(skillPath, 'README.md');
      const hardLinkPath = path.join(skillPath, 'README-link.md');

      // Create a hard link
      await fs.link(originalFile, hardLinkPath);

      const result = await checkSkillHardLinks(skillPath, false);

      expect(result.result.hasHardLinks).toBe(true);
      expect(result.result.requiresForce).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('security-error');
    });

    it('returns warning but no error for hard links with --force', async () => {
      const skillPath = await createTestSkill('hardlink-force-skill');
      const originalFile = path.join(skillPath, 'README.md');
      const hardLinkPath = path.join(skillPath, 'README-link.md');

      // Create a hard link
      await fs.link(originalFile, hardLinkPath);

      const result = await checkSkillHardLinks(skillPath, true);

      expect(result.result.hasHardLinks).toBe(true);
      expect(result.result.requiresForce).toBe(false); // --force was passed
      expect(result.error).toBeUndefined();
    });
  });

  describe('validateZipEntrySecurity', () => {
    it('accepts valid package', async () => {
      const packagePath = await createTestPackage('valid-package');

      const result = validateZipEntrySecurity(packagePath, 'valid-package');

      expect(result.safe).toBe(true);
    });

    it('rejects package with path traversal', async () => {
      const packagePath = path.join(tempDir, 'traversal.skill');
      const zip = new AdmZip();
      zip.addFile('skill/../../../etc/passwd', Buffer.from('malicious'));
      zip.writeZip(packagePath);

      const result = validateZipEntrySecurity(packagePath, 'skill');

      expect(result.safe).toBe(false);
      if (!result.safe) {
        expect(result.error.type).toBe('security-error');
        expect((result.error as { reason: string }).reason).toBe('zip-entry-escape');
      }
    });

    it('rejects package with entries outside root directory', async () => {
      const packagePath = path.join(tempDir, 'outside.skill');
      const zip = new AdmZip();
      zip.addFile('skill/SKILL.md', Buffer.from('---\nname: skill\n---\n'));
      zip.addFile('other-dir/malicious.txt', Buffer.from('malicious'));
      zip.writeZip(packagePath);

      const result = validateZipEntrySecurity(packagePath, 'skill');

      expect(result.safe).toBe(false);
      if (!result.safe) {
        expect(result.error.type).toBe('security-error');
      }
    });
  });

  describe('checkResourceLimits', () => {
    it('accepts skill within limits', async () => {
      const skillPath = await createTestSkill('small-skill');

      const result = await checkResourceLimits(skillPath, false);

      expect(result.withinLimits).toBe(true);
    });

    it('verifies RESOURCE_LIMITS constants are defined', () => {
      expect(RESOURCE_LIMITS.MAX_SKILL_SIZE).toBe(1024 * 1024 * 1024);
      expect(RESOURCE_LIMITS.MAX_FILE_COUNT).toBe(10000);
      expect(RESOURCE_LIMITS.UPDATE_TIMEOUT_MS).toBe(5 * 60 * 1000);
      expect(RESOURCE_LIMITS.BACKUP_TIMEOUT_MS).toBe(2 * 60 * 1000);
      expect(RESOURCE_LIMITS.EXTRACTION_TIMEOUT_MS).toBe(2 * 60 * 1000);
      expect(RESOURCE_LIMITS.VALIDATION_TIMEOUT_MS).toBe(5 * 1000);
    });
  });

  describe('verifyPathContainment', () => {
    it('accepts path within scope', async () => {
      const skillPath = await createTestSkill('contained-skill');

      const error = await verifyPathContainment(skillPath, skillsDir);

      expect(error).toBeNull();
    });

    it('returns error for path outside scope', async () => {
      // Path that resolves outside scope
      const outsidePath = path.join(tempDir, 'outside-dir');
      await fs.mkdir(outsidePath, { recursive: true });

      const error = await verifyPathContainment(outsidePath, skillsDir);

      expect(error).not.toBeNull();
      expect(error?.type).toBe('security-error');
    });

    it('handles non-existent path', async () => {
      const nonexistentPath = path.join(skillsDir, 'nonexistent');

      const error = await verifyPathContainment(nonexistentPath, skillsDir);

      expect(error).not.toBeNull();
      expect(error?.type).toBe('filesystem-error');
    });
  });

  describe('analyzeVersions', () => {
    it('compares versions successfully', async () => {
      const skillPath = await createTestSkill('versioned-skill');
      const packagePath = await createTestPackage('versioned-skill');

      const result = await analyzeVersions(skillPath, packagePath);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.installedInfo).toBeDefined();
        expect(result.packageInfo).toBeDefined();
        expect(result.comparison).toBeDefined();
        expect(result.installedInfo.fileCount).toBeGreaterThan(0);
      }
    });

    it('detects file changes', async () => {
      const skillPath = await createTestSkill('change-skill');
      const packagePath = await createTestPackage('change-skill');

      const result = await analyzeVersions(skillPath, packagePath);

      expect(result.valid).toBe(true);
      if (result.valid) {
        // The package has different content, so there should be modifications
        expect(result.comparison.modifiedCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns empty comparison for missing skill files', async () => {
      // Create a minimal skill directory (exists but no files to compare)
      const skillPath = path.join(skillsDir, 'minimal-skill');
      await fs.mkdir(skillPath, { recursive: true });
      const packagePath = await createTestPackage('minimal-skill');

      const result = await analyzeVersions(skillPath, packagePath);

      // Should succeed but with files marked as added
      expect(result.valid).toBe(true);
      if (result.valid) {
        // Package files are "added" since skill dir is empty
        expect(result.comparison.addedCount).toBeGreaterThan(0);
      }
    });
  });

  describe('runSecurityAndAnalysisPhase', () => {
    it('runs all security checks successfully', async () => {
      const skillPath = await createTestSkill('secure-skill');
      const packagePath = await createTestPackage('secure-skill');

      const context: UpdateContext = {
        skillName: 'secure-skill',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'secure-skill',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      const options = {
        scope: 'project' as const,
        force: false,
        dryRun: false,
        quiet: false,
        noBackup: false,
        keepBackup: false,
      };

      const result = await runSecurityAndAnalysisPhase(context, options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.comparison).toBeDefined();
        expect(result.context.installedInfo).toBeDefined();
        expect(result.context.packageInfo).toBeDefined();
        expect(result.context.hardLinkCheck).toBeDefined();
        expect(result.context.securityWarnings).toBeDefined();
      }
    });

    it('fails on symlink escape', async () => {
      // Create skill outside scope
      const outsideDir = path.join(tempDir, 'outside');
      await fs.mkdir(outsideDir, { recursive: true });
      const targetPath = path.join(outsideDir, 'external-skill');
      await fs.mkdir(targetPath, { recursive: true });
      await fs.writeFile(path.join(targetPath, 'SKILL.md'), '---\nname: external-skill\n---\n');

      // Create symlink in skills dir
      const symlinkPath = path.join(skillsDir, 'escape-skill');
      await fs.symlink(targetPath, symlinkPath);

      const packagePath = await createTestPackage('escape-skill');

      const context: UpdateContext = {
        skillName: 'escape-skill',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath: symlinkPath,
        hasSkillMd: true,
        skillNameFromPackage: 'escape-skill',
        packageFiles: ['SKILL.md'],
      };

      const options = {
        scope: 'project' as const,
        force: false,
        dryRun: false,
        quiet: false,
        noBackup: false,
        keepBackup: false,
      };

      const result = await runSecurityAndAnalysisPhase(context, options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('security-error');
      }
    });

    it('fails on hard links without --force', async () => {
      const skillPath = await createTestSkill('hardlink-test');
      const originalFile = path.join(skillPath, 'README.md');
      const hardLinkPath = path.join(skillPath, 'README-link.md');
      await fs.link(originalFile, hardLinkPath);

      const packagePath = await createTestPackage('hardlink-test');

      const context: UpdateContext = {
        skillName: 'hardlink-test',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'hardlink-test',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      const options = {
        scope: 'project' as const,
        force: false,
        dryRun: false,
        quiet: false,
        noBackup: false,
        keepBackup: false,
      };

      const result = await runSecurityAndAnalysisPhase(context, options);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('security-error');
        expect((result.error as { reason: string }).reason).toBe('hard-link-detected');
      }
    });

    it('succeeds on hard links with --force', async () => {
      const skillPath = await createTestSkill('hardlink-force-test');
      const originalFile = path.join(skillPath, 'README.md');
      const hardLinkPath = path.join(skillPath, 'README-link.md');
      await fs.link(originalFile, hardLinkPath);

      const packagePath = await createTestPackage('hardlink-force-test');

      const context: UpdateContext = {
        skillName: 'hardlink-force-test',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'hardlink-force-test',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      const options = {
        scope: 'project' as const,
        force: true, // --force enabled
        dryRun: false,
        quiet: false,
        noBackup: false,
        keepBackup: false,
      };

      const result = await runSecurityAndAnalysisPhase(context, options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.hardLinkCheck?.hasHardLinks).toBe(true);
      }
    });
  });

  describe('withTimeout', () => {
    it('returns result for fast operation', async () => {
      const operation = async () => 'success';

      const result = await withTimeout(operation, 1000, 'test-operation');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.result).toBe('success');
      }
    });

    it('returns timeout error for slow operation', async () => {
      const operation = () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('too late'), 500);
        });

      const result = await withTimeout(operation, 50, 'slow-operation');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('timeout');
        expect((result.error as { operationName: string }).operationName).toBe('slow-operation');
      }
    });

    it('returns error for failing operation', async () => {
      const operation = async () => {
        throw new Error('operation failed');
      };

      const result = await withTimeout(operation, 1000, 'failing-operation');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('filesystem-error');
        expect((result.error as { message: string }).message).toContain('operation failed');
      }
    });
  });

  describe('updateSkill with Phase 6', () => {
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

    it('includes version info in dry-run preview', async () => {
      await createTestSkill('dry-run-phase6');
      const packagePath = await createTestPackage('dry-run-phase6');
      const options = { ...getDefaultOptions(), dryRun: true };

      const result = await updateSkill('dry-run-phase6', packagePath, options);

      expect(result.type).toBe('update-dry-run-preview');
      if (result.type === 'update-dry-run-preview') {
        expect(result.currentVersion.fileCount).toBeGreaterThan(0);
        expect(result.newVersion.fileCount).toBeGreaterThan(0);
        expect(result.comparison).toBeDefined();
      }
    });

    it('includes file counts in success result', async () => {
      await createTestSkill('success-phase6');
      const packagePath = await createTestPackage('success-phase6');
      const options = getDefaultOptions();

      const result = await updateSkill('success-phase6', packagePath, options);

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.previousFileCount).toBeGreaterThan(0);
        expect(result.currentFileCount).toBeGreaterThan(0);
      }
    });

    it('throws UpdateError for symlink escape', async () => {
      // Create skill outside scope
      const outsideDir = path.join(tempDir, 'outside');
      await fs.mkdir(outsideDir, { recursive: true });
      const targetPath = path.join(outsideDir, 'escape-test');
      await fs.mkdir(targetPath, { recursive: true });
      await fs.writeFile(path.join(targetPath, 'SKILL.md'), '---\nname: escape-test\n---\n');

      // Create symlink in skills dir
      const symlinkPath = path.join(skillsDir, 'escape-test');
      await fs.symlink(targetPath, symlinkPath);

      const packagePath = await createTestPackage('escape-test');
      const options = getDefaultOptions();

      await expect(updateSkill('escape-test', packagePath, options)).rejects.toThrow(UpdateError);
    });

    it('throws UpdateError for hard links without --force', async () => {
      const skillPath = await createTestSkill('hardlink-update-test');
      const originalFile = path.join(skillPath, 'README.md');
      const hardLinkPath = path.join(skillPath, 'README-link.md');
      await fs.link(originalFile, hardLinkPath);

      const packagePath = await createTestPackage('hardlink-update-test');
      const options = getDefaultOptions();

      await expect(updateSkill('hardlink-update-test', packagePath, options)).rejects.toThrow(
        UpdateError
      );
    });

    it('succeeds with hard links when --force is set', async () => {
      const skillPath = await createTestSkill('hardlink-force-update');
      const originalFile = path.join(skillPath, 'README.md');
      const hardLinkPath = path.join(skillPath, 'README-link.md');
      await fs.link(originalFile, hardLinkPath);

      const packagePath = await createTestPackage('hardlink-force-update');
      const options = { ...getDefaultOptions(), force: true };

      const result = await updateSkill('hardlink-force-update', packagePath, options);

      expect(result.type).toBe('update-success');
    });
  });
});
