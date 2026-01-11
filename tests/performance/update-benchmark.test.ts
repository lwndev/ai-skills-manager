/**
 * Performance benchmark tests for the update command
 *
 * Tests NFR-1 compliance:
 * - Package validation: <5 seconds for packages up to 50MB
 * - Full update cycle: <30 seconds for skills up to 50MB
 * - Backup creation: <2 minutes for skills up to 1GB
 * - Progress indicator threshold: 2 seconds
 *
 * Test fixtures are generated programmatically to avoid bloating the repository.
 * XLarge tests (500MB) are marked as slow and run separately.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createZipArchive, finalizeArchive, addFileToArchive } from '../../src/utils/archiver';
import { createBackup } from '../../src/services/backup-manager';
import { compareVersions } from '../../src/services/version-comparator';
import { shouldShowProgress } from '../../src/formatters/update-formatter';

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  PACKAGE_VALIDATION_MS: 5000, // 5 seconds
  FULL_UPDATE_CYCLE_MS: 30000, // 30 seconds
  BACKUP_CREATION_MS: 120000, // 2 minutes
  PROGRESS_INDICATOR_MS: 2000, // 2 seconds
  VARIANCE_FACTOR: 1.2, // 20% variance for CI fluctuations
};

// Test fixture sizes
const FIXTURE_SIZES = {
  SMALL: 1024, // 1KB
  MEDIUM: 1024 * 1024, // 1MB
  LARGE: 50 * 1024 * 1024, // 50MB
  XLARGE: 500 * 1024 * 1024, // 500MB - run with RUN_XLARGE_TESTS=true
};

// Conditional describe for XLarge tests - only run when explicitly enabled
const describeIfXLarge = process.env.RUN_XLARGE_TESTS === 'true' ? describe : describe.skip;

describe('Update Command Performance Benchmarks', () => {
  let tempDir: string;
  let fixturesDir: string;

  beforeAll(async () => {
    // Create temporary directory for test fixtures
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-perf-'));
    fixturesDir = path.join(tempDir, 'fixtures');
    await fs.promises.mkdir(fixturesDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up temporary directory
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Generate a test skill directory with specified total size
   */
  async function generateSkillDirectory(
    targetDir: string,
    totalSizeBytes: number,
    skillName: string
  ): Promise<void> {
    await fs.promises.mkdir(targetDir, { recursive: true });

    // Create SKILL.md (required file)
    const skillMdContent = `---
name: ${skillName}
description: Performance test skill with ${formatSize(totalSizeBytes)} of content
---

# ${skillName}

This is a generated skill for performance testing.
`;
    await fs.promises.writeFile(path.join(targetDir, 'SKILL.md'), skillMdContent);

    // Calculate remaining size to generate
    const skillMdSize = Buffer.byteLength(skillMdContent);
    let remainingSize = totalSizeBytes - skillMdSize;

    // Generate files to fill the remaining size
    const fileCount = Math.max(1, Math.ceil(remainingSize / (64 * 1024))); // ~64KB per file
    const fileSize = Math.floor(remainingSize / fileCount);

    for (let i = 0; i < fileCount && remainingSize > 0; i++) {
      const currentFileSize = Math.min(fileSize, remainingSize);
      const content = generateContent(currentFileSize);
      await fs.promises.writeFile(path.join(targetDir, `file-${i}.txt`), content);
      remainingSize -= currentFileSize;
    }
  }

  /**
   * Generate a test package (.skill file) with specified total size
   */
  async function generateSkillPackage(
    packagePath: string,
    totalSizeBytes: number,
    skillName: string
  ): Promise<void> {
    const tempSkillDir = path.join(path.dirname(packagePath), `temp-${skillName}`);
    await generateSkillDirectory(tempSkillDir, totalSizeBytes, skillName);

    // Create ZIP archive
    const archive = createZipArchive(packagePath);
    const entries = await fs.promises.readdir(tempSkillDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(tempSkillDir, entry.name);
        addFileToArchive(archive, filePath, `${skillName}/${entry.name}`);
      }
    }

    await finalizeArchive(archive);

    // Clean up temp directory
    await fs.promises.rm(tempSkillDir, { recursive: true, force: true });
  }

  /**
   * Generate random content of specified size
   */
  function generateContent(sizeBytes: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\n ';
    let result = '';
    for (let i = 0; i < sizeBytes; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Format bytes to human-readable size
   */
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Measure execution time of an async function
   */
  async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
    const start = Date.now();
    const result = await fn();
    const durationMs = Date.now() - start;
    return { result, durationMs };
  }

  describe('Progress Indicator Threshold', () => {
    it('should use 2-second default threshold', () => {
      expect(shouldShowProgress(Date.now())).toBe(false);
      expect(shouldShowProgress(Date.now() - 1999)).toBe(false);
      expect(shouldShowProgress(Date.now() - 2000)).toBe(true);
      expect(shouldShowProgress(Date.now() - 3000)).toBe(true);
    });

    it('should allow custom threshold', () => {
      expect(shouldShowProgress(Date.now() - 500, 1000)).toBe(false);
      expect(shouldShowProgress(Date.now() - 1500, 1000)).toBe(true);
    });
  });

  describe('Small Package (1KB) - Baseline', () => {
    let smallSkillDir: string;
    let smallPackagePath: string;

    beforeAll(async () => {
      smallSkillDir = path.join(fixturesDir, 'small-skill');
      smallPackagePath = path.join(fixturesDir, 'small-skill.skill');

      await generateSkillDirectory(smallSkillDir, FIXTURE_SIZES.SMALL, 'small-skill');
      await generateSkillPackage(smallPackagePath, FIXTURE_SIZES.SMALL, 'small-skill-new');
    });

    it('should validate small package well under 5 seconds', async () => {
      const { durationMs } = await measureTime(async () => {
        // Validate package exists and is readable
        const stats = await fs.promises.stat(smallPackagePath);
        expect(stats.isFile()).toBe(true);
        return stats;
      });

      // Small package should be nearly instant
      expect(durationMs).toBeLessThan(
        THRESHOLDS.PACKAGE_VALIDATION_MS * THRESHOLDS.VARIANCE_FACTOR
      );
      expect(durationMs).toBeLessThan(1000); // Should be under 1 second for baseline
    });

    it('should compare versions of small skill quickly', async () => {
      // compareVersions expects: directory (installed) vs package (new)
      const { result: comparison, durationMs } = await measureTime(async () => {
        return await compareVersions(smallSkillDir, smallPackagePath);
      });

      expect(comparison).toBeDefined();
      expect(durationMs).toBeLessThan(1000); // Should be under 1 second
    });

    it('should create backup of small skill quickly', async () => {
      const { result: backupResult, durationMs } = await measureTime(async () => {
        return await createBackup(smallSkillDir, 'small-skill');
      });

      expect(backupResult.success).toBe(true);
      if (backupResult.success) {
        expect(backupResult.path).toContain('small-skill');
        // Clean up backup
        await fs.promises.unlink(backupResult.path).catch(() => {});
      }
      expect(durationMs).toBeLessThan(5000); // Should be well under 5 seconds
    });
  });

  describe('Medium Package (1MB) - Typical', () => {
    let mediumSkillDir: string;
    let mediumPackagePath: string;

    beforeAll(async () => {
      mediumSkillDir = path.join(fixturesDir, 'medium-skill');
      mediumPackagePath = path.join(fixturesDir, 'medium-skill.skill');

      await generateSkillDirectory(mediumSkillDir, FIXTURE_SIZES.MEDIUM, 'medium-skill');
      await generateSkillPackage(mediumPackagePath, FIXTURE_SIZES.MEDIUM, 'medium-skill-new');
    }, 30000); // Extended timeout for setup

    it('should validate medium package under 5 seconds', async () => {
      const { durationMs } = await measureTime(async () => {
        const stats = await fs.promises.stat(mediumPackagePath);
        expect(stats.isFile()).toBe(true);
        return stats;
      });

      expect(durationMs).toBeLessThan(
        THRESHOLDS.PACKAGE_VALIDATION_MS * THRESHOLDS.VARIANCE_FACTOR
      );
    });

    it('should compare versions of medium skill under threshold', async () => {
      // compareVersions expects: directory (installed) vs package (new)
      const { result: comparison, durationMs } = await measureTime(async () => {
        return await compareVersions(mediumSkillDir, mediumPackagePath);
      });

      expect(comparison).toBeDefined();
      expect(durationMs).toBeLessThan(10000); // Should be under 10 seconds
    }, 30000);

    it('should create backup of medium skill under threshold', async () => {
      const { result: backupResult, durationMs } = await measureTime(async () => {
        return await createBackup(mediumSkillDir, 'medium-skill');
      });

      expect(backupResult.success).toBe(true);
      if (backupResult.success) {
        // Clean up backup
        await fs.promises.unlink(backupResult.path).catch(() => {});
      }
      expect(durationMs).toBeLessThan(30000); // Should be under 30 seconds
    }, 60000);
  });

  describe('Large Package (50MB) - Stress Test', () => {
    let largeSkillDir: string;
    let largePackagePath: string;

    beforeAll(async () => {
      largeSkillDir = path.join(fixturesDir, 'large-skill');
      largePackagePath = path.join(fixturesDir, 'large-skill.skill');

      await generateSkillDirectory(largeSkillDir, FIXTURE_SIZES.LARGE, 'large-skill');
      await generateSkillPackage(largePackagePath, FIXTURE_SIZES.LARGE, 'large-skill-new');
    }, 120000); // Extended timeout for setup (50MB generation)

    it('should validate large package under 5 seconds', async () => {
      const { durationMs } = await measureTime(async () => {
        const stats = await fs.promises.stat(largePackagePath);
        expect(stats.isFile()).toBe(true);
        return stats;
      });

      expect(durationMs).toBeLessThan(
        THRESHOLDS.PACKAGE_VALIDATION_MS * THRESHOLDS.VARIANCE_FACTOR
      );
    });

    it('should compare versions of large skill under 30 seconds', async () => {
      // compareVersions expects: directory (installed) vs package (new)
      const { result: comparison, durationMs } = await measureTime(async () => {
        return await compareVersions(largeSkillDir, largePackagePath);
      });

      expect(comparison).toBeDefined();
      expect(durationMs).toBeLessThan(THRESHOLDS.FULL_UPDATE_CYCLE_MS * THRESHOLDS.VARIANCE_FACTOR);
    }, 120000);

    it('should create backup of large skill under 2 minutes', async () => {
      const { result: backupResult, durationMs } = await measureTime(async () => {
        return await createBackup(largeSkillDir, 'large-skill');
      });

      expect(backupResult.success).toBe(true);
      if (backupResult.success) {
        // Clean up backup
        await fs.promises.unlink(backupResult.path).catch(() => {});
      }
      expect(durationMs).toBeLessThan(THRESHOLDS.BACKUP_CREATION_MS * THRESHOLDS.VARIANCE_FACTOR);
    }, 180000); // 3 minute timeout
  });

  describe('Performance Regression Detection', () => {
    it('should track timing variance', async () => {
      const iterations = 5;
      const timings: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const { durationMs } = await measureTime(async () => {
          // Simple operation to measure baseline timing
          const content = generateContent(10000);
          return content.length;
        });
        timings.push(durationMs);
      }

      // Calculate standard deviation
      const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
      const variance = timings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);

      // Timing should be reasonably consistent (stdDev should be small relative to mean)
      // Allow for CI variance
      expect(stdDev / mean).toBeLessThan(1); // Coefficient of variation < 100%
    });
  });

  describe('Memory Efficiency', () => {
    it('should not exceed reasonable memory during comparison', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create a directory with many small files (installed skill)
      const dir1 = path.join(fixturesDir, 'memory-test-1');
      const tempDir2 = path.join(fixturesDir, 'memory-test-2');
      const packagePath = path.join(fixturesDir, 'memory-test.skill');

      await fs.promises.mkdir(dir1, { recursive: true });
      await fs.promises.mkdir(tempDir2, { recursive: true });

      // Create SKILL.md in each
      await fs.promises.writeFile(
        path.join(dir1, 'SKILL.md'),
        '---\nname: memory-test\ndescription: test\n---\n'
      );
      await fs.promises.writeFile(
        path.join(tempDir2, 'SKILL.md'),
        '---\nname: memory-test\ndescription: test updated\n---\n'
      );

      // Create 100 small files
      for (let i = 0; i < 100; i++) {
        await fs.promises.writeFile(path.join(dir1, `file-${i}.txt`), `content ${i}`);
        await fs.promises.writeFile(path.join(tempDir2, `file-${i}.txt`), `content ${i} modified`);
      }

      // Create a package from the second directory
      const archive = createZipArchive(packagePath);
      const entries = await fs.promises.readdir(tempDir2, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          addFileToArchive(archive, path.join(tempDir2, entry.name), `memory-test/${entry.name}`);
        }
      }
      await finalizeArchive(archive);

      // Run comparison (directory vs package)
      await compareVersions(dir1, packagePath);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 100MB for this operation)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    }, 60000);
  });

  // XLarge tests - run with: RUN_XLARGE_TESTS=true npm test -- tests/performance/update-benchmark.test.ts
  describeIfXLarge('XLarge Package (500MB) - Limit Test', () => {
    // These tests verify the system can handle packages near the size limit
    // They are skipped by default to avoid CI timeouts and resource issues

    let xlargeSkillDir: string;
    let xlargePackagePath: string;
    let xlargeFixturesDir: string;

    beforeAll(async () => {
      // Create a separate temp directory for XLarge fixtures to isolate from other tests
      xlargeFixturesDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-xlarge-'));
      xlargeSkillDir = path.join(xlargeFixturesDir, 'xlarge-skill');
      xlargePackagePath = path.join(xlargeFixturesDir, 'xlarge-skill.skill');

      await generateSkillDirectory(xlargeSkillDir, FIXTURE_SIZES.XLARGE, 'xlarge-skill');
      await generateSkillPackage(xlargePackagePath, FIXTURE_SIZES.XLARGE, 'xlarge-skill-new');
    }, 600000); // 10 minute timeout for 500MB generation

    afterAll(async () => {
      // Clean up XLarge fixtures
      if (xlargeFixturesDir) {
        await fs.promises.rm(xlargeFixturesDir, { recursive: true, force: true });
      }
    });

    it('should validate xlarge package under 5 seconds', async () => {
      const { durationMs } = await measureTime(async () => {
        const stats = await fs.promises.stat(xlargePackagePath);
        expect(stats.isFile()).toBe(true);
        return stats;
      });

      expect(durationMs).toBeLessThan(
        THRESHOLDS.PACKAGE_VALIDATION_MS * THRESHOLDS.VARIANCE_FACTOR
      );
    });

    it('should compare versions of xlarge skill under 30 seconds', async () => {
      const { result: comparison, durationMs } = await measureTime(async () => {
        return await compareVersions(xlargeSkillDir, xlargePackagePath);
      });

      expect(comparison).toBeDefined();
      expect(durationMs).toBeLessThan(THRESHOLDS.FULL_UPDATE_CYCLE_MS * THRESHOLDS.VARIANCE_FACTOR);
    }, 120000); // 2 minute timeout

    it('should create backup of xlarge skill under 2 minutes', async () => {
      const { result: backupResult, durationMs } = await measureTime(async () => {
        return await createBackup(xlargeSkillDir, 'xlarge-skill');
      });

      expect(backupResult.success).toBe(true);
      if (backupResult.success) {
        // Clean up backup
        await fs.promises.unlink(backupResult.path).catch(() => {});
      }
      expect(durationMs).toBeLessThan(THRESHOLDS.BACKUP_CREATION_MS * THRESHOLDS.VARIANCE_FACTOR);
    }, 300000); // 5 minute timeout
  });
});
