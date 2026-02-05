/**
 * ASMR Mode Progress Bar
 *
 * Provides smooth, calming progress bar animations with gradient fill.
 */

import { shouldUseAscii, isTTY, getTerminalWidth, MIN_TERMINAL_WIDTH } from '../terminal';
import { sleep, FRAME_INTERVAL_MS } from './timing';

/**
 * Gradient characters for progress fill (Unicode)
 * From most filled to least filled
 */
export const GRADIENT_CHARS = ['█', '▓', '▒', '░', '·'] as const;

/**
 * ASCII fallback characters
 */
export const ASCII_GRADIENT_CHARS = ['#', '=', '-', '.', ' '] as const;

/**
 * Minimum bar width for progress display
 */
export const MIN_BAR_WIDTH = 10;

/**
 * Default bar width
 */
export const DEFAULT_BAR_WIDTH = 30;

/**
 * Options for creating a progress bar
 */
export interface ProgressBarOptions {
  /** Width of the bar in characters (auto-calculated if not specified) */
  width?: number;
  /** Stream to write to (defaults to process.stdout) */
  stream?: NodeJS.WriteStream;
  /** Force ASCII mode */
  forceAscii?: boolean;
  /** Show percentage */
  showPercent?: boolean;
  /** Enable shimmer effect */
  shimmer?: boolean;
  /** Label to show before the bar */
  label?: string;
}

/**
 * ASMR-style progress bar with gradient fill
 *
 * Usage:
 * ```ts
 * const bar = new ProgressBar(100, { label: 'Processing' });
 * bar.start();
 * for (let i = 0; i <= 100; i++) {
 *   bar.update(i);
 *   await sleep(50);
 * }
 * bar.complete();
 * ```
 */
export class ProgressBar {
  private total: number;
  private current: number = 0;
  private width: number;
  private stream: NodeJS.WriteStream;
  private useAscii: boolean;
  private showPercent: boolean;
  private shimmer: boolean;
  private label: string;
  private chars: readonly string[];
  private isActive: boolean = false;
  private shimmerFrame: number = 0;
  private cursorHidden: boolean = false;

  constructor(total: number, options: ProgressBarOptions = {}) {
    this.total = Math.max(1, total);
    this.stream = options.stream ?? process.stdout;
    this.useAscii = options.forceAscii ?? shouldUseAscii();
    this.showPercent = options.showPercent ?? true;
    this.shimmer = options.shimmer ?? false;
    this.label = options.label ?? '';
    this.chars = this.useAscii ? ASCII_GRADIENT_CHARS : GRADIENT_CHARS;

    // Calculate width based on terminal or use provided width
    if (options.width !== undefined) {
      this.width = Math.max(MIN_BAR_WIDTH, options.width);
    } else {
      this.width = this.calculateWidth();
    }
  }

  /**
   * Start displaying the progress bar
   */
  start(): this {
    if (!isTTY()) {
      return this;
    }

    this.isActive = true;
    this.hideCursor();
    this.render();
    return this;
  }

  /**
   * Update progress value
   * @param current Current progress value (0 to total)
   */
  update(current: number): this {
    this.current = Math.min(Math.max(0, current), this.total);

    if (this.isActive && isTTY()) {
      if (this.shimmer) {
        this.shimmerFrame = (this.shimmerFrame + 1) % 3;
      }
      this.render();
    }

    return this;
  }

  /**
   * Increment progress by a value
   * @param amount Amount to increment (default: 1)
   */
  increment(amount: number = 1): this {
    return this.update(this.current + amount);
  }

  /**
   * Complete the progress bar with success
   * @param message Optional completion message
   */
  async complete(message?: string): Promise<this> {
    this.current = this.total;

    if (!isTTY()) {
      if (message) {
        this.stream.write(`${message}\n`);
      }
      return this;
    }

    this.render();

    // Short pause before completing
    await sleep(FRAME_INTERVAL_MS);

    this.clearLine();
    this.showCursor();
    this.isActive = false;

    if (message) {
      const symbol = this.useAscii ? '+' : '✓';
      this.stream.write(`${symbol} ${message}\n`);
    }

    return this;
  }

