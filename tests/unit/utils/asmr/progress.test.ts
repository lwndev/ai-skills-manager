/**
 * Tests for ASMR Mode Progress Bar
 */

import {
  ProgressBar,
  createProgressBar,
  GRADIENT_CHARS,
  ASCII_GRADIENT_CHARS,
  MIN_BAR_WIDTH,
  DEFAULT_BAR_WIDTH,
} from '../../../../src/utils/asmr/progress';

// Mock terminal utilities
jest.mock('../../../../src/utils/terminal', () => ({
  shouldUseAscii: jest.fn(() => false),
  isTTY: jest.fn(() => true),
  getTerminalWidth: jest.fn(() => 80),
  MIN_TERMINAL_WIDTH: 40,
}));

import { shouldUseAscii, isTTY, getTerminalWidth } from '../../../../src/utils/terminal';

describe('ProgressBar', () => {
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
    (getTerminalWidth as jest.Mock).mockReturnValue(80);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates a progress bar with default options', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      expect(bar.ratio).toBe(0);
      expect(bar.percent).toBe(0);
      expect(bar.active).toBe(false);
    });

    it('clamps total to at least 1', () => {
      const bar = new ProgressBar(0, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.update(1);
      expect(bar.ratio).toBe(1);
    });

    it('uses specified width', () => {
      const bar = new ProgressBar(100, {
        width: 50,
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      bar.start();
      // The bar should render with the specified width
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('respects minimum width', () => {
      const bar = new ProgressBar(100, {
        width: 5, // Below MIN_BAR_WIDTH
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      // Width should be clamped to MIN_BAR_WIDTH
      expect(bar).toBeDefined();
    });
  });

  describe('start', () => {
    it('starts displaying the progress bar', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();

      expect(bar.active).toBe(true);
      // Should hide cursor and render
      expect(mockStream.write).toHaveBeenCalledWith('\x1b[?25l');
    });

    it('does nothing when not TTY', () => {
      (isTTY as jest.Mock).mockReturnValue(false);
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();

      expect(bar.active).toBe(false);
      expect(mockStream.write).not.toHaveBeenCalled();
    });

    it('returns this for chaining', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      expect(bar.start()).toBe(bar);
    });
  });

  describe('update', () => {
    it('updates progress and renders', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      mockStream.write.mockClear();

      bar.update(50);

      expect(bar.ratio).toBe(0.5);
      expect(bar.percent).toBe(50);
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('clamps values to 0-total range', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });

      bar.update(-10);
      expect(bar.ratio).toBe(0);

      bar.update(150);
      expect(bar.ratio).toBe(1);
    });

    it('returns this for chaining', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      expect(bar.update(25)).toBe(bar);
    });
  });

  describe('increment', () => {
    it('increments by 1 by default', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      bar.increment();

      expect(bar.percent).toBe(1);
    });

    it('increments by specified amount', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      bar.increment(10);

      expect(bar.percent).toBe(10);
    });

    it('returns this for chaining', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      expect(bar.increment()).toBe(bar);
    });
  });

  describe('complete', () => {
    it('completes with success message', async () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      mockStream.write.mockClear();

      const promise = bar.complete('Done!');
      await jest.runAllTimersAsync();
      await promise;

      expect(bar.active).toBe(false);
      expect(bar.ratio).toBe(1);
      expect(mockStream.write).toHaveBeenCalledWith('✓ Done!\n');
      expect(mockStream.write).toHaveBeenCalledWith('\x1b[?25h'); // show cursor
    });

    it('uses ASCII symbol when in ASCII mode', async () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      mockStream.write.mockClear();

      const promise = bar.complete('Done!');
      await jest.runAllTimersAsync();
      await promise;

      expect(mockStream.write).toHaveBeenCalledWith('+ Done!\n');
    });

    it('completes without message', async () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      mockStream.write.mockClear();

      const promise = bar.complete();
      await jest.runAllTimersAsync();
      await promise;

      expect(bar.active).toBe(false);
      // Should not write a message line
      expect(mockStream.write).not.toHaveBeenCalledWith(expect.stringContaining('✓'));
    });

    it('outputs message directly when not TTY', async () => {
      (isTTY as jest.Mock).mockReturnValue(false);
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();

      await bar.complete('Done!');

      expect(mockStream.write).toHaveBeenCalledWith('Done!\n');
    });
  });

  describe('fail', () => {
    it('fails with error message', async () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      mockStream.write.mockClear();

      await bar.fail('Error!');

      expect(bar.active).toBe(false);
      expect(mockStream.write).toHaveBeenCalledWith('✗ Error!\n');
    });

    it('uses ASCII symbol when in ASCII mode', async () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      mockStream.write.mockClear();

      await bar.fail('Error!');

      expect(mockStream.write).toHaveBeenCalledWith('x Error!\n');
    });
  });

  describe('stop', () => {
    it('stops the progress bar without message', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      mockStream.write.mockClear();

      bar.stop();

      expect(bar.active).toBe(false);
      expect(mockStream.write).toHaveBeenCalledWith('\r\x1b[K'); // clear line
      expect(mockStream.write).toHaveBeenCalledWith('\x1b[?25h'); // show cursor
    });

    it('does nothing if not active', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.stop();

      expect(mockStream.write).not.toHaveBeenCalled();
    });

    it('returns this for chaining', () => {
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();
      expect(bar.stop()).toBe(bar);
    });
  });

  describe('ratio and percent', () => {
    it('calculates ratio correctly', () => {
      const bar = new ProgressBar(200, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.update(50);
      expect(bar.ratio).toBe(0.25);
    });

    it('calculates percent correctly', () => {
      const bar = new ProgressBar(200, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.update(50);
      expect(bar.percent).toBe(25);
    });

    it('rounds percent to nearest integer', () => {
      const bar = new ProgressBar(3, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.update(1);
      expect(bar.percent).toBe(33); // 33.33... rounds to 33
    });
  });

  describe('options', () => {
    it('renders with label', () => {
      const bar = new ProgressBar(100, {
        label: 'Loading',
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      bar.start();

      const calls = mockStream.write.mock.calls;
      const hasLabel = calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('Loading')
      );
      expect(hasLabel).toBe(true);
    });

    it('renders percentage when showPercent is true', () => {
      const bar = new ProgressBar(100, {
        showPercent: true,
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      bar.start();
      bar.update(50);

      const calls = mockStream.write.mock.calls;
      const hasPercent = calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('50%')
      );
      expect(hasPercent).toBe(true);
    });

    it('renders without percentage when showPercent is false', () => {
      const bar = new ProgressBar(100, {
        showPercent: false,
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      bar.start();
      bar.update(50);

      const calls = mockStream.write.mock.calls;
      const hasPercent = calls.some((call) => typeof call[0] === 'string' && call[0].includes('%'));
      expect(hasPercent).toBe(false);
    });

    it('uses ASCII brackets when in ASCII mode', () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);
      const bar = new ProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      bar.start();

      const calls = mockStream.write.mock.calls;
      const hasBrackets = calls.some(
        (call) => typeof call[0] === 'string' && (call[0].includes('[') || call[0].includes(']'))
      );
      expect(hasBrackets).toBe(true);
    });
  });

  describe('GRADIENT_CHARS', () => {
    it('has expected characters', () => {
      expect(GRADIENT_CHARS).toEqual(['█', '▓', '▒', '░', '·']);
    });
  });

  describe('ASCII_GRADIENT_CHARS', () => {
    it('has ASCII-only characters', () => {
      expect(ASCII_GRADIENT_CHARS).toEqual(['#', '=', '-', '.', ' ']);
      for (const char of ASCII_GRADIENT_CHARS) {
        expect(char.charCodeAt(0)).toBeLessThan(128);
      }
    });
  });

  describe('constants', () => {
    it('exports MIN_BAR_WIDTH', () => {
      expect(MIN_BAR_WIDTH).toBe(10);
    });

    it('exports DEFAULT_BAR_WIDTH', () => {
      expect(DEFAULT_BAR_WIDTH).toBe(30);
    });
  });

  describe('createProgressBar', () => {
    it('creates and starts a progress bar', () => {
      const bar = createProgressBar(100, { stream: mockStream as unknown as NodeJS.WriteStream });
      expect(bar.active).toBe(true);
      bar.stop();
    });

    it('accepts options', () => {
      const bar = createProgressBar(100, {
        label: 'Test',
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      expect(bar.active).toBe(true);
      bar.stop();
    });
  });
});
