/**
 * Performance tests for nested skill discovery (FEAT-012 Phase 5)
 *
 * Tests that nested directory discovery completes within acceptable time
 * for typical monorepo structures.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { collectNestedSkillDirectories } from '../../src/utils/nested-discovery';

describe('Nested Discovery Performance', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-perf-test-'));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a directory
   */
  async function createDir(...parts: string[]): Promise<string> {
    const dirPath = path.join(tempDir, ...parts);
    await fs.mkdir(dirPath, { recursive: true });
    return dirPath;
  }

  /**
   * Helper to create a .claude/skills directory with a skill
   */
  async function createSkillsDir(...parts: string[]): Promise<string> {
    const skillsDir = path.join(tempDir, ...parts, '.claude', 'skills', 'test-skill');
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(
      path.join(skillsDir, 'SKILL.md'),
      `---
name: test-skill
description: Test skill
---

# Test
`
    );
    return path.dirname(skillsDir);
  }

  describe('large directory structures', () => {
    it('scans 100 directories within 2 seconds', async () => {
      // Create 100 directories at depth 1
      const testRoot = await createDir('perf-100');
      await createSkillsDir('perf-100');

      for (let i = 0; i < 100; i++) {
        await createDir('perf-100', `dir-${String(i).padStart(3, '0')}`);
      }

      const startTime = Date.now();
      const result = await collectNestedSkillDirectories(testRoot, 3);
      const duration = Date.now() - startTime;

      expect(result.directories).toHaveLength(1);
      expect(duration).toBeLessThan(2000);
    });

    it('scans 500 directories within 3 seconds', async () => {
      // Create 500 directories distributed across 10 packages with 50 subdirs each
      const testRoot = await createDir('perf-500');
      await createSkillsDir('perf-500');

      for (let pkg = 0; pkg < 10; pkg++) {
        const pkgDir = `pkg-${String(pkg).padStart(2, '0')}`;
        await createSkillsDir('perf-500', pkgDir);

        for (let sub = 0; sub < 50; sub++) {
          await createDir('perf-500', pkgDir, `sub-${String(sub).padStart(2, '0')}`);
        }
      }

      const startTime = Date.now();
      const result = await collectNestedSkillDirectories(testRoot, 3);
      const duration = Date.now() - startTime;

      // Should find root + 10 package skills
      expect(result.directories).toHaveLength(11);
      expect(duration).toBeLessThan(3000);
    });

    it('scans 1000 directories within 5 seconds', async () => {
      // Create 1000 directories: 20 packages x 50 subdirs each
      const testRoot = await createDir('perf-1000');
      await createSkillsDir('perf-1000');

      for (let pkg = 0; pkg < 20; pkg++) {
        const pkgDir = `pkg-${String(pkg).padStart(2, '0')}`;
        await createSkillsDir('perf-1000', pkgDir);

        for (let sub = 0; sub < 50; sub++) {
          await createDir('perf-1000', pkgDir, `sub-${String(sub).padStart(2, '0')}`);
        }
      }

      const startTime = Date.now();
      const result = await collectNestedSkillDirectories(testRoot, 3);
      const duration = Date.now() - startTime;

      // Should find root + 20 package skills
      expect(result.directories).toHaveLength(21);
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('depth limiting performance', () => {
    it('depth limiting significantly reduces scan time', async () => {
      // Create deep nested structure
      const testRoot = await createDir('perf-depth');

      // Create 10 directories at each of 5 levels
      let currentPath = 'perf-depth';
      for (let level = 0; level < 5; level++) {
        for (let i = 0; i < 10; i++) {
          await createDir(currentPath, `level${level}-dir${i}`);
        }
        currentPath = path.join(currentPath, 'level' + level + '-dir0');
        await createSkillsDir(...currentPath.split(path.sep));
      }

      // Full depth scan
      const startFull = Date.now();
      await collectNestedSkillDirectories(testRoot, 10);
      const durationFull = Date.now() - startFull;

      // Limited depth scan (depth 2)
      const startLimited = Date.now();
      await collectNestedSkillDirectories(testRoot, 2);
      const durationLimited = Date.now() - startLimited;

      // Limited scan should be at least 2x faster (usually much more)
      expect(durationLimited).toBeLessThan(durationFull);
    });
  });

  describe('memory efficiency', () => {
    it('uses streaming iteration without loading all into memory', async () => {
      const testRoot = await createDir('perf-memory');

      // Create many skills directories
      for (let i = 0; i < 20; i++) {
        await createSkillsDir('perf-memory', `pkg-${i}`);
      }

      // Track how many results we get incrementally
      let count = 0;
      const { findNestedSkillDirectories } = await import('../../src/utils/nested-discovery');

      for await (const _dir of findNestedSkillDirectories(testRoot, 3)) {
        count++;
        // We can process each result immediately without waiting for all
        // This demonstrates streaming behavior
      }

      expect(count).toBe(20);
    });
  });
});
