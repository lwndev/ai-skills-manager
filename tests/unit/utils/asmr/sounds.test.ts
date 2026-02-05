/**
 * Tests for ASMR Mode Sound Cues
 */

import {
  playCompletionSound,
  resetSoundState,
  getLastCompletionTime,
  MIN_SOUND_INTERVAL_MS,
} from '../../../../src/utils/asmr/sounds';
import { AsmrConfig } from '../../../../src/types/asmr';

// Mock terminal utilities
jest.mock('../../../../src/utils/terminal', () => ({
  isTTY: jest.fn(() => true),
}));

import { isTTY } from '../../../../src/utils/terminal';

describe('sounds', () => {
  let mockStdoutWrite: jest.SpyInstance;

  beforeEach(() => {
    resetSoundState();
    mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    (isTTY as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    mockStdoutWrite.mockRestore();
    jest.clearAllMocks();
  });

  describe('playCompletionSound', () => {
    it('plays bell when sounds enabled', () => {
      const config: AsmrConfig = {
        enabled: true,
        theme: 'wave',
        sounds: true,
      };

      const result = playCompletionSound(config);

      expect(result).toBe(true);
      expect(mockStdoutWrite).toHaveBeenCalledWith('\x07');
    });

    it('does not play when sounds disabled', () => {
      const config: AsmrConfig = {
        enabled: true,
        theme: 'wave',
        sounds: false,
      };

      const result = playCompletionSound(config);

      expect(result).toBe(false);
      expect(mockStdoutWrite).not.toHaveBeenCalled();
    });

    it('does not play when not TTY', () => {
      (isTTY as jest.Mock).mockReturnValue(false);

      const config: AsmrConfig = {
        enabled: true,
        theme: 'wave',
        sounds: true,
      };

      const result = playCompletionSound(config);

      expect(result).toBe(false);
      expect(mockStdoutWrite).not.toHaveBeenCalled();
    });

    it('uses default config when none provided', () => {
      // Default config has sounds: false
      const result = playCompletionSound();

      expect(result).toBe(false);
      expect(mockStdoutWrite).not.toHaveBeenCalled();
    });

    it('prevents rapid sounds within interval', () => {
      const config: AsmrConfig = {
        enabled: true,
        theme: 'wave',
        sounds: true,
      };

      // First sound should play
      const first = playCompletionSound(config);
      expect(first).toBe(true);

      // Immediate second sound should not play
      const second = playCompletionSound(config);
      expect(second).toBe(false);

      // Only one bell should have been written
      expect(mockStdoutWrite).toHaveBeenCalledTimes(1);
    });

    it('allows sounds after interval has passed', () => {
      jest.useFakeTimers();

      const config: AsmrConfig = {
        enabled: true,
        theme: 'wave',
        sounds: true,
      };

      // First sound
      playCompletionSound(config);
      expect(mockStdoutWrite).toHaveBeenCalledTimes(1);

      // Advance time past interval
      jest.advanceTimersByTime(MIN_SOUND_INTERVAL_MS + 100);

      // Second sound should now play
      const result = playCompletionSound(config);
      expect(result).toBe(true);
      expect(mockStdoutWrite).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('updates last completion time', () => {
      const config: AsmrConfig = {
        enabled: true,
        theme: 'wave',
        sounds: true,
      };

      const beforeTime = Date.now();
      playCompletionSound(config);
      const afterTime = Date.now();

      const lastTime = getLastCompletionTime();
      expect(lastTime).toBeGreaterThanOrEqual(beforeTime);
      expect(lastTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('resetSoundState', () => {
    it('resets last completion time', () => {
      const config: AsmrConfig = {
        enabled: true,
        theme: 'wave',
        sounds: true,
      };

      playCompletionSound(config);
      expect(getLastCompletionTime()).toBeGreaterThan(0);

      resetSoundState();
      expect(getLastCompletionTime()).toBe(0);
    });

    it('allows immediate sound after reset', () => {
      const config: AsmrConfig = {
        enabled: true,
        theme: 'wave',
        sounds: true,
      };

      // First sound
      playCompletionSound(config);
      expect(mockStdoutWrite).toHaveBeenCalledTimes(1);

      // Reset state
      resetSoundState();

      // Should allow immediate sound
      const result = playCompletionSound(config);
      expect(result).toBe(true);
      expect(mockStdoutWrite).toHaveBeenCalledTimes(2);
    });
  });

  describe('MIN_SOUND_INTERVAL_MS', () => {
    it('exports the minimum interval constant', () => {
      expect(MIN_SOUND_INTERVAL_MS).toBe(500);
    });
  });
});
