/**
 * Tests for ASMR Mode Spinner
 */

import {
  Spinner,
  createSpinner,
  SPINNER_FRAMES,
  ASCII_SPINNER_FRAMES,
  STATUS_SYMBOLS,
} from '../../../../src/utils/asmr/spinner';
import { FRAME_INTERVAL_MS } from '../../../../src/utils/asmr/timing';

// Mock terminal utilities
jest.mock('../../../../src/utils/terminal', () => ({
  shouldUseAscii: jest.fn(() => false),
  isTTY: jest.fn(() => true),
}));

import { shouldUseAscii, isTTY } from '../../../../src/utils/terminal';

describe('Spinner', () => {
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

  describe('constructor', () => {
    it('creates a spinner with default options', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      expect(spinner.spinning).toBe(false);
      expect(spinner.allFrames).toEqual(SPINNER_FRAMES.wave);
    });

    it('uses specified theme', () => {
      const spinner = new Spinner({
        theme: 'pulse',
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      expect(spinner.allFrames).toEqual(SPINNER_FRAMES.pulse);
    });

    it('uses ASCII frames when shouldUseAscii returns true', () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);
      const spinner = new Spinner({
        theme: 'wave',
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      expect(spinner.allFrames).toEqual(ASCII_SPINNER_FRAMES.wave);
    });

    it('uses ASCII frames when forceAscii is true', () => {
      const spinner = new Spinner({
        theme: 'cascade',
        forceAscii: true,
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      expect(spinner.allFrames).toEqual(ASCII_SPINNER_FRAMES.cascade);
    });
  });

  describe('start', () => {
    it('starts spinning and renders initial frame', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Loading...');

      expect(spinner.spinning).toBe(true);
      // Should hide cursor and render
      expect(mockStream.write).toHaveBeenCalledWith('\x1b[?25l'); // hide cursor
      expect(mockStream.write).toHaveBeenCalledWith('\r\x1b[K'); // clear line
      expect(mockStream.write).toHaveBeenCalledWith(`${SPINNER_FRAMES.wave[0]} Loading...`);
    });

    it('does not start if already spinning', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('First');
      const writeCallCount = mockStream.write.mock.calls.length;

      spinner.start('Second');
      expect(mockStream.write.mock.calls.length).toBe(writeCallCount);
    });

    it('outputs message without animation when not TTY', () => {
      (isTTY as jest.Mock).mockReturnValue(false);
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Loading...');

      expect(spinner.spinning).toBe(false);
      expect(mockStream.write).toHaveBeenCalledWith('Loading...\n');
    });

    it('returns this for chaining', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      expect(spinner.start('Test')).toBe(spinner);
    });
  });

  describe('frame cycling', () => {
    it('cycles through frames at specified interval', () => {
      const spinner = new Spinner({
        theme: 'wave',
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      spinner.start('Loading...');

      expect(spinner.currentFrame).toBe(SPINNER_FRAMES.wave[0]);

      jest.advanceTimersByTime(FRAME_INTERVAL_MS);
      expect(spinner.currentFrame).toBe(SPINNER_FRAMES.wave[1]);

      jest.advanceTimersByTime(FRAME_INTERVAL_MS);
      expect(spinner.currentFrame).toBe(SPINNER_FRAMES.wave[2]);
    });

    it('loops back to first frame after last', () => {
      const spinner = new Spinner({
        theme: 'orbit', // Has 4 frames
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      spinner.start('Test');

      // Advance through all frames
      for (let i = 0; i < SPINNER_FRAMES.orbit.length; i++) {
        jest.advanceTimersByTime(FRAME_INTERVAL_MS);
      }

      expect(spinner.currentFrame).toBe(SPINNER_FRAMES.orbit[0]);
    });

    it('uses custom interval when specified', () => {
      const customInterval = 200;
      const spinner = new Spinner({
        interval: customInterval,
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      spinner.start('Test');

      const initialFrame = spinner.currentFrame;

      // Should not change at default interval
      jest.advanceTimersByTime(FRAME_INTERVAL_MS);
      expect(spinner.currentFrame).toBe(initialFrame);

      // Should change at custom interval
      jest.advanceTimersByTime(customInterval - FRAME_INTERVAL_MS);
      expect(spinner.currentFrame).not.toBe(initialFrame);
    });
  });

  describe('update', () => {
    it('updates the message while spinning', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Initial');
      mockStream.write.mockClear();

      spinner.update('Updated');

      expect(mockStream.write).toHaveBeenCalledWith('\r\x1b[K');
      expect(mockStream.write).toHaveBeenCalledWith(`${SPINNER_FRAMES.wave[0]} Updated`);
    });

    it('returns this for chaining', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Test');
      expect(spinner.update('New')).toBe(spinner);
    });
  });

  describe('succeed', () => {
    it('stops with success symbol', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Loading...');
      mockStream.write.mockClear();

      spinner.succeed('Done!');

      expect(spinner.spinning).toBe(false);
      expect(mockStream.write).toHaveBeenCalledWith(`${STATUS_SYMBOLS.success.unicode} Done!\n`);
      expect(mockStream.write).toHaveBeenCalledWith('\x1b[?25h'); // show cursor
    });

    it('uses ASCII symbol when in ASCII mode', () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Loading...');
      mockStream.write.mockClear();

      spinner.succeed('Done!');

      expect(mockStream.write).toHaveBeenCalledWith(`${STATUS_SYMBOLS.success.ascii} Done!\n`);
    });

    it('uses current message if no message provided', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Loading...');
      mockStream.write.mockClear();

      spinner.succeed();

      expect(mockStream.write).toHaveBeenCalledWith(
        `${STATUS_SYMBOLS.success.unicode} Loading...\n`
      );
    });
  });

  describe('fail', () => {
    it('stops with failure symbol', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Loading...');
      mockStream.write.mockClear();

      spinner.fail('Error!');

      expect(spinner.spinning).toBe(false);
      expect(mockStream.write).toHaveBeenCalledWith(`${STATUS_SYMBOLS.failure.unicode} Error!\n`);
    });

    it('uses ASCII symbol when in ASCII mode', () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Loading...');
      mockStream.write.mockClear();

      spinner.fail('Error!');

      expect(mockStream.write).toHaveBeenCalledWith(`${STATUS_SYMBOLS.failure.ascii} Error!\n`);
    });
  });

  describe('stop', () => {
    it('stops the spinner without status', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Loading...');
      mockStream.write.mockClear();

      spinner.stop();

      expect(spinner.spinning).toBe(false);
      expect(mockStream.write).toHaveBeenCalledWith('\r\x1b[K'); // clear line
      expect(mockStream.write).toHaveBeenCalledWith('\x1b[?25h'); // show cursor
    });

    it('does not write if not spinning', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.stop();

      expect(mockStream.write).not.toHaveBeenCalled();
    });

    it('returns this for chaining', () => {
      const spinner = new Spinner({ stream: mockStream as unknown as NodeJS.WriteStream });
      spinner.start('Test');
      expect(spinner.stop()).toBe(spinner);
    });
  });

  describe('SPINNER_FRAMES', () => {
    it('has frames for all themes', () => {
      expect(SPINNER_FRAMES.wave).toBeDefined();
      expect(SPINNER_FRAMES.pulse).toBeDefined();
      expect(SPINNER_FRAMES.breathe).toBeDefined();
      expect(SPINNER_FRAMES.cascade).toBeDefined();
      expect(SPINNER_FRAMES.orbit).toBeDefined();
    });

    it('has at least 2 frames per theme', () => {
      for (const theme of Object.keys(SPINNER_FRAMES) as Array<keyof typeof SPINNER_FRAMES>) {
        expect(SPINNER_FRAMES[theme].length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('ASCII_SPINNER_FRAMES', () => {
    it('has ASCII fallbacks for all themes', () => {
      for (const theme of Object.keys(SPINNER_FRAMES) as Array<keyof typeof SPINNER_FRAMES>) {
        expect(ASCII_SPINNER_FRAMES[theme]).toBeDefined();
        expect(ASCII_SPINNER_FRAMES[theme].length).toBeGreaterThanOrEqual(2);
      }
    });

    it('only contains ASCII characters', () => {
      for (const theme of Object.keys(ASCII_SPINNER_FRAMES) as Array<
        keyof typeof ASCII_SPINNER_FRAMES
      >) {
        for (const frame of ASCII_SPINNER_FRAMES[theme]) {
          // Check that all characters are ASCII (code point < 128)
          for (const char of frame) {
            expect(char.charCodeAt(0)).toBeLessThan(128);
          }
        }
      }
    });
  });

  describe('createSpinner', () => {
    it('creates and starts a spinner', () => {
      const spinner = createSpinner('Test', {
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      expect(spinner.spinning).toBe(true);
      spinner.stop();
    });

    it('accepts options', () => {
      const spinner = createSpinner('Test', {
        theme: 'pulse',
        stream: mockStream as unknown as NodeJS.WriteStream,
      });
      expect(spinner.allFrames).toEqual(SPINNER_FRAMES.pulse);
      spinner.stop();
    });
  });
});
