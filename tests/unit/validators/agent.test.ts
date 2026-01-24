/**
 * Tests for agent field validator
 */

import { validateAgent } from '../../../src/validators/agent';

describe('validateAgent', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateAgent(undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for null (optional field)', () => {
      const result = validateAgent(null);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for simple agent name', () => {
      const result = validateAgent('code-review');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for agent with single character', () => {
      const result = validateAgent('a');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for agent with spaces', () => {
      const result = validateAgent('my agent name');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for agent with special characters', () => {
      const result = validateAgent('agent-v1.0');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns valid for long agent name', () => {
      const result = validateAgent('x'.repeat(500));
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for empty string', () => {
      const result = validateAgent('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'agent' must be a non-empty string if specified.");
    });

    it('returns invalid for whitespace-only string', () => {
      const result = validateAgent('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'agent' must be a non-empty string if specified.");
    });

    it('returns invalid for tabs-only string', () => {
      const result = validateAgent('\t\t');
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'agent' must be a non-empty string if specified.");
    });

    it('returns invalid for number type', () => {
      const result = validateAgent(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'agent' must be a non-empty string if specified.");
    });

    it('returns invalid for boolean type', () => {
      const result = validateAgent(true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'agent' must be a non-empty string if specified.");
    });

    it('returns invalid for array type', () => {
      const result = validateAgent(['agent1', 'agent2']);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'agent' must be a non-empty string if specified.");
    });

    it('returns invalid for object type', () => {
      const result = validateAgent({ name: 'my-agent' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'agent' must be a non-empty string if specified.");
    });
  });

  describe('edge cases', () => {
    it('returns valid for string with leading space but content', () => {
      const result = validateAgent(' agent');
      expect(result.valid).toBe(true);
    });

    it('returns valid for string with trailing space but content', () => {
      const result = validateAgent('agent ');
      expect(result.valid).toBe(true);
    });

    it('returns valid for newline in string', () => {
      const result = validateAgent('agent\nname');
      expect(result.valid).toBe(true);
    });

    it('returns valid for unicode characters', () => {
      const result = validateAgent('エージェント');
      expect(result.valid).toBe(true);
    });

    it('returns invalid for newline-only string', () => {
      const result = validateAgent('\n\n');
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Field 'agent' must be a non-empty string if specified.");
    });
  });
});
