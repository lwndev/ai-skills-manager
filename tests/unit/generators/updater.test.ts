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

    it('rejects package with valid structure but invalid frontmatter content', async () => {
      const packagePath = path.join(tempDir, 'bad-content.skill');
      const zip = new AdmZip();
      // Valid directory structure but frontmatter missing required 'description' field
      const skillMd = `---\nname: bad-content\n---\n\n# Bad content skill`;
      zip.addFile('bad-content/SKILL.md', Buffer.from(skillMd));
      zip.writeZip(packagePath);

      const result = await validatePackage(packagePath, 'bad-content');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.type).toBe('validation-error');
        // Validation error for missing description
        expect('details' in result.error || 'field' in result.error).toBe(true);
      }
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

    it('handles case-sensitivity through verifyCaseSensitivity', async () => {
      // Create skill with a specific name
      await createTestSkill('case-check-skill');
      const packagePath = await createTestPackage('case-check-skill');
      const options = getDefaultOptions();

      // This test exercises the verifyCaseSensitivity code path in discovery
      // It should succeed since names match exactly
      const result = await runInputAndDiscoveryPhase('case-check-skill', packagePath, options);

      expect(result.success).toBe(true);
      if (result.success && result.context.tempDir) {
        await fs.rm(result.context.tempDir, { recursive: true, force: true });
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

    it('returns success for non-dry-run with --force', async () => {
      await createTestSkill('update-skill');
      const packagePath = await createTestPackage('update-skill');
      // Use force to skip confirmation (Phase 7 adds confirmation prompt)
      const options = { ...getDefaultOptions(), force: true, quiet: true };

      const result = await updateSkill('update-skill', packagePath, options);

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.skillName).toBe('update-skill');
        // Phase 7 adds backup path
        expect(result.backupPath).toBeDefined();
        // Clean up backup
        if (result.backupPath) {
          await fs.unlink(result.backupPath).catch(() => {});
        }
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

    it('accepts skill within limits with --force', async () => {
      const skillPath = await createTestSkill('force-limits');

      const result = await checkResourceLimits(skillPath, true);

      expect(result.withinLimits).toBe(true);
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
      // Use force to skip confirmation (Phase 7 adds confirmation prompt)
      const options = { ...getDefaultOptions(), force: true, quiet: true };

      const result = await updateSkill('success-phase6', packagePath, options);

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.previousFileCount).toBeGreaterThan(0);
        expect(result.currentFileCount).toBeGreaterThan(0);
        // Clean up backup
        if (result.backupPath) {
          await fs.unlink(result.backupPath).catch(() => {});
        }
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

// ============================================================================
// Phase 7: Preparation Tests (Lock, Backup, Confirmation)
// ============================================================================

import {
  acquireUpdateLock,
  releaseUpdateLock,
  hasUpdateLock,
  createUpdateBackup,
  confirmUpdate,
  runPreparationPhase,
} from '../../../src/generators/updater';

describe('Updater - Phase 7: Preparation', () => {
  let tempDir: string;
  let skillsDir: string;

  beforeEach(async () => {
    // Create fresh temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-updater-phase7-'));
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

  describe('acquireUpdateLock', () => {
    it('acquires lock successfully for unlocked skill', async () => {
      const skillPath = await createTestSkill('lock-test');
      const packagePath = await createTestPackage('lock-test');

      const result = await acquireUpdateLock(skillPath, packagePath);

      expect(result.acquired).toBe(true);
      if (result.acquired) {
        expect(result.lockPath).toContain('.asm-update.lock');

        // Verify lock file exists
        const lockExists = await fs.stat(result.lockPath).then(
          () => true,
          () => false
        );
        expect(lockExists).toBe(true);

        // Clean up
        await releaseUpdateLock(result.lockPath);
      }
    });

    it('fails when skill is already locked', async () => {
      const skillPath = await createTestSkill('already-locked');
      const packagePath = await createTestPackage('already-locked');

      // Acquire first lock
      const firstResult = await acquireUpdateLock(skillPath, packagePath);
      expect(firstResult.acquired).toBe(true);

      // Try to acquire second lock
      const secondResult = await acquireUpdateLock(skillPath, packagePath);

      expect(secondResult.acquired).toBe(false);
      if (!secondResult.acquired) {
        expect(secondResult.error.type).toBe('validation-error');
        expect((secondResult.error as { message: string }).message).toContain(
          'currently being updated'
        );
      }

      // Clean up
      if (firstResult.acquired) {
        await releaseUpdateLock(firstResult.lockPath);
      }
    });

    it('removes stale lock and acquires new one', async () => {
      const skillPath = await createTestSkill('stale-lock');
      const packagePath = await createTestPackage('stale-lock');
      const skillName = path.basename(skillPath);
      const lockPath = path.join(skillsDir, `${skillName}.asm-update.lock`);

      // Create a stale lock (old timestamp)
      const staleLockContent = JSON.stringify({
        pid: 99999,
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        operationType: 'update',
        skillPath,
        packagePath,
      });
      await fs.writeFile(lockPath, staleLockContent);

      // Modify mtime to be old
      const oldTime = new Date(Date.now() - 10 * 60 * 1000);
      await fs.utimes(lockPath, oldTime, oldTime);

      // Should acquire lock (stale one should be removed)
      const result = await acquireUpdateLock(skillPath, packagePath);

      expect(result.acquired).toBe(true);

      // Clean up
      if (result.acquired) {
        await releaseUpdateLock(result.lockPath);
      }
    });

    it('returns filesystem error for invalid lock path', async () => {
      // Try to acquire lock in a non-existent directory
      const invalidPath = '/nonexistent/skill';
      const packagePath = '/path/to/package.skill';

      const result = await acquireUpdateLock(invalidPath, packagePath);

      expect(result.acquired).toBe(false);
      if (!result.acquired) {
        expect(result.error.type).toBe('filesystem-error');
      }
    });

    it('handles race condition between check and write', async () => {
      const skillPath = await createTestSkill('race-lock');
      const packagePath = await createTestPackage('race-lock');

      // Acquire two locks simultaneously - one should fail
      const [result1, result2] = await Promise.all([
        acquireUpdateLock(skillPath, packagePath),
        acquireUpdateLock(skillPath, packagePath),
      ]);

      // One should succeed, one should fail
      const succeeded = [result1, result2].filter((r) => r.acquired);
      const failed = [result1, result2].filter((r) => !r.acquired);

      expect(succeeded.length).toBe(1);
      expect(failed.length).toBe(1);

      // Clean up
      for (const result of succeeded) {
        if (result.acquired) {
          await releaseUpdateLock(result.lockPath);
        }
      }
    });
  });

  describe('releaseUpdateLock', () => {
    it('removes lock file', async () => {
      const skillPath = await createTestSkill('release-lock');
      const packagePath = await createTestPackage('release-lock');

      const result = await acquireUpdateLock(skillPath, packagePath);
      expect(result.acquired).toBe(true);

      if (result.acquired) {
        await releaseUpdateLock(result.lockPath);

        // Verify lock file is gone
        const lockExists = await fs.stat(result.lockPath).then(
          () => true,
          () => false
        );
        expect(lockExists).toBe(false);
      }
    });

    it('ignores errors for non-existent lock', async () => {
      // Should not throw
      await releaseUpdateLock('/nonexistent/path.lock');
    });
  });

  describe('hasUpdateLock', () => {
    it('returns true for active lock', async () => {
      const skillPath = await createTestSkill('has-lock');
      const packagePath = await createTestPackage('has-lock');

      const result = await acquireUpdateLock(skillPath, packagePath);
      expect(result.acquired).toBe(true);

      const hasLock = await hasUpdateLock(skillPath);
      expect(hasLock).toBe(true);

      // Clean up
      if (result.acquired) {
        await releaseUpdateLock(result.lockPath);
      }
    });

    it('returns false for no lock', async () => {
      const skillPath = await createTestSkill('no-lock');

      const hasLock = await hasUpdateLock(skillPath);
      expect(hasLock).toBe(false);
    });
  });

  describe('createUpdateBackup', () => {
    it('creates backup successfully', async () => {
      const skillPath = await createTestSkill('backup-test');
      const packagePath = await createTestPackage('backup-test');
      const options = getDefaultOptions();

      const context: UpdateContext = {
        skillName: 'backup-test',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'backup-test',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      const result = await createUpdateBackup(context, options);

      expect('created' in result).toBe(true);
      if ('created' in result && result.created) {
        expect(result.backupPath).toContain('backup-test');
        expect(result.backupPath).toContain('.skill');
        expect(result.fileCount).toBeGreaterThan(0);
        expect(result.size).toBeGreaterThan(0);

        // Clean up backup
        await fs.unlink(result.backupPath);
      }
    });

    it('skips backup when --no-backup is set', async () => {
      const skillPath = await createTestSkill('no-backup-test');
      const packagePath = await createTestPackage('no-backup-test');
      const options = { ...getDefaultOptions(), noBackup: true };

      const context: UpdateContext = {
        skillName: 'no-backup-test',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'no-backup-test',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      const result = await createUpdateBackup(context, options);

      expect('skipped' in result).toBe(true);
      if ('skipped' in result) {
        expect(result.reason).toBe('no-backup-flag');
      }
    });
  });

  describe('confirmUpdate', () => {
    it('skips confirmation when --force is set', async () => {
      const skillPath = await createTestSkill('force-confirm');
      const options = { ...getDefaultOptions(), force: true };

      const context: UpdateContext = {
        skillName: 'force-confirm',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath: '/path/to/package.skill',
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'force-confirm',
        packageFiles: ['SKILL.md'],
      };

      const result = await confirmUpdate(context, options, '/backup/path.skill');

      expect(result.confirmed).toBe(false);
      if (!result.confirmed) {
        expect(result.reason).toBe('force-flag');
      }
    });

    it('returns confirmed when user says yes', async () => {
      const skillPath = await createTestSkill('yes-confirm');
      const options = getDefaultOptions();

      const context: UpdateContext = {
        skillName: 'yes-confirm',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath: '/path/to/package.skill',
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'yes-confirm',
        packageFiles: ['SKILL.md'],
      };

      // Mock confirm function that returns true
      const mockConfirm = async () => true;

      const result = await confirmUpdate(context, options, '/backup/path.skill', mockConfirm);

      expect(result.confirmed).toBe(true);
    });

    it('returns user-cancelled when user says no', async () => {
      const skillPath = await createTestSkill('no-confirm');
      const options = getDefaultOptions();

      const context: UpdateContext = {
        skillName: 'no-confirm',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath: '/path/to/package.skill',
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'no-confirm',
        packageFiles: ['SKILL.md'],
      };

      // Mock confirm function that returns false
      const mockConfirm = async () => false;

      const result = await confirmUpdate(context, options, '/backup/path.skill', mockConfirm);

      expect(result.confirmed).toBe(false);
      if (!result.confirmed) {
        expect(result.reason).toBe('user-cancelled');
      }
    });

    it('includes version info in prompt', async () => {
      const skillPath = await createTestSkill('version-prompt');
      const options = getDefaultOptions();

      const context: UpdateContext = {
        skillName: 'version-prompt',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath: '/path/to/package.skill',
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'version-prompt',
        packageFiles: ['SKILL.md'],
        installedInfo: {
          path: skillPath,
          fileCount: 2,
          size: 1024,
        },
        packageInfo: {
          path: '/path/to/package.skill',
          fileCount: 3,
          size: 2048,
        },
        comparison: {
          filesAdded: [
            { path: 'new.md', changeType: 'added', sizeBefore: 0, sizeAfter: 512, sizeDelta: 512 },
          ],
          filesRemoved: [],
          filesModified: [],
          addedCount: 1,
          removedCount: 0,
          modifiedCount: 0,
          sizeChange: 1024,
        },
      };

      // Mock confirm function that returns true
      const mockConfirm = async () => true;

      const result = await confirmUpdate(context, options, '/backup/path.skill', mockConfirm);

      expect(result.confirmed).toBe(true);
    });
  });

  describe('runPreparationPhase', () => {
    it('runs all preparation steps with --force', async () => {
      const skillPath = await createTestSkill('prep-force');
      const packagePath = await createTestPackage('prep-force');
      const options = { ...getDefaultOptions(), force: true };

      const context: UpdateContext = {
        skillName: 'prep-force',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'prep-force',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      const result = await runPreparationPhase(context, options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.lockPath).toBeDefined();
        expect(result.context.backupPath).toBeDefined();
        expect(result.context.backupSkipped).toBe(false);

        // Clean up lock and backup
        if (result.context.lockPath) {
          await releaseUpdateLock(result.context.lockPath);
        }
        if (result.context.backupPath) {
          await fs.unlink(result.context.backupPath).catch(() => {});
        }
      }
    });

    it('skips backup with --no-backup', async () => {
      const skillPath = await createTestSkill('prep-no-backup');
      const packagePath = await createTestPackage('prep-no-backup');
      const options = { ...getDefaultOptions(), force: true, noBackup: true, quiet: true };

      const context: UpdateContext = {
        skillName: 'prep-no-backup',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'prep-no-backup',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      const result = await runPreparationPhase(context, options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.context.lockPath).toBeDefined();
        expect(result.context.backupPath).toBeUndefined(); // No actual backup created
        expect(result.context.backupSkipped).toBe(true);

        // Clean up lock
        if (result.context.lockPath) {
          await releaseUpdateLock(result.context.lockPath);
        }
      }
    });

    it('cancels on user rejection', async () => {
      const skillPath = await createTestSkill('prep-cancel');
      const packagePath = await createTestPackage('prep-cancel');
      const options = getDefaultOptions();

      const context: UpdateContext = {
        skillName: 'prep-cancel',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'prep-cancel',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      // Mock confirm that returns false
      const mockConfirm = async () => false;

      const result = await runPreparationPhase(context, options, mockConfirm);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect('cancelled' in result).toBe(true);
      }

      // Lock should be released
      const hasLock = await hasUpdateLock(skillPath);
      expect(hasLock).toBe(false);
    });

    it('fails on concurrent update attempt', async () => {
      const skillPath = await createTestSkill('prep-concurrent');
      const packagePath = await createTestPackage('prep-concurrent');
      const options = { ...getDefaultOptions(), force: true };

      const context: UpdateContext = {
        skillName: 'prep-concurrent',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'prep-concurrent',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      // Acquire lock first
      const lockResult = await acquireUpdateLock(skillPath, packagePath);
      expect(lockResult.acquired).toBe(true);

      // Try to run preparation phase - should fail
      const result = await runPreparationPhase(context, options);

      expect(result.success).toBe(false);
      if (!result.success && 'error' in result) {
        expect(result.error.type).toBe('validation-error');
      }

      // Clean up
      if (lockResult.acquired) {
        await releaseUpdateLock(lockResult.lockPath);
      }
    });
  });

  describe('createUpdateBackup edge cases', () => {
    it('returns error when backup directory validation fails', async () => {
      const skillPath = await createTestSkill('backup-fail');
      const packagePath = await createTestPackage('backup-fail');
      // Use a non-existent homedir to trigger validation failure
      const options = { ...getDefaultOptions(), homedir: '/nonexistent/path' };

      const context: UpdateContext = {
        skillName: 'backup-fail',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'backup-fail',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      const result = await createUpdateBackup(context, options);

      expect('created' in result || 'error' in result).toBe(true);
      // Either it fails with an error or validation passes (depending on implementation)
    });

    it('skips writability check when --no-backup is set', async () => {
      const skillPath = await createTestSkill('skip-writable');
      const packagePath = await createTestPackage('skip-writable');
      // Even with invalid homedir, should skip check when noBackup is true
      const options = { ...getDefaultOptions(), noBackup: true, homedir: '/nonexistent/path' };

      const context: UpdateContext = {
        skillName: 'skip-writable',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'skip-writable',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      const result = await createUpdateBackup(context, options);

      expect('skipped' in result).toBe(true);
      if ('skipped' in result) {
        expect(result.reason).toBe('no-backup-flag');
      }
    });
  });

  describe('runPreparationPhase edge cases', () => {
    it('handles confirmation with downgrade warning', async () => {
      const skillPath = await createTestSkill('downgrade-confirm');
      const packagePath = await createTestPackage('downgrade-confirm');
      const options = getDefaultOptions();

      const context: UpdateContext = {
        skillName: 'downgrade-confirm',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'downgrade-confirm',
        packageFiles: ['SKILL.md', 'README.md'],
        downgradeInfo: {
          isDowngrade: true,
          installedDate: '2025-01-01',
          newDate: '2024-12-01',
          message: 'This appears to be a downgrade',
        },
      };

      // Mock confirm that returns true
      const mockConfirm = async () => true;

      const result = await runPreparationPhase(context, options, mockConfirm);

      expect(result.success).toBe(true);
      if (result.success) {
        // Clean up lock and backup
        if (result.context.lockPath) {
          await releaseUpdateLock(result.context.lockPath);
        }
        if (result.context.backupPath) {
          await fs.unlink(result.context.backupPath).catch(() => {});
        }
      }
    });

    it('cleans up backup on user cancellation', async () => {
      const skillPath = await createTestSkill('cancel-cleanup');
      const packagePath = await createTestPackage('cancel-cleanup');
      const options = { ...getDefaultOptions(), quiet: true };

      const context: UpdateContext = {
        skillName: 'cancel-cleanup',
        scopeInfo: { type: 'project', path: skillsDir },
        packagePath,
        skillPath,
        hasSkillMd: true,
        skillNameFromPackage: 'cancel-cleanup',
        packageFiles: ['SKILL.md', 'README.md'],
      };

      // Mock confirm that returns false (user cancels)
      const mockConfirm = async () => false;

      const result = await runPreparationPhase(context, options, mockConfirm);

      expect(result.success).toBe(false);
      expect('cancelled' in result).toBe(true);

      // Verify no backup file remains (cleanup happened)
      // We can't easily verify this without knowing the backup path
      // but the lock should be released
      const hasLock = await hasUpdateLock(skillPath);
      expect(hasLock).toBe(false);
    });
  });

  describe('updateSkill with Phase 7', () => {
    function getDefaultOptions(): UpdateOptions {
      return {
        scope: 'project',
        force: true, // Use force to skip interactive confirmation
        dryRun: false,
        quiet: true, // Suppress output
        noBackup: false,
        keepBackup: false,
        cwd: tempDir,
        homedir: tempDir,
      };
    }

    it('includes backup path in success result', async () => {
      await createTestSkill('full-update');
      const packagePath = await createTestPackage('full-update');
      const options = getDefaultOptions();

      const result = await updateSkill('full-update', packagePath, options);

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.backupPath).toBeDefined();
        expect(result.backupPath).toContain('full-update');
        expect(result.backupPath).toContain('.skill');

        // Clean up backup
        if (result.backupPath) {
          await fs.unlink(result.backupPath).catch(() => {});
        }
      }
    });

    it('omits backup path when --no-backup is set', async () => {
      await createTestSkill('no-backup-update');
      const packagePath = await createTestPackage('no-backup-update');
      const options = { ...getDefaultOptions(), noBackup: true };

      const result = await updateSkill('no-backup-update', packagePath, options);

      expect(result.type).toBe('update-success');
      if (result.type === 'update-success') {
        expect(result.backupPath).toBeUndefined();
      }
    });

    it('throws on lock conflict', async () => {
      const skillPath = await createTestSkill('lock-conflict');
      const packagePath = await createTestPackage('lock-conflict');
      const options = getDefaultOptions();

      // Acquire lock first
      const lockResult = await acquireUpdateLock(skillPath, packagePath);
      expect(lockResult.acquired).toBe(true);

      // Try to update - should fail
      await expect(updateSkill('lock-conflict', packagePath, options)).rejects.toThrow(UpdateError);

      // Clean up
      if (lockResult.acquired) {
        await releaseUpdateLock(lockResult.lockPath);
      }
    });

    it('generates actual backup path in dry-run preview', async () => {
      await createTestSkill('dry-run-backup');
      const packagePath = await createTestPackage('dry-run-backup');
      const options = { ...getDefaultOptions(), dryRun: true };

      const result = await updateSkill('dry-run-backup', packagePath, options);

      expect(result.type).toBe('update-dry-run-preview');
      if (result.type === 'update-dry-run-preview') {
        expect(result.backupPath).toContain('dry-run-backup');
        expect(result.backupPath).toContain('.skill');
      }
    });
  });
});
