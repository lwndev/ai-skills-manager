/**
 * Timeout utilities for long-running operations
 *
 * Provides a wrapper to add timeout behavior to async operations.
 * Used primarily for the uninstall command to prevent hanging operations.
 */

/**
 * Error thrown when an operation exceeds its timeout
 */
export class TimeoutError extends Error {
  /** Name of the operation that timed out */
  public readonly operationName: string;
  /** Timeout duration in milliseconds */
  public readonly timeoutMs: number;

  constructor(operationName: string, timeoutMs: number) {
    super(`Operation "${operationName}" timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.operationName = operationName;
    this.timeoutMs = timeoutMs;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Default timeout for uninstall operations (5 minutes)
 */
export const DEFAULT_UNINSTALL_TIMEOUT = 5 * 60 * 1000;

/**
 * Wrap an async operation with a timeout
 *
 * If the operation doesn't complete within the specified time,
 * a TimeoutError is thrown. The original operation continues
 * running but its result is ignored.
 *
 * @param operation - The async operation to wrap
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @param operationName - Name of the operation (for error messages)
 * @returns Promise that resolves to the operation result or rejects with TimeoutError
 *
 * @example
 * ```typescript
 * try {
 *   const result = await withTimeout(
 *     someAsyncOperation(),
 *     30000,
 *     'skill removal'
 *   );
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     console.log(`${error.operationName} took too long`);
 *   }
 * }
 * ```
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  // Create a timeout promise that rejects after the specified time
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operationName, timeoutMs));
    }, timeoutMs);
  });

  try {
    // Race the operation against the timeout
    const result = await Promise.race([operation, timeoutPromise]);
    return result;
  } finally {
    // Clean up the timeout to prevent memory leaks
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Create a timeout controller for operations that need to check timeout status
 *
 * Unlike withTimeout which races promises, this provides a way to
 * periodically check if a timeout has been reached. Useful for
 * generator-based operations like safeRecursiveDelete.
 *
 * @param timeoutMs - Maximum time allowed in milliseconds
 * @returns Controller object with isExpired() method and remaining time
 *
 * @example
 * ```typescript
 * const controller = createTimeoutController(30000);
 *
 * for await (const item of items) {
 *   if (controller.isExpired()) {
 *     throw new TimeoutError('processing', 30000);
 *   }
 *   await processItem(item);
 * }
 * ```
 */
export function createTimeoutController(timeoutMs: number): TimeoutController {
  const startTime = Date.now();
  const endTime = startTime + timeoutMs;

  return {
    isExpired(): boolean {
      return Date.now() >= endTime;
    },

    remainingMs(): number {
      const remaining = endTime - Date.now();
      return Math.max(0, remaining);
    },

    elapsedMs(): number {
      return Date.now() - startTime;
    },
  };
}

/**
 * Controller interface for timeout-aware operations
 */
export interface TimeoutController {
  /** Check if the timeout has expired */
  isExpired(): boolean;
  /** Get remaining time in milliseconds */
  remainingMs(): number;
  /** Get elapsed time in milliseconds */
  elapsedMs(): number;
}
