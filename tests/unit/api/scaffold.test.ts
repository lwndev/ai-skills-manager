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
import * as scopeResolver from '../../../src/utils/scope-resolver';

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

  describe('catch block error mapping', () => {
    /**
     * Helper to import scaffold with mocked fs/promises.
     * Returns scaffold + error classes from the same module scope
     * so instanceof checks work correctly.
     */
    async function importScaffoldWithMockedFs(fsMocks: Record<string, jest.Mock>) {
      jest.resetModules();
      const realFs = jest.requireActual<typeof fs>('fs/promises');
      jest.doMock('fs/promises', () => ({ ...realFs, ...fsMocks }));
      const { scaffold: mockedScaffold } = await import('../../../src/api/scaffold');
      const errors = await import('../../../src/errors');
      return { scaffold: mockedScaffold, ...errors };
    }

    afterEach(() => {
      jest.resetModules();
    });

    it('maps EACCES error to FileSystemError with permission denied message', async () => {
      const eaccesErr = Object.assign(new Error('EACCES'), { code: 'EACCES' });
      const { scaffold: mockedScaffold, FileSystemError: FsErr } = await importScaffoldWithMockedFs(
        {
          stat: jest.fn().mockRejectedValue(new Error('ENOENT')),
          mkdir: jest.fn().mockRejectedValue(eaccesErr),
          writeFile: jest.fn(),
        }
      );

      try {
        await mockedScaffold({ name: 'eacces-test', output: tempDir });
        fail('Expected FileSystemError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FsErr);
        expect((error as Error).message).toContain('Permission denied');
      }
    });

    it('maps EPERM error to FileSystemError with permission denied message', async () => {
      const epermErr = Object.assign(new Error('EPERM'), { code: 'EPERM' });
      const { scaffold: mockedScaffold, FileSystemError: FsErr } = await importScaffoldWithMockedFs(
        {
          stat: jest.fn().mockRejectedValue(new Error('ENOENT')),
          mkdir: jest.fn().mockRejectedValue(epermErr),
          writeFile: jest.fn(),
        }
      );

      try {
        await mockedScaffold({ name: 'eperm-test', output: tempDir });
        fail('Expected FileSystemError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FsErr);
        expect((error as Error).message).toContain('Permission denied');
      }
    });

    it('maps ENOENT error to FileSystemError with parent directory message', async () => {
      const enoentErr = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      const { scaffold: mockedScaffold, FileSystemError: FsErr } = await importScaffoldWithMockedFs(
        {
          stat: jest.fn().mockRejectedValue(new Error('ENOENT')),
          mkdir: jest.fn().mockRejectedValue(enoentErr),
          writeFile: jest.fn(),
        }
      );

      try {
        await mockedScaffold({ name: 'enoent-test', output: tempDir });
        fail('Expected FileSystemError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FsErr);
        expect((error as Error).message).toContain('Parent directory does not exist');
      }
    });

    it('re-throws FileSystemError without wrapping', async () => {
      jest.resetModules();
      const realFs = jest.requireActual<typeof fs>('fs/promises');
      // Import errors first so the error instance shares the same class as scaffold
      const { FileSystemError: FsErr } = await import('../../../src/errors');
      const originalError = new FsErr('original fs error', '/some/path');

      jest.doMock('fs/promises', () => ({
        ...realFs,
        stat: jest.fn().mockRejectedValue(new Error('ENOENT')),
        mkdir: jest.fn().mockRejectedValue(originalError),
        writeFile: jest.fn(),
      }));
      const { scaffold: mockedScaffold } = await import('../../../src/api/scaffold');

      try {
        await mockedScaffold({ name: 'rethrow-fs-test', output: tempDir });
        fail('Expected FileSystemError to be thrown');
      } catch (error) {
        expect(error).toBe(originalError);
        expect((error as Error).message).toBe('original fs error');
      }
    });

    it('re-throws SecurityError without wrapping', async () => {
      jest.resetModules();
      const realFs = jest.requireActual<typeof fs>('fs/promises');
      const { SecurityError: SecErr } = await import('../../../src/errors');
      const originalError = new SecErr('original security error');

      jest.doMock('fs/promises', () => ({
        ...realFs,
        stat: jest.fn().mockRejectedValue(new Error('ENOENT')),
        mkdir: jest.fn().mockRejectedValue(originalError),
        writeFile: jest.fn(),
      }));
      const { scaffold: mockedScaffold } = await import('../../../src/api/scaffold');

      try {
        await mockedScaffold({ name: 'rethrow-sec-test', output: tempDir });
        fail('Expected SecurityError to be thrown');
      } catch (error) {
        expect(error).toBe(originalError);
        expect((error as Error).message).toBe('original security error');
      }
    });

    it('wraps plain Error with its message in FileSystemError', async () => {
      const { scaffold: mockedScaffold, FileSystemError: FsErr } = await importScaffoldWithMockedFs(
        {
          stat: jest.fn().mockRejectedValue(new Error('ENOENT')),
          mkdir: jest.fn().mockRejectedValue(new Error('something went wrong')),
          writeFile: jest.fn(),
        }
      );

      try {
        await mockedScaffold({ name: 'wrap-error-test', output: tempDir });
        fail('Expected FileSystemError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FsErr);
        expect((error as Error).message).toContain('Failed to create scaffold');
        expect((error as Error).message).toContain('something went wrong');
      }
    });

    it('wraps string error with String(error) in FileSystemError', async () => {
      const { scaffold: mockedScaffold, FileSystemError: FsErr } = await importScaffoldWithMockedFs(
        {
          stat: jest.fn().mockRejectedValue(new Error('ENOENT')),
          mkdir: jest.fn().mockRejectedValue('string error value'),
          writeFile: jest.fn(),
        }
      );

      try {
        await mockedScaffold({ name: 'wrap-string-test', output: tempDir });
        fail('Expected FileSystemError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FsErr);
        expect((error as Error).message).toContain('Failed to create scaffold');
        expect((error as Error).message).toContain('string error value');
      }
    });

    it('wraps null error with String(error) in FileSystemError', async () => {
      const { scaffold: mockedScaffold, FileSystemError: FsErr } = await importScaffoldWithMockedFs(
        {
          stat: jest.fn().mockRejectedValue(new Error('ENOENT')),
          mkdir: jest.fn().mockRejectedValue(null),
          writeFile: jest.fn(),
        }
      );

      try {
        await mockedScaffold({ name: 'wrap-null-test', output: tempDir });
        fail('Expected FileSystemError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FsErr);
        expect((error as Error).message).toContain('Failed to create scaffold');
        expect((error as Error).message).toContain('null');
      }
    });

    it('maps EACCES from writeFile to FileSystemError with permission denied', async () => {
      const eaccesErr = Object.assign(new Error('EACCES'), { code: 'EACCES' });
      const mockMkdir = jest.fn().mockResolvedValue(undefined);
      const { scaffold: mockedScaffold, FileSystemError: FsErr } = await importScaffoldWithMockedFs(
        {
          stat: jest.fn().mockRejectedValue(new Error('ENOENT')),
          mkdir: mockMkdir,
          writeFile: jest.fn().mockRejectedValue(eaccesErr),
        }
      );

      try {
        await mockedScaffold({ name: 'writeacces-test', output: tempDir });
        fail('Expected FileSystemError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FsErr);
        expect((error as Error).message).toContain('Permission denied');
        expect(mockMkdir).toHaveBeenCalled();
      }
    });
  });

  describe('template option mapping', () => {
    it('passes basic template options through to generateSkillMd', async () => {
      const result = await scaffold({
        name: 'basic-template-test',
        output: tempDir,
        template: { templateType: 'basic' },
      });

      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('name: basic-template-test');
      // Basic template does not add context: fork or user-invocable: false
      expect(content).not.toContain('context: fork');
      expect(content).not.toContain('user-invocable: false');
    });

    it('passes forked template options through to generateSkillMd', async () => {
      const result = await scaffold({
        name: 'forked-template-test',
        output: tempDir,
        template: { templateType: 'forked' },
      });

      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('context: fork');
      // Forked template has default read-only tools
      expect(content).toContain('allowed-tools:');
    });

    it('passes with-hooks template options through to generateSkillMd', async () => {
      const result = await scaffold({
        name: 'hooks-template-test',
        output: tempDir,
        template: { templateType: 'with-hooks' },
      });

      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('hooks:');
      expect(content).toContain('PreToolUse:');
      expect(content).toContain('PostToolUse:');
    });

    it('passes internal template options through to generateSkillMd', async () => {
      const result = await scaffold({
        name: 'internal-template-test',
        output: tempDir,
        template: { templateType: 'internal' },
      });

      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('user-invocable: false');
    });

    it('passes all template sub-options through', async () => {
      const result = await scaffold({
        name: 'all-opts-test',
        output: tempDir,
        template: {
          templateType: 'basic',
          context: 'fork',
          agent: 'Explore',
          userInvocable: false,
          includeHooks: true,
          minimal: true,
          argumentHint: '<query>',
          license: 'MIT',
          compatibility: 'claude-code>=2.1',
          metadata: { author: 'test' },
        },
      });

      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('context: fork');
      expect(content).toContain('agent: Explore');
      expect(content).toContain('user-invocable: false');
      expect(content).toContain('hooks:');
      expect(content).toContain('argument-hint: <query>');
      expect(content).toContain('license: MIT');
      expect(content).toContain('compatibility: claude-code>=2.1');
      expect(content).toContain('author: test');
    });

    it('omits template options when template is not provided', async () => {
      const result = await scaffold({
        name: 'no-template-test',
        output: tempDir,
      });

      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('name: no-template-test');
      // Extract frontmatter (between --- markers) and verify no template-specific fields
      const frontmatter = content.split('---')[1];
      expect(frontmatter).not.toContain('context: fork');
      expect(frontmatter).not.toContain('hooks:');
      expect(frontmatter).not.toContain('user-invocable: false');
    });
  });

  describe('resolveOutputPath scope resolution (without explicit output)', () => {
    let getProjectSpy: jest.SpyInstance;
    let getPersonalSpy: jest.SpyInstance;

    beforeEach(() => {
      getProjectSpy = jest.spyOn(scopeResolver, 'getProjectSkillsDir').mockReturnValue(tempDir);
      getPersonalSpy = jest.spyOn(scopeResolver, 'getPersonalSkillsDir').mockReturnValue(tempDir);
    });

    afterEach(() => {
      getProjectSpy.mockRestore();
      getPersonalSpy.mockRestore();
    });

    it('uses project skills dir when scope is project', async () => {
      const result = await scaffold({
        name: 'scope-proj-test',
        scope: 'project',
      });

      expect(getProjectSpy).toHaveBeenCalled();
      expect(result.path).toBe(path.join(tempDir, 'scope-proj-test'));
    });

    it('uses project skills dir when scope is undefined (default)', async () => {
      const result = await scaffold({
        name: 'scope-default-test',
      });

      expect(getProjectSpy).toHaveBeenCalled();
      expect(result.path).toBe(path.join(tempDir, 'scope-default-test'));
    });

    it('uses personal skills dir when scope is personal', async () => {
      const result = await scaffold({
        name: 'scope-pers-test',
        scope: 'personal',
      });

      expect(getPersonalSpy).toHaveBeenCalled();
      expect(result.path).toBe(path.join(tempDir, 'scope-pers-test'));
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
