/**
 * Tests for tool-patterns shared utility
 */

import { validateToolEntry, validateToolList } from '../../../src/validators/tool-patterns';

describe('validateToolEntry', () => {
  describe('valid entries', () => {
    it('accepts simple tool name', () => {
      expect(validateToolEntry('Read')).toBe(true);
    });

    it('accepts Task(AgentName) pattern', () => {
      expect(validateToolEntry('Task(MyAgent)')).toBe(true);
    });

    it('accepts mcp__server__* pattern', () => {
      expect(validateToolEntry('mcp__server__*')).toBe(true);
    });

    it('accepts mcp__server__command pattern', () => {
      expect(validateToolEntry('mcp__server__command')).toBe(true);
    });

    it('accepts ${CLAUDE_PLUGIN_ROOT} pattern', () => {
      expect(validateToolEntry('${CLAUDE_PLUGIN_ROOT}/path')).toBe(true);
    });

    it('accepts Bash(git:*) pattern', () => {
      expect(validateToolEntry('Bash(git:*)')).toBe(true);
    });

    it('accepts Bash(git *) pattern', () => {
      expect(validateToolEntry('Bash(git *)')).toBe(true);
    });

    it('accepts Bash(*) pattern', () => {
      expect(validateToolEntry('Bash(*)')).toBe(true);
    });

    it('accepts Bash without arguments', () => {
      expect(validateToolEntry('Bash')).toBe(true);
    });
  });

  describe('invalid entries', () => {
    it('rejects empty string', () => {
      expect(validateToolEntry('')).toBe(false);
    });

    it('rejects whitespace-only string', () => {
      expect(validateToolEntry('   ')).toBe(false);
    });

    it('rejects tab-only string', () => {
      expect(validateToolEntry('\t')).toBe(false);
    });
  });
});

describe('validateToolList', () => {
  const fieldName = 'testField';

  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateToolList(fieldName, undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateToolList(fieldName, null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for non-empty string', () => {
      const result = validateToolList(fieldName, 'Read');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for empty array', () => {
      const result = validateToolList(fieldName, []);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for array of strings', () => {
      const result = validateToolList(fieldName, ['Read', 'Write', 'Bash']);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for array with advanced patterns', () => {
      const result = validateToolList(fieldName, [
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
    it('returns invalid for empty string', () => {
      const result = validateToolList(fieldName, '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'testField' must be a non-empty string or an array of strings."
      );
    });

    it('returns invalid for whitespace-only string', () => {
      const result = validateToolList(fieldName, '   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'testField' must be a non-empty string or an array of strings."
      );
    });

    it('returns invalid for array containing empty strings', () => {
      const result = validateToolList(fieldName, ['Read', '', 'Write']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty string at index 1');
    });

    it('returns invalid for array containing whitespace-only strings', () => {
      const result = validateToolList(fieldName, ['Read', '   ']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty string at index 1');
    });

    it('returns invalid for array containing non-strings', () => {
      const result = validateToolList(fieldName, ['Read', 123]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'testField' array must contain only strings. Found non-string entries."
      );
    });

    it('returns invalid for array containing objects', () => {
      const result = validateToolList(fieldName, [{ tool: 'Read' }]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'testField' array must contain only strings. Found non-string entries."
      );
    });

    it('returns invalid for array containing booleans', () => {
      const result = validateToolList(fieldName, [true, false]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "Field 'testField' array must contain only strings. Found non-string entries."
      );
    });

    it('returns invalid for number type', () => {
      const result = validateToolList(fieldName, 42);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'testField\' must be a string or an array of strings. Got type "number".'
      );
    });

    it('returns invalid for boolean type', () => {
      const result = validateToolList(fieldName, true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'testField\' must be a string or an array of strings. Got type "boolean".'
      );
    });

    it('returns invalid for object type', () => {
      const result = validateToolList(fieldName, { tool: 'Read' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        'Field \'testField\' must be a string or an array of strings. Got type "object".'
      );
    });
  });

  describe('field name in error messages', () => {
    it('uses the provided field name in error messages', () => {
      const result = validateToolList('disallowedTools', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('disallowedTools');
    });
  });
});
