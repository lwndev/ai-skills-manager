/**
 * Tests for timeout utilities
 */

import {
  withTimeout,
  TimeoutError,
  createTimeoutController,
  DEFAULT_UNINSTALL_TIMEOUT,
} from '../../../src/utils/timeout';

describe('Timeout Utilities', () => {
  describe('TimeoutError', () => {
    it('creates error with correct properties', () => {
      const error = new TimeoutError('test-operation', 5000);

      expect(error.name).toBe('TimeoutError');
      expect(error.operationName).toBe('test-operation');
      expect(error.timeoutMs).toBe(5000);
      expect(error.message).toBe('Operation "test-operation" timed out after 5000ms');
    });

    it('is an instance of Error', () => {
      const error = new TimeoutError('test', 1000);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof TimeoutError).toBe(true);
    });

    it('has a stack trace', () => {
      const error = new TimeoutError('test', 1000);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TimeoutError');
    });
  });

  describe('withTimeout', () => {
    it('resolves when operation completes before timeout', async () => {
      const fastOperation = Promise.resolve('success');

      const result = await withTimeout(fastOperation, 1000, 'fast-op');

      expect(result).toBe('success');
    });

    it('rejects with TimeoutError when operation exceeds timeout', async () => {
      const slowOperation = new Promise((resolve) => {
        setTimeout(() => resolve('too late'), 1000);
      });

      await expect(withTimeout(slowOperation, 50, 'slow-op')).rejects.toThrow(TimeoutError);
    });

    it('includes operation name in timeout error', async () => {
      const slowOperation = new Promise((resolve) => {
        setTimeout(() => resolve('done'), 1000);
      });

      try {
        await withTimeout(slowOperation, 50, 'my-special-operation');
        fail('Should have thrown');
      } catch (error) {
        expect(error instanceof TimeoutError).toBe(true);
        if (error instanceof TimeoutError) {
          expect(error.operationName).toBe('my-special-operation');
          expect(error.timeoutMs).toBe(50);
        }
      }
    });

    it('preserves the resolved value type', async () => {
      const typedOperation = Promise.resolve({ count: 42, name: 'test' });

      const result = await withTimeout(typedOperation, 1000, 'typed-op');

      expect(result.count).toBe(42);
      expect(result.name).toBe('test');
    });

    it('propagates errors from the operation', async () => {
      const failingOperation = Promise.reject(new Error('Original error'));

      await expect(withTimeout(failingOperation, 1000, 'failing-op')).rejects.toThrow(
        'Original error'
      );
    });

    it('cleans up timeout when operation completes', async () => {
      // This tests that we don't leak timers
      const fastOperation = Promise.resolve('done');

      const result = await withTimeout(fastOperation, 10000, 'fast-op');

      expect(result).toBe('done');
      // If timeout wasn't cleared, the test process would hang
    });

    it('works with async functions', async () => {
      const asyncOperation = async (): Promise<number> => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 123;
      };

      const result = await withTimeout(asyncOperation(), 1000, 'async-op');

      expect(result).toBe(123);
    });

    it('handles zero timeout', async () => {
      const operation = Promise.resolve('immediate');

      // With 0 timeout, it might race - this is edge case behavior
      // The operation should complete because Promise.resolve is synchronous
      const result = await withTimeout(operation, 0, 'zero-timeout');

      expect(result).toBe('immediate');
    });

    it('handles very short timeouts', async () => {
      const slowOperation = new Promise((resolve) => {
        setTimeout(() => resolve('done'), 100);
      });

      await expect(withTimeout(slowOperation, 1, 'very-short')).rejects.toThrow(TimeoutError);
    });
  });

  describe('createTimeoutController', () => {
    it('creates controller with correct initial state', () => {
      const controller = createTimeoutController(5000);

      expect(controller.isExpired()).toBe(false);
      expect(controller.remainingMs()).toBeGreaterThan(0);
      expect(controller.remainingMs()).toBeLessThanOrEqual(5000);
      expect(controller.elapsedMs()).toBeGreaterThanOrEqual(0);
      expect(controller.elapsedMs()).toBeLessThan(100); // Should be very small
    });

    it('reports expired after timeout', async () => {
      const controller = createTimeoutController(50);

      expect(controller.isExpired()).toBe(false);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(controller.isExpired()).toBe(true);
    });

    it('remaining time decreases over time', async () => {
      const controller = createTimeoutController(1000);

      const initial = controller.remainingMs();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const later = controller.remainingMs();

      expect(later).toBeLessThan(initial);
    });

    it('elapsed time increases over time', async () => {
      const controller = createTimeoutController(10000);

      const initial = controller.elapsedMs();

      await new Promise((resolve) => setTimeout(resolve, 100));

      const later = controller.elapsedMs();

      expect(later).toBeGreaterThan(initial);
      // Allow 5ms tolerance for timer imprecision
      expect(later).toBeGreaterThanOrEqual(95);
    });

    it('remainingMs returns 0 when expired (not negative)', async () => {
      const controller = createTimeoutController(50);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(controller.remainingMs()).toBe(0);
    });

    it('can be used in a loop to check timeout', async () => {
      const controller = createTimeoutController(100);
      let iterations = 0;

      while (!controller.isExpired()) {
        iterations++;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Should have done some iterations before expiring
      expect(iterations).toBeGreaterThan(0);
      expect(iterations).toBeLessThan(20); // At 10ms per iteration, ~10 iterations in 100ms
    });
  });

  describe('DEFAULT_UNINSTALL_TIMEOUT', () => {
    it('is 5 minutes in milliseconds', () => {
      expect(DEFAULT_UNINSTALL_TIMEOUT).toBe(5 * 60 * 1000);
      expect(DEFAULT_UNINSTALL_TIMEOUT).toBe(300000);
    });
  });
});
