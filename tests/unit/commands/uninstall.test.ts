/**
 * Unit tests for the uninstall CLI command
 *
 * Tests command registration, single/multi uninstall, dry-run,
 * force mode, quiet mode, cancellation, and error handling.
 */

import { Command } from 'commander';
import type { Mock } from 'vitest';
import type {
  DryRunPreview,
  UninstallResult,
  UninstallFailure,
} from '../../../src/types/uninstall';

// --- Mocks ---

vi.mock('../../../src/validators/uninstall-name', () => ({
  validateSkillName: vi.fn().mockReturnValue({ valid: true }),
}));

vi.mock('../../../src/validators/uninstall-scope', () => ({
  validateUninstallScope: vi.fn().mockReturnValue({ valid: true, scope: 'project' }),
}));

vi.mock('../../../src/generators/uninstaller', () => ({
  uninstallSkill: vi.fn(),
  uninstallMultipleSkills: vi.fn(),
  isDryRunPreview: vi.fn().mockReturnValue(false),
  getScopePath: vi.fn().mockReturnValue('/mock/.claude/skills'),
}));

vi.mock('../../../src/generators/skill-discovery', () => ({
  discoverSkill: vi.fn(),
}));

vi.mock('../../../src/generators/file-enumerator', () => ({
  collectSkillFiles: vi.fn().mockResolvedValue([]),
  getSkillSummary: vi.fn().mockResolvedValue({}),
  checkResourceLimits: vi.fn().mockReturnValue({ type: 'within-limits' }),
}));

vi.mock('../../../src/utils/scope-resolver', () => ({
  resolveScope: vi.fn().mockReturnValue({ type: 'project', path: '/mock/.claude/skills' }),
}));

vi.mock('../../../src/utils/signal-handler', () => ({
  setupInterruptHandler: vi.fn(),
  resetInterruptHandler: vi.fn(),
  isInterrupted: vi.fn().mockReturnValue(false),
}));

vi.mock('../../../src/formatters/uninstall-formatter', () => ({
  formatDiscoveryProgress: vi.fn().mockReturnValue('discovering...'),
  formatSkillFound: vi.fn().mockReturnValue('found!'),
  formatConfirmationPrompt: vi.fn().mockReturnValue('confirm?'),
  formatMultiSkillConfirmation: vi.fn().mockReturnValue('confirm multi?'),
  formatSuccess: vi.fn().mockReturnValue('uninstalled!'),
  formatMultiSuccess: vi.fn().mockReturnValue('all uninstalled!'),
  formatError: vi.fn().mockReturnValue('error!'),
  formatDryRun: vi.fn().mockReturnValue('dry-run output'),
  formatQuietOutput: vi.fn().mockReturnValue('OK: skill'),
  formatQuietError: vi.fn().mockReturnValue('FAIL: skill'),
  formatPartialFailure: vi.fn().mockReturnValue('partial failure'),
  formatCancellation: vi.fn().mockReturnValue('cancelled'),
  formatInvalidSkillNameError: vi.fn().mockReturnValue('invalid name!'),
  formatInvalidScopeError: vi.fn().mockReturnValue('invalid scope!'),
}));

