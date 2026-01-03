/**
 * Tests for pre-removal validation module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  validateBeforeRemoval,
  detectUnexpectedFiles,
} from '../../../src/generators/pre-removal-validator';

describe('Pre-Removal Validator', () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-prereq-test-'));

    // Create a valid skill
    const validSkillDir = path.join(tempDir, 'valid-skill');
    await fs.promises.mkdir(validSkillDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(validSkillDir, 'SKILL.md'),
      '---\nname: valid-skill\ndescription: A valid test skill\n---\n\n# Valid Skill\n\nThis is a valid skill.'
    );

    // Create an invalid skill (missing required fields)
    const invalidSkillDir = path.join(tempDir, 'invalid-skill');
    await fs.promises.mkdir(invalidSkillDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(invalidSkillDir, 'SKILL.md'),
      '---\nname: invalid-skill\n---\n\n# Invalid Skill\n\nMissing description.'
    );

    // Create a skill with .git directory
    const gitSkillDir = path.join(tempDir, 'git-skill');
    await fs.promises.mkdir(gitSkillDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(gitSkillDir, 'SKILL.md'),
      '---\nname: git-skill\ndescription: Has git dir\n---\n'
    );
    await fs.promises.mkdir(path.join(gitSkillDir, '.git'), { recursive: true });
    await fs.promises.writeFile(path.join(gitSkillDir, '.git', 'config'), 'git config');

    // Create a skill with node_modules
    const nodeModulesSkillDir = path.join(tempDir, 'node-modules-skill');
    await fs.promises.mkdir(nodeModulesSkillDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(nodeModulesSkillDir, 'SKILL.md'),
      '---\nname: node-modules-skill\ndescription: Has node_modules\n---\n'
    );
    await fs.promises.mkdir(path.join(nodeModulesSkillDir, 'node_modules'), { recursive: true });
    await fs.promises.writeFile(
      path.join(nodeModulesSkillDir, 'node_modules', 'package.json'),
      '{}'
    );

    // Create a skill with temp files
    const tempFilesSkillDir = path.join(tempDir, 'temp-files-skill');
    await fs.promises.mkdir(tempFilesSkillDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(tempFilesSkillDir, 'SKILL.md'),
      '---\nname: temp-files-skill\ndescription: Has temp files\n---\n'
    );
    await fs.promises.writeFile(path.join(tempFilesSkillDir, '.DS_Store'), 'store');
    await fs.promises.writeFile(path.join(tempFilesSkillDir, 'file.swp'), 'swap');
    await fs.promises.writeFile(path.join(tempFilesSkillDir, 'backup~'), 'backup');

    // Create a clean skill for comparison
    const cleanSkillDir = path.join(tempDir, 'clean-skill');
    await fs.promises.mkdir(cleanSkillDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(cleanSkillDir, 'SKILL.md'),
      '---\nname: clean-skill\ndescription: A clean skill\n---\n\n# Clean Skill'
    );
    await fs.promises.writeFile(path.join(cleanSkillDir, 'helper.py'), 'def helper(): pass');
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('validateBeforeRemoval', () => {
    it('returns valid: true for a valid skill', async () => {
      const result = await validateBeforeRemoval(path.join(tempDir, 'valid-skill'));

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.skillName).toBe('valid-skill');
    });

    it('returns valid: false with warnings for invalid skill', async () => {
      const result = await validateBeforeRemoval(path.join(tempDir, 'invalid-skill'));

      expect(result.valid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      // Should contain validation warning about missing description
      expect(result.warnings.some((w) => w.toLowerCase().includes('description'))).toBe(true);
    });

    it('handles non-existent skill gracefully', async () => {
      const result = await validateBeforeRemoval(path.join(tempDir, 'nonexistent'));

      expect(result.valid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('returns the skill name from SKILL.md', async () => {
      const result = await validateBeforeRemoval(path.join(tempDir, 'valid-skill'));

      expect(result.skillName).toBe('valid-skill');
    });
  });

  describe('detectUnexpectedFiles', () => {
    it('returns "none" for clean skill', async () => {
      const result = await detectUnexpectedFiles(path.join(tempDir, 'clean-skill'));

      expect(result.type).toBe('none');
    });

    it('detects .git directory', async () => {
      const result = await detectUnexpectedFiles(path.join(tempDir, 'git-skill'));

      expect(result.type).toBe('found');
      if (result.type === 'found') {
        expect(result.detected.some((d) => d.type === 'git-directory')).toBe(true);
        expect(result.warnings.some((w) => w.includes('.git'))).toBe(true);
        expect(result.requiresForce).toBe(true);
      }
    });

    it('detects node_modules directory', async () => {
      const result = await detectUnexpectedFiles(path.join(tempDir, 'node-modules-skill'));

      expect(result.type).toBe('found');
      if (result.type === 'found') {
        expect(result.detected.some((d) => d.type === 'node-modules')).toBe(true);
        expect(result.warnings.some((w) => w.includes('node_modules'))).toBe(true);
        expect(result.requiresForce).toBe(true);
      }
    });

    it('detects temporary files', async () => {
      const result = await detectUnexpectedFiles(path.join(tempDir, 'temp-files-skill'));

      expect(result.type).toBe('found');
      if (result.type === 'found') {
        expect(result.detected.filter((d) => d.type === 'temp-file').length).toBeGreaterThan(0);
        expect(result.warnings.some((w) => w.includes('temporary'))).toBe(true);
        expect(result.requiresForce).toBe(true);
      }
    });

    it('limits detected items to avoid overwhelming output', async () => {
      // Create a skill with many temp files
      const manyTempDir = path.join(tempDir, 'many-temp-skill');
      await fs.promises.mkdir(manyTempDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(manyTempDir, 'SKILL.md'),
        '---\nname: many-temp\ndescription: Many temps\n---\n'
      );

      // Create 10 temp files
      for (let i = 0; i < 10; i++) {
        await fs.promises.writeFile(path.join(manyTempDir, `file${i}.swp`), 'swap');
      }

      const result = await detectUnexpectedFiles(manyTempDir);

      expect(result.type).toBe('found');
      if (result.type === 'found') {
        // Should only record first 5 temp files
        const tempFiles = result.detected.filter((d) => d.type === 'temp-file');
        expect(tempFiles.length).toBeLessThanOrEqual(5);
      }
    });

    it('handles non-existent directory gracefully', async () => {
      const result = await detectUnexpectedFiles(path.join(tempDir, 'nonexistent'));

      // Should return "none" since no files were found
      expect(result.type).toBe('none');
    });
  });

  describe('large binary detection', () => {
    it('detects large binary files (>10 MB)', async () => {
      // Create a skill with a large file
      const largeFileSkillDir = path.join(tempDir, 'large-file-skill');
      await fs.promises.mkdir(largeFileSkillDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(largeFileSkillDir, 'SKILL.md'),
        '---\nname: large-file-skill\ndescription: Has large file\n---\n'
      );

      // Create a file larger than 10 MB
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'x');
      await fs.promises.writeFile(path.join(largeFileSkillDir, 'large.bin'), largeBuffer);

      const result = await detectUnexpectedFiles(largeFileSkillDir);

      expect(result.type).toBe('found');
      if (result.type === 'found') {
        expect(result.detected.some((d) => d.type === 'large-binary')).toBe(true);
        expect(result.detected.find((d) => d.type === 'large-binary')?.size).toBeGreaterThan(
          10 * 1024 * 1024
        );
        expect(result.warnings.some((w) => w.includes('10 MB'))).toBe(true);
      }
    });
  });

  describe('multiple unexpected file types', () => {
    it('detects multiple types of unexpected files', async () => {
      // Create a skill with both .git and node_modules
      const multipleIssuesDir = path.join(tempDir, 'multiple-issues-skill');
      await fs.promises.mkdir(multipleIssuesDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(multipleIssuesDir, 'SKILL.md'),
        '---\nname: multiple-issues\ndescription: Multiple issues\n---\n'
      );
      await fs.promises.mkdir(path.join(multipleIssuesDir, '.git'), { recursive: true });
      await fs.promises.mkdir(path.join(multipleIssuesDir, 'node_modules'), { recursive: true });
      await fs.promises.writeFile(path.join(multipleIssuesDir, '.DS_Store'), 'store');

      const result = await detectUnexpectedFiles(multipleIssuesDir);

      expect(result.type).toBe('found');
      if (result.type === 'found') {
        expect(result.detected.some((d) => d.type === 'git-directory')).toBe(true);
        expect(result.detected.some((d) => d.type === 'node-modules')).toBe(true);
        expect(result.detected.some((d) => d.type === 'temp-file')).toBe(true);
        expect(result.warnings.length).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
