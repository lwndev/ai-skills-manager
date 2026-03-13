/**
 * Unit tests for the update CLI command
 *
 * Tests command registration, option parsing, success/failure paths,
 * quiet mode, dry-run mode, and error handling for various error types.
 */

import { Command } from 'commander';

// --- Mocks ---

vi.mock('../../../src/api', () => ({
  update: vi.fn(),
}));

vi.mock('../../../src/generators/updater', () => {
  class UpdateError extends Error {
    public readonly updateError: unknown;
    constructor(updateError: { type: string; [key: string]: unknown }) {
      super(`Update error: ${updateError.type}`);
      this.name = 'UpdateError';
      this.updateError = updateError;
    }
  }
  return {
    updateSkill: vi.fn(),
    UpdateError,
  };
});

vi.mock('../../../src/validators/package-file', () => ({
  validatePackageFile: vi.fn(),
}));

vi.mock('../../../src/validators/uninstall-name', () => ({
  validateSkillName: vi.fn().mockReturnValue({ valid: true }),
}));

vi.mock('../../../src/validators/uninstall-scope', () => ({
  validateUninstallScope: vi.fn().mockReturnValue({ valid: true, scope: 'project' }),
}));

vi.mock('../../../src/formatters/update-formatter', () => ({
  formatUpdateProgress: vi.fn().mockReturnValue('progress...'),
  formatUpdateSuccess: vi.fn().mockReturnValue('success!'),
  formatDryRun: vi.fn().mockReturnValue('dry-run preview'),
  formatQuietOutput: vi.fn().mockReturnValue('/updated/path'),
  formatError: vi.fn().mockReturnValue('error!'),
  formatCancelledUpdate: vi.fn().mockReturnValue('cancelled'),
  formatRollbackSuccess: vi.fn().mockReturnValue('rolled back'),
  formatRollbackFailed: vi.fn().mockReturnValue('rollback failed!'),
}));

vi.mock('../../../src/utils/output', () => ({
  success: vi.fn((msg: string) => `SUCCESS: ${msg}`),
  warning: vi.fn((msg: string) => `WARNING: ${msg}`),
  error: vi.fn((msg: string) => `ERROR: ${msg}`),
  displayError: vi.fn(),
}));

