import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { validateFileExists } from '../../../src/validators/file-exists';

describe('validateFileExists', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-exists-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('empty path', () => {
    it('rejects empty string', async () => {
      const result = await validateFileExists('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('rejects whitespace only', async () => {
      const result = await validateFileExists('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });
  });

  describe('path does not exist', () => {
    it('returns error for non-existent path', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist');
      const result = await validateFileExists(nonExistentPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });

  describe('directory with SKILL.md', () => {
    it('returns valid and content when SKILL.md exists', async () => {
      const skillContent = `---
name: test-skill
description: A test skill
---

Content here.
`;
      const skillPath = path.join(tempDir, 'SKILL.md');
      await fs.writeFile(skillPath, skillContent);

      const result = await validateFileExists(tempDir);
      expect(result.valid).toBe(true);
      expect(result.resolvedPath).toBe(skillPath);
      expect(result.content).toBe(skillContent);
    });

    it('returns error when SKILL.md is missing from directory', async () => {
      // Empty directory
      const result = await validateFileExists(tempDir);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SKILL.md not found');
    });
  });

  describe('direct file path', () => {
    it('accepts path pointing directly to SKILL.md', async () => {
      const skillContent = `---
name: direct-skill
description: Direct path test
---

Content.
`;
      const skillPath = path.join(tempDir, 'SKILL.md');
      await fs.writeFile(skillPath, skillContent);

      const result = await validateFileExists(skillPath);
      expect(result.valid).toBe(true);
      expect(result.resolvedPath).toBe(skillPath);
      expect(result.content).toBe(skillContent);
    });

    it('rejects file with wrong name', async () => {
      const wrongFile = path.join(tempDir, 'README.md');
      await fs.writeFile(wrongFile, '# README');

      const result = await validateFileExists(wrongFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected file named "SKILL.md"');
      expect(result.error).toContain('README.md');
    });
  });

  describe('relative paths', () => {
    it('resolves relative path to absolute', async () => {
      const skillContent = `---
name: relative-skill
description: Relative path test
---

Content.
`;
      const skillDir = path.join(tempDir, 'my-skill');
      await fs.mkdir(skillDir);
      const skillPath = path.join(skillDir, 'SKILL.md');
      await fs.writeFile(skillPath, skillContent);

      // Use relative path from cwd
      const cwd = process.cwd();
      const relativePath = path.relative(cwd, skillDir);

      const result = await validateFileExists(relativePath);
      expect(result.valid).toBe(true);
      expect(path.isAbsolute(result.resolvedPath!)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty file', async () => {
      const skillPath = path.join(tempDir, 'SKILL.md');
      await fs.writeFile(skillPath, '');

      const result = await validateFileExists(skillPath);
      expect(result.valid).toBe(true);
      expect(result.content).toBe('');
    });

    it('handles file with only whitespace', async () => {
      const skillPath = path.join(tempDir, 'SKILL.md');
      await fs.writeFile(skillPath, '   \n\n  ');

      const result = await validateFileExists(skillPath);
      expect(result.valid).toBe(true);
      expect(result.content).toBe('   \n\n  ');
    });

    it('handles unicode content', async () => {
      const skillContent = `---
name: unicode-skill
description: 日本語テスト 🎉
---

Content with émojis and ünïcödé.
`;
      const skillPath = path.join(tempDir, 'SKILL.md');
      await fs.writeFile(skillPath, skillContent, 'utf-8');

      const result = await validateFileExists(skillPath);
      expect(result.valid).toBe(true);
      expect(result.content).toContain('日本語テスト');
      expect(result.content).toContain('🎉');
    });

    it('handles deeply nested directory', async () => {
      const nestedDir = path.join(tempDir, 'a', 'b', 'c', 'd');
      await fs.mkdir(nestedDir, { recursive: true });
      const skillPath = path.join(nestedDir, 'SKILL.md');
      await fs.writeFile(skillPath, '---\nname: nested\ndescription: Test\n---\n');

      const result = await validateFileExists(nestedDir);
      expect(result.valid).toBe(true);
      expect(result.resolvedPath).toBe(skillPath);
    });
  });
});
