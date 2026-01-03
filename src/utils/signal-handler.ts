/**
 * Signal handling utilities for graceful interruption
 *
 * Provides a centralized way to handle SIGINT and SIGTERM signals
 * during long-running operations like skill uninstallation.
 *
 * The handler:
 * - Sets an interrupted flag on first signal
 * - Allows the current operation to complete
 * - Calls a cleanup function before exit
 * - Prevents undefined state from abrupt termination
 */

/**
 * State tracking for interrupt handling
 */
interface InterruptState {
  /** Whether an interrupt signal has been received */
  interrupted: boolean;
  /** Original SIGINT handler */
  originalSigintHandler: NodeJS.SignalsListener | undefined;
  /** Original SIGTERM handler */
  originalSigtermHandler: NodeJS.SignalsListener | undefined;
  /** Whether handlers are currently installed */
  handlersInstalled: boolean;
}

/**
 * Current interrupt state
 */
const state: InterruptState = {
  interrupted: false,
  originalSigintHandler: undefined,
  originalSigtermHandler: undefined,
  handlersInstalled: false,
};

/**
 * Set up signal handlers for graceful interruption
 *
 * Registers handlers for SIGINT (Ctrl+C) and SIGTERM that:
 * 1. Set the interrupted flag on first signal
 * 2. Call the provided cleanup function
 * 3. Exit the process after cleanup
 *
 * @param cleanup - Async function to call before exit (optional)
 * @example
 * ```ts
 * setupInterruptHandler(async () => {
 *   console.log('Cleaning up...');
 *   await saveProgress();
 * });
 * ```
 */
export function setupInterruptHandler(cleanup?: () => Promise<void>): void {
  if (state.handlersInstalled) {
    return; // Handlers already installed
  }

  // Reset interrupted state
  state.interrupted = false;

  // Store original handlers (if any)
  const listeners = process.listeners('SIGINT');
  state.originalSigintHandler =
    listeners.length > 0 ? (listeners[0] as NodeJS.SignalsListener) : undefined;

  const termListeners = process.listeners('SIGTERM');
  state.originalSigtermHandler =
    termListeners.length > 0 ? (termListeners[0] as NodeJS.SignalsListener) : undefined;

  // Create the signal handler
  const signalHandler = async (signal: NodeJS.Signals): Promise<void> => {
    if (state.interrupted) {
      // Second signal - force exit
      process.exit(130); // 128 + SIGINT (2)
    }

    state.interrupted = true;

    // Allow the current operation to see the interrupt
    // and complete gracefully

    if (cleanup) {
      try {
        await cleanup();
      } catch {
        // Ignore cleanup errors during interrupt
      }
    }

    // Exit with appropriate code
    // 130 = 128 + SIGINT (2) or 143 = 128 + SIGTERM (15)
    const exitCode = signal === 'SIGTERM' ? 143 : 130;
    process.exit(exitCode);
  };

  // Install handlers
  process.on('SIGINT', signalHandler);
  process.on('SIGTERM', signalHandler);

  state.handlersInstalled = true;
}

/**
 * Check if an interrupt signal has been received
 *
 * Long-running operations should check this periodically
 * and stop gracefully if true.
 *
 * @returns True if an interrupt was received
 * @example
 * ```ts
 * for (const file of files) {
 *   if (isInterrupted()) {
 *     console.log('Interrupted, stopping...');
 *     break;
 *   }
 *   await processFile(file);
 * }
 * ```
 */
export function isInterrupted(): boolean {
  return state.interrupted;
}

/**
 * Reset the interrupt handlers
 *
 * Removes the signal handlers installed by setupInterruptHandler()
 * and restores any original handlers. Call this after the operation
 * is complete.
 *
 * @example
 * ```ts
 * setupInterruptHandler(cleanup);
 * try {
 *   await longRunningOperation();
 * } finally {
 *   resetInterruptHandler();
 * }
 * ```
 */
export function resetInterruptHandler(): void {
  if (!state.handlersInstalled) {
    return;
  }

  // Remove all listeners we added
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');

  // Restore original handlers if they existed
  if (state.originalSigintHandler) {
    process.on('SIGINT', state.originalSigintHandler);
  }
  if (state.originalSigtermHandler) {
    process.on('SIGTERM', state.originalSigtermHandler);
  }

  // Reset state
  state.interrupted = false;
  state.handlersInstalled = false;
  state.originalSigintHandler = undefined;
  state.originalSigtermHandler = undefined;
}

/**
 * Set the interrupted flag manually (for testing)
 *
 * @param value - Value to set the interrupted flag to
 */
export function setInterrupted(value: boolean): void {
  state.interrupted = value;
}

/**
 * Create a scoped interrupt handler that automatically cleans up
 *
 * Returns an object with methods to check and manage interrupt state.
 * Use this for operations that need localized interrupt handling.
 *
 * @param cleanup - Optional cleanup function to call on interrupt
 * @returns Object with interrupt management methods
 * @example
 * ```ts
 * const handler = createScopedInterruptHandler(cleanup);
 * try {
 *   for (const file of files) {
 *     if (handler.isInterrupted()) break;
 *     await processFile(file);
 *   }
 * } finally {
 *   handler.dispose();
 * }
 * ```
 */
export function createScopedInterruptHandler(cleanup?: () => Promise<void>): {
  isInterrupted: () => boolean;
  dispose: () => void;
} {
  setupInterruptHandler(cleanup);

  return {
    isInterrupted: () => isInterrupted(),
    dispose: () => resetInterruptHandler(),
  };
}
