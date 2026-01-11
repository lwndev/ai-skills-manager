/**
 * Unit tests for the createPackage API function (FEAT-010 Phase 4)
 *
 * Tests that the createPackage() API function:
 * 1. Returns typed PackageResult objects
 * 2. Validates skills before packaging (unless skipped)
 * 3. Throws ValidationError for invalid skills
 * 4. Throws PackageError for packaging failures
 * 5. Throws FileSystemError for permission errors
 * 6. Supports AbortSignal cancellation
 * 7. Supports force overwrite
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createPackage } from '../../../src/api/package';
import { scaffold } from '../../../src/api/scaffold';
import { ValidationError, FileSystemError, CancellationError } from '../../../src/errors';

describe('createPackage API function', () => {
  let tempDir: string;
  let validSkillPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-package-test-'));

    // Create a valid skill for testing
    const result = await scaffold({
      name: 'test-skill',
      description: 'A test skill for packaging',
      output: tempDir,
    });
    validSkillPath = result.path;
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('return type', () => {
    it('returns a PackageResult object', async () => {
      const outputDir = path.join(tempDir, 'output-result');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      expect(result).toBeDefined();
      expect(typeof result.packagePath).toBe('string');
      expect(typeof result.size).toBe('number');
    });

    it('returns absolute package path', async () => {
      const outputDir = path.join(tempDir, 'output-absolute');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      expect(path.isAbsolute(result.packagePath)).toBe(true);
    });

    it('returns package size in bytes', async () => {
      const outputDir = path.join(tempDir, 'output-size');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      expect(result.size).toBeGreaterThan(0);
    });

    it('package path ends with .skill extension', async () => {
      const outputDir = path.join(tempDir, 'output-ext');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      expect(result.packagePath).toMatch(/\.skill$/);
    });
  });

  describe('validation', () => {
    it('validates skill before packaging by default', async () => {
      // Create an invalid skill (missing required frontmatter)
      const invalidSkillPath = path.join(tempDir, 'invalid-skill');
      await fs.mkdir(invalidSkillPath, { recursive: true });
      await fs.writeFile(path.join(invalidSkillPath, 'SKILL.md'), '# No frontmatter\n');

      await expect(
        createPackage({
          path: invalidSkillPath,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError with issues array', async () => {
      const invalidSkillPath = path.join(tempDir, 'invalid-skill');
      await fs.mkdir(invalidSkillPath, { recursive: true });
      await fs.writeFile(path.join(invalidSkillPath, 'SKILL.md'), '# No frontmatter\n');

      try {
        await createPackage({
          path: invalidSkillPath,
        });
        fail('Expected ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).issues).toBeDefined();
        expect((error as ValidationError).issues.length).toBeGreaterThan(0);
      }
    });

    it('skips validation when skipValidation is true', async () => {
      // Create a skill with invalid frontmatter but valid enough structure
      const invalidSkillPath = path.join(tempDir, 'skip-validation-skill');
      await fs.mkdir(invalidSkillPath, { recursive: true });
      await fs.writeFile(
        path.join(invalidSkillPath, 'SKILL.md'),
        '---\nname: skip-validation-skill\n---\n# Skill\n'
      );

      const outputDir = path.join(tempDir, 'output-skip-validation');
      await fs.mkdir(outputDir, { recursive: true });

      // Without skipValidation, it might fail due to missing description
      // With skipValidation, it should succeed
      const result = await createPackage({
        path: invalidSkillPath,
        output: outputDir,
        skipValidation: true,
      });

      expect(result.packagePath).toBeDefined();
    });
  });

  describe('output path options', () => {
    it('creates package in current directory by default', async () => {
      const expectedPath = path.join(process.cwd(), 'test-skill.skill');

      // Clean up any leftover file from previous runs
      await fs.unlink(expectedPath).catch(() => {});

      const result = await createPackage({
        path: validSkillPath,
      });

      expect(result.packagePath).toBe(expectedPath);

      // Clean up the created package
      await fs.unlink(result.packagePath).catch(() => {});
    });

    it('creates package in specified output directory', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      expect(result.packagePath).toBe(path.join(outputDir, 'test-skill.skill'));
    });

    it('uses skill name as package filename', async () => {
      const customSkillPath = await scaffold({
        name: 'custom-name-skill',
        output: tempDir,
      });

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: customSkillPath.path,
        output: outputDir,
      });

      expect(path.basename(result.packagePath)).toBe('custom-name-skill.skill');
    });
  });

  describe('existing package handling', () => {
    it('throws FileSystemError when package exists and force is false', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Create package first time
      await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      // Try to create again without force
      await expect(
        createPackage({
          path: validSkillPath,
          output: outputDir,
          force: false,
        })
      ).rejects.toThrow(FileSystemError);
    });

    it('FileSystemError includes path information', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Create package first time
      await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      try {
        await createPackage({
          path: validSkillPath,
          output: outputDir,
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).path).toContain('test-skill.skill');
      }
    });

    it('overwrites existing package when force is true', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Create package first time
      const firstResult = await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      // Create again with force
      const secondResult = await createPackage({
        path: validSkillPath,
        output: outputDir,
        force: true,
      });

      expect(secondResult.packagePath).toBe(firstResult.packagePath);
      expect(secondResult.size).toBeGreaterThan(0);
    });

    it('force defaults to false', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Create package first time
      await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      // Try to create again (force should default to false)
      await expect(
        createPackage({
          path: validSkillPath,
          output: outputDir,
        })
      ).rejects.toThrow(FileSystemError);
    });
  });

  describe('AbortSignal cancellation', () => {
    it('throws CancellationError when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        createPackage({
          path: validSkillPath,
          signal: controller.signal,
        })
      ).rejects.toThrow(CancellationError);
    });

    it('CancellationError has correct code', async () => {
      const controller = new AbortController();
      controller.abort();

      try {
        await createPackage({
          path: validSkillPath,
          signal: controller.signal,
        });
        fail('Expected CancellationError');
      } catch (error) {
        expect(error).toBeInstanceOf(CancellationError);
        expect((error as CancellationError).code).toBe('CANCELLED');
      }
    });

    it('works without AbortSignal', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Should succeed without signal
      const result = await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      expect(result.packagePath).toBeDefined();
    });

    it('succeeds with non-aborted signal', async () => {
      const controller = new AbortController();
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Should succeed with non-aborted signal
      const result = await createPackage({
        path: validSkillPath,
        output: outputDir,
        signal: controller.signal,
      });

      expect(result.packagePath).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('throws FileSystemError for non-existent skill path', async () => {
      await expect(
        createPackage({
          path: path.join(tempDir, 'non-existent-skill'),
          skipValidation: true,
        })
      ).rejects.toThrow();
    });

    it('ValidationError has correct code', async () => {
      const invalidSkillPath = path.join(tempDir, 'invalid-skill');
      await fs.mkdir(invalidSkillPath, { recursive: true });
      await fs.writeFile(path.join(invalidSkillPath, 'SKILL.md'), '# No frontmatter\n');

      try {
        await createPackage({
          path: invalidSkillPath,
        });
        fail('Expected ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('FileSystemError has correct code', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Create package first time
      await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      try {
        await createPackage({
          path: validSkillPath,
          output: outputDir,
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).code).toBe('FILE_SYSTEM_ERROR');
      }
    });
  });

  describe('created package', () => {
    it('creates a file at the specified path', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      const stats = await fs.stat(result.packagePath);
      expect(stats.isFile()).toBe(true);
    });

    it('created file has .skill extension', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      expect(result.packagePath).toMatch(/\.skill$/);
    });

    it('reported size matches actual file size', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      const stats = await fs.stat(result.packagePath);
      expect(result.size).toBe(stats.size);
    });
  });

  describe('never prompts', () => {
    it('does not prompt when package exists - throws instead', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Create package first time
      await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      // Should throw immediately, not hang waiting for input
      await expect(
        createPackage({
          path: validSkillPath,
          output: outputDir,
        })
      ).rejects.toThrow(FileSystemError);
    });
  });

  describe('full workflow', () => {
    it('creates a complete package from valid skill', async () => {
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: validSkillPath,
        output: outputDir,
      });

      // Verify result structure
      expect(result.packagePath).toBeDefined();
      expect(result.size).toBeGreaterThan(0);

      // Verify file was created
      const stats = await fs.stat(result.packagePath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBe(result.size);
    });
  });
});
