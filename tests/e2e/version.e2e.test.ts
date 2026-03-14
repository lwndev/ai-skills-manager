/**
 * E2E tests for the --version flag.
 */

import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import { CLI_PATH, runCli } from './helpers';

describe('version e2e', () => {
  beforeAll(async () => {
    await fs.access(CLI_PATH);
  });

  it('displays version number with --version', () => {
    const result = runCli('--version');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('displays version number with -V', () => {
    const result = runCli('-V');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('outputs plain version when piped (non-TTY)', () => {
    const output = execSync(`node "${CLI_PATH}" --version | cat`, {
      encoding: 'utf-8',
    }).trim();
    // Piped output should be just the version number
    expect(output).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('outputs plain version with -q flag', () => {
    const result = runCli('--version -q');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('outputs valid JSON with -j flag', () => {
    const result = runCli('--version -j');
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed).toHaveProperty('version');
    expect(parsed).toHaveProperty('license');
    expect(parsed.version).toMatch(/\d+\.\d+\.\d+/);
  });
});
