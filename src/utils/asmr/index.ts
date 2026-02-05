/**
 * ASMR Mode Animation Utilities
 *
 * This module exports all ASMR animation utilities for creating
 * calming, satisfying CLI experiences.
 */

// Timing utilities
export {
  sleep,
  frameDelay,
  characterDelay,
  FRAME_INTERVAL_MS,
  CHARACTER_DELAY_MS,
  TYPEWRITER_MAX_LENGTH,
} from './timing';

// Spinner
export {
  Spinner,
  createSpinner,
  SPINNER_FRAMES,
  ASCII_SPINNER_FRAMES,
  STATUS_SYMBOLS,
  type SpinnerOptions,
} from './spinner';

// Typewriter effect
export { typewrite, typewriteLines, type TypewriterOptions } from './typewriter';

// Progress bar
export {
  ProgressBar,
  createProgressBar,
  GRADIENT_CHARS,
  ASCII_GRADIENT_CHARS,
  MIN_BAR_WIDTH,
  DEFAULT_BAR_WIDTH,
  type ProgressBarOptions,
} from './progress';

// Completion sequences
export {
  showCascade,
  showSweep,
  showCompletion,
  type CompletionStyle,
  type CompletionOptions,
} from './completion';

// Banner and summaries
export {
  showAsmrBanner,
  showCompletionSummary,
  showAsciiArt,
  showDivider,
  resetBannerState,
  isBannerShown,
  type OperationStats,
  type BannerOptions,
} from './banner';

// Loading messages
export {
  getLoadingMessage,
  getMessagePool,
  cycleMessages,
  withCyclingMessages,
  MESSAGE_POOLS,
  MESSAGE_CYCLE_INTERVAL,
  type OperationType,
  type CycleMessagesOptions,
} from './messages';

// Calm error formatting
export {
  formatCalmError,
  showCalmError,
  formatCalmErrorFromException,
  formatCalmErrors,
  getSuggestionForCode,
  GENTLE_SUGGESTIONS,
  type CalmErrorOptions,
} from './errors';

// Sound cues
export {
  playCompletionSound,
  resetSoundState,
  getLastCompletionTime,
  MIN_SOUND_INTERVAL_MS,
} from './sounds';
