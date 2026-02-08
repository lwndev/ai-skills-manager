/**
 * Tests for memory field validator
 */

import { validateMemory } from '../../../src/validators/memory';

describe('validateMemory', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateMemory(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateMemory(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for "user"', () => {
      const result = validateMemory('user');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for "project"', () => {
      const result = validateMemory('project');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for "local"', () => {
      const result = validateMemory('local');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for unknown string value', () => {
      const result = validateMemory('global');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'memory\' must be one of: user, project, local. Got "global".'
      );
    });

    it('returns invalid for empty string', () => {
      const result = validateMemory('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Field \'memory\' must be one of: user, project, local. Got "".');
    });

    it('returns invalid for "User" (case sensitive)', () => {
      const result = validateMemory('User');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'memory\' must be one of: user, project, local. Got "User".'
      );
    });

    it('returns invalid for number type', () => {
      const result = validateMemory(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'memory\' must be one of: user, project, local. Got type "number".'
      );
    });

    it('returns invalid for boolean type', () => {
      const result = validateMemory(true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'memory\' must be one of: user, project, local. Got type "boolean".'
      );
    });

    it('returns invalid for array type', () => {
      const result = validateMemory(['user']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'memory\' must be one of: user, project, local. Got type "object".'
      );
    });

    it('returns invalid for object type', () => {
      const result = validateMemory({ type: 'user' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'memory\' must be one of: user, project, local. Got type "object".'
      );
    });
  });

  describe('edge cases', () => {
    it('returns invalid for "user" with leading space', () => {
      const result = validateMemory(' user');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'memory\' must be one of: user, project, local. Got " user".'
      );
    });

    it('returns invalid for "user" with trailing space', () => {
      const result = validateMemory('user ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'memory\' must be one of: user, project, local. Got "user ".'
      );
    });
  });
});
