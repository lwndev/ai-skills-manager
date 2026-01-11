/**
 * Tests for the AbortSignal utility (FEAT-010 Phase 4)
 *
 * These tests verify that the checkAborted utility:
 * 1. Does nothing when signal is undefined
 * 2. Does nothing when signal is not aborted
 * 3. Throws CancellationError when signal is aborted
 * 4. Works with AbortController
 */

import { checkAborted } from '../../../src/utils/abort-signal';
import { CancellationError } from '../../../src/errors';

describe('checkAborted utility', () => {
  describe('when signal is undefined', () => {
    it('does not throw', () => {
      expect(() => checkAborted(undefined)).not.toThrow();
    });

    it('returns undefined', () => {
      expect(checkAborted(undefined)).toBeUndefined();
    });
  });

  describe('when signal is not aborted', () => {
    it('does not throw', () => {
      const controller = new AbortController();
      expect(() => checkAborted(controller.signal)).not.toThrow();
    });

    it('returns undefined', () => {
      const controller = new AbortController();
      expect(checkAborted(controller.signal)).toBeUndefined();
    });
  });

  describe('when signal is aborted', () => {
    it('throws CancellationError', () => {
      const controller = new AbortController();
      controller.abort();

      expect(() => checkAborted(controller.signal)).toThrow(CancellationError);
    });

    it('throws CancellationError with default message', () => {
      const controller = new AbortController();
      controller.abort();

      try {
        checkAborted(controller.signal);
        fail('Expected CancellationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CancellationError);
        expect((error as CancellationError).message).toBe('Operation cancelled');
      }
    });

    it('throws CancellationError with correct code', () => {
      const controller = new AbortController();
      controller.abort();

      try {
        checkAborted(controller.signal);
        fail('Expected CancellationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CancellationError);
        expect((error as CancellationError).code).toBe('CANCELLED');
      }
    });
  });

  describe('abort timing', () => {
    it('does not throw before abort is called', () => {
      const controller = new AbortController();

      // First call should not throw
      expect(() => checkAborted(controller.signal)).not.toThrow();

      // Abort
      controller.abort();

      // Now should throw
      expect(() => checkAborted(controller.signal)).toThrow(CancellationError);
    });

    it('throws immediately when already aborted', () => {
      const controller = new AbortController();
      controller.abort();

      // Should throw immediately on first check
      expect(() => checkAborted(controller.signal)).toThrow(CancellationError);
    });
  });

  describe('usage pattern', () => {
    it('can be used at multiple checkpoints', () => {
      const controller = new AbortController();
      let checkpointReached = 0;

      const operation = (): void => {
        checkAborted(controller.signal);
        checkpointReached++;

        checkAborted(controller.signal);
        checkpointReached++;

        checkAborted(controller.signal);
        checkpointReached++;
      };

      // Should complete when not aborted
      operation();
      expect(checkpointReached).toBe(3);
    });

    it('can cancel at any checkpoint', () => {
      const controller = new AbortController();
      let checkpointReached = 0;

      const operation = (): void => {
        checkAborted(controller.signal);
        checkpointReached++;

        // Abort mid-operation
        controller.abort();

        checkAborted(controller.signal);
        checkpointReached++;
      };

      expect(() => operation()).toThrow(CancellationError);
      expect(checkpointReached).toBe(1);
    });

    it('works in async operations', async () => {
      const controller = new AbortController();
      let completed = false;

      const asyncOperation = async (): Promise<void> => {
        checkAborted(controller.signal);
        await Promise.resolve();

        checkAborted(controller.signal);
        completed = true;
      };

      await asyncOperation();
      expect(completed).toBe(true);
    });

    it('can be used to cancel async operations', async () => {
      const controller = new AbortController();
      let completed = false;

      const asyncOperation = async (): Promise<void> => {
        checkAborted(controller.signal);
        await Promise.resolve();

        controller.abort();

        checkAborted(controller.signal);
        completed = true;
      };

      await expect(asyncOperation()).rejects.toThrow(CancellationError);
      expect(completed).toBe(false);
    });
  });

  describe('AbortController integration', () => {
    it('works with AbortController.abort()', () => {
      const controller = new AbortController();
      controller.abort();

      expect(() => checkAborted(controller.signal)).toThrow(CancellationError);
    });

    it('works with AbortController.abort(reason)', () => {
      const controller = new AbortController();
      controller.abort(new Error('Custom reason'));

      expect(() => checkAborted(controller.signal)).toThrow(CancellationError);
    });

    it('multiple controllers work independently', () => {
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      controller1.abort();

      expect(() => checkAborted(controller1.signal)).toThrow(CancellationError);
      expect(() => checkAborted(controller2.signal)).not.toThrow();
    });
  });
});
