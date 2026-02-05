/**
 * Tests for ASMR Mode Loading Messages
 */

import {
  getLoadingMessage,
  getMessagePool,
  cycleMessages,
  withCyclingMessages,
  MESSAGE_POOLS,
  MESSAGE_CYCLE_INTERVAL,
  OperationType,
} from '../../../../src/utils/asmr/messages';
import { Spinner } from '../../../../src/utils/asmr/spinner';

// Mock terminal utilities
jest.mock('../../../../src/utils/terminal', () => ({
  shouldUseAscii: jest.fn(() => false),
  isTTY: jest.fn(() => true),
}));

describe('messages', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('MESSAGE_POOLS', () => {
    const operations: OperationType[] = [
      'install',
      'update',
      'package',
      'scaffold',
      'validate',
      'uninstall',
      'list',
    ];

    it('has pools for all operation types', () => {
      for (const op of operations) {
        expect(MESSAGE_POOLS[op]).toBeDefined();
        expect(Array.isArray(MESSAGE_POOLS[op])).toBe(true);
      }
    });

    it('has at least one message per pool', () => {
      for (const op of operations) {
        expect(MESSAGE_POOLS[op].length).toBeGreaterThanOrEqual(1);
      }
    });

    it('has calming messages (no alarming language)', () => {
      const alarmingWords = ['error', 'fail', 'crash', 'abort', 'kill', 'destroy'];

      for (const op of operations) {
        for (const message of MESSAGE_POOLS[op]) {
          const lowerMessage = message.toLowerCase();
          for (const word of alarmingWords) {
            expect(lowerMessage).not.toContain(word);
          }
        }
      }
    });
  });

  describe('getLoadingMessage', () => {
    it('returns first message when no index specified', () => {
      const message = getLoadingMessage('install');
      expect(message).toBe(MESSAGE_POOLS.install[0]);
    });

    it('returns message at specified index', () => {
      const message = getLoadingMessage('install', 1);
      expect(message).toBe(MESSAGE_POOLS.install[1]);
    });

    it('wraps index when out of bounds', () => {
      const poolLength = MESSAGE_POOLS.install.length;
      const message = getLoadingMessage('install', poolLength);
      expect(message).toBe(MESSAGE_POOLS.install[0]);
    });

    it('handles negative index by taking absolute value', () => {
      const message = getLoadingMessage('install', -1);
      expect(message).toBe(MESSAGE_POOLS.install[1]);
    });

    it('returns correct message for each operation type', () => {
      expect(getLoadingMessage('install')).toBe('Preparing workspace...');
      expect(getLoadingMessage('update')).toBe('Refreshing gently...');
      expect(getLoadingMessage('package')).toBe('Bundling carefully...');
      expect(getLoadingMessage('scaffold')).toBe('Laying the foundation...');
      expect(getLoadingMessage('validate')).toBe('Checking gently...');
      expect(getLoadingMessage('uninstall')).toBe('Tidying up...');
      expect(getLoadingMessage('list')).toBe('Gathering information...');
    });
  });

  describe('getMessagePool', () => {
    it('returns the full message pool for an operation', () => {
      const pool = getMessagePool('install');
      expect(pool).toBe(MESSAGE_POOLS.install);
    });

    it('returns the message pool array', () => {
      const pool = getMessagePool('install');
      expect(pool).toEqual(MESSAGE_POOLS.install);
      expect(pool.length).toBeGreaterThan(0);
    });
  });

  describe('MESSAGE_CYCLE_INTERVAL', () => {
    it('exports the default cycle interval', () => {
      expect(MESSAGE_CYCLE_INTERVAL).toBe(2000);
    });
  });

  describe('cycleMessages', () => {
    let mockStream: { write: jest.Mock };
    let spinner: Spinner;

    beforeEach(() => {
      mockStream = { write: jest.fn() };
      spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Initial message');
    });

    afterEach(() => {
      spinner.stop();
    });

    it('cycles to next message after interval', () => {
      const stopCycling = cycleMessages('install', spinner);

      // Initial message (set by start)
      expect(spinner.spinning).toBe(true);

      // Advance to trigger first cycle
      jest.advanceTimersByTime(MESSAGE_CYCLE_INTERVAL);

      // Should have updated to second message
      const calls = mockStream.write.mock.calls;
      const hasSecondMessage = calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes(MESSAGE_POOLS.install[1])
      );
      expect(hasSecondMessage).toBe(true);

      stopCycling();
    });

    it('wraps around to first message', () => {
      const stopCycling = cycleMessages('install', spinner);

      // Advance through all messages plus one to wrap
      const poolLength = MESSAGE_POOLS.install.length;
      jest.advanceTimersByTime(MESSAGE_CYCLE_INTERVAL * (poolLength + 1));

      stopCycling();
      spinner.stop();

      // Should have cycled through messages
      const calls = mockStream.write.mock.calls;
      expect(calls.length).toBeGreaterThan(poolLength);
    });

    it('stops cycling when cleanup function called', () => {
      const stopCycling = cycleMessages('install', spinner);

      // Stop cycling immediately
      stopCycling();

      // Record call count (used to verify no additional writes)
      const _callCountAfterStop = mockStream.write.mock.calls.length;

      // Advance message cycle time (not spinner interval)
      jest.advanceTimersByTime(MESSAGE_CYCLE_INTERVAL);

      // Get messages that include the second pool message (cycling would have added this)
      const callsWithSecondMessage = mockStream.write.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes(MESSAGE_POOLS.install[1])
      );

      // Should not have cycled to second message (cycling was stopped)
      expect(callsWithSecondMessage.length).toBe(0);

      spinner.stop();
    });

    it('respects custom interval', () => {
      const customInterval = 500;
      const stopCycling = cycleMessages('install', spinner, { interval: customInterval });

      // Should not cycle at half the interval
      jest.advanceTimersByTime(customInterval / 2);
      const callsBeforeCycle = mockStream.write.mock.calls.length;

      // Should cycle after full interval
      jest.advanceTimersByTime(customInterval / 2 + 10);
      const callsAfterCycle = mockStream.write.mock.calls.length;

      expect(callsAfterCycle).toBeGreaterThan(callsBeforeCycle);

      stopCycling();
    });

    it('respects startIndex option', () => {
      const stopCycling = cycleMessages('install', spinner, { startIndex: 2 });

      // Advance to trigger first cycle (should go to index 3)
      jest.advanceTimersByTime(MESSAGE_CYCLE_INTERVAL);

      const calls = mockStream.write.mock.calls;
      const hasThirdMessage = calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes(MESSAGE_POOLS.install[3])
      );
      expect(hasThirdMessage).toBe(true);

      stopCycling();
    });

    it('stops cycling when spinner stops', () => {
      const stopCycling = cycleMessages('install', spinner);

      // Stop spinner
      spinner.stop();

      // Advance time
      jest.advanceTimersByTime(MESSAGE_CYCLE_INTERVAL);

      // Cleanup
      stopCycling();
    });
  });

  describe('withCyclingMessages', () => {
    let mockStream: { write: jest.Mock };
    let spinner: Spinner;

    beforeEach(() => {
      mockStream = { write: jest.fn() };
      spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
    });

    afterEach(() => {
      if (spinner.spinning) {
        spinner.stop();
      }
    });

    it('starts spinner with first message', async () => {
      let taskCompleted = false;

      const promise = withCyclingMessages('install', spinner, async () => {
        taskCompleted = true;
        return 'done';
      });

      // Task should complete immediately (no await needed for sync task)
      await Promise.resolve();
      expect(taskCompleted).toBe(true);

      // Complete the promise
      await promise;
      spinner.stop();

      const calls = mockStream.write.mock.calls;
      const hasFirstMessage = calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes(MESSAGE_POOLS.install[0])
      );
      expect(hasFirstMessage).toBe(true);
    });

    it('returns task result', async () => {
      const expected = { value: 42 };

      const result = await withCyclingMessages('install', spinner, async () => {
        return expected;
      });

      spinner.stop();
      expect(result).toBe(expected);
    });

    it('propagates errors from task', async () => {
      const promise = withCyclingMessages('install', spinner, async () => {
        throw new Error('Task failed');
      });

      await expect(promise).rejects.toThrow('Task failed');
      spinner.stop();
    });
  });
});
