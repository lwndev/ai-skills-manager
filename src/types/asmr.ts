/**
 * ASMR Mode type definitions
 *
 * Types for the opt-in ASMR Mode feature that provides calming,
 * satisfying animations for the CLI.
 */

/**
 * Available ASMR spinner themes
 */
export type AsmrTheme = 'wave' | 'pulse' | 'breathe' | 'cascade' | 'orbit';

/**
 * ASMR configuration options
 */
export interface AsmrConfig {
  /** Whether ASMR mode is enabled */
  enabled: boolean;
  /** The spinner theme to use */
  theme: AsmrTheme;
  /** Whether to play sound cues (terminal bell) */
  sounds: boolean;
}

/**
 * Raw config file structure from ~/.asm/config.json
 */
export interface AsmrConfigFile {
  asmr?: boolean;
  asmrTheme?: string;
  asmrSounds?: boolean;
}

/**
 * Sources for ASMR configuration, in precedence order
 */
export type AsmrConfigSource = 'flag' | 'env' | 'config' | 'default';

/**
 * Result of resolving ASMR configuration
 */
export interface AsmrConfigResolution {
  config: AsmrConfig;
  source: AsmrConfigSource;
}

/**
 * Terminal capabilities relevant to ASMR mode
 */
export interface TerminalCapabilities {
  /** Whether stdout is a TTY */
  isTTY: boolean;
  /** Whether running in CI environment */
  isCI: boolean;
  /** Whether terminal supports Unicode */
  supportsUnicode: boolean;
  /** Terminal width in columns */
  width: number;
  /** Whether NO_COLOR env var is set */
  noColor: boolean;
  /** Whether a screen reader is detected */
  screenReader: boolean;
}

/**
 * Default ASMR configuration (disabled)
 */
export const DEFAULT_ASMR_CONFIG: AsmrConfig = {
  enabled: false,
  theme: 'wave',
  sounds: false,
};

/**
 * Valid ASMR theme names for validation
 */
export const ASMR_THEMES: readonly AsmrTheme[] = [
  'wave',
  'pulse',
  'breathe',
  'cascade',
  'orbit',
] as const;

/**
 * Type guard to check if a string is a valid AsmrTheme
 */
export function isAsmrTheme(value: string): value is AsmrTheme {
  return ASMR_THEMES.includes(value as AsmrTheme);
}
