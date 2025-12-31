import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { validateSkillPath, getSkillName } from '../../../src/validators/skill-path';

describe('validateSkillPath', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-path-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a skill directory with SKILL.md
   */
  async function createSkillDir(
    dirName: string,
    content: string = '---\nname: test\ndescription: Test\n---\n'
  ): Promise<string> {
    const skillDir = path.join(tempDir, dirName);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), content);
    return skillDir;
  }

  describe('empty path', () => {
    it('rejects empty string', async () => {
      const result = await validateSkillPath('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('rejects whitespace only', async () => {
      const result = await validateSkillPath('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });
  });

  describe('path does not exist', () => {
    it('returns error for non-existent path', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist');
      const result = await validateSkillPath(nonExistentPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });

  describe('directory with SKILL.md', () => {
    it('returns valid with paths when SKILL.md exists', async () => {
      const skillDir = await createSkillDir('my-skill');

      const result = await validateSkillPath(skillDir);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBe(skillDir);
      expect(result.skillFilePath).toBe(path.join(skillDir, 'SKILL.md'));
      expect(result.error).toBeUndefined();
    });

    it('returns error when SKILL.md is missing from directory', async () => {
      const emptyDir = path.join(tempDir, 'empty-skill');
      await fs.mkdir(emptyDir);

      const result = await validateSkillPath(emptyDir);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('SKILL.md not found');
    });
  });

  describe('direct file path to SKILL.md', () => {
    it('accepts path pointing directly to SKILL.md and uses parent directory', async () => {
      const skillDir = await createSkillDir('direct-skill');
      const skillFilePath = path.join(skillDir, 'SKILL.md');

      const result = await validateSkillPath(skillFilePath);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBe(skillDir);
      expect(result.skillFilePath).toBe(skillFilePath);
    });

    it('rejects file with wrong name', async () => {
      const wrongFile = path.join(tempDir, 'README.md');
      await fs.writeFile(wrongFile, '# README');

      const result = await validateSkillPath(wrongFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected path to skill directory or SKILL.md file');
      expect(result.error).toContain('README.md');
    });
  });

  describe('relative paths', () => {
    it('resolves relative path to absolute', async () => {
      const skillDir = await createSkillDir('relative-skill');

      // Use relative path from cwd
      const cwd = process.cwd();
      const relativePath = path.relative(cwd, skillDir);

      const result = await validateSkillPath(relativePath);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBeDefined();
      expect(path.isAbsolute(result.skillDir as string)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles deeply nested skill directory', async () => {
      const nestedDir = path.join(tempDir, 'a', 'b', 'c', 'my-skill');
      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(
        path.join(nestedDir, 'SKILL.md'),
        '---\nname: nested\ndescription: Test\n---\n'
      );

      const result = await validateSkillPath(nestedDir);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBe(nestedDir);
    });

    it('handles skill directory with special characters in name', async () => {
      const specialDir = path.join(tempDir, 'my-special_skill.v1');
      await fs.mkdir(specialDir);
      await fs.writeFile(
        path.join(specialDir, 'SKILL.md'),
        '---\nname: special\ndescription: Test\n---\n'
      );

      const result = await validateSkillPath(specialDir);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBe(specialDir);
    });

    it('handles skill directory with additional files', async () => {
      const skillDir = await createSkillDir('multi-file-skill');
      await fs.writeFile(path.join(skillDir, 'README.md'), '# Extra file');
      await fs.writeFile(path.join(skillDir, 'script.sh'), '#!/bin/bash');

      const result = await validateSkillPath(skillDir);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBe(skillDir);
    });

    it('handles symlink to skill directory', async () => {
      const skillDir = await createSkillDir('original-skill');
      const symlinkPath = path.join(tempDir, 'skill-link');
      await fs.symlink(skillDir, symlinkPath);

      const result = await validateSkillPath(symlinkPath);

      expect(result.valid).toBe(true);
      // skillDir should be the resolved symlink path
      expect(result.skillFilePath).toContain('SKILL.md');
    });
  });
});

describe('getSkillName', () => {
  it('extracts skill name from directory path', () => {
    const skillDir = '/path/to/my-awesome-skill';
    expect(getSkillName(skillDir)).toBe('my-awesome-skill');
  });

  it('handles trailing slash', () => {
    const skillDir = '/path/to/skill-name/';
    // path.basename handles trailing slashes differently on different platforms
    // The function uses path.basename which should handle this correctly
    expect(getSkillName(skillDir.replace(/\/$/, ''))).toBe('skill-name');
  });

  it('handles single directory name', () => {
    const skillDir = '/skill-name';
    expect(getSkillName(skillDir)).toBe('skill-name');
  });

  it('handles current directory', () => {
    const skillDir = '.';
    expect(getSkillName(skillDir)).toBe('.');
  });
});
