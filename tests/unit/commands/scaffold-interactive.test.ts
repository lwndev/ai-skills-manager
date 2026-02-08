/**
 * Unit tests for the scaffold interactive module (FEAT-019 Phases 1 & 2)
 *
 * Tests TTY detection, flag conflict detection, non-TTY error handling,
 * conflicting flags warning, -i short flag alias, and interactive prompt flow.
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  isTTY,
  detectConflictingFlags,
  TEMPLATE_CONTENT_FLAGS,
  runInteractivePrompts,
  runInteractiveScaffold,
} from '../../../src/commands/scaffold-interactive';
import type { CliScaffoldOptions } from '../../../src/commands/scaffold';

// Mock @inquirer/prompts
jest.mock('@inquirer/prompts', () => ({
  select: jest.fn(),
  input: jest.fn(),
  confirm: jest.fn(),
}));

// Mock @inquirer/core for ExitPromptError
jest.mock('@inquirer/core', () => {
  class ExitPromptError extends Error {
    name = 'ExitPromptError';
  }
  return { ExitPromptError };
});

// Mock the scaffold API
jest.mock('../../../src/api', () => ({
  scaffold: jest.fn(),
}));

// Mock output utilities — use spies so commander integration tests still see real console output
jest.mock('../../../src/utils/output', () => {
  const actual = jest.requireActual('../../../src/utils/output');
  return {
    ...actual,
    displayCreatedFiles: jest.fn(),
    displayNextSteps: jest.fn(),
    displayMinimalNextSteps: jest.fn(),
    displayInfo: jest.fn(),
  };
});

import { select, input, confirm } from '@inquirer/prompts';
import { ExitPromptError } from '@inquirer/core';
import { scaffold } from '../../../src/api';

const mockSelect = select as jest.MockedFunction<typeof select>;
const mockInput = input as jest.MockedFunction<typeof input>;
const mockConfirm = confirm as jest.MockedFunction<typeof confirm>;
const mockScaffold = scaffold as jest.MockedFunction<typeof scaffold>;

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

      // runInteractiveScaffold will call mocked prompts — set up mock to throw
      // so we can verify the warning was displayed before prompts started
      mockSelect.mockRejectedValueOnce(new Error('prompt aborted for test'));

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
      const scaffoldCmd = program.commands.find((cmd) => cmd.name() === 'scaffold');
      if (!scaffoldCmd) throw new Error('scaffold command not found');
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

  describe('runInteractivePrompts()', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    /**
     * Helper to set up mocks for a full prompt flow.
     * Provides default answers that can be overridden.
     */
    function setupPromptMocks(
      overrides: {
        templateType?: string;
        context?: string;
        agent?: string;
        memory?: string;
        model?: string;
        hooks?: boolean;
        minimal?: boolean;
        description?: string;
        argumentHint?: string;
        allowedTools?: string;
      } = {}
    ) {
      const {
        templateType = 'basic',
        context = 'inherit',
        agent = '',
        memory = 'skip',
        model = 'skip',
        hooks = false,
        minimal = false,
        description = '',
        argumentHint = '',
        allowedTools = '',
      } = overrides;

      // Track call order for conditional logic verification
      let selectCallIndex = 0;
      let inputCallIndex = 0;
      let confirmCallIndex = 0;

      // select is called for: template, context (if basic), memory, model
      const selectAnswers: string[] = [templateType];
      if (templateType === 'basic') {
        selectAnswers.push(context);
      }
      selectAnswers.push(memory); // memory
      selectAnswers.push(model); // model

      mockSelect.mockImplementation(async () => {
        const answer = selectAnswers[selectCallIndex++];
        return answer;
      });

      // input is called for: agent, description, argumentHint, allowedTools
      const inputAnswers = [agent, description, argumentHint, allowedTools];
      mockInput.mockImplementation(
        async (config: {
          validate?: (value: string) => boolean | string | Promise<string | boolean>;
        }) => {
          const answer = inputAnswers[inputCallIndex++];
          // Run validation if provided to cover that code path
          if (config.validate) {
            config.validate(answer);
          }
          return answer;
        }
      );

      // confirm is called for: hooks (if basic/forked), minimal
      const confirmAnswers: boolean[] = [];
      if (templateType === 'basic' || templateType === 'forked') {
        confirmAnswers.push(hooks);
      }
      confirmAnswers.push(minimal);
      mockConfirm.mockImplementation(async () => {
        return confirmAnswers[confirmCallIndex++];
      });
    }

    it('template type prompt produces correct templateType in options', async () => {
      setupPromptMocks({ templateType: 'agent', memory: 'project', model: 'sonnet' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.templateType).toBe('agent');
    });

    it('basic template produces correct templateType', async () => {
      setupPromptMocks({ templateType: 'basic' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.templateType).toBe('basic');
    });

    it('forked template produces correct templateType', async () => {
      setupPromptMocks({ templateType: 'forked' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.templateType).toBe('forked');
    });

    it('context prompt is shown only for basic template', async () => {
      setupPromptMocks({ templateType: 'basic', context: 'fork' });
      await runInteractivePrompts('test-skill');

      // select called 4 times: template, context, memory, model
      expect(mockSelect).toHaveBeenCalledTimes(4);
      // Second select call should be the context prompt
      expect(mockSelect.mock.calls[1][0]).toEqual(
        expect.objectContaining({ message: 'Select context type:' })
      );
    });

    it('context prompt is NOT shown for forked template', async () => {
      setupPromptMocks({ templateType: 'forked' });
      await runInteractivePrompts('test-skill');

      // select called 3 times: template, memory, model (no context)
      expect(mockSelect).toHaveBeenCalledTimes(3);
      const messages = mockSelect.mock.calls.map(
        (call) => (call[0] as { message: string }).message
      );
      expect(messages).not.toContain('Select context type:');
    });

    it('context prompt is NOT shown for agent template', async () => {
      setupPromptMocks({ templateType: 'agent', memory: 'project', model: 'sonnet' });
      await runInteractivePrompts('test-skill');

      const messages = mockSelect.mock.calls.map(
        (call) => (call[0] as { message: string }).message
      );
      expect(messages).not.toContain('Select context type:');
    });

    it('context inherit omits context from options', async () => {
      setupPromptMocks({ templateType: 'basic', context: 'inherit' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.context).toBeUndefined();
    });

    it('context fork sets context in options', async () => {
      setupPromptMocks({ templateType: 'basic', context: 'fork' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.context).toBe('fork');
    });

    it('agent name is set when provided', async () => {
      setupPromptMocks({ templateType: 'basic', agent: 'Explore' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.agent).toBe('Explore');
    });

    it('agent name is skipped when empty', async () => {
      setupPromptMocks({ templateType: 'basic', agent: '' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.agent).toBeUndefined();
    });

    it('memory defaults to project for agent template', async () => {
      setupPromptMocks({ templateType: 'agent', memory: 'project', model: 'sonnet' });
      await runInteractivePrompts('test-skill');

      // Find the memory select call — for agent, the message is "Memory scope:"
      const memoryCall = mockSelect.mock.calls.find(
        (call) => (call[0] as { message: string }).message === 'Memory scope:'
      );
      if (!memoryCall) throw new Error('Expected memory select call');
      expect((memoryCall[0] as { default?: string }).default).toBe('project');
    });

    it('memory defaults to skip for non-agent templates', async () => {
      setupPromptMocks({ templateType: 'basic' });
      await runInteractivePrompts('test-skill');

      const memoryCall = mockSelect.mock.calls.find(
        (call) =>
          (call[0] as { message: string }).message ===
          'Memory scope (optional, press Enter to skip):'
      );
      if (!memoryCall) throw new Error('Expected memory select call');
      expect((memoryCall[0] as { default?: string }).default).toBe('skip');
    });

    it('memory skip omits memory from options for non-agent', async () => {
      setupPromptMocks({ templateType: 'basic', memory: 'skip' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.memory).toBeUndefined();
    });

    it('memory value is set when selected for non-agent', async () => {
      setupPromptMocks({ templateType: 'basic', memory: 'user' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.memory).toBe('user');
    });

    it('model defaults to sonnet for agent template', async () => {
      setupPromptMocks({ templateType: 'agent', memory: 'project', model: 'sonnet' });
      await runInteractivePrompts('test-skill');

      const modelCall = mockSelect.mock.calls.find(
        (call) => (call[0] as { message: string }).message === 'Model:'
      );
      if (!modelCall) throw new Error('Expected model select call');
      expect((modelCall[0] as { default?: string }).default).toBe('sonnet');
    });

    it('model defaults to skip for non-agent templates', async () => {
      setupPromptMocks({ templateType: 'basic' });
      await runInteractivePrompts('test-skill');

      const modelCall = mockSelect.mock.calls.find(
        (call) =>
          (call[0] as { message: string }).message === 'Model (optional, press Enter to skip):'
      );
      if (!modelCall) throw new Error('Expected model select call');
      expect((modelCall[0] as { default?: string }).default).toBe('skip');
    });

    it('model skip omits model from options for non-agent', async () => {
      setupPromptMocks({ templateType: 'basic', model: 'skip' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.model).toBeUndefined();
    });

    it('model value is set when selected', async () => {
      setupPromptMocks({ templateType: 'basic', model: 'opus' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.model).toBe('opus');
    });

    it('hooks prompt is shown for basic template', async () => {
      setupPromptMocks({ templateType: 'basic', hooks: true });
      await runInteractivePrompts('test-skill');

      const hooksCall = mockConfirm.mock.calls.find(
        (call) =>
          (call[0] as { message: string }).message === 'Include hook configuration examples? (y/N)'
      );
      expect(hooksCall).toBeDefined();
    });

    it('hooks prompt is shown for forked template', async () => {
      setupPromptMocks({ templateType: 'forked', hooks: false });
      await runInteractivePrompts('test-skill');

      const hooksCall = mockConfirm.mock.calls.find(
        (call) =>
          (call[0] as { message: string }).message === 'Include hook configuration examples? (y/N)'
      );
      expect(hooksCall).toBeDefined();
    });

    it('hooks prompt is skipped for with-hooks template', async () => {
      setupPromptMocks({ templateType: 'with-hooks' });
      await runInteractivePrompts('test-skill');

      const hooksCall = mockConfirm.mock.calls.find(
        (call) =>
          (call[0] as { message: string }).message === 'Include hook configuration examples? (y/N)'
      );
      expect(hooksCall).toBeUndefined();
    });

    it('hooks prompt is skipped for internal template', async () => {
      setupPromptMocks({ templateType: 'internal' });
      await runInteractivePrompts('test-skill');

      const hooksCall = mockConfirm.mock.calls.find(
        (call) =>
          (call[0] as { message: string }).message === 'Include hook configuration examples? (y/N)'
      );
      expect(hooksCall).toBeUndefined();
    });

    it('hooks prompt is skipped for agent template', async () => {
      setupPromptMocks({ templateType: 'agent', memory: 'project', model: 'sonnet' });
      await runInteractivePrompts('test-skill');

      const hooksCall = mockConfirm.mock.calls.find(
        (call) =>
          (call[0] as { message: string }).message === 'Include hook configuration examples? (y/N)'
      );
      expect(hooksCall).toBeUndefined();
    });

    it('hooks yes sets includeHooks in options', async () => {
      setupPromptMocks({ templateType: 'basic', hooks: true });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.includeHooks).toBe(true);
    });

    it('hooks no does not set includeHooks in options', async () => {
      setupPromptMocks({ templateType: 'basic', hooks: false });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.includeHooks).toBeUndefined();
    });

    it('minimal yes sets minimal in options', async () => {
      setupPromptMocks({ templateType: 'basic', minimal: true });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.minimal).toBe(true);
    });

    it('minimal no does not set minimal in options', async () => {
      setupPromptMocks({ templateType: 'basic', minimal: false });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.minimal).toBeUndefined();
    });

    it('description is set when provided', async () => {
      setupPromptMocks({ templateType: 'basic', description: 'A useful skill' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.description).toBe('A useful skill');
    });

    it('description is skipped when empty', async () => {
      setupPromptMocks({ templateType: 'basic', description: '' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.description).toBeUndefined();
    });

    it('argument hint is set when provided', async () => {
      setupPromptMocks({ templateType: 'basic', argumentHint: '<query> [--deep]' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.argumentHint).toBe('<query> [--deep]');
    });

    it('argument hint is skipped when empty', async () => {
      setupPromptMocks({ templateType: 'basic', argumentHint: '' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.templateOptions.argumentHint).toBeUndefined();
    });

    it('argument hint validates 100-character max', async () => {
      setupPromptMocks({ templateType: 'basic' });

      // Override the input mock to capture and test the validate function
      let capturedValidate:
        | ((value: string) => boolean | string | Promise<string | boolean>)
        | undefined;
      const inputCallCount = { count: 0 };
      mockInput.mockImplementation(
        async (config: {
          message: string;
          validate?: (value: string) => boolean | string | Promise<string | boolean>;
        }) => {
          inputCallCount.count++;
          if (config.message.includes('Argument hint')) {
            capturedValidate = config.validate;
          }
          // Return values for: agent, description, argumentHint, allowedTools
          const answers = ['', '', '', ''];
          return answers[inputCallCount.count - 1] ?? '';
        }
      );

      await runInteractivePrompts('test-skill');

      if (!capturedValidate) throw new Error('Expected validate function to be captured');
      // Valid: empty (skip)
      expect(capturedValidate('')).toBe(true);
      // Valid: under 100 chars
      expect(capturedValidate('<query>')).toBe(true);
      // Valid: exactly 100 chars
      expect(capturedValidate('a'.repeat(100))).toBe(true);
      // Invalid: over 100 chars
      expect(capturedValidate('a'.repeat(101))).toBe(
        'Argument hint must be 100 characters or fewer.'
      );
    });

    it('allowed tools parsed from comma-separated string to array', async () => {
      setupPromptMocks({ templateType: 'basic', allowedTools: 'Read, Write, Bash' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.allowedTools).toEqual(['Read', 'Write', 'Bash']);
    });

    it('allowed tools with extra commas and spaces are trimmed', async () => {
      setupPromptMocks({ templateType: 'basic', allowedTools: ' Read , , Write ' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.allowedTools).toEqual(['Read', 'Write']);
    });

    it('allowed tools skipped when empty', async () => {
      setupPromptMocks({ templateType: 'basic', allowedTools: '' });

      const result = await runInteractivePrompts('test-skill');
      expect(result.allowedTools).toBeUndefined();
    });

    it('agent template with all options set produces correct result', async () => {
      setupPromptMocks({
        templateType: 'agent',
        agent: 'code-reviewer',
        memory: 'project',
        model: 'sonnet',
        minimal: false,
        description: 'Reviews code',
        argumentHint: '<file>',
        allowedTools: 'Read, Glob, Grep',
      });

      const result = await runInteractivePrompts('test-skill');

      expect(result.templateOptions).toEqual({
        templateType: 'agent',
        agent: 'code-reviewer',
        memory: 'project',
        model: 'sonnet',
        argumentHint: '<file>',
      });
      expect(result.description).toBe('Reviews code');
      expect(result.allowedTools).toEqual(['Read', 'Glob', 'Grep']);
    });

    it('Ctrl+C during prompts throws ExitPromptError', async () => {
      mockSelect.mockRejectedValueOnce(new ExitPromptError('user exit'));

      await expect(runInteractivePrompts('test-skill')).rejects.toThrow(ExitPromptError);
    });

    it('EOF on stdin throws ExitPromptError', async () => {
      // ExitPromptError is thrown for both Ctrl+C and EOF by @inquirer/prompts
      mockSelect.mockRejectedValueOnce(new ExitPromptError('eof'));

      await expect(runInteractivePrompts('test-skill')).rejects.toThrow(ExitPromptError);
    });
  });

  describe('runInteractiveScaffold()', () => {
    let originalConsoleLog: typeof console.log;
    let originalProcessExit: typeof process.exit;
    let consoleOutput: string[];

    beforeEach(() => {
      jest.clearAllMocks();
      consoleOutput = [];
      originalConsoleLog = console.log;
      originalProcessExit = process.exit;
      console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
      process.exit = ((code?: number) => {
        throw new ProcessExitError(code ?? 0);
      }) as typeof process.exit;
    });

    afterEach(() => {
      console.log = originalConsoleLog;
      process.exit = originalProcessExit;
    });

    it('Ctrl+C exits with code 0 and message "Scaffold cancelled."', async () => {
      mockSelect.mockRejectedValueOnce(new ExitPromptError('user exit'));

      const options: CliScaffoldOptions = { interactive: true };

      await expect(runInteractiveScaffold('test-skill', options)).rejects.toThrow(ProcessExitError);

      try {
        mockSelect.mockRejectedValueOnce(new ExitPromptError('user exit'));
        await runInteractiveScaffold('test-skill', options);
      } catch (e) {
        if (e instanceof ProcessExitError) {
          expect(e.code).toBe(0);
        }
      }

      expect(consoleOutput.some((line) => line.includes('Scaffold cancelled.'))).toBe(true);
    });

    it('EOF on stdin exits with code 0 and message "Scaffold cancelled."', async () => {
      mockSelect.mockRejectedValueOnce(new ExitPromptError('eof'));

      const options: CliScaffoldOptions = { interactive: true };

      await expect(runInteractiveScaffold('test-skill', options)).rejects.toThrow(ProcessExitError);

      expect(consoleOutput.some((line) => line.includes('Scaffold cancelled.'))).toBe(true);
    });

    it('non-ExitPromptError is re-thrown', async () => {
      mockSelect.mockRejectedValueOnce(new Error('unexpected error'));

      const options: CliScaffoldOptions = { interactive: true };

      await expect(runInteractiveScaffold('test-skill', options)).rejects.toThrow(
        'unexpected error'
      );
    });

    it('calls scaffold API with correct options and displays success output', async () => {
      // Set up mocks for a basic flow
      let selectIdx = 0;
      const selectAnswers = ['basic', 'inherit', 'skip', 'skip'];
      mockSelect.mockImplementation(async () => selectAnswers[selectIdx++]);

      let inputIdx = 0;
      const inputAnswers = ['', 'A test skill', '', ''];
      mockInput.mockImplementation(async () => inputAnswers[inputIdx++]);

      let confirmIdx = 0;
      const confirmAnswers = [false, false]; // hooks: no, minimal: no
      mockConfirm.mockImplementation(async () => confirmAnswers[confirmIdx++]);

      mockScaffold.mockResolvedValueOnce({
        path: '/tmp/test-skill',
        files: ['/tmp/test-skill/SKILL.md'],
      });

      const options: CliScaffoldOptions = { interactive: true, project: true };
      await runInteractiveScaffold('test-skill', options);

      expect(mockScaffold).toHaveBeenCalledWith({
        name: 'test-skill',
        description: 'A test skill',
        allowedTools: undefined,
        output: undefined,
        scope: 'project',
        force: undefined,
        template: { templateType: 'basic' },
      });
    });

    it('respects --personal flag for scope', async () => {
      let selectIdx = 0;
      const selectAnswers = ['basic', 'inherit', 'skip', 'skip'];
      mockSelect.mockImplementation(async () => selectAnswers[selectIdx++]);
      mockInput.mockResolvedValue('');
      mockConfirm.mockResolvedValue(false);

      mockScaffold.mockResolvedValueOnce({
        path: '/home/.claude/skills/test-skill',
        files: ['/home/.claude/skills/test-skill/SKILL.md'],
      });

      const options: CliScaffoldOptions = { interactive: true, personal: true };
      await runInteractiveScaffold('test-skill', options);

      expect(mockScaffold).toHaveBeenCalledWith(expect.objectContaining({ scope: 'personal' }));
    });

    it('respects --output and --force flags', async () => {
      let selectIdx = 0;
      const selectAnswers = ['basic', 'inherit', 'skip', 'skip'];
      mockSelect.mockImplementation(async () => selectAnswers[selectIdx++]);
      mockInput.mockResolvedValue('');
      mockConfirm.mockResolvedValue(false);

      mockScaffold.mockResolvedValueOnce({
        path: '/custom/path/test-skill',
        files: ['/custom/path/test-skill/SKILL.md'],
      });

      const options: CliScaffoldOptions = {
        interactive: true,
        output: '/custom/path',
        force: true,
      };
      await runInteractiveScaffold('test-skill', options);

      expect(mockScaffold).toHaveBeenCalledWith(
        expect.objectContaining({
          output: '/custom/path',
          force: true,
        })
      );
    });
  });
});
