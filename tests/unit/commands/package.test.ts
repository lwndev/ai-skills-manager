/**
 * Unit tests for the package CLI command
 *
 * Tests handlePackage (success, overwrite, quiet mode) and handleError
 * (all error types in quiet and normal modes).
 */

import { Command } from 'commander';
import { createPackage } from '../../../src/api';
import {
  formatPackageProgress,
  formatPackageSuccess,
} from '../../../src/formatters/package-formatter';
import { confirmOverwrite } from '../../../src/utils/prompts';
import * as outputUtils from '../../../src/utils/output';
import {
  FileSystemError,
  ValidationError,
  PackageError,
  AsmError,
  CancellationError,
} from '../../../src/errors';

vi.mock('../../../src/api', () => ({ createPackage: vi.fn() }));
vi.mock('../../../src/formatters/package-formatter', () => ({
  formatPackageProgress: vi.fn().mockReturnValue('progress...'),
  formatPackageSuccess: vi.fn().mockReturnValue('success!'),
}));
vi.mock('../../../src/utils/prompts', () => ({ confirmOverwrite: vi.fn() }));
vi.mock('../../../src/utils/output', () => ({
  error: vi.fn((msg: string) => `ERROR: ${msg}`),
  displayError: vi.fn(),
}));

// Custom error to capture process.exit calls
class ProcessExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
    this.name = 'ProcessExitError';
  }
}

const mockedCreatePackage = vi.mocked(createPackage);
const mockedFormatPackageProgress = vi.mocked(formatPackageProgress);
const mockedFormatPackageSuccess = vi.mocked(formatPackageSuccess);
const mockedConfirmOverwrite = vi.mocked(confirmOverwrite);
const mockedOutputError = vi.mocked(outputUtils.error);
const mockedDisplayError = vi.mocked(outputUtils.displayError);

async function createTestProgram(): Promise<Command> {
  const { registerPackageCommand } = await import('../../../src/commands/package');
  const program = new Command();
  program.exitOverride();
  registerPackageCommand(program);
  return program;
}

/**
 * Helper: parse the package command and return what happened.
 * If process.exit is called, it throws ProcessExitError which we catch
 * and return the exit code.
 */
async function runPackage(args: string[]): Promise<number> {
  const program = await createTestProgram();
  try {
    await program.parseAsync(['node', 'asm', 'package', ...args]);
    return 0; // SUCCESS — no process.exit called
  } catch (err) {
    if (err instanceof ProcessExitError) {
      return err.code;
    }
    throw err;
  }
}

