import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  formatVersionBanner,
  formatVersionQuiet,
  formatVersionJSON,
  formatVersionOutput,
  MIN_BANNER_WIDTH,
} from '../../../src/formatters/version-formatter';

describe('version-formatter', () => {
  describe('formatVersionBanner', () => {
    it('returns string containing ASCII art', () => {
      const result = formatVersionBanner('1.8.3', 'MIT');
      expect(result).toContain('____');
      expect(result).toContain('/ \\');
    });

    it('includes version with v prefix', () => {
      const result = formatVersionBanner('1.8.3', 'MIT');
      expect(result).toContain('v1.8.3');
    });

    it('includes tagline', () => {
      const result = formatVersionBanner('1.8.3', 'MIT');
      expect(result).toContain('Create. Validate. Distribute.');
    });

    it('includes website', () => {
      const result = formatVersionBanner('1.8.3', 'MIT');
      expect(result).toContain('ai-skills-manager.app');
    });

    it('includes license', () => {
      const result = formatVersionBanner('1.8.3', 'MIT');
      expect(result).toContain('MIT License');
    });

    it('shows Unknown for empty license', () => {
      const result = formatVersionBanner('1.8.3', '');
      expect(result).toContain('Unknown License');
    });
  });

  describe('formatVersionQuiet', () => {
    it('returns plain version string', () => {
      expect(formatVersionQuiet('1.8.3')).toBe('1.8.3');
    });
  });

  describe('formatVersionJSON', () => {
    it('returns valid JSON with version and license', () => {
      const result = formatVersionJSON('1.8.3', 'MIT');
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ version: '1.8.3', license: 'MIT' });
    });
  });

  describe('formatVersionOutput', () => {
    let originalIsTTY: boolean | undefined;
    let originalColumns: number | undefined;

    beforeEach(() => {
      originalIsTTY = process.stdout.isTTY;
      originalColumns = process.stdout.columns;
    });

    afterEach(() => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stdout, 'columns', {
        value: originalColumns,
        writable: true,
        configurable: true,
      });
    });

    it('returns JSON when json option is true', () => {
      const result = formatVersionOutput('1.8.3', 'MIT', { json: true });
      expect(JSON.parse(result)).toEqual({ version: '1.8.3', license: 'MIT' });
    });

    it('returns plain version when quiet option is true', () => {
      const result = formatVersionOutput('1.8.3', 'MIT', { quiet: true });
      expect(result).toBe('1.8.3');
    });

    it('returns banner when TTY with sufficient width', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stdout, 'columns', {
        value: 80,
        writable: true,
        configurable: true,
      });
      const result = formatVersionOutput('1.8.3', 'MIT', {});
      expect(result).toContain('____');
      expect(result).toContain('v1.8.3');
    });

    it('returns plain version when not a TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const result = formatVersionOutput('1.8.3', 'MIT', {});
      expect(result).toBe('1.8.3');
    });

    it('returns plain version when terminal is too narrow', () => {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(process.stdout, 'columns', {
        value: MIN_BANNER_WIDTH - 1,
        writable: true,
        configurable: true,
      });
      const result = formatVersionOutput('1.8.3', 'MIT', {});
      expect(result).toBe('1.8.3');
    });

    it('json takes precedence over quiet', () => {
      const result = formatVersionOutput('1.8.3', 'MIT', { json: true, quiet: true });
      expect(JSON.parse(result)).toEqual({ version: '1.8.3', license: 'MIT' });
    });
  });
});
