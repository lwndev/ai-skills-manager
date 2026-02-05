/**
 * ASMR Mode Spinner
 *
 * Provides calming, smooth spinner animations with multiple themes.
 * Each theme has both Unicode and ASCII variants for compatibility.
 */

import { AsmrTheme } from '../../types/asmr';
import { shouldUseAscii, isTTY } from '../terminal';
import { FRAME_INTERVAL_MS } from './timing';

/**
 * Spinner frame definitions for each theme
 */
export const SPINNER_FRAMES: Record<AsmrTheme, readonly string[]> = {
  wave: ['·    ', '··   ', '···  ', ' ··· ', '  ···', '   ··', '    ·', '     '],
  pulse: ['○', '◎', '●', '◉', '●', '◎'],
  breathe: ['    ', '·   ', '··  ', '··· ', '····', '··· ', '··  ', '·   '],
  cascade: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂'],
  orbit: ['◜ ', ' ◝', ' ◞', '◟ '],
} as const;

/**
 * ASCII fallback frames for each theme
 */
export const ASCII_SPINNER_FRAMES: Record<AsmrTheme, readonly string[]> = {
  wave: ['.    ', '..   ', '...  ', ' ... ', '  ...', '   ..', '    .', '     '],
  pulse: ['o', 'O', '0', 'O'],
  breathe: ['    ', '.   ', '..  ', '... ', '....', '... ', '..  ', '.   '],
  cascade: ['-', '=', '#', '='],
  orbit: ['|', '/', '-', '\\'],
} as const;

/**
 * Status symbols for completion states
 */
export const STATUS_SYMBOLS = {
  success: { unicode: '✓', ascii: '+' },
  failure: { unicode: '✗', ascii: 'x' },
} as const;

/**
 * Options for creating a spinner
 */
export interface SpinnerOptions {
  /** Theme to use (defaults to 'wave') */
  theme?: AsmrTheme;
  /** Stream to write to (defaults to process.stdout) */
  stream?: NodeJS.WriteStream;
  /** Force ASCII mode */
  forceAscii?: boolean;
  /** Frame interval in ms (defaults to FRAME_INTERVAL_MS) */
  interval?: number;
}

/**
 * ASMR-style spinner with calming animations
 *
 * Usage:
 * ```ts
 * const spinner = new Spinner({ theme: 'wave' });
 * spinner.start('Loading...');
 * // ... do work ...
 * spinner.succeed('Done!');
 * ```
 */
export class Spinner {
  private theme: AsmrTheme;
  private stream: NodeJS.WriteStream;
  private useAscii: boolean;
  private interval: number;
  private frames: readonly string[];
  private frameIndex: number = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private message: string = '';
  private isSpinning: boolean = false;
  private cursorHidden: boolean = false;

  constructor(options: SpinnerOptions = {}) {
    this.theme = options.theme ?? 'wave';
    this.stream = options.stream ?? process.stdout;
    this.useAscii = options.forceAscii ?? shouldUseAscii();
    this.interval = options.interval ?? FRAME_INTERVAL_MS;
    this.frames = this.useAscii ? ASCII_SPINNER_FRAMES[this.theme] : SPINNER_FRAMES[this.theme];
  }

  /**
   * Start the spinner with a message
   * @param message The message to display
   */
  start(message: string): this {
    if (this.isSpinning) {
      return this;
    }

    // Don't animate if not a TTY
    if (!isTTY()) {
      this.stream.write(`${message}\n`);
      return this;
    }

    this.message = message;
    this.isSpinning = true;
    this.frameIndex = 0;

    // Hide cursor
    this.hideCursor();

    // Render initial frame
    this.render();

    // Start animation loop
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.render();
    }, this.interval);

    return this;
  }

  /**
   * Update the spinner message while spinning
   * @param message The new message to display
   */
  update(message: string): this {
    this.message = message;
    if (this.isSpinning && isTTY()) {
      this.render();
    }
    return this;
  }

  /**
   * Stop the spinner with a success state
   * @param message Optional success message (uses current message if not provided)
   */
  succeed(message?: string): this {
    const symbol = this.useAscii ? STATUS_SYMBOLS.success.ascii : STATUS_SYMBOLS.success.unicode;
    return this.stopWithStatus(symbol, message);
  }

  /**
   * Stop the spinner with a failure state
   * @param message Optional failure message (uses current message if not provided)
   */
  fail(message?: string): this {
    const symbol = this.useAscii ? STATUS_SYMBOLS.failure.ascii : STATUS_SYMBOLS.failure.unicode;
    return this.stopWithStatus(symbol, message);
  }

  /**
   * Stop the spinner without a status symbol
   */
  stop(): this {
    if (!this.isSpinning) {
      return this;
    }

    this.isSpinning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (isTTY()) {
      this.clearLine();
      this.showCursor();
    }

    return this;
  }

  /**
   * Check if the spinner is currently running
   */
  get spinning(): boolean {
    return this.isSpinning;
  }

  /**
   * Get the current frame for testing
   */
  get currentFrame(): string {
    return this.frames[this.frameIndex];
  }

  /**
   * Get all frames for the current theme
   */
  get allFrames(): readonly string[] {
    return this.frames;
  }

  private stopWithStatus(symbol: string, message?: string): this {
    if (!this.isSpinning && !isTTY()) {
      // If we're not spinning (non-TTY), just output the final message
      this.stream.write(`${symbol} ${message ?? this.message}\n`);
      return this;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.isSpinning = false;

    if (isTTY()) {
      this.clearLine();
      this.stream.write(`${symbol} ${message ?? this.message}\n`);
      this.showCursor();
    }

    return this;
  }

  private render(): void {
    const frame = this.frames[this.frameIndex];
    this.clearLine();
    this.stream.write(`${frame} ${this.message}`);
  }

  private clearLine(): void {
    // Move cursor to start of line and clear it
    this.stream.write('\r\x1b[K');
  }

  private hideCursor(): void {
    if (!this.cursorHidden) {
      this.stream.write('\x1b[?25l');
      this.cursorHidden = true;
    }
  }

  private showCursor(): void {
    if (this.cursorHidden) {
      this.stream.write('\x1b[?25h');
      this.cursorHidden = false;
    }
  }
}

/**
 * Create and start a spinner with the given options
 * Convenience function for common use case
 *
 * @param message The message to display
 * @param options Spinner options
 * @returns The started spinner
 */
export function createSpinner(message: string, options?: SpinnerOptions): Spinner {
  return new Spinner(options).start(message);
}
