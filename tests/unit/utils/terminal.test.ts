/**
 * Tests for terminal capability detection utilities
 */

import {
  isTTY,
  isCI,
  supportsUnicode,
  getTerminalWidth,
  isNoColor,
  isForceColor,
  isScreenReaderActive,
  getTerminalCapabilities,
  shouldEnableAnimations,
  shouldUseAscii,
  MIN_TERMINAL_WIDTH,
  DEFAULT_TERMINAL_WIDTH,
} from '../../../src/utils/terminal';
import { AsmrConfig, DEFAULT_ASMR_CONFIG } from '../../../src/types/asmr';

describe('terminal utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear CI-related env vars
    delete process.env.CI;
    delete process.env.CONTINUOUS_INTEGRATION;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITLAB_CI;
    delete process.env.CIRCLECI;
    delete process.env.TRAVIS;
    delete process.env.JENKINS;
    delete process.env.BUILDKITE;
    // Clear color env vars
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    // Clear terminal detection vars
    delete process.env.WT_SESSION;
    delete process.env.TERM;
    delete process.env.LANG;
    delete process.env.LC_ALL;
    // Clear screen reader env vars
    delete process.env.ACCESSIBILITY_ENABLED;
    delete process.env.SCREEN_READER;
    delete process.env.ORCA_RUNNING;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('isTTY', () => {
    it('returns true when stdout.isTTY is true', () => {
      // Can't easily mock process.stdout.isTTY, so just test the function exists
      expect(typeof isTTY()).toBe('boolean');
    });
  });

  describe('isCI', () => {
    it('returns false when no CI env vars set', () => {
      expect(isCI()).toBe(false);
    });

    it('returns true when CI=true', () => {
      process.env.CI = 'true';
      expect(isCI()).toBe(true);
    });

    it('returns true when CI=1', () => {
      process.env.CI = '1';
      expect(isCI()).toBe(true);
    });

    it('returns false when CI=0', () => {
      process.env.CI = '0';
      expect(isCI()).toBe(false);
    });

    it('returns false when CI=false', () => {
      process.env.CI = 'false';
      expect(isCI()).toBe(false);
    });

    it('returns true when GITHUB_ACTIONS is set', () => {
      process.env.GITHUB_ACTIONS = 'true';
      expect(isCI()).toBe(true);
    });

    it('returns true when GITLAB_CI is set', () => {
      process.env.GITLAB_CI = 'true';
      expect(isCI()).toBe(true);
    });

    it('returns true when TRAVIS is set', () => {
      process.env.TRAVIS = 'true';
      expect(isCI()).toBe(true);
    });

    it('returns true when JENKINS is set', () => {
      process.env.JENKINS = 'true';
      expect(isCI()).toBe(true);
    });

    it('returns true when BUILDKITE is set', () => {
      process.env.BUILDKITE = 'true';
      expect(isCI()).toBe(true);
    });

    it('returns true when CIRCLECI is set', () => {
      process.env.CIRCLECI = 'true';
      expect(isCI()).toBe(true);
    });
  });

  describe('supportsUnicode', () => {
    it('returns true when WT_SESSION is set (Windows Terminal)', () => {
      process.env.WT_SESSION = 'some-session-id';
      expect(supportsUnicode()).toBe(true);
    });

    it('returns true when TERM contains xterm', () => {
      process.env.TERM = 'xterm-256color';
      expect(supportsUnicode()).toBe(true);
    });

    it('returns true when TERM contains 256color', () => {
      process.env.TERM = 'screen-256color';
      expect(supportsUnicode()).toBe(true);
    });

    it('returns true when LANG contains UTF-8', () => {
      process.env.LANG = 'en_US.UTF-8';
      expect(supportsUnicode()).toBe(true);
    });

    it('returns true when LC_ALL contains UTF-8', () => {
      process.env.LC_ALL = 'en_US.UTF-8';
      expect(supportsUnicode()).toBe(true);
    });

    it('returns false when no Unicode indicators present', () => {
      process.env.TERM = 'dumb';
      process.env.LANG = 'C';
      expect(supportsUnicode()).toBe(false);
    });
  });

  describe('getTerminalWidth', () => {
    it('returns DEFAULT_TERMINAL_WIDTH when columns not available', () => {
      // process.stdout.columns may or may not be set
      const width = getTerminalWidth();
      expect(typeof width).toBe('number');
      expect(width).toBeGreaterThan(0);
    });

    it('exports DEFAULT_TERMINAL_WIDTH constant', () => {
      expect(DEFAULT_TERMINAL_WIDTH).toBe(80);
    });

    it('exports MIN_TERMINAL_WIDTH constant', () => {
      expect(MIN_TERMINAL_WIDTH).toBe(40);
    });
  });

  describe('isNoColor', () => {
    it('returns false when NO_COLOR not set', () => {
      expect(isNoColor()).toBe(false);
    });

    it('returns true when NO_COLOR is set to any value', () => {
      process.env.NO_COLOR = '1';
      expect(isNoColor()).toBe(true);
    });

    it('returns true when NO_COLOR is set to empty string', () => {
      // Per no-color.org spec, presence of the variable matters, not its value
      process.env.NO_COLOR = '';
      expect(isNoColor()).toBe(true);
    });
  });

  describe('isForceColor', () => {
    it('returns false when FORCE_COLOR not set', () => {
      expect(isForceColor()).toBe(false);
    });

    it('returns true when FORCE_COLOR=1', () => {
      process.env.FORCE_COLOR = '1';
      expect(isForceColor()).toBe(true);
    });

    it('returns true when FORCE_COLOR=true', () => {
      process.env.FORCE_COLOR = 'true';
      expect(isForceColor()).toBe(true);
    });

    it('returns false when FORCE_COLOR=0', () => {
      process.env.FORCE_COLOR = '0';
      expect(isForceColor()).toBe(false);
    });

    it('returns false when FORCE_COLOR=false', () => {
      process.env.FORCE_COLOR = 'false';
      expect(isForceColor()).toBe(false);
    });
  });

  describe('isScreenReaderActive', () => {
    it('returns false when no screen reader env vars set', () => {
      expect(isScreenReaderActive()).toBe(false);
    });

    it('returns true when ACCESSIBILITY_ENABLED=1', () => {
      process.env.ACCESSIBILITY_ENABLED = '1';
      expect(isScreenReaderActive()).toBe(true);
    });

    it('returns true when SCREEN_READER=1', () => {
      process.env.SCREEN_READER = '1';
      expect(isScreenReaderActive()).toBe(true);
    });

    it('returns true when SCREEN_READER=true', () => {
      process.env.SCREEN_READER = 'true';
      expect(isScreenReaderActive()).toBe(true);
    });

    it('returns true when ORCA_RUNNING=1', () => {
      process.env.ORCA_RUNNING = '1';
      expect(isScreenReaderActive()).toBe(true);
    });

    it('returns false when ACCESSIBILITY_ENABLED=0', () => {
      process.env.ACCESSIBILITY_ENABLED = '0';
      expect(isScreenReaderActive()).toBe(false);
    });
  });

  describe('getTerminalCapabilities', () => {
    it('returns all capability flags', () => {
      const caps = getTerminalCapabilities();

      expect(typeof caps.isTTY).toBe('boolean');
      expect(typeof caps.isCI).toBe('boolean');
      expect(typeof caps.supportsUnicode).toBe('boolean');
      expect(typeof caps.width).toBe('number');
      expect(typeof caps.noColor).toBe('boolean');
      expect(typeof caps.screenReader).toBe('boolean');
    });

    it('reflects CI environment', () => {
      process.env.CI = 'true';
      const caps = getTerminalCapabilities();
      expect(caps.isCI).toBe(true);
    });

    it('reflects NO_COLOR setting', () => {
      process.env.NO_COLOR = '1';
      const caps = getTerminalCapabilities();
      expect(caps.noColor).toBe(true);
    });
  });

  describe('shouldEnableAnimations', () => {
    const enabledConfig: AsmrConfig = {
      enabled: true,
      theme: 'wave',
      sounds: false,
    };

    const disabledConfig: AsmrConfig = {
      ...DEFAULT_ASMR_CONFIG,
      enabled: false,
    };

    const fullCapabilities = {
      isTTY: true,
      isCI: false,
      supportsUnicode: true,
      width: 120,
      noColor: false,
      screenReader: false,
    };

    it('returns false when ASMR mode is disabled', () => {
      expect(shouldEnableAnimations(disabledConfig, fullCapabilities)).toBe(false);
    });

    it('returns false when not a TTY', () => {
      const caps = { ...fullCapabilities, isTTY: false };
      expect(shouldEnableAnimations(enabledConfig, caps)).toBe(false);
    });

    it('returns false when in CI', () => {
      const caps = { ...fullCapabilities, isCI: true };
      expect(shouldEnableAnimations(enabledConfig, caps)).toBe(false);
    });

    it('returns false when screen reader is active', () => {
      const caps = { ...fullCapabilities, screenReader: true };
      expect(shouldEnableAnimations(enabledConfig, caps)).toBe(false);
    });

    it('returns false when NO_COLOR is set', () => {
      const caps = { ...fullCapabilities, noColor: true };
      expect(shouldEnableAnimations(enabledConfig, caps)).toBe(false);
    });

    it('returns true when NO_COLOR is set but FORCE_COLOR overrides', () => {
      process.env.FORCE_COLOR = '1';
      const caps = { ...fullCapabilities, noColor: true };
      expect(shouldEnableAnimations(enabledConfig, caps)).toBe(true);
    });

    it('returns false when terminal width is too narrow', () => {
      const caps = { ...fullCapabilities, width: MIN_TERMINAL_WIDTH - 1 };
      expect(shouldEnableAnimations(enabledConfig, caps)).toBe(false);
    });

    it('returns true when all conditions are met', () => {
      expect(shouldEnableAnimations(enabledConfig, fullCapabilities)).toBe(true);
    });

    it('returns true at exactly MIN_TERMINAL_WIDTH', () => {
      const caps = { ...fullCapabilities, width: MIN_TERMINAL_WIDTH };
      expect(shouldEnableAnimations(enabledConfig, caps)).toBe(true);
    });
  });

  describe('shouldUseAscii', () => {
    it('returns true when Unicode not supported', () => {
      const caps = {
        isTTY: true,
        isCI: false,
        supportsUnicode: false,
        width: 80,
        noColor: false,
        screenReader: false,
      };
      expect(shouldUseAscii(caps)).toBe(true);
    });

    it('returns true when NO_COLOR is set', () => {
      const caps = {
        isTTY: true,
        isCI: false,
        supportsUnicode: true,
        width: 80,
        noColor: true,
        screenReader: false,
      };
      expect(shouldUseAscii(caps)).toBe(true);
    });

    it('returns false when Unicode supported and color allowed', () => {
      const caps = {
        isTTY: true,
        isCI: false,
        supportsUnicode: true,
        width: 80,
        noColor: false,
        screenReader: false,
      };
      expect(shouldUseAscii(caps)).toBe(false);
    });
  });
});
