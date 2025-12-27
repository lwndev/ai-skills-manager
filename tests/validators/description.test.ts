import { validateDescription } from '../../src/validators/description';

describe('validateDescription', () => {
  describe('valid descriptions', () => {
    it('accepts simple description', () => {
      expect(validateDescription('A simple skill description')).toEqual({
        valid: true,
      });
    });

    it('accepts description with special characters', () => {
      expect(
        validateDescription('Handles files, processes data, and more!')
      ).toEqual({ valid: true });
    });

    it('accepts description at max length (1024 chars)', () => {
      const description = 'a'.repeat(1024);
      expect(validateDescription(description)).toEqual({ valid: true });
    });

    it('accepts description with newlines', () => {
      expect(validateDescription('Line 1\nLine 2\nLine 3')).toEqual({
        valid: true,
      });
    });

    it('accepts description with quotes', () => {
      expect(validateDescription('Use when user says "help"')).toEqual({
        valid: true,
      });
    });
  });

  describe('invalid descriptions - empty', () => {
    it('rejects empty string', () => {
      const result = validateDescription('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('rejects whitespace only', () => {
      const result = validateDescription('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });
  });

  describe('invalid descriptions - length', () => {
    it('rejects description over 1024 characters', () => {
      const description = 'a'.repeat(1025);
      const result = validateDescription(description);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('1024 characters or less');
    });
  });

  describe('invalid descriptions - angle brackets', () => {
    it('rejects description with < character', () => {
      const result = validateDescription('Use for <xml> processing');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('angle brackets');
    });

    it('rejects description with > character', () => {
      const result = validateDescription('Greater than -> comparison');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('angle brackets');
    });

    it('rejects description with both angle brackets', () => {
      const result = validateDescription('Process <data> tags');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('angle brackets');
    });
  });
});
