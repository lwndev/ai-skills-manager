/**
 * Tests for disallowedTools field validator
 */

import { validateDisallowedTools } from '../../../src/validators/disallowed-tools';

describe('validateDisallowedTools', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateDisallowedTools(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateDisallowedTools(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for non-empty string', () => {
      const result = validateDisallowedTools('Bash');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for empty array', () => {
      const result = validateDisallowedTools([]);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for array of strings', () => {
      const result = validateDisallowedTools(['Bash', 'Write']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for array with advanced tool patterns', () => {
      const result = validateDisallowedTools(['Task(MyAgent)', 'mcp__server__*', 'Bash(git:*)']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for empty string', () => {
      const result = validateDisallowedTools('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('disallowedTools');
    });

    it('returns invalid for whitespace-only string', () => {
      const result = validateDisallowedTools('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('disallowedTools');
    });

    it('returns invalid for array containing non-strings', () => {
      const result = validateDisallowedTools(['Bash', 123]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('disallowedTools');
    });

    it('returns invalid for number type', () => {
      const result = validateDisallowedTools(42);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('disallowedTools');
    });

    it('returns invalid for boolean type', () => {
      const result = validateDisallowedTools(true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('disallowedTools');
    });

    it('returns invalid for object type', () => {
      const result = validateDisallowedTools({ tool: 'Bash' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('disallowedTools');
    });
  });

  describe('edge cases', () => {
    it('returns valid for single-element array', () => {
      const result = validateDisallowedTools(['Bash']);
      expect(result.valid).toBe(true);
    });

    it('returns valid for string with special characters', () => {
      const result = validateDisallowedTools('${CLAUDE_PLUGIN_ROOT}/path');
      expect(result.valid).toBe(true);
    });
  });
});
