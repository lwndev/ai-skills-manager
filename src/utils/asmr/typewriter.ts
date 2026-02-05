/**
 * ASMR Mode Typewriter Effect
 *
 * Displays text character by character for a calming typing effect.
 * Respects terminal capabilities and allows skip on keypress.
 */

import { isTTY } from '../terminal';
import { sleep, CHARACTER_DELAY_MS, TYPEWRITER_MAX_LENGTH } from './timing';

/**
 * Options for the typewriter effect
 */
export interface TypewriterOptions {
  /** Delay between characters in ms (default: 15ms) */
  delay?: number;
  /** Maximum length before skipping effect (default: 60) */
  maxLength?: number;
  /** Stream to write to (default: process.stdout) */
  stream?: NodeJS.WriteStream;
  /** Whether to add a newline at the end (default: true) */
  newline?: boolean;
  /** Skip the animation and print immediately */
  skipAnimation?: boolean;
}

/**
 * State for tracking typewriter animation
 */
interface TypewriterState {
  aborted: boolean;
}

/**
 * Display text with a typewriter effect
 *
 * The effect types out text character by character at a calming pace.
 * It can be skipped by pressing any key.
 *
 * @param text The text to display
 * @param options Typewriter options
 * @returns Promise that resolves when text is fully displayed
 *
 * @example
 * ```ts
 * await typewrite('Installing skill...');
 * // Output appears character by character
 * ```
 */
export async function typewrite(text: string, options: TypewriterOptions = {}): Promise<void> {
  const {
    delay = CHARACTER_DELAY_MS,
    maxLength = TYPEWRITER_MAX_LENGTH,
    stream = process.stdout,
    newline = true,
    skipAnimation = false,
  } = options;

  // If not a TTY or animation should be skipped, print immediately
  if (!isTTY() || skipAnimation) {
    stream.write(text);
    if (newline) {
      stream.write('\n');
    }
    return;
  }

  // If text is too long, skip the effect for UX
  if (text.length > maxLength) {
    stream.write(text);
    if (newline) {
      stream.write('\n');
    }
    return;
  }

  const state: TypewriterState = { aborted: false };

  // Set up keypress listener to skip animation
  const cleanup = setupSkipListener(state);

  try {
    // Type each character
    for (const char of text) {
      if (state.aborted) {
        // Print remaining text immediately
        const currentPos = text.indexOf(char);
        stream.write(text.slice(currentPos));
        break;
      }

      stream.write(char);
      await sleep(delay);
    }

    if (newline) {
      stream.write('\n');
    }
  } finally {
    cleanup();
  }
}

/**
 * Set up a listener to skip the typewriter animation on keypress
 * Returns a cleanup function to remove the listener
 */
function setupSkipListener(state: TypewriterState): () => void {
  // Only set up listener if stdin is available and is a TTY
  if (!process.stdin || !process.stdin.isTTY) {
    return () => {};
  }

  const wasRaw = process.stdin.isRaw;

  try {
    // Enable raw mode to capture individual keypresses
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const onKeypress = (data: Buffer) => {
      // Check for Ctrl+C to allow interruption
      if (data.length === 1 && data[0] === 0x03) {
        process.exit(130);
      }
      // Any other key skips the animation
      state.aborted = true;
    };

    process.stdin.on('data', onKeypress);

    return () => {
      process.stdin.removeListener('data', onKeypress);
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(wasRaw ?? false);
      }
      process.stdin.pause();
    };
  } catch {
    // If we can't set up the listener, just return a no-op cleanup
    return () => {};
  }
}

/**
 * Display multiple lines with typewriter effect
 *
 * @param lines Array of lines to display
 * @param options Typewriter options (applied to each line)
 */
export async function typewriteLines(
  lines: string[],
  options: TypewriterOptions = {}
): Promise<void> {
  for (const line of lines) {
    await typewrite(line, options);
  }
}
