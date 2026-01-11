/**
 * Unit tests for the scaffold API function (FEAT-010 Phase 3)
 *
 * Tests that the scaffold() API function:
 * 1. Returns typed ScaffoldResult objects
 * 2. Creates skill directories with standard structure
 * 3. Throws SecurityError for invalid skill names
 * 4. Throws FileSystemError for directory creation failures
 * 5. Supports scope options (project, personal, custom output)
 * 6. Never prompts for user input (uses force option)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../../src/api/scaffold';
import { SecurityError, FileSystemError } from '../../../src/errors';

describe('scaffold API function', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-scaffold-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('return type', () => {
    it('returns a ScaffoldResult object', async () => {
      const result = await scaffold({
        name: 'test-skill',
        output: tempDir,
      });

      expect(result).toBeDefined();
      expect(typeof result.path).toBe('string');
      expect(Array.isArray(result.files)).toBe(true);
    });

    it('returns absolute path in result', async () => {
      const result = await scaffold({
        name: 'absolute-test',
        output: tempDir,
      });

      expect(path.isAbsolute(result.path)).toBe(true);
    });

    it('returns relative file paths in files array', async () => {
      const result = await scaffold({
        name: 'relative-files-test',
        output: tempDir,
      });

      for (const file of result.files) {
        expect(path.isAbsolute(file)).toBe(false);
      }
    });
  });

  describe('created structure', () => {
    it('creates skill directory', async () => {
      const result = await scaffold({
        name: 'structure-test',
        output: tempDir,
      });

      const stats = await fs.stat(result.path);
      expect(stats.isDirectory()).toBe(true);
    });

    it('creates SKILL.md file', async () => {
      const result = await scaffold({
        name: 'skillmd-test',
        output: tempDir,
      });

      const skillMdPath = path.join(result.path, 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf-8');
      expect(content).toContain('name: skillmd-test');
    });

    it('creates scripts directory with .gitkeep', async () => {
      const result = await scaffold({
        name: 'scripts-test',
        output: tempDir,
      });

      const scriptsPath = path.join(result.path, 'scripts');
      const gitkeepPath = path.join(scriptsPath, '.gitkeep');

      expect((await fs.stat(scriptsPath)).isDirectory()).toBe(true);
      expect((await fs.stat(gitkeepPath)).isFile()).toBe(true);
    });

    it('includes SKILL.md and scripts/.gitkeep in files array', async () => {
      const result = await scaffold({
        name: 'files-array-test',
        output: tempDir,
      });

      expect(result.files).toContain('SKILL.md');
      expect(result.files).toContain('scripts/.gitkeep');
    });
  });

  describe('SKILL.md content', () => {
    it('includes skill name in frontmatter', async () => {
      const result = await scaffold({
        name: 'name-frontmatter',
        output: tempDir,
      });

      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('name: name-frontmatter');
    });

    it('includes description when provided', async () => {
      const result = await scaffold({
        name: 'desc-test',
        description: 'A custom description',
        output: tempDir,
      });

      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('description: A custom description');
    });

    it('includes allowed tools when provided', async () => {
      const result = await scaffold({
        name: 'tools-test',
        allowedTools: ['Read', 'Write', 'Bash'],
        output: tempDir,
      });

      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('allowed-tools:');
      expect(content).toContain('- Read');
      expect(content).toContain('- Write');
      expect(content).toContain('- Bash');
    });
  });

  describe('name validation (SecurityError)', () => {
    it('throws SecurityError for empty name', async () => {
      await expect(
        scaffold({
          name: '',
          output: tempDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for uppercase letters', async () => {
      await expect(
        scaffold({
          name: 'InvalidName',
          output: tempDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for name starting with hyphen', async () => {
      await expect(
        scaffold({
          name: '-invalid',
          output: tempDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for name ending with hyphen', async () => {
      await expect(
        scaffold({
          name: 'invalid-',
          output: tempDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for consecutive hyphens', async () => {
      await expect(
        scaffold({
          name: 'invalid--name',
          output: tempDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for reserved word "claude"', async () => {
      await expect(
        scaffold({
          name: 'my-claude-skill',
          output: tempDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for reserved word "anthropic"', async () => {
      await expect(
        scaffold({
          name: 'anthropic-helper',
          output: tempDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for path traversal attempt', async () => {
      await expect(
        scaffold({
          name: '../../../etc/passwd',
          output: tempDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for special characters', async () => {
      await expect(
        scaffold({
          name: 'skill@name',
          output: tempDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('throws SecurityError for spaces', async () => {
      await expect(
        scaffold({
          name: 'skill name',
          output: tempDir,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('includes error message in SecurityError', async () => {
      try {
        await scaffold({
          name: 'InvalidName',
          output: tempDir,
        });
        fail('Expected SecurityError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityError);
        expect((error as SecurityError).message).toContain('lowercase');
      }
    });

    it('SecurityError has correct code', async () => {
      try {
        await scaffold({
          name: 'BAD',
          output: tempDir,
        });
        fail('Expected SecurityError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityError);
        expect((error as SecurityError).code).toBe('SECURITY_ERROR');
      }
    });
  });

  describe('valid skill names', () => {
    it('accepts lowercase letters', async () => {
      const result = await scaffold({
        name: 'valid',
        output: tempDir,
      });

      expect(result.path).toContain('valid');
    });

    it('accepts numbers', async () => {
      const result = await scaffold({
        name: 'skill123',
        output: tempDir,
      });

      expect(result.path).toContain('skill123');
    });

    it('accepts hyphens between words', async () => {
      const result = await scaffold({
        name: 'my-valid-skill',
        output: tempDir,
      });

      expect(result.path).toContain('my-valid-skill');
    });

    it('accepts single letter name', async () => {
      const result = await scaffold({
        name: 'x',
        output: tempDir,
      });

      expect(result.path).toContain('x');
    });
  });

  describe('existing directory handling', () => {
    it('throws FileSystemError when directory exists and force is false', async () => {
      const existingPath = path.join(tempDir, 'existing-skill');
      await fs.mkdir(existingPath, { recursive: true });

      await expect(
        scaffold({
          name: 'existing-skill',
          output: tempDir,
          force: false,
        })
      ).rejects.toThrow(FileSystemError);
    });

    it('FileSystemError includes path information', async () => {
      const existingPath = path.join(tempDir, 'path-info-skill');
      await fs.mkdir(existingPath, { recursive: true });

      try {
        await scaffold({
          name: 'path-info-skill',
          output: tempDir,
        });
        fail('Expected FileSystemError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).path).toContain('path-info-skill');
        expect((error as FileSystemError).code).toBe('FILE_SYSTEM_ERROR');
      }
    });

    it('overwrites existing directory when force is true', async () => {
      const existingPath = path.join(tempDir, 'force-skill');
      await fs.mkdir(existingPath, { recursive: true });
      await fs.writeFile(path.join(existingPath, 'old-file.txt'), 'old content');

      const result = await scaffold({
        name: 'force-skill',
        output: tempDir,
        force: true,
      });

      expect(result.path).toContain('force-skill');
      // New SKILL.md should be created
      const skillMdPath = path.join(result.path, 'SKILL.md');
      expect(await fs.stat(skillMdPath)).toBeDefined();
    });

    it('force defaults to false', async () => {
      const existingPath = path.join(tempDir, 'default-force-skill');
      await fs.mkdir(existingPath, { recursive: true });

      await expect(
        scaffold({
          name: 'default-force-skill',
          output: tempDir,
        })
      ).rejects.toThrow(FileSystemError);
    });
  });

  describe('output path options', () => {
    it('uses output path when provided', async () => {
      const customOutput = path.join(tempDir, 'custom-location');
      await fs.mkdir(customOutput, { recursive: true });

      const result = await scaffold({
        name: 'output-test',
        output: customOutput,
      });

      expect(result.path).toBe(path.join(customOutput, 'output-test'));
    });

    it('creates parent directories when needed', async () => {
      const deepPath = path.join(tempDir, 'deep', 'nested', 'path');

      const result = await scaffold({
        name: 'deep-skill',
        output: deepPath,
      });

      expect(result.path).toBe(path.join(deepPath, 'deep-skill'));
      expect((await fs.stat(result.path)).isDirectory()).toBe(true);
    });

    it('handles relative output paths', async () => {
      const relativePath = path.relative(process.cwd(), tempDir);

      const result = await scaffold({
        name: 'relative-output',
        output: relativePath,
      });

      expect(path.isAbsolute(result.path)).toBe(true);
      expect(result.path).toContain('relative-output');
    });
  });

  describe('scope option', () => {
    it('uses project scope by default when no output', async () => {
      // We can't easily test this without mocking, but we can verify
      // the option is accepted
      const result = await scaffold({
        name: 'scope-default',
        output: tempDir,
        scope: 'project',
      });

      expect(result.path).toBeDefined();
    });

    it('accepts personal scope', async () => {
      const result = await scaffold({
        name: 'scope-personal',
        output: tempDir, // Output takes precedence over scope
        scope: 'personal',
      });

      expect(result.path).toBeDefined();
    });

    it('output takes precedence over scope', async () => {
      const customOutput = path.join(tempDir, 'custom');
      await fs.mkdir(customOutput, { recursive: true });

      const result = await scaffold({
        name: 'precedence-test',
        output: customOutput,
        scope: 'personal', // Should be ignored
      });

      expect(result.path).toBe(path.join(customOutput, 'precedence-test'));
    });
  });

  describe('error handling', () => {
    it('throws FileSystemError with correct code', async () => {
      const existingPath = path.join(tempDir, 'error-code-test');
      await fs.mkdir(existingPath, { recursive: true });

      try {
        await scaffold({
          name: 'error-code-test',
          output: tempDir,
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).code).toBe('FILE_SYSTEM_ERROR');
      }
    });

    it('error message is helpful for existing directory', async () => {
      const existingPath = path.join(tempDir, 'helpful-error');
      await fs.mkdir(existingPath, { recursive: true });

      try {
        await scaffold({
          name: 'helpful-error',
          output: tempDir,
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect((error as FileSystemError).message).toContain('already exists');
        expect((error as FileSystemError).message).toContain('force');
      }
    });
  });

  describe('never prompts', () => {
    it('does not prompt when directory exists - throws instead', async () => {
      const existingPath = path.join(tempDir, 'no-prompt-skill');
      await fs.mkdir(existingPath, { recursive: true });

      // Should throw immediately, not hang waiting for input
      await expect(
        scaffold({
          name: 'no-prompt-skill',
          output: tempDir,
        })
      ).rejects.toThrow(FileSystemError);
    });
  });

  describe('full workflow', () => {
    it('creates a complete skill structure', async () => {
      const result = await scaffold({
        name: 'complete-skill',
        description: 'A complete test skill',
        allowedTools: ['Read', 'Write'],
        output: tempDir,
      });

      // Verify directory structure
      expect((await fs.stat(result.path)).isDirectory()).toBe(true);
      expect((await fs.stat(path.join(result.path, 'scripts'))).isDirectory()).toBe(true);

      // Verify SKILL.md content
      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('name: complete-skill');
      expect(content).toContain('description: A complete test skill');
      expect(content).toContain('allowed-tools:');

      // Verify files array
      expect(result.files).toHaveLength(2);
      expect(result.files).toContain('SKILL.md');
      expect(result.files).toContain('scripts/.gitkeep');
    });
  });
});
