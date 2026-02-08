/**
 * Tests for version field validator
 */

import { validateVersion } from '../../../src/validators/version';

describe('validateVersion', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateVersion(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateVersion(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for semver string', () => {
      const result = validateVersion('1.0.0');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for simple version string', () => {
      const result = validateVersion('v2');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for any non-empty string', () => {
      const result = validateVersion('latest');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for empty string', () => {
      const result = validateVersion('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'version' must be a non-empty string if specified.");
    });

    it('returns invalid for whitespace-only string', () => {
      const result = validateVersion('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'version' must be a non-empty string if specified.");
    });

    it('returns invalid for number type', () => {
      const result = validateVersion(1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'version\' must be a non-empty string if specified. Got type "number".'
      );
    });

    it('returns invalid for boolean type', () => {
      const result = validateVersion(true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'version\' must be a non-empty string if specified. Got type "boolean".'
      );
    });

    it('returns invalid for array type', () => {
      const result = validateVersion(['1.0.0']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'version\' must be a non-empty string if specified. Got type "object".'
      );
    });

    it('returns invalid for object type', () => {
      const result = validateVersion({ version: '1.0.0' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'version\' must be a non-empty string if specified. Got type "object".'
      );
    });
  });
});
