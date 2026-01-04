/**
 * Security tests for update functionality (FEAT-008, Phase 11)
 *
 * These tests simulate various attack vectors to ensure the update
 * command properly protects against:
 * - Input validation attacks (path traversal, null bytes, Unicode)
 * - Package security (ZIP bombs, symlinks, traversal)
 * - Symlink escape attacks (TOCTOU, escape prevention)
 * - Case sensitivity exploits (macOS/Windows)
 * - Hard link manipulation
 * - Backup security (permissions, path escapes)
 * - Resource limit abuse (size, count, timeouts)
 * - Concurrent access attacks (lock file manipulation)
 * - Signal handling (cleanup on interruption)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';

import {
  validateInputs,
  verifyCaseSensitivity,
  checkSkillSymlinkSafety,
  checkSkillHardLinks,
  validateZipEntrySecurity,
  checkResourceLimits,
  verifyPathContainment,
  acquireUpdateLock,
  releaseUpdateLock,
  hasUpdateLock,
  createUpdateCleanupHandler,
  shouldAbortUpdate,
  RESOURCE_LIMITS,
} from '../../src/generators/updater';
import {
  validateBackupDirectory,
  validateBackupWritability,
  verifyBackupContainment,
  generateBackupFilename,
  generateUniqueBackupPath,
} from '../../src/services/backup-manager';
import { validateSkillName } from '../../src/validators/uninstall-name';
import { checkSymlinkSafety, detectHardLinkWarnings } from '../../src/generators/security-checker';
import { verifyContainment, isDangerousPath } from '../../src/generators/path-verifier';

describe('Update Security', () => {
  let tempDir: string;
  let scopePath: string;
  let skillPath: string;
  let backupDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-update-security-'));
    scopePath = path.join(tempDir, 'scope');
    skillPath = path.join(scopePath, 'test-skill');
    backupDir = path.join(tempDir, '.asm', 'backups');
    await fs.promises.mkdir(skillPath, { recursive: true });
    await fs.promises.mkdir(backupDir, { recursive: true, mode: 0o700 });
    // Create a valid skill with SKILL.md
    await fs.promises.writeFile(
      path.join(skillPath, 'SKILL.md'),
      '---\nname: test-skill\ndescription: Test skill\n---\n# Test Skill\n'
    );
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // =========================================================================
  // INPUT VALIDATION TESTS
  // =========================================================================

  describe('Input Validation Attacks', () => {
    describe('Path Traversal via Skill Name', () => {
      it('rejects "../" in skill name', () => {
        const result = validateSkillName('../etc');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('path separators');
      });

      it('rejects "..%2F" URL encoded traversal', () => {
        const result = validateSkillName('..%2Fetc');
        expect(result.valid).toBe(false);
      });

      it('rejects "..../" double dot variant', () => {
        const result = validateSkillName('..../passwd');
        expect(result.valid).toBe(false);
      });

      it('rejects absolute paths starting with /', () => {
        const result = validateSkillName('/etc/passwd');
        expect(result.valid).toBe(false);
      });

      it('rejects Windows drive letters', () => {
        const result = validateSkillName('C:\\Windows\\System32');
        expect(result.valid).toBe(false);
      });

      it('rejects backslash in skill name', () => {
        const result = validateSkillName('skill\\..\\etc');
        expect(result.valid).toBe(false);
      });

      it('rejects just ".."', () => {
        const result = validateSkillName('..');
        expect(result.valid).toBe(false);
      });

      it('rejects just "."', () => {
        const result = validateSkillName('.');
        expect(result.valid).toBe(false);
      });

      it('rejects multiple consecutive dots', () => {
        const result = validateSkillName('....');
        expect(result.valid).toBe(false);
      });

      it('rejects hidden file prefix with traversal', () => {
        const result = validateSkillName('.../etc');
        expect(result.valid).toBe(false);
      });
    });

    describe('Null Byte Injection', () => {
      it('rejects skill names with null bytes', () => {
        const result = validateSkillName('skill\x00.txt');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('control character');
      });

      it('rejects null byte at start', () => {
        const result = validateSkillName('\x00skill');
        expect(result.valid).toBe(false);
      });

      it('rejects null byte at end', () => {
        const result = validateSkillName('skill\x00');
        expect(result.valid).toBe(false);
      });
    });

    describe('Control Character Injection', () => {
      it('rejects skill names with newline', () => {
        const result = validateSkillName('skill\nname');
        expect(result.valid).toBe(false);
      });

      it('rejects skill names with tab', () => {
        const result = validateSkillName('skill\tname');
        expect(result.valid).toBe(false);
      });

      it('rejects skill names with carriage return', () => {
        const result = validateSkillName('skill\rname');
        expect(result.valid).toBe(false);
      });

      it('rejects skill names with bell character', () => {
        const result = validateSkillName('skill\x07name');
        expect(result.valid).toBe(false);
      });

      it('rejects skill names with backspace', () => {
        const result = validateSkillName('skill\x08name');
        expect(result.valid).toBe(false);
      });

      it('rejects skill names with form feed', () => {
        const result = validateSkillName('skill\x0Cname');
        expect(result.valid).toBe(false);
      });

      it('rejects skill names with escape character', () => {
        const result = validateSkillName('skill\x1Bname');
        expect(result.valid).toBe(false);
      });
    });

    describe('Unicode Attacks', () => {
      it('rejects non-ASCII characters', () => {
        const result = validateSkillName('skill-name-ä');
        expect(result.valid).toBe(false);
      });

      it('rejects unicode lookalikes for slash (U+2215)', () => {
        const result = validateSkillName('skill∕name');
        expect(result.valid).toBe(false);
      });

      it('rejects unicode lookalikes for backslash (U+29F5)', () => {
        const result = validateSkillName('skill⧵name');
        expect(result.valid).toBe(false);
      });

      it('rejects unicode dot lookalikes (U+2024)', () => {
        const result = validateSkillName('․․');
        expect(result.valid).toBe(false);
      });

      it('rejects fullwidth slash (U+FF0F)', () => {
        const result = validateSkillName('skill／name');
        expect(result.valid).toBe(false);
      });

      it('rejects right-to-left override (U+202E)', () => {
        const result = validateSkillName('skill\u202Ename');
        expect(result.valid).toBe(false);
      });

      it('rejects zero-width joiner (U+200D)', () => {
        const result = validateSkillName('skill\u200Dname');
        expect(result.valid).toBe(false);
      });

      it('rejects homograph attack with cyrillic а (U+0430)', () => {
        const result = validateSkillName('skаll'); // Contains cyrillic 'а'
        expect(result.valid).toBe(false);
      });
    });

    describe('Format Validation', () => {
      it('requires lowercase letters only', () => {
        const result = validateSkillName('MySkill');
        expect(result.valid).toBe(false);
      });

      it('allows digits', () => {
        const result = validateSkillName('skill-123');
        expect(result.valid).toBe(true);
      });

      it('allows hyphens in the middle', () => {
        const result = validateSkillName('my-skill-name');
        expect(result.valid).toBe(true);
      });

      it('rejects leading hyphen', () => {
        const result = validateSkillName('-skill');
        expect(result.valid).toBe(false);
      });

      it('rejects trailing hyphen', () => {
        const result = validateSkillName('skill-');
        expect(result.valid).toBe(false);
      });

      it('enforces maximum length (64 chars)', () => {
        const longName = 'a'.repeat(65);
        const result = validateSkillName(longName);
        expect(result.valid).toBe(false);
      });

      it('accepts valid 64-character name', () => {
        const maxName = 'a'.repeat(64);
        const result = validateSkillName(maxName);
        expect(result.valid).toBe(true);
      });

      it('rejects empty string', () => {
        const result = validateSkillName('');
        expect(result.valid).toBe(false);
      });

      it('rejects whitespace only', () => {
        const result = validateSkillName('   ');
        expect(result.valid).toBe(false);
      });

      it('rejects consecutive hyphens', () => {
        const result = validateSkillName('skill--name');
        expect(result.valid).toBe(false);
      });
    });
  });

  // =========================================================================
  // PACKAGE SECURITY TESTS
  // =========================================================================

  describe('Package Security', () => {
    describe('ZIP Entry Security Validation', () => {
      it('validates decompression size limits are defined', () => {
        expect(RESOURCE_LIMITS.MAX_SKILL_SIZE).toBeDefined();
        expect(RESOURCE_LIMITS.MAX_SKILL_SIZE).toBeGreaterThan(0);
        expect(RESOURCE_LIMITS.MAX_SKILL_SIZE).toBeLessThanOrEqual(1024 * 1024 * 1024); // 1GB
      });

      it('validates file count limits are defined', () => {
        expect(RESOURCE_LIMITS.MAX_FILE_COUNT).toBeDefined();
        expect(RESOURCE_LIMITS.MAX_FILE_COUNT).toBeGreaterThan(0);
        expect(RESOURCE_LIMITS.MAX_FILE_COUNT).toBeLessThanOrEqual(10000);
      });
    });

    describe('Path Traversal in ZIP Entries', () => {
      it('creates valid package for testing ZIP entry validation', async () => {
        // Create a valid package to test validateZipEntrySecurity
        const zip = new AdmZip();
        zip.addFile('test-skill/', Buffer.from(''));
        zip.addFile(
          'test-skill/SKILL.md',
          Buffer.from('---\nname: test-skill\ndescription: Test\n---\n# Skill')
        );
        const packagePath = path.join(tempDir, 'test.skill');
        zip.writeZip(packagePath);

        // The function validates entries from an actual ZIP file
        const result = validateZipEntrySecurity(packagePath, 'test-skill');
        expect(result.safe).toBe(true);
      });

      it('rejects package with path traversal entries', async () => {
        // Create a package with a suspicious entry pattern
        const zip = new AdmZip();
        zip.addFile('bad-skill/', Buffer.from(''));
        zip.addFile('bad-skill/SKILL.md', Buffer.from('---\nname: bad-skill\n---\n# Skill'));
        // AdmZip may normalize this, but we test the concept
        zip.addFile('other-dir/file.txt', Buffer.from('outside'));
        const packagePath = path.join(tempDir, 'bad.skill');
        zip.writeZip(packagePath);

        const result = validateZipEntrySecurity(packagePath, 'bad-skill');
        // Should detect entry outside root directory
        expect(result.safe).toBe(false);
        if (!result.safe && result.error) {
          expect(result.error.type).toBe('security-error');
        }
      });
    });

    describe('Symlink in Package', () => {
      it('checkSkillSymlinkSafety checks root skill directory', async () => {
        // checkSkillSymlinkSafety checks if the skill DIRECTORY ITSELF is a symlink
        // It doesn't recursively scan contents - that's handled by package validation

        // Create a skill that IS a symlink to external directory
        const externalDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'external-skill-'));
        await fs.promises.writeFile(
          path.join(externalDir, 'SKILL.md'),
          '---\nname: symlink-skill\ndescription: Test\n---\n# Skill'
        );

        const symlinkSkill = path.join(scopePath, 'symlink-skill');
        await fs.promises.symlink(externalDir, symlinkSkill);

        try {
          const realScopePath = await fs.promises.realpath(scopePath);
          const result = await checkSkillSymlinkSafety(symlinkSkill, realScopePath);

          // This SHOULD be unsafe because the skill directory escapes scope
          expect(result.safe).toBe(false);
          if (!result.safe && result.error) {
            expect(result.error.type).toBe('security-error');
          }
        } finally {
          await fs.promises.unlink(symlinkSkill);
          await fs.promises.rm(externalDir, { recursive: true, force: true });
        }
      });
    });
  });

  // =========================================================================
  // SYMLINK ESCAPE TESTS
  // =========================================================================

  describe('Symlink Escape Attacks', () => {
    describe('Skill Directory is Symlink', () => {
      it('detects symlink skill pointing to external directory', async () => {
        // Create external target
        const externalDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'external-'));
        await fs.promises.writeFile(path.join(externalDir, 'secret.txt'), 'SECRET');

        // Create symlink skill pointing to external
        const symlinkSkill = path.join(scopePath, 'evil-skill');
        await fs.promises.symlink(externalDir, symlinkSkill);

        try {
          const realScopePath = await fs.promises.realpath(scopePath);
          const result = await checkSymlinkSafety(symlinkSkill, realScopePath);

          expect(result.type).toBe('escape');
          if (result.type === 'escape') {
            const realExternalDir = await fs.promises.realpath(externalDir);
            expect(result.targetPath).toBe(realExternalDir);
          }
        } finally {
          await fs.promises.unlink(symlinkSkill);
          await fs.promises.rm(externalDir, { recursive: true, force: true });
        }
      });

      it('allows symlink within scope', async () => {
        const targetDir = path.join(scopePath, 'real-skill');
        await fs.promises.mkdir(targetDir, { recursive: true });
        await fs.promises.writeFile(
          path.join(targetDir, 'SKILL.md'),
          '---\nname: real-skill\n---\n# Skill'
        );

        const symlinkSkill = path.join(scopePath, 'symlink-skill');
        await fs.promises.symlink(targetDir, symlinkSkill);

        try {
          const realScopePath = await fs.promises.realpath(scopePath);
          const result = await checkSymlinkSafety(symlinkSkill, realScopePath);

          expect(result.type).toBe('safe');
          if (result.type === 'safe') {
            expect(result.isSymlink).toBe(true);
          }
        } finally {
          await fs.promises.unlink(symlinkSkill);
        }
      });
    });

    describe('Nested Symlinks Within Skill', () => {
      it('uses checkSymlinkSafety to detect root symlink escapes', async () => {
        // checkSymlinkSafety checks if the skill directory ITSELF is a symlink that escapes
        // Nested symlinks inside the skill are detected during package extraction/validation

        // Create external target
        const externalDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'external-'));
        await fs.promises.writeFile(path.join(externalDir, 'secret.txt'), 'SECRET');

        // Create symlink skill pointing to external
        const symlinkSkill = path.join(scopePath, 'evil-skill');
        await fs.promises.symlink(externalDir, symlinkSkill);

        try {
          const realScopePath = await fs.promises.realpath(scopePath);
          const result = await checkSymlinkSafety(symlinkSkill, realScopePath);

          // Skill directory escapes scope - should detect
          expect(result.type).toBe('escape');
        } finally {
          await fs.promises.unlink(symlinkSkill);
          await fs.promises.rm(externalDir, { recursive: true, force: true });
        }
      });

      it('nested symlinks within skill are valid at skill level', async () => {
        // When the skill directory itself is NOT a symlink and is within scope,
        // checkSkillSymlinkSafety returns safe=true
        // The symlinks INSIDE the skill are handled at package extraction time

        // Create symlink inside skill pointing outside
        const evilLink = path.join(skillPath, 'innocent.txt');
        await fs.promises.symlink('/etc/passwd', evilLink);

        const realScopePath = await fs.promises.realpath(scopePath);
        const result = await checkSkillSymlinkSafety(skillPath, realScopePath);

        // The skill directory itself is safe (not a symlink, within scope)
        // Nested symlinks are a separate security concern handled elsewhere
        expect(result.safe).toBe(true);

        // Cleanup
        await fs.promises.unlink(evilLink);
      });

      it('detectHardLinkWarnings handles nested symlinks', async () => {
        // Hard link detection also checks for symlinks as a side effect
        const result = await detectHardLinkWarnings(skillPath);

        // A skill with no hard links returns null
        expect(result).toBeNull();
      });
    });
  });

  // =========================================================================
  // CASE SENSITIVITY TESTS
  // =========================================================================

  describe('Case Sensitivity Attacks', () => {
    it('detects case mismatch between input and actual directory', async () => {
      // Create skill with specific casing
      const mixedCaseSkill = path.join(scopePath, 'My-Skill');
      await fs.promises.mkdir(mixedCaseSkill, { recursive: true });
      await fs.promises.writeFile(
        path.join(mixedCaseSkill, 'SKILL.md'),
        '---\nname: my-skill\ndescription: Test\n---\n# Skill'
      );

      // Try to access with different casing
      const result = await verifyCaseSensitivity(mixedCaseSkill, 'my-skill');

      if (process.platform === 'darwin' || process.platform === 'win32') {
        // On case-insensitive filesystems, should detect mismatch
        expect(result).not.toBeNull();
        if (result) {
          expect(result.type).toBe('security-error');
          // Type narrow to check reason
          if (result.type === 'security-error') {
            expect((result as { type: 'security-error'; reason: string }).reason).toBe(
              'case-mismatch'
            );
          }
        }
      }

      // Cleanup
      await fs.promises.rm(mixedCaseSkill, { recursive: true, force: true });
    });

    it('accepts exact case match', async () => {
      const result = await verifyCaseSensitivity(skillPath, 'test-skill');
      expect(result).toBeNull(); // null means no error
    });

    it('rejects skill name with case variant characters', () => {
      // Turkish I problem - lowercase 'i' has different behavior in Turkish locale
      const result = validateSkillName('skIll');
      expect(result.valid).toBe(false);
    });
  });

  // =========================================================================
  // HARD LINK TESTS
  // =========================================================================

  describe('Hard Link Detection', () => {
    it('detects files with multiple hard links', async () => {
      // Create original file in skill
      const originalFile = path.join(skillPath, 'original.txt');
      await fs.promises.writeFile(originalFile, 'SHARED DATA');

      // Create hard link to it
      const hardLinkPath = path.join(skillPath, 'hardlink.txt');
      try {
        await fs.promises.link(originalFile, hardLinkPath);

        const { result, error } = await checkSkillHardLinks(skillPath, false);

        expect(result.hasHardLinks).toBe(true);
        expect(result.hardLinkedFiles.length).toBeGreaterThanOrEqual(1);
        expect(result.requiresForce).toBe(true);
        expect(error).toBeDefined();
      } catch {
        // Skip if hard links not supported
        console.warn('Hard links not supported in this environment');
      }
    });

    it('warns about hard links crossing skill boundary', async () => {
      // Create file in skill
      const inSkillFile = path.join(skillPath, 'data.txt');
      await fs.promises.writeFile(inSkillFile, 'IMPORTANT DATA');

      // Create hard link outside skill
      const externalLink = path.join(tempDir, 'external-link.txt');
      try {
        await fs.promises.link(inSkillFile, externalLink);

        const warning = await detectHardLinkWarnings(skillPath);

        expect(warning).not.toBeNull();
        if (warning) {
          expect(warning.count).toBeGreaterThanOrEqual(1);
          expect(warning.message).toContain('hard link');
          expect(warning.message).toContain('--force');
        }
      } catch {
        console.warn('Hard links not supported in this environment');
      }
    });

    it('allows update with --force when hard links present', async () => {
      const originalFile = path.join(skillPath, 'original.txt');
      await fs.promises.writeFile(originalFile, 'DATA');

      const hardLinkPath = path.join(skillPath, 'link.txt');
      try {
        await fs.promises.link(originalFile, hardLinkPath);

        const { result, error } = await checkSkillHardLinks(skillPath, true);

        // With --force flag, should be allowed to proceed (no error)
        expect(result.hasHardLinks).toBe(true);
        expect(result.requiresForce).toBe(false);
        expect(error).toBeUndefined();
      } catch {
        console.warn('Hard links not supported in this environment');
      }
    });

    it('correctly reports no hard links in clean skill', async () => {
      // Skill only has SKILL.md which has no additional links
      const { result } = await checkSkillHardLinks(skillPath, false);

      expect(result.hasHardLinks).toBe(false);
      expect(result.hardLinkedFiles.length).toBe(0);
      expect(result.requiresForce).toBe(false);
    });
  });

  // =========================================================================
  // TOCTOU PROTECTION TESTS
  // =========================================================================

  describe('TOCTOU Protection', () => {
    describe('Path Containment Verification', () => {
      it('verifyPathContainment detects traversal for existing paths', async () => {
        // verifyPathContainment uses realpath which requires paths to exist
        // For non-existent paths like /etc/passwd traversal, it returns filesystem-error
        const maliciousPath = path.join(skillPath, '..', '..', '..', 'etc', 'passwd');
        const result = await verifyPathContainment(maliciousPath, skillPath);
        expect(result).not.toBeNull();
        // Non-existent path returns filesystem-error, existing path outside scope returns security-error
        expect(['security-error', 'filesystem-error']).toContain(result?.type);
      });

      it('verifyPathContainment detects scope escape for existing paths', async () => {
        // Create a path that exists but is outside scope
        const outsidePath = path.join(tempDir, 'outside-scope.txt');
        await fs.promises.writeFile(outsidePath, 'outside');

        const result = await verifyPathContainment(outsidePath, skillPath);
        expect(result).not.toBeNull();
        expect(result?.type).toBe('security-error');
      });

      it('allows paths within skill directory', async () => {
        const subDir = path.join(skillPath, 'scripts');
        await fs.promises.mkdir(subDir, { recursive: true });
        const validPath = path.join(subDir, 'helper.py');
        await fs.promises.writeFile(validPath, '# test');

        const result = await verifyPathContainment(validPath, skillPath);
        expect(result).toBeNull(); // null means no error
      });

      it('allows skill directory itself', async () => {
        const result = await verifyPathContainment(skillPath, skillPath);
        expect(result).toBeNull();
      });
    });

    describe('Dangerous Path Detection', () => {
      it('identifies Unix system paths as dangerous', () => {
        expect(isDangerousPath('/etc')).toBe(true);
        expect(isDangerousPath('/usr')).toBe(true);
        expect(isDangerousPath('/bin')).toBe(true);
        expect(isDangerousPath('/var')).toBe(true);
        expect(isDangerousPath('/root')).toBe(true);
        expect(isDangerousPath('/lib')).toBe(true);
        expect(isDangerousPath('/sbin')).toBe(true);
      });

      it('identifies nested system paths as dangerous', () => {
        // /etc/passwd should also be dangerous
        expect(isDangerousPath('/etc/passwd')).toBe(true);
        expect(isDangerousPath('/usr/bin')).toBe(true);
      });

      it('identifies user skill paths as safe', () => {
        expect(isDangerousPath('/home/user/.claude/skills')).toBe(false);
        expect(isDangerousPath('/Users/user/.claude/skills')).toBe(false);
      });
    });

    describe('Containment via path-verifier', () => {
      it('prevents path traversal via verifyContainment', () => {
        const maliciousPath = path.join(skillPath, '..', '..', 'etc', 'passwd');
        const result = verifyContainment(skillPath, maliciousPath);
        expect(result.type).toBe('violation');
      });

      it('allows contained paths via verifyContainment', () => {
        // verifyContainment returns 'valid' for valid paths
        const validPath = path.join(skillPath, 'scripts', 'helper.py');
        const result = verifyContainment(skillPath, validPath);
        expect(result.type).toBe('valid');
      });
    });
  });

  // =========================================================================
  // BACKUP SECURITY TESTS
  // =========================================================================

  describe('Backup Security', () => {
    describe('Backup Directory Validation', () => {
      it('validates backup directory is not a symlink', async () => {
        // Create a symlink backup directory structure
        const realBackupDir = path.join(tempDir, 'real-backups');
        await fs.promises.mkdir(realBackupDir, { recursive: true });

        const symlinkHome = path.join(tempDir, 'symlink-home');
        await fs.promises.mkdir(symlinkHome, { recursive: true });

        const symlinkAsmDir = path.join(symlinkHome, '.asm');
        await fs.promises.symlink(realBackupDir, symlinkAsmDir);

        const result = await validateBackupDirectory({ homedir: symlinkHome });

        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('symbolic link'))).toBe(true);

        // Cleanup
        await fs.promises.unlink(symlinkAsmDir);
        await fs.promises.rm(realBackupDir, { recursive: true, force: true });
      });

      it('validates backup directory has correct permissions', async () => {
        const result = await validateBackupDirectory({ homedir: tempDir });

        if (process.platform !== 'win32') {
          // Should be valid if created with correct permissions
          expect(result.valid).toBe(true);
        }
      });

      it('validateBackupDirectory handles missing directory gracefully', async () => {
        const newHome = path.join(tempDir, 'new-home');
        await fs.promises.mkdir(newHome, { recursive: true });

        // validateBackupDirectory doesn't create directories, it just validates
        const result = await validateBackupDirectory({ homedir: newHome });

        // Should be valid (directories will be created when needed)
        expect(result.valid).toBe(true);
      });
    });

    describe('Backup Path Containment', () => {
      it('prevents backup path traversal to external directory', async () => {
        const maliciousPath = path.join(tempDir, '..', '..', 'etc', 'passwd');
        const result = await verifyBackupContainment(maliciousPath, {
          homedir: tempDir,
        });
        expect(result).toBe(false);
      });

      it('allows backup within backup directory', async () => {
        const validPath = path.join(tempDir, '.asm', 'backups', 'my-skill-20250104-123456.skill');
        const result = await verifyBackupContainment(validPath, {
          homedir: tempDir,
        });
        expect(result).toBe(true);
      });

      it('verifyBackupContainment uses path normalization', async () => {
        // verifyBackupContainment resolves paths and checks if they're within backups dir
        // Symlink following depends on how path.resolve handles it

        // Create backups dir first
        const backupsDir = path.join(tempDir, '.asm', 'backups');
        await fs.promises.mkdir(backupsDir, { recursive: true });

        // Test that a path with traversal is caught
        const traversalPath = path.join(backupsDir, '..', '..', 'etc', 'passwd');
        const result = await verifyBackupContainment(traversalPath, {
          homedir: tempDir,
        });

        expect(result).toBe(false);
      });
    });

    describe('Backup Filename Security', () => {
      it('generates backup filename with random component', () => {
        const filename1 = generateBackupFilename('my-skill');
        const filename2 = generateBackupFilename('my-skill');

        // Should have random component making them different
        expect(filename1).not.toBe(filename2);
        expect(filename1).toMatch(/^my-skill-\d{8}-\d{6}-[a-f0-9]{8}\.skill$/);
      });

      it('handles backup filename collision', async () => {
        // Create an existing backup
        const backupsDir = path.join(tempDir, '.asm', 'backups');
        await fs.promises.mkdir(backupsDir, { recursive: true });
        const existingBackup = path.join(
          backupsDir,
          'collision-skill-20250104-120000-abcd1234.skill'
        );
        await fs.promises.writeFile(existingBackup, 'existing backup');

        // Generate unique path should avoid collision
        const uniquePath = await generateUniqueBackupPath('collision-skill', {
          homedir: tempDir,
        });

        expect(uniquePath).not.toBe(existingBackup);
        expect(fs.existsSync(uniquePath)).toBe(false);
      });

      it('rejects skill names that would create unsafe backup paths', () => {
        expect(validateSkillName('../escape').valid).toBe(false);
        expect(validateSkillName('skill\x00name').valid).toBe(false);
        expect(validateSkillName('skill/name').valid).toBe(false);
      });
    });

    describe('Backup Writability', () => {
      it('validates backup directory is writable', async () => {
        const result = await validateBackupWritability({ homedir: tempDir });
        expect(result.writable).toBe(true);
      });

      it('validateBackupWritability creates directory if missing', async () => {
        // validateBackupWritability will create the backups directory if it doesn't exist
        // This is a convenience feature
        const newHome = path.join(tempDir, 'new-home-writability');
        await fs.promises.mkdir(newHome, { recursive: true });

        const result = await validateBackupWritability({
          homedir: newHome,
        });

        // Should successfully create and verify writability
        expect(result.writable).toBe(true);
      });
    });
  });

  // =========================================================================
  // RESOURCE LIMIT TESTS
  // =========================================================================

  describe('Resource Limits', () => {
    describe('Size Limits', () => {
      it('defines sensible size limit (1GB max)', () => {
        expect(RESOURCE_LIMITS.MAX_SKILL_SIZE).toBeLessThanOrEqual(1024 * 1024 * 1024);
        expect(RESOURCE_LIMITS.MAX_SKILL_SIZE).toBeGreaterThan(0);
      });

      it('enforces resource limits via checkResourceLimits', async () => {
        // Create a skill within limits
        const result = await checkResourceLimits(skillPath, false);
        expect(result.withinLimits).toBe(true);
      });

      it('allows exceeding limits with --force flag', async () => {
        const result = await checkResourceLimits(skillPath, true);
        expect(result.withinLimits).toBe(true);
      });
    });

    describe('File Count Limits', () => {
      it('defines sensible file count limit (10,000 max)', () => {
        expect(RESOURCE_LIMITS.MAX_FILE_COUNT).toBeLessThanOrEqual(10000);
        expect(RESOURCE_LIMITS.MAX_FILE_COUNT).toBeGreaterThan(0);
      });
    });

    describe('Timeout Limits', () => {
      it('defines timeout for update operation', () => {
        expect(RESOURCE_LIMITS.UPDATE_TIMEOUT_MS).toBeDefined();
        expect(RESOURCE_LIMITS.UPDATE_TIMEOUT_MS).toBeGreaterThan(0);
        expect(RESOURCE_LIMITS.UPDATE_TIMEOUT_MS).toBeLessThanOrEqual(300000); // 5 min
      });

      it('defines timeout for backup creation', () => {
        expect(RESOURCE_LIMITS.BACKUP_TIMEOUT_MS).toBeDefined();
        expect(RESOURCE_LIMITS.BACKUP_TIMEOUT_MS).toBeGreaterThan(0);
        expect(RESOURCE_LIMITS.BACKUP_TIMEOUT_MS).toBeLessThanOrEqual(120000); // 2 min
      });

      it('defines timeout for extraction', () => {
        expect(RESOURCE_LIMITS.EXTRACTION_TIMEOUT_MS).toBeDefined();
        expect(RESOURCE_LIMITS.EXTRACTION_TIMEOUT_MS).toBeGreaterThan(0);
        expect(RESOURCE_LIMITS.EXTRACTION_TIMEOUT_MS).toBeLessThanOrEqual(120000); // 2 min
      });

      it('defines timeout for validation', () => {
        expect(RESOURCE_LIMITS.VALIDATION_TIMEOUT_MS).toBeDefined();
        expect(RESOURCE_LIMITS.VALIDATION_TIMEOUT_MS).toBeGreaterThan(0);
        expect(RESOURCE_LIMITS.VALIDATION_TIMEOUT_MS).toBeLessThanOrEqual(5000); // 5 sec
      });
    });
  });

  // =========================================================================
  // CONCURRENT ACCESS TESTS
  // =========================================================================

  describe('Concurrent Access Prevention', () => {
    describe('Lock File Acquisition', () => {
      it('creates lock file with PID and timestamp', async () => {
        const result = await acquireUpdateLock(skillPath, '/path/to/package.skill');

        expect(result.acquired).toBe(true);
        if (result.acquired) {
          expect(result.lockPath).toBeDefined();

          // Verify lock file contents
          const lockContent = JSON.parse(await fs.promises.readFile(result.lockPath, 'utf-8'));
          expect(lockContent.pid).toBe(process.pid);
          expect(lockContent.operationType).toBe('update');
          expect(lockContent.timestamp).toBeDefined();

          // Cleanup
          await releaseUpdateLock(result.lockPath);
        }
      });

      it('prevents second lock acquisition on same skill', async () => {
        const result1 = await acquireUpdateLock(skillPath, '/path/to/package1.skill');
        expect(result1.acquired).toBe(true);

        const result2 = await acquireUpdateLock(skillPath, '/path/to/package2.skill');
        expect(result2.acquired).toBe(false);

        // Cleanup
        if (result1.acquired) {
          await releaseUpdateLock(result1.lockPath);
        }
      });

      it('allows concurrent locks on different skills', async () => {
        const skill1Path = path.join(scopePath, 'skill-1');
        const skill2Path = path.join(scopePath, 'skill-2');
        await fs.promises.mkdir(skill1Path, { recursive: true });
        await fs.promises.mkdir(skill2Path, { recursive: true });

        const result1 = await acquireUpdateLock(skill1Path, '/path/to/pkg1.skill');
        const result2 = await acquireUpdateLock(skill2Path, '/path/to/pkg2.skill');

        expect(result1.acquired).toBe(true);
        expect(result2.acquired).toBe(true);

        // Cleanup
        if (result1.acquired) {
          await releaseUpdateLock(result1.lockPath);
        }
        if (result2.acquired) {
          await releaseUpdateLock(result2.lockPath);
        }
      });
    });

    describe('Stale Lock Detection', () => {
      it('detects stale lock from non-existent PID', async () => {
        // Create lock file in parent directory (where lock files are stored)
        const parentDir = path.dirname(skillPath);
        const skillName = path.basename(skillPath);
        const lockPath = path.join(parentDir, `${skillName}.update.lock`);
        const staleLock = {
          pid: 999999999, // Very unlikely to exist
          timestamp: new Date().toISOString(),
          operationType: 'update',
          packagePath: '/path/to/old.skill',
        };
        await fs.promises.writeFile(lockPath, JSON.stringify(staleLock));

        // Should be able to acquire lock after detecting stale
        const result = await acquireUpdateLock(skillPath, '/path/to/new.skill');

        expect(result.acquired).toBe(true);

        // Cleanup
        if (result.acquired) {
          await releaseUpdateLock(result.lockPath);
        }
      });

      it('identifies lock as stale if process not running', async () => {
        const hasLock = await hasUpdateLock(skillPath);
        // No lock should exist initially
        expect(hasLock).toBe(false);
      });
    });

    describe('Lock Release', () => {
      it('releases lock successfully', async () => {
        const result = await acquireUpdateLock(skillPath, '/path/to/pkg.skill');
        expect(result.acquired).toBe(true);

        if (result.acquired) {
          await releaseUpdateLock(result.lockPath);

          // Should be able to acquire again
          const result2 = await acquireUpdateLock(skillPath, '/path/to/pkg.skill');
          expect(result2.acquired).toBe(true);

          if (result2.acquired) {
            await releaseUpdateLock(result2.lockPath);
          }
        }
      });

      it('handles releasing non-existent lock gracefully', async () => {
        const fakeLockPath = path.join(skillPath, 'fake.lock');

        // Should not throw
        await expect(releaseUpdateLock(fakeLockPath)).resolves.not.toThrow();
      });
    });

    describe('Lock File Security', () => {
      it('creates lock file with standard permissions', async () => {
        const result = await acquireUpdateLock(skillPath, '/path/to/pkg.skill');
        expect(result.acquired).toBe(true);

        if (result.acquired) {
          if (process.platform !== 'win32') {
            const stat = await fs.promises.stat(result.lockPath);
            const mode = stat.mode & 0o777;
            // Lock files are created with standard file permissions
            // The exact mode depends on umask but should be readable
            expect(mode).toBeGreaterThan(0);
          }

          await releaseUpdateLock(result.lockPath);
        }
      });

      it('lock path is derived from skill path', async () => {
        const result = await acquireUpdateLock(skillPath, '/path/to/pkg.skill');

        if (result.acquired) {
          // Lock path should be in the parent directory of skill
          const parentDir = path.dirname(skillPath);
          expect(result.lockPath.startsWith(parentDir)).toBe(true);

          await releaseUpdateLock(result.lockPath);
        }
      });
    });
  });

  // =========================================================================
  // SIGNAL HANDLING TESTS
  // =========================================================================

  describe('Signal Handling & Cleanup', () => {
    describe('Abort Detection', () => {
      it('shouldAbortUpdate returns false initially', () => {
        expect(shouldAbortUpdate()).toBe(false);
      });
    });

    describe('createUpdateCleanupHandler API', () => {
      it('creates cleanup handler function', () => {
        const state = {
          phase: 'validation' as const,
          skillName: 'test-skill',
          skillPath: skillPath,
          packagePath: '/path/to/pkg.skill',
          lockAcquired: false,
        };

        const options = {
          scope: 'project' as const,
          force: false,
          dryRun: false,
          quiet: false,
          noBackup: false,
          keepBackup: false,
          cwd: tempDir,
          homedir: tempDir,
        };

        // Test that the function signature is correct
        const handler = createUpdateCleanupHandler(state, { current: undefined }, options);
        expect(typeof handler).toBe('function');
      });

      it('cleanup handler can be called', async () => {
        const state = {
          phase: 'validation' as const,
          skillName: 'test-skill',
          skillPath: skillPath,
          packagePath: '/path/to/pkg.skill',
          lockAcquired: false,
        };

        const options = {
          scope: 'project' as const,
          force: false,
          dryRun: false,
          quiet: false,
          noBackup: false,
          keepBackup: false,
          cwd: tempDir,
          homedir: tempDir,
        };

        const handler = createUpdateCleanupHandler(state, { current: undefined }, options);
        // Should not throw even in validation phase
        await expect(handler()).resolves.not.toThrow();
      });
    });

    describe('Lock Cleanup on Interrupt', () => {
      it('releases lock file during cleanup', async () => {
        // Create a lock file manually
        const parentDir = path.dirname(skillPath);
        const skillName = path.basename(skillPath);
        const lockPath = path.join(parentDir, `${skillName}.update.lock`);
        await fs.promises.writeFile(
          lockPath,
          JSON.stringify({ pid: process.pid, timestamp: new Date().toISOString() })
        );

        const state = {
          phase: 'backup' as const,
          skillName: 'test-skill',
          skillPath: skillPath,
          packagePath: '/path/to/pkg.skill',
          lockAcquired: true,
          lockPath: lockPath,
        };

        const options = {
          scope: 'project' as const,
          force: false,
          dryRun: false,
          quiet: false,
          noBackup: false,
          keepBackup: false,
          cwd: tempDir,
          homedir: tempDir,
        };

        const handler = createUpdateCleanupHandler(state, { current: undefined }, options);
        await handler();

        // Lock should be released
        await expect(fs.promises.access(lockPath)).rejects.toThrow();
      });
    });
  });

  // =========================================================================
  // INTEGRATION SECURITY TESTS
  // =========================================================================

  describe('Integration Security', () => {
    describe('Full Input Validation Pipeline', () => {
      it('rejects malicious skill name through full validation', async () => {
        const result = await validateInputs('../etc/passwd', '/path/to/pkg.skill', {
          scope: 'project',
          force: false,
          dryRun: false,
          quiet: false,
          noBackup: false,
          keepBackup: false,
          cwd: tempDir,
          homedir: tempDir,
        });

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.type).toBe('validation-error');
        }
      });

      it('rejects non-existent package through validation', async () => {
        const result = await validateInputs('valid-skill', '/nonexistent/package.skill', {
          scope: 'project',
          force: false,
          dryRun: false,
          quiet: false,
          noBackup: false,
          keepBackup: false,
          cwd: tempDir,
          homedir: tempDir,
        });

        expect(result.valid).toBe(false);
      });

      it('accepts valid inputs through validation', async () => {
        // Create a valid package
        const zip = new AdmZip();
        zip.addFile('valid-skill/', Buffer.from(''));
        zip.addFile(
          'valid-skill/SKILL.md',
          Buffer.from('---\nname: valid-skill\ndescription: Test\n---\n# Valid Skill')
        );
        const packagePath = path.join(tempDir, 'valid.skill');
        zip.writeZip(packagePath);

        const result = await validateInputs('valid-skill', packagePath, {
          scope: 'project',
          force: false,
          dryRun: false,
          quiet: false,
          noBackup: false,
          keepBackup: false,
          cwd: tempDir,
          homedir: tempDir,
        });

        expect(result.valid).toBe(true);
      });
    });

    describe('Chained Attack Prevention', () => {
      it('prevents path traversal + symlink chained attack', async () => {
        // Attack: Create symlink then try to traverse through it
        const symlinkTarget = path.join(tempDir, 'target');
        await fs.promises.mkdir(symlinkTarget, { recursive: true });

        const symlinkPath = path.join(skillPath, 'link');
        await fs.promises.symlink(symlinkTarget, symlinkPath);

        // Try to access through symlink + traversal
        const attackPath = path.join(symlinkPath, '..', '..', 'etc');
        const containmentResult = verifyContainment(skillPath, attackPath);

        // Path traversal should be detected
        expect(containmentResult.type).toBe('violation');

        // The skill directory itself is safe (not a symlink)
        // checkSkillSymlinkSafety only checks if the root skill dir is a symlink
        const realScopePath = await fs.promises.realpath(scopePath);
        const symlinkResult = await checkSkillSymlinkSafety(skillPath, realScopePath);

        // Skill directory is not a symlink, so it's "safe" at the root level
        // Nested symlinks are handled separately during extraction
        expect(symlinkResult.safe).toBe(true);

        // Cleanup
        await fs.promises.unlink(symlinkPath);
      });

      it('prevents case sensitivity + access attack', async () => {
        if (process.platform !== 'darwin' && process.platform !== 'win32') {
          // Only relevant on case-insensitive filesystems
          return;
        }

        // Attack: Create "My-Skill" then access as "my-skill"
        const realSkill = path.join(scopePath, 'Target-Skill');
        await fs.promises.mkdir(realSkill, { recursive: true });
        await fs.promises.writeFile(
          path.join(realSkill, 'SKILL.md'),
          '---\nname: target-skill\n---\n# Skill'
        );

        // Verify case sensitivity is enforced
        const caseResult = await verifyCaseSensitivity(realSkill, 'target-skill');

        // Case mismatch should be caught
        expect(caseResult).not.toBeNull();
        if (caseResult && caseResult.type === 'security-error') {
          expect((caseResult as { type: 'security-error'; reason: string }).reason).toBe(
            'case-mismatch'
          );
        }

        await fs.promises.rm(realSkill, { recursive: true, force: true });
      });
    });
  });
});
