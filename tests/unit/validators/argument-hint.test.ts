/**
 * Tests for argument-hint field validator
 */

import { validateArgumentHint } from '../../../src/validators/argument-hint';

describe('validateArgumentHint', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateArgumentHint(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateArgumentHint(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for non-empty string', () => {
      const result = validateArgumentHint('Enter a search query');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for string at exactly 200 characters', () => {
      const result = validateArgumentHint('a'.repeat(200));
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for short string', () => {
      const result = validateArgumentHint('x');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for empty string', () => {
      const result = validateArgumentHint('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'argument-hint' must be a non-empty string if specified.");
    });

    it('returns invalid for whitespace-only string', () => {
      const result = validateArgumentHint('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'argument-hint' must be a non-empty string if specified.");
    });

    it('returns invalid for string exceeding 200 characters', () => {
      const longString = 'a'.repeat(201);
      const result = validateArgumentHint(longString);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'argument-hint' must be at most 200 characters. Got 201 characters."
      );
    });

    it('returns invalid for very long string', () => {
      const longString = 'a'.repeat(500);
      const result = validateArgumentHint(longString);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'argument-hint' must be at most 200 characters. Got 500 characters."
      );
    });

    it('returns invalid for number type', () => {
      const result = validateArgumentHint(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'argument-hint\' must be a non-empty string if specified. Got type "number".'
      );
    });

    it('returns invalid for boolean type', () => {
      const result = validateArgumentHint(true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'argument-hint\' must be a non-empty string if specified. Got type "boolean".'
      );
    });

    it('returns invalid for array type', () => {
      const result = validateArgumentHint(['hint']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'argument-hint\' must be a non-empty string if specified. Got type "object".'
      );
    });

    it('returns invalid for object type', () => {
      const result = validateArgumentHint({ hint: 'text' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'argument-hint\' must be a non-empty string if specified. Got type "object".'
      );
    });
  });

  describe('edge cases', () => {
    it('returns valid for string with special characters', () => {
      const result = validateArgumentHint('Enter a URL (e.g., https://example.com)');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for string with unicode characters', () => {
      const result = validateArgumentHint('Entrez une requête 🔍');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