  /**
   * Complete the progress bar with failure
   * @param message Optional failure message
   */
  async fail(message?: string): Promise<this> {
    if (!isTTY()) {
      if (message) {
        this.stream.write(`${message}\n`);
      }
      return this;
    }

    this.clearLine();
    this.showCursor();
    this.isActive = false;

    if (message) {
      const symbol = this.useAscii ? 'x' : '✗';
      this.stream.write(`${symbol} ${message}\n`);
    }

    return this;
  }

  /**
   * Stop the progress bar without status
   */
  stop(): this {
    if (!this.isActive) {
      return this;
    }

    if (isTTY()) {
      this.clearLine();
      this.showCursor();
    }

    this.isActive = false;
    return this;
  }

  /**
   * Get the current progress ratio (0-1)
   */
  get ratio(): number {
    return this.current / this.total;
  }

  /**
   * Get the current percentage (0-100)
   */
  get percent(): number {
    return Math.round(this.ratio * 100);
  }

  /**
   * Check if progress bar is active
   */
  get active(): boolean {
    return this.isActive;
  }

  private render(): void {
    const ratio = this.ratio;
    const filledWidth = Math.floor(ratio * this.width);
    const emptyWidth = this.width - filledWidth;

    // Build the bar with gradient
    let bar = '';

    // Filled portion
    const fillChar = this.chars[0];
    bar += fillChar.repeat(filledWidth);

    // Gradient edge (if not fully filled)
    if (filledWidth < this.width && filledWidth > 0) {
      // Add gradient transition based on sub-progress
      const subProgress = ratio * this.width - filledWidth;
      const gradientIndex = Math.min(
        Math.floor(subProgress * (this.chars.length - 1)),
        this.chars.length - 2
      );

      // Apply shimmer effect if enabled
      const shimmerOffset = this.shimmer ? this.shimmerFrame : 0;
      const charIndex = Math.min(gradientIndex + shimmerOffset, this.chars.length - 1);
      bar = bar.slice(0, -1) + this.chars[charIndex];
    }

    // Empty portion
    const emptyChar = this.chars[this.chars.length - 1];
    bar += emptyChar.repeat(Math.max(0, emptyWidth));

    // Format output
    let output = '';

    if (this.label) {
      output += `${this.label} `;
    }

    if (this.useAscii) {
      output += `[${bar}]`;
    } else {
      output += bar;
    }

    if (this.showPercent) {
      output += ` ${this.percent.toString().padStart(3)}%`;
    }

    this.clearLine();
    this.stream.write(output);
  }

  private calculateWidth(): number {
    const termWidth = getTerminalWidth();

    // If terminal is too narrow, use minimum
    if (termWidth < MIN_TERMINAL_WIDTH) {
      return MIN_BAR_WIDTH;
    }

    // Calculate available space for bar
    // Reserve space for: label + space + brackets (if ASCII) + space + percentage
    let reserved = 0;

    if (this.label) {
      reserved += this.label.length + 1; // label + space
    }

    if (this.useAscii) {
      reserved += 2; // brackets
    }

    if (this.showPercent) {
      reserved += 5; // space + "100%"
    }

    const available = termWidth - reserved - 2; // 2 for safety margin
    return Math.max(MIN_BAR_WIDTH, Math.min(DEFAULT_BAR_WIDTH, available));
  }

  private clearLine(): void {
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
 * Create and start a progress bar
 *
 * @param total Total steps
 * @param options Progress bar options
 * @returns Started progress bar
 */
export function createProgressBar(total: number, options?: ProgressBarOptions): ProgressBar {
  return new ProgressBar(total, options).start();
}