describe('package CLI command', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;
  let consoleOutput: string[];

  beforeEach(() => {
    consoleOutput = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalProcessExit = process.exit;
    console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
    console.error = (...args: unknown[]) => consoleOutput.push(args.join(' '));
    process.exit = ((code?: number) => {
      throw new ProcessExitError(code ?? 0);
    }) as typeof process.exit;

    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // FEAT-018 help text (preserved from original test)
  // ──────────────────────────────────────────────────────────────────────────
  describe('FEAT-018 help text', () => {
    it('help text includes the plugin distribution note', async () => {
      const { PACKAGE_DISTRIBUTION_NOTE } = await import('../../../src/commands/package');
      const program = await createTestProgram();
      const packageCmd = program.commands.find((cmd) => cmd.name() === 'package');
      if (!packageCmd) throw new Error('package command not found');
      let helpText = '';
      packageCmd.configureOutput({ writeOut: (str: string) => (helpText += str) });
      try {
        await program.parseAsync(['node', 'asm', 'package', '--help']);
      } catch {
        // commander throws on --help with exitOverride
      }

      expect(helpText).toContain(PACKAGE_DISTRIBUTION_NOTE);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handlePackage — success paths
  // ──────────────────────────────────────────────────────────────────────────
  describe('handlePackage success', () => {
    const packageResult = { packagePath: '/out/skill.skill', size: 1024, fileCount: 5 };

    beforeEach(() => {
      mockedCreatePackage.mockResolvedValue(packageResult);
    });

    it('shows progress and formatted success in normal mode', async () => {
      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(0);
      expect(mockedFormatPackageProgress).toHaveBeenCalledWith('validating');
      expect(consoleOutput).toContain('progress...');
      expect(mockedFormatPackageSuccess).toHaveBeenCalledWith({
        success: true,
        packagePath: '/out/skill.skill',
        fileCount: 5,
        size: 1024,
        errors: [],
      });
      expect(consoleOutput).toContain('success!');
    });

    it('suppresses progress and prints only packagePath in quiet mode', async () => {
      const exitCode = await runPackage(['./my-skill', '--quiet']);

      expect(exitCode).toBe(0);
      expect(mockedFormatPackageProgress).not.toHaveBeenCalled();
      expect(mockedFormatPackageSuccess).not.toHaveBeenCalled();
      expect(consoleOutput).toContain('/out/skill.skill');
    });

    it('passes options through to createPackage', async () => {
      await runPackage(['./my-skill', '--output', '/tmp/out', '--force', '--skip-validation']);

      expect(mockedCreatePackage).toHaveBeenCalledWith({
        path: './my-skill',
        output: '/tmp/out',
        force: true,
        skipValidation: true,
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handlePackage — overwrite scenario
  // ──────────────────────────────────────────────────────────────────────────
  describe('handlePackage overwrite scenario', () => {
    const alreadyExistsError = new FileSystemError(
      'Package already exists at /out/skill.skill',
      '/out/skill.skill'
    );
    const packageResult = { packagePath: '/out/skill.skill', size: 2048, fileCount: 7 };

    it('in quiet mode, fails immediately without prompting', async () => {
      mockedCreatePackage.mockRejectedValue(alreadyExistsError);

      const exitCode = await runPackage(['./my-skill', '--quiet']);

      expect(exitCode).toBe(2); // FILE_SYSTEM_ERROR
      expect(mockedConfirmOverwrite).not.toHaveBeenCalled();
      expect(consoleOutput.some((line) => line.includes('already exists'))).toBe(true);
    });

    it('prompts user and retries with force on confirmation', async () => {
      mockedCreatePackage
        .mockRejectedValueOnce(alreadyExistsError)
        .mockResolvedValueOnce(packageResult);
      mockedConfirmOverwrite.mockResolvedValue(true);

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(0);
      expect(mockedConfirmOverwrite).toHaveBeenCalledWith('/out/skill.skill');
      // Should show creating progress for the retry
      expect(mockedFormatPackageProgress).toHaveBeenCalledWith('creating');
      // Retry call should have force: true
      expect(mockedCreatePackage).toHaveBeenCalledTimes(2);
      expect(mockedCreatePackage).toHaveBeenLastCalledWith({
        path: './my-skill',
        output: undefined,
        skipValidation: undefined,
        force: true,
      });
    });

    it('returns FILE_SYSTEM_ERROR when user declines overwrite', async () => {
      mockedCreatePackage.mockRejectedValue(alreadyExistsError);
      mockedConfirmOverwrite.mockResolvedValue(false);

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(2); // FILE_SYSTEM_ERROR
      expect(mockedDisplayError).toHaveBeenCalledWith('Package creation cancelled by user');
    });

    it('does not prompt if --force is set even when file exists error', async () => {
      // With --force, the "already exists" + !force check is false, so
      // the error is re-thrown and handled by handleError as a FileSystemError.
      mockedCreatePackage.mockRejectedValue(alreadyExistsError);

      const exitCode = await runPackage(['./my-skill', '--force']);

      expect(exitCode).toBe(2); // FILE_SYSTEM_ERROR
      expect(mockedConfirmOverwrite).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleError — CancellationError
  // ──────────────────────────────────────────────────────────────────────────
  describe('handleError: CancellationError', () => {
    it('normal mode: shows error message and returns FILE_SYSTEM_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue(new CancellationError('User cancelled'));

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(2);
      expect(mockedOutputError).toHaveBeenCalledWith('User cancelled');
    });

    it('quiet mode: prints CANCELLED and returns FILE_SYSTEM_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue(new CancellationError('User cancelled'));

      const exitCode = await runPackage(['./my-skill', '--quiet']);

      expect(exitCode).toBe(2);
      expect(consoleOutput).toContain('CANCELLED');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleError — ValidationError
  // ──────────────────────────────────────────────────────────────────────────
  describe('handleError: ValidationError', () => {
    it('normal mode: shows validation errors and returns VALIDATION_FAILED', async () => {
      const issues = [{ message: 'Missing name field' }, { message: 'Invalid description' }];
      mockedCreatePackage.mockRejectedValue(new ValidationError('Validation failed', issues));

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(1); // VALIDATION_FAILED
      expect(mockedOutputError).toHaveBeenCalledWith('Skill validation failed');
      expect(consoleOutput.some((line) => line.includes('Missing name field'))).toBe(true);
      expect(consoleOutput.some((line) => line.includes('Invalid description'))).toBe(true);
    });

    it('quiet mode: prints FAIL message and returns VALIDATION_FAILED', async () => {
      const issues = [{ message: 'Missing name field' }];
      mockedCreatePackage.mockRejectedValue(new ValidationError('Validation failed', issues));

      const exitCode = await runPackage(['./my-skill', '--quiet']);

      expect(exitCode).toBe(1);
      expect(consoleOutput.some((line) => line.includes('FAIL: Validation failed'))).toBe(true);
    });

    it('returns FILE_SYSTEM_ERROR for path-not-found issues', async () => {
      const issues = [{ message: 'Skill path does not exist', code: 'PATH_NOT_FOUND' }];
      mockedCreatePackage.mockRejectedValue(new ValidationError('Path error', issues));

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(2); // FILE_SYSTEM_ERROR
    });

    it('returns FILE_SYSTEM_ERROR for file-not-found issues', async () => {
      const issues = [{ message: 'SKILL.md not found', code: 'FILE_NOT_FOUND' }];
      mockedCreatePackage.mockRejectedValue(new ValidationError('Not found', issues));

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(2);
    });

    it('returns FILE_SYSTEM_ERROR when issue message contains "does not exist"', async () => {
      const issues = [{ message: 'Directory does not exist' }];
      mockedCreatePackage.mockRejectedValue(new ValidationError('Bad path', issues));

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(2);
    });

    it('returns FILE_SYSTEM_ERROR when issue message contains "not found"', async () => {
      const issues = [{ message: 'File not found at /some/path' }];
      mockedCreatePackage.mockRejectedValue(new ValidationError('Bad path', issues));

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(2);
    });

    it('handles empty issues array', async () => {
      mockedCreatePackage.mockRejectedValue(new ValidationError('Validation failed', []));

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(1); // VALIDATION_FAILED (no path errors)
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleError — FileSystemError
  // ──────────────────────────────────────────────────────────────────────────
  describe('handleError: FileSystemError', () => {
    it('normal mode: shows error details and returns FILE_SYSTEM_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue(
        new FileSystemError('Permission denied', '/out/skill.skill')
      );

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(2);
      expect(mockedOutputError).toHaveBeenCalledWith('File system error');
      expect(consoleOutput.some((line) => line.includes('Permission denied'))).toBe(true);
    });

    it('quiet mode: prints FAIL and returns FILE_SYSTEM_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue(
        new FileSystemError('Permission denied', '/out/skill.skill')
      );

      const exitCode = await runPackage(['./my-skill', '--quiet']);

      expect(exitCode).toBe(2);
      expect(consoleOutput.some((line) => line.includes('FAIL: Permission denied'))).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleError — PackageError
  // ──────────────────────────────────────────────────────────────────────────
  describe('handleError: PackageError', () => {
    it('normal mode: shows error details and returns PACKAGE_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue(new PackageError('ZIP creation failed'));

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(3);
      expect(mockedOutputError).toHaveBeenCalledWith('Package error');
      expect(consoleOutput.some((line) => line.includes('ZIP creation failed'))).toBe(true);
    });

    it('quiet mode: prints FAIL and returns PACKAGE_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue(new PackageError('ZIP creation failed'));

      const exitCode = await runPackage(['./my-skill', '--quiet']);

      expect(exitCode).toBe(3);
      expect(consoleOutput.some((line) => line.includes('FAIL: ZIP creation failed'))).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleError — AsmError
  // ──────────────────────────────────────────────────────────────────────────
  describe('handleError: AsmError', () => {
    it('normal mode: shows error message and returns PACKAGE_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue(new AsmError('Something went wrong', 'ASM_ERROR'));

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(3);
      expect(mockedOutputError).toHaveBeenCalledWith('Something went wrong');
    });

    it('quiet mode: prints FAIL and returns PACKAGE_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue(new AsmError('Something went wrong', 'ASM_ERROR'));

      const exitCode = await runPackage(['./my-skill', '--quiet']);

      expect(exitCode).toBe(3);
      expect(consoleOutput.some((line) => line.includes('FAIL: Something went wrong'))).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleError — generic Error
  // ──────────────────────────────────────────────────────────────────────────
  describe('handleError: generic Error', () => {
    it('normal mode: shows "Package failed" and returns PACKAGE_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue(new Error('Something unexpected'));

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(3);
      expect(mockedOutputError).toHaveBeenCalledWith('Package failed');
      expect(consoleOutput.some((line) => line.includes('Something unexpected'))).toBe(true);
    });

    it('quiet mode: prints FAIL and returns PACKAGE_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue(new Error('Something unexpected'));

      const exitCode = await runPackage(['./my-skill', '--quiet']);

      expect(exitCode).toBe(3);
      expect(consoleOutput.some((line) => line.includes('FAIL: Something unexpected'))).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleError — non-Error value
  // ──────────────────────────────────────────────────────────────────────────
  describe('handleError: non-Error value', () => {
    it('normal mode: shows "unexpected error" and returns PACKAGE_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue('string error');

      const exitCode = await runPackage(['./my-skill']);

      expect(exitCode).toBe(3);
      expect(mockedOutputError).toHaveBeenCalledWith('An unexpected error occurred');
      expect(consoleOutput.some((line) => line.includes('string error'))).toBe(true);
    });

    it('quiet mode: prints FAIL with stringified value and returns PACKAGE_ERROR', async () => {
      mockedCreatePackage.mockRejectedValue(42);

      const exitCode = await runPackage(['./my-skill', '--quiet']);

      expect(exitCode).toBe(3);
      expect(consoleOutput.some((line) => line.includes('FAIL: 42'))).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // EXIT_CODES export
  // ──────────────────────────────────────────────────────────────────────────
  describe('EXIT_CODES', () => {
    it('exports correct exit code values', async () => {
      const { EXIT_CODES } = await import('../../../src/commands/package');
      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.VALIDATION_FAILED).toBe(1);
      expect(EXIT_CODES.FILE_SYSTEM_ERROR).toBe(2);
      expect(EXIT_CODES.PACKAGE_ERROR).toBe(3);
    });
  });
});
