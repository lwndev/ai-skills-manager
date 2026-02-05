/**
 * ASMR Mode Sound Cues
 *
 * Provides optional audio feedback via terminal bell.
 * Sound cues are disabled by default and must be explicitly enabled.
 */

import { AsmrConfig, DEFAULT_ASMR_CONFIG } from '../../types/asmr';
import { isTTY } from '../terminal';

/**
 * Last completion timestamp to prevent rapid sound cues
 */
let lastCompletionTime = 0;

/**
 * Minimum time between completion sounds (ms)
 * Prevents annoying rapid beeps from quick successive commands
 */
export const MIN_SOUND_INTERVAL_MS = 500;

/**
 * Play the terminal bell character
 * This produces an audible beep on most terminals
 */
function playBell(): void {
  if (isTTY()) {
    process.stdout.write('\x07'); // BEL character
  }
}

/**
 * Play a completion sound if enabled
 *
 * Sound cues only trigger when:
 * - ASMR sounds are enabled in config
 * - stdout is a TTY
 * - Sufficient time has passed since last sound
 *
 * @param config ASMR configuration
 * @returns Whether sound was played
 */
export function playCompletionSound(config?: AsmrConfig): boolean {
  const asmrConfig = config ?? DEFAULT_ASMR_CONFIG;

  // Only play if sounds are enabled
  if (!asmrConfig.sounds) {
    return false;
  }

  // Only play if TTY
  if (!isTTY()) {
    return false;
  }

  // Check for rapid commands
  const now = Date.now();
  if (now - lastCompletionTime < MIN_SOUND_INTERVAL_MS) {
    return false;
  }

  // Play the sound
  playBell();
  lastCompletionTime = now;

  return true;
}

/**
 * Reset the last completion time
 * Useful for testing
 */
export function resetSoundState(): void {
  lastCompletionTime = 0;
}

/**
 * Get the last completion time
 * Useful for testing
 */
export function getLastCompletionTime(): number {
  return lastCompletionTime;
}
