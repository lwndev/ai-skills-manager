/**
 * Tests for tools field validator
 */

import { validateTools } from '../../../src/validators/tools';

describe('validateTools', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateTools(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateTools(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for non-empty string', () => {
      const result = validateTools('Read');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for empty array', () => {
      const result = validateTools([]);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for array of strings', () => {
      const result = validateTools(['Read', 'Write', 'Bash']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for array with advanced tool patterns', () => {
      const result = validateTools([
        'Task(MyAgent)',
        'mcp__server__*',
        '${CLAUDE_PLUGIN_ROOT}/path',
        'Bash(git:*)',
        'Bash(*)',
      ]);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for empty string', () => {
      const result = validateTools('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tools');
    });

    it('returns invalid for whitespace-only string', () => {
      const result = validateTools('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tools');
    });

    it('returns invalid for array containing non-strings', () => {
      const result = validateTools(['Read', 42]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tools');
    });

    it('returns invalid for number type', () => {
      const result = validateTools(42);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tools');
    });

    it('returns invalid for boolean type', () => {
      const result = validateTools(true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tools');
    });

    it('returns invalid for object type', () => {
      const result = validateTools({ tool: 'Read' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tools');
    });
  });

  describe('edge cases', () => {
    it('returns valid for single-element array', () => {
      const result = validateTools(['Read']);
      expect(result.valid).toBe(true);
    });

    it('returns valid for Bash without arguments', () => {
      const result = validateTools('Bash');
      expect(result.valid).toBe(true);
    });

    it('returns valid for string with special characters', () => {
      const result = validateTools('Bash(git push:*)');
      expect(result.valid).toBe(true);
    });
  });
});
