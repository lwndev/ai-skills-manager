/**
 * ASMR Mode Output Helpers
 *
 * High-level helpers for using ASMR animations in CLI commands.
 * These functions handle the decision of whether to use ASMR animations
 * based on config and terminal capabilities.
 */

import { AsmrConfig, DEFAULT_ASMR_CONFIG } from '../types/asmr';
import { shouldEnableAnimations, shouldUseAscii } from './terminal';
import {
  Spinner,
  createSpinner,
  typewrite,
  showCompletion,
  showAsmrBanner,
  showCompletionSummary,
  showCalmError,
  getLoadingMessage,
  cycleMessages,
  OperationType,
  OperationStats,
  CompletionStyle,
} from './asmr';
import { sleep, MIN_SPINNER_DISPLAY_MS } from './asmr/timing';

/**
 * ASMR output context for a command execution
 */
export interface AsmrOutputContext {
  /** ASMR configuration */
  config: AsmrConfig;
  /** Whether ASMR animations are enabled (config + terminal) */
  enabled: boolean;
  /** Whether to use ASCII characters */
  useAscii: boolean;
}

/**
 * Create an ASMR output context from config
 *
 * @param config ASMR configuration (optional, defaults to disabled)
 * @returns Output context with computed state
 */
export function createAsmrContext(config?: AsmrConfig): AsmrOutputContext {
  const asmrConfig = config ?? DEFAULT_ASMR_CONFIG;
  return {
    config: asmrConfig,
    enabled: shouldEnableAnimations(asmrConfig),
    useAscii: shouldUseAscii(),
  };
}

/**
 * Show the ASMR banner if enabled and not already shown
 *
 * @param ctx ASMR output context
 * @returns Whether the banner was shown
 */
export function showBannerIfEnabled(ctx: AsmrOutputContext): boolean {
  if (!ctx.enabled) {
    return false;
  }
  return showAsmrBanner({ forceAscii: ctx.useAscii });
}

/**
 * Show a success message with optional ASMR animation
 *
 * @param message The success message
 * @param ctx ASMR output context
 * @param options Additional options
 */
export async function showSuccess(
  message: string,
  ctx: AsmrOutputContext,
  options?: { style?: CompletionStyle; useTypewriter?: boolean }
): Promise<void> {
  if (!ctx.enabled) {
    console.log(`✓ ${message}`);
    return;
  }

  if (options?.useTypewriter) {
    await typewrite(message, { skipAnimation: !ctx.enabled });
  }

  await showCompletion(message, {
    style: options?.style ?? 'cascade',
    forceAscii: ctx.useAscii,
  });
}

/**
 * Show an error message with optional ASMR calm formatting
 *
 * @param message The error message
 * @param ctx ASMR output context
 * @param suggestion Optional suggestion for resolution
 */
export function showError(message: string, ctx: AsmrOutputContext, suggestion?: string): void {
  if (!ctx.enabled) {
    console.error(`✗ ${message}`);
    if (suggestion) {
      console.error(`  Try: ${suggestion}`);
    }
    return;
  }

  showCalmError(message, {
    suggestion,
    forceAscii: ctx.useAscii,
  });
}

/**
 * Show operation summary stats
 *
 * @param stats Operation statistics
 * @param ctx ASMR output context
 */
export function showStats(stats: OperationStats, ctx: AsmrOutputContext): void {
  showCompletionSummary(stats, { forceAscii: ctx.useAscii });
}

/**
 * ASMR-aware spinner wrapper
 */
export class AsmrSpinner {
  private ctx: AsmrOutputContext;
  private spinner: Spinner | null = null;
  private stopCycling: (() => void) | null = null;
  private message: string = '';

  constructor(ctx: AsmrOutputContext) {
    this.ctx = ctx;
  }

  /**
   * Start the spinner with a message
   */
  start(message: string): this {
    this.message = message;

    if (!this.ctx.enabled) {
      console.log(message);
      return this;
    }

    this.spinner = createSpinner(message, {
      theme: this.ctx.config.theme,
      forceAscii: this.ctx.useAscii,
    });

    return this;
  }

  /**
   * Start with auto-cycling messages for an operation type
   */
  startWithMessages(operation: OperationType): this {
    const firstMessage = getLoadingMessage(operation);
    this.start(firstMessage);

    if (this.ctx.enabled && this.spinner) {
      this.stopCycling = cycleMessages(operation, this.spinner);
    }

    return this;
  }

  /**
   * Update the spinner message
   */
  update(message: string): this {
    this.message = message;
    if (this.spinner) {
      this.spinner.update(message);
    }
    return this;
  }

  /**
   * Stop with success
   */
  succeed(message?: string): this {
    this.cleanup();
    const finalMessage = message ?? this.message;

    if (!this.ctx.enabled) {
      console.log(`✓ ${finalMessage}`);
      return this;
    }

    if (this.spinner) {
      this.spinner.succeed(finalMessage);
      this.spinner = null;
    }

    return this;
  }

  /**
   * Stop with failure
   */
  fail(message?: string): this {
    this.cleanup();
    const finalMessage = message ?? this.message;

    if (!this.ctx.enabled) {
      console.error(`✗ ${finalMessage}`);
      return this;
    }

    if (this.spinner) {
      this.spinner.fail(finalMessage);
      this.spinner = null;
    }

    return this;
  }

  /**
   * Stop without status
   */
  stop(): this {
    this.cleanup();

    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    return this;
  }

  /**
   * Check if spinning
   */
  get spinning(): boolean {
    return this.spinner?.spinning ?? false;
  }

  private cleanup(): void {
    if (this.stopCycling) {
      this.stopCycling();
      this.stopCycling = null;
    }
  }
}

/**
 * Create an ASMR-aware spinner
 *
 * @param ctx ASMR output context
 * @returns Spinner wrapper
 */
export function createAsmrSpinner(ctx: AsmrOutputContext): AsmrSpinner {
  return new AsmrSpinner(ctx);
}

/**
 * Run a task with a spinner and calming messages
 *
 * @param operation Operation type for message selection
 * @param task The async task to run
 * @param ctx ASMR output context
 * @param options Options for the spinner
 * @returns Result of the task
 */
export async function withSpinner<T>(
  operation: OperationType,
  task: () => Promise<T>,
  ctx: AsmrOutputContext,
  options?: { successMessage?: string; failureMessage?: string }
): Promise<T> {
  const spinner = createAsmrSpinner(ctx);
  spinner.startWithMessages(operation);

  try {
    // Run task and minimum display delay in parallel so fast operations
    // still show a visible animation cycle
    const [result] = ctx.enabled
      ? await Promise.all([task(), sleep(MIN_SPINNER_DISPLAY_MS)])
      : [await task()];
    spinner.succeed(options?.successMessage);
    return result;
  } catch (error) {
    spinner.fail(options?.failureMessage);
    throw error;
  }
}
