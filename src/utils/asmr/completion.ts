/**
 * ASMR Mode Completion Sequences
 *
 * Provides satisfying completion animations for a calming finish.
 */

import { isTTY, shouldUseAscii, getTerminalWidth } from '../terminal';
import { sleep } from './timing';

/**
 * Completion animation styles
 */
export type CompletionStyle = 'cascade' | 'sweep' | 'none';

/**
 * Options for completion animations
 */
export interface CompletionOptions {
  /** Animation style */
  style?: CompletionStyle;
  /** Stream to write to */
  stream?: NodeJS.WriteStream;
  /** Force ASCII mode */
  forceAscii?: boolean;
  /** Maximum duration in ms (default: 800) */
  maxDuration?: number;
}

/**
 * Frame duration for animations (ms)
 */
const FRAME_DURATION = 80;

/**
 * Maximum animation duration (ms)
 */
const MAX_ANIMATION_DURATION = 800;

/**
 * Cascade animation frames (Unicode)
 */
const CASCADE_FRAMES = ['◇', '◆', '◇', '·'] as const;

/**
 * Cascade animation frames (ASCII)
 */
const ASCII_CASCADE_FRAMES = ['<>', '<*>', '<>', '.'] as const;

/**
 * Sweep animation characters
 */
const SWEEP_CHAR = '━';
const ASCII_SWEEP_CHAR = '-';

/**
 * Show a cascade completion animation
 *
 * @param message Message to display after animation
 * @param options Animation options
 */
export async function showCascade(message: string, options: CompletionOptions = {}): Promise<void> {
  const { stream = process.stdout, forceAscii, maxDuration = MAX_ANIMATION_DURATION } = options;

  if (!isTTY()) {
    stream.write(`${message}\n`);
    return;
  }

  const useAscii = forceAscii ?? shouldUseAscii();
  const frames = useAscii ? ASCII_CASCADE_FRAMES : CASCADE_FRAMES;
  const numFrames = Math.min(frames.length, Math.floor(maxDuration / FRAME_DURATION));

  // Animate cascade
  for (let i = 0; i < numFrames; i++) {
    clearLine(stream);
    stream.write(`${frames[i]} ${message}`);
    await sleep(FRAME_DURATION);
  }

  // Final state with success symbol
  clearLine(stream);
  const symbol = useAscii ? '+' : '✓';
  stream.write(`${symbol} ${message}\n`);
}

/**
 * Show a sweep completion animation
 *
 * @param message Message to display after animation
 * @param options Animation options
 */
export async function showSweep(message: string, options: CompletionOptions = {}): Promise<void> {
  const { stream = process.stdout, forceAscii, maxDuration = MAX_ANIMATION_DURATION } = options;

  if (!isTTY()) {
    stream.write(`${message}\n`);
    return;
  }

  const useAscii = forceAscii ?? shouldUseAscii();
  const sweepChar = useAscii ? ASCII_SWEEP_CHAR : SWEEP_CHAR;
  const width = Math.min(getTerminalWidth() - 2, message.length + 10);
  const numFrames = Math.min(width, Math.floor(maxDuration / FRAME_DURATION));
  const charsPerFrame = Math.ceil(width / numFrames);

  // Animate sweep from left to right
  for (let i = 1; i <= numFrames; i++) {
    clearLine(stream);
    const sweepWidth = Math.min(i * charsPerFrame, width);
    stream.write(sweepChar.repeat(sweepWidth));
    await sleep(FRAME_DURATION);
  }

  // Final state
  clearLine(stream);
  const symbol = useAscii ? '+' : '✓';
  stream.write(`${symbol} ${message}\n`);
}

/**
 * Show a completion animation with the specified style
 *
 * @param message Message to display
 * @param options Animation options including style
 */
export async function showCompletion(
  message: string,
  options: CompletionOptions = {}
): Promise<void> {
  const style = options.style ?? 'cascade';

  switch (style) {
    case 'cascade':
      return showCascade(message, options);
    case 'sweep':
      return showSweep(message, options);
    case 'none':
    default: {
      const stream = options.stream ?? process.stdout;
      const useAscii = options.forceAscii ?? shouldUseAscii();
      const symbol = useAscii ? '+' : '✓';
      stream.write(`${symbol} ${message}\n`);
    }
  }
}

/**
 * Clear the current line
 */
function clearLine(stream: NodeJS.WriteStream): void {
  stream.write('\r\x1b[K');
}
