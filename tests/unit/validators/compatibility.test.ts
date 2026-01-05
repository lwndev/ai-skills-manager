/**
 * Tests for compatibility field validator
 */

import { validateCompatibility } from '../../../src/validators/compatibility';

describe('validateCompatibility', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateCompatibility(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for simple string', () => {
      const result = validateCompatibility('Claude Code 1.0+');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for string with 1 character', () => {
      const result = validateCompatibility('1');
      expect(result.valid).toBe(true);
    });

    it('returns valid for string with exactly 500 characters', () => {
      const result = validateCompatibility('x'.repeat(500));
      expect(result.valid).toBe(true);
    });

    it('returns valid for string with version range', () => {
      const result = validateCompatibility('>=1.0.0 <2.0.0');
      expect(result.valid).toBe(true);
    });

    it('returns valid for string with special characters', () => {
      const result = validateCompatibility('Claude Code v1.0+ (beta)');
      expect(result.valid).toBe(true);
    });

    it('returns valid for multi-line compatibility notes', () => {
      const result = validateCompatibility('Claude Code 1.0+\nRequires MCP support');
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for empty string', () => {
      const result = validateCompatibility('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Compatibility field cannot be empty when present');
    });

    it('returns invalid for whitespace-only string', () => {
      const result = validateCompatibility('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Compatibility field cannot be empty when present');
    });

    it('returns invalid for string exceeding 500 characters', () => {
      const longString = 'x'.repeat(501);
      const result = validateCompatibility(longString);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Compatibility field must be 500 characters or less (got 501)');
    });

    it('returns invalid for number type', () => {
      const result = validateCompatibility(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Compatibility field must be a string');
    });

    it('returns invalid for boolean type', () => {
      const result = validateCompatibility(true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Compatibility field must be a string');
    });

    it('returns invalid for array type', () => {
      const result = validateCompatibility(['1.0', '2.0']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Compatibility field must be a string');
    });

    it('returns invalid for object type', () => {
      const result = validateCompatibility({ min: '1.0', max: '2.0' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Compatibility field must be a string');
    });

    it('returns invalid for null', () => {
      const result = validateCompatibility(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Compatibility field must be a string');
    });
  });

  describe('edge cases', () => {
    it('handles string with leading/trailing whitespace', () => {
      // Note: whitespace is trimmed only for empty check, preserved otherwise
      const result = validateCompatibility('  Claude Code 1.0+  ');
      expect(result.valid).toBe(true);
    });

    it('handles string at exactly 499 characters', () => {
      const result = validateCompatibility('x'.repeat(499));
      expect(result.valid).toBe(true);
    });

    it('handles string at exactly 501 characters', () => {
      const result = validateCompatibility('x'.repeat(501));
      expect(result.valid).toBe(false);
    });

    it('handles unicode characters', () => {
      const result = validateCompatibility('Claude Code >= 1.0 \u2714');
      expect(result.valid).toBe(true);
    });

    it('handles tab characters', () => {
      const result = validateCompatibility('Claude\tCode');
      expect(result.valid).toBe(true);
    });
  });
});