vi.mock('../../../src/utils/prompts', () => ({
  confirmUninstall: vi.fn().mockResolvedValue(true),
  confirmMultiUninstall: vi.fn().mockResolvedValue(true),
  confirmBulkForceUninstall: vi.fn().mockResolvedValue(true),
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
  const { registerUninstallCommand } = await import('../../../src/commands/uninstall');
  const program = new Command();
  program.exitOverride();
  registerUninstallCommand(program);
  return program;
}

function makeSuccessResult(skillName = 'test-skill'): UninstallResult {
  return {
    success: true,
    skillName,
    path: `/mock/.claude/skills/${skillName}`,
    filesRemoved: 3,
    bytesFreed: 1024,
  };
}

function makeFailureResult(
  skillName = 'test-skill',
  error: UninstallFailure['error'] = {
    type: 'skill-not-found',
    skillName,
    searchedPath: '/mock/.claude/skills',
  }
): UninstallFailure {
  return {
    success: false,
    skillName,
    error,
  };
}

function makeDryRunPreview(skillName = 'test-skill'): DryRunPreview {
  return {
    type: 'dry-run-preview',
    skillName,
    files: [
      {
        relativePath: 'SKILL.md',
        absolutePath: `/mock/.claude/skills/${skillName}/SKILL.md`,
        size: 512,
        isDirectory: false,
        isSymlink: false,
        linkCount: 1,
      },
    ],
    totalSize: 512,
  };
}

// --- Tests ---

describe('uninstall CLI command', () => {
  let originalConsoleLog: typeof console.log;
  let originalProcessExit: typeof process.exit;
  let consoleOutput: string[];

  // Mocked module references
  let mockValidateSkillName: Mock;
  let mockValidateUninstallScope: Mock;
  let mockUninstallSkill: Mock;
  let mockUninstallMultipleSkills: Mock;
  let mockIsDryRunPreview: Mock;
  let mockDiscoverSkill: Mock;
  let mockCollectSkillFiles: Mock;
  let mockCheckResourceLimits: Mock;
  let mockIsInterrupted: Mock;
  let mockConfirmUninstall: Mock;
  let mockConfirmMultiUninstall: Mock;
  let mockConfirmBulkForceUninstall: Mock;

  beforeEach(async () => {
    consoleOutput = [];

    originalConsoleLog = console.log;
    originalProcessExit = process.exit;

    console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
    process.exit = ((code?: number) => {
      throw new ProcessExitError(code ?? 0);
    }) as typeof process.exit;

    // Get references to mocked functions
    const nameValidator = await import('../../../src/validators/uninstall-name');
    const scopeValidator = await import('../../../src/validators/uninstall-scope');
    const uninstaller = await import('../../../src/generators/uninstaller');
    const discovery = await import('../../../src/generators/skill-discovery');
    const fileEnum = await import('../../../src/generators/file-enumerator');
    const signalHandler = await import('../../../src/utils/signal-handler');
    const prompts = await import('../../../src/utils/prompts');

    mockValidateSkillName = nameValidator.validateSkillName as Mock;
    mockValidateUninstallScope = scopeValidator.validateUninstallScope as Mock;
    mockUninstallSkill = uninstaller.uninstallSkill as Mock;
    mockUninstallMultipleSkills = uninstaller.uninstallMultipleSkills as Mock;
    mockIsDryRunPreview = uninstaller.isDryRunPreview as Mock;
    mockDiscoverSkill = discovery.discoverSkill as Mock;
    mockCollectSkillFiles = fileEnum.collectSkillFiles as Mock;
    mockCheckResourceLimits = fileEnum.checkResourceLimits as Mock;
    mockIsInterrupted = signalHandler.isInterrupted as Mock;
    mockConfirmUninstall = prompts.confirmUninstall as Mock;
    mockConfirmMultiUninstall = prompts.confirmMultiUninstall as Mock;
    mockConfirmBulkForceUninstall = prompts.confirmBulkForceUninstall as Mock;

    // Reset all mocks to their default return values
    mockValidateSkillName.mockReturnValue({ valid: true });
    mockValidateUninstallScope.mockReturnValue({ valid: true, scope: 'project' });
    mockIsDryRunPreview.mockReturnValue(false);
    mockCollectSkillFiles.mockResolvedValue([]);
    mockCheckResourceLimits.mockReturnValue({ type: 'within-limits' });
    mockIsInterrupted.mockReturnValue(false);
    mockConfirmUninstall.mockResolvedValue(true);
    mockConfirmMultiUninstall.mockResolvedValue(true);
    mockConfirmBulkForceUninstall.mockResolvedValue(true);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    process.exit = originalProcessExit;
  });

  // --- Single skill: successful uninstall ---

  describe('successful single uninstall', () => {
    it('uninstalls a single skill with --force and exits normally', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/test-skill',
        hasSkillMd: true,
      });
      const successResult = makeSuccessResult();
      mockUninstallSkill.mockResolvedValue(successResult);

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--force']);

      expect(mockUninstallSkill).toHaveBeenCalled();
      expect(consoleOutput).toContain('uninstalled!');
    });

    it('shows discovery progress and skill found messages', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/test-skill',
        hasSkillMd: true,
      });
      mockUninstallSkill.mockResolvedValue(makeSuccessResult());

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--force']);

      expect(consoleOutput).toContain('discovering...');
      expect(consoleOutput).toContain('found!');
    });

    it('asks for confirmation when --force is not set', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/test-skill',
        hasSkillMd: true,
      });
      mockConfirmUninstall.mockResolvedValue(true);
      mockUninstallSkill.mockResolvedValue(makeSuccessResult());

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill']);

      expect(mockConfirmUninstall).toHaveBeenCalled();
      expect(consoleOutput).toContain('uninstalled!');
    });
  });

  // --- Single skill: quiet mode ---

  describe('quiet mode single uninstall', () => {
    it('prints quiet output on success', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/test-skill',
        hasSkillMd: true,
      });
      mockUninstallSkill.mockResolvedValue(makeSuccessResult());

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--force', '--quiet']);

      expect(consoleOutput).toContain('OK: skill');
      // Should NOT contain verbose messages
      expect(consoleOutput).not.toContain('discovering...');
      expect(consoleOutput).not.toContain('found!');
    });

    it('prints quiet error when skill not found', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'not-found',
        searchedPath: '/mock/.claude/skills',
      });

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--force', '--quiet']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(1);
      }

      expect(consoleOutput.join(' ')).toContain('FAIL');
    });
  });

  // --- Invalid scope ---

  describe('invalid scope', () => {
    it('returns SECURITY_ERROR (5) for invalid scope', async () => {
      mockValidateUninstallScope.mockReturnValue({
        valid: false,
        error: 'Invalid scope: custom',
      });

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--scope', 'custom']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(5);
      }

      expect(consoleOutput).toContain('invalid scope!');
    });

    it('prints FAIL message in quiet mode for invalid scope', async () => {
      mockValidateUninstallScope.mockReturnValue({
        valid: false,
        error: 'Invalid scope: custom',
      });

      const program = await createTestProgram();
      try {
        await program.parseAsync([
          'node',
          'asm',
          'uninstall',
          'test-skill',
          '--scope',
          'custom',
          '--quiet',
        ]);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(5);
      }

      expect(consoleOutput.join(' ')).toContain('FAIL');
      expect(consoleOutput).not.toContain('invalid scope!');
    });
  });

  // --- Invalid skill name ---

  describe('invalid skill name', () => {
    it('returns SECURITY_ERROR (5) for invalid skill name', async () => {
      mockValidateSkillName.mockReturnValue({
        valid: false,
        error: 'Invalid skill name: ../escape',
      });

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', '../escape', '--force']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(5);
      }

      expect(consoleOutput).toContain('invalid name!');
    });

    it('prints FAIL message in quiet mode for invalid name', async () => {
      mockValidateSkillName.mockReturnValue({
        valid: false,
        error: 'Invalid skill name: ../escape',
      });

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', '../escape', '--force', '--quiet']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(5);
      }

      expect(consoleOutput.join(' ')).toContain('FAIL');
      expect(consoleOutput).not.toContain('invalid name!');
    });
  });

  // --- Skill not found ---

  describe('skill not found', () => {
    it('returns NOT_FOUND (1) when skill does not exist', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'not-found',
        searchedPath: '/mock/.claude/skills',
      });

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'nonexistent', '--force']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(1);
      }

      expect(consoleOutput).toContain('error!');
    });
  });

  // --- Case mismatch ---

  describe('case mismatch security error', () => {
    it('returns SECURITY_ERROR (5) on case mismatch', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'case-mismatch',
        expectedName: 'test-skill',
        actualName: 'Test-Skill',
      });

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--force']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(5);
      }
    });
  });

  // --- Dry-run single ---

  describe('dry-run single skill', () => {
    it('prints dry-run output and returns SUCCESS', async () => {
      const preview = makeDryRunPreview();
      mockUninstallSkill.mockResolvedValue(preview);
      mockIsDryRunPreview.mockReturnValue(true);

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--dry-run']);

      expect(mockUninstallSkill).toHaveBeenCalledWith(
        'test-skill',
        expect.objectContaining({ dryRun: true })
      );
      expect(consoleOutput).toContain('dry-run output');
    });

    it('handles error during dry-run', async () => {
      const failure = makeFailureResult();
      mockUninstallSkill.mockResolvedValue(failure);
      mockIsDryRunPreview.mockReturnValue(false);

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--dry-run']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(1);
      }
    });
  });

  // --- User cancellation ---

  describe('user cancellation', () => {
    it('returns CANCELLED (3) when user declines confirmation', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/test-skill',
        hasSkillMd: true,
      });
      mockConfirmUninstall.mockResolvedValue(false);

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(3);
      }

      expect(consoleOutput).toContain('cancelled');
    });

    it('returns CANCELLED (3) when interrupted before uninstall', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/test-skill',
        hasSkillMd: true,
      });
      mockIsInterrupted.mockReturnValue(true);

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--force']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(3);
      }
    });

    it('returns CANCELLED (3) when bulk force uninstall is declined', async () => {
      mockConfirmBulkForceUninstall.mockResolvedValue(false);

      const program = await createTestProgram();
      try {
        await program.parseAsync([
          'node',
          'asm',
          'uninstall',
          'skill-a',
          'skill-b',
          'skill-c',
          '--force',
        ]);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(3);
      }

      expect(consoleOutput).toContain('cancelled');
    });
  });

  // --- Multi uninstall: success ---

  describe('successful multi uninstall', () => {
    it('uninstalls multiple skills and exits normally', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/skill-a',
        hasSkillMd: true,
      });
      mockUninstallMultipleSkills.mockResolvedValue({
        succeeded: [makeSuccessResult('skill-a'), makeSuccessResult('skill-b')],
        failed: [],
        totalFilesRemoved: 6,
        totalBytesFreed: 2048,
      });

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'uninstall', 'skill-a', 'skill-b', '--force']);

      expect(mockUninstallMultipleSkills).toHaveBeenCalled();
      expect(consoleOutput).toContain('all uninstalled!');
    });

    it('asks multi-confirm when --force is not set', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/skill-a',
        hasSkillMd: true,
      });
      mockConfirmMultiUninstall.mockResolvedValue(true);
      mockUninstallMultipleSkills.mockResolvedValue({
        succeeded: [makeSuccessResult('skill-a'), makeSuccessResult('skill-b')],
        failed: [],
        totalFilesRemoved: 6,
        totalBytesFreed: 2048,
      });

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'uninstall', 'skill-a', 'skill-b']);

      expect(mockConfirmMultiUninstall).toHaveBeenCalled();
    });

    it('returns CANCELLED (3) when user declines multi-confirm', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/skill-a',
        hasSkillMd: true,
      });
      mockConfirmMultiUninstall.mockResolvedValue(false);

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'skill-a', 'skill-b']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(3);
      }

      expect(consoleOutput).toContain('cancelled');
    });
  });

  // --- Multi uninstall: quiet mode ---

  describe('quiet mode multi uninstall', () => {
    it('prints quiet output for each succeeded skill', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/skill-a',
        hasSkillMd: true,
      });
      mockUninstallMultipleSkills.mockResolvedValue({
        succeeded: [makeSuccessResult('skill-a'), makeSuccessResult('skill-b')],
        failed: [],
        totalFilesRemoved: 6,
        totalBytesFreed: 2048,
      });

      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'uninstall',
        'skill-a',
        'skill-b',
        '--force',
        '--quiet',
      ]);

      // In quiet mode, each succeeded skill gets a quiet output line
      const okOutputs = consoleOutput.filter((o) => o === 'OK: skill');
      expect(okOutputs).toHaveLength(2);
    });
  });

  // --- Multi uninstall: all not found ---

  describe('multi uninstall with all skills not found', () => {
    it('returns NOT_FOUND (1) when all skills are not found', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'not-found',
        searchedPath: '/mock/.claude/skills',
      });

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'skill-a', 'skill-b', '--force']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(1);
      }
    });
  });

  // --- Multi uninstall: partial failure ---

  describe('partial failure in multi uninstall', () => {
    it('returns PARTIAL_FAILURE (4) when some skills fail', async () => {
      // First skill found, second skill found
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/skill-a',
        hasSkillMd: true,
      });
      mockUninstallMultipleSkills.mockResolvedValue({
        succeeded: [makeSuccessResult('skill-a')],
        failed: [
          makeFailureResult('skill-b', {
            type: 'filesystem-error',
            operation: 'delete',
            path: '/mock/.claude/skills/skill-b',
            message: 'Permission denied',
          }),
        ],
        totalFilesRemoved: 3,
        totalBytesFreed: 1024,
      });

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'skill-a', 'skill-b', '--force']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(4);
      }

      expect(consoleOutput).toContain('partial failure');
    });

    it('prints quiet output for partial failure', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/skill-a',
        hasSkillMd: true,
      });
      mockUninstallMultipleSkills.mockResolvedValue({
        succeeded: [makeSuccessResult('skill-a')],
        failed: [
          makeFailureResult('skill-b', {
            type: 'filesystem-error',
            operation: 'delete',
            path: '/mock/.claude/skills/skill-b',
            message: 'Permission denied',
          }),
        ],
        totalFilesRemoved: 3,
        totalBytesFreed: 1024,
      });

      const program = await createTestProgram();
      try {
        await program.parseAsync([
          'node',
          'asm',
          'uninstall',
          'skill-a',
          'skill-b',
          '--force',
          '--quiet',
        ]);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(4);
      }

      // In quiet mode, partial failure prints individual OK/FAIL lines
      expect(consoleOutput).toContain('OK: skill');
      expect(consoleOutput).toContain('FAIL: skill');
    });
  });

  // --- Multi uninstall: all failed ---

  describe('all failed in multi uninstall', () => {
    it('returns the appropriate exit code when all skills fail', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/skill-a',
        hasSkillMd: true,
      });
      mockUninstallMultipleSkills.mockResolvedValue({
        succeeded: [],
        failed: [
          makeFailureResult('skill-a', {
            type: 'filesystem-error',
            operation: 'delete',
            path: '/mock/.claude/skills/skill-a',
            message: 'Permission denied',
          }),
          makeFailureResult('skill-b', {
            type: 'filesystem-error',
            operation: 'delete',
            path: '/mock/.claude/skills/skill-b',
            message: 'Permission denied',
          }),
        ],
        totalFilesRemoved: 0,
        totalBytesFreed: 0,
      });

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'skill-a', 'skill-b', '--force']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(2); // FILESYSTEM_ERROR
      }
    });
  });

  // --- Dry-run multi ---

  describe('dry-run multi skills', () => {
    it('prints dry-run output for each skill and returns SUCCESS', async () => {
      const preview = makeDryRunPreview();
      mockUninstallSkill.mockResolvedValue(preview);
      mockIsDryRunPreview.mockReturnValue(true);

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'uninstall', 'skill-a', 'skill-b', '--dry-run']);

      // Two dry-run outputs (one per skill)
      const dryRunOutputs = consoleOutput.filter((o) => o === 'dry-run output');
      expect(dryRunOutputs).toHaveLength(2);
    });

    it('prints error for failed dry-run in multi mode', async () => {
      const failure = makeFailureResult();
      mockUninstallSkill.mockResolvedValue(failure);
      mockIsDryRunPreview.mockReturnValue(false);

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'uninstall', 'skill-a', 'skill-b', '--dry-run']);

      // Even with errors, dry-run multi returns SUCCESS
      expect(consoleOutput).toContain('error!');
    });
  });

  // --- Unexpected error handling ---

  describe('unexpected error handling', () => {
    it('catches unexpected errors and returns FILESYSTEM_ERROR (2)', async () => {
      mockDiscoverSkill.mockRejectedValue(new Error('Disk failure'));

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--force']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(2);
      }

      expect(consoleOutput.join(' ')).toContain('Disk failure');
    });

    it('prints FAIL in quiet mode for unexpected errors', async () => {
      mockDiscoverSkill.mockRejectedValue(new Error('Disk failure'));

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--force', '--quiet']);
        expect.unreachable('Should have thrown ProcessExitError');
      } catch (err) {
        expect(err).toBeInstanceOf(ProcessExitError);
        expect((err as ProcessExitError).code).toBe(2);
      }

      expect(consoleOutput.join(' ')).toContain('FAIL');
    });
  });

  // --- Signal handler setup/teardown ---

  describe('signal handler lifecycle', () => {
    it('sets up and resets the interrupt handler', async () => {
      const signalHandler = await import('../../../src/utils/signal-handler');
      const mockSetup = signalHandler.setupInterruptHandler as Mock;
      const mockReset = signalHandler.resetInterruptHandler as Mock;

      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/test-skill',
        hasSkillMd: true,
      });
      mockUninstallSkill.mockResolvedValue(makeSuccessResult());

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--force']);

      expect(mockSetup).toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalled();
    });

    it('resets interrupt handler even when an error occurs', async () => {
      const signalHandler = await import('../../../src/utils/signal-handler');
      const mockReset = signalHandler.resetInterruptHandler as Mock;

      mockDiscoverSkill.mockRejectedValue(new Error('boom'));

      const program = await createTestProgram();
      try {
        await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--force']);
      } catch {
        // Expected
      }

      expect(mockReset).toHaveBeenCalled();
    });
  });

  // --- Resource limits warnings ---

  describe('resource limit warnings', () => {
    it('adds warnings to skill info when resource limits exceeded', async () => {
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/mock/.claude/skills/test-skill',
        hasSkillMd: true,
      });
      mockCheckResourceLimits.mockReturnValue({
        type: 'exceeded',
        warnings: ['Too many files: 500 (limit: 100)'],
      });
      mockUninstallSkill.mockResolvedValue(makeSuccessResult());

      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'uninstall', 'test-skill', '--force']);

      // In force mode, confirmUninstall is not called
      // The important thing is that the flow completes successfully
      expect(consoleOutput).toContain('uninstalled!');
    });
  });

  // --- Scope option ---

  describe('scope option', () => {
    it('passes personal scope through correctly', async () => {
      mockValidateUninstallScope.mockReturnValue({ valid: true, scope: 'personal' });
      mockDiscoverSkill.mockResolvedValue({
        type: 'found',
        path: '/home/user/.claude/skills/test-skill',
        hasSkillMd: true,
      });
      mockUninstallSkill.mockResolvedValue(makeSuccessResult());

      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'uninstall',
        'test-skill',
        '--scope',
        'personal',
        '--force',
      ]);

      expect(mockValidateUninstallScope).toHaveBeenCalledWith('personal');
      expect(mockUninstallSkill).toHaveBeenCalledWith(
        'test-skill',
        expect.objectContaining({ scope: 'personal' })
      );
    });
  });
});
