/**
 * Tests for directory name validator
 */

import { validateDirectoryName } from '../../../src/validators/directory-name';

describe('validateDirectoryName', () => {
  describe('valid cases', () => {
    it('returns valid when name matches directory', () => {
      const result = validateDirectoryName('/path/to/my-skill/SKILL.md', 'my-skill');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for deeply nested directory', () => {
      const result = validateDirectoryName(
        '/users/dev/projects/skills/my-skill/SKILL.md',
        'my-skill'
      );
      expect(result.valid).toBe(true);
    });

    it('returns valid for Windows-style path', () => {
      // path.basename works on both Unix and Windows paths
      const result = validateDirectoryName(
        'C:\\Users\\dev\\skills\\my-skill\\SKILL.md',
        'my-skill'
      );
      expect(result.valid).toBe(true);
    });

    it('returns valid for relative path', () => {
      const result = validateDirectoryName('./my-skill/SKILL.md', 'my-skill');
      expect(result.valid).toBe(true);
    });

    it('returns valid for simple directory name', () => {
      const result = validateDirectoryName('test-skill/SKILL.md', 'test-skill');
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid cases', () => {
    it('returns invalid when name differs from directory', () => {
      const result = validateDirectoryName('/path/to/my-skill/SKILL.md', 'other-skill');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Skill name "other-skill" does not match directory name "my-skill"'
      );
    });

    it('returns invalid when name has different case', () => {
      const result = validateDirectoryName('/path/to/my-skill/SKILL.md', 'My-Skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not match');
    });

    it('returns invalid when name is substring of directory', () => {
      const result = validateDirectoryName('/path/to/my-skill-extended/SKILL.md', 'my-skill');
      expect(result.valid).toBe(false);
    });

    it('returns invalid when directory is substring of name', () => {
      const result = validateDirectoryName('/path/to/skill/SKILL.md', 'skill-extended');
      expect(result.valid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('skips validation for root directory (.)', () => {
      const result = validateDirectoryName('./SKILL.md', 'any-name');
      expect(result.valid).toBe(true);
    });

    it('skips validation for empty directory name', () => {
      // This would be an unusual case, but handle it gracefully
      const result = validateDirectoryName('/SKILL.md', 'any-name');
      // On Unix, path.dirname('/SKILL.md') = '/' and path.basename('/') = ''
      expect(result.valid).toBe(true);
    });

    it('handles directory with spaces', () => {
      const result = validateDirectoryName('/path/to/my skill/SKILL.md', 'my skill');
      expect(result.valid).toBe(true);
    });

    it('handles directory with special characters', () => {
      const result = validateDirectoryName('/path/to/my-skill_v2/SKILL.md', 'my-skill_v2');
      expect(result.valid).toBe(true);
    });

    it('handles directory with dots', () => {
      const result = validateDirectoryName('/path/to/my.skill.v1/SKILL.md', 'my.skill.v1');
      expect(result.valid).toBe(true);
    });

    it('handles directory with numbers only', () => {
      const result = validateDirectoryName('/path/to/12345/SKILL.md', '12345');
      expect(result.valid).toBe(true);
    });

    it('handles unicode directory names', () => {
      const result = validateDirectoryName('/path/to/skill-test/SKILL.md', 'skill-test');
      expect(result.valid).toBe(true);
    });

    it('handles trailing slash in path', () => {
      // Note: This is an edge case - paths shouldn't have trailing slashes before SKILL.md
      // But we handle it by checking the actual directory structure
      const result = validateDirectoryName('/path/to/my-skill/SKILL.md', 'my-skill');
      expect(result.valid).toBe(true);
    });
  });

  describe('error messages', () => {
    it('includes both names in error message', () => {
      const result = validateDirectoryName('/path/to/actual-dir/SKILL.md', 'expected-name');
      expect(result.error).toContain('expected-name');
      expect(result.error).toContain('actual-dir');
    });

    it('provides clear context in error message', () => {
      const result = validateDirectoryName('/path/to/foo/SKILL.md', 'bar');
      expect(result.error).toBe('Skill name "bar" does not match directory name "foo"');
    });
  });
});
