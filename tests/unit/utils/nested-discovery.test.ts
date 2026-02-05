/**
 * Tests for nested skill directory discovery utilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import {
  findNestedSkillDirectories,
  collectNestedSkillDirectories,
} from '../../../src/utils/nested-discovery';

describe('Nested Discovery Utilities', () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-nested-discovery-test-'));
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a directory structure
   */
  async function createDir(...parts: string[]): Promise<string> {
    const dirPath = path.join(tempDir, ...parts);
    await fs.mkdir(dirPath, { recursive: true });
    return dirPath;
  }

  /**
   * Helper to create a .claude/skills directory
   */
  async function createSkillsDir(...parts: string[]): Promise<string> {
    return createDir(...parts, '.claude', 'skills');
  }

  describe('findNestedSkillDirectories', () => {
    describe('basic discovery', () => {
      it('finds skills directory at root level', async () => {
        const testRoot = await createDir('basic-root');
        await createSkillsDir('basic-root');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
        expect(result.directories[0]).toBe(path.join(testRoot, '.claude', 'skills'));
      });

      it('finds skills directories in subdirectories', async () => {
        const testRoot = await createDir('subdir-root');
        await createSkillsDir('subdir-root');
        await createSkillsDir('subdir-root', 'packages', 'api');
        await createSkillsDir('subdir-root', 'packages', 'web');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(3);
        expect(result.directories).toContain(path.join(testRoot, '.claude', 'skills'));
        expect(result.directories).toContain(
          path.join(testRoot, 'packages', 'api', '.claude', 'skills')
        );
        expect(result.directories).toContain(
          path.join(testRoot, 'packages', 'web', '.claude', 'skills')
        );
      });

      it('returns empty array when no skills directories found', async () => {
        const testRoot = await createDir('empty-root');
        await createDir('empty-root', 'some', 'dirs');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(0);
      });

      it('handles root directory that does not exist', async () => {
        const nonExistent = path.join(tempDir, 'does-not-exist');

        const result = await collectNestedSkillDirectories(nonExistent, 3);

        expect(result.directories).toHaveLength(0);
      });
    });

    describe('depth limiting', () => {
      it('depth 0 only finds root level skills', async () => {
        const testRoot = await createDir('depth-0-root');
        await createSkillsDir('depth-0-root');
        await createSkillsDir('depth-0-root', 'level1');
        await createSkillsDir('depth-0-root', 'level1', 'level2');

        const result = await collectNestedSkillDirectories(testRoot, 0);

        expect(result.directories).toHaveLength(1);
        expect(result.directories[0]).toBe(path.join(testRoot, '.claude', 'skills'));
      });

      it('depth 1 finds root and immediate subdirectories', async () => {
        const testRoot = await createDir('depth-1-root');
        await createSkillsDir('depth-1-root');
        await createSkillsDir('depth-1-root', 'level1');
        await createSkillsDir('depth-1-root', 'level1', 'level2');

        const result = await collectNestedSkillDirectories(testRoot, 1);

        expect(result.directories).toHaveLength(2);
        expect(result.directories).toContain(path.join(testRoot, '.claude', 'skills'));
        expect(result.directories).toContain(path.join(testRoot, 'level1', '.claude', 'skills'));
      });

      it('depth 2 finds up to two levels deep', async () => {
        const testRoot = await createDir('depth-2-root');
        await createSkillsDir('depth-2-root');
        await createSkillsDir('depth-2-root', 'level1');
        await createSkillsDir('depth-2-root', 'level1', 'level2');
        await createSkillsDir('depth-2-root', 'level1', 'level2', 'level3');

        const result = await collectNestedSkillDirectories(testRoot, 2);

        expect(result.directories).toHaveLength(3);
        expect(result.directories).toContain(path.join(testRoot, '.claude', 'skills'));
        expect(result.directories).toContain(path.join(testRoot, 'level1', '.claude', 'skills'));
        expect(result.directories).toContain(
          path.join(testRoot, 'level1', 'level2', '.claude', 'skills')
        );
      });

      it('depth 3 finds up to three levels deep', async () => {
        const testRoot = await createDir('depth-3-root');
        await createSkillsDir('depth-3-root');
        await createSkillsDir('depth-3-root', 'level1');
        await createSkillsDir('depth-3-root', 'level1', 'level2');
        await createSkillsDir('depth-3-root', 'level1', 'level2', 'level3');
        await createSkillsDir('depth-3-root', 'level1', 'level2', 'level3', 'level4');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(4);
        expect(result.directories).not.toContain(
          path.join(testRoot, 'level1', 'level2', 'level3', 'level4', '.claude', 'skills')
        );
      });

      it('negative depth returns empty array', async () => {
        const testRoot = await createDir('negative-depth-root');
        await createSkillsDir('negative-depth-root');

        const result = await collectNestedSkillDirectories(testRoot, -1);

        expect(result.directories).toHaveLength(0);
      });
    });

    describe('hidden directory skipping', () => {
      it('skips hidden directories except .claude', async () => {
        const testRoot = await createDir('hidden-root');
        await createSkillsDir('hidden-root');
        await createDir('hidden-root', '.hidden', '.claude', 'skills');
        await createDir('hidden-root', '.another-hidden', '.claude', 'skills');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
        expect(result.directories[0]).toBe(path.join(testRoot, '.claude', 'skills'));
      });

      it('finds .claude/skills inside .claude directory', async () => {
        const testRoot = await createDir('claude-inside-root');
        await createSkillsDir('claude-inside-root');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
        // The .claude directory itself should be traversed to find skills
        expect(result.directories[0]).toBe(path.join(testRoot, '.claude', 'skills'));
      });
    });

    describe('hardcoded skip patterns', () => {
      it('skips node_modules directories', async () => {
        const testRoot = await createDir('node-modules-root');
        await createSkillsDir('node-modules-root');
        await createDir('node-modules-root', 'node_modules', 'some-pkg', '.claude', 'skills');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
        expect(result.directories[0]).toBe(path.join(testRoot, '.claude', 'skills'));
      });

      it('skips dist directories', async () => {
        const testRoot = await createDir('dist-root');
        await createSkillsDir('dist-root');
        await createDir('dist-root', 'dist', '.claude', 'skills');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
      });

      it('skips build directories', async () => {
        const testRoot = await createDir('build-root');
        await createSkillsDir('build-root');
        await createDir('build-root', 'build', '.claude', 'skills');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
      });

      it('skips .git directories', async () => {
        const testRoot = await createDir('git-root');
        await createSkillsDir('git-root');
        await createDir('git-root', '.git', 'hooks', '.claude', 'skills');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
      });

      it('skips vendor directories', async () => {
        const testRoot = await createDir('vendor-root');
        await createSkillsDir('vendor-root');
        await createDir('vendor-root', 'vendor', 'some-lib', '.claude', 'skills');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
      });

      it('skips coverage directories', async () => {
        const testRoot = await createDir('coverage-root');
        await createSkillsDir('coverage-root');
        await createDir('coverage-root', 'coverage', '.claude', 'skills');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
      });

      it('skips __pycache__ directories', async () => {
        const testRoot = await createDir('pycache-root');
        await createSkillsDir('pycache-root');
        await createDir('pycache-root', '__pycache__', '.claude', 'skills');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
      });

      it('skips all hardcoded patterns in same tree', async () => {
        const testRoot = await createDir('all-skip-root');
        await createSkillsDir('all-skip-root');
        await createDir('all-skip-root', 'node_modules', '.claude', 'skills');
        await createDir('all-skip-root', 'dist', '.claude', 'skills');
        await createDir('all-skip-root', 'build', '.claude', 'skills');
        await createDir('all-skip-root', '.git', '.claude', 'skills');
        await createDir('all-skip-root', 'vendor', '.claude', 'skills');
        await createDir('all-skip-root', 'coverage', '.claude', 'skills');
        await createDir('all-skip-root', '__pycache__', '.claude', 'skills');

        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
        expect(result.directories[0]).toBe(path.join(testRoot, '.claude', 'skills'));
      });
    });

    describe('symlink loop detection', () => {
      it('handles symlink loops without infinite recursion', async () => {
        const testRoot = await createDir('symlink-loop-root');
        await createSkillsDir('symlink-loop-root');
        const subdir = await createDir('symlink-loop-root', 'subdir');

        // Create symlink pointing back to parent
        const symlinkPath = path.join(subdir, 'loop');
        try {
          await fs.symlink(testRoot, symlinkPath, 'dir');
        } catch {
          // Skip test if symlinks not supported (e.g., Windows without privileges)
          return;
        }

        // Should complete without hanging
        const result = await collectNestedSkillDirectories(testRoot, 10);

        // Should find the root skills dir without getting stuck in loop
        expect(result.directories).toContain(path.join(testRoot, '.claude', 'skills'));
      });

      it('handles symlink to sibling directory', async () => {
        const testRoot = await createDir('symlink-sibling-root');
        await createSkillsDir('symlink-sibling-root', 'real-dir');
        const siblingA = await createDir('symlink-sibling-root', 'sibling-a');

        // Create symlink from sibling-a to real-dir
        const symlinkPath = path.join(siblingA, 'link-to-real');
        try {
          await fs.symlink(path.join(testRoot, 'real-dir'), symlinkPath, 'dir');
        } catch {
          // Skip test if symlinks not supported
          return;
        }

        const result = await collectNestedSkillDirectories(testRoot, 3);

        // Should only find the skills dir once, not twice via symlink
        const skillsDir = path.join(testRoot, 'real-dir', '.claude', 'skills');
        expect(result.directories.filter((r) => r === skillsDir)).toHaveLength(1);
      });

      it('handles broken symlinks gracefully', async () => {
        const testRoot = await createDir('broken-symlink-root');
        await createSkillsDir('broken-symlink-root');
        const subdir = await createDir('broken-symlink-root', 'subdir');

        // Create symlink to non-existent target
        const symlinkPath = path.join(subdir, 'broken');
        try {
          await fs.symlink(path.join(testRoot, 'does-not-exist'), symlinkPath, 'dir');
        } catch {
          // Skip test if symlinks not supported
          return;
        }

        // Should complete without error
        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(1);
        expect(result.directories[0]).toBe(path.join(testRoot, '.claude', 'skills'));
      });
    });

    describe('permission denied handling', () => {
      it('continues scanning when encountering inaccessible directories', async () => {
        // This test is platform-specific and may need adjustment
        const testRoot = await createDir('permission-root');
        await createSkillsDir('permission-root');
        await createSkillsDir('permission-root', 'accessible');
        const restrictedDir = await createDir('permission-root', 'restricted');

        // Try to make directory inaccessible
        try {
          await fs.chmod(restrictedDir, 0o000);
        } catch {
          // Skip test if chmod not supported
          return;
        }

        try {
          const result = await collectNestedSkillDirectories(testRoot, 3);

          // Should find skills in accessible directories
          expect(result.directories).toContain(path.join(testRoot, '.claude', 'skills'));
          expect(result.directories).toContain(
            path.join(testRoot, 'accessible', '.claude', 'skills')
          );
        } finally {
          // Restore permissions for cleanup
          await fs.chmod(restrictedDir, 0o755);
        }
      });
    });

    describe('async generator behavior', () => {
      it('yields results incrementally', async () => {
        const testRoot = await createDir('async-gen-root');
        await createSkillsDir('async-gen-root');
        await createSkillsDir('async-gen-root', 'pkg1');
        await createSkillsDir('async-gen-root', 'pkg2');

        const yielded: string[] = [];
        for await (const dir of findNestedSkillDirectories(testRoot, 3)) {
          yielded.push(dir);
        }

        expect(yielded).toHaveLength(3);
      });

      it('can be stopped early', async () => {
        const testRoot = await createDir('stop-early-root');
        await createSkillsDir('stop-early-root');
        await createSkillsDir('stop-early-root', 'pkg1');
        await createSkillsDir('stop-early-root', 'pkg2');

        const yielded: string[] = [];
        for await (const dir of findNestedSkillDirectories(testRoot, 3)) {
          yielded.push(dir);
          if (yielded.length >= 2) {
            break;
          }
        }

        expect(yielded).toHaveLength(2);
      });
    });

    describe('gitignore integration', () => {
      it('accepts ignore option', async () => {
        // We use a mock Ignore object to test the integration
        const testRoot = await createDir('gitignore-root');
        await createSkillsDir('gitignore-root');
        await createSkillsDir('gitignore-root', 'ignored-pkg');
        await createSkillsDir('gitignore-root', 'included-pkg');

        // Create a mock Ignore instance
        const mockIgnore = {
          ignores: (relativePath: string) => relativePath.startsWith('ignored-pkg'),
        };

        const result = await collectNestedSkillDirectories(testRoot, 3, {
          ignore: mockIgnore as import('ignore').Ignore,
        });

        expect(result.directories).toHaveLength(2);
        expect(result.directories).toContain(path.join(testRoot, '.claude', 'skills'));
        expect(result.directories).toContain(
          path.join(testRoot, 'included-pkg', '.claude', 'skills')
        );
        expect(result.directories).not.toContain(
          path.join(testRoot, 'ignored-pkg', '.claude', 'skills')
        );
      });

      it('skips directories matching gitignore patterns', async () => {
        const testRoot = await createDir('gitignore-patterns-root');
        await createSkillsDir('gitignore-patterns-root');
        await createSkillsDir('gitignore-patterns-root', 'packages', 'api');
        await createSkillsDir('gitignore-patterns-root', 'packages', 'web');
        // These should be ignored
        await createDir('gitignore-patterns-root', 'temp-build', '.claude', 'skills');
        await createDir('gitignore-patterns-root', 'output', '.claude', 'skills');

        const mockIgnore = {
          ignores: (relativePath: string) =>
            relativePath.startsWith('temp-build') || relativePath.startsWith('output'),
        };

        const result = await collectNestedSkillDirectories(testRoot, 3, {
          ignore: mockIgnore as import('ignore').Ignore,
        });

        expect(result.directories).toHaveLength(3);
        expect(result.directories).toContain(path.join(testRoot, '.claude', 'skills'));
        expect(result.directories).toContain(
          path.join(testRoot, 'packages', 'api', '.claude', 'skills')
        );
        expect(result.directories).toContain(
          path.join(testRoot, 'packages', 'web', '.claude', 'skills')
        );
      });

      it('skips nested directories inside gitignored parent', async () => {
        const testRoot = await createDir('gitignore-nested-root');
        await createSkillsDir('gitignore-nested-root');
        // Create skills inside ignored directory structure
        await createDir('gitignore-nested-root', 'ignored', 'deep', 'nested', '.claude', 'skills');

        const mockIgnore = {
          ignores: (relativePath: string) => relativePath.startsWith('ignored'),
        };

        const result = await collectNestedSkillDirectories(testRoot, 5, {
          ignore: mockIgnore as import('ignore').Ignore,
        });

        expect(result.directories).toHaveLength(1);
        expect(result.directories).toContain(path.join(testRoot, '.claude', 'skills'));
      });

      it('works without ignore option (all directories scanned)', async () => {
        const testRoot = await createDir('no-ignore-root');
        await createSkillsDir('no-ignore-root');
        await createSkillsDir('no-ignore-root', 'pkg1');
        await createSkillsDir('no-ignore-root', 'pkg2');

        // No ignore option provided
        const result = await collectNestedSkillDirectories(testRoot, 3);

        expect(result.directories).toHaveLength(3);
      });

      it('handles glob-style patterns via ignore instance', async () => {
        const testRoot = await createDir('gitignore-glob-root');
        await createSkillsDir('gitignore-glob-root');
        await createSkillsDir('gitignore-glob-root', 'src', 'main');
        await createDir('gitignore-glob-root', 'test-output', '.claude', 'skills');
        await createDir('gitignore-glob-root', 'test-fixtures', '.claude', 'skills');

        // Simulate a pattern like "test-*/"
        const mockIgnore = {
          ignores: (relativePath: string) => relativePath.match(/^test-[^/]+\//) !== null,
        };

        const result = await collectNestedSkillDirectories(testRoot, 3, {
          ignore: mockIgnore as import('ignore').Ignore,
        });

        expect(result.directories).toHaveLength(2);
        expect(result.directories).toContain(path.join(testRoot, '.claude', 'skills'));
        expect(result.directories).toContain(
          path.join(testRoot, 'src', 'main', '.claude', 'skills')
        );
      });
    });
  });

  describe('collectNestedSkillDirectories', () => {
    it('returns result object with directories array', async () => {
      const testRoot = await createDir('collect-root');
      await createSkillsDir('collect-root');
      await createSkillsDir('collect-root', 'pkg1');

      const result = await collectNestedSkillDirectories(testRoot, 3);

      expect(result).toHaveProperty('directories');
      expect(result).toHaveProperty('depthLimitReached');
      expect(Array.isArray(result.directories)).toBe(true);
      expect(result.directories).toHaveLength(2);
    });

    it('returns empty directories array for no matches', async () => {
      const testRoot = await createDir('collect-empty-root');

      const result = await collectNestedSkillDirectories(testRoot, 3);

      expect(Array.isArray(result.directories)).toBe(true);
      expect(result.directories).toHaveLength(0);
    });
  });

  describe('depthLimitReached tracking', () => {
    it('returns false when all directories are fully scanned', async () => {
      const testRoot = await createDir('full-scan-root');
      await createSkillsDir('full-scan-root');
      await createSkillsDir('full-scan-root', 'pkg1');

      // Depth 3 should be enough to scan everything
      const result = await collectNestedSkillDirectories(testRoot, 3);

      expect(result.depthLimitReached).toBe(false);
    });

    it('returns true when depth limit prevents scanning subdirectories', async () => {
      const testRoot = await createDir('depth-limit-root');
      await createSkillsDir('depth-limit-root');
      // Create a subdirectory structure that would be explored at depth 1
      await createDir('depth-limit-root', 'level1', 'level2');

      // Depth 0 should trigger depthLimitReached since level1 exists
      const result = await collectNestedSkillDirectories(testRoot, 0);

      expect(result.depthLimitReached).toBe(true);
    });

    it('returns false when no subdirectories exist at depth limit', async () => {
      const testRoot = await createDir('no-subdirs-root');
      await createSkillsDir('no-subdirs-root');
      // No subdirectories at root level

      const result = await collectNestedSkillDirectories(testRoot, 0);

      expect(result.depthLimitReached).toBe(false);
    });

    it('returns true when nested directories exist beyond depth limit', async () => {
      const testRoot = await createDir('nested-beyond-root');
      await createSkillsDir('nested-beyond-root');
      await createSkillsDir('nested-beyond-root', 'level1');
      await createSkillsDir('nested-beyond-root', 'level1', 'level2');
      await createSkillsDir('nested-beyond-root', 'level1', 'level2', 'level3');

      // Depth 2 should find up to level2, but level3 should trigger warning
      const result = await collectNestedSkillDirectories(testRoot, 2);

      expect(result.directories).toHaveLength(3); // root, level1, level2
      expect(result.depthLimitReached).toBe(true); // level3 exists but not scanned
    });

    it('returns false when all nested directories are within depth limit', async () => {
      const testRoot = await createDir('within-limit-root');
      await createSkillsDir('within-limit-root');
      await createSkillsDir('within-limit-root', 'level1');
      await createSkillsDir('within-limit-root', 'level1', 'level2');

      // Depth 3 should be enough to scan everything
      const result = await collectNestedSkillDirectories(testRoot, 3);

      expect(result.directories).toHaveLength(3);
      expect(result.depthLimitReached).toBe(false);
    });

    it('ignores hidden directories when determining depthLimitReached', async () => {
      const testRoot = await createDir('hidden-depth-root');
      await createSkillsDir('hidden-depth-root');
      // Create hidden subdirectories that should be skipped
      await createDir('hidden-depth-root', '.hidden1', 'nested');
      await createDir('hidden-depth-root', '.hidden2', 'deep');

      // Depth 0 with only hidden subdirs should not trigger depthLimitReached
      const result = await collectNestedSkillDirectories(testRoot, 0);

      expect(result.depthLimitReached).toBe(false);
    });

    it('ignores hardcoded skip directories when determining depthLimitReached', async () => {
      const testRoot = await createDir('skip-depth-root');
      await createSkillsDir('skip-depth-root');
      // Create directories that should be skipped
      await createDir('skip-depth-root', 'node_modules', 'nested');
      await createDir('skip-depth-root', 'dist', 'output');
      await createDir('skip-depth-root', 'build', 'artifacts');

      // Depth 0 with only skipped subdirs should not trigger depthLimitReached
      const result = await collectNestedSkillDirectories(testRoot, 0);

      expect(result.depthLimitReached).toBe(false);
    });

    it('returns true when both valid and skipped directories exist at depth limit', async () => {
      const testRoot = await createDir('mixed-depth-root');
      await createSkillsDir('mixed-depth-root');
      // Create a valid subdirectory
      await createDir('mixed-depth-root', 'valid-subdir', 'nested');
      // Create skipped directories
      await createDir('mixed-depth-root', 'node_modules', 'nested');

      // Depth 0 should trigger depthLimitReached due to valid-subdir
      const result = await collectNestedSkillDirectories(testRoot, 0);

      expect(result.depthLimitReached).toBe(true);
    });
  });
});
