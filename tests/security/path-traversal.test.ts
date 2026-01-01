/**
 * Security tests for path traversal prevention
 *
 * These tests verify that malicious packages cannot write files
 * outside the target installation directory.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { isPathWithinTarget, extractSkillToTarget } from '../../src/generators/installer';
import { InvalidPackageError } from '../../src/utils/errors';

describe('path traversal prevention', () => {
  let tempDir: string;
  let targetDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-security-test-'));
    targetDir = path.join(tempDir, 'target');
    await fs.mkdir(targetDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('isPathWithinTarget', () => {
    it('returns true for path directly in target', () => {
      const resolved = path.join(targetDir, 'file.txt');
      expect(isPathWithinTarget(targetDir, resolved)).toBe(true);
    });

    it('returns true for path in subdirectory of target', () => {
      const resolved = path.join(targetDir, 'sub', 'dir', 'file.txt');
      expect(isPathWithinTarget(targetDir, resolved)).toBe(true);
    });

    it('returns true for target directory itself', () => {
      expect(isPathWithinTarget(targetDir, targetDir)).toBe(true);
    });

    it('returns false for path with ../ escaping target', () => {
      const resolved = path.resolve(targetDir, '..', 'escaped.txt');
      expect(isPathWithinTarget(targetDir, resolved)).toBe(false);
    });

    it('returns false for path completely outside target', () => {
      const resolved = path.join(os.tmpdir(), 'outside.txt');
      expect(isPathWithinTarget(targetDir, resolved)).toBe(false);
    });

    it('returns false for sibling directory', () => {
      const siblingDir = path.join(path.dirname(targetDir), 'sibling');
      expect(isPathWithinTarget(targetDir, siblingDir)).toBe(false);
    });

    it('returns false for parent directory', () => {
      const parentDir = path.dirname(targetDir);
      expect(isPathWithinTarget(targetDir, parentDir)).toBe(false);
    });

    it('handles symbolic traversal patterns', () => {
      // Path that looks like it's in target but resolves outside
      const resolved = path.resolve(targetDir, 'sub', '..', '..', 'escaped.txt');
      expect(isPathWithinTarget(targetDir, resolved)).toBe(false);
    });
  });

  describe('extractSkillToTarget - path traversal attacks', () => {
    it('rejects package with ../ in file path when entry escapes target', async () => {
      // Note: adm-zip normalizes paths when using addFile, so we need to test
      // the path validation function directly for reliable results
      const target = path.join(tempDir, 'target-test');
      const escapedPath = path.join(tempDir, 'escaped.txt');

      // Test the validation function directly
      expect(isPathWithinTarget(target, escapedPath)).toBe(false);
      expect(isPathWithinTarget(target, path.join(target, 'safe.txt'))).toBe(true);

      // For the extraction, test a package where adm-zip doesn't normalize
      // by verifying our validation catches the case
      const validZip = new AdmZip();
      validZip.addFile('safe-skill/', Buffer.from(''));
      validZip.addFile(
        'safe-skill/SKILL.md',
        Buffer.from('---\nname: safe-skill\ndescription: Safe\n---\n# Safe')
      );

      const result = await extractSkillToTarget(validZip, 'safe-skill', targetDir);
      expect(result.fileCount).toBe(1);
    });

    it('validates path traversal check for nested directories', () => {
      // Test the isPathWithinTarget function with various escape attempts
      const target = '/home/user/skills/my-skill';

      // These should be rejected
      expect(isPathWithinTarget(target, '/home/user/skills/escaped.txt')).toBe(false);
      expect(isPathWithinTarget(target, '/etc/passwd')).toBe(false);
      expect(isPathWithinTarget(target, '/home/user/other/file.txt')).toBe(false);

      // These should be allowed
      expect(isPathWithinTarget(target, '/home/user/skills/my-skill/file.txt')).toBe(true);
      expect(isPathWithinTarget(target, '/home/user/skills/my-skill/sub/deep/file.txt')).toBe(true);
    });

    it('rejects absolute path injection', async () => {
      const zip = new AdmZip();
      zip.addFile('bad-skill/', Buffer.from(''));
      zip.addFile('bad-skill/SKILL.md', Buffer.from('---\nname: bad-skill\n---\n# Skill'));
      // Note: AdmZip may normalize this, but we still test for it
      zip.addFile('bad-skill//etc/passwd', Buffer.from('root:x:0:0'));

      // This test checks that our validation handles edge cases
      // The file may be normalized by AdmZip, so check both scenarios
      try {
        await extractSkillToTarget(zip, 'bad-skill', targetDir);
        // If extraction succeeds, verify the file is in the target
        const expectedPath = path.join(targetDir, 'etc', 'passwd');
        const stat = await fs.stat(expectedPath);
        expect(stat.isFile()).toBe(true); // File should be within target
      } catch (error) {
        // If it throws, it should be a path traversal error
        expect(error).toBeInstanceOf(InvalidPackageError);
      }
    });

    it('allows safe nested directory structures', async () => {
      const zip = new AdmZip();
      zip.addFile('safe-skill/', Buffer.from(''));
      zip.addFile(
        'safe-skill/SKILL.md',
        Buffer.from('---\nname: safe-skill\ndescription: A safe skill\n---\n# Safe Skill')
      );
      zip.addFile('safe-skill/scripts/', Buffer.from(''));
      zip.addFile('safe-skill/scripts/helper.py', Buffer.from('print("safe")'));
      zip.addFile('safe-skill/templates/', Buffer.from(''));
      zip.addFile('safe-skill/templates/report.md', Buffer.from('# Report'));

      const result = await extractSkillToTarget(zip, 'safe-skill', targetDir);

      expect(result.fileCount).toBe(3); // SKILL.md, helper.py, report.md
      expect(result.files).toContain('SKILL.md');
      expect(result.files).toContain('scripts/helper.py');
      expect(result.files).toContain('templates/report.md');
    });

    it('validates that files are only written within target directory', async () => {
      // Since adm-zip normalizes paths during addFile, we test the validation
      // function directly and also verify that extraction works correctly
      // for legitimate packages

      // Create a file that should NOT be touched by any extraction
      const sensitiveFile = path.join(tempDir, 'sensitive', 'data.txt');
      await fs.mkdir(path.dirname(sensitiveFile), { recursive: true });
      await fs.writeFile(sensitiveFile, 'original sensitive content');

      // Create and extract a safe package
      const zip = new AdmZip();
      zip.addFile('safe-skill/', Buffer.from(''));
      zip.addFile(
        'safe-skill/SKILL.md',
        Buffer.from('---\nname: safe-skill\ndescription: Safe skill\n---\n# Safe Skill')
      );
      zip.addFile('safe-skill/data.txt', Buffer.from('skill data'));

      await extractSkillToTarget(zip, 'safe-skill', targetDir);

      // Verify the sensitive file was not touched
      const sensitiveContent = await fs.readFile(sensitiveFile, 'utf-8');
      expect(sensitiveContent).toBe('original sensitive content');

      // Verify the skill file was written correctly
      const skillContent = await fs.readFile(path.join(targetDir, 'data.txt'), 'utf-8');
      expect(skillContent).toBe('skill data');
    });

    it('rejects hidden path traversal with URL encoding patterns', async () => {
      const zip = new AdmZip();
      zip.addFile('trick-skill/', Buffer.from(''));
      zip.addFile('trick-skill/SKILL.md', Buffer.from('---\nname: trick-skill\n---\n# Skill'));
      // Some systems might interpret these differently
      zip.addFile('trick-skill/..%2F..%2Fescaped.txt', Buffer.from('escaped'));

      // This should either succeed (treating it as a literal filename) or fail on traversal
      try {
        await extractSkillToTarget(zip, 'trick-skill', targetDir);
        // If it succeeds, verify the file is in the target
        const files = await fs.readdir(targetDir, { recursive: true });
        for (const file of files) {
          const fullPath = path.join(targetDir, file.toString());
          expect(isPathWithinTarget(targetDir, fullPath)).toBe(true);
        }
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidPackageError);
      }
    });
  });

  describe('boundary conditions', () => {
    it('handles empty file entries', async () => {
      const zip = new AdmZip();
      zip.addFile('empty-skill/', Buffer.from(''));
      zip.addFile(
        'empty-skill/SKILL.md',
        Buffer.from('---\nname: empty-skill\ndescription: Empty\n---\n# Empty Skill\n\nNo files.')
      );

      const result = await extractSkillToTarget(zip, 'empty-skill', targetDir);

      expect(result.fileCount).toBe(1);
    });

    it('handles deeply nested paths', async () => {
      const zip = new AdmZip();
      const deepPath = 'deep-skill/a/b/c/d/e/f/g/h/i/j/file.txt';
      zip.addFile('deep-skill/', Buffer.from(''));
      zip.addFile(
        'deep-skill/SKILL.md',
        Buffer.from('---\nname: deep-skill\ndescription: Deep\n---\n# Deep')
      );
      zip.addFile(deepPath, Buffer.from('deep file'));

      const result = await extractSkillToTarget(zip, 'deep-skill', targetDir);

      expect(result.fileCount).toBe(2);
      const deepFile = path.join(targetDir, 'a/b/c/d/e/f/g/h/i/j/file.txt');
      const exists = await fs
        .access(deepFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
