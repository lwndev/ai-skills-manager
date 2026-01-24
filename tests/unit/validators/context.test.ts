/**
 * Tests for context field validator
 */

import { validateContext } from '../../../src/validators/context';

describe('validateContext', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateContext(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateContext(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for "fork"', () => {
      const result = validateContext('fork');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for empty string', () => {
      const result = validateContext('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field \'context\' must be "fork" if specified, got "".');
    });

    it('returns invalid for other string values', () => {
      const result = validateContext('main');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field \'context\' must be "fork" if specified, got "main".');
    });

    it('returns invalid for "Fork" (case sensitive)', () => {
      const result = validateContext('Fork');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field \'context\' must be "fork" if specified, got "Fork".');
    });

    it('returns invalid for "FORK" (case sensitive)', () => {
      const result = validateContext('FORK');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field \'context\' must be "fork" if specified, got "FORK".');
    });

    it('returns invalid for number type', () => {
      const result = validateContext(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field \'context\' must be "fork" if specified, got "123".');
    });

    it('returns invalid for boolean type', () => {
      const result = validateContext(true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field \'context\' must be "fork" if specified, got "true".');
    });

    it('returns invalid for array type', () => {
      const result = validateContext(['fork']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field \'context\' must be "fork" if specified, got "fork".');
    });

    it('returns invalid for object type', () => {
      const result = validateContext({ value: 'fork' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'context\' must be "fork" if specified, got "[object Object]".'
      );
    });
  });

  describe('edge cases', () => {
    it('returns invalid for whitespace string', () => {
      const result = validateContext('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field \'context\' must be "fork" if specified, got "   ".');
    });

    it('returns invalid for "fork" with leading space', () => {
      const result = validateContext(' fork');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field \'context\' must be "fork" if specified, got " fork".');
    });

    it('returns invalid for "fork" with trailing space', () => {
      const result = validateContext('fork ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field \'context\' must be "fork" if specified, got "fork ".');
    });
  });
});
