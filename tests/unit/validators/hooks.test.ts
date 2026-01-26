/**
 * Tests for hooks field validator
 */

import { validateHooks } from '../../../src/validators/hooks';

describe('validateHooks', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateHooks(undefined);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for null (optional field)', () => {
      const result = validateHooks(null);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for empty object', () => {
      const result = validateHooks({});
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for PreToolUse with string value', () => {
      const result = validateHooks({ PreToolUse: './scripts/pre-tool.sh' });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for PreToolUse with array of strings', () => {
      const result = validateHooks({ PreToolUse: ['./script1.sh', './script2.sh'] });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for PostToolUse with string value', () => {
      const result = validateHooks({ PostToolUse: './scripts/post-tool.sh' });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for PostToolUse with array of strings', () => {
      const result = validateHooks({ PostToolUse: ['./script1.sh', './script2.sh'] });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for Stop with string value', () => {
      const result = validateHooks({ Stop: './scripts/stop.sh' });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for Stop with array of strings', () => {
      const result = validateHooks({ Stop: ['./cleanup.sh', './report.sh'] });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for all known hooks combined', () => {
      const result = validateHooks({
        PreToolUse: './pre.sh',
        PostToolUse: ['./post1.sh', './post2.sh'],
        Stop: './stop.sh',
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for empty string hook value', () => {
      const result = validateHooks({ PreToolUse: '' });
      expect(result.valid).toBe(true);
    });

    it('returns valid for empty array hook value', () => {
      const result = validateHooks({ PreToolUse: [] });
      expect(result.valid).toBe(true);
    });

    // Claude Code nested format tests
    it('returns valid for Claude Code nested format with matcher and hooks', () => {
      const result = validateHooks({
        PreToolUse: [
          {
            matcher: '*',
            hooks: [{ type: 'command', command: 'echo "test"' }],
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('returns valid for Claude Code nested format with multiple matchers', () => {
      const result = validateHooks({
        PreToolUse: [
          {
            matcher: '*',
            hooks: [{ type: 'command', command: 'echo "pre"' }],
          },
        ],
        PostToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'echo "post bash"' }],
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('returns valid for Claude Code Stop hook format (no matcher)', () => {
      const result = validateHooks({
        Stop: [
          {
            hooks: [{ type: 'command', command: 'echo "stopping"' }],
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('returns valid for hook config with once option', () => {
      const result = validateHooks({
        PreToolUse: [
          {
            matcher: '*',
            hooks: [{ type: 'command', command: 'echo "once"', once: true }],
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('returns valid for complete Claude Code hooks structure', () => {
      const result = validateHooks({
        PreToolUse: [
          {
            matcher: '*',
            hooks: [{ type: 'command', command: 'echo "Starting tool execution..."' }],
          },
        ],
        PostToolUse: [
          {
            matcher: '*',
            hooks: [{ type: 'command', command: 'echo "Tool execution complete"' }],
          },
        ],
        Stop: [
          {
            hooks: [{ type: 'command', command: 'echo "Skill stopped"' }],
          },
        ],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for array type', () => {
      const result = validateHooks(['PreToolUse', 'PostToolUse']);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("Field 'hooks' must be an object if specified.");
      }
    });

    it('returns invalid for string type', () => {
      const result = validateHooks('./hook.sh');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("Field 'hooks' must be an object if specified.");
      }
    });

    it('returns invalid for number type', () => {
      const result = validateHooks(123);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("Field 'hooks' must be an object if specified.");
      }
    });

    it('returns invalid for boolean type', () => {
      const result = validateHooks(true);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("Field 'hooks' must be an object if specified.");
      }
    });

    it('returns invalid for hook with number value', () => {
      const result = validateHooks({ PreToolUse: 123 });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          "Hook 'PreToolUse' must be a string, array of strings, or array of hook config objects."
        );
      }
    });

    it('returns invalid for hook with boolean value', () => {
      const result = validateHooks({ PostToolUse: true });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          "Hook 'PostToolUse' must be a string, array of strings, or array of hook config objects."
        );
      }
    });

    it('returns invalid for hook with invalid object value (no hook config fields)', () => {
      const result = validateHooks({ Stop: { script: './stop.sh' } });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          "Hook 'Stop' must be a string, array of strings, or array of hook config objects."
        );
      }
    });

    it('returns invalid for hook with mixed array', () => {
      const result = validateHooks({ PreToolUse: ['./script.sh', 123] });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          "Hook 'PreToolUse' must be a string, array of strings, or array of hook config objects."
        );
      }
    });

    it('returns invalid for hook with null value', () => {
      const result = validateHooks({ PreToolUse: null });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          "Hook 'PreToolUse' must be a string, array of strings, or array of hook config objects."
        );
      }
    });
  });

  describe('warnings for unknown hooks', () => {
    it('returns warning for unknown hook key', () => {
      const result = validateHooks({ UnknownHook: './script.sh' });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toEqual([
          "Unknown hook 'UnknownHook' in hooks field. Known hooks: PreToolUse, PostToolUse, Stop",
        ]);
      }
    });

    it('returns multiple warnings for multiple unknown hooks', () => {
      const result = validateHooks({
        CustomHook: './custom.sh',
        AnotherHook: './another.sh',
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toHaveLength(2);
        expect(result.warnings).toContain(
          "Unknown hook 'CustomHook' in hooks field. Known hooks: PreToolUse, PostToolUse, Stop"
        );
        expect(result.warnings).toContain(
          "Unknown hook 'AnotherHook' in hooks field. Known hooks: PreToolUse, PostToolUse, Stop"
        );
      }
    });

    it('returns warning for unknown hook alongside known hooks', () => {
      const result = validateHooks({
        PreToolUse: './pre.sh',
        CustomHook: './custom.sh',
        PostToolUse: './post.sh',
      });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toEqual([
          "Unknown hook 'CustomHook' in hooks field. Known hooks: PreToolUse, PostToolUse, Stop",
        ]);
      }
    });

    it('returns warning for case-sensitive mismatch', () => {
      const result = validateHooks({ pretooluse: './script.sh' });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toEqual([
          "Unknown hook 'pretooluse' in hooks field. Known hooks: PreToolUse, PostToolUse, Stop",
        ]);
      }
    });
  });

  describe('edge cases', () => {
    it('handles hook with array containing empty strings', () => {
      const result = validateHooks({ PreToolUse: ['', ''] });
      expect(result.valid).toBe(true);
    });

    it('handles hook with array containing single item', () => {
      const result = validateHooks({ PreToolUse: ['./single.sh'] });
      expect(result.valid).toBe(true);
    });

    it('handles hook with unicode string', () => {
      const result = validateHooks({ PreToolUse: './スクリプト.sh' });
      expect(result.valid).toBe(true);
    });

    it('handles hook with path containing spaces', () => {
      const result = validateHooks({ PreToolUse: './path with spaces/script.sh' });
      expect(result.valid).toBe(true);
    });
  });
});
