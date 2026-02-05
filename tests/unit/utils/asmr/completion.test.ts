/**
 * Tests for ASMR Mode Completion Sequences
 */

import { showCascade, showSweep, showCompletion } from '../../../../src/utils/asmr/completion';

// Mock terminal utilities
jest.mock('../../../../src/utils/terminal', () => ({
  shouldUseAscii: jest.fn(() => false),
  isTTY: jest.fn(() => true),
  getTerminalWidth: jest.fn(() => 80),
}));

import { shouldUseAscii, isTTY } from '../../../../src/utils/terminal';

describe('completion sequences', () => {
  let mockStream: {
    write: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockStream = {
      write: jest.fn(),
    };
    (shouldUseAscii as jest.Mock).mockReturnValue(false);
    (isTTY as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('showCascade', () => {
    it('shows cascade animation and final message', async () => {
      const promise = showCascade('Complete!', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      // Run through animation frames
      await jest.runAllTimersAsync();
      await promise;

      // Should have written multiple frames plus final message
      expect(mockStream.write).toHaveBeenCalled();

      // Final call should have success symbol and message
      const lastCall = mockStream.write.mock.calls[mockStream.write.mock.calls.length - 1][0];
      expect(lastCall).toBe('✓ Complete!\n');
    });

    it('uses ASCII symbols when in ASCII mode', async () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);

      const promise = showCascade('Complete!', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      await jest.runAllTimersAsync();
      await promise;

      // Final call should have ASCII success symbol
      const lastCall = mockStream.write.mock.calls[mockStream.write.mock.calls.length - 1][0];
      expect(lastCall).toBe('+ Complete!\n');
    });

    it('outputs immediately when not TTY', async () => {
      (isTTY as jest.Mock).mockReturnValue(false);

      await showCascade('Complete!', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      expect(mockStream.write).toHaveBeenCalledTimes(1);
      expect(mockStream.write).toHaveBeenCalledWith('Complete!\n');
    });

    it('respects forceAscii option', async () => {
      const promise = showCascade('Complete!', {
        stream: mockStream as unknown as NodeJS.WriteStream,
        forceAscii: true,
      });

      await jest.runAllTimersAsync();
      await promise;

      const lastCall = mockStream.write.mock.calls[mockStream.write.mock.calls.length - 1][0];
      expect(lastCall).toBe('+ Complete!\n');
    });

    it('respects maxDuration option', async () => {
      const promise = showCascade('Complete!', {
        stream: mockStream as unknown as NodeJS.WriteStream,
        maxDuration: 160, // Only 2 frames at 80ms each
      });

      await jest.runAllTimersAsync();
      await promise;

      // Should have limited frames due to maxDuration
      expect(mockStream.write).toHaveBeenCalled();
    });
  });

  describe('showSweep', () => {
    it('shows sweep animation and final message', async () => {
      const promise = showSweep('Complete!', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      await jest.runAllTimersAsync();
      await promise;

      // Final call should have success symbol and message
      const lastCall = mockStream.write.mock.calls[mockStream.write.mock.calls.length - 1][0];
      expect(lastCall).toBe('✓ Complete!\n');
    });

    it('uses ASCII symbols when in ASCII mode', async () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);

      const promise = showSweep('Complete!', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      await jest.runAllTimersAsync();
      await promise;

      const lastCall = mockStream.write.mock.calls[mockStream.write.mock.calls.length - 1][0];
      expect(lastCall).toBe('+ Complete!\n');
    });

    it('outputs immediately when not TTY', async () => {
      (isTTY as jest.Mock).mockReturnValue(false);

      await showSweep('Complete!', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      expect(mockStream.write).toHaveBeenCalledTimes(1);
      expect(mockStream.write).toHaveBeenCalledWith('Complete!\n');
    });

    it('renders sweep characters during animation', async () => {
      const promise = showSweep('Done', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      // Advance one frame
      await jest.advanceTimersByTimeAsync(80);

      // Should have sweep characters
      const calls = mockStream.write.mock.calls;
      const hasSweep = calls.some((call) => typeof call[0] === 'string' && call[0].includes('━'));
      expect(hasSweep).toBe(true);

      await jest.runAllTimersAsync();
      await promise;
    });

    it('uses ASCII sweep character when in ASCII mode', async () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);

      const promise = showSweep('Done', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      await jest.advanceTimersByTimeAsync(80);

      const calls = mockStream.write.mock.calls;
      const hasAsciiSweep = calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('-')
      );
      expect(hasAsciiSweep).toBe(true);

      await jest.runAllTimersAsync();
      await promise;
    });
  });

  describe('showCompletion', () => {
    it('defaults to cascade style', async () => {
      const promise = showCompletion('Complete!', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      await jest.runAllTimersAsync();
      await promise;

      // Should show cascade animation frames (◇, ◆, etc.)
      const calls = mockStream.write.mock.calls;
      const hasCascadeChar = calls.some(
        (call) => typeof call[0] === 'string' && (call[0].includes('◇') || call[0].includes('◆'))
      );
      expect(hasCascadeChar).toBe(true);
    });

    it('uses cascade style when specified', async () => {
      const promise = showCompletion('Complete!', {
        style: 'cascade',
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      await jest.runAllTimersAsync();
      await promise;

      const lastCall = mockStream.write.mock.calls[mockStream.write.mock.calls.length - 1][0];
      expect(lastCall).toBe('✓ Complete!\n');
    });

    it('uses sweep style when specified', async () => {
      const promise = showCompletion('Complete!', {
        style: 'sweep',
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      await jest.runAllTimersAsync();
      await promise;

      const calls = mockStream.write.mock.calls;
      const hasSweep = calls.some((call) => typeof call[0] === 'string' && call[0].includes('━'));
      expect(hasSweep).toBe(true);
    });

    it('uses none style when specified', async () => {
      await showCompletion('Complete!', {
        style: 'none',
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      // Should immediately output without animation
      expect(mockStream.write).toHaveBeenCalledTimes(1);
      expect(mockStream.write).toHaveBeenCalledWith('✓ Complete!\n');
    });

    it('uses ASCII for none style in ASCII mode', async () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);

      await showCompletion('Complete!', {
        style: 'none',
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      expect(mockStream.write).toHaveBeenCalledWith('+ Complete!\n');
    });
  });
});
