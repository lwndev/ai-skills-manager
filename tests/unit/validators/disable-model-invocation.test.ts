/**
 * Tests for disable-model-invocation field validator
 */

import { validateDisableModelInvocation } from '../../../src/validators/disable-model-invocation';

describe('validateDisableModelInvocation', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateDisableModelInvocation(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateDisableModelInvocation(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for true', () => {
      const result = validateDisableModelInvocation(true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for false', () => {
      const result = validateDisableModelInvocation(false);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for string "true"', () => {
      const result = validateDisableModelInvocation('true');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'disable-model-invocation\' must be a boolean (true or false), got "string".'
      );
    });

    it('returns invalid for string "false"', () => {
      const result = validateDisableModelInvocation('false');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'disable-model-invocation\' must be a boolean (true or false), got "string".'
      );
    });

    it('returns invalid for number type', () => {
      const result = validateDisableModelInvocation(1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'disable-model-invocation\' must be a boolean (true or false), got "number".'
      );
    });

    it('returns invalid for number 0', () => {
      const result = validateDisableModelInvocation(0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'disable-model-invocation\' must be a boolean (true or false), got "number".'
      );
    });

    it('returns invalid for array type', () => {
      const result = validateDisableModelInvocation([true]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'disable-model-invocation\' must be a boolean (true or false), got "object".'
      );
    });

    it('returns invalid for object type', () => {
      const result = validateDisableModelInvocation({ value: true });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'disable-model-invocation\' must be a boolean (true or false), got "object".'
      );
    });
  });
});
