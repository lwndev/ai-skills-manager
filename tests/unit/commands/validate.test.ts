/**
 * Unit tests for the validate CLI command
 *
 * Tests command registration, option parsing, success/failure paths,
 * quiet/JSON output modes, and error handling for various error types.
 */

import { Command } from 'commander';
import type { Mock } from 'vitest';
import type { DetailedValidateResult } from '../../../src/types/api';

// --- Mocks ---

vi.mock('../../../src/api/validate', () => ({
  validate: vi.fn(),
}));

vi.mock('../../../src/formatters/validate-formatter', () => ({
  formatValidationOutput: vi.fn(),
}));

vi.mock('../../../src/utils/output', () => ({
  displayError: vi.fn(),
  success: vi.fn((msg: string) => `✓ ${msg}`),
  error: vi.fn((msg: string) => `✗ Error: ${msg}`),
  warning: vi.fn((msg: string) => `⚠ ${msg}`),
}));

// Custom error to capture process.exit calls
class ProcessExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
    this.name = 'ProcessExitError';
  }
}

// --- Helpers ---

async function createTestProgram(): Promise<Command> {
  const { registerValidateCommand } = await import('../../../src/commands/validate');
  const program = new Command();
  program.exitOverride();
  registerValidateCommand(program);
  return program;
}

function makeValidResult(overrides: Partial<DetailedValidateResult> = {}): DetailedValidateResult {
  return {
    valid: true,
    skillPath: '/path/to/skill',
    checks: [],
    issues: [],
    warnings: [],
    ...overrides,
  } as DetailedValidateResult;
}

function makeInvalidResult(
  overrides: Partial<DetailedValidateResult> = {}
): DetailedValidateResult {
  return {
    valid: false,
    skillPath: '/path/to/skill',
    checks: [],
    issues: [{ code: 'missing_field', message: 'Missing required field: name' }],
    warnings: [],
    ...overrides,
  } as DetailedValidateResult;
}

// --- Tests ---

