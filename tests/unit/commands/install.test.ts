/**
 * Unit tests for the install command (src/commands/install.ts)
 *
 * Tests handleInstall (main handler) and handleError (error handler)
 * through the Commander action registered by registerInstallCommand.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { Command } from 'commander';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('../../../src/generators/installer', () => ({
  installSkill: vi.fn(),
  isOverwriteRequired: vi.fn().mockReturnValue(false),
  isDryRunPreview: vi.fn().mockReturnValue(false),
  isInstallResult: vi.fn().mockReturnValue(true),
}));

vi.mock('../../../src/validators/package-file', () => ({
  validatePackageFile: vi.fn(),
}));

vi.mock('../../../src/generators/install-validator', () => ({
  analyzePackageWarnings: vi.fn().mockReturnValue({ isLargePackage: false, totalSize: 0 }),
}));

vi.mock('../../../src/utils/extractor', () => ({
  openZipArchive: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../src/formatters/install-formatter', () => ({
  formatInstallProgress: vi.fn().mockReturnValue('progress...'),
  formatInstallSuccess: vi.fn().mockReturnValue('success!'),
  formatDryRunOutput: vi.fn().mockReturnValue('dry-run output'),
  formatOverwritePrompt: vi.fn().mockReturnValue('overwrite?'),
  formatPackageWarnings: vi.fn().mockReturnValue(''),
  formatLargePackageProgress: vi.fn().mockReturnValue('large package...'),
}));

vi.mock('../../../src/utils/prompts', () => ({
  confirmInstallOverwrite: vi.fn(),
}));

vi.mock('../../../src/utils/output', () => ({
  error: vi.fn((msg: string) => `ERROR: ${msg}`),
  displayError: vi.fn(),
}));

vi.mock('../../../src/utils/debug', () => ({
  createDebugLogger: vi.fn().mockReturnValue(vi.fn()),
}));

// ── Import mocked modules ────────────────────────────────────────────

import {
  installSkill,
  isOverwriteRequired,
  isDryRunPreview,
  isInstallResult,
} from '../../../src/generators/installer';
import { validatePackageFile } from '../../../src/validators/package-file';
import { analyzePackageWarnings } from '../../../src/generators/install-validator';
import { openZipArchive } from '../../../src/utils/extractor';
import {
  formatInstallProgress,
  formatInstallSuccess,
  formatDryRunOutput,
  formatPackageWarnings,
  formatLargePackageProgress,
} from '../../../src/formatters/install-formatter';
import { confirmInstallOverwrite } from '../../../src/utils/prompts';
import * as output from '../../../src/utils/output';
import {
  AsmError,
  FileSystemError,
  PackageError,
  SecurityError,
  CancellationError,
} from '../../../src/errors';

// ── Cast mocks ───────────────────────────────────────────────────────

const mockInstallSkill = installSkill as Mock;
const mockIsOverwriteRequired = isOverwriteRequired as Mock;
const mockIsDryRunPreview = isDryRunPreview as Mock;
const mockIsInstallResult = isInstallResult as Mock;
const mockValidatePackageFile = validatePackageFile as Mock;
const mockAnalyzePackageWarnings = analyzePackageWarnings as Mock;
const mockOpenZipArchive = openZipArchive as Mock;
const mockFormatInstallProgress = formatInstallProgress as Mock;
const mockFormatInstallSuccess = formatInstallSuccess as Mock;
const mockFormatDryRunOutput = formatDryRunOutput as Mock;
const mockFormatPackageWarnings = formatPackageWarnings as Mock;
const mockFormatLargePackageProgress = formatLargePackageProgress as Mock;
const mockConfirmInstallOverwrite = confirmInstallOverwrite as Mock;
const mockDisplayError = output.displayError as Mock;

// ── ProcessExitError for capturing process.exit calls ────────────────

class ProcessExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.name = 'ProcessExitError';
    this.code = code;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

let consoleLogSpy: Mock;
let consoleErrorSpy: Mock;
let processExitSpy: Mock;

async function createTestProgram(): Promise<Command> {
  const { registerInstallCommand } = await import('../../../src/commands/install');
  const program = new Command();
  program.exitOverride();
  registerInstallCommand(program);
  return program;
}

async function run(args: string[]): Promise<void> {
  const program = await createTestProgram();
  await program.parseAsync(['node', 'asm', ...args]);
}

// ── Setup / Teardown ─────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  consoleLogSpy = vi.fn();
  consoleErrorSpy = vi.fn();
  vi.spyOn(console, 'log').mockImplementation(consoleLogSpy);
  vi.spyOn(console, 'error').mockImplementation(consoleErrorSpy);

  processExitSpy = vi
    .spyOn(process, 'exit')
    .mockImplementation((code?: number | string | null | undefined) => {
      throw new ProcessExitError(typeof code === 'number' ? code : 1);
    });

  // Default happy-path mocks
  mockValidatePackageFile.mockResolvedValue({
    valid: true,
    packagePath: '/resolved/my-skill.skill',
  });

  mockInstallSkill.mockResolvedValue({
    success: true,
    skillPath: '/installed/my-skill',
    errors: [],
  });
  mockIsInstallResult.mockReturnValue(true);
  mockIsOverwriteRequired.mockReturnValue(false);
  mockIsDryRunPreview.mockReturnValue(false);

  // Re-apply formatter defaults (cleared by clearAllMocks)
  mockFormatInstallProgress.mockReturnValue('progress...');
  mockFormatInstallSuccess.mockReturnValue('success!');
  mockFormatDryRunOutput.mockReturnValue('dry-run output');
  mockFormatPackageWarnings.mockReturnValue('');
  mockFormatLargePackageProgress.mockReturnValue('large package...');
  (output.error as Mock).mockImplementation((msg: string) => `ERROR: ${msg}`);
  mockAnalyzePackageWarnings.mockReturnValue({ isLargePackage: false, totalSize: 0 });
  mockOpenZipArchive.mockReturnValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('install command', () => {
  // ── EXIT_CODES ───────────────────────────────────────────────────

  describe('EXIT_CODES', () => {
    it('exports the correct exit codes', async () => {
      const { EXIT_CODES } = await import('../../../src/commands/install');
      expect(EXIT_CODES).toEqual({
        SUCCESS: 0,
        VALIDATION_FAILED: 1,
        FILE_SYSTEM_ERROR: 2,
        EXTRACTION_ERROR: 3,
        USER_CANCELLED: 4,
      });
    });
  });

  // ── Happy path ───────────────────────────────────────────────────

  describe('successful installation', () => {
    it('installs a skill and prints success output', async () => {
      await run(['install', 'my-skill.skill']);

      expect(mockInstallSkill).toHaveBeenCalledWith(
        '/resolved/my-skill.skill',
        expect.objectContaining({ dryRun: false })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('success!');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('shows progress messages when not quiet', async () => {
      await run(['install', 'my-skill.skill']);

      expect(mockFormatInstallProgress).toHaveBeenCalledWith('opening');
      expect(mockFormatInstallProgress).toHaveBeenCalledWith('validating');
    });

    it('prints only skillPath in quiet mode', async () => {
      await run(['install', 'my-skill.skill', '--quiet']);

      expect(consoleLogSpy).toHaveBeenCalledWith('/installed/my-skill');
      // Should not show progress or formatted success
      expect(mockFormatInstallProgress).not.toHaveBeenCalled();
      expect(mockFormatInstallSuccess).not.toHaveBeenCalled();
    });

    it('passes scope, force, thorough options to installSkill', async () => {
      await run(['install', 'my-skill.skill', '--scope', 'personal', '--force', '--thorough']);

      expect(mockInstallSkill).toHaveBeenCalledWith(
        '/resolved/my-skill.skill',
        expect.objectContaining({
          scope: 'personal',
          force: true,
          thorough: true,
          dryRun: false,
        })
      );
    });
  });

  // ── Validation failure ───────────────────────────────────────────

  describe('package validation failure', () => {
    beforeEach(() => {
      mockValidatePackageFile.mockResolvedValue({
        valid: false,
        packagePath: '/bad/path.skill',
      });
    });

    it('exits with FILE_SYSTEM_ERROR when package validation fails', async () => {
      await expect(run(['install', 'bad.skill'])).rejects.toThrow(ProcessExitError);
      expect(processExitSpy).toHaveBeenCalledWith(2);
    });

    it('prints FAIL message in quiet mode', async () => {
      await expect(run(['install', 'bad.skill', '--quiet'])).rejects.toThrow(ProcessExitError);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('FAIL:'));
    });

    it('uses original packagePath when validation returns no packagePath', async () => {
      mockValidatePackageFile.mockResolvedValue({
        valid: false,
        packagePath: undefined,
      });

      await expect(run(['install', 'missing.skill'])).rejects.toThrow(ProcessExitError);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('missing.skill'));
    });
  });

  // ── Warning analysis ─────────────────────────────────────────────

  describe('warning analysis', () => {
    it('shows package warnings when present', async () => {
      mockFormatPackageWarnings.mockReturnValue('WARNING: large files');

      await run(['install', 'my-skill.skill']);

      expect(consoleLogSpy).toHaveBeenCalledWith('WARNING: large files');
    });

    it('shows large package progress when isLargePackage is true', async () => {
      mockAnalyzePackageWarnings.mockReturnValue({ isLargePackage: true, totalSize: 5000000 });

      await run(['install', 'my-skill.skill']);

      expect(mockFormatLargePackageProgress).toHaveBeenCalledWith(5000000);
      expect(consoleLogSpy).toHaveBeenCalledWith('large package...');
    });

    it('skips warning analysis in quiet mode', async () => {
      await run(['install', 'my-skill.skill', '--quiet']);

      expect(mockOpenZipArchive).not.toHaveBeenCalled();
    });

    it('silently catches warning analysis errors', async () => {
      mockOpenZipArchive.mockImplementation(() => {
        throw new Error('zip read error');
      });

      // Should not throw; installation continues
      await run(['install', 'my-skill.skill']);

      expect(consoleLogSpy).toHaveBeenCalledWith('success!');
    });
  });

  // ── Dry-run ──────────────────────────────────────────────────────

  describe('dry-run mode', () => {
    it('calls installSkill with dryRun:true and formats preview', async () => {
      const dryRunResult = { files: ['SKILL.md'], targetPath: '/target' };
      mockInstallSkill.mockResolvedValue(dryRunResult);
      mockIsDryRunPreview.mockReturnValue(true);

      await run(['install', 'my-skill.skill', '--dry-run']);

      expect(mockInstallSkill).toHaveBeenCalledWith(
        '/resolved/my-skill.skill',
        expect.objectContaining({ dryRun: true })
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('dry-run output');
    });

    it('exits with SUCCESS on dry-run', async () => {
      mockInstallSkill.mockResolvedValue({ files: [] });
      mockIsDryRunPreview.mockReturnValue(true);

      await run(['install', 'my-skill.skill', '--dry-run']);

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('falls through to normal install when isDryRunPreview is false', async () => {
      mockIsDryRunPreview.mockReturnValue(false);
      // First call for dry-run returns something that is not a preview,
      // second call is the normal install
      mockInstallSkill
        .mockResolvedValueOnce({ unexpected: true })
        .mockResolvedValueOnce({ success: true, skillPath: '/installed/path', errors: [] });

      await run(['install', 'my-skill.skill', '--dry-run']);

      // installSkill called twice: once for dry-run attempt, once for real install
      expect(mockInstallSkill).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith('success!');
    });
  });

  // ── Overwrite scenario ───────────────────────────────────────────

  describe('overwrite scenario', () => {
    const overwriteResult = {
      existingPath: '/existing/skill-path',
      skillName: 'my-skill',
      files: ['SKILL.md', 'code.ts'],
    };

    beforeEach(() => {
      // First call returns overwrite required, second call succeeds
      mockIsOverwriteRequired.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockInstallSkill
        .mockResolvedValueOnce(overwriteResult)
        .mockResolvedValueOnce({ success: true, skillPath: '/installed/my-skill', errors: [] });
      mockIsInstallResult.mockReturnValue(true);
    });

    it('prompts user and retries with force when confirmed', async () => {
      mockConfirmInstallOverwrite.mockResolvedValue(true);

      await run(['install', 'my-skill.skill']);

      expect(mockConfirmInstallOverwrite).toHaveBeenCalledWith('my-skill', 'overwrite?');
      // Second call should have force: true
      expect(mockInstallSkill).toHaveBeenCalledTimes(2);
      expect(mockInstallSkill.mock.calls[1][1]).toMatchObject({ force: true });
      expect(consoleLogSpy).toHaveBeenCalledWith('success!');
    });

    it('returns USER_CANCELLED when user declines overwrite', async () => {
      // Re-setup overwrite mocks since prior test may have consumed mockReturnValueOnce
      mockIsOverwriteRequired.mockReset();
      mockIsOverwriteRequired.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockInstallSkill.mockReset();
      mockInstallSkill
        .mockResolvedValueOnce(overwriteResult)
        .mockResolvedValueOnce({ success: true, skillPath: '/installed/my-skill', errors: [] });
      mockConfirmInstallOverwrite.mockResolvedValue(false);

      await expect(run(['install', 'my-skill.skill'])).rejects.toThrow(ProcessExitError);
      expect(processExitSpy).toHaveBeenCalledWith(4);
      expect(mockDisplayError).toHaveBeenCalledWith('Installation cancelled by user');
    });

    it('fails immediately in quiet mode when overwrite is required', async () => {
      // Override: make isOverwriteRequired always return true for this test
      mockIsOverwriteRequired.mockReset();
      mockIsOverwriteRequired.mockReturnValue(true);
      mockInstallSkill.mockReset();
      mockInstallSkill.mockResolvedValue(overwriteResult);

      await expect(run(['install', 'my-skill.skill', '--quiet'])).rejects.toThrow(ProcessExitError);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'FAIL: Skill already exists: /existing/skill-path'
      );
    });

    it('shows extracting progress when retrying with force (non-quiet)', async () => {
      mockConfirmInstallOverwrite.mockResolvedValue(true);

      await run(['install', 'my-skill.skill']);

      expect(mockFormatInstallProgress).toHaveBeenCalledWith('extracting');
    });
  });

  // ── isInstallResult false (unexpected result) ────────────────────

  describe('unexpected installation result', () => {
    it('throws PackageError when isInstallResult returns false', async () => {
      mockIsInstallResult.mockReturnValue(false);

      await expect(run(['install', 'my-skill.skill'])).rejects.toThrow(ProcessExitError);
      expect(processExitSpy).toHaveBeenCalledWith(3); // EXTRACTION_ERROR
    });
  });

  // ── Installation result with errors ──────────────────────────────

  describe('installation result with errors', () => {
    it('throws PackageError when result.success is false', async () => {
      mockInstallSkill.mockResolvedValue({
        success: false,
        skillPath: '',
        errors: ['extraction failed', 'bad format'],
      });

      await expect(run(['install', 'my-skill.skill'])).rejects.toThrow(ProcessExitError);
      expect(processExitSpy).toHaveBeenCalledWith(3);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('extraction failed, bad format')
      );
    });

    it('uses "Unknown error" when errors array is empty', async () => {
      mockInstallSkill.mockResolvedValue({
        success: false,
        skillPath: '',
        errors: [],
      });

      await expect(run(['install', 'my-skill.skill'])).rejects.toThrow(ProcessExitError);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));
    });
  });

  // ── handleError ──────────────────────────────────────────────────

  describe('handleError', () => {
    describe('CancellationError', () => {
      beforeEach(() => {
        mockInstallSkill.mockRejectedValue(new CancellationError('user aborted'));
      });

      it('returns USER_CANCELLED (exit 4) in normal mode', async () => {
        await expect(run(['install', 'my-skill.skill'])).rejects.toThrow(ProcessExitError);
        expect(processExitSpy).toHaveBeenCalledWith(4);
        expect(consoleLogSpy).toHaveBeenCalledWith('ERROR: user aborted');
      });

      it('prints CANCELLED in quiet mode', async () => {
        await expect(run(['install', 'my-skill.skill', '--quiet'])).rejects.toThrow(
          ProcessExitError
        );
        expect(processExitSpy).toHaveBeenCalledWith(4);
        expect(consoleLogSpy).toHaveBeenCalledWith('CANCELLED');
      });
    });

    describe('SecurityError', () => {
      beforeEach(() => {
        mockInstallSkill.mockRejectedValue(new SecurityError('path traversal detected'));
      });

      it('returns VALIDATION_FAILED (exit 1) in normal mode', async () => {
        await expect(run(['install', 'my-skill.skill'])).rejects.toThrow(ProcessExitError);
        expect(processExitSpy).toHaveBeenCalledWith(1);
        expect(consoleLogSpy).toHaveBeenCalledWith('ERROR: Security error');
        expect(consoleLogSpy).toHaveBeenCalledWith('  path traversal detected');
      });

      it('prints FAIL message in quiet mode', async () => {
        await expect(run(['install', 'my-skill.skill', '--quiet'])).rejects.toThrow(
          ProcessExitError
        );
        expect(processExitSpy).toHaveBeenCalledWith(1);
        expect(consoleLogSpy).toHaveBeenCalledWith('FAIL: path traversal detected');
      });
    });

    describe('FileSystemError', () => {
      beforeEach(() => {
        mockInstallSkill.mockRejectedValue(new FileSystemError('permission denied', '/some/path'));
      });

      it('returns FILE_SYSTEM_ERROR (exit 2) in normal mode', async () => {
        await expect(run(['install', 'my-skill.skill'])).rejects.toThrow(ProcessExitError);
        expect(processExitSpy).toHaveBeenCalledWith(2);
        expect(consoleLogSpy).toHaveBeenCalledWith('ERROR: File system error');
        expect(consoleLogSpy).toHaveBeenCalledWith('  permission denied');
      });

      it('prints FAIL message in quiet mode', async () => {
        await expect(run(['install', 'my-skill.skill', '--quiet'])).rejects.toThrow(
          ProcessExitError
        );
        expect(processExitSpy).toHaveBeenCalledWith(2);
        expect(consoleLogSpy).toHaveBeenCalledWith('FAIL: permission denied');
      });
    });

    describe('PackageError', () => {
      beforeEach(() => {
        mockInstallSkill.mockRejectedValue(new PackageError('corrupt archive'));
      });

      it('returns EXTRACTION_ERROR (exit 3) in normal mode', async () => {
        await expect(run(['install', 'my-skill.skill'])).rejects.toThrow(ProcessExitError);
        expect(processExitSpy).toHaveBeenCalledWith(3);
        expect(consoleLogSpy).toHaveBeenCalledWith('ERROR: Package error');
        expect(consoleLogSpy).toHaveBeenCalledWith('  corrupt archive');
      });

      it('prints FAIL message in quiet mode', async () => {
        await expect(run(['install', 'my-skill.skill', '--quiet'])).rejects.toThrow(
          ProcessExitError
        );
        expect(processExitSpy).toHaveBeenCalledWith(3);
        expect(consoleLogSpy).toHaveBeenCalledWith('FAIL: corrupt archive');
      });
    });

    describe('AsmError', () => {
      beforeEach(() => {
        mockInstallSkill.mockRejectedValue(new AsmError('general asm error'));
      });

      it('returns EXTRACTION_ERROR (exit 3) in normal mode', async () => {
        await expect(run(['install', 'my-skill.skill'])).rejects.toThrow(ProcessExitError);
        expect(processExitSpy).toHaveBeenCalledWith(3);
        expect(consoleLogSpy).toHaveBeenCalledWith('ERROR: general asm error');
      });

      it('prints FAIL message in quiet mode', async () => {
        await expect(run(['install', 'my-skill.skill', '--quiet'])).rejects.toThrow(
          ProcessExitError
        );
        expect(processExitSpy).toHaveBeenCalledWith(3);
        expect(consoleLogSpy).toHaveBeenCalledWith('FAIL: general asm error');
      });
    });

    describe('generic Error', () => {
      beforeEach(() => {
        mockInstallSkill.mockRejectedValue(new Error('something went wrong'));
      });

      it('returns EXTRACTION_ERROR (exit 3) in normal mode', async () => {
        await expect(run(['install', 'my-skill.skill'])).rejects.toThrow(ProcessExitError);
        expect(processExitSpy).toHaveBeenCalledWith(3);
        expect(consoleLogSpy).toHaveBeenCalledWith('ERROR: Installation failed');
        expect(consoleLogSpy).toHaveBeenCalledWith('  something went wrong');
      });

      it('prints FAIL message in quiet mode', async () => {
        await expect(run(['install', 'my-skill.skill', '--quiet'])).rejects.toThrow(
          ProcessExitError
        );
        expect(processExitSpy).toHaveBeenCalledWith(3);
        expect(consoleLogSpy).toHaveBeenCalledWith('FAIL: something went wrong');
      });
    });

    describe('non-Error thrown value', () => {
      beforeEach(() => {
        mockInstallSkill.mockRejectedValue('string error');
      });

      it('returns EXTRACTION_ERROR (exit 3) in normal mode', async () => {
        await expect(run(['install', 'my-skill.skill'])).rejects.toThrow(ProcessExitError);
        expect(processExitSpy).toHaveBeenCalledWith(3);
        expect(consoleLogSpy).toHaveBeenCalledWith('ERROR: An unexpected error occurred');
        expect(consoleLogSpy).toHaveBeenCalledWith('  string error');
      });

      it('prints FAIL message in quiet mode', async () => {
        await expect(run(['install', 'my-skill.skill', '--quiet'])).rejects.toThrow(
          ProcessExitError
        );
        expect(processExitSpy).toHaveBeenCalledWith(3);
        expect(consoleLogSpy).toHaveBeenCalledWith('FAIL: string error');
      });
    });
  });

  // ── Command registration ─────────────────────────────────────────

  describe('registerInstallCommand', () => {
    it('registers the install command with expected options', async () => {
      const program = await createTestProgram();
      const installCmd = program.commands.find((cmd) => cmd.name() === 'install');

      expect(installCmd).toBeDefined();
      expect(installCmd!.description()).toContain('Install a Claude Code skill');

      const optionFlags = installCmd!.options.map((o) => o.long);
      expect(optionFlags).toContain('--scope');
      expect(optionFlags).toContain('--force');
      expect(optionFlags).toContain('--dry-run');
      expect(optionFlags).toContain('--quiet');
      expect(optionFlags).toContain('--thorough');
    });
  });
});
