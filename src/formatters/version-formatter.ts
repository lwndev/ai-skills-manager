/**
 * Output formatters for the version command
 *
 * Provides four output modes:
 * - Banner: ASCII art logo with version, tagline, website, and license
 * - Quiet: Plain version string only
 * - JSON: Structured JSON with version and license
 * - Fallback: Plain version string for non-TTY or narrow terminals
 */

const ASM_ASCII_ART = `\
    _    ____  __  __
   / \\  / ___||  \\/  |
  / _ \\ \\___ \\| |\\/| |
 / ___ \\ ___) | |  | |
/_/   \\_\\____/|_|  |_|`;

const ASM_TAGLINE = 'Create. Validate. Distribute.';
const ASM_WEBSITE = 'ai-skills-manager.app';

/** Minimum terminal width required to render the banner without wrapping.
 *  Widest content line is "  Create. Validate. Distribute." (31 chars) + 3 char margin. */
export const MIN_BANNER_WIDTH = 34;

/**
 * Format the full ASCII art version banner.
 */
export function formatVersionBanner(version: string, license: string): string {
  const displayLicense = license || 'Unknown';
  return [
    ASM_ASCII_ART,
    '',
    `  v${version}`,
    `  ${ASM_TAGLINE}`,
    `  ${ASM_WEBSITE}`,
    `  ${displayLicense} License`,
  ].join('\n');
}

/**
 * Format version as a plain string.
 */
export function formatVersionQuiet(version: string): string {
  return version;
}

/**
 * Format version as JSON.
 */
export function formatVersionJSON(version: string, license: string): string {
  return JSON.stringify({ version, license });
}

/**
 * Dispatch to the appropriate version formatter based on options and environment.
 *
 * Priority: JSON → quiet → TTY + width check → banner or fallback to quiet.
 */
export function formatVersionOutput(
  version: string,
  license: string,
  options: { quiet?: boolean; json?: boolean }
): string {
  if (options.json) {
    return formatVersionJSON(version, license);
  }

  if (options.quiet) {
    return formatVersionQuiet(version);
  }

  if (!process.stdout.isTTY) {
    return formatVersionQuiet(version);
  }

  if (process.stdout.columns !== undefined && process.stdout.columns < MIN_BANNER_WIDTH) {
    return formatVersionQuiet(version);
  }

  return formatVersionBanner(version, license);
}
