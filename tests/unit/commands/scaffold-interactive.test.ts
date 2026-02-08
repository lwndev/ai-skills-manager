/**
 * Unit tests for the scaffold interactive module (FEAT-019 Phase 1)
 *
 * Tests TTY detection, flag conflict detection, non-TTY error handling,
 * conflicting flags warning, and -i short flag alias.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  isTTY,
  detectConflictingFlags,
  TEMPLATE_CONTENT_FLAGS,
} from '../../../src/commands/scaffold-interactive';
import type { CliScaffoldOptions } from '../../../src/commands/scaffold';

// Custom error to capture process.exit calls
class ProcessExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
    this.name = 'ProcessExitError';
  }
}

// Helper to create a fresh commander program with scaffold command registered
async function createTestProgram(): Promise<Command> {
  const { registerScaffoldCommand } = await import('../../../src/commands/scaffold');
  const program = new Command();
  program.exitOverride();
  registerScaffoldCommand(program);
  return program;
}

describe('scaffold-interactive', () => {
  describe('isTTY()', () => {
    const originalIsTTY = process.stdin.isTTY;

    afterEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
    });

    it('returns true when process.stdin.isTTY is true', () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      expect(isTTY()).toBe(true);
    });

    it('returns false when process.stdin.isTTY is undefined', () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(isTTY()).toBe(false);
    });

    it('returns false when process.stdin.isTTY is false', () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        writable: true,
        configurable: true,
      });
      expect(isTTY()).toBe(false);
    });
  });

  describe('TEMPLATE_CONTENT_FLAGS', () => {
    it('includes all template-content flag names', () => {
      expect(TEMPLATE_CONTENT_FLAGS).toContain('template');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('context');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('agent');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('userInvocable');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('hooks');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('minimal');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('description');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('allowedTools');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('memory');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('model');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('argumentHint');
    });

    it('does not include output-location flags', () => {
      expect(TEMPLATE_CONTENT_FLAGS).not.toContain('output');
      expect(TEMPLATE_CONTENT_FLAGS).not.toContain('project');
      expect(TEMPLATE_CONTENT_FLAGS).not.toContain('personal');
      expect(TEMPLATE_CONTENT_FLAGS).not.toContain('force');
    });
  });

  describe('detectConflictingFlags()', () => {
    it('returns empty array when no template-content flags are set', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
      };
      expect(detectConflictingFlags(options)).toEqual([]);
    });

    it('detects --template flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        template: 'forked',
      };
      expect(detectConflictingFlags(options)).toContain('template');
    });

    it('detects --context flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        context: 'fork',
      };
      expect(detectConflictingFlags(options)).toContain('context');
    });

    it('detects --agent flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        agent: 'Explore',
      };
      expect(detectConflictingFlags(options)).toContain('agent');
    });

    it('detects --no-user-invocable (userInvocable: false)', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        userInvocable: false,
      };
      expect(detectConflictingFlags(options)).toContain('userInvocable');
    });

    it('does not flag userInvocable when true (default)', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        userInvocable: true,
      };
      expect(detectConflictingFlags(options)).not.toContain('userInvocable');
    });

    it('detects --hooks flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        hooks: true,
      };
      expect(detectConflictingFlags(options)).toContain('hooks');
    });

    it('detects --minimal flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        minimal: true,
      };
      expect(detectConflictingFlags(options)).toContain('minimal');
    });

    it('detects --description flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        description: 'A skill',
      };
      expect(detectConflictingFlags(options)).toContain('description');
    });

    it('detects --allowed-tools flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        allowedTools: 'Read,Write',
      };
      expect(detectConflictingFlags(options)).toContain('allowedTools');
    });

    it('detects --memory flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        memory: 'project',
      };
      expect(detectConflictingFlags(options)).toContain('memory');
    });

    it('detects --model flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        model: 'sonnet',
      };
      expect(detectConflictingFlags(options)).toContain('model');
    });

    it('detects --argument-hint flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        argumentHint: '<query>',
      };
      expect(detectConflictingFlags(options)).toContain('argumentHint');
    });

    it('detects multiple conflicting flags at once', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        template: 'agent',
        memory: 'user',
        model: 'haiku',
      };
      const conflicts = detectConflictingFlags(options);
      expect(conflicts).toContain('template');
      expect(conflicts).toContain('memory');
      expect(conflicts).toContain('model');
      expect(conflicts).toHaveLength(3);
    });

    it('does not flag output-location flags', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        output: '/some/path',
        project: true,
        personal: false,
        force: true,
      };
      const conflicts = detectConflictingFlags(options);
      expect(conflicts).not.toContain('output');
      expect(conflicts).not.toContain('project');
      expect(conflicts).not.toContain('personal');
      expect(conflicts).not.toContain('force');
      expect(conflicts).toEqual([]);
    });
  });

  describe('scaffold command --interactive integration', () => {
    let tempDir: string;
    let originalConsoleLog: typeof console.log;
    let originalConsoleError: typeof console.error;
    let originalProcessExit: typeof process.exit;
    let originalIsTTY: boolean | undefined;
    let consoleOutput: string[];

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-interactive-test-'));
      consoleOutput = [];
      originalConsoleLog = console.log;
      originalConsoleError = console.error;
      originalProcessExit = process.exit;
      originalIsTTY = process.stdin.isTTY;
      console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
      console.error = (...args: unknown[]) => consoleOutput.push(args.join(' '));
      process.exit = ((code?: number) => {
        throw new ProcessExitError(code ?? 0);
      }) as typeof process.exit;
    });

    afterEach(async () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      process.exit = originalProcessExit;
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('non-TTY environment produces error and exit code 1', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const program = await createTestProgram();

      await expect(
        program.parseAsync([
          'node',
          'asm',
          'scaffold',
          'test-skill',
          '--output',
          tempDir,
          '--interactive',
        ])
      ).rejects.toThrow(ProcessExitError);

      try {
        await program.parseAsync([
          'node',
          'asm',
          'scaffold',
          'test-skill',
          '--output',
          tempDir,
          '--interactive',
        ]);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(1);
        }
      }

      expect(consoleOutput.some((line) => line.includes('--interactive requires a TTY'))).toBe(
        true
      );
    });

    it('displays warning when conflicting flags are provided', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });

      const program = await createTestProgram();

      // runInteractiveScaffold throws "not yet implemented" — catch it
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'scaffold',
          'test-skill',
          '--output',
          tempDir,
          '--interactive',
          '--template',
          'forked',
        ])
      ).rejects.toThrow();

      expect(
        consoleOutput.some((line) =>
          line.includes('Interactive mode enabled — template flags will be ignored.')
        )
      ).toBe(true);
    });

    it('-i short flag is accepted as alias for --interactive', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const program = await createTestProgram();

      // Non-TTY should produce the error — proves -i was parsed as --interactive
      await expect(
        program.parseAsync(['node', 'asm', 'scaffold', 'test-skill', '--output', tempDir, '-i'])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput.some((line) => line.includes('--interactive requires a TTY'))).toBe(
        true
      );
    });

    it('help text includes --interactive flag documentation', async () => {
      const program = await createTestProgram();
      const scaffoldCmd = program.commands.find((cmd) => cmd.name() === 'scaffold')!;
      let helpText = '';
      scaffoldCmd.configureOutput({ writeOut: (str: string) => (helpText += str) });
      try {
        await program.parseAsync(['node', 'asm', 'scaffold', '--help']);
      } catch {
        // commander throws on --help with exitOverride
      }

      expect(helpText).toContain('--interactive');
      expect(helpText).toContain('-i');
      expect(helpText).toContain('guided prompt-driven');
    });
  });
});
