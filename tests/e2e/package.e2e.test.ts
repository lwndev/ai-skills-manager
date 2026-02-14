/**
 * E2E tests for the package command.
 */

import * as fs from 'fs/promises';
import { CLI_PATH, runCli, scaffoldSkill, createTempDir, cleanupDir } from './helpers';

describe('package e2e', () => {
  let tempDir: string;

  beforeAll(async () => {
    await fs.access(CLI_PATH);
  });

  beforeEach(async () => {
    tempDir = await createTempDir('package-e2e-');
  });

  afterEach(async () => {
    await cleanupDir(tempDir);
  });

  // ── 3.1 CLI packaging ──────────────────────────────────────────────

  describe('CLI packaging', () => {
    it('packages a valid skill via CLI', async () => {
      const { skillDir } = scaffoldSkill('test-pkg', tempDir);
      const outputDir = `${tempDir}/output`;
      await fs.mkdir(outputDir, { recursive: true });

      const result = runCli(`package "${skillDir}" -o "${outputDir}" --force`);
      expect(result.exitCode).toBe(0);

      const stat = await fs.stat(`${outputDir}/test-pkg.skill`);
      expect(stat.isFile()).toBe(true);
    });

    it('packages to a custom output directory', async () => {
      const { skillDir } = scaffoldSkill('test-custom-out', tempDir);
      const outputDir = `${tempDir}/custom`;
      await fs.mkdir(outputDir, { recursive: true });

      const result = runCli(`package "${skillDir}" -o "${outputDir}" --force`);
      expect(result.exitCode).toBe(0);

      const stat = await fs.stat(`${outputDir}/test-custom-out.skill`);
      expect(stat.isFile()).toBe(true);
    });

    it('produces minimal output in quiet mode', async () => {
      const { skillDir } = scaffoldSkill('test-quiet-pkg', tempDir);
      const outputDir = `${tempDir}/quiet`;
      await fs.mkdir(outputDir, { recursive: true });

      const result = runCli(`package "${skillDir}" -o "${outputDir}" --force -q`);
      expect(result.exitCode).toBe(0);
      // Quiet mode outputs just the path
      const lines = result.stdout.trim().split('\n').filter(Boolean);
      expect(lines.length).toBeLessThanOrEqual(2);
    });
  });

  // ── 3.2 Error cases ────────────────────────────────────────────────

  describe('error cases', () => {
    it('exits 1 for invalid skill (validation failure)', async () => {
      const skillDir = `${tempDir}/bad-skill`;
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(`${skillDir}/SKILL.md`, 'no frontmatter', 'utf-8');

      const result = runCli(`package "${skillDir}" -o "${tempDir}" --force`);
      expect(result.exitCode).toBe(1);
    });

    it('exits 2 for non-existent path', () => {
      const result = runCli(`package "${tempDir}/no-such-skill" -o "${tempDir}"`);
      expect(result.exitCode).toBe(2);
    });
  });

  // ── Exit code verification ─────────────────────────────────────────

  describe('exit codes', () => {
    it('returns 0 on success', async () => {
      const { skillDir } = scaffoldSkill('test-exit-ok', tempDir);
      const outputDir = `${tempDir}/exit-ok`;
      await fs.mkdir(outputDir, { recursive: true });

      const result = runCli(`package "${skillDir}" -o "${outputDir}" --force`);
      expect(result.exitCode).toBe(0);
    });

    it('returns 1 on validation failure', async () => {
      const skillDir = `${tempDir}/invalid`;
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(`${skillDir}/SKILL.md`, '---\nbad: yaml\n---\n', 'utf-8');

      const result = runCli(`package "${skillDir}" -o "${tempDir}" --force`);
      expect(result.exitCode).toBe(1);
    });

    it('returns 2 on file system error', () => {
      const result = runCli(`package "${tempDir}/does-not-exist" -o "${tempDir}"`);
      expect(result.exitCode).toBe(2);
    });
  });
});
