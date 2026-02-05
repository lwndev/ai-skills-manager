/**
 * ASMR Mode Timing Utilities
 *
 * Provides timing functions for calming animations.
 * These utilities create consistent, smooth animation timing.
 */

/**
 * Standard frame interval for spinner animations (120ms)
 * Slightly slower than typical CLI spinners (80ms) for a calmer feel
 */
export const FRAME_INTERVAL_MS = 120;

/**
 * Character delay for typewriter effect (15ms per character)
 */
export const CHARACTER_DELAY_MS = 15;

/**
 * Maximum text length for typewriter effect
 * Longer text skips the effect for UX
 */
export const TYPEWRITER_MAX_LENGTH = 60;

/**
 * Promise-based delay function
 * @param ms Milliseconds to wait
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the standard frame delay for animations
 * @returns Frame interval in milliseconds
 */
export function frameDelay(): number {
  return FRAME_INTERVAL_MS;
}

/**
 * Get the standard character delay for typewriter effect
 * @returns Character delay in milliseconds
 */
export function characterDelay(): number {
  return CHARACTER_DELAY_MS;
}
