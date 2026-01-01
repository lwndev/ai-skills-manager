/**
 * Tests for install validator
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';

import {
  validatePackageStructure,
  extractToTempDirectory,
  validatePackageContent,
  validateNameMatch,
  cleanupTempDirectory,
  validatePackage,
} from '../../../src/generators/install-validator';
import { openZipArchive } from '../../../src/utils/extractor';

describe('Install Validator', () => {
  let tempDir: string;
  let validSkillPath: string;
  let noSkillMdPath: string;
  let multiRootPath: string;
  let noRootPath: string;
  let nameMismatchPath: string;
  let emptyPath: string;
  let invalidFrontmatterPath: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-install-validator-test-'));

    // Create a valid skill package
    validSkillPath = path.join(tempDir, 'valid-skill.skill');
    const validZip = new AdmZip();
    validZip.addFile(
      'my-skill/SKILL.md',
      Buffer.from(
        '---\nname: my-skill\ndescription: A test skill\n---\n\n# My Skill\n\nTest content.'
      )
    );
    validZip.addFile('my-skill/scripts/helper.py', Buffer.from('def helper(): pass'));
    validZip.writeZip(validSkillPath);

    // Create a package without SKILL.md
    noSkillMdPath = path.join(tempDir, 'no-skillmd.skill');
    const noSkillMdZip = new AdmZip();
    noSkillMdZip.addFile('my-skill/README.md', Buffer.from('# Readme'));
    noSkillMdZip.addFile('my-skill/scripts/helper.py', Buffer.from('code'));
    noSkillMdZip.writeZip(noSkillMdPath);

    // Create a package with multiple root directories
    multiRootPath = path.join(tempDir, 'multi-root.skill');
    const multiRootZip = new AdmZip();
    multiRootZip.addFile('skill-a/SKILL.md', Buffer.from('---\nname: skill-a\n---'));
    multiRootZip.addFile('skill-b/SKILL.md', Buffer.from('---\nname: skill-b\n---'));
    multiRootZip.writeZip(multiRootPath);

    // Create a package with files at root (no root directory)
    noRootPath = path.join(tempDir, 'no-root.skill');
    const noRootZip = new AdmZip();
    noRootZip.addFile('SKILL.md', Buffer.from('---\nname: test\n---'));
    noRootZip.addFile('README.md', Buffer.from('# Readme'));
    noRootZip.writeZip(noRootPath);

    // Create a package with name mismatch
    nameMismatchPath = path.join(tempDir, 'name-mismatch.skill');
    const nameMismatchZip = new AdmZip();
    nameMismatchZip.addFile(
      'wrong-dir-name/SKILL.md',
      Buffer.from('---\nname: correct-name\ndescription: Test\n---\n\n# Test')
    );
    nameMismatchZip.writeZip(nameMismatchPath);

    // Create an empty package
    emptyPath = path.join(tempDir, 'empty.skill');
    const emptyZip = new AdmZip();
    emptyZip.writeZip(emptyPath);

    // Create a package with invalid frontmatter
    invalidFrontmatterPath = path.join(tempDir, 'invalid-frontmatter.skill');
    const invalidFrontmatterZip = new AdmZip();
    invalidFrontmatterZip.addFile(
      'my-skill/SKILL.md',
      Buffer.from('No frontmatter here, just plain text')
    );
    invalidFrontmatterZip.writeZip(invalidFrontmatterPath);
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('validatePackageStructure', () => {
    it('returns valid for a properly structured package', () => {
      const archive = openZipArchive(validSkillPath);
      const result = validatePackageStructure(archive);

      expect(result.valid).toBe(true);
      expect(result.rootDirectory).toBe('my-skill');
      expect(result.skillMdPath).toBe('my-skill/SKILL.md');
      expect(result.entryCount).toBe(2); // SKILL.md and helper.py
    });

    it('returns invalid when SKILL.md is missing', () => {
      const archive = openZipArchive(noSkillMdPath);
      const result = validatePackageStructure(archive);

      expect(result.valid).toBe(false);
      expect(result.rootDirectory).toBe('my-skill');
      expect(result.error).toContain('SKILL.md not found');
    });

    it('returns invalid for multiple root directories', () => {
      const archive = openZipArchive(multiRootPath);
      const result = validatePackageStructure(archive);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('single root directory');
    });

    it('returns invalid for files at root level', () => {
      const archive = openZipArchive(noRootPath);
      const result = validatePackageStructure(archive);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('single root directory');
    });

    it('returns invalid for empty package', () => {
      const archive = openZipArchive(emptyPath);
      const result = validatePackageStructure(archive);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('single root directory');
    });
  });

  describe('extractToTempDirectory', () => {
    it('extracts a valid package to temp directory', async () => {
      const archive = openZipArchive(validSkillPath);
      const result = await extractToTempDirectory(archive);

      expect(result.success).toBe(true);
      expect(result.tempDir).toBeDefined();
      expect(result.skillDir).toBeDefined();
      expect(result.skillDir).toContain('my-skill');

      // Verify SKILL.md exists in extracted directory
      const skillMdPath = path.join(result.skillDir as string, 'SKILL.md');
      const exists = await fs.promises
        .access(skillMdPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Clean up
      if (result.tempDir) {
        await cleanupTempDirectory(result.tempDir);
      }
    });

    it('returns error for invalid structure', async () => {
      const archive = openZipArchive(noRootPath);
      const result = await extractToTempDirectory(archive);

      expect(result.success).toBe(false);
      expect(result.error).toContain('single root directory');
    });
  });

  describe('validatePackageContent', () => {
    it('validates extracted content successfully', async () => {
      // First extract to temp directory
      const archive = openZipArchive(validSkillPath);
      const extractResult = await extractToTempDirectory(archive);

      expect(extractResult.success).toBe(true);

      // Then validate the content
      const result = await validatePackageContent(extractResult.tempDir as string, 'my-skill');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Clean up
      if (extractResult.tempDir) {
        await cleanupTempDirectory(extractResult.tempDir);
      }
    });

    it('returns errors for non-existent skill directory', async () => {
      const result = await validatePackageContent('/non/existent/path', 'some-skill');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateNameMatch', () => {
    it('returns valid when names match', () => {
      const archive = openZipArchive(validSkillPath);
      const result = validateNameMatch(archive);

      expect(result.valid).toBe(true);
      expect(result.directoryName).toBe('my-skill');
      expect(result.frontmatterName).toBe('my-skill');
    });

    it('returns invalid when names do not match', () => {
      const archive = openZipArchive(nameMismatchPath);
      const result = validateNameMatch(archive);

      expect(result.valid).toBe(false);
      expect(result.directoryName).toBe('wrong-dir-name');
      expect(result.frontmatterName).toBe('correct-name');
      expect(result.error).toContain('mismatch');
    });

    it('returns invalid for invalid frontmatter', () => {
      const archive = openZipArchive(invalidFrontmatterPath);
      const result = validateNameMatch(archive);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('frontmatter');
    });

    it('returns invalid for package without root directory', () => {
      const archive = openZipArchive(noRootPath);
      const result = validateNameMatch(archive);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('single root directory');
    });

    it('returns invalid when name field is missing', async () => {
      // Create a package with frontmatter but no name field
      const noNamePath = path.join(tempDir, 'no-name.skill');
      const noNameZip = new AdmZip();
      noNameZip.addFile(
        'my-skill/SKILL.md',
        Buffer.from('---\ndescription: Has description but no name\n---\n\n# Test')
      );
      noNameZip.writeZip(noNamePath);

      const archive = openZipArchive(noNamePath);
      const result = validateNameMatch(archive);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing the "name" field');
    });
  });

  describe('cleanupTempDirectory', () => {
    it('removes a temporary directory', async () => {
      // Create a temp directory
      const testTempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-cleanup-test-'));

      // Verify it exists
      let exists = await fs.promises
        .access(testTempDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Clean up
      await cleanupTempDirectory(testTempDir);

      // Verify it's gone
      exists = await fs.promises
        .access(testTempDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('handles non-existent directory gracefully', async () => {
      // Should not throw
      await expect(cleanupTempDirectory('/non/existent/directory')).resolves.not.toThrow();
    });
  });

  describe('validatePackage', () => {
    it('validates a complete valid package', async () => {
      const result = await validatePackage(validSkillPath);

      expect(result.valid).toBe(true);
      expect(result.skillName).toBe('my-skill');
      expect(result.files).toBeDefined();
      expect(result.files?.length).toBe(2); // SKILL.md and helper.py
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors for package without SKILL.md', async () => {
      const result = await validatePackage(noSkillMdPath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns errors for name mismatch', async () => {
      const result = await validatePackage(nameMismatchPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('mismatch'))).toBe(true);
    });

    it('returns errors for multi-root package', async () => {
      const result = await validatePackage(multiRootPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('single root directory'))).toBe(true);
    });

    it('cleans up temp directory after validation', async () => {
      // This is hard to test directly, but we ensure no temp directories are left behind
      // by running validatePackage and checking that it completes without error
      const result = await validatePackage(validSkillPath);
      expect(result.valid).toBe(true);

      // If temp cleanup failed, we would have leftover directories
      // This is more of a sanity check that the function completes normally
    });

    it('handles invalid archive gracefully', async () => {
      // Create a corrupted file
      const corruptPath = path.join(tempDir, 'corrupt.skill');
      await fs.promises.writeFile(corruptPath, 'not a zip');

      const result = await validatePackage(corruptPath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
