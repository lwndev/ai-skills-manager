/**
 * ASMR Mode Loading Messages
 *
 * Provides calming, soothing operation messages for different CLI operations.
 */

import { Spinner } from './spinner';

/**
 * Operation types for message selection
 */
export type OperationType =
  | 'install'
  | 'update'
  | 'package'
  | 'scaffold'
  | 'validate'
  | 'uninstall'
  | 'list';

/**
 * Message pools for each operation type
 * Messages are designed to be calming and reassuring
 */
export const MESSAGE_POOLS: Record<OperationType, readonly string[]> = {
  install: [
    'Preparing workspace...',
    'Arranging files...',
    'Settling into place...',
    'Making it cozy...',
    'Finishing touches...',
  ],
  update: [
    'Refreshing gently...',
    'Applying changes...',
    'Smoothing transitions...',
    'Updating carefully...',
    'Almost there...',
  ],
  package: [
    'Bundling carefully...',
    'Wrapping up...',
    'Tying it together...',
    'Packing neatly...',
    'Sealing with care...',
  ],
  scaffold: [
    'Laying the foundation...',
    'Shaping the structure...',
    'Building the frame...',
    'Adding the details...',
    'Polishing...',
  ],
  validate: [
    'Checking gently...',
    'Looking things over...',
    'Reviewing carefully...',
    'Ensuring quality...',
    'Almost done...',
  ],
  uninstall: [
    'Tidying up...',
    'Cleaning gently...',
    'Removing carefully...',
    'Clearing space...',
    'Finishing up...',
  ],
  list: ['Gathering information...', 'Looking around...', 'Collecting details...'],
} as const;

/**
 * Get a loading message for an operation
 *
 * @param operation The operation type
 * @param index Optional specific message index (wraps if out of bounds)
 * @returns A calming loading message
 */
export function getLoadingMessage(operation: OperationType, index?: number): string {
  const pool = MESSAGE_POOLS[operation];

  if (index === undefined) {
    // Return first message if no index specified
    return pool[0];
  }

  // Wrap index to pool length
  const safeIndex = Math.abs(index) % pool.length;
  return pool[safeIndex];
}

/**
 * Get all messages for an operation type
 *
 * @param operation The operation type
 * @returns Array of messages for the operation
 */
export function getMessagePool(operation: OperationType): readonly string[] {
  return MESSAGE_POOLS[operation];
}

/**
 * Options for message cycling
 */
export interface CycleMessagesOptions {
  /** Time between message changes in ms (default: 2000ms) */
  interval?: number;
  /** Starting message index (default: 0) */
  startIndex?: number;
}

/**
 * Default interval between message changes (2 seconds)
 */
export const MESSAGE_CYCLE_INTERVAL = 2000;

/**
 * State for tracking message cycling
 */
interface CycleState {
  stopped: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Cycle through loading messages on a spinner
 *
 * Returns a cleanup function to stop the cycling.
 *
 * @param operation The operation type
 * @param spinner The spinner to update
 * @param options Cycling options
 * @returns Cleanup function to stop cycling
 *
 * @example
 * ```ts
 * const spinner = new Spinner().start('Installing...');
 * const stopCycling = cycleMessages('install', spinner);
 *
 * // ... do work ...
 *
 * stopCycling();
 * spinner.succeed('Installed!');
 * ```
 */
export function cycleMessages(
  operation: OperationType,
  spinner: Spinner,
  options: CycleMessagesOptions = {}
): () => void {
  const { interval = MESSAGE_CYCLE_INTERVAL, startIndex = 0 } = options;
  const pool = MESSAGE_POOLS[operation];

  const state: CycleState = {
    stopped: false,
    timer: null,
  };

  let currentIndex = startIndex;

  const scheduleNext = () => {
    if (state.stopped) {
      return;
    }

    state.timer = setTimeout(() => {
      if (state.stopped || !spinner.spinning) {
        return;
      }

      currentIndex = (currentIndex + 1) % pool.length;
      spinner.update(pool[currentIndex]);
      scheduleNext();
    }, interval);
  };

  // Start cycling
  scheduleNext();

  // Return cleanup function
  return () => {
    state.stopped = true;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  };
}

/**
 * Run a spinner with auto-cycling messages for the duration of a task
 *
 * @param operation The operation type
 * @param spinner The spinner to use
 * @param task The async task to run
 * @param options Message cycling options
 * @returns The result of the task
 *
 * @example
 * ```ts
 * const spinner = new Spinner();
 * const result = await withCyclingMessages('install', spinner, async () => {
 *   return await installSkill();
 * });
 * spinner.succeed('Done!');
 * ```
 */
export async function withCyclingMessages<T>(
  operation: OperationType,
  spinner: Spinner,
  task: () => Promise<T>,
  options?: CycleMessagesOptions
): Promise<T> {
  const firstMessage = getLoadingMessage(operation, options?.startIndex ?? 0);
  spinner.start(firstMessage);

  const stopCycling = cycleMessages(operation, spinner, options);

  try {
    return await task();
  } finally {
    stopCycling();
  }
}
