/**
 * Debug logging utility for AI Skills Manager
 *
 * Enable debug logging by setting the environment variable:
 *   ASM_DEBUG=1 asm install my-skill.skill
 *
 * Or by including 'asm' in the DEBUG variable:
 *   DEBUG=asm asm install my-skill.skill
 */

/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return (
    process.env.ASM_DEBUG === '1' ||
    process.env.ASM_DEBUG === 'true' ||
    (process.env.DEBUG?.includes('asm') ?? false)
  );
}

/**
 * Log a debug message
 *
 * Messages are only output when debug mode is enabled via environment variables.
 * This is useful for understanding what's happening inside catch blocks that
 * would otherwise silently swallow errors.
 *
 * @param context - The context/module where the log originated (e.g., 'install', 'extractor')
 * @param message - The debug message
 * @param error - Optional error object to include
 */
export function debugLog(context: string, message: string, error?: unknown): void {
  if (!isDebugEnabled()) {
    return;
  }

  const timestamp = new Date().toISOString();
  const prefix = `[ASM DEBUG ${timestamp}] ${context}:`;

  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`${prefix} ${message}`);
    console.error(`${prefix} Error: ${errorMessage}`);
    if (errorStack) {
      console.error(`${prefix} Stack: ${errorStack}`);
    }
  } else {
    console.error(`${prefix} ${message}`);
  }
}

/**
 * Create a debug logger scoped to a specific context
 *
 * @param context - The context/module name
 * @returns A logger function that automatically includes the context
 *
 * @example
 * const log = createDebugLogger('installer');
 * log('Starting installation');
 * log('Error during extraction', error);
 */
export function createDebugLogger(context: string): (message: string, error?: unknown) => void {
  return (message: string, error?: unknown) => debugLog(context, message, error);
}
