/**
 * Tests for scope and path resolution utilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import {
  expandTilde,
  getProjectSkillsDir,
  getPersonalSkillsDir,
  resolveScope,
  resolveInstallPath,
  validateInstallPath,
  ensureDirectoryExists,
  getScopeDescription,
  normalizePath,
  isPathWithin,
  getPathErrorCode,
} from '../../../src/utils/scope-resolver';
import { PathErrorCode } from '../../../src/types/scope';

describe('Scope Resolver Utilities', () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-scope-test-'));
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('expandTilde', () => {
    const homeDir = os.homedir();

    it('expands ~ to home directory', () => {
      expect(expandTilde('~')).toBe(homeDir);
    });

    it('expands ~/path to home directory path', () => {
      const result = expandTilde('~/some/path');
      expect(result).toBe(path.join(homeDir, 'some/path'));
    });

    it('handles Windows-style ~\\path', () => {
      const result = expandTilde('~\\some\\path');
      expect(result).toBe(path.join(homeDir, 'some\\path'));
    });

    it('returns path unchanged if no tilde', () => {
      expect(expandTilde('/absolute/path')).toBe('/absolute/path');
      expect(expandTilde('relative/path')).toBe('relative/path');
    });

    it('returns empty string unchanged', () => {
      expect(expandTilde('')).toBe('');
    });

    it('does not expand tilde in middle of path', () => {
      expect(expandTilde('/path/with/~/tilde')).toBe('/path/with/~/tilde');
    });

    it('handles path with just ~/  correctly', () => {
      const result = expandTilde('~/');
      expect(result).toBe(path.join(homeDir, ''));
    });
  });

  describe('getProjectSkillsDir', () => {
    it('returns .claude/skills relative to cwd when no cwd specified', () => {
      const result = getProjectSkillsDir();
      expect(result).toBe(path.join(process.cwd(), '.claude/skills'));
    });

    it('returns .claude/skills relative to specified cwd', () => {
      const customCwd = '/custom/path';
      const result = getProjectSkillsDir(customCwd);
      expect(result).toBe(path.join(customCwd, '.claude/skills'));
    });

    it('handles cwd with trailing slash', () => {
      const result = getProjectSkillsDir('/path/to/project/');
      expect(result).toBe(path.join('/path/to/project/', '.claude/skills'));
    });
  });

  describe('getPersonalSkillsDir', () => {
    it('returns ~/.claude/skills expanded', () => {
      const result = getPersonalSkillsDir();
      expect(result).toBe(path.join(os.homedir(), '.claude/skills'));
    });
  });

  describe('resolveScope', () => {
    it('defaults to project scope when undefined', () => {
      const result = resolveScope(undefined);
      expect(result.type).toBe('project');
      expect(result.path).toBe(path.join(process.cwd(), '.claude/skills'));
    });

    it('resolves "project" scope', () => {
      const result = resolveScope('project');
      expect(result.type).toBe('project');
      expect(result.path).toBe(path.join(process.cwd(), '.claude/skills'));
    });

    it('resolves "personal" scope', () => {
      const result = resolveScope('personal');
      expect(result.type).toBe('personal');
      expect(result.path).toBe(path.join(os.homedir(), '.claude/skills'));
    });

    it('handles case-insensitive scope names', () => {
      expect(resolveScope('PROJECT').type).toBe('project');
      expect(resolveScope('Personal').type).toBe('personal');
      expect(resolveScope('PERSONAL').type).toBe('personal');
    });

    it('handles scope with whitespace', () => {
      expect(resolveScope('  project  ').type).toBe('project');
      expect(resolveScope(' personal ').type).toBe('personal');
    });

    it('resolves custom absolute path', () => {
      const customPath = '/custom/install/path';
      const result = resolveScope(customPath);
      expect(result.type).toBe('custom');
      expect(result.path).toBe(customPath);
      expect(result.originalInput).toBe(customPath);
    });

    it('resolves custom relative path to absolute', () => {
      const relativePath = 'custom/relative/path';
      const result = resolveScope(relativePath);
      expect(result.type).toBe('custom');
      expect(result.path).toBe(path.resolve(process.cwd(), relativePath));
      expect(result.originalInput).toBe(relativePath);
    });

    it('expands tilde in custom path', () => {
      const result = resolveScope('~/custom/path');
      expect(result.type).toBe('custom');
      expect(result.path).toBe(path.join(os.homedir(), 'custom/path'));
    });

    it('uses specified cwd for project scope', () => {
      const customCwd = '/custom/cwd';
      const result = resolveScope('project', customCwd);
      expect(result.path).toBe(path.join(customCwd, '.claude/skills'));
    });

    it('uses specified cwd for relative custom paths', () => {
      const customCwd = '/custom/cwd';
      const result = resolveScope('./relative', customCwd);
      expect(result.path).toBe(path.resolve(customCwd, './relative'));
    });
  });

  describe('resolveInstallPath', () => {
    it('joins scope path with skill name', () => {
      const scopeInfo = { type: 'project' as const, path: '/base/path' };
      const result = resolveInstallPath(scopeInfo, 'my-skill');
      expect(result).toBe(path.join('/base/path', 'my-skill'));
    });

    it('handles skill names with special characters', () => {
      const scopeInfo = { type: 'custom' as const, path: '/base/path' };
      const result = resolveInstallPath(scopeInfo, 'skill-with-dashes');
      expect(result).toBe(path.join('/base/path', 'skill-with-dashes'));
    });
  });

  describe('validateInstallPath', () => {
    it('validates existing writable directory', async () => {
      const result = await validateInstallPath(tempDir);
      expect(result.valid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.isDirectory).toBe(true);
      expect(result.writable).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates non-existent path with existing parent', async () => {
      const nonExistent = path.join(tempDir, 'non-existent-dir');
      const result = await validateInstallPath(nonExistent);
      expect(result.valid).toBe(true);
      expect(result.exists).toBe(false);
      expect(result.parentExists).toBe(true);
      expect(result.writable).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates non-existent path with non-existent parent', async () => {
      const deepPath = path.join(tempDir, 'a/b/c/d/e');
      const result = await validateInstallPath(deepPath);
      // Should still be valid since we can create recursively
      expect(result.valid).toBe(true);
      expect(result.exists).toBe(false);
      expect(result.parentExists).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error for path that is a file', async () => {
      const filePath = path.join(tempDir, 'test-file.txt');
      await fs.writeFile(filePath, 'test content');

      const result = await validateInstallPath(filePath);
      expect(result.valid).toBe(false);
      expect(result.exists).toBe(true);
      expect(result.isDirectory).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('is a file');
    });

    it('returns error for parent that is a file', async () => {
      const filePath = path.join(tempDir, 'parent-file.txt');
      await fs.writeFile(filePath, 'test content');
      const childPath = path.join(filePath, 'child-dir');

      const result = await validateInstallPath(childPath);
      expect(result.valid).toBe(false);
      expect(result.parentExists).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('ensureDirectoryExists', () => {
    it('creates directory if it does not exist', async () => {
      const newDir = path.join(tempDir, 'new-directory');
      await ensureDirectoryExists(newDir);

      const stats = await fs.stat(newDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('creates nested directories recursively', async () => {
      const nestedDir = path.join(tempDir, 'a/b/c/d');
      await ensureDirectoryExists(nestedDir);

      const stats = await fs.stat(nestedDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('succeeds if directory already exists', async () => {
      const existingDir = path.join(tempDir, 'existing-dir');
      await fs.mkdir(existingDir, { recursive: true });

      // Should not throw
      await expect(ensureDirectoryExists(existingDir)).resolves.not.toThrow();
    });

    it('throws error if cannot create directory', async () => {
      // Try to create directory inside a file
      const filePath = path.join(tempDir, 'blocking-file.txt');
      await fs.writeFile(filePath, 'content');
      const invalidPath = path.join(filePath, 'impossible');

      await expect(ensureDirectoryExists(invalidPath)).rejects.toThrow();
    });
  });

  describe('getScopeDescription', () => {
    it('describes project scope', () => {
      const scopeInfo = { type: 'project' as const, path: '/path' };
      expect(getScopeDescription(scopeInfo)).toBe('project (.claude/skills/)');
    });

    it('describes personal scope', () => {
      const scopeInfo = { type: 'personal' as const, path: '/path' };
      expect(getScopeDescription(scopeInfo)).toBe('personal (~/.claude/skills/)');
    });

    it('describes custom scope with original input', () => {
      const scopeInfo = {
        type: 'custom' as const,
        path: '/expanded/path',
        originalInput: '~/custom',
      };
      expect(getScopeDescription(scopeInfo)).toBe('custom (~/custom)');
    });

    it('describes custom scope without original input', () => {
      const scopeInfo = {
        type: 'custom' as const,
        path: '/absolute/path',
      };
      expect(getScopeDescription(scopeInfo)).toBe('custom (/absolute/path)');
    });
  });

  describe('normalizePath', () => {
    it('expands tilde and resolves to absolute', () => {
      const result = normalizePath('~/some/path');
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain(os.homedir());
    });

    it('normalizes relative path to absolute', () => {
      const result = normalizePath('relative/path');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('normalizes path with double slashes', () => {
      const result = normalizePath('/path//to///dir');
      expect(result).not.toContain('//');
    });

    it('handles . and .. in paths', () => {
      const result = normalizePath('/path/to/../other/./dir');
      expect(result).toBe(path.normalize('/path/other/dir'));
    });
  });

  describe('isPathWithin', () => {
    it('returns true for direct child path', () => {
      expect(isPathWithin('/parent/child', '/parent')).toBe(true);
    });

    it('returns true for deeply nested path', () => {
      expect(isPathWithin('/parent/a/b/c/d', '/parent')).toBe(true);
    });

    it('returns true for same path', () => {
      expect(isPathWithin('/path', '/path')).toBe(true);
    });

    it('returns false for sibling path', () => {
      expect(isPathWithin('/parent/sibling', '/parent/other')).toBe(false);
    });

    it('returns false for parent path', () => {
      expect(isPathWithin('/parent', '/parent/child')).toBe(false);
    });

    it('returns false for unrelated paths', () => {
      expect(isPathWithin('/completely/different', '/path')).toBe(false);
    });

    it('handles paths with trailing slashes', () => {
      expect(isPathWithin('/parent/child/', '/parent/')).toBe(true);
    });

    it('handles tilde paths', () => {
      const homeChild = path.join(os.homedir(), 'subdir');
      expect(isPathWithin(homeChild, '~')).toBe(true);
    });
  });

  describe('getPathErrorCode', () => {
    it('returns PATH_IS_FILE for file error', () => {
      expect(getPathErrorCode('Path is a file, not a directory')).toBe(PathErrorCode.PATH_IS_FILE);
    });

    it('returns PERMISSION_DENIED for permission error', () => {
      expect(getPathErrorCode('Permission denied: Cannot write')).toBe(
        PathErrorCode.PERMISSION_DENIED
      );
    });

    it('returns PARENT_NOT_FOUND for parent error', () => {
      expect(getPathErrorCode('Parent directory not found')).toBe(PathErrorCode.PARENT_NOT_FOUND);
    });

    it('returns INVALID_PATH for unknown errors', () => {
      expect(getPathErrorCode('Some other error')).toBe(PathErrorCode.INVALID_PATH);
    });
  });
});

describe('Scope Types', () => {
  it('can create valid ScopeInfo', () => {
    const scopeInfo: import('../../../src/types/scope').ScopeInfo = {
      type: 'project',
      path: '/path/to/skills',
    };

    expect(scopeInfo.type).toBe('project');
    expect(scopeInfo.path).toBe('/path/to/skills');
  });

  it('can create ScopeInfo with originalInput', () => {
    const scopeInfo: import('../../../src/types/scope').ScopeInfo = {
      type: 'custom',
      path: '/expanded/path',
      originalInput: '~/original',
    };

    expect(scopeInfo.originalInput).toBe('~/original');
  });

  it('can create valid PathValidationResult', () => {
    const result: import('../../../src/types/scope').PathValidationResult = {
      valid: true,
      exists: true,
      writable: true,
      isDirectory: true,
      parentExists: true,
      errors: [],
    };

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('can create PathValidationError', () => {
    const error: import('../../../src/types/scope').PathValidationError = {
      code: PathErrorCode.PATH_IS_FILE,
      message: 'Path is a file',
      path: '/some/file.txt',
      suggestion: 'Remove the file or use a different path',
    };

    expect(error.code).toBe(PathErrorCode.PATH_IS_FILE);
    expect(error.suggestion).toBeDefined();
  });
});
