/**
 * ASMR Mode Banner and Summaries
 *
 * Provides session banners and operation summaries with calming styling.
 */

import { isTTY, shouldUseAscii } from '../terminal';

/**
 * Session state tracking for banner display
 */
let bannerShown = false;

/**
 * Operation statistics for completion summaries
 */
export interface OperationStats {
  /** Number of items processed successfully */
  success: number;
  /** Number of items that failed */
  failed: number;
  /** Number of items skipped */
  skipped: number;
  /** Total time in milliseconds */
  duration?: number;
  /** Operation name (e.g., "install", "update") */
  operation?: string;
}

/**
 * Options for banner display
 */
export interface BannerOptions {
  /** Stream to write to */
  stream?: NodeJS.WriteStream;
  /** Force ASCII mode */
  forceAscii?: boolean;
  /** Force banner even if already shown */
  force?: boolean;
}

/**
 * Reset banner state (useful for testing)
 */
export function resetBannerState(): void {
  bannerShown = false;
}

/**
 * Check if banner has been shown this session
 */
export function isBannerShown(): boolean {
  return bannerShown;
}

/**
 * Show the ASMR mode banner
 * Only displays once per session unless forced
 *
 * @param options Banner options
 * @returns Whether the banner was displayed
 */
export function showAsmrBanner(options: BannerOptions = {}): boolean {
  const { stream = process.stdout, forceAscii, force = false } = options;

  // Skip if already shown (unless forced)
  if (bannerShown && !force) {
    return false;
  }

  // Skip if not a TTY
  if (!isTTY()) {
    return false;
  }

  const useAscii = forceAscii ?? shouldUseAscii();

  if (useAscii) {
    stream.write('\n  . asmr mode .\n\n');
  } else {
    stream.write('\n  · asmr mode ·\n\n');
  }

  bannerShown = true;
  return true;
}

/**
 * Format a duration in milliseconds to a human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Show a completion summary with operation statistics
 *
 * @param stats Operation statistics
 * @param options Display options
 */
export function showCompletionSummary(stats: OperationStats, options: BannerOptions = {}): void {
  const { stream = process.stdout, forceAscii } = options;
  const useAscii = forceAscii ?? shouldUseAscii();

  const parts: string[] = [];

  // Success count
  if (stats.success > 0) {
    const symbol = useAscii ? '+' : '✓';
    parts.push(`${symbol} ${stats.success} succeeded`);
  }

  // Failed count
  if (stats.failed > 0) {
    const symbol = useAscii ? 'x' : '✗';
    parts.push(`${symbol} ${stats.failed} failed`);
  }

  // Skipped count
  if (stats.skipped > 0) {
    const symbol = useAscii ? '-' : '○';
    parts.push(`${symbol} ${stats.skipped} skipped`);
  }

  // Duration
  if (stats.duration !== undefined && stats.duration > 0) {
    parts.push(`(${formatDuration(stats.duration)})`);
  }

  if (parts.length === 0) {
    return;
  }

  // Output
  if (!isTTY()) {
    stream.write(`${parts.join('  ')}\n`);
    return;
  }

  // Calming separator
  const separator = useAscii ? '  .  ' : '  ·  ';
  stream.write(`\n${parts.join(separator)}\n`);
}

/**
 * Show simple ASCII art for verbose mode
 *
 * @param options Display options
 */
export function showAsciiArt(options: BannerOptions = {}): void {
  const { stream = process.stdout, forceAscii } = options;

  if (!isTTY()) {
    return;
  }

  const useAscii = forceAscii ?? shouldUseAscii();

  if (useAscii) {
    stream.write(`
    .  .  .
   .  .  .  .
    .  .  .
`);
  } else {
    stream.write(`
    ·  ·  ·
   ·  ·  ·  ·
    ·  ·  ·
`);
  }
}

/**
 * Show a divider line
 *
 * @param width Width of the divider
 * @param options Display options
 */
export function showDivider(width: number = 40, options: BannerOptions = {}): void {
  const { stream = process.stdout, forceAscii } = options;

  if (!isTTY()) {
    return;
  }

  const useAscii = forceAscii ?? shouldUseAscii();
  const char = useAscii ? '-' : '─';

  stream.write(`${char.repeat(width)}\n`);
}
