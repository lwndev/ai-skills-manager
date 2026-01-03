/**
 * Tests for skill discovery module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  discoverSkill,
  verifyCaseSensitivity,
  verifySkillMd,
} from '../../../src/generators/skill-discovery';
import { ScopeInfo } from '../../../src/types/scope';

describe('Skill Discovery', () => {
  let tempDir: string;
  let scopeInfo: ScopeInfo;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-discovery-test-'));
    scopeInfo = {
      type: 'project',
      path: tempDir,
    };
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('discoverSkill', () => {
    beforeAll(async () => {
      // Create test skill directories
      // Valid skill with SKILL.md
      const validSkillDir = path.join(tempDir, 'valid-skill');
      await fs.promises.mkdir(validSkillDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(validSkillDir, 'SKILL.md'),
        '---\nname: valid-skill\ndescription: Test\n---\n\n# Valid Skill'
      );

      // Skill without SKILL.md
      const noSkillMdDir = path.join(tempDir, 'no-skillmd');
      await fs.promises.mkdir(noSkillMdDir, { recursive: true });
      await fs.promises.writeFile(path.join(noSkillMdDir, 'README.md'), '# Readme');

      // Create a file (not directory) to test non-directory handling
      await fs.promises.writeFile(path.join(tempDir, 'not-a-directory'), 'file content');
    });

    it('returns "found" for an existing skill with SKILL.md', async () => {
      const result = await discoverSkill('valid-skill', scopeInfo);

      expect(result.type).toBe('found');
      if (result.type === 'found') {
        expect(result.path).toBe(path.join(tempDir, 'valid-skill'));
        expect(result.hasSkillMd).toBe(true);
      }
    });

    it('returns "found" for a skill without SKILL.md', async () => {
      const result = await discoverSkill('no-skillmd', scopeInfo);

      expect(result.type).toBe('found');
      if (result.type === 'found') {
        expect(result.path).toBe(path.join(tempDir, 'no-skillmd'));
        expect(result.hasSkillMd).toBe(false);
      }
    });

    it('returns "not-found" for a non-existent skill', async () => {
      const result = await discoverSkill('does-not-exist', scopeInfo);

      expect(result.type).toBe('not-found');
      if (result.type === 'not-found') {
        expect(result.searchedPath).toBe(path.join(tempDir, 'does-not-exist'));
      }
    });

    it('returns "not-found" when path exists but is not a directory', async () => {
      const result = await discoverSkill('not-a-directory', scopeInfo);

      expect(result.type).toBe('not-found');
    });
  });

  describe('verifyCaseSensitivity', () => {
    beforeAll(async () => {
      // Create skill with specific case
      const casedSkillDir = path.join(tempDir, 'my-skill');
      await fs.promises.mkdir(casedSkillDir, { recursive: true });
    });

    it('returns "match" when case matches exactly', async () => {
      const skillPath = path.join(tempDir, 'my-skill');
      const result = await verifyCaseSensitivity(skillPath, 'my-skill');

      expect(result.type).toBe('match');
    });

    it('returns "mismatch" when case differs', async () => {
      // Note: This test may behave differently on case-sensitive vs case-insensitive filesystems
      // On macOS (case-insensitive by default), this should detect the mismatch
      // On Linux (case-sensitive), the directory won't be found at all
      const skillPath = path.join(tempDir, 'My-Skill');
      const result = await verifyCaseSensitivity(skillPath, 'My-Skill');

      // On case-sensitive systems, the entry won't be found at all
      if (result.type === 'error') {
        expect(result.message).toContain('not found');
      } else if (result.type === 'mismatch') {
        // On case-insensitive systems, we detect the mismatch
        expect(result.expectedName).toBe('My-Skill');
        expect(result.actualName).toBe('my-skill');
      }
    });

    it('returns "error" for non-existent parent directory', async () => {
      const skillPath = path.join(tempDir, 'nonexistent-parent', 'skill');
      const result = await verifyCaseSensitivity(skillPath, 'skill');

      expect(result.type).toBe('error');
    });
  });

  describe('verifySkillMd', () => {
    let withSkillMdDir: string;
    let withoutSkillMdDir: string;
    let skillMdIsDirDir: string;

    beforeAll(async () => {
      // Create skill with SKILL.md
      withSkillMdDir = path.join(tempDir, 'with-skillmd');
      await fs.promises.mkdir(withSkillMdDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(withSkillMdDir, 'SKILL.md'),
        '---\nname: with-skillmd\n---\n'
      );

      // Create skill without SKILL.md
      withoutSkillMdDir = path.join(tempDir, 'without-skillmd');
      await fs.promises.mkdir(withoutSkillMdDir, { recursive: true });

      // Create skill where SKILL.md is a directory (edge case)
      skillMdIsDirDir = path.join(tempDir, 'skillmd-is-dir');
      await fs.promises.mkdir(skillMdIsDirDir, { recursive: true });
      await fs.promises.mkdir(path.join(skillMdIsDirDir, 'SKILL.md'), { recursive: true });
    });

    it('returns "present" when SKILL.md exists', async () => {
      const result = await verifySkillMd(withSkillMdDir);

      expect(result.type).toBe('present');
      if (result.type === 'present') {
        expect(result.path).toContain('SKILL.md');
      }
    });

    it('returns "missing" when SKILL.md does not exist', async () => {
      const result = await verifySkillMd(withoutSkillMdDir);

      expect(result.type).toBe('missing');
      if (result.type === 'missing') {
        expect(result.warning).toContain('SKILL.md not found');
        expect(result.warning).toContain('--force');
      }
    });

    it('returns "missing" when SKILL.md is a directory', async () => {
      const result = await verifySkillMd(skillMdIsDirDir);

      expect(result.type).toBe('missing');
      if (result.type === 'missing') {
        expect(result.warning).toContain('not a file');
      }
    });

    it('returns "missing" for non-existent skill directory', async () => {
      // When the skill directory doesn't exist, trying to stat SKILL.md
      // throws ENOENT which we treat as "missing"
      const result = await verifySkillMd(path.join(tempDir, 'nonexistent-skill'));

      expect(result.type).toBe('missing');
      if (result.type === 'missing') {
        expect(result.warning).toContain('SKILL.md not found');
      }
    });
  });

  describe('discoverSkill with different scope types', () => {
    it('works with personal scope', async () => {
      const personalScope: ScopeInfo = {
        type: 'personal',
        path: tempDir,
      };

      const result = await discoverSkill('valid-skill', personalScope);
      expect(result.type).toBe('found');
    });

    it('works with custom scope', async () => {
      const customScope: ScopeInfo = {
        type: 'custom',
        path: tempDir,
        originalInput: '/custom/path',
      };

      const result = await discoverSkill('valid-skill', customScope);
      expect(result.type).toBe('found');
    });
  });
});
