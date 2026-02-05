/**
 * Integration tests for ASMR Mode
 *
 * Verifies that ASMR utilities work together correctly
 * and that the mode can be properly enabled/disabled.
 */

import {
  createAsmrContext,
  showBannerIfEnabled,
  createAsmrSpinner,
  withSpinner,
} from '../../src/utils/asmr-output';
import { AsmrConfig, DEFAULT_ASMR_CONFIG } from '../../src/types/asmr';
import { resolveAsmrConfig } from '../../src/config/asmr';
import { resetBannerState } from '../../src/utils/asmr';

// Mock terminal utilities to simulate different environments
jest.mock('../../src/utils/terminal', () => ({
  shouldEnableAnimations: jest.fn(),
  shouldUseAscii: jest.fn(() => false),
  isTTY: jest.fn(() => true),
  isCI: jest.fn(() => false),
  getTerminalWidth: jest.fn(() => 80),
  supportsUnicode: jest.fn(() => true),
  isNoColor: jest.fn(() => false),
  isForceColor: jest.fn(() => false),
  getTerminalCapabilities: jest.fn(() => ({
    isTTY: true,
    isCI: false,
    supportsUnicode: true,
    width: 80,
    noColor: false,
  })),
  MIN_TERMINAL_WIDTH: 40,
  DEFAULT_TERMINAL_WIDTH: 80,
}));

import { shouldEnableAnimations, isTTY } from '../../src/utils/terminal';

