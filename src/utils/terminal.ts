/**
 * Terminal Capability Detection
 *
 * Utilities for detecting terminal capabilities to determine
 * whether ASMR mode animations should be enabled.
 */

import { TerminalCapabilities, AsmrConfig } from '../types/asmr';

/**
 * Minimum terminal width required for animations
 */
export const MIN_TERMINAL_WIDTH = 40;

/**
 * Default terminal width when detection fails
 */
export const DEFAULT_TERMINAL_WIDTH = 80;

/**
 * Check if stdout is a TTY (interactive terminal)
 */
export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Check if running in a CI environment
 * Checks common CI environment variables
 */
export function isCI(): boolean {
  const ciVars = [
    'CI',
    'CONTINUOUS_INTEGRATION',
    'GITHUB_ACTIONS',
    'GITLAB_CI',
    'CIRCLECI',
    'TRAVIS',
    'JENKINS',
    'BUILDKITE',
  ];

  return ciVars.some((varName) => {
    const value = process.env[varName];
    return value !== undefined && value !== '' && value !== '0' && value !== 'false';
  });
}

/**
 * Check if terminal supports Unicode characters
 *
 * Detects based on:
 * - TERM environment variable
 * - LANG/LC_ALL encoding settings
 * - Windows Terminal detection
 */
export function supportsUnicode(): boolean {
  // Check for Windows Terminal (modern, supports Unicode)
  if (process.env.WT_SESSION) {
    return true;
  }

  // Check TERM for known Unicode-capable terminals
  const term = process.env.TERM || '';
  if (term.includes('xterm') || term.includes('256color') || term.includes('utf')) {
    return true;
  }

  // Check LANG/LC_ALL for UTF-8
  const lang = process.env.LANG || process.env.LC_ALL || '';
  if (lang.toLowerCase().includes('utf')) {
    return true;
  }

  // Default to false for safety
  return false;
}

/**
 * Get the terminal width in columns
 */
export function getTerminalWidth(): number {
  if (process.stdout.columns && process.stdout.columns > 0) {
    return process.stdout.columns;
  }
  return DEFAULT_TERMINAL_WIDTH;
}

/**
 * Check if NO_COLOR environment variable is set
 * See: https://no-color.org/
 */
export function isNoColor(): boolean {
  const noColor = process.env.NO_COLOR;
  // NO_COLOR is set if the variable exists (any value counts)
  return noColor !== undefined;
}

/**
 * Check if FORCE_COLOR environment variable is set
 * This overrides NO_COLOR
 */
export function isForceColor(): boolean {
  const forceColor = process.env.FORCE_COLOR;
  return forceColor !== undefined && forceColor !== '0' && forceColor !== 'false';
}

/**
 * Check if a screen reader is likely active
 *
 * Detection is best-effort via environment variables. Screen reader
 * detection is inherently unreliable, so this defaults to false.
 * Users can set ACCESSIBILITY_ENABLED=1 or SCREEN_READER=1 to signal
 * their environment explicitly.
 */
export function isScreenReaderActive(): boolean {
  if (process.env.ACCESSIBILITY_ENABLED === '1') {
    return true;
  }

  const screenReader = process.env.SCREEN_READER;
  if (screenReader === '1' || screenReader === 'true') {
    return true;
  }

  if (process.env.ORCA_RUNNING === '1') {
    return true;
  }

  return false;
}

/**
 * Get all terminal capabilities in one call
 */
export function getTerminalCapabilities(): TerminalCapabilities {
  return {
    isTTY: isTTY(),
    isCI: isCI(),
    supportsUnicode: supportsUnicode(),
    width: getTerminalWidth(),
    noColor: isNoColor(),
    screenReader: isScreenReaderActive(),
  };
}

/**
 * Determine if animations should be enabled based on config and terminal state
 *
 * Animations are enabled when ALL of the following are true:
 * - ASMR mode is enabled in config
 * - stdout is a TTY (not piped)
 * - Not running in CI
 * - NO_COLOR is not set (unless FORCE_COLOR is set)
 * - Terminal width is at least MIN_TERMINAL_WIDTH
 *
 * @param config ASMR configuration
 * @param capabilities Optional terminal capabilities (auto-detected if not provided)
 * @returns Whether animations should be shown
 */
export function shouldEnableAnimations(
  config: AsmrConfig,
  capabilities?: TerminalCapabilities
): boolean {
  // If ASMR mode is disabled in config, no animations
  if (!config.enabled) {
    return false;
  }

  // Get terminal capabilities
  const caps = capabilities ?? getTerminalCapabilities();

  // Must be a TTY (interactive terminal)
  if (!caps.isTTY) {
    return false;
  }

  // Disable in CI environments
  if (caps.isCI) {
    return false;
  }

  // Disable when screen reader is detected
  if (caps.screenReader) {
    return false;
  }

  // Respect NO_COLOR unless FORCE_COLOR is set
  if (caps.noColor && !isForceColor()) {
    return false;
  }

  // Terminal must be wide enough for animations
  if (caps.width < MIN_TERMINAL_WIDTH) {
    return false;
  }

  return true;
}

/**
 * Check if ASCII-only mode should be used
 *
 * ASCII mode is used when:
 * - Terminal doesn't support Unicode
 * - NO_COLOR is set (for accessibility)
 *
 * @param capabilities Optional terminal capabilities (auto-detected if not provided)
 */
export function shouldUseAscii(capabilities?: TerminalCapabilities): boolean {
  const caps = capabilities ?? getTerminalCapabilities();
  return !caps.supportsUnicode || caps.noColor;
}
