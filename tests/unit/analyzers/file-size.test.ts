/**
 * Tests for file size analyzer
 */

import {
  analyzeFileSize,
  LINE_THRESHOLD,
  TOKEN_THRESHOLD,
  CHARS_PER_TOKEN,
} from '../../../src/analyzers/file-size';

describe('analyzeFileSize', () => {
  describe('basic metrics', () => {
    it('returns zero metrics for empty body', () => {
      const result = analyzeFileSize('');
      expect(result.lineCount).toBe(0);
      expect(result.charCount).toBe(0);
      expect(result.estimatedTokens).toBe(0);
      expect(result.warnings).toEqual([]);
    });

    it('returns zero metrics for whitespace-only body', () => {
      const result = analyzeFileSize('   \n\n   ');
      expect(result.lineCount).toBe(0);
      expect(result.charCount).toBe(0);
      expect(result.warnings).toEqual([]);
    });

    it('counts lines correctly', () => {
      const body = 'Line 1\nLine 2\nLine 3';
      const result = analyzeFileSize(body);
      expect(result.lineCount).toBe(3);
    });

    it('counts characters correctly', () => {
      const body = 'Hello World';
      const result = analyzeFileSize(body);
      expect(result.charCount).toBe(11);
    });

    it('estimates tokens correctly', () => {
      // 12 characters / 4 chars per token = 3 tokens
      const body = 'Hello World!';
      const result = analyzeFileSize(body);
      expect(result.estimatedTokens).toBe(Math.ceil(12 / CHARS_PER_TOKEN));
    });

    it('rounds up token estimate', () => {
      // 5 characters / 4 = 1.25, should round up to 2
      const body = 'Hello';
      const result = analyzeFileSize(body);
      expect(result.estimatedTokens).toBe(2);
    });
  });

  describe('line count warnings', () => {
    it('returns no warning for exactly LINE_THRESHOLD lines', () => {
      const lines = Array(LINE_THRESHOLD).fill('Line');
      const body = lines.join('\n');
      const result = analyzeFileSize(body);
      expect(result.lineCount).toBe(LINE_THRESHOLD);
      expect(result.warnings.some((w) => w.includes('lines'))).toBe(false);
    });

    it('returns warning for LINE_THRESHOLD + 1 lines', () => {
      const lines = Array(LINE_THRESHOLD + 1).fill('Line');
      const body = lines.join('\n');
      const result = analyzeFileSize(body);
      expect(result.lineCount).toBe(LINE_THRESHOLD + 1);
      expect(result.warnings.some((w) => w.includes('lines'))).toBe(true);
      expect(result.warnings.some((w) => w.includes(`${LINE_THRESHOLD + 1}`))).toBe(true);
    });

    it('warning includes recommended threshold', () => {
      const lines = Array(LINE_THRESHOLD + 10).fill('Line');
      const body = lines.join('\n');
      const result = analyzeFileSize(body);
      expect(result.warnings.some((w) => w.includes(`${LINE_THRESHOLD}`))).toBe(true);
    });
  });

  describe('token count warnings', () => {
    it('returns no warning for content under TOKEN_THRESHOLD tokens', () => {
      // Create content that's just under threshold
      const charCount = (TOKEN_THRESHOLD - 1) * CHARS_PER_TOKEN;
      const body = 'x'.repeat(charCount);
      const result = analyzeFileSize(body);
      expect(result.warnings.some((w) => w.includes('tokens'))).toBe(false);
    });

    it('returns warning for content exceeding TOKEN_THRESHOLD tokens', () => {
      // Create content that exceeds threshold
      const charCount = (TOKEN_THRESHOLD + 1) * CHARS_PER_TOKEN;
      const body = 'x'.repeat(charCount);
      const result = analyzeFileSize(body);
      expect(result.warnings.some((w) => w.includes('tokens'))).toBe(true);
    });

    it('warning includes actual token estimate', () => {
      const charCount = (TOKEN_THRESHOLD + 100) * CHARS_PER_TOKEN;
      const body = 'x'.repeat(charCount);
      const result = analyzeFileSize(body);
      const expectedTokens = TOKEN_THRESHOLD + 100;
      expect(result.warnings.some((w) => w.includes(`${expectedTokens}`))).toBe(true);
    });
  });

  describe('multiple warnings', () => {
    it('returns both warnings when both thresholds exceeded', () => {
      // Create content with many lines AND many characters
      const line = 'x'.repeat(100);
      const lines = Array(LINE_THRESHOLD + 1).fill(line);
      const body = lines.join('\n');
      const result = analyzeFileSize(body);

      // Should have line warning
      expect(result.warnings.some((w) => w.includes('lines'))).toBe(true);
      // Should have token warning (many characters)
      expect(result.warnings.some((w) => w.includes('tokens'))).toBe(true);
      expect(result.warnings.length).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('handles single line body', () => {
      const result = analyzeFileSize('Single line');
      expect(result.lineCount).toBe(1);
      expect(result.warnings).toEqual([]);
    });

    it('handles body with trailing newline', () => {
      const result = analyzeFileSize('Line 1\nLine 2\n');
      expect(result.lineCount).toBe(3); // includes empty line after newline
    });

    it('handles unicode content', () => {
      const body = '🎉 Unicode content with emoji';
      const result = analyzeFileSize(body);
      expect(result.charCount).toBe(body.length);
      expect(result.lineCount).toBe(1);
    });

    it('handles tabs and special whitespace', () => {
      const body = 'Line\twith\ttabs\nAnd multiple lines';
      const result = analyzeFileSize(body);
      expect(result.lineCount).toBe(2);
    });
  });

  describe('thresholds', () => {
    it('LINE_THRESHOLD is 500', () => {
      expect(LINE_THRESHOLD).toBe(500);
    });

    it('TOKEN_THRESHOLD is 5000', () => {
      expect(TOKEN_THRESHOLD).toBe(5000);
    });

    it('CHARS_PER_TOKEN is 4', () => {
      expect(CHARS_PER_TOKEN).toBe(4);
    });
  });
});
