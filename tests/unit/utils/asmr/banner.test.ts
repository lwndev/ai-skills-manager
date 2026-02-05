/**
 * Tests for ASMR Mode Banner and Summaries
 */

import {
  showAsmrBanner,
  showCompletionSummary,
  showAsciiArt,
  showDivider,
  resetBannerState,
  isBannerShown,
  OperationStats,
} from '../../../../src/utils/asmr/banner';

// Mock terminal utilities
jest.mock('../../../../src/utils/terminal', () => ({
  shouldUseAscii: jest.fn(() => false),
  isTTY: jest.fn(() => true),
}));

import { shouldUseAscii, isTTY } from '../../../../src/utils/terminal';

describe('banner', () => {
  let mockStream: {
    write: jest.Mock;
  };

  beforeEach(() => {
    mockStream = {
      write: jest.fn(),
    };
    (shouldUseAscii as jest.Mock).mockReturnValue(false);
    (isTTY as jest.Mock).mockReturnValue(true);
    resetBannerState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('showAsmrBanner', () => {
    it('shows banner with Unicode dots', () => {
      const result = showAsmrBanner({ stream: mockStream as unknown as NodeJS.WriteStream });

      expect(result).toBe(true);
      expect(mockStream.write).toHaveBeenCalledWith('\n  · asmr mode ·\n\n');
    });

    it('shows banner with ASCII dots when in ASCII mode', () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);

      const result = showAsmrBanner({ stream: mockStream as unknown as NodeJS.WriteStream });

      expect(result).toBe(true);
      expect(mockStream.write).toHaveBeenCalledWith('\n  . asmr mode .\n\n');
    });

    it('only shows banner once per session', () => {
      showAsmrBanner({ stream: mockStream as unknown as NodeJS.WriteStream });
      mockStream.write.mockClear();

      const result = showAsmrBanner({ stream: mockStream as unknown as NodeJS.WriteStream });

      expect(result).toBe(false);
      expect(mockStream.write).not.toHaveBeenCalled();
    });

    it('shows banner again when forced', () => {
      showAsmrBanner({ stream: mockStream as unknown as NodeJS.WriteStream });
      mockStream.write.mockClear();

      const result = showAsmrBanner({
        stream: mockStream as unknown as NodeJS.WriteStream,
        force: true,
      });

      expect(result).toBe(true);
      expect(mockStream.write).toHaveBeenCalled();
    });

    it('does not show banner when not TTY', () => {
      (isTTY as jest.Mock).mockReturnValue(false);

      const result = showAsmrBanner({ stream: mockStream as unknown as NodeJS.WriteStream });

      expect(result).toBe(false);
      expect(mockStream.write).not.toHaveBeenCalled();
    });

    it('respects forceAscii option', () => {
      const result = showAsmrBanner({
        stream: mockStream as unknown as NodeJS.WriteStream,
        forceAscii: true,
      });

      expect(result).toBe(true);
      expect(mockStream.write).toHaveBeenCalledWith('\n  . asmr mode .\n\n');
    });
  });

  describe('isBannerShown', () => {
    it('returns false initially', () => {
      expect(isBannerShown()).toBe(false);
    });

    it('returns true after banner is shown', () => {
      showAsmrBanner({ stream: mockStream as unknown as NodeJS.WriteStream });
      expect(isBannerShown()).toBe(true);
    });
  });

  describe('resetBannerState', () => {
    it('resets banner state', () => {
      showAsmrBanner({ stream: mockStream as unknown as NodeJS.WriteStream });
      expect(isBannerShown()).toBe(true);

      resetBannerState();
      expect(isBannerShown()).toBe(false);
    });
  });

  describe('showCompletionSummary', () => {
    it('shows success count', () => {
      const stats: OperationStats = { success: 5, failed: 0, skipped: 0 };
      showCompletionSummary(stats, { stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('✓ 5 succeeded');
    });

    it('shows failed count', () => {
      const stats: OperationStats = { success: 0, failed: 2, skipped: 0 };
      showCompletionSummary(stats, { stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('✗ 2 failed');
    });

    it('shows skipped count', () => {
      const stats: OperationStats = { success: 0, failed: 0, skipped: 3 };
      showCompletionSummary(stats, { stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('○ 3 skipped');
    });

    it('shows duration in milliseconds', () => {
      const stats: OperationStats = { success: 1, failed: 0, skipped: 0, duration: 500 };
      showCompletionSummary(stats, { stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('500ms');
    });

    it('shows duration in seconds', () => {
      const stats: OperationStats = { success: 1, failed: 0, skipped: 0, duration: 2500 };
      showCompletionSummary(stats, { stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('2.5s');
    });

    it('shows duration in minutes and seconds', () => {
      const stats: OperationStats = { success: 1, failed: 0, skipped: 0, duration: 125000 };
      showCompletionSummary(stats, { stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('2m 5s');
    });

    it('uses ASCII symbols when in ASCII mode', () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);

      const stats: OperationStats = { success: 1, failed: 1, skipped: 1 };
      showCompletionSummary(stats, { stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('+ 1 succeeded');
      expect(output).toContain('x 1 failed');
      expect(output).toContain('- 1 skipped');
    });

    it('does not output if all counts are zero', () => {
      const stats: OperationStats = { success: 0, failed: 0, skipped: 0 };
      showCompletionSummary(stats, { stream: mockStream as unknown as NodeJS.WriteStream });

      expect(mockStream.write).not.toHaveBeenCalled();
    });

    it('uses separator for multiple stats', () => {
      const stats: OperationStats = { success: 3, failed: 1, skipped: 0 };
      showCompletionSummary(stats, { stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('  ·  '); // Unicode separator
    });

    it('uses ASCII separator in ASCII mode', () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);

      const stats: OperationStats = { success: 3, failed: 1, skipped: 0 };
      showCompletionSummary(stats, { stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('  .  '); // ASCII separator
    });

    it('outputs without separator when not TTY', () => {
      (isTTY as jest.Mock).mockReturnValue(false);

      const stats: OperationStats = { success: 3, failed: 1, skipped: 0 };
      showCompletionSummary(stats, { stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('  '); // Double space separator
      expect(output).not.toContain('\n\n'); // No extra newlines
    });
  });

  describe('showAsciiArt', () => {
    it('shows Unicode dots art', () => {
      showAsciiArt({ stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('·');
    });

    it('shows ASCII dots art when in ASCII mode', () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);

      showAsciiArt({ stream: mockStream as unknown as NodeJS.WriteStream });

      const output = mockStream.write.mock.calls[0][0];
      expect(output).toContain('.');
      expect(output).not.toContain('·');
    });

    it('does not output when not TTY', () => {
      (isTTY as jest.Mock).mockReturnValue(false);

      showAsciiArt({ stream: mockStream as unknown as NodeJS.WriteStream });

      expect(mockStream.write).not.toHaveBeenCalled();
    });
  });

  describe('showDivider', () => {
    it('shows Unicode divider', () => {
      showDivider(20, { stream: mockStream as unknown as NodeJS.WriteStream });

      expect(mockStream.write).toHaveBeenCalledWith('─'.repeat(20) + '\n');
    });

    it('shows ASCII divider when in ASCII mode', () => {
      (shouldUseAscii as jest.Mock).mockReturnValue(true);

      showDivider(20, { stream: mockStream as unknown as NodeJS.WriteStream });

      expect(mockStream.write).toHaveBeenCalledWith('-'.repeat(20) + '\n');
    });

    it('uses default width of 40', () => {
      showDivider(undefined, { stream: mockStream as unknown as NodeJS.WriteStream });

      expect(mockStream.write).toHaveBeenCalledWith('─'.repeat(40) + '\n');
    });

    it('does not output when not TTY', () => {
      (isTTY as jest.Mock).mockReturnValue(false);

      showDivider(20, { stream: mockStream as unknown as NodeJS.WriteStream });

      expect(mockStream.write).not.toHaveBeenCalled();
    });
  });
});
