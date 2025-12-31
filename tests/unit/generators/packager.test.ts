import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  generatePackage,
  resolveOutputPath,
  checkForOverwrite,
  calculatePackageSize,
  getPackageName,
} from '../../../src/generators/packager';
import { PathValidationError, ValidationFailedError } from '../../../src/utils/errors';

describe('packager', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'packager-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a valid skill directory
   */
  async function createValidSkill(dirName: string = 'test-skill'): Promise<string> {
    const skillDir = path.join(tempDir, dirName);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      `---
name: ${dirName}
description: A test skill for packaging
---

# ${dirName}

This is a test skill.
`
    );
    return skillDir;
  }

  /**
   * Helper to create a skill with additional files
   */
  async function createSkillWithFiles(dirName: string = 'multi-file-skill'): Promise<string> {
    const skillDir = await createValidSkill(dirName);

    // Add some additional files
    await fs.writeFile(path.join(skillDir, 'README.md'), '# Readme\n\nAdditional docs.');
    await fs.mkdir(path.join(skillDir, 'templates'));
    await fs.writeFile(path.join(skillDir, 'templates', 'example.txt'), 'Template content');

    return skillDir;
  }

  /**
   * Helper to create a skill with files that should be excluded
   */
  async function createSkillWithExcludedFiles(
    dirName: string = 'skill-with-excluded'
  ): Promise<string> {
    const skillDir = await createSkillWithFiles(dirName);

    // Add files that should be excluded
    await fs.mkdir(path.join(skillDir, '.git'));
    await fs.writeFile(path.join(skillDir, '.git', 'config'), 'git config');
    await fs.mkdir(path.join(skillDir, 'node_modules'));
    await fs.writeFile(path.join(skillDir, 'node_modules', 'pkg.json'), '{}');
    await fs.writeFile(path.join(skillDir, '.DS_Store'), 'macos junk');
    await fs.writeFile(path.join(skillDir, 'debug.log'), 'log content');
    await fs.mkdir(path.join(skillDir, '__pycache__'));
    await fs.writeFile(path.join(skillDir, '__pycache__', 'cache.pyc'), 'python cache');

    return skillDir;
  }

  /**
   * Helper to create an invalid skill
   */
  async function createInvalidSkill(dirName: string = 'invalid-skill'): Promise<string> {
    const skillDir = path.join(tempDir, dirName);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      `---
name: Invalid Name With Spaces
description: Has <invalid> characters
unknown-field: should not exist
---

# Invalid Skill
`
    );
    return skillDir;
  }

  describe('resolveOutputPath', () => {
    it('uses current working directory when outputDir is undefined', () => {
      const result = resolveOutputPath(undefined, 'my-skill');
      expect(result).toBe(path.join(process.cwd(), 'my-skill.skill'));
    });

    it('uses provided output directory', () => {
      const result = resolveOutputPath('/tmp/packages', 'my-skill');
      expect(result).toBe('/tmp/packages/my-skill.skill');
    });

    it('resolves relative output directory to absolute path', () => {
      const result = resolveOutputPath('./dist', 'my-skill');
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain('dist');
      expect(result).toContain('my-skill.skill');
    });

    it('adds .skill extension to package name', () => {
      const result = resolveOutputPath('/tmp', 'test-skill');
      expect(result).toBe('/tmp/test-skill.skill');
    });
  });

  describe('checkForOverwrite', () => {
    it('returns exists: false when file does not exist', async () => {
      const packagePath = path.join(tempDir, 'nonexistent.skill');
      const result = await checkForOverwrite(packagePath);
      expect(result.exists).toBe(false);
      expect(result.packagePath).toBe(packagePath);
    });

    it('returns exists: true when file exists', async () => {
      const packagePath = path.join(tempDir, 'existing.skill');
      await fs.writeFile(packagePath, 'existing content');

      const result = await checkForOverwrite(packagePath);
      expect(result.exists).toBe(true);
      expect(result.packagePath).toBe(packagePath);
    });
  });

  describe('calculatePackageSize', () => {
    it('formats bytes correctly', () => {
      expect(calculatePackageSize(500)).toBe('500 B');
    });

    it('formats kilobytes correctly', () => {
      expect(calculatePackageSize(1024)).toBe('1.0 KB');
      expect(calculatePackageSize(2048)).toBe('2.0 KB');
      expect(calculatePackageSize(1536)).toBe('1.5 KB');
    });

    it('formats megabytes correctly', () => {
      expect(calculatePackageSize(1024 * 1024)).toBe('1.0 MB');
      expect(calculatePackageSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
  });

  describe('getPackageName', () => {
    it('extracts directory name from path', () => {
      expect(getPackageName('/path/to/my-skill')).toBe('my-skill');
    });

    it('handles relative paths', () => {
      expect(getPackageName('./skills/test-skill')).toBe('test-skill');
    });

    it('handles trailing slashes', () => {
      expect(getPackageName('/path/to/skill/')).toBe('skill');
    });
  });

  describe('generatePackage', () => {
    describe('validation', () => {
      it('throws PathValidationError for non-existent path', async () => {
        await expect(generatePackage('/nonexistent/path')).rejects.toThrow(PathValidationError);
      });

      it('throws PathValidationError for empty path', async () => {
        await expect(generatePackage('')).rejects.toThrow(PathValidationError);
      });

      it('throws PathValidationError for directory without SKILL.md', async () => {
        const emptyDir = path.join(tempDir, 'empty-dir');
        await fs.mkdir(emptyDir);

        await expect(generatePackage(emptyDir)).rejects.toThrow(PathValidationError);
      });

      it('throws ValidationFailedError for skill with invalid content', async () => {
        const skillDir = await createInvalidSkill();

        await expect(generatePackage(skillDir)).rejects.toThrow(ValidationFailedError);
      });

      it('includes validation errors in ValidationFailedError', async () => {
        const skillDir = await createInvalidSkill();

        try {
          await generatePackage(skillDir);
          fail('Expected ValidationFailedError');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationFailedError);
          const validationError = error as ValidationFailedError;
          expect(validationError.validationErrors.length).toBeGreaterThan(0);
        }
      });
    });

    describe('skip validation', () => {
      it('packages invalid skill when skipValidation is true', async () => {
        const skillDir = await createInvalidSkill('skip-valid-skill');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, {
          outputPath: outputDir,
          skipValidation: true,
        });

        expect(result.success).toBe(true);
        expect(result.packagePath).toContain('skip-valid-skill.skill');
      });
    });

    describe('successful packaging', () => {
      it('creates a .skill package for valid skill', async () => {
        const skillDir = await createValidSkill('valid-skill');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        expect(result.packagePath).toBe(path.join(outputDir, 'valid-skill.skill'));
        expect(result.fileCount).toBeGreaterThan(0);
        expect(result.size).toBeGreaterThan(0);
        expect(result.errors).toEqual([]);
      });

      it('package file is created on disk', async () => {
        const skillDir = await createValidSkill('disk-skill');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        const stats = await fs.stat(result.packagePath as string);
        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBe(result.size);
      });

      it('packages skill with multiple files', async () => {
        const skillDir = await createSkillWithFiles('multi-file');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        // Should have SKILL.md, README.md, and templates/example.txt
        expect(result.fileCount).toBe(3);
      });

      it('uses skill name from validation when available', async () => {
        const skillDir = await createValidSkill('named-skill');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.packagePath).toContain('named-skill.skill');
      });

      it('creates output directory if it does not exist', async () => {
        const skillDir = await createValidSkill('auto-dir-skill');
        const outputDir = path.join(tempDir, 'new', 'nested', 'output');

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        const stats = await fs.stat(outputDir);
        expect(stats.isDirectory()).toBe(true);
      });

      it('uses current directory when no output path specified', async () => {
        const skillDir = await createValidSkill('cwd-skill');
        const originalCwd = process.cwd();

        // Create output in temp dir
        const cwdDir = path.join(tempDir, 'cwd-test');
        await fs.mkdir(cwdDir);
        process.chdir(cwdDir);

        try {
          const result = await generatePackage(skillDir, { force: true });

          expect(result.success).toBe(true);
          // Use realpath to resolve symlinks (e.g., /var -> /private/var on macOS)
          const expectedPath = await fs.realpath(path.join(cwdDir, 'cwd-skill.skill'));
          expect(result.packagePath).toBe(expectedPath);
        } finally {
          process.chdir(originalCwd);
        }
      });
    });

    describe('file exclusion', () => {
      it('excludes .git directory', async () => {
        const skillDir = await createSkillWithExcludedFiles('excluded-git');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        // Should have SKILL.md, README.md, templates/example.txt but not .git or other excluded
        expect(result.fileCount).toBe(3);
      });

      it('excludes node_modules directory', async () => {
        const skillDir = await createSkillWithExcludedFiles('excluded-node');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        expect(result.fileCount).toBe(3);
      });

      it('excludes .DS_Store files', async () => {
        const skillDir = await createSkillWithExcludedFiles('excluded-ds');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        expect(result.fileCount).toBe(3);
      });

      it('excludes *.log files', async () => {
        const skillDir = await createSkillWithExcludedFiles('excluded-log');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        expect(result.fileCount).toBe(3);
      });

      it('excludes __pycache__ directory', async () => {
        const skillDir = await createSkillWithExcludedFiles('excluded-pycache');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        expect(result.fileCount).toBe(3);
      });
    });

    describe('overwrite handling', () => {
      it('returns requiresOverwrite when file exists and force is false', async () => {
        const skillDir = await createValidSkill('overwrite-skill');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        // Create existing package
        const existingPath = path.join(outputDir, 'overwrite-skill.skill');
        await fs.writeFile(existingPath, 'existing content');

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(false);
        expect(result.requiresOverwrite).toBe(true);
        expect(result.errors[0]).toContain('already exists');
      });

      it('overwrites existing file when force is true', async () => {
        const skillDir = await createValidSkill('force-skill');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        // Create existing package
        const existingPath = path.join(outputDir, 'force-skill.skill');
        await fs.writeFile(existingPath, 'old content');
        const oldSize = (await fs.stat(existingPath)).size;

        const result = await generatePackage(skillDir, {
          outputPath: outputDir,
          force: true,
        });

        expect(result.success).toBe(true);
        const newSize = (await fs.stat(existingPath)).size;
        expect(newSize).not.toBe(oldSize);
      });

      it('does not prompt when file does not exist', async () => {
        const skillDir = await createValidSkill('no-overwrite');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        expect(result.requiresOverwrite).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('handles skill with only SKILL.md (empty skill)', async () => {
        const skillDir = await createValidSkill('minimal-skill');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        expect(result.fileCount).toBe(1); // Just SKILL.md
      });

      it('handles path pointing to SKILL.md directly', async () => {
        const skillDir = await createValidSkill('direct-path-skill');
        const skillFilePath = path.join(skillDir, 'SKILL.md');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillFilePath, { outputPath: outputDir });

        expect(result.success).toBe(true);
        expect(result.packagePath).toContain('direct-path-skill.skill');
      });

      it('handles relative skill path', async () => {
        const skillDir = await createValidSkill('relative-skill');
        const cwd = process.cwd();
        const relativePath = path.relative(cwd, skillDir);
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(relativePath, { outputPath: outputDir });

        expect(result.success).toBe(true);
      });

      it('preserves file structure in package', async () => {
        const skillDir = await createSkillWithFiles('structure-skill');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        // SKILL.md, README.md, templates/example.txt
        expect(result.fileCount).toBe(3);
      });

      it('handles skill with nested directories', async () => {
        const skillDir = await createValidSkill('nested-skill');
        await fs.mkdir(path.join(skillDir, 'level1', 'level2', 'level3'), { recursive: true });
        await fs.writeFile(path.join(skillDir, 'level1', 'a.txt'), 'a');
        await fs.writeFile(path.join(skillDir, 'level1', 'level2', 'b.txt'), 'b');
        await fs.writeFile(path.join(skillDir, 'level1', 'level2', 'level3', 'c.txt'), 'c');

        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result.success).toBe(true);
        // SKILL.md + 3 nested files
        expect(result.fileCount).toBe(4);
      });
    });

    describe('result structure', () => {
      it('returns correct structure for successful package', async () => {
        const skillDir = await createValidSkill('result-skill');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result).toMatchObject({
          success: true,
          packagePath: expect.stringContaining('result-skill.skill'),
          fileCount: expect.any(Number),
          size: expect.any(Number),
          errors: [],
        });
        expect(result.fileCount).toBeGreaterThan(0);
        expect(result.size).toBeGreaterThan(0);
      });

      it('returns correct structure for overwrite needed', async () => {
        const skillDir = await createValidSkill('overwrite-result');
        const outputDir = path.join(tempDir, 'output');
        await fs.mkdir(outputDir);
        await fs.writeFile(path.join(outputDir, 'overwrite-result.skill'), 'existing');

        const result = await generatePackage(skillDir, { outputPath: outputDir });

        expect(result).toMatchObject({
          success: false,
          packagePath: expect.stringContaining('overwrite-result.skill'),
          fileCount: 0,
          size: 0,
          errors: expect.arrayContaining([expect.stringContaining('already exists')]),
          requiresOverwrite: true,
        });
      });
    });
  });
});
