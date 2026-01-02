import { validateSkillName } from '../../../src/validators/uninstall-name';

describe('validateSkillName (uninstall)', () => {
  describe('valid names', () => {
    it('accepts simple lowercase name', () => {
      expect(validateSkillName('myskill')).toEqual({ valid: true });
    });

    it('accepts name with numbers', () => {
      expect(validateSkillName('skill123')).toEqual({ valid: true });
    });

    it('accepts name with hyphens', () => {
      expect(validateSkillName('my-skill-name')).toEqual({ valid: true });
    });

    it('accepts single character name', () => {
      expect(validateSkillName('a')).toEqual({ valid: true });
    });

    it('accepts name at max length (64 chars)', () => {
      const name = 'a'.repeat(64);
      expect(validateSkillName(name)).toEqual({ valid: true });
    });

    it('accepts numbers only', () => {
      expect(validateSkillName('123')).toEqual({ valid: true });
    });

    it('accepts number prefixed name', () => {
      expect(validateSkillName('1skill')).toEqual({ valid: true });
    });
  });

  describe('invalid names - empty', () => {
    it('rejects empty string', () => {
      const result = validateSkillName('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('rejects whitespace only', () => {
      const result = validateSkillName('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });
  });

  describe('invalid names - length', () => {
    it('rejects name over 64 characters', () => {
      const name = 'a'.repeat(65);
      const result = validateSkillName(name);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('64 characters or less');
    });
  });

  describe('invalid names - pattern', () => {
    it('rejects uppercase letters', () => {
      const result = validateSkillName('MySkill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('rejects leading hyphen', () => {
      const result = validateSkillName('-myskill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot start with a hyphen');
    });

    it('rejects trailing hyphen', () => {
      const result = validateSkillName('myskill-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot end with a hyphen');
    });

    it('rejects consecutive hyphens', () => {
      const result = validateSkillName('my--skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive hyphens');
    });

    it('rejects spaces', () => {
      const result = validateSkillName('my skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('rejects underscores', () => {
      const result = validateSkillName('my_skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });
  });

  describe('security - path separators', () => {
    it('rejects forward slash', () => {
      const result = validateSkillName('my/skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path separators');
    });

    it('rejects backslash', () => {
      const result = validateSkillName('my\\skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path separators');
    });

    it('rejects path with leading slash (caught by path separators check)', () => {
      const result = validateSkillName('/etc/passwd');
      expect(result.valid).toBe(false);
      // Path separator check happens before absolute path check
      expect(result.error).toContain('path separators');
    });

    it('rejects complex path traversal', () => {
      const result = validateSkillName('skill/../../../etc/passwd');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path separators');
    });
  });

  describe('security - path traversal', () => {
    it('rejects single dot', () => {
      const result = validateSkillName('.');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path traversal');
    });

    it('rejects double dot', () => {
      const result = validateSkillName('..');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('path traversal');
    });

    it('rejects parent directory reference with slash (caught by path separators)', () => {
      const result = validateSkillName('../parent');
      expect(result.valid).toBe(false);
      // Path separator check happens first
      expect(result.error).toContain('path separators');
    });

    it('rejects parent directory reference with backslash (caught by path separators)', () => {
      const result = validateSkillName('..\\parent');
      expect(result.valid).toBe(false);
      // Path separator check happens first
      expect(result.error).toContain('path separators');
    });
  });

  describe('security - absolute paths', () => {
    it('rejects Unix absolute path (caught by path separators)', () => {
      const result = validateSkillName('/etc/passwd');
      expect(result.valid).toBe(false);
      // Path separator check happens first for paths containing /
      expect(result.error).toContain('path separators');
    });

    it('rejects Windows absolute path (caught by path separators)', () => {
      const result = validateSkillName('C:\\Windows\\System32');
      expect(result.valid).toBe(false);
      // Path separator check happens first for paths containing \
      expect(result.error).toContain('path separators');
    });

    it('rejects Windows path with lowercase drive (caught by path separators)', () => {
      const result = validateSkillName('c:\\users');
      expect(result.valid).toBe(false);
      // Path separator check happens first for paths containing \
      expect(result.error).toContain('path separators');
    });

    it('rejects bare drive letter without separator', () => {
      // Test that absolute path check works when no separator present
      const result = validateSkillName('C:');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('absolute path');
    });
  });

  describe('security - control characters', () => {
    it('rejects null byte', () => {
      const result = validateSkillName('skill\x00name');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('control characters');
    });

    it('rejects tab character', () => {
      const result = validateSkillName('skill\tname');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('control characters');
    });

    it('rejects newline character', () => {
      const result = validateSkillName('skill\nname');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('control characters');
    });

    it('rejects carriage return', () => {
      const result = validateSkillName('skill\rname');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('control characters');
    });

    it('rejects bell character', () => {
      const result = validateSkillName('skill\x07name');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('control characters');
    });

    it('rejects DEL character', () => {
      const result = validateSkillName('skill\x7fname');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('control characters');
    });
  });

  describe('security - non-ASCII characters', () => {
    it('rejects Unicode letters', () => {
      const result = validateSkillName('skill\u00e9'); // e with accent
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ASCII');
    });

    it('rejects emoji', () => {
      const result = validateSkillName('skill\u{1F600}'); // grinning face
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ASCII');
    });

    it('rejects homoglyph attack (Cyrillic a)', () => {
      const result = validateSkillName('skill\u0430'); // Cyrillic small letter a
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ASCII');
    });

    it('rejects zero-width characters', () => {
      const result = validateSkillName('skill\u200B'); // zero-width space
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ASCII');
    });

    it('rejects right-to-left override', () => {
      const result = validateSkillName('skill\u202E'); // RTL override
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ASCII');
    });

    it('rejects Chinese characters', () => {
      const result = validateSkillName('\u4e2d\u6587'); // Chinese characters
      expect(result.valid).toBe(false);
      expect(result.error).toContain('ASCII');
    });
  });

  describe('security - URL encoded attacks', () => {
    // Note: These are tested as literal strings - URL decoding should happen
    // at the command line level, but we test that encoded sequences fail format validation

    it('rejects percent-encoded forward slash literal', () => {
      const result = validateSkillName('skill%2Fname');
      expect(result.valid).toBe(false);
      // This fails pattern validation because % is not allowed
    });

    it('rejects percent-encoded dot-dot literal', () => {
      const result = validateSkillName('%2e%2e');
      expect(result.valid).toBe(false);
      // This fails pattern validation because % is not allowed
    });
  });

  describe('edge cases', () => {
    it('rejects name that is just a hyphen', () => {
      const result = validateSkillName('-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot start with a hyphen');
    });

    it('rejects name with only hyphens', () => {
      const result = validateSkillName('---');
      expect(result.valid).toBe(false);
    });

    it('accepts longest valid name with pattern', () => {
      // 64 chars with hyphens: a-b-c pattern
      const name = 'a-' + 'b-'.repeat(30) + 'c';
      expect(name.length).toBeLessThanOrEqual(64);
      expect(validateSkillName(name)).toEqual({ valid: true });
    });
  });
});
