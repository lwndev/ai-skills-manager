/**
 * Tests for ZIP extraction utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';

import {
  openZipArchive,
  isValidZipArchive,
  getZipEntries,
  extractToDirectory,
  extractEntryToDirectory,
  getZipRootDirectory,
  getTotalUncompressedSize,
  readEntryAsText,
} from '../../../src/utils/extractor';

describe('Extractor Utilities', () => {
  let tempDir: string;
  let validZipPath: string;
  let invalidZipPath: string;
  let multiRootZipPath: string;
  let noRootZipPath: string;
  let emptyZipPath: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-extractor-test-'));

    // Create a valid skill package ZIP
    validZipPath = path.join(tempDir, 'valid-skill.skill');
    const validZip = new AdmZip();
    validZip.addFile(
      'my-skill/SKILL.md',
      Buffer.from(
        '---\nname: my-skill\ndescription: A test skill\n---\n\n# My Skill\n\nTest content.'
      )
    );
    validZip.addFile('my-skill/scripts/helper.py', Buffer.from('def helper(): pass'));
    validZip.addFile('my-skill/README.md', Buffer.from('# My Skill\n\nReadme content.'));
    validZip.writeZip(validZipPath);

    // Create an invalid (corrupted) file
    invalidZipPath = path.join(tempDir, 'invalid.skill');
    await fs.promises.writeFile(invalidZipPath, 'This is not a valid ZIP file content');

    // Create a ZIP with multiple root directories
    multiRootZipPath = path.join(tempDir, 'multi-root.skill');
    const multiRootZip = new AdmZip();
    multiRootZip.addFile('skill-a/SKILL.md', Buffer.from('Skill A'));
    multiRootZip.addFile('skill-b/SKILL.md', Buffer.from('Skill B'));
    multiRootZip.writeZip(multiRootZipPath);

    // Create a ZIP with files at root level (no root directory)
    noRootZipPath = path.join(tempDir, 'no-root.skill');
    const noRootZip = new AdmZip();
    noRootZip.addFile('SKILL.md', Buffer.from('Skill at root'));
    noRootZip.addFile('README.md', Buffer.from('Readme at root'));
    noRootZip.writeZip(noRootZipPath);

    // Create an empty ZIP
    emptyZipPath = path.join(tempDir, 'empty.skill');
    const emptyZip = new AdmZip();
    emptyZip.writeZip(emptyZipPath);
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('openZipArchive', () => {
    it('opens a valid ZIP file', () => {
      const archive = openZipArchive(validZipPath);
      expect(archive).toBeDefined();
      // Verify it has expected AdmZip methods
      expect(typeof archive.getEntries).toBe('function');
      expect(typeof archive.extractAllTo).toBe('function');
      expect(typeof archive.readAsText).toBe('function');
    });

    it('throws an error for non-existent file', () => {
      expect(() => openZipArchive('/non/existent/file.skill')).toThrow();
    });

    it('throws an error for invalid ZIP file', () => {
      expect(() => openZipArchive(invalidZipPath)).toThrow();
    });
  });

  describe('isValidZipArchive', () => {
    it('returns true for a valid ZIP file', () => {
      expect(isValidZipArchive(validZipPath)).toBe(true);
    });

    it('returns false for an invalid file', () => {
      expect(isValidZipArchive(invalidZipPath)).toBe(false);
    });

    it('returns false for a non-existent file', () => {
      expect(isValidZipArchive('/non/existent/file.skill')).toBe(false);
    });

    it('returns true for an empty ZIP file', () => {
      expect(isValidZipArchive(emptyZipPath)).toBe(true);
    });
  });

  describe('getZipEntries', () => {
    it('returns all entries from a ZIP archive', () => {
      const archive = openZipArchive(validZipPath);
      const entries = getZipEntries(archive);

      expect(entries).toHaveLength(3);
      const entryNames = entries.map((e) => e.entryName);
      expect(entryNames).toContain('my-skill/SKILL.md');
      expect(entryNames).toContain('my-skill/scripts/helper.py');
      expect(entryNames).toContain('my-skill/README.md');
    });

    it('returns empty array for empty ZIP', () => {
      const archive = openZipArchive(emptyZipPath);
      const entries = getZipEntries(archive);
      expect(entries).toHaveLength(0);
    });
  });

  describe('extractToDirectory', () => {
    it('extracts all contents to target directory', async () => {
      const extractDir = path.join(tempDir, 'extract-test');
      await fs.promises.mkdir(extractDir, { recursive: true });

      const archive = openZipArchive(validZipPath);
      await extractToDirectory(archive, extractDir);

      // Verify extracted files
      const skillMdPath = path.join(extractDir, 'my-skill', 'SKILL.md');
      const exists = await fs.promises
        .access(skillMdPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.promises.readFile(skillMdPath, 'utf-8');
      expect(content).toContain('name: my-skill');
    });

    it('overwrites existing files when overwrite is true', async () => {
      const extractDir = path.join(tempDir, 'extract-overwrite-test');
      await fs.promises.mkdir(path.join(extractDir, 'my-skill'), { recursive: true });

      // Create existing file
      const existingPath = path.join(extractDir, 'my-skill', 'SKILL.md');
      await fs.promises.writeFile(existingPath, 'Original content');

      const archive = openZipArchive(validZipPath);
      await extractToDirectory(archive, extractDir, true);

      const content = await fs.promises.readFile(existingPath, 'utf-8');
      expect(content).toContain('name: my-skill');
      expect(content).not.toContain('Original content');
    });
  });

  describe('extractEntryToDirectory', () => {
    it('extracts a single entry to target directory', async () => {
      const extractDir = path.join(tempDir, 'extract-entry-test');
      await fs.promises.mkdir(extractDir, { recursive: true });

      const archive = openZipArchive(validZipPath);
      const entries = getZipEntries(archive);
      const skillMdEntry = entries.find((e) => e.entryName === 'my-skill/SKILL.md');

      if (!skillMdEntry) {
        throw new Error('Expected entry my-skill/SKILL.md not found in archive');
      }

      const result = extractEntryToDirectory(archive, skillMdEntry, extractDir);
      expect(result).toBe(true);

      // Verify extracted file
      const extractedPath = path.join(extractDir, 'my-skill', 'SKILL.md');
      const exists = await fs.promises
        .access(extractedPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('getZipRootDirectory', () => {
    it('returns the root directory for a valid skill package', () => {
      const archive = openZipArchive(validZipPath);
      const rootDir = getZipRootDirectory(archive);
      expect(rootDir).toBe('my-skill');
    });

    it('returns null for ZIP with multiple root directories', () => {
      const archive = openZipArchive(multiRootZipPath);
      const rootDir = getZipRootDirectory(archive);
      expect(rootDir).toBeNull();
    });

    it('returns null for ZIP with files at root level', () => {
      const archive = openZipArchive(noRootZipPath);
      const rootDir = getZipRootDirectory(archive);
      expect(rootDir).toBeNull();
    });

    it('returns null for empty ZIP', () => {
      const archive = openZipArchive(emptyZipPath);
      const rootDir = getZipRootDirectory(archive);
      expect(rootDir).toBeNull();
    });
  });

  describe('getTotalUncompressedSize', () => {
    it('returns the total size of all files', () => {
      const archive = openZipArchive(validZipPath);
      const size = getTotalUncompressedSize(archive);

      // Calculate expected size from our test files
      const skillMdContent =
        '---\nname: my-skill\ndescription: A test skill\n---\n\n# My Skill\n\nTest content.';
      const helperPyContent = 'def helper(): pass';
      const readmeContent = '# My Skill\n\nReadme content.';
      const expectedSize = skillMdContent.length + helperPyContent.length + readmeContent.length;

      expect(size).toBe(expectedSize);
    });

    it('returns 0 for empty ZIP', () => {
      const archive = openZipArchive(emptyZipPath);
      const size = getTotalUncompressedSize(archive);
      expect(size).toBe(0);
    });
  });

  describe('readEntryAsText', () => {
    it('reads entry content as text', () => {
      const archive = openZipArchive(validZipPath);
      const content = readEntryAsText(archive, 'my-skill/SKILL.md');

      expect(content).not.toBeNull();
      expect(content).toContain('name: my-skill');
      expect(content).toContain('description: A test skill');
    });

    it('returns null for non-existent entry', () => {
      const archive = openZipArchive(validZipPath);
      const content = readEntryAsText(archive, 'non-existent/file.txt');
      expect(content).toBeNull();
    });

    it('reads nested file content', () => {
      const archive = openZipArchive(validZipPath);
      const content = readEntryAsText(archive, 'my-skill/scripts/helper.py');

      expect(content).not.toBeNull();
      expect(content).toBe('def helper(): pass');
    });
  });
});

describe('Install Types', () => {
  it('can create valid InstallOptions', () => {
    // Import types statically to verify they compile
    const options: import('../../../src/types/install').InstallOptions = {
      scope: 'project',
      force: true,
      dryRun: false,
      quiet: false,
    };

    expect(options.scope).toBe('project');
    expect(options.force).toBe(true);
  });

  it('can create valid InstallResult', () => {
    const result: import('../../../src/types/install').InstallResult = {
      type: 'install-result',
      success: true,
      skillPath: '/path/to/skill',
      skillName: 'my-skill',
      fileCount: 3,
      size: 1024,
      wasOverwritten: false,
      errors: [],
    };

    expect(result.success).toBe(true);
    expect(result.skillName).toBe('my-skill');
    expect(result.type).toBe('install-result');
  });

  it('can create valid ExtractedFileInfo', () => {
    const fileInfo: import('../../../src/types/install').ExtractedFileInfo = {
      path: 'scripts/helper.py',
      size: 256,
      isDirectory: false,
    };

    expect(fileInfo.path).toBe('scripts/helper.py');
    expect(fileInfo.isDirectory).toBe(false);
  });

  it('can create valid DryRunPreview', () => {
    const preview: import('../../../src/types/install').DryRunPreview = {
      type: 'dry-run-preview',
      skillName: 'my-skill',
      targetPath: '/path/to/target',
      files: [{ path: 'SKILL.md', size: 100, isDirectory: false }],
      totalSize: 100,
      wouldOverwrite: false,
      conflicts: [],
    };

    expect(preview.skillName).toBe('my-skill');
    expect(preview.files).toHaveLength(1);
    expect(preview.type).toBe('dry-run-preview');
  });
});
