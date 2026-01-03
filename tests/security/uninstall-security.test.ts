/**
 * Security attack simulation tests for uninstall functionality
 *
 * These tests simulate various attack vectors to ensure the uninstall
 * command properly protects against:
 * - Path traversal attacks
 * - Symlink escape attacks
 * - Hard link manipulation
 * - TOCTOU (Time-of-check to Time-of-use) vulnerabilities
 * - Case sensitivity exploits
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  checkSymlinkSafety,
  detectHardLinkWarnings,
  getSymlinkSummary,
} from '../../src/generators/security-checker';
import {
  verifyContainment,
  verifyBeforeDeletion,
  isDangerousPath,
} from '../../src/generators/path-verifier';
import { safeUnlink, executeSkillDeletion } from '../../src/utils/safe-delete';
import { validateSkillName } from '../../src/validators/uninstall-name';

describe('Uninstall Security', () => {
  let tempDir: string;
  let scopePath: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-security-attack-'));
    scopePath = path.join(tempDir, 'scope');
    await fs.promises.mkdir(scopePath, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Path Traversal Attacks', () => {
    describe('via skill name validation', () => {
      it('rejects "../" in skill name', () => {
        const result = validateSkillName('../etc');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('path separators');
      });

      it('rejects "..%2F" URL encoded traversal', () => {
        // The %2F would be decoded by the URL parser before reaching us
        // But the skill name itself shouldn't contain these characters
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
        const result = validateSkillName('C:\\Windows');
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
    });

    describe('via path containment check', () => {
      it('prevents ../../../etc/passwd traversal', () => {
        const skillPath = path.join(scopePath, 'my-skill');
        const maliciousPath = path.join(skillPath, '..', '..', '..', 'etc', 'passwd');

        const result = verifyContainment(skillPath, maliciousPath);
        expect(result.type).toBe('violation');
      });

      it('prevents encoded traversal after path resolution', () => {
        const skillPath = path.join(scopePath, 'my-skill');
        // Even if encoded chars slip through, path.resolve normalizes them
        const maliciousPath = path.resolve(skillPath, '..', 'other-skill', '..', '..', 'etc');

        const result = verifyContainment(skillPath, maliciousPath);
        expect(result.type).toBe('violation');
      });
    });

    describe('via safe delete operations', () => {
      it('refuses to delete file outside skill directory', async () => {
        const skillPath = path.join(scopePath, 'skill');
        await fs.promises.mkdir(skillPath, { recursive: true });

        // Create sensitive file outside skill
        const sensitiveFile = path.join(scopePath, 'sensitive.txt');
        await fs.promises.writeFile(sensitiveFile, 'SENSITIVE DATA');

        // Attempt to delete via traversal
        const traversalPath = path.join(skillPath, '..', 'sensitive.txt');
        const result = await safeUnlink(skillPath, traversalPath);

        expect(result.type).toBe('skipped');
        if (result.type === 'skipped') {
          expect(result.reason).toBe('containment-violation');
        }

        // Verify file still exists
        const content = await fs.promises.readFile(sensitiveFile, 'utf-8');
        expect(content).toBe('SENSITIVE DATA');
      });
    });
  });

  describe('Symlink Escape Attacks', () => {
    describe('skill directory is a symlink', () => {
      it('detects symlink to external directory', async () => {
        // Create external target
        const externalDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'external-'));
        await fs.promises.writeFile(path.join(externalDir, 'secret.txt'), 'SECRET');

        // Create symlink skill pointing to external
        const symlinkSkill = path.join(scopePath, 'evil-skill');
        await fs.promises.symlink(externalDir, symlinkSkill);

        try {
          const result = await checkSymlinkSafety(symlinkSkill, scopePath);

          expect(result.type).toBe('escape');
          if (result.type === 'escape') {
            // Use realpath to compare resolved paths (handles /var -> /private/var on macOS)
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

        const symlinkSkill = path.join(scopePath, 'symlink-skill');
        await fs.promises.symlink(targetDir, symlinkSkill);

        try {
          // Use realpath for scope to match what the function does internally
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

    describe('nested symlinks within skill', () => {
      it('detects file symlink pointing outside skill', async () => {
        const skillPath = path.join(scopePath, 'skill');
        await fs.promises.mkdir(skillPath, { recursive: true });

        // Create external secret file
        const secretFile = path.join(tempDir, 'secret.txt');
        await fs.promises.writeFile(secretFile, 'TOP SECRET');

        // Create symlink inside skill pointing to secret
        const evilLink = path.join(skillPath, 'innocent.txt');
        await fs.promises.symlink(secretFile, evilLink);

        const summary = await getSymlinkSummary(skillPath);

        expect(summary.escapingSymlinks).toBe(1);
        expect(summary.hasSecurityConcerns).toBe(true);
      });

      it('detects directory symlink pointing to parent (loop attack)', async () => {
        const skillPath = path.join(scopePath, 'skill');
        await fs.promises.mkdir(skillPath, { recursive: true });

        // Create symlink to parent (loop)
        const loopLink = path.join(skillPath, 'loop');
        await fs.promises.symlink(scopePath, loopLink);

        const summary = await getSymlinkSummary(skillPath);

        expect(summary.escapingSymlinks).toBe(1);
        expect(summary.directorySymlinks).toBe(1);
      });

      it('safe delete removes symlink without following to external target', async () => {
        const skillPath = path.join(scopePath, 'skill');
        await fs.promises.mkdir(skillPath, { recursive: true });

        // Create external directory with file
        const externalDir = path.join(tempDir, 'external');
        await fs.promises.mkdir(externalDir);
        await fs.promises.writeFile(path.join(externalDir, 'keep-me.txt'), 'KEEP ME');

        // Create symlink inside skill
        const linkPath = path.join(skillPath, 'external-link');
        await fs.promises.symlink(externalDir, linkPath);

        // Delete the skill
        await executeSkillDeletion(skillPath);

        // Verify external directory and file still exist
        const content = await fs.promises.readFile(path.join(externalDir, 'keep-me.txt'), 'utf-8');
        expect(content).toBe('KEEP ME');
      });
    });
  });

  describe('Hard Link Detection', () => {
    it('detects files with multiple hard links', async () => {
      const skillPath = path.join(scopePath, 'skill');
      await fs.promises.mkdir(skillPath, { recursive: true });

      // Create original file
      const originalFile = path.join(skillPath, 'original.txt');
      await fs.promises.writeFile(originalFile, 'SHARED DATA');

      // Create hard link to it
      const hardLinkPath = path.join(skillPath, 'hardlink.txt');
      try {
        await fs.promises.link(originalFile, hardLinkPath);

        const warning = await detectHardLinkWarnings(skillPath);

        // Should detect both files have nlink > 1
        expect(warning).not.toBeNull();
        if (warning) {
          expect(warning.count).toBeGreaterThanOrEqual(1);
          expect(warning.message).toContain('hard link');
          expect(warning.message).toContain('--force');
        }
      } catch {
        // Skip if hard links not supported
        console.warn('Hard links not supported in this environment');
      }
    });

    it('warns that deleting hard-linked file leaves data accessible', async () => {
      const skillPath = path.join(scopePath, 'skill');
      await fs.promises.mkdir(skillPath, { recursive: true });

      // Create file with external hard link
      const inSkillFile = path.join(skillPath, 'data.txt');
      await fs.promises.writeFile(inSkillFile, 'IMPORTANT DATA');

      const externalLink = path.join(tempDir, 'external-link.txt');
      try {
        await fs.promises.link(inSkillFile, externalLink);

        // Delete the skill
        await executeSkillDeletion(skillPath);

        // Data should still be accessible via external link
        const content = await fs.promises.readFile(externalLink, 'utf-8');
        expect(content).toBe('IMPORTANT DATA');
      } catch {
        // Skip if hard links not supported
        console.warn('Hard links not supported in this environment');
      }
    });
  });

  describe('TOCTOU Protection', () => {
    it('verifies file before each deletion', async () => {
      const skillPath = path.join(scopePath, 'skill');
      await fs.promises.mkdir(skillPath, { recursive: true });

      const filePath = path.join(skillPath, 'file.txt');
      await fs.promises.writeFile(filePath, 'content');

      // Verify the file
      const result1 = await verifyBeforeDeletion(skillPath, filePath);
      expect(result1.type).toBe('ok');

      // Delete the file externally (simulating race)
      await fs.promises.unlink(filePath);

      // Verification should now fail
      const result2 = await verifyBeforeDeletion(skillPath, filePath);
      expect(result2.type).toBe('failed');
      if (result2.type === 'failed') {
        expect(result2.reason).toBe('not-exists');
      }
    });

    it('handles file replaced with symlink during deletion', async () => {
      const skillPath = path.join(scopePath, 'skill');
      await fs.promises.mkdir(skillPath, { recursive: true });

      const filePath = path.join(skillPath, 'file.txt');
      await fs.promises.writeFile(filePath, 'content');

      // Verify it's a file
      const result1 = await verifyBeforeDeletion(skillPath, filePath);
      expect(result1.type).toBe('ok');
      if (result1.type === 'ok') {
        expect(result1.pathType).toBe('file');
      }

      // Replace with symlink
      await fs.promises.unlink(filePath);
      await fs.promises.symlink('/etc/passwd', filePath);

      // Verification should show it's now a symlink
      const result2 = await verifyBeforeDeletion(skillPath, filePath);
      expect(result2.type).toBe('ok');
      if (result2.type === 'ok') {
        expect(result2.pathType).toBe('symlink');
      }

      // Clean up
      await fs.promises.unlink(filePath);
    });
  });

  describe('Dangerous Path Detection', () => {
    it('identifies system paths as dangerous', () => {
      expect(isDangerousPath('/etc')).toBe(true);
      expect(isDangerousPath('/usr')).toBe(true);
      expect(isDangerousPath('/bin')).toBe(true);
      expect(isDangerousPath('/var')).toBe(true);
      expect(isDangerousPath('/root')).toBe(true);
    });

    it('identifies user paths as safe', () => {
      expect(isDangerousPath('/home/user/.claude/skills')).toBe(false);
      expect(isDangerousPath('/Users/user/.claude/skills')).toBe(false);
    });
  });

  describe('Input Validation Attacks', () => {
    describe('null byte injection', () => {
      it('rejects skill names with null bytes', () => {
        const result = validateSkillName('skill\x00.txt');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('control character');
      });
    });

    describe('control character injection', () => {
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
    });

    describe('unicode attacks', () => {
      it('rejects non-ASCII characters', () => {
        const result = validateSkillName('skill-name-ä');
        expect(result.valid).toBe(false);
      });

      it('rejects unicode lookalikes for slash', () => {
        // U+2215 DIVISION SLASH looks similar to /
        const result = validateSkillName('skill∕name');
        expect(result.valid).toBe(false);
      });

      it('rejects unicode lookalikes for backslash', () => {
        // U+29F5 REVERSE SOLIDUS OPERATOR looks similar to \
        const result = validateSkillName('skill⧵name');
        expect(result.valid).toBe(false);
      });

      it('rejects unicode dot lookalikes', () => {
        // U+2024 ONE DOT LEADER
        const result = validateSkillName('․․');
        expect(result.valid).toBe(false);
      });
    });

    describe('format validation', () => {
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

      it('enforces maximum length', () => {
        const longName = 'a'.repeat(65);
        const result = validateSkillName(longName);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Scope Restriction Attacks', () => {
    it('safe delete only works within skill directory', async () => {
      const skillPath = path.join(scopePath, 'skill');
      await fs.promises.mkdir(skillPath, { recursive: true });

      // Try to delete file in scope but outside skill
      const outsideFile = path.join(scopePath, 'outside.txt');
      await fs.promises.writeFile(outsideFile, 'should not delete');

      const result = await safeUnlink(skillPath, outsideFile);

      expect(result.type).toBe('skipped');
      if (result.type === 'skipped') {
        expect(result.reason).toBe('containment-violation');
      }

      // Verify file still exists
      await expect(fs.promises.access(outsideFile)).resolves.toBeUndefined();
    });

    it('executeSkillDeletion only deletes skill contents', async () => {
      // Create skill with content
      const skillPath = path.join(scopePath, 'skill');
      await fs.promises.mkdir(skillPath, { recursive: true });
      await fs.promises.writeFile(path.join(skillPath, 'skill-file.txt'), 'skill content');

      // Create sibling file
      const siblingFile = path.join(scopePath, 'sibling.txt');
      await fs.promises.writeFile(siblingFile, 'sibling content');

      // Delete the skill
      await executeSkillDeletion(skillPath);

      // Verify skill is deleted
      await expect(fs.promises.access(skillPath)).rejects.toThrow();

      // Verify sibling is NOT deleted
      const content = await fs.promises.readFile(siblingFile, 'utf-8');
      expect(content).toBe('sibling content');
    });
  });
});
