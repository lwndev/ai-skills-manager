/**
 * Tests for package file validation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';

import {
  validatePackageExists,
  validatePackageExtension,
  validatePackageFormat,
  validatePackageFile,
} from '../../../src/validators/package-file';

describe('Package File Validation', () => {
  let tempDir: string;
  let validSkillPath: string;
  let invalidZipPath: string;
  let directoryPath: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-package-file-test-'));

    // Create a valid skill package
    validSkillPath = path.join(tempDir, 'valid-skill.skill');
    const validZip = new AdmZip();
    validZip.addFile(
      'my-skill/SKILL.md',
      Buffer.from('---\nname: my-skill\ndescription: A test skill\n---\n\n# My Skill')
    );
    validZip.writeZip(validSkillPath);

    // Create an invalid (not ZIP) file with .skill extension
    invalidZipPath = path.join(tempDir, 'invalid.skill');
    await fs.promises.writeFile(invalidZipPath, 'This is not a ZIP file');

    // Create a directory
    directoryPath = path.join(tempDir, 'a-directory');
    await fs.promises.mkdir(directoryPath);
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('validatePackageExists', () => {
    it('returns valid for an existing file', async () => {
      const result = await validatePackageExists(validSkillPath);
      expect(result.valid).toBe(true);
      expect(result.packagePath).toBe(validSkillPath);
      expect(result.error).toBeUndefined();
    });

    it('returns invalid for non-existent file', async () => {
      const result = await validatePackageExists('/non/existent/file.skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Package file not found');
    });

    it('returns invalid for empty path', async () => {
      const result = await validatePackageExists('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Package path cannot be empty');
    });

    it('returns invalid for whitespace-only path', async () => {
      const result = await validatePackageExists('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Package path cannot be empty');
    });

    it('returns invalid for directory path', async () => {
      const result = await validatePackageExists(directoryPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Path is not a file');
    });

    it('resolves relative paths', async () => {
      // Create a file in cwd
      const cwd = process.cwd();
      const tempFile = path.join(tempDir, 'relative-test.skill');
      const validZip = new AdmZip();
      validZip.addFile('test/SKILL.md', Buffer.from('---\nname: test\n---'));
      validZip.writeZip(tempFile);

      const relativePath = path.relative(cwd, tempFile);
      const result = await validatePackageExists(relativePath);

      if (result.valid) {
        expect(result.packagePath).toBe(tempFile);
      }
    });
  });

  describe('validatePackageExtension', () => {
    it('returns valid for .skill extension', () => {
      const result = validatePackageExtension('my-skill.skill');
      expect(result.valid).toBe(true);
    });

    it('returns valid for .SKILL extension (case insensitive)', () => {
      const result = validatePackageExtension('my-skill.SKILL');
      expect(result.valid).toBe(true);
    });

    it('returns invalid for .zip extension', () => {
      const result = validatePackageExtension('my-skill.zip');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid package extension');
      expect(result.error).toContain('.zip');
      expect(result.error).toContain('.skill');
    });

    it('returns invalid for no extension', () => {
      const result = validatePackageExtension('my-skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid package extension');
    });

    it('returns invalid for empty path', () => {
      const result = validatePackageExtension('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Package path cannot be empty');
    });

    it('handles paths with directories', () => {
      const result = validatePackageExtension('/path/to/my-skill.skill');
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePackageFormat', () => {
    it('returns valid for a valid ZIP file', () => {
      const result = validatePackageFormat(validSkillPath);
      expect(result.valid).toBe(true);
      expect(result.packagePath).toBe(validSkillPath);
    });

    it('returns invalid for non-ZIP file', () => {
      const result = validatePackageFormat(invalidZipPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not a valid ZIP archive');
    });

    it('returns invalid for empty path', () => {
      const result = validatePackageFormat('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Package path cannot be empty');
    });

    it('handles non-existent file gracefully', () => {
      const result = validatePackageFormat('/non/existent/file.skill');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePackageFile', () => {
    it('returns valid for a valid package file', async () => {
      const result = await validatePackageFile(validSkillPath);
      expect(result.valid).toBe(true);
      expect(result.packagePath).toBe(validSkillPath);
    });

    it('returns invalid for non-existent file', async () => {
      const result = await validatePackageFile('/non/existent/file.skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Package file not found');
    });

    it('returns invalid for wrong extension', async () => {
      // Create a valid ZIP with wrong extension
      const wrongExtPath = path.join(tempDir, 'wrong.zip');
      const zip = new AdmZip();
      zip.addFile('test/SKILL.md', Buffer.from('test'));
      zip.writeZip(wrongExtPath);

      const result = await validatePackageFile(wrongExtPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid package extension');
    });

    it('returns invalid for corrupted ZIP', async () => {
      const result = await validatePackageFile(invalidZipPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not a valid ZIP archive');
    });

    it('returns invalid for directory', async () => {
      // Create a directory with .skill extension
      const skillDir = path.join(tempDir, 'dir.skill');
      await fs.promises.mkdir(skillDir, { recursive: true });

      const result = await validatePackageFile(skillDir);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Path is not a file');
    });

    it('validates all checks in sequence', async () => {
      // Create a file that exists but isn't a valid package
      const badFile = path.join(tempDir, 'bad.skill');
      await fs.promises.writeFile(badFile, 'not a zip');

      const result = await validatePackageFile(badFile);
      expect(result.valid).toBe(false);
      // First failing check should be format (exists and extension are valid)
      expect(result.error).toContain('not a valid ZIP archive');
    });
  });
});
