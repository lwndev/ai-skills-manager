/**
 * Tests for allowed-tools field validator
 */

import { validateAllowedTools } from '../../../src/validators/allowed-tools';

describe('validateAllowedTools', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateAllowedTools(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateAllowedTools(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for empty array', () => {
      const result = validateAllowedTools([]);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for array of simple tool names', () => {
      const result = validateAllowedTools(['Read', 'Write', 'Bash']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for Task(AgentName) pattern', () => {
      const result = validateAllowedTools(['Task(MyAgent)']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for mcp__server__* pattern', () => {
      const result = validateAllowedTools(['mcp__server__*']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for mcp__server__command pattern', () => {
      const result = validateAllowedTools(['mcp__server__command']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for ${CLAUDE_PLUGIN_ROOT} pattern', () => {
      const result = validateAllowedTools(['${CLAUDE_PLUGIN_ROOT}/path']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for Bash(git:*) pattern', () => {
      const result = validateAllowedTools(['Bash(git:*)']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for Bash(git *) pattern', () => {
      const result = validateAllowedTools(['Bash(git *)']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for Bash(*) pattern', () => {
      const result = validateAllowedTools(['Bash(*)']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for mixed advanced patterns', () => {
      const result = validateAllowedTools([
        'Read',
        'Write',
        'Task(MyAgent)',
        'mcp__server__*',
        '${CLAUDE_PLUGIN_ROOT}/path',
        'Bash(git:*)',
      ]);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for non-array string', () => {
      const result = validateAllowedTools('Read');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'allowed-tools\' must be an array of strings. Got type "string".'
      );
    });

    it('returns invalid for number type', () => {
      const result = validateAllowedTools(42);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'allowed-tools\' must be an array of strings. Got type "number".'
      );
    });

    it('returns invalid for boolean type', () => {
      const result = validateAllowedTools(true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'allowed-tools\' must be an array of strings. Got type "boolean".'
      );
    });

    it('returns invalid for object type', () => {
      const result = validateAllowedTools({ tool: 'Read' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'allowed-tools\' must be an array of strings. Got type "object".'
      );
    });

    it('returns invalid for array containing non-strings', () => {
      const result = validateAllowedTools(['Read', 123]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'allowed-tools' array must contain only strings. Found non-string entry at index 1."
      );
    });

    it('returns invalid for array containing objects', () => {
      const result = validateAllowedTools([{ tool: 'Read' }]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'allowed-tools' array must contain only strings. Found non-string entry at index 0."
      );
    });

    it('returns invalid for array containing empty string', () => {
      const result = validateAllowedTools(['Read', '']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'allowed-tools' array contains an empty string at index 1. Each entry must be a non-empty tool permission pattern."
      );
    });

    it('returns invalid for array containing whitespace-only string', () => {
      const result = validateAllowedTools(['Read', '   ']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'allowed-tools' array contains an empty string at index 1. Each entry must be a non-empty tool permission pattern."
      );
    });
  });

  describe('edge cases', () => {
    it('returns invalid for empty string at index 0', () => {
      const result = validateAllowedTools(['']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('index 0');
    });

    it('returns valid for single-element array', () => {
      const result = validateAllowedTools(['Read']);
      expect(result.valid).toBe(true);
    });

    it('returns invalid for array with boolean at index 0', () => {
      const result = validateAllowedTools([true]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('index 0');
    });
  });
});