vi.mock('../../../src/utils/debug', () => ({
  createDebugLogger: vi.fn().mockReturnValue(vi.fn()),
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
  const { registerUpdateCommand } = await import('../../../src/commands/update');
  const program = new Command();
  program.exitOverride();
  registerUpdateCommand(program);
  return program;
}

// --- Tests ---

describe('update CLI command', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;
  let consoleOutput: string[];
  let consoleErrors: string[];

  // Import mocked modules (resolved after vi.mock hoisting)
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockUpdateSkill: ReturnType<typeof vi.fn>;
  let mockValidatePackageFile: ReturnType<typeof vi.fn>;
  let mockValidateSkillName: ReturnType<typeof vi.fn>;
  let mockValidateUninstallScope: ReturnType<typeof vi.fn>;
  let mockDisplayError: ReturnType<typeof vi.fn>;
  let mockFormatUpdateProgress: ReturnType<typeof vi.fn>;
  let mockFormatUpdateSuccess: ReturnType<typeof vi.fn>;
  let mockFormatDryRun: ReturnType<typeof vi.fn>;
  let mockFormatQuietOutput: ReturnType<typeof vi.fn>;
  let mockFormatError: ReturnType<typeof vi.fn>;
  let mockFormatCancelledUpdate: ReturnType<typeof vi.fn>;
  let mockFormatRollbackSuccess: ReturnType<typeof vi.fn>;
  let mockFormatRollbackFailed: ReturnType<typeof vi.fn>;

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
    const apiModule = await import('../../../src/api');
    const updaterModule = await import('../../../src/generators/updater');
    const packageFileModule = await import('../../../src/validators/package-file');
    const nameModule = await import('../../../src/validators/uninstall-name');
    const scopeModule = await import('../../../src/validators/uninstall-scope');
    const outputModule = await import('../../../src/utils/output');
    const formatterModule = await import('../../../src/formatters/update-formatter');

    mockUpdate = apiModule.update as ReturnType<typeof vi.fn>;
    mockUpdateSkill = updaterModule.updateSkill as ReturnType<typeof vi.fn>;
    mockValidatePackageFile = packageFileModule.validatePackageFile as ReturnType<typeof vi.fn>;
    mockValidateSkillName = nameModule.validateSkillName as ReturnType<typeof vi.fn>;
    mockValidateUninstallScope = scopeModule.validateUninstallScope as ReturnType<typeof vi.fn>;
    mockDisplayError = outputModule.displayError as ReturnType<typeof vi.fn>;
    mockFormatUpdateProgress = formatterModule.formatUpdateProgress as ReturnType<typeof vi.fn>;
    mockFormatUpdateSuccess = formatterModule.formatUpdateSuccess as ReturnType<typeof vi.fn>;
    mockFormatDryRun = formatterModule.formatDryRun as ReturnType<typeof vi.fn>;
    mockFormatQuietOutput = formatterModule.formatQuietOutput as ReturnType<typeof vi.fn>;
    mockFormatError = formatterModule.formatError as ReturnType<typeof vi.fn>;
    mockFormatCancelledUpdate = formatterModule.formatCancelledUpdate as ReturnType<typeof vi.fn>;
    mockFormatRollbackSuccess = formatterModule.formatRollbackSuccess as ReturnType<typeof vi.fn>;
    mockFormatRollbackFailed = formatterModule.formatRollbackFailed as ReturnType<typeof vi.fn>;

    // Reset all mocks
    mockUpdate.mockReset();
    mockUpdateSkill.mockReset();
    mockValidatePackageFile.mockReset();
    mockValidateSkillName.mockReset();
    mockValidateUninstallScope.mockReset();
    mockDisplayError.mockReset();
    mockFormatUpdateProgress.mockReset().mockReturnValue('progress...');
    mockFormatUpdateSuccess.mockReset().mockReturnValue('success!');
    mockFormatDryRun.mockReset().mockReturnValue('dry-run preview');
    mockFormatQuietOutput.mockReset().mockReturnValue('/updated/path');
    mockFormatError.mockReset().mockReturnValue('error!');
    mockFormatCancelledUpdate.mockReset().mockReturnValue('cancelled');
    mockFormatRollbackSuccess.mockReset().mockReturnValue('rolled back');
    mockFormatRollbackFailed.mockReset().mockReturnValue('rollback failed!');

    // Set default happy-path mocks
    mockValidateSkillName.mockReturnValue({ valid: true });
    mockValidateUninstallScope.mockReturnValue({ valid: true, scope: 'project' });
    mockValidatePackageFile.mockResolvedValue({
      valid: true,
      packagePath: '/resolved/package.skill',
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  // --- Command registration ---

  describe('command registration', () => {
    it('registers the update command with correct arguments', async () => {
      const program = await createTestProgram();
      const updateCmd = program.commands.find((cmd) => cmd.name() === 'update');
      expect(updateCmd).toBeDefined();
    });

    it('displays help text with command description and options', async () => {
      const program = await createTestProgram();
      const updateCmd = program.commands.find((cmd) => cmd.name() === 'update');
      if (!updateCmd) throw new Error('update command not found');

      let helpText = '';
      updateCmd.configureOutput({ writeOut: (str: string) => (helpText += str) });
      try {
        await program.parseAsync(['node', 'asm', 'update', '--help']);
      } catch {
        // commander throws on --help with exitOverride
      }

      expect(helpText).toContain('Update an installed Claude Code skill');
      expect(helpText).toContain('--scope');
      expect(helpText).toContain('--force');
      expect(helpText).toContain('--dry-run');
      expect(helpText).toContain('--quiet');
      expect(helpText).toContain('--no-backup');
      expect(helpText).toContain('--keep-backup');
    });
  });

  // --- Validation failures ---

  describe('validation failures', () => {
    it('returns SECURITY_ERROR when skill name is invalid (non-quiet)', async () => {
      mockValidateSkillName.mockReturnValue({ valid: false, error: 'contains path traversal' });

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'update', '../bad-name', '/path/to/package.skill'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('Invalid skill name: contains path traversal');
    });

    it('returns SECURITY_ERROR when skill name is invalid (quiet)', async () => {
      mockValidateSkillName.mockReturnValue({ valid: false, error: 'contains path traversal' });

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          '../bad-name',
          '/path/to/package.skill',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(
        expect.stringContaining('FAIL: ../bad-name: contains path traversal')
      );
      expect(mockDisplayError).not.toHaveBeenCalled();
    });

    it('returns SECURITY_ERROR when scope is invalid (non-quiet)', async () => {
      mockValidateUninstallScope.mockReturnValue({ valid: false, error: 'invalid scope value' });

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--scope',
          'bad-scope',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('Invalid scope: invalid scope value');
    });

    it('returns SECURITY_ERROR when scope is invalid (quiet)', async () => {
      mockValidateUninstallScope.mockReturnValue({ valid: false, error: 'invalid scope value' });

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--scope',
          'bad-scope',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(
        expect.stringContaining('FAIL: Invalid scope: bad-scope')
      );
    });

    it('returns INVALID_PACKAGE when package file is invalid (non-quiet)', async () => {
      mockValidatePackageFile.mockResolvedValue({
        valid: false,
        error: 'file is not a valid .skill package',
      });

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'update', 'my-skill', '/bad/package.skill'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith(
        'Invalid package: file is not a valid .skill package'
      );
    });

    it('returns INVALID_PACKAGE when package file is invalid (quiet)', async () => {
      mockValidatePackageFile.mockResolvedValue({
        valid: false,
        error: 'file is not a valid .skill package',
      });

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'update', 'my-skill', '/bad/package.skill', '--quiet'])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(
        expect.stringContaining('FAIL: /bad/package.skill: file is not a valid .skill package')
      );
    });
  });

  // --- Success path (API update) ---

  describe('success path (API update)', () => {
    beforeEach(() => {
      mockUpdate.mockResolvedValue({
        updatedPath: '/updated/skill/path',
        previousVersion: '1.0.0',
        newVersion: '2.0.0',
        backupPath: '/backup/path',
      });
    });

    it('calls update API with correct arguments and exits successfully', async () => {
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);

      expect(mockUpdate).toHaveBeenCalledWith({
        name: 'my-skill',
        file: '/resolved/package.skill',
        scope: 'project',
        targetPath: undefined,
        force: false,
        keepBackup: false,
      });
    });

    it('prints success details in non-quiet mode', async () => {
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);

      expect(consoleOutput).toContainEqual(expect.stringContaining('Skill updated successfully'));
      expect(consoleOutput).toContainEqual(expect.stringContaining('Name: my-skill'));
      expect(consoleOutput).toContainEqual(expect.stringContaining('Path: /updated/skill/path'));
      expect(consoleOutput).toContainEqual(expect.stringContaining('Previous version: 1.0.0'));
      expect(consoleOutput).toContainEqual(expect.stringContaining('New version: 2.0.0'));
      expect(consoleOutput).toContainEqual(expect.stringContaining('Backup: /backup/path'));
    });

    it('prints only the path in quiet mode', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'update',
        'my-skill',
        '/path/to/package.skill',
        '--quiet',
      ]);

      expect(consoleOutput).toContain('/updated/skill/path');
      // Should not contain verbose details
      expect(consoleOutput).not.toContainEqual(
        expect.stringContaining('Skill updated successfully')
      );
    });

    it('omits version info when not available', async () => {
      mockUpdate.mockResolvedValue({
        updatedPath: '/updated/skill/path',
      });

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);

      expect(consoleOutput).not.toContainEqual(expect.stringContaining('Previous version'));
      expect(consoleOutput).not.toContainEqual(expect.stringContaining('New version'));
      expect(consoleOutput).not.toContainEqual(expect.stringContaining('Backup:'));
    });

    it('passes --force option to the API', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'update',
        'my-skill',
        '/path/to/package.skill',
        '--force',
      ]);

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ force: true }));
    });

    it('passes --keep-backup option to the API', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'update',
        'my-skill',
        '/path/to/package.skill',
        '--keep-backup',
      ]);

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ keepBackup: true }));
    });

    it('shows progress messages in non-quiet mode', async () => {
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);

      expect(mockFormatUpdateProgress).toHaveBeenCalledWith('validating-package');
      expect(mockFormatUpdateProgress).toHaveBeenCalledWith('locating');
    });

    it('does not show progress messages in quiet mode', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'update',
        'my-skill',
        '/path/to/package.skill',
        '--quiet',
      ]);

      expect(consoleOutput).not.toContain('progress...');
    });
  });

  // --- Dry-run path (generator) ---

  describe('dry-run path', () => {
    it('uses updateSkill generator instead of API', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-dry-run-preview',
        skillName: 'my-skill',
        path: '/skills/my-skill',
        currentVersion: { path: '/skills/my-skill', fileCount: 3, size: 1024 },
        newVersion: { path: '/pkg/my-skill', fileCount: 4, size: 2048 },
        comparison: {
          filesAdded: [],
          filesRemoved: [],
          filesModified: [],
          addedCount: 1,
          removedCount: 0,
          modifiedCount: 1,
          sizeChange: 1024,
        },
        backupPath: '/backup/my-skill.skill',
      });

      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'update',
        'my-skill',
        '/path/to/package.skill',
        '--dry-run',
      ]);

      expect(mockUpdateSkill).toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockFormatDryRun).toHaveBeenCalled();
      expect(consoleOutput).toContain('dry-run preview');
    });

    it('passes correct options to updateSkill', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-dry-run-preview',
        skillName: 'my-skill',
        path: '/skills/my-skill',
        currentVersion: { path: '/skills/my-skill', fileCount: 3, size: 1024 },
        newVersion: { path: '/pkg/my-skill', fileCount: 4, size: 2048 },
        comparison: {
          filesAdded: [],
          filesRemoved: [],
          filesModified: [],
          addedCount: 0,
          removedCount: 0,
          modifiedCount: 0,
          sizeChange: 0,
        },
        backupPath: '/backup/my-skill.skill',
      });

      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'update',
        'my-skill',
        '/path/to/package.skill',
        '--dry-run',
        '--force',
        '--quiet',
      ]);

      expect(mockUpdateSkill).toHaveBeenCalledWith('my-skill', '/resolved/package.skill', {
        scope: 'project',
        force: true,
        dryRun: true,
        quiet: true,
        noBackup: false,
        keepBackup: false,
      });
    });
  });

  // --- handleResult paths ---

  describe('handleResult (dry-run result types)', () => {
    it('returns SUCCESS for update-success (non-quiet)', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-success',
        skillName: 'my-skill',
        path: '/skills/my-skill',
        previousFileCount: 3,
        currentFileCount: 4,
        previousSize: 1024,
        currentSize: 2048,
        backupWillBeRemoved: true,
      });

      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'update',
        'my-skill',
        '/path/to/package.skill',
        '--dry-run',
      ]);

      expect(mockFormatUpdateSuccess).toHaveBeenCalled();
      expect(consoleOutput).toContain('success!');
    });

    it('returns SUCCESS for update-success (quiet)', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-success',
        skillName: 'my-skill',
        path: '/skills/my-skill',
        previousFileCount: 3,
        currentFileCount: 4,
        previousSize: 1024,
        currentSize: 2048,
        backupWillBeRemoved: true,
      });

      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'update',
        'my-skill',
        '/path/to/package.skill',
        '--dry-run',
        '--quiet',
      ]);

      expect(mockFormatQuietOutput).toHaveBeenCalled();
      expect(consoleOutput).toContain('/updated/path');
    });

    it('returns ROLLED_BACK for update-rolled-back (non-quiet)', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-rolled-back',
        skillName: 'my-skill',
        path: '/skills/my-skill',
        failureReason: 'validation failed after update',
        backupPath: '/backup/my-skill.skill',
      });

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--dry-run',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(mockFormatRollbackSuccess).toHaveBeenCalled();
      expect(consoleOutput).toContain('rolled back');
    });

    it('returns ROLLED_BACK for update-rolled-back (quiet)', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-rolled-back',
        skillName: 'my-skill',
        path: '/skills/my-skill',
        failureReason: 'validation failed after update',
      });

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--dry-run',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(
        expect.stringContaining('ROLLBACK: my-skill: validation failed after update')
      );
    });

    it('returns ROLLBACK_FAILED for update-rollback-failed', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-rollback-failed',
        skillName: 'my-skill',
        path: '/skills/my-skill',
        updateFailureReason: 'validation failed',
        rollbackFailureReason: 'permission denied',
        recoveryInstructions: 'Restore from backup manually.',
      });

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--dry-run',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(mockFormatRollbackFailed).toHaveBeenCalled();
      expect(consoleOutput).toContain('rollback failed!');
    });

    it('returns CANCELLED for update-cancelled (non-quiet)', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-cancelled',
        skillName: 'my-skill',
        reason: 'user-cancelled',
        cleanupPerformed: false,
      });

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--dry-run',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(mockFormatCancelledUpdate).toHaveBeenCalled();
      expect(consoleOutput).toContain('cancelled');
    });

    it('returns CANCELLED for update-cancelled (quiet, no output)', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-cancelled',
        skillName: 'my-skill',
        reason: 'user-cancelled',
        cleanupPerformed: false,
      });

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--dry-run',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      // In quiet mode, cancelled produces no output
      expect(mockFormatCancelledUpdate).not.toHaveBeenCalled();
    });

    it('outputs dry-run preview even in quiet mode', async () => {
      mockUpdateSkill.mockResolvedValue({
        type: 'update-dry-run-preview',
        skillName: 'my-skill',
        path: '/skills/my-skill',
        currentVersion: { path: '/skills/my-skill', fileCount: 3, size: 1024 },
        newVersion: { path: '/pkg/my-skill', fileCount: 4, size: 2048 },
        comparison: {
          filesAdded: [],
          filesRemoved: [],
          filesModified: [],
          addedCount: 0,
          removedCount: 0,
          modifiedCount: 0,
          sizeChange: 0,
        },
        backupPath: '/backup/my-skill.skill',
      });

      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'update',
        'my-skill',
        '/path/to/package.skill',
        '--dry-run',
        '--quiet',
      ]);

      // Dry-run always outputs, even in quiet mode
      expect(mockFormatDryRun).toHaveBeenCalled();
      expect(consoleOutput).toContain('dry-run preview');
    });
  });

  // --- Error handling: CancellationError ---

  describe('error handling: CancellationError', () => {
    it('returns CANCELLED in non-quiet mode', async () => {
      const { CancellationError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(new CancellationError('User pressed Ctrl+C'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('Update cancelled', 'User pressed Ctrl+C');
    });

    it('returns CANCELLED in quiet mode', async () => {
      const { CancellationError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(new CancellationError('User pressed Ctrl+C'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(expect.stringContaining('CANCELLED: my-skill'));
      expect(mockDisplayError).not.toHaveBeenCalled();
    });
  });

  // --- Error handling: SecurityError ---

  describe('error handling: SecurityError', () => {
    it('returns SECURITY_ERROR in non-quiet mode', async () => {
      const { SecurityError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(new SecurityError('Symlink escape detected'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('Security error', 'Symlink escape detected');
    });

    it('returns SECURITY_ERROR in quiet mode', async () => {
      const { SecurityError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(new SecurityError('Symlink escape detected'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(
        expect.stringContaining('FAIL: my-skill: Symlink escape detected')
      );
    });
  });

  // --- Error handling: ValidationError ---

  describe('error handling: ValidationError', () => {
    it('returns INVALID_PACKAGE and displays issues in non-quiet mode', async () => {
      const { ValidationError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(
        new ValidationError('Package validation failed', [
          { message: 'Missing SKILL.md', code: 'missing_skill_md' },
          { message: 'Invalid metadata', code: 'invalid_metadata' },
        ])
      );

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith(
        'Validation error',
        'Package validation failed'
      );
      expect(consoleOutput).toContainEqual(expect.stringContaining('Missing SKILL.md'));
      expect(consoleOutput).toContainEqual(expect.stringContaining('Invalid metadata'));
    });

    it('returns INVALID_PACKAGE in quiet mode', async () => {
      const { ValidationError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(
        new ValidationError('Package validation failed', [
          { message: 'Missing SKILL.md', code: 'missing_skill_md' },
        ])
      );

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(
        expect.stringContaining('FAIL: my-skill: Package validation failed')
      );
    });
  });

  // --- Error handling: PackageError ---

  describe('error handling: PackageError', () => {
    it('returns INVALID_PACKAGE for normal package errors', async () => {
      const { PackageError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(new PackageError('Corrupted package'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('Package error', 'Corrupted package');
    });

    it('returns ROLLED_BACK when message includes "restored to previous version"', async () => {
      const { PackageError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(new PackageError('Update failed; restored to previous version'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill'])
      ).rejects.toThrow(ProcessExitError);

      // Exit code 6 = ROLLED_BACK
      try {
        const program2 = await createTestProgram();
        await program2.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(6);
        }
      }
    });

    it('returns INVALID_PACKAGE in quiet mode', async () => {
      const { PackageError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(new PackageError('Corrupted package'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(
        expect.stringContaining('FAIL: my-skill: Corrupted package')
      );
    });
  });

  // --- Error handling: FileSystemError ---

  describe('error handling: FileSystemError', () => {
    it('returns NOT_FOUND when message includes "not found"', async () => {
      const { FileSystemError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(
        new FileSystemError('Skill directory not found', '/skills/my-skill')
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(1); // NOT_FOUND
        }
      }

      expect(mockDisplayError).toHaveBeenCalledWith(
        'File system error',
        'Skill directory not found'
      );
    });

    it('returns ROLLBACK_FAILED when message includes "Critical error"', async () => {
      const { FileSystemError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(
        new FileSystemError('Critical error: cannot restore skill', '/skills/my-skill')
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(7); // ROLLBACK_FAILED
        }
      }
    });

    it('returns FILESYSTEM_ERROR for other filesystem errors', async () => {
      const { FileSystemError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(new FileSystemError('Permission denied', '/skills/my-skill'));

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(2); // FILESYSTEM_ERROR
        }
      }
    });

    it('outputs FAIL message in quiet mode', async () => {
      const { FileSystemError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(new FileSystemError('Permission denied', '/skills/my-skill'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(
        expect.stringContaining('FAIL: my-skill: Permission denied')
      );
    });
  });

  // --- Error handling: AsmError ---

  describe('error handling: AsmError', () => {
    it('returns FILESYSTEM_ERROR in non-quiet mode', async () => {
      const { AsmError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(new AsmError('Something went wrong'));

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(2);
        }
      }

      expect(mockDisplayError).toHaveBeenCalledWith('Something went wrong');
    });

    it('returns FILESYSTEM_ERROR in quiet mode', async () => {
      const { AsmError } = await import('../../../src/errors');
      mockUpdate.mockRejectedValue(new AsmError('Something went wrong'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(
        expect.stringContaining('FAIL: my-skill: Something went wrong')
      );
    });
  });

  // --- Error handling: UpdateError (from generator) ---

  describe('error handling: UpdateError (from generator)', () => {
    it('returns NOT_FOUND for skill-not-found error type', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'skill-not-found',
          skillName: 'my-skill',
          searchedPath: '/skills/my-skill',
        })
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(1); // NOT_FOUND
        }
      }

      expect(mockFormatError).toHaveBeenCalled();
    });

    it('returns SECURITY_ERROR for security-error type', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'security-error',
          reason: 'path-traversal',
          details: 'Path traversal detected',
        })
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(5); // SECURITY_ERROR
        }
      }
    });

    it('returns FILESYSTEM_ERROR for filesystem-error type', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'filesystem-error',
          operation: 'write',
          path: '/skills/my-skill',
          message: 'Disk full',
        })
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(2); // FILESYSTEM_ERROR
        }
      }
    });

    it('returns INVALID_PACKAGE for validation-error with packagePath field', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'validation-error',
          field: 'packagePath',
          message: 'Invalid package path',
        })
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(4); // INVALID_PACKAGE
        }
      }
    });

    it('returns INVALID_PACKAGE for validation-error with packageContent field', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'validation-error',
          field: 'packageContent',
          message: 'Invalid package content',
        })
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(4); // INVALID_PACKAGE
        }
      }
    });

    it('returns SECURITY_ERROR for validation-error with other fields', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'validation-error',
          field: 'skillName',
          message: 'Invalid skill name',
        })
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(5); // SECURITY_ERROR
        }
      }
    });

    it('returns INVALID_PACKAGE for package-mismatch type', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'package-mismatch',
          installedSkillName: 'my-skill',
          packageSkillName: 'other-skill',
          message: 'Package skill name does not match',
        })
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(4); // INVALID_PACKAGE
        }
      }
    });

    it('returns FILESYSTEM_ERROR for backup-creation-error type', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'backup-creation-error',
          backupPath: '/backup/my-skill.skill',
          reason: 'Disk full',
        })
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(2); // FILESYSTEM_ERROR
        }
      }
    });

    it('returns ROLLED_BACK for rollback-error type', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'rollback-error',
          skillName: 'my-skill',
          updateFailureReason: 'validation failed',
          rollbackSucceeded: true,
        })
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(6); // ROLLED_BACK
        }
      }
    });

    it('returns ROLLBACK_FAILED for critical-error type', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'critical-error',
          skillName: 'my-skill',
          skillPath: '/skills/my-skill',
          updateFailureReason: 'validation failed',
          rollbackFailureReason: 'permission denied',
          recoveryInstructions: 'Restore from backup manually.',
        })
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(7); // ROLLBACK_FAILED
        }
      }
    });

    it('returns FILESYSTEM_ERROR for timeout type', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'timeout',
          operationName: 'extract',
          timeoutMs: 30000,
        })
      );

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(2); // FILESYSTEM_ERROR
        }
      }
    });

    it('outputs FAIL message in quiet mode', async () => {
      const { UpdateError } = await import('../../../src/generators/updater');
      mockUpdate.mockRejectedValue(
        new UpdateError({
          type: 'skill-not-found',
          skillName: 'my-skill',
          searchedPath: '/skills/my-skill',
        })
      );

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(expect.stringContaining('FAIL: my-skill'));
      expect(mockFormatError).not.toHaveBeenCalled();
    });
  });

  // --- Error handling: generic Error ---

  describe('error handling: generic Error', () => {
    it('returns FILESYSTEM_ERROR in non-quiet mode', async () => {
      mockUpdate.mockRejectedValue(new Error('Unexpected failure'));

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(2);
        }
      }

      expect(mockDisplayError).toHaveBeenCalledWith('Update failed', 'Unexpected failure');
    });

    it('returns FILESYSTEM_ERROR in quiet mode', async () => {
      mockUpdate.mockRejectedValue(new Error('Unexpected failure'));

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(
        expect.stringContaining('FAIL: my-skill: Unexpected failure')
      );
    });
  });

  // --- Error handling: non-Error thrown value ---

  describe('error handling: non-Error thrown value', () => {
    it('returns FILESYSTEM_ERROR in non-quiet mode', async () => {
      mockUpdate.mockRejectedValue('string error');

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'update', 'my-skill', '/path/to/package.skill']);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(2);
        }
      }

      expect(mockDisplayError).toHaveBeenCalledWith('An unexpected error occurred', 'string error');
    });

    it('returns FILESYSTEM_ERROR in quiet mode', async () => {
      mockUpdate.mockRejectedValue('string error');

      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'update',
          'my-skill',
          '/path/to/package.skill',
          '--quiet',
        ])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput).toContainEqual(expect.stringContaining('FAIL: my-skill: string error'));
    });
  });

  // --- EXIT_CODES export ---

  describe('EXIT_CODES export', () => {
    it('exports the correct exit code values', async () => {
      const { EXIT_CODES } = await import('../../../src/commands/update');

      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.NOT_FOUND).toBe(1);
      expect(EXIT_CODES.FILESYSTEM_ERROR).toBe(2);
      expect(EXIT_CODES.CANCELLED).toBe(3);
      expect(EXIT_CODES.INVALID_PACKAGE).toBe(4);
      expect(EXIT_CODES.SECURITY_ERROR).toBe(5);
      expect(EXIT_CODES.ROLLED_BACK).toBe(6);
      expect(EXIT_CODES.ROLLBACK_FAILED).toBe(7);
    });
  });
});