describe('validate CLI command', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;
  let consoleOutput: string[];
  let consoleErrors: string[];

  // Import mocked modules (resolved after vi.mock hoisting)
  let mockValidate: Mock;
  let mockFormatValidationOutput: Mock;
  let mockDisplayError: Mock;

  beforeEach(async () => {
    consoleOutput = [];
    consoleErrors = [];

    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalProcessExit = process.exit;

    console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
    console.error = (...args: unknown[]) => consoleErrors.push(args.join(' '));
    process.exit = ((code?: number) => {
      throw new ProcessExitError(code ?? 0);
    }) as typeof process.exit;

    // Get references to mocked functions
    const validateModule = await import('../../../src/api/validate');
    const formatterModule = await import('../../../src/formatters/validate-formatter');
    const outputModule = await import('../../../src/utils/output');

    mockValidate = validateModule.validate as Mock;
    mockFormatValidationOutput = formatterModule.formatValidationOutput as Mock;
    mockDisplayError = outputModule.displayError as Mock;

    mockValidate.mockReset();
    mockFormatValidationOutput.mockReset();
    mockDisplayError.mockReset();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  // --- Success path ---

  describe('valid skill (success path)', () => {
    it('prints formatted output and exits normally when skill is valid', async () => {
      const result = makeValidResult();
      mockValidate.mockResolvedValue(result);
      mockFormatValidationOutput.mockReturnValue('PASS: Skill is valid');

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'validate', '/path/to/skill']);

      expect(mockValidate).toHaveBeenCalledWith('/path/to/skill', { detailed: true });
      expect(mockFormatValidationOutput).toHaveBeenCalledWith(result, {});
      expect(consoleOutput).toContain('PASS: Skill is valid');
    });
  });

  // --- Invalid skill (exit 1) ---

  describe('invalid skill (exit code 1)', () => {
    it('prints formatted output and exits with code 1 when skill is invalid', async () => {
      const result = makeInvalidResult();
      mockValidate.mockResolvedValue(result);
      mockFormatValidationOutput.mockReturnValue('FAIL: Missing required field');

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/path/to/skill'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockFormatValidationOutput).toHaveBeenCalledWith(result, {});
      expect(consoleOutput).toContain('FAIL: Missing required field');
    });
  });

  // --- Quiet mode ---

  describe('quiet mode', () => {
    it('passes quiet option to formatter for valid skill', async () => {
      const result = makeValidResult();
      mockValidate.mockResolvedValue(result);
      mockFormatValidationOutput.mockReturnValue('PASS');

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'validate', '/path/to/skill', '--quiet']);

      expect(mockFormatValidationOutput).toHaveBeenCalledWith(result, { quiet: true });
      expect(consoleOutput).toContain('PASS');
    });

    it('passes quiet option to formatter for invalid skill', async () => {
      const result = makeInvalidResult();
      mockValidate.mockResolvedValue(result);
      mockFormatValidationOutput.mockReturnValue('FAIL');

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/path/to/skill', '-q'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockFormatValidationOutput).toHaveBeenCalledWith(result, { quiet: true });
    });
  });

  // --- JSON mode ---

  describe('JSON mode', () => {
    it('passes json option to formatter for valid skill', async () => {
      const result = makeValidResult();
      mockValidate.mockResolvedValue(result);
      mockFormatValidationOutput.mockReturnValue('{"valid":true}');

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'validate', '/path/to/skill', '--json']);

      expect(mockFormatValidationOutput).toHaveBeenCalledWith(result, { json: true });
      expect(consoleOutput).toContain('{"valid":true}');
    });

    it('passes json option to formatter for invalid skill', async () => {
      const result = makeInvalidResult();
      mockValidate.mockResolvedValue(result);
      mockFormatValidationOutput.mockReturnValue('{"valid":false}');

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/path/to/skill', '-j'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockFormatValidationOutput).toHaveBeenCalledWith(result, { json: true });
    });
  });

  // --- Error handling: default mode ---

  describe('error handling (default mode)', () => {
    it('handles FileSystemError', async () => {
      const { FileSystemError } = await import('../../../src/errors');
      mockValidate.mockRejectedValue(new FileSystemError('File not found', '/missing/path'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/missing/path'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('File system error', 'File not found');
    });

    it('handles AsmError', async () => {
      const { AsmError } = await import('../../../src/errors');
      mockValidate.mockRejectedValue(new AsmError('Something went wrong'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/path/to/skill'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('Something went wrong');
    });

    it('handles generic Error', async () => {
      mockValidate.mockRejectedValue(new Error('Unexpected failure'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/path/to/skill'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('Validation failed', 'Unexpected failure');
    });

    it('handles non-Error thrown value', async () => {
      mockValidate.mockRejectedValue('string error');

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/path/to/skill'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('An unexpected error occurred', 'string error');
    });
  });

  // --- Error handling: JSON mode ---

  describe('error handling (JSON mode)', () => {
    it('outputs JSON error for FileSystemError', async () => {
      const { FileSystemError } = await import('../../../src/errors');
      mockValidate.mockRejectedValue(new FileSystemError('Not found', '/bad'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/bad', '--json'])
      ).rejects.toThrow(ProcessExitError);

      const jsonOutput = consoleOutput.find((line) => line.includes('"valid"'));
      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput!);
      expect(parsed).toEqual({ valid: false, error: 'Not found' });
    });

    it('outputs JSON error for generic Error', async () => {
      mockValidate.mockRejectedValue(new Error('Boom'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/path/to/skill', '-j'])
      ).rejects.toThrow(ProcessExitError);

      const jsonOutput = consoleOutput.find((line) => line.includes('"valid"'));
      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput!);
      expect(parsed).toEqual({ valid: false, error: 'Boom' });
    });

    it('outputs JSON error for non-Error thrown value', async () => {
      mockValidate.mockRejectedValue(42);

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/path/to/skill', '--json'])
      ).rejects.toThrow(ProcessExitError);

      const jsonOutput = consoleOutput.find((line) => line.includes('"valid"'));
      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput!);
      expect(parsed).toEqual({ valid: false, error: '42' });
    });
  });

  // --- Error handling: quiet mode ---

  describe('error handling (quiet mode)', () => {
    it('outputs FAIL message for errors in quiet mode', async () => {
      mockValidate.mockRejectedValue(new Error('Failure'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/path/to/skill', '--quiet'])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContain('FAIL: Error occurred');
      // Should NOT call displayError in quiet mode
      expect(mockDisplayError).not.toHaveBeenCalled();
    });

    it('outputs FAIL message for non-Error in quiet mode', async () => {
      mockValidate.mockRejectedValue('bad');

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'validate', '/path/to/skill', '-q'])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContain('FAIL: Error occurred');
    });
  });

  // --- Help text ---

  describe('help text', () => {
    it('displays help text with command description', async () => {
      const program = await createTestProgram();
      const validateCmd = program.commands.find((cmd) => cmd.name() === 'validate');
      if (!validateCmd) throw new Error('validate command not found');

      let helpText = '';
      validateCmd.configureOutput({ writeOut: (str: string) => (helpText += str) });
      try {
        await program.parseAsync(['node', 'asm', 'validate', '--help']);
      } catch {
        // commander throws on --help with exitOverride
      }

      expect(helpText).toContain('Validate a Claude Code skill');
      expect(helpText).toContain('--quiet');
      expect(helpText).toContain('--json');
    });
  });
});
