/**
 * Tests for signal handler utilities
 */

import {
  setupInterruptHandler,
  resetInterruptHandler,
  isInterrupted,
  setInterrupted,
  createScopedInterruptHandler,
} from '../../../src/utils/signal-handler';

describe('Signal Handler', () => {
  // Always reset state after each test
  afterEach(() => {
    resetInterruptHandler();
  });

  describe('isInterrupted', () => {
    it('returns false initially', () => {
      expect(isInterrupted()).toBe(false);
    });

    it('returns false after reset', () => {
      setupInterruptHandler();
      setInterrupted(true);
      resetInterruptHandler();
      expect(isInterrupted()).toBe(false);
    });
  });

  describe('setInterrupted', () => {
    it('sets interrupted to true', () => {
      setInterrupted(true);
      expect(isInterrupted()).toBe(true);
    });

    it('sets interrupted to false', () => {
      setInterrupted(true);
      setInterrupted(false);
      expect(isInterrupted()).toBe(false);
    });
  });

  describe('setupInterruptHandler', () => {
    it('sets up handlers without error', () => {
      expect(() => setupInterruptHandler()).not.toThrow();
    });

    it('resets interrupted state when called', () => {
      setInterrupted(true);
      setupInterruptHandler();
      expect(isInterrupted()).toBe(false);
    });

    it('returns early if handlers already installed', () => {
      // First setup
      setupInterruptHandler();
      setInterrupted(true);

      // Second setup should return early (not reset interrupted state)
      setupInterruptHandler();

      // If it returned early, interrupted should still be true
      expect(isInterrupted()).toBe(true);
    });

    it('accepts optional cleanup function', () => {
      const cleanup = jest.fn().mockResolvedValue(undefined);
      expect(() => setupInterruptHandler(cleanup)).not.toThrow();
    });
  });

  describe('resetInterruptHandler', () => {
    it('resets state after setup', () => {
      setupInterruptHandler();
      setInterrupted(true);
      resetInterruptHandler();
      expect(isInterrupted()).toBe(false);
    });

    it('returns early if handlers not installed', () => {
      // Should not throw when called without setup
      expect(() => resetInterruptHandler()).not.toThrow();
    });

    it('can be called multiple times safely', () => {
      setupInterruptHandler();
      resetInterruptHandler();
      resetInterruptHandler();
      expect(isInterrupted()).toBe(false);
    });
  });

  describe('createScopedInterruptHandler', () => {
    it('returns object with isInterrupted and dispose methods', () => {
      const handler = createScopedInterruptHandler();

      expect(handler).toHaveProperty('isInterrupted');
      expect(handler).toHaveProperty('dispose');
      expect(typeof handler.isInterrupted).toBe('function');
      expect(typeof handler.dispose).toBe('function');

      handler.dispose();
    });

    it('isInterrupted returns false initially', () => {
      const handler = createScopedInterruptHandler();
      expect(handler.isInterrupted()).toBe(false);
      handler.dispose();
    });

    it('isInterrupted reflects global interrupted state', () => {
      const handler = createScopedInterruptHandler();
      setInterrupted(true);
      expect(handler.isInterrupted()).toBe(true);
      handler.dispose();
    });

    it('dispose resets the handler', () => {
      const handler = createScopedInterruptHandler();
      setInterrupted(true);
      handler.dispose();
      expect(isInterrupted()).toBe(false);
    });

    it('accepts optional cleanup function', () => {
      const cleanup = jest.fn().mockResolvedValue(undefined);
      const handler = createScopedInterruptHandler(cleanup);
      expect(handler.isInterrupted()).toBe(false);
      handler.dispose();
    });
  });

  describe('signal handler integration', () => {
    it('tracks SIGINT listener count', () => {
      const initialCount = process.listenerCount('SIGINT');
      setupInterruptHandler();
      expect(process.listenerCount('SIGINT')).toBeGreaterThan(initialCount);
      resetInterruptHandler();
      expect(process.listenerCount('SIGINT')).toBe(initialCount);
    });

    it('tracks SIGTERM listener count', () => {
      const initialCount = process.listenerCount('SIGTERM');
      setupInterruptHandler();
      expect(process.listenerCount('SIGTERM')).toBeGreaterThan(initialCount);
      resetInterruptHandler();
      expect(process.listenerCount('SIGTERM')).toBe(initialCount);
    });
  });
});
