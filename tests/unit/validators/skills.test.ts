/**
 * Tests for skills field validator
 */

import { validateSkills } from '../../../src/validators/skills';

describe('validateSkills', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateSkills(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateSkills(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for non-empty string', () => {
      const result = validateSkills('my-skill');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for empty array', () => {
      const result = validateSkills([]);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for array of strings', () => {
      const result = validateSkills(['skill-a', 'skill-b']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for single-element array', () => {
      const result = validateSkills(['only-skill']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for empty string', () => {
      const result = validateSkills('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'skills' must be a non-empty string or an array of strings."
      );
    });

    it('returns invalid for whitespace-only string', () => {
      const result = validateSkills('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'skills' must be a non-empty string or an array of strings."
      );
    });

    it('returns invalid for array containing non-strings', () => {
      const result = validateSkills(['skill-a', 123]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'skills' array must contain only strings. Found non-string entries."
      );
    });

    it('returns invalid for array containing objects', () => {
      const result = validateSkills([{ name: 'skill' }]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'skills' array must contain only strings. Found non-string entries."
      );
    });

    it('returns invalid for array containing booleans', () => {
      const result = validateSkills([true, false]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'skills' array must contain only strings. Found non-string entries."
      );
    });

    it('returns invalid for number type', () => {
      const result = validateSkills(42);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'skills\' must be a string or an array of strings. Got type "number".'
      );
    });

    it('returns invalid for boolean type', () => {
      const result = validateSkills(true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'skills\' must be a string or an array of strings. Got type "boolean".'
      );
    });

    it('returns invalid for object type', () => {
      const result = validateSkills({ skill: 'a' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'skills\' must be a string or an array of strings. Got type "object".'
      );
    });
  });

  describe('edge cases', () => {
    it('returns invalid for array containing empty strings', () => {
      const result = validateSkills(['']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty string at index 0');
    });

    it('returns invalid for array with empty string among valid entries', () => {
      const result = validateSkills(['helper-a', '', 'helper-b']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty string at index 1');
    });

    it('returns valid for string with special characters', () => {
      const result = validateSkills('my-skill/path:v2');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
