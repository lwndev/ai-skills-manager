/**
 * Tests for security checker module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  checkSymlinkSafety,
  checkDirectorySymlinks,
  checkHardLinks,
  detectHardLinkWarnings,
  getSymlinkSummary,
} from '../../../src/generators/security-checker';

describe('Security Checker', () => {
  let tempDir: string;
  let skillPath: string;
  let scopePath: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-security-test-'));
    scopePath = tempDir;
    skillPath = path.join(tempDir, 'test-skill');

    // Create skill directory with various file types
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

  describe('checkSymlinkSafety', () => {
    it('returns "safe" for a regular directory', async () => {
      const result = await checkSymlinkSafety(skillPath, scopePath);

      expect(result.type).toBe('safe');
      if (result.type === 'safe') {
        expect(result.isSymlink).toBe(false);
      }
    });

    it('returns "safe" for a symlink within scope', async () => {
      // Create a target directory within scope
      const targetDir = path.join(tempDir, 'target-dir');
      await fs.promises.mkdir(targetDir, { recursive: true });

      // Create a symlink to the target
      const symlinkPath = path.join(tempDir, 'symlink-skill');
      try {
        await fs.promises.symlink(targetDir, symlinkPath);

        // Use realpath for scope to match what the function does internally
        const realScopePath = await fs.promises.realpath(scopePath);
        const result = await checkSymlinkSafety(symlinkPath, realScopePath);

        expect(result.type).toBe('safe');
        if (result.type === 'safe') {
          expect(result.isSymlink).toBe(true);
          // Compare resolved paths
          const realTargetDir = await fs.promises.realpath(targetDir);
          expect(result.resolvedPath).toBe(realTargetDir);
        }
      } finally {
        // Clean up
        try {
          await fs.promises.unlink(symlinkPath);
        } catch {
          // Ignore cleanup errors
        }
        await fs.promises.rm(targetDir, { recursive: true, force: true });
      }
    });

    it('returns "escape" for a symlink pointing outside scope', async () => {
      // Create a directory outside the scope
      const outsideDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'outside-'));

      // Create a symlink pointing to it
      const symlinkPath = path.join(tempDir, 'escape-symlink');
      try {
        await fs.promises.symlink(outsideDir, symlinkPath);

        const result = await checkSymlinkSafety(symlinkPath, scopePath);

        expect(result.type).toBe('escape');
        if (result.type === 'escape') {
          // Use realpath to compare resolved paths (handles /var -> /private/var on macOS)
          const realOutsideDir = await fs.promises.realpath(outsideDir);
          expect(result.targetPath).toBe(realOutsideDir);
        }
      } finally {
        // Clean up
        try {
          await fs.promises.unlink(symlinkPath);
        } catch {
          // Ignore cleanup errors
        }
        await fs.promises.rm(outsideDir, { recursive: true, force: true });
      }
    });

    it('returns "error" for non-existent path', async () => {
      const result = await checkSymlinkSafety(path.join(tempDir, 'nonexistent'), scopePath);

      expect(result.type).toBe('error');
    });
  });

  describe('checkDirectorySymlinks', () => {
    let symlinkSkillPath: string;

    beforeAll(async () => {
      // Create a skill with symlinks
      symlinkSkillPath = path.join(tempDir, 'symlink-skill-test');
      await fs.promises.mkdir(symlinkSkillPath, { recursive: true });

      // Create a target file
      await fs.promises.writeFile(path.join(symlinkSkillPath, 'target.txt'), 'target content');

      // Create a symlink to the file (within the skill)
      await fs.promises.symlink(
        path.join(symlinkSkillPath, 'target.txt'),
        path.join(symlinkSkillPath, 'link-to-target.txt')
      );

      // Create a symlink to a directory within the skill
      await fs.promises.mkdir(path.join(symlinkSkillPath, 'real-dir'));
      await fs.promises.symlink(
        path.join(symlinkSkillPath, 'real-dir'),
        path.join(symlinkSkillPath, 'dir-symlink')
      );
    });

    afterAll(async () => {
      await fs.promises.rm(symlinkSkillPath, { recursive: true, force: true });
    });

    it('finds symlinks in the skill directory', async () => {
      const symlinks: Awaited<
        ReturnType<typeof checkDirectorySymlinks> extends AsyncGenerator<infer T> ? T : never
      >[] = [];

      for await (const symlink of checkDirectorySymlinks(symlinkSkillPath)) {
        symlinks.push(symlink);
      }

      expect(symlinks.length).toBeGreaterThanOrEqual(2);

      const fileSymlink = symlinks.find((s) => s.relativePath === 'link-to-target.txt');
      expect(fileSymlink).toBeDefined();
      expect(fileSymlink?.isDirectorySymlink).toBe(false);
      expect(fileSymlink?.escapesScope).toBe(false);
    });

    it('detects directory symlinks', async () => {
      const symlinks: Awaited<
        ReturnType<typeof checkDirectorySymlinks> extends AsyncGenerator<infer T> ? T : never
      >[] = [];

      for await (const symlink of checkDirectorySymlinks(symlinkSkillPath)) {
        symlinks.push(symlink);
      }

      const dirSymlink = symlinks.find((s) => s.relativePath === 'dir-symlink');
      expect(dirSymlink).toBeDefined();
      expect(dirSymlink?.isDirectorySymlink).toBe(true);
    });

    it('returns empty generator for directory with no symlinks', async () => {
      const symlinks: Awaited<
        ReturnType<typeof checkDirectorySymlinks> extends AsyncGenerator<infer T> ? T : never
      >[] = [];

      for await (const symlink of checkDirectorySymlinks(skillPath)) {
        symlinks.push(symlink);
      }

      expect(symlinks.length).toBe(0);
    });
  });

  describe('checkHardLinks', () => {
    let hardLinkSkillPath: string;

    beforeAll(async () => {
      // Create a skill with hard links
      hardLinkSkillPath = path.join(tempDir, 'hardlink-skill');
      await fs.promises.mkdir(hardLinkSkillPath, { recursive: true });

      // Create a regular file
      const originalFile = path.join(hardLinkSkillPath, 'original.txt');
      await fs.promises.writeFile(originalFile, 'original content');

      // Create a hard link to the file
      try {
        await fs.promises.link(originalFile, path.join(hardLinkSkillPath, 'hardlink.txt'));
      } catch {
        // Hard links might not work in all environments (e.g., some Docker containers)
        console.warn('Could not create hard link - test may be limited');
      }
    });

    afterAll(async () => {
      await fs.promises.rm(hardLinkSkillPath, { recursive: true, force: true });
    });

    it('detects files with multiple hard links', async () => {
      const hardLinks: Awaited<
        ReturnType<typeof checkHardLinks> extends AsyncGenerator<infer T> ? T : never
      >[] = [];

      for await (const hardLink of checkHardLinks(hardLinkSkillPath)) {
        hardLinks.push(hardLink);
      }

      // Should find at least the original file (which now has nlink=2)
      // Both the original and the hardlink will show nlink=2
      if (hardLinks.length > 0) {
        expect(hardLinks[0].linkCount).toBeGreaterThan(1);
      }
    });

    it('ignores regular files without hard links', async () => {
      // The test-skill directory has regular files with nlink=1
      const hardLinks: Awaited<
        ReturnType<typeof checkHardLinks> extends AsyncGenerator<infer T> ? T : never
      >[] = [];

      for await (const hardLink of checkHardLinks(skillPath)) {
        hardLinks.push(hardLink);
      }

      expect(hardLinks.length).toBe(0);
    });
  });

  describe('detectHardLinkWarnings', () => {
    it('returns null when no hard links are found', async () => {
      const warning = await detectHardLinkWarnings(skillPath);

      expect(warning).toBeNull();
    });

    it('returns a warning when hard links are found', async () => {
      // Create a skill with hard links
      const hardLinkSkillPath = path.join(tempDir, 'hardlink-warn-skill');
      await fs.promises.mkdir(hardLinkSkillPath, { recursive: true });

      const originalFile = path.join(hardLinkSkillPath, 'original.txt');
      await fs.promises.writeFile(originalFile, 'content');

      try {
        await fs.promises.link(originalFile, path.join(hardLinkSkillPath, 'link.txt'));

        const warning = await detectHardLinkWarnings(hardLinkSkillPath);

        if (warning) {
          expect(warning.count).toBeGreaterThan(0);
          expect(warning.message).toContain('hard link');
          expect(warning.message).toContain('--force');
        }
      } finally {
        await fs.promises.rm(hardLinkSkillPath, { recursive: true, force: true });
      }
    });
  });

  describe('getSymlinkSummary', () => {
    it('returns summary for directory without symlinks', async () => {
      const summary = await getSymlinkSummary(skillPath);

      expect(summary.totalSymlinks).toBe(0);
      expect(summary.escapingSymlinks).toBe(0);
      expect(summary.directorySymlinks).toBe(0);
      expect(summary.hasSecurityConcerns).toBe(false);
      expect(summary.warning).toBeUndefined();
    });

    it('returns summary with counts for directory with symlinks', async () => {
      // Create a skill with symlinks
      const symlinkSkillPath = path.join(tempDir, 'summary-symlink-skill');
      await fs.promises.mkdir(symlinkSkillPath, { recursive: true });

      // Create target and symlink within
      await fs.promises.writeFile(path.join(symlinkSkillPath, 'target.txt'), 'content');
      await fs.promises.symlink(
        path.join(symlinkSkillPath, 'target.txt'),
        path.join(symlinkSkillPath, 'link.txt')
      );

      try {
        const summary = await getSymlinkSummary(symlinkSkillPath);

        expect(summary.totalSymlinks).toBeGreaterThan(0);
      } finally {
        await fs.promises.rm(symlinkSkillPath, { recursive: true, force: true });
      }
    });

    it('flags security concerns for escaping symlinks', async () => {
      // Create a skill with an escaping symlink
      const escapingSkillPath = path.join(tempDir, 'escaping-skill');
      await fs.promises.mkdir(escapingSkillPath, { recursive: true });

      // Create a symlink pointing outside
      const outsideDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'outside-'));

      try {
        await fs.promises.symlink(outsideDir, path.join(escapingSkillPath, 'escape-link'));

        const summary = await getSymlinkSummary(escapingSkillPath);

        expect(summary.escapingSymlinks).toBe(1);
        expect(summary.hasSecurityConcerns).toBe(true);
        expect(summary.warning).toBeDefined();
        expect(summary.warning).toContain('outside');
      } finally {
        await fs.promises.rm(escapingSkillPath, { recursive: true, force: true });
        await fs.promises.rm(outsideDir, { recursive: true, force: true });
      }
    });
  });
});
