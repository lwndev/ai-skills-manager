/**
 * Tests for user-invocable field validator
 */

import { validateUserInvocable } from '../../../src/validators/user-invocable';

describe('validateUserInvocable', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateUserInvocable(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateUserInvocable(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for true', () => {
      const result = validateUserInvocable(true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for false', () => {
      const result = validateUserInvocable(false);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for string "true"', () => {
      const result = validateUserInvocable('true');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "string".'
      );
    });

    it('returns invalid for string "false"', () => {
      const result = validateUserInvocable('false');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "string".'
      );
    });

    it('returns invalid for empty string', () => {
      const result = validateUserInvocable('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "string".'
      );
    });

    it('returns invalid for string "yes"', () => {
      const result = validateUserInvocable('yes');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "string".'
      );
    });

    it('returns invalid for number 1', () => {
      const result = validateUserInvocable(1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "number".'
      );
    });

    it('returns invalid for number 0', () => {
      const result = validateUserInvocable(0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "number".'
      );
    });

    it('returns invalid for array type', () => {
      const result = validateUserInvocable([true]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "object".'
      );
    });

    it('returns invalid for object type', () => {
      const result = validateUserInvocable({ value: true });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "object".'
      );
    });
  });

  describe('edge cases', () => {
    it('returns invalid for Boolean object wrapper', () => {
      const boolObject = Object(true); // Create Boolean object wrapper
      const result = validateUserInvocable(boolObject);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "object".'
      );
    });

    it('returns invalid for string "TRUE" (case insensitive attempt)', () => {
      const result = validateUserInvocable('TRUE');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "string".'
      );
    });

    it('returns invalid for string "1"', () => {
      const result = validateUserInvocable('1');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "string".'
      );
    });

    it('returns invalid for NaN', () => {
      const result = validateUserInvocable(NaN);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "number".'
      );
    });

    it('returns invalid for Infinity', () => {
      const result = validateUserInvocable(Infinity);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'user-invocable\' must be a boolean (true or false), got "number".'
      );
    });
  });
});