describe('ASMR Mode Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetBannerState();

    // Reset mocks
    (shouldEnableAnimations as jest.Mock).mockReturnValue(true);
    (isTTY as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('createAsmrContext', () => {
    it('creates context with default config when none provided', () => {
      (shouldEnableAnimations as jest.Mock).mockReturnValue(false);

      const ctx = createAsmrContext();

      expect(ctx.config).toEqual(DEFAULT_ASMR_CONFIG);
      expect(ctx.enabled).toBe(false);
    });

    it('creates context with provided config', () => {
      const config: AsmrConfig = {
        enabled: true,
        theme: 'pulse',
        sounds: false,
      };

      (shouldEnableAnimations as jest.Mock).mockReturnValue(true);

      const ctx = createAsmrContext(config);

      expect(ctx.config).toEqual(config);
      expect(ctx.enabled).toBe(true);
    });

    it('respects terminal capabilities', () => {
      const enabledConfig: AsmrConfig = {
        enabled: true,
        theme: 'wave',
        sounds: false,
      };

      // Simulate non-TTY environment
      (shouldEnableAnimations as jest.Mock).mockReturnValue(false);

      const ctx = createAsmrContext(enabledConfig);

      expect(ctx.config.enabled).toBe(true); // Config says enabled
      expect(ctx.enabled).toBe(false); // But terminal doesn't support
    });
  });

  describe('showBannerIfEnabled', () => {
    it('shows banner when ASMR is enabled', () => {
      const ctx = createAsmrContext({
        enabled: true,
        theme: 'wave',
        sounds: false,
      });

      const result = showBannerIfEnabled(ctx);

      expect(result).toBe(true);
    });

    it('does not show banner when ASMR is disabled', () => {
      (shouldEnableAnimations as jest.Mock).mockReturnValue(false);

      const ctx = createAsmrContext(DEFAULT_ASMR_CONFIG);

      const result = showBannerIfEnabled(ctx);

      expect(result).toBe(false);
    });

    it('only shows banner once per session', () => {
      const ctx = createAsmrContext({
        enabled: true,
        theme: 'wave',
        sounds: false,
      });

      const first = showBannerIfEnabled(ctx);
      const second = showBannerIfEnabled(ctx);

      expect(first).toBe(true);
      expect(second).toBe(false);
    });
  });

  describe('AsmrSpinner', () => {
    it('starts and stops without errors when enabled', () => {
      const ctx = createAsmrContext({
        enabled: true,
        theme: 'wave',
        sounds: false,
      });

      const spinner = createAsmrSpinner(ctx);
      spinner.start('Testing...');

      expect(spinner.spinning).toBe(true);

      spinner.stop();

      expect(spinner.spinning).toBe(false);
    });

    it('handles succeed correctly', () => {
      const ctx = createAsmrContext({
        enabled: true,
        theme: 'wave',
        sounds: false,
      });

      const spinner = createAsmrSpinner(ctx);
      spinner.start('Working...');
      spinner.succeed('Done!');

      expect(spinner.spinning).toBe(false);
    });

    it('handles fail correctly', () => {
      const ctx = createAsmrContext({
        enabled: true,
        theme: 'wave',
        sounds: false,
      });

      const spinner = createAsmrSpinner(ctx);
      spinner.start('Working...');
      spinner.fail('Failed!');

      expect(spinner.spinning).toBe(false);
    });

    it('falls back gracefully when disabled', () => {
      (shouldEnableAnimations as jest.Mock).mockReturnValue(false);

      const ctx = createAsmrContext(DEFAULT_ASMR_CONFIG);

      const spinner = createAsmrSpinner(ctx);

      // Should not throw
      expect(() => {
        spinner.start('Test');
        spinner.update('Updated');
        spinner.succeed('Done');
      }).not.toThrow();
    });

    it('can use operation-specific messages', () => {
      const ctx = createAsmrContext({
        enabled: true,
        theme: 'wave',
        sounds: false,
      });

      const spinner = createAsmrSpinner(ctx);
      spinner.startWithMessages('install');

      expect(spinner.spinning).toBe(true);

      spinner.stop();
    });
  });

  describe('withSpinner', () => {
    it('runs task and returns result', async () => {
      const ctx = createAsmrContext({
        enabled: true,
        theme: 'wave',
        sounds: false,
      });

      const result = await withSpinner(
        'install',
        async () => {
          return { success: true, value: 42 };
        },
        ctx
      );

      expect(result).toEqual({ success: true, value: 42 });
    });

    it('propagates errors from task', async () => {
      const ctx = createAsmrContext({
        enabled: true,
        theme: 'wave',
        sounds: false,
      });

      await expect(
        withSpinner(
          'install',
          async () => {
            throw new Error('Task failed');
          },
          ctx
        )
      ).rejects.toThrow('Task failed');
    });

    it('works when ASMR is disabled', async () => {
      (shouldEnableAnimations as jest.Mock).mockReturnValue(false);

      const ctx = createAsmrContext(DEFAULT_ASMR_CONFIG);

      const result = await withSpinner('install', async () => 'done', ctx);

      expect(result).toBe('done');
    });
  });

  describe('Config Resolution', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.ASM_ASMR;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('defaults to disabled', () => {
      const { config } = resolveAsmrConfig();
      expect(config.enabled).toBe(false);
    });

    it('respects CLI flag', () => {
      const { config, source } = resolveAsmrConfig({ cliFlag: true });

      expect(config.enabled).toBe(true);
      expect(source).toBe('flag');
    });

    it('respects environment variable', () => {
      process.env.ASM_ASMR = '1';

      const { config, source } = resolveAsmrConfig();

      expect(config.enabled).toBe(true);
      expect(source).toBe('env');
    });

    it('CLI flag overrides environment variable', () => {
      process.env.ASM_ASMR = '1';

      const { config, source } = resolveAsmrConfig({ cliFlag: false });

      expect(config.enabled).toBe(false);
      expect(source).toBe('flag');
    });
  });

  describe('Backward Compatibility', () => {
    it('default config produces disabled state', () => {
      (shouldEnableAnimations as jest.Mock).mockReturnValue(false);

      const ctx = createAsmrContext();

      expect(ctx.enabled).toBe(false);
    });

    it('disabled context does not animate', () => {
      (shouldEnableAnimations as jest.Mock).mockReturnValue(false);

      const ctx = createAsmrContext();
      const spinner = createAsmrSpinner(ctx);

      spinner.start('Test');

      // Should not have a real spinner
      expect(spinner.spinning).toBe(false);

      spinner.stop();
    });
  });
});
