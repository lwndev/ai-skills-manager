/**
 * Tests for permission-mode field validator
 */

import { validatePermissionMode } from '../../../src/validators/permission-mode';

describe('validatePermissionMode', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validatePermissionMode(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validatePermissionMode(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for non-empty string', () => {
      const result = validatePermissionMode('default');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for any non-empty string value', () => {
      const result = validatePermissionMode('plan');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for empty string', () => {
      const result = validatePermissionMode('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'permissionMode' must be a non-empty string if specified.");
    });

    it('returns invalid for whitespace-only string', () => {
      const result = validatePermissionMode('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'permissionMode' must be a non-empty string if specified.");
    });

    it('returns invalid for number type', () => {
      const result = validatePermissionMode(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'permissionMode\' must be a non-empty string if specified. Got type "number".'
      );
    });

    it('returns invalid for boolean type', () => {
      const result = validatePermissionMode(true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'permissionMode\' must be a non-empty string if specified. Got type "boolean".'
      );
    });

    it('returns invalid for array type', () => {
      const result = validatePermissionMode(['default']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'permissionMode\' must be a non-empty string if specified. Got type "object".'
      );
    });

    it('returns invalid for object type', () => {
      const result = validatePermissionMode({ mode: 'default' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'permissionMode\' must be a non-empty string if specified. Got type "object".'
      );
    });
  });
});
