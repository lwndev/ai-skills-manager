/**
 * Tests for ASMR Mode Calm Error Formatting
 */

import {
  formatCalmError,
  showCalmError,
  formatCalmErrorFromException,
  formatCalmErrors,
  getSuggestionForCode,
  GENTLE_SUGGESTIONS,
} from '../../../../src/utils/asmr/errors';

// Mock terminal utilities
jest.mock('../../../../src/utils/terminal', () => ({
  shouldUseAscii: jest.fn(() => false),
  isTTY: jest.fn(() => true),
  getTerminalWidth: jest.fn(() => 80),
}));

import { shouldUseAscii } from '../../../../src/utils/terminal';

describe('errors', () => {
  beforeEach(() => {
    (shouldUseAscii as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('formatCalmError', () => {
    it('formats error with dotted border', () => {
      const result = formatCalmError('Something went wrong');

      expect(result).toContain('·  ·  ·');
      expect(result).toContain('○ Something went wrong');
    });

    it('uses ASCII characters when in ASCII mode', () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);

      const result = formatCalmError('Something went wrong');

      expect(result).toContain('.  .  .');
      expect(result).toContain('o Something went wrong');
    });

    it('includes suggestion when provided', () => {
      const result = formatCalmError('File not found', {
        suggestion: 'Check the file path',
      });

      expect(result).toContain('Try: Check the file path');
    });

    it('omits suggestion line when not provided', () => {
      const result = formatCalmError('Something went wrong');

      expect(result).not.toContain('Try:');
    });

    it('respects forceAscii option', () => {
      const result = formatCalmError('Error', { forceAscii: true });

      expect(result).toContain('.  .  .');
      expect(result).toContain('o Error');
    });

    it('wraps long messages', () => {
      const longMessage =
        'This is a very long error message that should be wrapped to multiple lines because it exceeds the maximum width';

      const result = formatCalmError(longMessage, { maxWidth: 40 });

      // Should have multiple lines for the message
      const lines = result.split('\n');
      const messageLines = lines.filter((line) => line.includes('○') || line.startsWith('  '));
      expect(messageLines.length).toBeGreaterThan(1);
    });

    it('has top and bottom borders', () => {
      const result = formatCalmError('Error');

      const lines = result.split('\n');
      expect(lines[0]).toBe('·  ·  ·');
      expect(lines[lines.length - 1]).toBe('·  ·  ·');
    });

    it('has blank lines for visual separation', () => {
      const result = formatCalmError('Error', { suggestion: 'Try this' });

      const lines = result.split('\n');
      // Should have blank lines after border and between sections
      expect(lines).toContain('');
    });
  });

  describe('showCalmError', () => {
    let mockStream: { write: jest.Mock };

    beforeEach(() => {
      mockStream = { write: jest.fn() };
    });

    it('writes formatted error to stream', () => {
      showCalmError('Error message', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      expect(mockStream.write).toHaveBeenCalled();
      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('○ Error message');
    });

    it('adds newlines around the error', () => {
      showCalmError('Error', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      const output = mockStream.write.mock.calls[0][0];
      expect(output.startsWith('\n')).toBe(true);
      expect(output.endsWith('\n')).toBe(true);
    });

    it('passes suggestion to formatter', () => {
      showCalmError('Error', {
        stream: mockStream as unknown as NodeJS.WriteStream,
        suggestion: 'Try this',
      });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('Try: Try this');
    });
  });

  describe('formatCalmErrorFromException', () => {
    it('formats error message from Error object', () => {
      const error = new Error('File not found');
      const result = formatCalmErrorFromException(error);

      expect(result).toContain('○ File not found');
    });

    it('accepts options', () => {
      const error = new Error('Permission denied');
      const result = formatCalmErrorFromException(error, {
        suggestion: 'Check permissions',
      });

      expect(result).toContain('Try: Check permissions');
    });
  });

  describe('formatCalmErrors', () => {
    it('formats multiple errors', () => {
      const errors = ['First error', 'Second error', 'Third error'];
      const result = formatCalmErrors(errors);

      expect(result).toContain('○ First error');
      expect(result).toContain('○ Second error');
      expect(result).toContain('○ Third error');
    });

    it('has single border around all errors', () => {
      const errors = ['Error 1', 'Error 2'];
      const result = formatCalmErrors(errors);

      const lines = result.split('\n');
      const borderLines = lines.filter((line) => line === '·  ·  ·');
      expect(borderLines.length).toBe(2); // Top and bottom only
    });

    it('includes shared suggestion', () => {
      const errors = ['Error 1', 'Error 2'];
      const result = formatCalmErrors(errors, {
        suggestion: 'Try fixing these issues',
      });

      expect(result).toContain('Try: Try fixing these issues');
    });

    it('uses ASCII when forced', () => {
      const errors = ['Error'];
      const result = formatCalmErrors(errors, { forceAscii: true });

      expect(result).toContain('.  .  .');
      expect(result).toContain('o Error');
    });
  });

  describe('GENTLE_SUGGESTIONS', () => {
    it('has suggestions for common error codes', () => {
      expect(GENTLE_SUGGESTIONS.ENOENT).toBeDefined();
      expect(GENTLE_SUGGESTIONS.EACCES).toBeDefined();
      expect(GENTLE_SUGGESTIONS.EEXIST).toBeDefined();
      expect(GENTLE_SUGGESTIONS.ETIMEDOUT).toBeDefined();
    });

    it('suggestions are helpful and non-alarming', () => {
      const alarmingWords = ['error', 'fail', 'crash', 'fatal', 'abort'];

      for (const suggestion of Object.values(GENTLE_SUGGESTIONS)) {
        const lowerSuggestion = suggestion.toLowerCase();
        for (const word of alarmingWords) {
          expect(lowerSuggestion).not.toContain(word);
        }
      }
    });
  });

  describe('getSuggestionForCode', () => {
    it('returns suggestion for known code', () => {
      expect(getSuggestionForCode('ENOENT')).toBe(GENTLE_SUGGESTIONS.ENOENT);
      expect(getSuggestionForCode('EACCES')).toBe(GENTLE_SUGGESTIONS.EACCES);
    });

    it('returns undefined for unknown code', () => {
      expect(getSuggestionForCode('UNKNOWN_CODE')).toBeUndefined();
    });
  });
});
