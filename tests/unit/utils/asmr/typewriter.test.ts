/**
 * Tests for ASMR Mode Typewriter Effect
 */

import { typewrite, typewriteLines } from '../../../../src/utils/asmr/typewriter';
import { CHARACTER_DELAY_MS, TYPEWRITER_MAX_LENGTH } from '../../../../src/utils/asmr/timing';

// Mock terminal utilities
jest.mock('../../../../src/utils/terminal', () => ({
  isTTY: jest.fn(() => true),
}));

import { isTTY } from '../../../../src/utils/terminal';

describe('typewrite', () => {
  let mockStream: {
    write: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockStream = {
      write: jest.fn(),
    };
    (isTTY as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('writes text character by character', async () => {
      const text = 'Hi';
      const promise = typewrite(text, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      // First character written immediately
      expect(mockStream.write).toHaveBeenCalledWith('H');

      // Advance timer for second character
      await jest.advanceTimersByTimeAsync(CHARACTER_DELAY_MS);
      expect(mockStream.write).toHaveBeenCalledWith('i');

      // Advance timer for newline
      await jest.advanceTimersByTimeAsync(CHARACTER_DELAY_MS);
      expect(mockStream.write).toHaveBeenCalledWith('\n');

      await promise;
    });

    it('adds newline by default', async () => {
      const promise = typewrite('A', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      await jest.advanceTimersByTimeAsync(CHARACTER_DELAY_MS);
      await promise;

      expect(mockStream.write).toHaveBeenCalledWith('\n');
    });

    it('does not add newline when newline option is false', async () => {
      const promise = typewrite('A', {
        stream: mockStream as unknown as NodeJS.WriteStream,
        newline: false,
      });

      await jest.advanceTimersByTimeAsync(CHARACTER_DELAY_MS);
      await promise;

      expect(mockStream.write).not.toHaveBeenCalledWith('\n');
    });
  });

  describe('timing', () => {
    it('uses default delay between characters', async () => {
      const text = 'AB';
      const promise = typewrite(text, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      expect(mockStream.write).toHaveBeenCalledTimes(1);
      expect(mockStream.write).toHaveBeenCalledWith('A');

      // Before delay passes
      await jest.advanceTimersByTimeAsync(CHARACTER_DELAY_MS - 5);
      expect(mockStream.write).toHaveBeenCalledTimes(1);

      // After delay passes
      await jest.advanceTimersByTimeAsync(10);
      expect(mockStream.write).toHaveBeenCalledWith('B');

      await jest.runAllTimersAsync();
      await promise;
    });

    it('uses custom delay when specified', async () => {
      const customDelay = 50;
      const text = 'AB';
      const promise = typewrite(text, {
        stream: mockStream as unknown as NodeJS.WriteStream,
        delay: customDelay,
      });

      expect(mockStream.write).toHaveBeenCalledTimes(1);

      // Before custom delay passes
      await jest.advanceTimersByTimeAsync(customDelay - 5);
      expect(mockStream.write).toHaveBeenCalledTimes(1);

      // After custom delay passes
      await jest.advanceTimersByTimeAsync(10);
      expect(mockStream.write).toHaveBeenCalledWith('B');

      await jest.runAllTimersAsync();
      await promise;
    });
  });

  describe('non-TTY behavior', () => {
    it('writes immediately when not TTY', async () => {
      (isTTY as jest.Mock).mockReturnValue(false);

      const text = 'Hello, World!';
      await typewrite(text, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      // Should write entire text at once plus newline
      expect(mockStream.write).toHaveBeenCalledTimes(2);
      expect(mockStream.write).toHaveBeenNthCalledWith(1, text);
      expect(mockStream.write).toHaveBeenNthCalledWith(2, '\n');
    });
  });

  describe('long text handling', () => {
    it('skips effect for text longer than maxLength', async () => {
      const longText = 'A'.repeat(TYPEWRITER_MAX_LENGTH + 10);

      await typewrite(longText, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      // Should write entire text at once plus newline
      expect(mockStream.write).toHaveBeenCalledTimes(2);
      expect(mockStream.write).toHaveBeenNthCalledWith(1, longText);
      expect(mockStream.write).toHaveBeenNthCalledWith(2, '\n');
    });

    it('applies effect for text at or below maxLength', async () => {
      const text = 'A'.repeat(TYPEWRITER_MAX_LENGTH);
      const promise = typewrite(text, {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      // Should write character by character
      expect(mockStream.write).toHaveBeenCalledTimes(1);
      expect(mockStream.write).toHaveBeenCalledWith('A');

      await jest.runAllTimersAsync();
      await promise;

      // Total calls: maxLength characters + newline
      expect(mockStream.write).toHaveBeenCalledTimes(TYPEWRITER_MAX_LENGTH + 1);
    });

    it('respects custom maxLength', async () => {
      const customMax = 5;
      const text = 'ABCDEF'; // 6 characters, longer than customMax

      await typewrite(text, {
        stream: mockStream as unknown as NodeJS.WriteStream,
        maxLength: customMax,
      });

      // Should skip effect and write immediately
      expect(mockStream.write).toHaveBeenCalledTimes(2);
      expect(mockStream.write).toHaveBeenNthCalledWith(1, text);
    });
  });

  describe('skipAnimation option', () => {
    it('skips animation when skipAnimation is true', async () => {
      const text = 'Test';

      await typewrite(text, {
        stream: mockStream as unknown as NodeJS.WriteStream,
        skipAnimation: true,
      });

      // Should write immediately
      expect(mockStream.write).toHaveBeenCalledTimes(2);
      expect(mockStream.write).toHaveBeenNthCalledWith(1, text);
      expect(mockStream.write).toHaveBeenNthCalledWith(2, '\n');
    });
  });

  describe('empty string', () => {
    it('handles empty string', async () => {
      await typewrite('', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });

      // Should just write newline
      expect(mockStream.write).toHaveBeenCalledTimes(1);
      expect(mockStream.write).toHaveBeenCalledWith('\n');
    });
  });
});

describe('typewriteLines', () => {
  let mockStream: {
    write: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockStream = {
      write: jest.fn(),
    };
    (isTTY as jest.Mock).mockReturnValue(false); // Use non-TTY for simpler testing
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('writes multiple lines', async () => {
    const lines = ['Line 1', 'Line 2', 'Line 3'];

    await typewriteLines(lines, {
      stream: mockStream as unknown as NodeJS.WriteStream,
    });

    // Each line + newline = 6 writes
    expect(mockStream.write).toHaveBeenCalledTimes(6);
    expect(mockStream.write).toHaveBeenNthCalledWith(1, 'Line 1');
    expect(mockStream.write).toHaveBeenNthCalledWith(2, '\n');
    expect(mockStream.write).toHaveBeenNthCalledWith(3, 'Line 2');
    expect(mockStream.write).toHaveBeenNthCalledWith(4, '\n');
    expect(mockStream.write).toHaveBeenNthCalledWith(5, 'Line 3');
    expect(mockStream.write).toHaveBeenNthCalledWith(6, '\n');
  });

  it('handles empty array', async () => {
    await typewriteLines([], {
      stream: mockStream as unknown as NodeJS.WriteStream,
    });

    expect(mockStream.write).not.toHaveBeenCalled();
  });

  it('passes options to each line', async () => {
    const lines = ['A', 'B'];

    await typewriteLines(lines, {
      stream: mockStream as unknown as NodeJS.WriteStream,
      newline: false,
    });

    // Should not have any newlines
    expect(mockStream.write).not.toHaveBeenCalledWith('\n');
  });
});
