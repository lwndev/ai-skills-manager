/**
 * Unit tests for lock file utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  acquireUninstallLock,
  releaseUninstallLock,
  hasUninstallLock,
} from '../../../src/utils/lock-file';

describe('Lock File Utilities', () => {
  let tempDir: string;
  let skillPath: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-lock-'));
    skillPath = path.join(tempDir, 'my-skill');
    await fs.promises.mkdir(skillPath, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('acquireUninstallLock', () => {
    it('acquires lock when no existing lock', async () => {
      const result = await acquireUninstallLock(skillPath);

      expect(result.acquired).toBe(true);
      expect(result.lockPath).toContain('my-skill');
      expect(result.lockPath).toContain('.asm-uninstall.lock');

      // Cleanup
      await releaseUninstallLock(result.lockPath);
    });

    it('creates lock file with correct content', async () => {
      const result = await acquireUninstallLock(skillPath);

      expect(result.acquired).toBe(true);

      const content = await fs.promises.readFile(result.lockPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.pid).toBe(process.pid);
      expect(parsed.skillPath).toBe(skillPath);
      expect(parsed.timestamp).toBeDefined();

      // Cleanup
      await releaseUninstallLock(result.lockPath);
    });

    it('prevents concurrent lock acquisition', async () => {
      const lock1 = await acquireUninstallLock(skillPath);
      expect(lock1.acquired).toBe(true);

      const lock2 = await acquireUninstallLock(skillPath);
      expect(lock2.acquired).toBe(false);
      expect(lock2.reason).toBe('already-locked');
      expect(lock2.message).toContain('currently being uninstalled');

      // Cleanup
      await releaseUninstallLock(lock1.lockPath);
    });

    it('allows lock acquisition after release', async () => {
      const lock1 = await acquireUninstallLock(skillPath);
      await releaseUninstallLock(lock1.lockPath);

      const lock2 = await acquireUninstallLock(skillPath);
      expect(lock2.acquired).toBe(true);

      // Cleanup
      await releaseUninstallLock(lock2.lockPath);
    });
  });

  describe('releaseUninstallLock', () => {
    it('removes lock file', async () => {
      const lock = await acquireUninstallLock(skillPath);
      expect(lock.acquired).toBe(true);

      // Verify lock file exists
      await expect(fs.promises.access(lock.lockPath)).resolves.toBeUndefined();

      await releaseUninstallLock(lock.lockPath);

      // Verify lock file removed
      await expect(fs.promises.access(lock.lockPath)).rejects.toThrow();
    });

    it('does not throw if lock file already removed', async () => {
      const lock = await acquireUninstallLock(skillPath);
      await fs.promises.unlink(lock.lockPath);

      // Should not throw
      await expect(releaseUninstallLock(lock.lockPath)).resolves.toBeUndefined();
    });

    it('does not throw for non-existent path', async () => {
      await expect(releaseUninstallLock('/non/existent/path.lock')).resolves.toBeUndefined();
    });
  });

  describe('hasUninstallLock', () => {
    it('returns false when no lock exists', async () => {
      const result = await hasUninstallLock(skillPath);
      expect(result).toBe(false);
    });

    it('returns true when lock exists', async () => {
      const lock = await acquireUninstallLock(skillPath);

      const result = await hasUninstallLock(skillPath);
      expect(result).toBe(true);

      // Cleanup
      await releaseUninstallLock(lock.lockPath);
    });

    it('returns false after lock is released', async () => {
      const lock = await acquireUninstallLock(skillPath);
      await releaseUninstallLock(lock.lockPath);

      const result = await hasUninstallLock(skillPath);
      expect(result).toBe(false);
    });
  });

  describe('concurrent access', () => {
    it('handles rapid lock/unlock cycles', async () => {
      for (let i = 0; i < 10; i++) {
        const lock = await acquireUninstallLock(skillPath);
        expect(lock.acquired).toBe(true);
        await releaseUninstallLock(lock.lockPath);
      }
    });

    it('maintains lock exclusivity during operations', async () => {
      const lock = await acquireUninstallLock(skillPath);

      // Simulate multiple concurrent attempts
      const attempts = await Promise.all([
        acquireUninstallLock(skillPath),
        acquireUninstallLock(skillPath),
        acquireUninstallLock(skillPath),
      ]);

      // All should fail
      for (const attempt of attempts) {
        expect(attempt.acquired).toBe(false);
      }

      // Cleanup
      await releaseUninstallLock(lock.lockPath);
    });
  });

  describe('stale lock handling', () => {
    it('removes stale lock and acquires new lock', async () => {
      // Create a stale lock file manually with old timestamp
      const lockPath = path.join(tempDir, 'my-skill.asm-uninstall.lock');
      const staleLockContent = JSON.stringify({
        pid: 99999,
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour old
        skillPath,
      });

      await fs.promises.writeFile(lockPath, staleLockContent);

      // Manually update mtime to make it stale (10 minutes ago)
      const pastTime = new Date(Date.now() - 600000);
      await fs.promises.utimes(lockPath, pastTime, pastTime);

      // Should acquire lock by removing stale lock
      const result = await acquireUninstallLock(skillPath);

      expect(result.acquired).toBe(true);

      // Cleanup
      await releaseUninstallLock(result.lockPath);
    });
  });

  describe('error handling', () => {
    it('returns filesystem-error for permission issues', async () => {
      // Test with a path where we can't create lock file
      const invalidPath = '/nonexistent/skill';

      const result = await acquireUninstallLock(invalidPath);

      expect(result.acquired).toBe(false);
      expect(result.reason).toBe('filesystem-error');
      expect(result.message).toContain('Failed to acquire lock');
    });

    it('handles EEXIST race condition gracefully', async () => {
      // Acquire lock first
      const lock1 = await acquireUninstallLock(skillPath);
      expect(lock1.acquired).toBe(true);

      // Manually delete the lock to simulate race condition setup
      await fs.promises.unlink(lock1.lockPath);

      // Try to acquire two locks simultaneously to trigger EEXIST
      const [lock2, lock3] = await Promise.all([
        acquireUninstallLock(skillPath),
        acquireUninstallLock(skillPath),
      ]);

      // One should succeed, one should fail with already-locked
      const results = [lock2, lock3];
      const succeeded = results.filter((r) => r.acquired);
      const failed = results.filter((r) => !r.acquired);

      expect(succeeded.length).toBe(1);
      expect(failed.length).toBe(1);

      // Cleanup
      if (succeeded[0]) {
        await releaseUninstallLock(succeeded[0].lockPath);
      }
    });
  });
});
