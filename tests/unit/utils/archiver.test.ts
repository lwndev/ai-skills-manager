/**
 * Tests for archiver utilities and package types
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  createZipArchive,
  addFileToArchive,
  addDirectoryToArchive,
  finalizeArchive,
  getArchiveSize,
  formatFileSize,
} from '../../../src/utils/archiver';
import {
  isExcluded,
  EXCLUDED_PATTERNS,
  PackageOptions,
  PackageResult,
  FileEntry,
} from '../../../src/types/package';

describe('isExcluded', () => {
  describe('directory patterns', () => {
    it('excludes .git directory', () => {
      expect(isExcluded('.git/config')).toBe(true);
      expect(isExcluded('.git/hooks/pre-commit')).toBe(true);
    });

    it('excludes nested .git directories', () => {
      expect(isExcluded('submodule/.git/config')).toBe(true);
    });

    it('excludes node_modules directory', () => {
      expect(isExcluded('node_modules/lodash/index.js')).toBe(true);
      expect(isExcluded('node_modules/.bin/tsc')).toBe(true);
    });

    it('excludes nested node_modules directories', () => {
      expect(isExcluded('packages/foo/node_modules/bar/index.js')).toBe(true);
    });

    it('excludes __pycache__ directory', () => {
      expect(isExcluded('__pycache__/module.cpython-39.pyc')).toBe(true);
      expect(isExcluded('src/__pycache__/util.cpython-39.pyc')).toBe(true);
    });
  });

  describe('file patterns', () => {
    it('excludes .DS_Store files', () => {
      expect(isExcluded('.DS_Store')).toBe(true);
      expect(isExcluded('src/.DS_Store')).toBe(true);
    });

    it('excludes .log files', () => {
      expect(isExcluded('debug.log')).toBe(true);
      expect(isExcluded('npm-debug.log')).toBe(true);
      expect(isExcluded('logs/app.log')).toBe(true);
    });

    it('excludes .pyc files', () => {
      expect(isExcluded('module.pyc')).toBe(true);
      expect(isExcluded('src/utils/helper.pyc')).toBe(true);
    });
  });

  describe('non-excluded files', () => {
    it('includes regular source files', () => {
      expect(isExcluded('src/index.ts')).toBe(false);
      expect(isExcluded('lib/utils.js')).toBe(false);
    });

    it('includes SKILL.md', () => {
      expect(isExcluded('SKILL.md')).toBe(false);
    });

    it('includes hidden files that are not in exclusion list', () => {
      expect(isExcluded('.gitignore')).toBe(false);
      expect(isExcluded('.gitkeep')).toBe(false);
      expect(isExcluded('.eslintrc.js')).toBe(false);
    });

    it('includes files that partially match patterns', () => {
      // "git" in filename but not ".git/" directory
      expect(isExcluded('git-config.md')).toBe(false);
      // "log" in filename but not "*.log"
      expect(isExcluded('login.ts')).toBe(false);
      expect(isExcluded('dialog.tsx')).toBe(false);
    });

    it('includes markdown files', () => {
      expect(isExcluded('README.md')).toBe(false);
      expect(isExcluded('docs/guide.md')).toBe(false);
    });
  });

  describe('path normalization', () => {
    it('handles Windows-style paths', () => {
      expect(isExcluded('node_modules\\lodash\\index.js')).toBe(true);
      expect(isExcluded('.git\\config')).toBe(true);
    });
  });
});

describe('EXCLUDED_PATTERNS', () => {
  it('contains expected patterns', () => {
    expect(EXCLUDED_PATTERNS).toContain('.git/');
    expect(EXCLUDED_PATTERNS).toContain('node_modules/');
    expect(EXCLUDED_PATTERNS).toContain('.DS_Store');
    expect(EXCLUDED_PATTERNS).toContain('*.log');
    expect(EXCLUDED_PATTERNS).toContain('__pycache__/');
    expect(EXCLUDED_PATTERNS).toContain('*.pyc');
  });

  it('has the expected number of patterns', () => {
    expect(EXCLUDED_PATTERNS.length).toBe(6);
  });
});

describe('formatFileSize', () => {
  it('formats bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('formats kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(10240)).toBe('10.0 KB');
    expect(formatFileSize(1024 * 1024 - 1)).toBe('1024.0 KB');
  });

  it('formats megabytes correctly', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 MB');
    expect(formatFileSize(100 * 1024 * 1024)).toBe('100.0 MB');
  });
});

describe('Package Types', () => {
  describe('PackageOptions interface', () => {
    it('can create valid PackageOptions', () => {
      const options: PackageOptions = {
        outputPath: '/output',
        force: true,
        skipValidation: false,
        quiet: true,
      };

      expect(options.outputPath).toBe('/output');
      expect(options.force).toBe(true);
      expect(options.skipValidation).toBe(false);
      expect(options.quiet).toBe(true);
    });

    it('all fields are optional', () => {
      const options: PackageOptions = {};
      expect(options.outputPath).toBeUndefined();
      expect(options.force).toBeUndefined();
    });
  });

  describe('PackageResult interface', () => {
    it('can create valid PackageResult', () => {
      const result: PackageResult = {
        success: true,
        packagePath: '/output/skill.skill',
        fileCount: 5,
        size: 1024,
        errors: [],
      };

      expect(result.success).toBe(true);
      expect(result.packagePath).toBe('/output/skill.skill');
      expect(result.fileCount).toBe(5);
      expect(result.size).toBe(1024);
      expect(result.errors).toHaveLength(0);
    });

    it('can create failed PackageResult', () => {
      const result: PackageResult = {
        success: false,
        fileCount: 0,
        size: 0,
        errors: ['Validation failed', 'Missing SKILL.md'],
      };

      expect(result.success).toBe(false);
      expect(result.packagePath).toBeUndefined();
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('FileEntry interface', () => {
    it('can create valid FileEntry', () => {
      const entry: FileEntry = {
        path: 'src/index.ts',
        size: 1024,
        excluded: false,
      };

      expect(entry.path).toBe('src/index.ts');
      expect(entry.size).toBe(1024);
      expect(entry.excluded).toBe(false);
    });

    it('can create excluded FileEntry', () => {
      const entry: FileEntry = {
        path: 'node_modules/lodash/index.js',
        size: 2048,
        excluded: true,
      };

      expect(entry.excluded).toBe(true);
    });
  });
});

describe('Archive creation', () => {
  let tempDir: string;
  let testSkillDir: string;

  beforeAll(async () => {
    // Create temporary directory structure for testing
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-test-'));
    testSkillDir = path.join(tempDir, 'test-skill');

    // Create test skill directory structure
    await fs.promises.mkdir(testSkillDir, { recursive: true });
    await fs.promises.mkdir(path.join(testSkillDir, 'src'), { recursive: true });
    await fs.promises.mkdir(path.join(testSkillDir, 'node_modules', 'pkg'), {
      recursive: true,
    });
    await fs.promises.mkdir(path.join(testSkillDir, '.git', 'objects'), {
      recursive: true,
    });

    // Create test files
    await fs.promises.writeFile(
      path.join(testSkillDir, 'SKILL.md'),
      '---\nname: test-skill\n---\nTest skill'
    );
    await fs.promises.writeFile(
      path.join(testSkillDir, 'src', 'index.ts'),
      'export const main = () => {};'
    );
    await fs.promises.writeFile(
      path.join(testSkillDir, 'node_modules', 'pkg', 'index.js'),
      'module.exports = {};'
    );
    await fs.promises.writeFile(path.join(testSkillDir, '.git', 'config'), '[core]');
    await fs.promises.writeFile(path.join(testSkillDir, '.DS_Store'), '');
    await fs.promises.writeFile(path.join(testSkillDir, 'debug.log'), 'log content');
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('createZipArchive', () => {
    it('creates an archiver instance', () => {
      const outputPath = path.join(tempDir, 'test.zip');
      const archive = createZipArchive(outputPath);

      expect(archive).toBeDefined();
      expect(typeof archive.file).toBe('function');
      expect(typeof archive.finalize).toBe('function');

      // Clean up - abort the archive
      archive.abort();
    });
  });

  describe('addDirectoryToArchive', () => {
    it('adds files and excludes ignored patterns', async () => {
      const outputPath = path.join(tempDir, 'skill-package.zip');
      const archive = createZipArchive(outputPath);

      const fileCount = await addDirectoryToArchive(archive, testSkillDir, 'test-skill');

      await finalizeArchive(archive);

      // Should include SKILL.md and src/index.ts (2 files)
      // Should exclude: node_modules/*, .git/*, .DS_Store, debug.log
      expect(fileCount).toBe(2);

      // Verify archive was created
      const stats = await fs.promises.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('getArchiveSize', () => {
    it('returns the size of an archive file', async () => {
      const outputPath = path.join(tempDir, 'size-test.zip');
      const archive = createZipArchive(outputPath);

      await addDirectoryToArchive(archive, testSkillDir, 'test-skill');
      await finalizeArchive(archive);

      const size = await getArchiveSize(outputPath);
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('finalizeArchive', () => {
    it('completes archive successfully', async () => {
      const outputPath = path.join(tempDir, 'finalize-test.zip');
      const archive = createZipArchive(outputPath);

      addFileToArchive(archive, path.join(testSkillDir, 'SKILL.md'), 'test-skill/SKILL.md');

      await expect(finalizeArchive(archive)).resolves.toBeUndefined();

      // Verify file exists
      const exists = await fs.promises
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
