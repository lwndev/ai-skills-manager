import { validateName } from '../../src/validators/name';

describe('validateName', () => {
  describe('valid names', () => {
    it('accepts simple lowercase name', () => {
      expect(validateName('myskill')).toEqual({ valid: true });
    });

    it('accepts name with numbers', () => {
      expect(validateName('skill123')).toEqual({ valid: true });
    });

    it('accepts name with hyphens', () => {
      expect(validateName('my-skill-name')).toEqual({ valid: true });
    });

    it('accepts single character name', () => {
      expect(validateName('a')).toEqual({ valid: true });
    });

    it('accepts name at max length (64 chars)', () => {
      const name = 'a'.repeat(64);
      expect(validateName(name)).toEqual({ valid: true });
    });
  });

  describe('invalid names - empty', () => {
    it('rejects empty string', () => {
      const result = validateName('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('rejects whitespace only', () => {
      const result = validateName('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });
  });

  describe('invalid names - length', () => {
    it('rejects name over 64 characters', () => {
      const name = 'a'.repeat(65);
      const result = validateName(name);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('64 characters or less');
    });
  });

  describe('invalid names - pattern', () => {
    it('rejects uppercase letters', () => {
      const result = validateName('MySkill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('rejects leading hyphen', () => {
      const result = validateName('-myskill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot start or end with a hyphen');
    });

    it('rejects trailing hyphen', () => {
      const result = validateName('myskill-');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot start or end with a hyphen');
    });

    it('rejects consecutive hyphens', () => {
      const result = validateName('my--skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive hyphens');
    });

    it('rejects spaces', () => {
      const result = validateName('my skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('rejects special characters', () => {
      const result = validateName('my_skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });
  });

  describe('invalid names - reserved words', () => {
    it('rejects "anthropic"', () => {
      const result = validateName('anthropic');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('reserved word');
    });

    it('rejects "claude"', () => {
      const result = validateName('claude');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('reserved word');
    });

    it('rejects names containing "anthropic"', () => {
      const result = validateName('my-anthropic-skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('reserved word');
    });

    it('rejects names containing "claude"', () => {
      const result = validateName('claude-helper');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('reserved word');
    });
  });
});
