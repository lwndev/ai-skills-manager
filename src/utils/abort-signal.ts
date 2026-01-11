/**
 * AbortSignal utility functions for cancellation support.
 *
 * Provides helper functions to check and respond to AbortSignal
 * in long-running operations.
 *
 * @module utils/abort-signal
 */

import { CancellationError } from '../errors';

/**
 * Checks if the provided AbortSignal has been aborted.
 *
 * Throws a `CancellationError` if the signal is aborted, allowing
 * operations to be cancelled at safe checkpoints.
 *
 * @param signal - Optional AbortSignal to check
 * @throws CancellationError if the signal has been aborted
 *
 * @example
 * ```typescript
 * import { checkAborted } from '../utils/abort-signal';
 *
 * async function longRunningOperation(signal?: AbortSignal) {
 *   // Check at operation start
 *   checkAborted(signal);
 *
 *   for (const item of items) {
 *     // Check before each expensive operation
 *     checkAborted(signal);
 *     await processItem(item);
 *   }
 * }
 * ```
 */
export function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new CancellationError();
  }
}
