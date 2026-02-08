/**
 * Tests for keep-coding-instructions field validator
 */

import { validateKeepCodingInstructions } from '../../../src/validators/keep-coding-instructions';

describe('validateKeepCodingInstructions', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateKeepCodingInstructions(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateKeepCodingInstructions(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for true', () => {
      const result = validateKeepCodingInstructions(true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for false', () => {
      const result = validateKeepCodingInstructions(false);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for string "true"', () => {
      const result = validateKeepCodingInstructions('true');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'keep-coding-instructions\' must be a boolean (true or false). Got type "string".'
      );
    });

    it('returns invalid for string "false"', () => {
      const result = validateKeepCodingInstructions('false');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'keep-coding-instructions\' must be a boolean (true or false). Got type "string".'
      );
    });

    it('returns invalid for number type', () => {
      const result = validateKeepCodingInstructions(1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'keep-coding-instructions\' must be a boolean (true or false). Got type "number".'
      );
    });

    it('returns invalid for number 0', () => {
      const result = validateKeepCodingInstructions(0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'keep-coding-instructions\' must be a boolean (true or false). Got type "number".'
      );
    });

    it('returns invalid for array type', () => {
      const result = validateKeepCodingInstructions([true]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'keep-coding-instructions\' must be a boolean (true or false). Got type "object".'
      );
    });

    it('returns invalid for object type', () => {
      const result = validateKeepCodingInstructions({ value: true });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'keep-coding-instructions\' must be a boolean (true or false). Got type "object".'
      );
    });
  });
});
