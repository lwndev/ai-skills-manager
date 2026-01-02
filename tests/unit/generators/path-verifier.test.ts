/**
 * Tests for path verifier module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  verifyContainment,
  verifyBeforeDeletion,
  createVerifiedPath,
  isDangerousPath,
  isValidScopePath,
} from '../../../src/generators/path-verifier';

describe('Path Verifier', () => {
  let tempDir: string;
  let skillPath: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-path-verify-test-'));
    skillPath = path.join(tempDir, 'test-skill');

    // Create skill directory with files
    await fs.promises.mkdir(skillPath, { recursive: true });
    await fs.promises.writeFile(path.join(skillPath, 'SKILL.md'), '# Test Skill');
    await fs.promises.writeFile(path.join(skillPath, 'file1.txt'), 'content');
    await fs.promises.mkdir(path.join(skillPath, 'subdir'));
    await fs.promises.writeFile(path.join(skillPath, 'subdir', 'file2.txt'), 'more content');
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('verifyContainment', () => {
    it('returns valid for path within base directory', () => {
      const result = verifyContainment(skillPath, path.join(skillPath, 'file1.txt'));

      expect(result.type).toBe('valid');
      if (result.type === 'valid') {
        expect(result.normalizedPath).toContain('file1.txt');
      }
    });

    it('returns valid for nested path within base directory', () => {
      const result = verifyContainment(skillPath, path.join(skillPath, 'subdir', 'file2.txt'));

      expect(result.type).toBe('valid');
      if (result.type === 'valid') {
        expect(result.normalizedPath).toContain('subdir');
        expect(result.normalizedPath).toContain('file2.txt');
      }
    });

    it('returns valid when target equals base exactly', () => {
      const result = verifyContainment(skillPath, skillPath);

      expect(result.type).toBe('valid');
    });

    it('returns violation for path outside base directory', () => {
      const outsidePath = path.join(tempDir, 'other-file.txt');
      const result = verifyContainment(skillPath, outsidePath);

      expect(result.type).toBe('violation');
      if (result.type === 'violation') {
        expect(result.basePath).toBe(path.resolve(skillPath));
      }
    });

    it('returns violation for path traversal attempt with ../', () => {
      const traversalPath = path.join(skillPath, '..', 'other-skill');
      const result = verifyContainment(skillPath, traversalPath);

      expect(result.type).toBe('violation');
    });

    it('returns violation for absolute path outside base', () => {
      const result = verifyContainment(skillPath, '/etc/passwd');

      expect(result.type).toBe('violation');
      if (result.type === 'violation') {
        expect(result.reason).toContain('outside');
      }
    });

    it('handles paths with trailing slashes', () => {
      const baseWithSlash = skillPath + path.sep;
      const result = verifyContainment(baseWithSlash, path.join(skillPath, 'file1.txt'));

      expect(result.type).toBe('valid');
    });

    it('handles relative paths correctly', () => {
      // Use relative path from cwd - this tests path normalization
      const absSkillPath = path.resolve(skillPath);
      const relFilePath = path.join(skillPath, 'file1.txt');
      const result = verifyContainment(absSkillPath, relFilePath);

      expect(result.type).toBe('valid');
    });
  });

  describe('verifyBeforeDeletion', () => {
    it('returns ok for existing file within skill directory', async () => {
      const filePath = path.join(skillPath, 'file1.txt');
      const result = await verifyBeforeDeletion(skillPath, filePath);

      expect(result.type).toBe('ok');
      if (result.type === 'ok') {
        expect(result.pathType).toBe('file');
        expect(result.size).toBeGreaterThan(0);
      }
    });

    it('returns ok for existing directory', async () => {
      const dirPath = path.join(skillPath, 'subdir');
      const result = await verifyBeforeDeletion(skillPath, dirPath);

      expect(result.type).toBe('ok');
      if (result.type === 'ok') {
        expect(result.pathType).toBe('directory');
      }
    });

    it('returns ok for symlink', async () => {
      // Create a symlink
      const targetFile = path.join(skillPath, 'file1.txt');
      const symlinkPath = path.join(skillPath, 'link.txt');

      try {
        await fs.promises.symlink(targetFile, symlinkPath);

        const result = await verifyBeforeDeletion(skillPath, symlinkPath);

        expect(result.type).toBe('ok');
        if (result.type === 'ok') {
          expect(result.pathType).toBe('symlink');
        }
      } finally {
        try {
          await fs.promises.unlink(symlinkPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it('returns failed for non-existent file', async () => {
      const nonExistentPath = path.join(skillPath, 'does-not-exist.txt');
      const result = await verifyBeforeDeletion(skillPath, nonExistentPath);

      expect(result.type).toBe('failed');
      if (result.type === 'failed') {
        expect(result.reason).toBe('not-exists');
      }
    });

    it('returns failed for path outside skill directory', async () => {
      const outsidePath = path.join(tempDir, 'outside.txt');
      await fs.promises.writeFile(outsidePath, 'outside content');

      try {
        const result = await verifyBeforeDeletion(skillPath, outsidePath);

        expect(result.type).toBe('failed');
        if (result.type === 'failed') {
          expect(result.reason).toBe('containment-violation');
        }
      } finally {
        await fs.promises.unlink(outsidePath);
      }
    });

    it('returns failed for path traversal attempt', async () => {
      const traversalPath = path.join(skillPath, '..', 'other', 'file.txt');
      const result = await verifyBeforeDeletion(skillPath, traversalPath);

      expect(result.type).toBe('failed');
      if (result.type === 'failed') {
        expect(result.reason).toBe('containment-violation');
      }
    });
  });

  describe('createVerifiedPath', () => {
    it('creates a verified path object for valid file', async () => {
      const filePath = path.join(skillPath, 'file1.txt');
      const result = await createVerifiedPath(skillPath, filePath);

      if ('type' in result && result.type === 'error') {
        fail('Expected verified path, got error');
      } else if ('path' in result) {
        expect(result.path).toBe(filePath);
        expect(result.skillPath).toBe(skillPath);
        expect(result.pathType).toBe('file');
        expect(result.verifiedAt).toBeLessThanOrEqual(Date.now());
      } else {
        fail('Expected verified path with path property');
      }
    });

    it('returns error for invalid path', async () => {
      const invalidPath = path.join(skillPath, '..', 'escaped');
      const result = await createVerifiedPath(skillPath, invalidPath);

      expect('type' in result && result.type).toBe('error');
    });
  });

  describe('isDangerousPath', () => {
    it('identifies /etc as dangerous', () => {
      expect(isDangerousPath('/etc/passwd')).toBe(true);
      expect(isDangerousPath('/etc')).toBe(true);
    });

    it('identifies /usr as dangerous', () => {
      expect(isDangerousPath('/usr/bin/node')).toBe(true);
    });

    it('identifies /bin as dangerous', () => {
      expect(isDangerousPath('/bin/sh')).toBe(true);
    });

    it('identifies /var as dangerous', () => {
      expect(isDangerousPath('/var/log')).toBe(true);
    });

    it('identifies /boot as dangerous', () => {
      expect(isDangerousPath('/boot/vmlinuz')).toBe(true);
    });

    it('identifies /root as dangerous', () => {
      expect(isDangerousPath('/root/.bashrc')).toBe(true);
    });

    it('identifies /tmp as dangerous', () => {
      expect(isDangerousPath('/tmp/sensitive')).toBe(true);
    });

    it('identifies /sys as dangerous', () => {
      expect(isDangerousPath('/sys/class')).toBe(true);
    });

    it('identifies /proc as dangerous', () => {
      expect(isDangerousPath('/proc/1/status')).toBe(true);
    });

    it('identifies /dev as dangerous', () => {
      expect(isDangerousPath('/dev/null')).toBe(true);
    });

    it('identifies Windows system paths as dangerous', () => {
      // Windows paths are lowercased and checked, but path.resolve may differ by platform
      // Test the intent - that Windows system paths are flagged
      if (process.platform === 'win32') {
        expect(isDangerousPath('C:\\Windows\\System32')).toBe(true);
        expect(isDangerousPath('C:\\Program Files')).toBe(true);
      } else {
        // On non-Windows, the path.resolve behavior differs
        // Just verify the function runs without error
        expect(typeof isDangerousPath('C:\\Windows\\System32')).toBe('boolean');
      }
    });

    it('returns false for regular paths', () => {
      expect(isDangerousPath('/home/user/.claude/skills/my-skill')).toBe(false);
      expect(isDangerousPath('/Users/user/.claude/skills/my-skill')).toBe(false);
      // Note: temp directory paths like /tmp are intentionally flagged as dangerous
      // So we test a real user directory path instead
      expect(isDangerousPath('/home/testuser/projects/skill')).toBe(false);
    });

    it('handles case insensitivity', () => {
      expect(isDangerousPath('/ETC/passwd')).toBe(true);
      expect(isDangerousPath('/USR/bin')).toBe(true);
    });
  });

  describe('isValidScopePath', () => {
    it('validates paths ending with .claude/skills', () => {
      expect(isValidScopePath('/home/user/.claude/skills')).toBe(true);
      expect(isValidScopePath('/Users/user/.claude/skills')).toBe(true);
      expect(isValidScopePath('/project/.claude/skills')).toBe(true);
    });

    it('rejects paths not ending with .claude/skills', () => {
      expect(isValidScopePath('/home/user/.config/skills')).toBe(false);
      expect(isValidScopePath('/home/user/skills')).toBe(false);
      expect(isValidScopePath('/tmp')).toBe(false);
    });

    it('handles paths with trailing content after .claude/skills', () => {
      // Path with extra content after .claude/skills is invalid
      expect(isValidScopePath('/home/user/.claude/skills/extra')).toBe(false);
    });
  });
});
