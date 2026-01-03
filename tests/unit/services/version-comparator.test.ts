/**
 * Tests for version comparator service (FEAT-008)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import {
  compareVersions,
  extractMetadata,
  extractPackageMetadata,
  detectDowngrade,
  getInstalledVersionInfo,
  getPackageVersionInfo,
  summarizeChanges,
  formatDiffLine,
  streamFileComparison,
} from '../../../src/services/version-comparator';
import type { SkillMetadata, FileChange, VersionComparison } from '../../../src/types/update';

describe('Version Comparator', () => {
  let tempDir: string;
  let installedSkillDir: string;
  let newPackagePath: string;

  beforeAll(async () => {
    // Create temporary directory structure for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-comparator-test-'));

    // Create installed skill directory
    installedSkillDir = path.join(tempDir, 'installed-skill');
    await fs.mkdir(installedSkillDir, { recursive: true });
    await fs.mkdir(path.join(installedSkillDir, 'src'), { recursive: true });

    // Create installed skill files
    await fs.writeFile(
      path.join(installedSkillDir, 'SKILL.md'),
      '---\nname: test-skill\ndescription: Original skill\nversion: 1.0.0\n---\n# Test Skill\n'
    );
    await fs.writeFile(path.join(installedSkillDir, 'src', 'index.ts'), 'export const v1 = true;');
    await fs.writeFile(path.join(installedSkillDir, 'README.md'), '# Original README');
    await fs.writeFile(path.join(installedSkillDir, 'old-file.txt'), 'This file will be removed');

    // Create new package as ZIP
    newPackagePath = path.join(tempDir, 'new-skill.skill');
    const zip = new AdmZip();
    zip.addFile(
      'test-skill/SKILL.md',
      Buffer.from(
        '---\nname: test-skill\ndescription: Updated skill\nversion: 2.0.0\n---\n# Updated Skill\n'
      )
    );
    zip.addFile('test-skill/src/index.ts', Buffer.from('export const v2 = true;'));
    zip.addFile('test-skill/README.md', Buffer.from('# Updated README with more content'));
    zip.addFile('test-skill/new-file.txt', Buffer.from('This is a new file'));
    zip.writeZip(newPackagePath);
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('compareVersions', () => {
    it('detects added files', async () => {
      const comparison = await compareVersions(installedSkillDir, newPackagePath);

      const addedFile = comparison.filesAdded.find((f) => f.path === 'new-file.txt');
      expect(addedFile).toBeDefined();
      expect(addedFile?.changeType).toBe('added');
      expect(addedFile?.sizeBefore).toBe(0);
      expect(addedFile?.sizeAfter).toBeGreaterThan(0);
    });

    it('detects removed files', async () => {
      const comparison = await compareVersions(installedSkillDir, newPackagePath);

      const removedFile = comparison.filesRemoved.find((f) => f.path === 'old-file.txt');
      expect(removedFile).toBeDefined();
      expect(removedFile?.changeType).toBe('removed');
      expect(removedFile?.sizeBefore).toBeGreaterThan(0);
      expect(removedFile?.sizeAfter).toBe(0);
    });

    it('detects modified files', async () => {
      const comparison = await compareVersions(installedSkillDir, newPackagePath);

      const modifiedFile = comparison.filesModified.find((f) => f.path === 'README.md');
      expect(modifiedFile).toBeDefined();
      expect(modifiedFile?.changeType).toBe('modified');
    });

    it('calculates correct counts', async () => {
      const comparison = await compareVersions(installedSkillDir, newPackagePath);

      expect(comparison.addedCount).toBe(comparison.filesAdded.length);
      expect(comparison.removedCount).toBe(comparison.filesRemoved.length);
      expect(comparison.modifiedCount).toBe(comparison.filesModified.length);
    });

    it('calculates size change', async () => {
      const comparison = await compareVersions(installedSkillDir, newPackagePath);

      // Size change should account for added, removed, and modified file sizes
      expect(typeof comparison.sizeChange).toBe('number');
    });

    it('handles thorough comparison mode', async () => {
      const comparison = await compareVersions(installedSkillDir, newPackagePath, {
        thorough: true,
      });

      // Should still work with hash comparison enabled
      expect(comparison.filesAdded.length).toBeGreaterThan(0);
      expect(comparison.filesRemoved.length).toBeGreaterThan(0);
    });

    it('handles empty skill directory', async () => {
      const emptyDir = path.join(tempDir, 'empty-skill');
      await fs.mkdir(emptyDir, { recursive: true });

      const emptyPackagePath = path.join(tempDir, 'empty.skill');
      const zip = new AdmZip();
      zip.addFile('empty-skill/SKILL.md', Buffer.from('---\nname: empty-skill\n---\n'));
      zip.writeZip(emptyPackagePath);

      const comparison = await compareVersions(emptyDir, emptyPackagePath);

      // SKILL.md was added
      expect(comparison.filesAdded.length).toBe(1);
      expect(comparison.filesRemoved.length).toBe(0);
      expect(comparison.filesModified.length).toBe(0);
    });
  });

  describe('extractMetadata', () => {
    it('extracts metadata from SKILL.md', async () => {
      const metadata = await extractMetadata(installedSkillDir);

      expect(metadata.name).toBe('test-skill');
      expect(metadata.description).toBe('Original skill');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.lastModified).toBeDefined();
    });

    it('returns minimal metadata for missing SKILL.md', async () => {
      const noSkillMdDir = path.join(tempDir, 'no-skill-md');
      await fs.mkdir(noSkillMdDir, { recursive: true });

      const metadata = await extractMetadata(noSkillMdDir);

      expect(metadata.name).toBe('no-skill-md');
      expect(metadata.description).toBeUndefined();
    });

    it('handles invalid frontmatter gracefully', async () => {
      const invalidDir = path.join(tempDir, 'invalid-skill');
      await fs.mkdir(invalidDir, { recursive: true });
      await fs.writeFile(path.join(invalidDir, 'SKILL.md'), 'No frontmatter here');

      const metadata = await extractMetadata(invalidDir);

      expect(metadata.name).toBe('invalid-skill');
    });
  });

  describe('extractPackageMetadata', () => {
    it('extracts metadata from package SKILL.md', async () => {
      const metadata = await extractPackageMetadata(newPackagePath);

      expect(metadata.name).toBe('test-skill');
      expect(metadata.description).toBe('Updated skill');
      expect(metadata.version).toBe('2.0.0');
    });

    it('returns minimal metadata for package without SKILL.md', async () => {
      const noSkillMdPackage = path.join(tempDir, 'no-md.skill');
      const zip = new AdmZip();
      zip.addFile('no-md/file.txt', Buffer.from('content'));
      zip.writeZip(noSkillMdPackage);

      const metadata = await extractPackageMetadata(noSkillMdPackage);

      expect(metadata.name).toBe('no-md');
    });
  });

  describe('detectDowngrade', () => {
    it('detects version downgrade', () => {
      const installed: SkillMetadata = {
        name: 'test-skill',
        version: '2.0.0',
      };
      const newPkg: SkillMetadata = {
        name: 'test-skill',
        version: '1.0.0',
      };

      const result = detectDowngrade(installed, newPkg);

      expect(result).not.toBeNull();
      expect(result?.isDowngrade).toBe(true);
      expect(result?.message).toContain('2.0.0');
      expect(result?.message).toContain('1.0.0');
    });

    it('detects date-based downgrade', () => {
      const installed: SkillMetadata = {
        name: 'test-skill',
        lastModified: '2025-06-15T12:00:00Z',
      };
      const newPkg: SkillMetadata = {
        name: 'test-skill',
        lastModified: '2025-01-01T12:00:00Z',
      };

      const result = detectDowngrade(installed, newPkg);

      expect(result).not.toBeNull();
      expect(result?.isDowngrade).toBe(true);
      expect(result?.installedDate).toBe('2025-06-15T12:00:00Z');
      expect(result?.newDate).toBe('2025-01-01T12:00:00Z');
    });

    it('returns null for upgrade', () => {
      const installed: SkillMetadata = {
        name: 'test-skill',
        version: '1.0.0',
      };
      const newPkg: SkillMetadata = {
        name: 'test-skill',
        version: '2.0.0',
      };

      const result = detectDowngrade(installed, newPkg);

      expect(result).toBeNull();
    });

    it('returns null when no version info available', () => {
      const installed: SkillMetadata = {
        name: 'test-skill',
      };
      const newPkg: SkillMetadata = {
        name: 'test-skill',
      };

      const result = detectDowngrade(installed, newPkg);

      expect(result).toBeNull();
    });
  });

  describe('getInstalledVersionInfo', () => {
    it('returns version info for installed skill', async () => {
      const info = await getInstalledVersionInfo(installedSkillDir);

      expect(info.path).toBe(installedSkillDir);
      expect(info.fileCount).toBe(4); // SKILL.md, src/index.ts, README.md, old-file.txt
      expect(info.size).toBeGreaterThan(0);
      expect(info.description).toBe('Original skill');
    });
  });

  describe('getPackageVersionInfo', () => {
    it('returns version info for package', async () => {
      const info = await getPackageVersionInfo(newPackagePath);

      expect(info.path).toBe(newPackagePath);
      expect(info.fileCount).toBe(4); // SKILL.md, src/index.ts, README.md, new-file.txt
      expect(info.size).toBeGreaterThan(0);
      expect(info.description).toBe('Updated skill');
    });
  });

  describe('summarizeChanges', () => {
    it('calculates bytes added from new files', () => {
      const comparison: VersionComparison = {
        filesAdded: [
          { path: 'new.txt', changeType: 'added', sizeBefore: 0, sizeAfter: 100, sizeDelta: 100 },
        ],
        filesRemoved: [],
        filesModified: [],
        addedCount: 1,
        removedCount: 0,
        modifiedCount: 0,
        sizeChange: 100,
      };

      const summary = summarizeChanges(comparison);

      expect(summary.bytesAdded).toBe(100);
      expect(summary.bytesRemoved).toBe(0);
      expect(summary.netSizeChange).toBe(100);
    });

    it('calculates bytes removed from deleted files', () => {
      const comparison: VersionComparison = {
        filesAdded: [],
        filesRemoved: [
          {
            path: 'old.txt',
            changeType: 'removed',
            sizeBefore: 200,
            sizeAfter: 0,
            sizeDelta: -200,
          },
        ],
        filesModified: [],
        addedCount: 0,
        removedCount: 1,
        modifiedCount: 0,
        sizeChange: -200,
      };

      const summary = summarizeChanges(comparison);

      expect(summary.bytesAdded).toBe(0);
      expect(summary.bytesRemoved).toBe(200);
      expect(summary.netSizeChange).toBe(-200);
    });

    it('handles mixed changes correctly', () => {
      const comparison: VersionComparison = {
        filesAdded: [
          { path: 'new.txt', changeType: 'added', sizeBefore: 0, sizeAfter: 100, sizeDelta: 100 },
        ],
        filesRemoved: [
          { path: 'old.txt', changeType: 'removed', sizeBefore: 50, sizeAfter: 0, sizeDelta: -50 },
        ],
        filesModified: [
          {
            path: 'mod.txt',
            changeType: 'modified',
            sizeBefore: 100,
            sizeAfter: 150,
            sizeDelta: 50,
          },
        ],
        addedCount: 1,
        removedCount: 1,
        modifiedCount: 1,
        sizeChange: 100,
      };

      const summary = summarizeChanges(comparison);

      expect(summary.addedCount).toBe(1);
      expect(summary.removedCount).toBe(1);
      expect(summary.modifiedCount).toBe(1);
      expect(summary.bytesAdded).toBe(150); // 100 (new) + 50 (increase in mod)
      expect(summary.bytesRemoved).toBe(50); // 50 (old)
    });
  });

  describe('formatDiffLine', () => {
    it('formats added file correctly', () => {
      const change: FileChange = {
        path: 'new-file.txt',
        changeType: 'added',
        sizeBefore: 0,
        sizeAfter: 1024,
        sizeDelta: 1024,
      };

      const line = formatDiffLine(change);

      expect(line).toBe('+ new-file.txt (added, 1.00 KB)');
    });

    it('formats removed file correctly', () => {
      const change: FileChange = {
        path: 'old-file.txt',
        changeType: 'removed',
        sizeBefore: 512,
        sizeAfter: 0,
        sizeDelta: -512,
      };

      const line = formatDiffLine(change);

      expect(line).toBe('- old-file.txt (removed, 512 B)');
    });

    it('formats modified file with size increase', () => {
      const change: FileChange = {
        path: 'changed.txt',
        changeType: 'modified',
        sizeBefore: 100,
        sizeAfter: 200,
        sizeDelta: 100,
      };

      const line = formatDiffLine(change);

      expect(line).toBe('~ changed.txt (modified, +100 B)');
    });

    it('formats modified file with size decrease', () => {
      const change: FileChange = {
        path: 'shrunk.txt',
        changeType: 'modified',
        sizeBefore: 200,
        sizeAfter: 100,
        sizeDelta: -100,
      };

      const line = formatDiffLine(change);

      expect(line).toBe('~ shrunk.txt (modified, -100 B)');
    });

    it('formats modified file with same size', () => {
      const change: FileChange = {
        path: 'same-size.txt',
        changeType: 'modified',
        sizeBefore: 100,
        sizeAfter: 100,
        sizeDelta: 0,
      };

      const line = formatDiffLine(change);

      expect(line).toBe('~ same-size.txt (modified, same size)');
    });
  });

  describe('streamFileComparison', () => {
    it('yields file changes incrementally', async () => {
      const changes: FileChange[] = [];

      for await (const change of streamFileComparison(installedSkillDir, newPackagePath)) {
        changes.push(change);
      }

      // Should find the same changes as compareVersions
      const addedPaths = changes.filter((c) => c.changeType === 'added').map((c) => c.path);
      const removedPaths = changes.filter((c) => c.changeType === 'removed').map((c) => c.path);

      expect(addedPaths).toContain('new-file.txt');
      expect(removedPaths).toContain('old-file.txt');
    });

    it('supports thorough mode', async () => {
      const changes: FileChange[] = [];

      for await (const change of streamFileComparison(installedSkillDir, newPackagePath, {
        thorough: true,
      })) {
        changes.push(change);
      }

      // Should work with hash comparison
      expect(changes.length).toBeGreaterThan(0);
    });
  });

  describe('Low memory threshold (streaming comparison)', () => {
    it('uses streaming comparison when file count exceeds threshold', async () => {
      // Use a very low threshold to trigger streaming comparison
      const comparison = await compareVersions(installedSkillDir, newPackagePath, {
        memoryThreshold: 1, // Force streaming mode
      });

      // Results should be the same as normal comparison
      expect(comparison.filesAdded.length).toBeGreaterThan(0);
      expect(comparison.filesRemoved.length).toBeGreaterThan(0);
    });

    it('streaming comparison with thorough mode', async () => {
      const comparison = await compareVersions(installedSkillDir, newPackagePath, {
        memoryThreshold: 1,
        thorough: true,
      });

      expect(comparison.filesAdded.length).toBeGreaterThan(0);
    });
  });

  describe('extractPackageMetadata edge cases', () => {
    it('handles package with no root directory', async () => {
      const noRootPackage = path.join(tempDir, 'no-root.skill');
      const zip = new AdmZip();
      // Add file at root level (no directory)
      zip.addFile('file.txt', Buffer.from('content'));
      zip.writeZip(noRootPackage);

      const metadata = await extractPackageMetadata(noRootPackage);

      expect(metadata.name).toBe('no-root');
    });

    it('handles package with SKILL.md having invalid frontmatter', async () => {
      const invalidFmPackage = path.join(tempDir, 'invalid-fm.skill');
      const zip = new AdmZip();
      zip.addFile('invalid-skill/SKILL.md', Buffer.from('Not valid frontmatter - no delimiters'));
      zip.writeZip(invalidFmPackage);

      const metadata = await extractPackageMetadata(invalidFmPackage);

      expect(metadata.name).toBe('invalid-skill');
    });

    it('handles corrupted package gracefully', async () => {
      const corruptedPath = path.join(tempDir, 'corrupted.skill');
      await fs.writeFile(corruptedPath, 'not a valid zip file');

      const metadata = await extractPackageMetadata(corruptedPath);

      expect(metadata.name).toBe('corrupted');
    });
  });

  describe('summarizeChanges edge cases', () => {
    it('handles modified file with size decrease', () => {
      const comparison: VersionComparison = {
        filesAdded: [],
        filesRemoved: [],
        filesModified: [
          {
            path: 'shrunk.txt',
            changeType: 'modified',
            sizeBefore: 200,
            sizeAfter: 100,
            sizeDelta: -100,
          },
        ],
        addedCount: 0,
        removedCount: 0,
        modifiedCount: 1,
        sizeChange: -100,
      };

      const summary = summarizeChanges(comparison);

      expect(summary.bytesAdded).toBe(0);
      expect(summary.bytesRemoved).toBe(100);
    });
  });

  describe('Edge cases', () => {
    it('handles skill with subdirectories', async () => {
      const nestedDir = path.join(tempDir, 'nested-skill');
      await fs.mkdir(path.join(nestedDir, 'a', 'b', 'c'), { recursive: true });
      await fs.writeFile(path.join(nestedDir, 'SKILL.md'), '---\nname: nested\n---\n');
      await fs.writeFile(path.join(nestedDir, 'a', 'file.txt'), 'a');
      await fs.writeFile(path.join(nestedDir, 'a', 'b', 'file.txt'), 'b');
      await fs.writeFile(path.join(nestedDir, 'a', 'b', 'c', 'file.txt'), 'c');

      const nestedPackage = path.join(tempDir, 'nested.skill');
      const zip = new AdmZip();
      zip.addFile('nested/SKILL.md', Buffer.from('---\nname: nested\n---\n'));
      zip.addFile('nested/a/file.txt', Buffer.from('aa')); // Modified
      zip.addFile('nested/a/b/file.txt', Buffer.from('b')); // Same
      // c/file.txt removed
      zip.addFile('nested/new/file.txt', Buffer.from('new')); // Added
      zip.writeZip(nestedPackage);

      const comparison = await compareVersions(nestedDir, nestedPackage);

      // Should handle nested paths correctly
      expect(comparison.filesModified.some((f) => f.path === 'a/file.txt')).toBe(true);
      expect(comparison.filesRemoved.some((f) => f.path === 'a/b/c/file.txt')).toBe(true);
      expect(comparison.filesAdded.some((f) => f.path === 'new/file.txt')).toBe(true);
    });

    it('handles very long file paths', async () => {
      const longPathDir = path.join(tempDir, 'long-path-skill');
      const deepPath = path.join(longPathDir, 'a'.repeat(10), 'b'.repeat(10), 'c'.repeat(10));
      await fs.mkdir(deepPath, { recursive: true });
      await fs.writeFile(path.join(longPathDir, 'SKILL.md'), '---\nname: long\n---\n');
      await fs.writeFile(path.join(deepPath, 'file.txt'), 'content');

      const metadata = await extractMetadata(longPathDir);
      expect(metadata.name).toBe('long');

      const info = await getInstalledVersionInfo(longPathDir);
      expect(info.fileCount).toBe(2);
    });

    it('handles skill with no changes', async () => {
      const sameDir = path.join(tempDir, 'same-skill');
      await fs.mkdir(sameDir, { recursive: true });
      await fs.writeFile(path.join(sameDir, 'SKILL.md'), '---\nname: same\n---\n');
      await fs.writeFile(path.join(sameDir, 'file.txt'), 'content');

      const samePackage = path.join(tempDir, 'same.skill');
      const zip = new AdmZip();
      zip.addFile('same/SKILL.md', Buffer.from('---\nname: same\n---\n'));
      zip.addFile('same/file.txt', Buffer.from('content'));
      zip.writeZip(samePackage);

      const comparison = await compareVersions(sameDir, samePackage);

      expect(comparison.filesAdded.length).toBe(0);
      expect(comparison.filesRemoved.length).toBe(0);
      expect(comparison.filesModified.length).toBe(0);
      expect(comparison.sizeChange).toBe(0);
    });
  });
});
