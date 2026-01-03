/**
 * Tests for file enumeration module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  enumerateSkillFiles,
  getSkillSummary,
  collectSkillFiles,
  checkResourceLimits,
  formatFileSize,
  SkillSummary,
} from '../../../src/generators/file-enumerator';

describe('File Enumerator', () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-enumerator-test-'));

    // Create a skill with various files
    const skillDir = path.join(tempDir, 'test-skill');
    await fs.promises.mkdir(skillDir, { recursive: true });

    // Create SKILL.md
    await fs.promises.writeFile(
      path.join(skillDir, 'SKILL.md'),
      '---\nname: test-skill\ndescription: Test\n---\n\n# Test Skill'
    );

    // Create scripts directory with files
    const scriptsDir = path.join(skillDir, 'scripts');
    await fs.promises.mkdir(scriptsDir, { recursive: true });
    await fs.promises.writeFile(path.join(scriptsDir, 'helper.py'), 'def helper(): pass\n');
    await fs.promises.writeFile(path.join(scriptsDir, 'utils.py'), 'def utils(): pass\n');

    // Create templates directory
    const templatesDir = path.join(skillDir, 'templates');
    await fs.promises.mkdir(templatesDir, { recursive: true });
    await fs.promises.writeFile(path.join(templatesDir, 'template.txt'), 'Template content');

    // Create a nested directory
    const nestedDir = path.join(skillDir, 'data', 'nested');
    await fs.promises.mkdir(nestedDir, { recursive: true });
    await fs.promises.writeFile(path.join(nestedDir, 'deep.json'), '{"key": "value"}');
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('enumerateSkillFiles', () => {
    it('yields all files and directories in skill', async () => {
      const skillDir = path.join(tempDir, 'test-skill');
      const files: string[] = [];

      for await (const fileInfo of enumerateSkillFiles(skillDir)) {
        files.push(fileInfo.relativePath);
      }

      // Should include SKILL.md, directories, and all files
      expect(files).toContain('SKILL.md');
      expect(files).toContain('scripts');
      expect(files).toContain(path.join('scripts', 'helper.py'));
      expect(files).toContain(path.join('scripts', 'utils.py'));
      expect(files).toContain('templates');
      expect(files).toContain(path.join('templates', 'template.txt'));
      expect(files).toContain('data');
      expect(files).toContain(path.join('data', 'nested'));
      expect(files).toContain(path.join('data', 'nested', 'deep.json'));
    });

    it('provides correct file information', async () => {
      const skillDir = path.join(tempDir, 'test-skill');

      for await (const fileInfo of enumerateSkillFiles(skillDir)) {
        if (fileInfo.relativePath === 'SKILL.md') {
          expect(fileInfo.absolutePath).toBe(path.join(skillDir, 'SKILL.md'));
          expect(fileInfo.isDirectory).toBe(false);
          expect(fileInfo.isSymlink).toBe(false);
          expect(fileInfo.size).toBeGreaterThan(0);
          expect(fileInfo.linkCount).toBeGreaterThanOrEqual(1);
        }

        if (fileInfo.relativePath === 'scripts') {
          expect(fileInfo.isDirectory).toBe(true);
        }
      }
    });

    it('handles empty directories', async () => {
      // Create an empty directory
      const emptyDir = path.join(tempDir, 'empty-skill');
      await fs.promises.mkdir(emptyDir, { recursive: true });

      const files: string[] = [];
      for await (const fileInfo of enumerateSkillFiles(emptyDir)) {
        files.push(fileInfo.relativePath);
      }

      expect(files).toHaveLength(0);

      // Clean up
      await fs.promises.rmdir(emptyDir);
    });

    it('handles non-existent directory gracefully', async () => {
      const files: string[] = [];
      for await (const fileInfo of enumerateSkillFiles('/non/existent/path')) {
        files.push(fileInfo.relativePath);
      }

      expect(files).toHaveLength(0);
    });
  });

  describe('getSkillSummary', () => {
    it('calculates correct summary for skill', async () => {
      const skillDir = path.join(tempDir, 'test-skill');
      const summary = await getSkillSummary(skillDir);

      // 5 files: SKILL.md, helper.py, utils.py, template.txt, deep.json
      expect(summary.fileCount).toBe(5);
      // 4 directories: scripts, templates, data, data/nested
      expect(summary.directoryCount).toBe(4);
      expect(summary.totalSize).toBeGreaterThan(0);
      expect(summary.symlinkCount).toBe(0);
      expect(summary.hardLinkCount).toBe(0);
    });

    it('returns zero values for empty directory', async () => {
      const emptyDir = path.join(tempDir, 'empty-summary');
      await fs.promises.mkdir(emptyDir, { recursive: true });

      const summary = await getSkillSummary(emptyDir);

      expect(summary.fileCount).toBe(0);
      expect(summary.directoryCount).toBe(0);
      expect(summary.totalSize).toBe(0);
      expect(summary.symlinkCount).toBe(0);
      expect(summary.hardLinkCount).toBe(0);

      // Clean up
      await fs.promises.rmdir(emptyDir);
    });
  });

  describe('collectSkillFiles', () => {
    it('collects all files into an array', async () => {
      const skillDir = path.join(tempDir, 'test-skill');
      const files = await collectSkillFiles(skillDir);

      // 9 total entries: 5 files + 4 directories
      expect(files.length).toBe(9);

      const filePaths = files.map((f) => f.relativePath);
      expect(filePaths).toContain('SKILL.md');
      expect(filePaths).toContain(path.join('scripts', 'helper.py'));
    });
  });

  describe('checkResourceLimits', () => {
    it('returns "ok" for normal-sized skill', () => {
      const summary: SkillSummary = {
        fileCount: 100,
        directoryCount: 10,
        totalSize: 1024 * 1024, // 1 MB
        symlinkCount: 0,
        hardLinkCount: 0,
      };

      const result = checkResourceLimits(summary);
      expect(result.type).toBe('ok');
    });

    it('returns "exceeded" for skill with too many files', () => {
      const summary: SkillSummary = {
        fileCount: 15000,
        directoryCount: 100,
        totalSize: 1024 * 1024, // 1 MB
        symlinkCount: 0,
        hardLinkCount: 0,
      };

      const result = checkResourceLimits(summary);
      expect(result.type).toBe('exceeded');
      if (result.type === 'exceeded') {
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('15,000 files');
        expect(result.requiresForce).toBe(true);
      }
    });

    it('returns "exceeded" for skill that is too large', () => {
      const summary: SkillSummary = {
        fileCount: 100,
        directoryCount: 10,
        totalSize: 2 * 1024 * 1024 * 1024, // 2 GB
        symlinkCount: 0,
        hardLinkCount: 0,
      };

      const result = checkResourceLimits(summary);
      expect(result.type).toBe('exceeded');
      if (result.type === 'exceeded') {
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('2.00 GB');
        expect(result.requiresForce).toBe(true);
      }
    });

    it('returns multiple warnings when both limits exceeded', () => {
      const summary: SkillSummary = {
        fileCount: 20000,
        directoryCount: 100,
        totalSize: 2 * 1024 * 1024 * 1024, // 2 GB
        symlinkCount: 0,
        hardLinkCount: 0,
      };

      const result = checkResourceLimits(summary);
      expect(result.type).toBe('exceeded');
      if (result.type === 'exceeded') {
        expect(result.warnings.length).toBe(2);
      }
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1023)).toBe('1023 B');
    });

    it('formats kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1536)).toBe('1.50 KB');
      expect(formatFileSize(10240)).toBe('10.00 KB');
    });

    it('formats megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.50 MB');
    });

    it('formats gigabytes correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
    });
  });

  describe('symlink handling', () => {
    it('detects symlinks without following them', async () => {
      // Create a skill with a symlink
      const symlinkSkillDir = path.join(tempDir, 'symlink-skill');
      await fs.promises.mkdir(symlinkSkillDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(symlinkSkillDir, 'SKILL.md'),
        '---\nname: symlink-skill\n---\n'
      );

      // Create a target file and symlink
      const targetFile = path.join(symlinkSkillDir, 'target.txt');
      await fs.promises.writeFile(targetFile, 'target content');
      const linkFile = path.join(symlinkSkillDir, 'link.txt');

      try {
        await fs.promises.symlink(targetFile, linkFile);
      } catch {
        // Symlinks may not be supported on all systems/permissions
        console.log('Symlink creation not supported, skipping symlink test');
        return;
      }

      const files = await collectSkillFiles(symlinkSkillDir);
      const linkInfo = files.find((f) => f.relativePath === 'link.txt');

      expect(linkInfo).toBeDefined();
      expect(linkInfo?.isSymlink).toBe(true);

      // Summary should count symlinks
      const summary = await getSkillSummary(symlinkSkillDir);
      expect(summary.symlinkCount).toBe(1);
    });
  });
});
