/**
 * ASMR Mode Calm Error Formatting
 *
 * Provides gentle, reassuring error presentation that reduces frustration.
 */

import { shouldUseAscii, getTerminalWidth } from '../terminal';

/**
 * Options for calm error formatting
 */
export interface CalmErrorOptions {
  /** Suggestion for how to resolve the error */
  suggestion?: string;
  /** Stream to write to */
  stream?: NodeJS.WriteStream;
  /** Force ASCII mode */
  forceAscii?: boolean;
  /** Max width for wrapping */
  maxWidth?: number;
}

/**
 * Characters for error border
 */
const BORDER_CHAR = '·';
const ASCII_BORDER_CHAR = '.';

/**
 * Error symbol
 */
const ERROR_SYMBOL = '○';
const ASCII_ERROR_SYMBOL = 'o';

/**
 * Format an error message with calm presentation
 *
 * The output avoids harsh symbols and alarming language,
 * presenting the error in a gentle, helpful way.
 *
 * @param message The error message
 * @param options Formatting options
 * @returns Formatted error string
 *
 * @example
 * ```ts
 * console.log(formatCalmError('File not found', {
 *   suggestion: 'Check the file path'
 * }));
 * // Output:
 * // ·  ·  ·
 * // ○ File not found
 * //
 * // Try: Check the file path
 * // ·  ·  ·
 * ```
 */
export function formatCalmError(message: string, options: CalmErrorOptions = {}): string {
  const { suggestion, forceAscii, maxWidth } = options;
  const useAscii = forceAscii ?? shouldUseAscii();
  const width = maxWidth ?? Math.min(getTerminalWidth() - 4, 60);

  const borderChar = useAscii ? ASCII_BORDER_CHAR : BORDER_CHAR;
  const symbol = useAscii ? ASCII_ERROR_SYMBOL : ERROR_SYMBOL;

  // Create dotted border line
  const borderLine = `${borderChar}  ${borderChar}  ${borderChar}`;

  const lines: string[] = [];

  // Top border
  lines.push(borderLine);
  lines.push('');

  // Error message with symbol
  const wrappedMessage = wrapText(`${symbol} ${message}`, width);
  lines.push(...wrappedMessage);

  // Suggestion if provided
  if (suggestion) {
    lines.push('');
    const wrappedSuggestion = wrapText(`Try: ${suggestion}`, width);
    lines.push(...wrappedSuggestion);
  }

  // Bottom border
  lines.push('');
  lines.push(borderLine);

  return lines.join('\n');
}

/**
 * Display a calm error message
 *
 * @param message The error message
 * @param options Formatting options
 */
export function showCalmError(message: string, options: CalmErrorOptions = {}): void {
  const stream = options.stream ?? process.stderr;
  const formatted = formatCalmError(message, options);
  stream.write(`\n${formatted}\n`);
}

/**
 * Format an error from an Error object
 *
 * @param error The error object
 * @param options Formatting options
 * @returns Formatted error string
 */
export function formatCalmErrorFromException(error: Error, options: CalmErrorOptions = {}): string {
  return formatCalmError(error.message, options);
}

/**
 * Gentle suggestions for common error types
 */
export const GENTLE_SUGGESTIONS: Record<string, string> = {
  ENOENT: 'Check that the file or directory exists',
  EACCES: 'Check file permissions or try running with appropriate access',
  EEXIST: 'The file already exists - consider using a different name',
  ENOTDIR: 'The path should be a directory',
  EISDIR: 'The path should be a file, not a directory',
  ETIMEDOUT: 'The operation timed out - try again in a moment',
  ECONNREFUSED: 'Could not connect - check your network connection',
  PARSE_ERROR: 'Check the file format and syntax',
  VALIDATION_ERROR: 'Some fields may be missing or invalid',
} as const;

/**
 * Get a gentle suggestion for an error code
 *
 * @param code Error code (e.g., 'ENOENT')
 * @returns Gentle suggestion or undefined
 */
export function getSuggestionForCode(code: string): string | undefined {
  return GENTLE_SUGGESTIONS[code];
}

/**
 * Wrap text to a maximum width
 *
 * @param text Text to wrap
 * @param maxWidth Maximum line width
 * @returns Array of wrapped lines
 */
function wrapText(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) {
    return [text];
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = '  ' + word; // Indent continuation lines
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Format multiple errors in a calm way
 *
 * @param errors Array of error messages
 * @param options Formatting options
 * @returns Formatted errors string
 */
export function formatCalmErrors(errors: string[], options: CalmErrorOptions = {}): string {
  const { forceAscii, maxWidth } = options;
  const useAscii = forceAscii ?? shouldUseAscii();
  const width = maxWidth ?? Math.min(getTerminalWidth() - 4, 60);

  const borderChar = useAscii ? ASCII_BORDER_CHAR : BORDER_CHAR;
  const symbol = useAscii ? ASCII_ERROR_SYMBOL : ERROR_SYMBOL;

  const borderLine = `${borderChar}  ${borderChar}  ${borderChar}`;

  const lines: string[] = [];

  // Top border
  lines.push(borderLine);
  lines.push('');

  // Each error
  for (let i = 0; i < errors.length; i++) {
    const wrappedMessage = wrapText(`${symbol} ${errors[i]}`, width);
    lines.push(...wrappedMessage);

    if (i < errors.length - 1) {
      lines.push('');
    }
  }

  // Suggestion if provided
  if (options.suggestion) {
    lines.push('');
    const wrappedSuggestion = wrapText(`Try: ${options.suggestion}`, width);
    lines.push(...wrappedSuggestion);
  }

  // Bottom border
  lines.push('');
  lines.push(borderLine);

  return lines.join('\n');
}
