/**
 * Tests for the debug logging utility
 */

import { debugLog, isDebugEnabled, createDebugLogger } from '../../../src/utils/debug';

describe('debug utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    delete process.env.ASM_DEBUG;
    delete process.env.DEBUG;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('isDebugEnabled', () => {
    it('returns false when no debug env vars set', () => {
      expect(isDebugEnabled()).toBe(false);
    });

    it('returns true when ASM_DEBUG=1', () => {
      process.env.ASM_DEBUG = '1';
      expect(isDebugEnabled()).toBe(true);
    });

    it('returns true when ASM_DEBUG=true', () => {
      process.env.ASM_DEBUG = 'true';
      expect(isDebugEnabled()).toBe(true);
    });

    it('returns false when ASM_DEBUG=0', () => {
      process.env.ASM_DEBUG = '0';
      expect(isDebugEnabled()).toBe(false);
    });

    it('returns true when DEBUG includes asm', () => {
      process.env.DEBUG = 'foo,asm,bar';
      expect(isDebugEnabled()).toBe(true);
    });

    it('returns true when DEBUG is just asm', () => {
      process.env.DEBUG = 'asm';
      expect(isDebugEnabled()).toBe(true);
    });

    it('returns false when DEBUG does not include asm', () => {
      process.env.DEBUG = 'foo,bar';
      expect(isDebugEnabled()).toBe(false);
    });
  });

  describe('debugLog', () => {
    it('does not log when debug is disabled', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      debugLog('test', 'message');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('logs message when debug is enabled', () => {
      process.env.ASM_DEBUG = '1';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      debugLog('test-context', 'test message');

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('[ASM DEBUG');
      expect(logOutput).toContain('test-context:');
      expect(logOutput).toContain('test message');
    });

    it('logs error message and stack when error provided', () => {
      process.env.ASM_DEBUG = '1';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const testError = new Error('test error');

      debugLog('test', 'something failed', testError);

      expect(consoleSpy).toHaveBeenCalledTimes(3); // message, error message, stack
      const calls = consoleSpy.mock.calls;
      expect(calls[0][0]).toContain('something failed');
      expect(calls[1][0]).toContain('Error: test error');
      expect(calls[2][0]).toContain('Stack:');
    });

    it('handles non-Error objects', () => {
      process.env.ASM_DEBUG = '1';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      debugLog('test', 'something failed', 'string error');

      expect(consoleSpy).toHaveBeenCalledTimes(2); // message, error message (no stack)
      const calls = consoleSpy.mock.calls;
      expect(calls[1][0]).toContain('Error: string error');
    });
  });

  describe('createDebugLogger', () => {
    it('creates a scoped logger function', () => {
      process.env.ASM_DEBUG = '1';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const log = createDebugLogger('my-module');
      log('test message');

      expect(consoleSpy).toHaveBeenCalled();
      const logOutput = consoleSpy.mock.calls[0][0];
      expect(logOutput).toContain('my-module:');
    });

    it('passes errors through', () => {
      process.env.ASM_DEBUG = '1';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const log = createDebugLogger('my-module');
      const error = new Error('test');
      log('failed', error);

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[1][0]).toContain('Error: test');
    });
  });
});
