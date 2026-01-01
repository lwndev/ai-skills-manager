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
  detectNestedSkillFiles,
  detectExternalUrls,
  detectWindowsPaths,
  analyzePackageWarnings,
  PACKAGE_SIZE_THRESHOLDS,
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

  describe('detectNestedSkillFiles', () => {
    it('detects nested .skill files in package', async () => {
      const nestedPath = path.join(tempDir, 'nested-skill.skill');
      const nestedZip = new AdmZip();
      nestedZip.addFile(
        'my-skill/SKILL.md',
        Buffer.from('---\nname: my-skill\ndescription: Test\n---\n')
      );
      nestedZip.addFile('my-skill/nested.skill', Buffer.from('nested package content'));
      nestedZip.addFile('my-skill/deps/other.skill', Buffer.from('another nested'));
      nestedZip.writeZip(nestedPath);

      const archive = openZipArchive(nestedPath);
      const nested = detectNestedSkillFiles(archive);

      expect(nested).toHaveLength(2);
      expect(nested).toContain('my-skill/nested.skill');
      expect(nested).toContain('my-skill/deps/other.skill');
    });

    it('returns empty array when no nested .skill files', () => {
      const archive = openZipArchive(validSkillPath);
      const nested = detectNestedSkillFiles(archive);

      expect(nested).toHaveLength(0);
    });
  });

  describe('detectExternalUrls', () => {
    it('detects HTTP and HTTPS URLs', () => {
      const content = `
        Check out https://example.com/page
        Also see http://api.example.org/endpoint
        And https://docs.claude.com/en/docs/skills
      `;
      const urls = detectExternalUrls(content);

      expect(urls).toHaveLength(3);
      expect(urls).toContain('https://example.com/page');
      expect(urls).toContain('http://api.example.org/endpoint');
      expect(urls).toContain('https://docs.claude.com/en/docs/skills');
    });

    it('removes duplicate URLs', () => {
      const content = `
        Visit https://example.com for info
        See https://example.com for more
      `;
      const urls = detectExternalUrls(content);

      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe('https://example.com');
    });

    it('cleans trailing punctuation from URLs', () => {
      const content = `
        Check https://example.com/page,
        Also https://example.com/docs.
        And (https://example.com/test)
      `;
      const urls = detectExternalUrls(content);

      expect(urls).toContain('https://example.com/page');
      expect(urls).toContain('https://example.com/docs');
      expect(urls).toContain('https://example.com/test');
    });

    it('returns empty array when no URLs found', () => {
      const content = 'No URLs in this content at all.';
      const urls = detectExternalUrls(content);

      expect(urls).toHaveLength(0);
    });
  });

  describe('detectWindowsPaths', () => {
    it('detects Windows drive letter paths', () => {
      const content = `
        Use the file at C:\\Users\\Admin\\Documents\\script.py
        Or D:\\Projects\\skills\\helper.bat
      `;
      const paths = detectWindowsPaths(content);

      expect(paths.length).toBeGreaterThan(0);
      expect(paths.some((p) => p.includes('C:\\'))).toBe(true);
      expect(paths.some((p) => p.includes('D:\\'))).toBe(true);
    });

    it('detects relative Windows paths', () => {
      const content = `
        Run scripts\\helper.py to get started
      `;
      const paths = detectWindowsPaths(content);

      expect(paths.length).toBeGreaterThan(0);
      expect(paths.some((p) => p.includes('scripts\\helper.py'))).toBe(true);
    });

    it('detects UNC paths', () => {
      const content = `
        Access the share at \\\\server\\share\\file.txt
      `;
      const paths = detectWindowsPaths(content);

      expect(paths.length).toBeGreaterThan(0);
      expect(paths.some((p) => p.includes('\\\\server'))).toBe(true);
    });

    it('returns empty array when no Windows paths found', () => {
      const content = 'Use ./scripts/helper.py on Unix systems.';
      const paths = detectWindowsPaths(content);

      expect(paths).toHaveLength(0);
    });
  });

  describe('analyzePackageWarnings', () => {
    it('detects nested .skill files', async () => {
      const nestedPath = path.join(tempDir, 'analyze-nested.skill');
      const nestedZip = new AdmZip();
      nestedZip.addFile(
        'my-skill/SKILL.md',
        Buffer.from('---\nname: my-skill\ndescription: Test\n---\n\n# Test')
      );
      nestedZip.addFile('my-skill/embedded.skill', Buffer.from('nested'));
      nestedZip.writeZip(nestedPath);

      const archive = openZipArchive(nestedPath);
      const warnings = analyzePackageWarnings(archive);

      expect(warnings.nestedSkillFiles).toHaveLength(1);
      expect(warnings.nestedSkillFiles[0]).toBe('my-skill/embedded.skill');
    });

    it('detects external URLs in SKILL.md', async () => {
      const urlPath = path.join(tempDir, 'url-skill.skill');
      const urlZip = new AdmZip();
      urlZip.addFile(
        'url-skill/SKILL.md',
        Buffer.from(
          '---\nname: url-skill\ndescription: Test\n---\n\n# Test\n\nSee https://external.com/docs'
        )
      );
      urlZip.writeZip(urlPath);

      const archive = openZipArchive(urlPath);
      const warnings = analyzePackageWarnings(archive);

      expect(warnings.externalUrls.length).toBeGreaterThan(0);
      expect(warnings.externalUrls).toContain('https://external.com/docs');
    });

    it('detects Windows paths in SKILL.md', async () => {
      const winPath = path.join(tempDir, 'win-skill.skill');
      const winZip = new AdmZip();
      winZip.addFile(
        'win-skill/SKILL.md',
        Buffer.from(
          '---\nname: win-skill\ndescription: Test\n---\n\n# Test\n\nRun scripts\\helper.bat'
        )
      );
      winZip.writeZip(winPath);

      const archive = openZipArchive(winPath);
      const warnings = analyzePackageWarnings(archive);

      expect(warnings.windowsPaths.length).toBeGreaterThan(0);
    });

    it('calculates package size correctly', () => {
      const archive = openZipArchive(validSkillPath);
      const warnings = analyzePackageWarnings(archive);

      expect(warnings.totalSize).toBeGreaterThan(0);
      expect(warnings.isLargePackage).toBe(false);
      expect(warnings.isVeryLargePackage).toBe(false);
    });

    it('identifies large packages correctly', async () => {
      // Create a large package (just above 5MB threshold)
      const largePath = path.join(tempDir, 'large-skill.skill');
      const largeZip = new AdmZip();
      largeZip.addFile(
        'large-skill/SKILL.md',
        Buffer.from('---\nname: large-skill\ndescription: Test\n---\n')
      );
      // Add a buffer that's just over 5MB
      const largeBuffer = Buffer.alloc(PACKAGE_SIZE_THRESHOLDS.LARGE + 1024, 'x');
      largeZip.addFile('large-skill/data.bin', largeBuffer);
      largeZip.writeZip(largePath);

      const archive = openZipArchive(largePath);
      const warnings = analyzePackageWarnings(archive);

      expect(warnings.isLargePackage).toBe(true);
      expect(warnings.isVeryLargePackage).toBe(false);
    });
  });

  describe('PACKAGE_SIZE_THRESHOLDS', () => {
    it('defines correct threshold values', () => {
      expect(PACKAGE_SIZE_THRESHOLDS.LARGE).toBe(5 * 1024 * 1024);
      expect(PACKAGE_SIZE_THRESHOLDS.VERY_LARGE).toBe(50 * 1024 * 1024);
    });
  });
});
