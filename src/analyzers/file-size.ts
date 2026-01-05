/**
 * File size analyzer for SKILL.md body content
 *
 * Analyzes the body content (after frontmatter) and generates warnings
 * if the content exceeds recommended thresholds.
 *
 * Thresholds based on spec recommendations:
 * - Lines: 500 (recommended under 500 lines)
 * - Tokens: 5000 (recommended under 5000 tokens)
 */

/**
 * Threshold for line count warning
 */
export const LINE_THRESHOLD = 500;

/**
 * Threshold for estimated token count warning
 */
export const TOKEN_THRESHOLD = 5000;

/**
 * Average characters per token (heuristic)
 * Based on typical English text tokenization
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Result of file size analysis
 */
export interface FileSizeAnalysis {
  /** Number of lines in body content */
  lineCount: number;
  /** Character count in body content */
  charCount: number;
  /** Estimated token count (chars / 4) */
  estimatedTokens: number;
  /** Warning messages (empty if no warnings) */
  warnings: string[];
}

/**
 * Analyze SKILL.md body content for size warnings
 *
 * @param body - The body content after frontmatter
 * @returns Analysis result with metrics and warnings
 */
export function analyzeFileSize(body: string): FileSizeAnalysis {
  // Handle empty/undefined body
  if (!body || body.trim() === '') {
    return {
      lineCount: 0,
      charCount: 0,
      estimatedTokens: 0,
      warnings: [],
    };
  }

  // Count lines (split by newline)
  const lines = body.split('\n');
  const lineCount = lines.length;

  // Count characters
  const charCount = body.length;

  // Estimate tokens (heuristic: ~4 characters per token)
  const estimatedTokens = Math.ceil(charCount / CHARS_PER_TOKEN);

  // Generate warnings
  const warnings: string[] = [];

  if (lineCount > LINE_THRESHOLD) {
    warnings.push(
      `Skill body has ${lineCount} lines (recommended: under ${LINE_THRESHOLD}). ` +
        `Large skills may consume excessive context.`
    );
  }

  if (estimatedTokens > TOKEN_THRESHOLD) {
    warnings.push(
      `Skill body has approximately ${estimatedTokens} tokens (recommended: under ${TOKEN_THRESHOLD}). ` +
        `Large skills may consume excessive context.`
    );
  }

  return {
    lineCount,
    charCount,
    estimatedTokens,
    warnings,
  };
}
