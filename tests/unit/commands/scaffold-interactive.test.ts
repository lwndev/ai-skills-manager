/**
 * Unit tests for the scaffold interactive module (FEAT-019 Phases 1–3)
 *
 * Tests TTY detection, flag conflict detection, non-TTY error handling,
 * conflicting flags warning, -i short flag alias, interactive prompt flow,
 * summary formatting, and confirmation loop.
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
  formatSummary,
  ScaffoldCancelledError,
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
import * as output from '../../../src/utils/output';

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
      expect(TEMPLATE_CONTENT_FLAGS).toContain('license');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('compatibility');
      expect(TEMPLATE_CONTENT_FLAGS).toContain('metadata');
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

    it('detects --license flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        license: 'MIT',
      };
      expect(detectConflictingFlags(options)).toContain('license');
    });

    it('detects --compatibility flag', () => {
      const options: CliScaffoldOptions = {
        interactive: true,
        compatibility: 'claude-code>=2.1',
      };
      expect(detectConflictingFlags(options)).toContain('compatibility');
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
        template: 'forked',
        license: 'MIT',
        compatibility: 'claude-code>=2.1',
      };
      const conflicts = detectConflictingFlags(options);
      expect(conflicts).toContain('template');
      expect(conflicts).toContain('license');
      expect(conflicts).toContain('compatibility');
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
        fail('Expected ProcessExitError');
      } catch (e) {
        expect(e).toBeInstanceOf(ProcessExitError);
        expect((e as ProcessExitError).code).toBe(1);
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
     *
     * metadata accepts an array of key=value strings. Each entry becomes one
     * input prompt answer, with confirm prompts for "Add metadata?" and
     * "Add another?" interspersed. An empty array (default) answers "no"
     * to "Add metadata?".
     */
    function setupPromptMocks(
      overrides: {
        templateType?: string;
        context?: string;
        agent?: string;
        hooks?: boolean;
        minimal?: boolean;
        description?: string;
        argumentHint?: string;
        allowedTools?: string;
        license?: string;
        compatibility?: string;
        metadata?: string[];
      } = {}
    ) {
      const {
        templateType = 'basic',
        context = 'inherit',
        agent = '',
        hooks = false,
        minimal = false,
        description = '',
        argumentHint = '',
        allowedTools = '',
        license = '',
        compatibility: compat = '',
        metadata = [],
      } = overrides;

      let selectCallIndex = 0;
      let inputCallIndex = 0;
      let confirmCallIndex = 0;

      // select is called for: template, context (if basic)
      const selectAnswers: string[] = [templateType];
      if (templateType === 'basic') {
        selectAnswers.push(context);
      }

      mockSelect.mockImplementation(async () => {
        const answer = selectAnswers[selectCallIndex++];
        return answer;
      });

      // input is called for: agent, description, argumentHint, allowedTools, license, compatibility
      // then optionally for each metadata entry
      const inputAnswers = [
        agent,
        description,
        argumentHint,
        allowedTools,
        license,
        compat,
        ...metadata,
      ];
      mockInput.mockImplementation(
        async (config: {
          validate?: (value: string) => boolean | string | Promise<string | boolean>;
        }) => {
          const answer = inputAnswers[inputCallIndex++];
          if (config.validate) {
            config.validate(answer);
          }
          return answer;
        }
      );

      // confirm is called for: hooks (if basic/forked), minimal, addMetadata?,
      // then for each metadata entry: addAnother? (yes for all but last)
      const confirmAnswers: boolean[] = [];
      if (templateType === 'basic' || templateType === 'forked') {
        confirmAnswers.push(hooks);
      }
      confirmAnswers.push(minimal);
      // "Add metadata?" confirm
      confirmAnswers.push(metadata.length > 0);
      if (metadata.length > 0) {
        // "Add another?" after each entry — yes for all but last
        for (let i = 0; i < metadata.length; i++) {
          confirmAnswers.push(i < metadata.length - 1);
        }
      }
      mockConfirm.mockImplementation(async () => {
        return confirmAnswers[confirmCallIndex++];
      });
    }

    /**
     * Extract the validate function from a completed mockInput call by matching on the prompt message.
     * Call after runInteractivePrompts() — avoids re-implementing the mock with manual counters.
     */
    function getInputValidator(
      messageSubstring: string
    ): (value: string) => boolean | string | Promise<string | boolean> {
      const call = mockInput.mock.calls.find((args) =>
        (args[0] as { message: string }).message.includes(messageSubstring)
      );
      if (!call) throw new Error(`No input call found matching "${messageSubstring}"`);
      const validate = (
        call[0] as { validate?: (value: string) => boolean | string | Promise<string | boolean> }
      ).validate;
      if (!validate)
        throw new Error(`Input call matching "${messageSubstring}" has no validate function`);
      return validate;
    }

    it('template type prompt produces correct templateType in options', async () => {
      setupPromptMocks({ templateType: 'forked' });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.templateType).toBe('forked');
    });

    it('basic template produces correct templateType', async () => {
      setupPromptMocks({ templateType: 'basic' });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.templateType).toBe('basic');
    });

    it('forked template produces correct templateType', async () => {
      setupPromptMocks({ templateType: 'forked' });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.templateType).toBe('forked');
    });

    it('context prompt is shown only for basic template', async () => {
      setupPromptMocks({ templateType: 'basic', context: 'fork' });
      await runInteractivePrompts();

      // select called 2 times: template, context
      expect(mockSelect).toHaveBeenCalledTimes(2);
      // Second select call should be the context prompt
      expect(mockSelect.mock.calls[1][0]).toEqual(
        expect.objectContaining({ message: 'Select context type:' })
      );
    });

    it('context prompt is NOT shown for forked template', async () => {
      setupPromptMocks({ templateType: 'forked' });
      await runInteractivePrompts();

      // select called 1 time: template (no context)
      expect(mockSelect).toHaveBeenCalledTimes(1);
      const messages = mockSelect.mock.calls.map(
        (call) => (call[0] as { message: string }).message
      );
      expect(messages).not.toContain('Select context type:');
    });

    it('context prompt is NOT shown for with-hooks template', async () => {
      setupPromptMocks({ templateType: 'with-hooks' });
      await runInteractivePrompts();

      const messages = mockSelect.mock.calls.map(
        (call) => (call[0] as { message: string }).message
      );
      expect(messages).not.toContain('Select context type:');
    });

    it('context inherit omits context from options', async () => {
      setupPromptMocks({ templateType: 'basic', context: 'inherit' });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.context).toBeUndefined();
    });

    it('context fork sets context in options', async () => {
      setupPromptMocks({ templateType: 'basic', context: 'fork' });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.context).toBe('fork');
    });

    it('agent name is set when provided', async () => {
      setupPromptMocks({ templateType: 'basic', agent: 'Explore' });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.agent).toBe('Explore');
    });

    it('agent name is skipped when empty', async () => {
      setupPromptMocks({ templateType: 'basic', agent: '' });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.agent).toBeUndefined();
    });

    it('hooks prompt is shown for basic template', async () => {
      setupPromptMocks({ templateType: 'basic', hooks: true });
      await runInteractivePrompts();

      const hooksCall = mockConfirm.mock.calls.find(
        (call) =>
          (call[0] as { message: string }).message === 'Include hook configuration examples? (y/N)'
      );
      expect(hooksCall).toBeDefined();
    });

    it('hooks prompt is shown for forked template', async () => {
      setupPromptMocks({ templateType: 'forked', hooks: false });
      await runInteractivePrompts();

      const hooksCall = mockConfirm.mock.calls.find(
        (call) =>
          (call[0] as { message: string }).message === 'Include hook configuration examples? (y/N)'
      );
      expect(hooksCall).toBeDefined();
    });

    it('hooks prompt is skipped for with-hooks template', async () => {
      setupPromptMocks({ templateType: 'with-hooks' });
      await runInteractivePrompts();

      const hooksCall = mockConfirm.mock.calls.find(
        (call) =>
          (call[0] as { message: string }).message === 'Include hook configuration examples? (y/N)'
      );
      expect(hooksCall).toBeUndefined();
    });

    it('hooks prompt is skipped for internal template', async () => {
      setupPromptMocks({ templateType: 'internal' });
      await runInteractivePrompts();

      const hooksCall = mockConfirm.mock.calls.find(
        (call) =>
          (call[0] as { message: string }).message === 'Include hook configuration examples? (y/N)'
      );
      expect(hooksCall).toBeUndefined();
    });

    it('hooks yes sets includeHooks in options', async () => {
      setupPromptMocks({ templateType: 'basic', hooks: true });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.includeHooks).toBe(true);
    });

    it('hooks no does not set includeHooks in options', async () => {
      setupPromptMocks({ templateType: 'basic', hooks: false });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.includeHooks).toBeUndefined();
    });

    it('minimal yes sets minimal in options', async () => {
      setupPromptMocks({ templateType: 'basic', minimal: true });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.minimal).toBe(true);
    });

    it('minimal no does not set minimal in options', async () => {
      setupPromptMocks({ templateType: 'basic', minimal: false });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.minimal).toBeUndefined();
    });

    it('description is set when provided', async () => {
      setupPromptMocks({ templateType: 'basic', description: 'A useful skill' });

      const result = await runInteractivePrompts();
      expect(result.description).toBe('A useful skill');
    });

    it('description is skipped when empty', async () => {
      setupPromptMocks({ templateType: 'basic', description: '' });

      const result = await runInteractivePrompts();
      expect(result.description).toBeUndefined();
    });

    it('argument hint is set when provided', async () => {
      setupPromptMocks({ templateType: 'basic', argumentHint: '<query> [--deep]' });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.argumentHint).toBe('<query> [--deep]');
    });

    it('argument hint is skipped when empty', async () => {
      setupPromptMocks({ templateType: 'basic', argumentHint: '' });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.argumentHint).toBeUndefined();
    });

    it('argument hint validates 200-character max', async () => {
      setupPromptMocks({ templateType: 'basic' });
      await runInteractivePrompts();

      const validate = getInputValidator('Argument hint');
      // Valid: empty (skip)
      expect(validate('')).toBe(true);
      // Valid: under 200 chars
      expect(validate('<query>')).toBe(true);
      // Valid: exactly 200 chars
      expect(validate('a'.repeat(200))).toBe(true);
      // Invalid: over 200 chars
      expect(validate('a'.repeat(201))).toBe('Argument hint must be 200 characters or fewer.');
    });

    it('compatibility validates trimmed length for 500-character max', async () => {
      setupPromptMocks({ templateType: 'basic' });
      await runInteractivePrompts();

      const validate = getInputValidator('Compatibility');
      // Valid: empty (skip)
      expect(validate('')).toBe(true);
      // Valid: under 500 chars
      expect(validate('claude-code>=2.1')).toBe(true);
      // Valid: exactly 500 chars
      expect(validate('a'.repeat(500))).toBe(true);
      // Invalid: over 500 chars
      expect(validate('a'.repeat(501))).toBe('Compatibility must be 500 characters or fewer.');
      // Invalid: only whitespace
      expect(validate('   ')).toBe('Compatibility cannot be empty whitespace.');
      // Valid: whitespace-padded input where trimmed length is under 500
      expect(validate('  ' + 'a'.repeat(498) + '  ')).toBe(true);
      // Invalid: trimmed length over 500 (whitespace should not count)
      expect(validate('  ' + 'a'.repeat(501) + '  ')).toBe(
        'Compatibility must be 500 characters or fewer.'
      );
    });

    it('allowed tools parsed from comma-separated string to array', async () => {
      setupPromptMocks({ templateType: 'basic', allowedTools: 'Read, Write, Bash' });

      const result = await runInteractivePrompts();
      expect(result.allowedTools).toEqual(['Read', 'Write', 'Bash']);
    });

    it('allowed tools with extra commas and spaces are trimmed', async () => {
      setupPromptMocks({ templateType: 'basic', allowedTools: ' Read , , Write ' });

      const result = await runInteractivePrompts();
      expect(result.allowedTools).toEqual(['Read', 'Write']);
    });

    it('allowed tools skipped when empty', async () => {
      setupPromptMocks({ templateType: 'basic', allowedTools: '' });

      const result = await runInteractivePrompts();
      expect(result.allowedTools).toBeUndefined();
    });

    it('forked template with all options set produces correct result', async () => {
      setupPromptMocks({
        templateType: 'forked',
        agent: 'code-reviewer',
        hooks: true,
        minimal: false,
        description: 'Reviews code',
        argumentHint: '<file>',
        allowedTools: 'Read, Glob, Grep',
        license: 'MIT',
        compatibility: 'claude-code>=2.1',
        metadata: ['author=team', 'version=1.0'],
      });

      const result = await runInteractivePrompts();

      expect(result.templateOptions).toEqual({
        templateType: 'forked',
        agent: 'code-reviewer',
        includeHooks: true,
        argumentHint: '<file>',
        license: 'MIT',
        compatibility: 'claude-code>=2.1',
        metadata: { author: 'team', version: '1.0' },
      });
      expect(result.description).toBe('Reviews code');
      expect(result.allowedTools).toEqual(['Read', 'Glob', 'Grep']);
    });

    it('metadata with comma in value is preserved correctly', async () => {
      setupPromptMocks({
        templateType: 'basic',
        metadata: ['description=A tool, for testing'],
      });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.metadata).toEqual({
        description: 'A tool, for testing',
      });
    });

    it('metadata with multiple commas in value is preserved correctly', async () => {
      setupPromptMocks({
        templateType: 'basic',
        metadata: ['tags=one, two, three'],
      });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.metadata).toEqual({
        tags: 'one, two, three',
      });
    });

    it('metadata skipped when user declines add metadata prompt', async () => {
      setupPromptMocks({ templateType: 'basic', metadata: [] });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.metadata).toBeUndefined();
    });

    it('single metadata entry without commas works correctly', async () => {
      setupPromptMocks({
        templateType: 'basic',
        metadata: ['author=team'],
      });

      const result = await runInteractivePrompts();
      expect(result.templateOptions.metadata).toEqual({ author: 'team' });
    });

    it('metadata entry validates key=value format', async () => {
      setupPromptMocks({ templateType: 'basic', metadata: ['author=team'] });
      await runInteractivePrompts();

      const validate = getInputValidator('Metadata entry');
      expect(validate('')).toBe('Entry cannot be empty.');
      expect(validate('   ')).toBe('Entry cannot be empty.');
      expect(validate('noequals')).toBe('Invalid format. Use key=value (e.g. author=team).');
      expect(validate('=value')).toBe('Invalid format. Use key=value (e.g. author=team).');
      expect(validate('key=')).toBe('Value cannot be empty.');
      expect(validate('key=   ')).toBe('Value cannot be empty.');
      expect(validate('key=value')).toBe(true);
      expect(validate('key=value, with commas')).toBe(true);
    });

    it('Ctrl+C during prompts throws ExitPromptError', async () => {
      mockSelect.mockRejectedValueOnce(new ExitPromptError('user exit'));

      await expect(runInteractivePrompts()).rejects.toThrow(ExitPromptError);
    });

    it('EOF on stdin throws ExitPromptError', async () => {
      // ExitPromptError is thrown for both Ctrl+C and EOF by @inquirer/prompts
      mockSelect.mockRejectedValueOnce(new ExitPromptError('eof'));

      await expect(runInteractivePrompts()).rejects.toThrow(ExitPromptError);
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

    it('Ctrl+C throws ScaffoldCancelledError', async () => {
      mockSelect.mockRejectedValueOnce(new ExitPromptError('user exit'));

      const options: CliScaffoldOptions = { interactive: true };

      await expect(runInteractiveScaffold('test-skill', options)).rejects.toThrow(
        ScaffoldCancelledError
      );
      await expect(
        (async () => {
          mockSelect.mockRejectedValueOnce(new ExitPromptError('user exit'));
          await runInteractiveScaffold('test-skill', options);
        })()
      ).rejects.toThrow('Scaffold cancelled.');
    });

    it('EOF on stdin throws ScaffoldCancelledError', async () => {
      mockSelect.mockRejectedValueOnce(new ExitPromptError('eof'));

      const options: CliScaffoldOptions = { interactive: true };

      await expect(runInteractiveScaffold('test-skill', options)).rejects.toThrow(
        ScaffoldCancelledError
      );
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
      const selectAnswers = ['basic', 'inherit'];
      mockSelect.mockImplementation(async () => selectAnswers[selectIdx++]);

      let inputIdx = 0;
      const inputAnswers = ['', 'A test skill', '', '', '', ''];
      mockInput.mockImplementation(async () => inputAnswers[inputIdx++]);

      let confirmIdx = 0;
      // hooks: no, minimal: no, addMetadata: no, Proceed: yes
      const confirmAnswers = [false, false, false, true];
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

    it('displays summary before confirmation', async () => {
      let selectIdx = 0;
      const selectAnswers = ['forked'];
      mockSelect.mockImplementation(async () => selectAnswers[selectIdx++]);

      let inputIdx = 0;
      const inputAnswers = ['code-reviewer', 'Reviews code', '', 'Read, Grep', '', ''];
      mockInput.mockImplementation(async () => inputAnswers[inputIdx++]);

      let confirmIdx = 0;
      // hooks: no, minimal: no, addMetadata: no, Proceed: yes (forked gets hooks prompt)
      const confirmAnswers = [false, false, false, true];
      mockConfirm.mockImplementation(async () => confirmAnswers[confirmIdx++]);

      mockScaffold.mockResolvedValueOnce({
        path: '/tmp/test-skill',
        files: ['/tmp/test-skill/SKILL.md'],
      });

      const options: CliScaffoldOptions = { interactive: true };
      await runInteractiveScaffold('test-skill', options);

      // Verify summary was displayed through the output module
      const mockDisplayInfo = output.displayInfo as jest.MockedFunction<typeof output.displayInfo>;
      expect(mockDisplayInfo).toHaveBeenCalledWith(
        expect.stringContaining('Scaffold configuration:')
      );
      expect(mockDisplayInfo).toHaveBeenCalledWith(expect.stringContaining('test-skill'));
      expect(mockDisplayInfo).toHaveBeenCalledWith(expect.stringContaining('forked'));
    });

    it('restarts prompts when user declines summary', async () => {
      let selectIdx = 0;
      // First pass: forked (1 select), second pass: basic, inherit (2 selects)
      const selectAnswers = ['forked', 'basic', 'inherit'];
      mockSelect.mockImplementation(async () => selectAnswers[selectIdx++]);

      let inputIdx = 0;
      // First pass: 6 inputs; second pass: 6 inputs
      const inputAnswers = ['', '', '', '', '', '', '', '', '', '', '', ''];
      mockInput.mockImplementation(async () => inputAnswers[inputIdx++]);

      let confirmIdx = 0;
      // First pass: hooks: no, minimal: no, addMetadata: no, Proceed: NO (decline)
      // Second pass: hooks: no, minimal: no, addMetadata: no, Proceed: YES
      const confirmAnswers = [false, false, false, false, false, false, false, true];
      mockConfirm.mockImplementation(async () => confirmAnswers[confirmIdx++]);

      mockScaffold.mockResolvedValueOnce({
        path: '/tmp/test-skill',
        files: ['/tmp/test-skill/SKILL.md'],
      });

      const options: CliScaffoldOptions = { interactive: true };
      await runInteractiveScaffold('test-skill', options);

      // Should have gone through prompts twice
      // First time: 1 select (template) + second time: 2 selects (template, context)
      expect(mockSelect.mock.calls.length).toBe(3);
    });

    it('respects --personal flag for scope', async () => {
      let selectIdx = 0;
      const selectAnswers = ['basic', 'inherit'];
      mockSelect.mockImplementation(async () => selectAnswers[selectIdx++]);
      mockInput.mockResolvedValue('');

      let confirmIdx = 0;
      // hooks: no, minimal: no, addMetadata: no, Proceed: yes
      const confirmAnswers = [false, false, false, true];
      mockConfirm.mockImplementation(async () => confirmAnswers[confirmIdx++]);

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
      const selectAnswers = ['basic', 'inherit'];
      mockSelect.mockImplementation(async () => selectAnswers[selectIdx++]);
      mockInput.mockResolvedValue('');

      let confirmIdx = 0;
      // hooks: no, minimal: no, addMetadata: no, Proceed: yes
      const confirmAnswers = [false, false, false, true];
      mockConfirm.mockImplementation(async () => confirmAnswers[confirmIdx++]);

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

  describe('formatSummary()', () => {
    it('always includes Name and Template', () => {
      const summary = formatSummary('my-skill', { templateType: 'basic' });

      expect(summary).toContain('Scaffold configuration:');
      expect(summary).toContain('Name');
      expect(summary).toContain('my-skill');
      expect(summary).toContain('Template');
      expect(summary).toContain('basic');
    });

    it('defaults Template to basic when templateType is undefined', () => {
      const summary = formatSummary('my-skill', {});

      expect(summary).toContain('Template');
      expect(summary).toContain('basic');
    });

    it('includes only set fields — minimal config shows only Name and Template', () => {
      const summary = formatSummary('test-skill', { templateType: 'basic' });
      const lines = summary.split('\n');

      // Header + Name + Template = 3 lines
      expect(lines).toHaveLength(3);
    });

    it('shows Context only when fork', () => {
      const summary = formatSummary('my-skill', { templateType: 'basic', context: 'fork' });

      expect(summary).toContain('Context');
      expect(summary).toContain('fork');
    });

    it('does not show Context when not set', () => {
      const summary = formatSummary('my-skill', { templateType: 'basic' });

      expect(summary).not.toContain('Context');
    });

    it('shows Agent when set', () => {
      const summary = formatSummary('my-skill', { templateType: 'basic', agent: 'Explore' });

      expect(summary).toContain('Agent');
      expect(summary).toContain('Explore');
    });

    it('shows License when set', () => {
      const summary = formatSummary('my-skill', {
        templateType: 'basic',
        license: 'MIT',
      });

      expect(summary).toContain('License');
      expect(summary).toContain('MIT');
    });

    it('shows Compatibility when set', () => {
      const summary = formatSummary('my-skill', {
        templateType: 'basic',
        compatibility: 'claude-code>=2.1',
      });

      expect(summary).toContain('Compatibility');
      expect(summary).toContain('claude-code>=2.1');
    });

    it('shows Metadata when set', () => {
      const summary = formatSummary('my-skill', {
        templateType: 'basic',
        metadata: { author: 'team', version: '1.0' },
      });

      expect(summary).toContain('Metadata');
      expect(summary).toContain('author=team');
    });

    it('shows Hooks only when includeHooks is true', () => {
      const summaryWith = formatSummary('my-skill', {
        templateType: 'basic',
        includeHooks: true,
      });
      const summaryWithout = formatSummary('my-skill', { templateType: 'basic' });

      expect(summaryWith).toContain('Hooks');
      expect(summaryWith).toContain('yes');
      expect(summaryWithout).not.toContain('Hooks');
    });

    it('shows Minimal only when minimal is true', () => {
      const summaryWith = formatSummary('my-skill', {
        templateType: 'basic',
        minimal: true,
      });
      const summaryWithout = formatSummary('my-skill', { templateType: 'basic' });

      expect(summaryWith).toContain('Minimal');
      expect(summaryWith).toContain('yes');
      expect(summaryWithout).not.toContain('Minimal');
    });

    it('shows Description when provided', () => {
      const summary = formatSummary('my-skill', { templateType: 'basic' }, 'A useful skill');

      expect(summary).toContain('Description');
      expect(summary).toContain('A useful skill');
    });

    it('does not show Description when undefined', () => {
      const summary = formatSummary('my-skill', { templateType: 'basic' });

      expect(summary).not.toContain('Description');
    });

    it('shows Argument hint when set', () => {
      const summary = formatSummary('my-skill', {
        templateType: 'basic',
        argumentHint: '<query> [--deep]',
      });

      expect(summary).toContain('Argument hint');
      expect(summary).toContain('<query> [--deep]');
    });

    it('shows Allowed tools when provided', () => {
      const summary = formatSummary('my-skill', { templateType: 'basic' }, undefined, [
        'Read',
        'Write',
        'Bash',
      ]);

      expect(summary).toContain('Allowed tools');
      expect(summary).toContain('Read, Write, Bash');
    });

    it('does not show Allowed tools when empty array', () => {
      const summary = formatSummary('my-skill', { templateType: 'basic' }, undefined, []);

      expect(summary).not.toContain('Allowed tools');
    });

    it('all optional fields appear when set', () => {
      const summary = formatSummary(
        'my-skill',
        {
          templateType: 'forked',
          context: 'fork',
          agent: 'code-reviewer',
          includeHooks: true,
          minimal: true,
          argumentHint: '<file>',
          license: 'MIT',
          compatibility: 'claude-code>=2.1',
          metadata: { author: 'team' },
        },
        'Reviews code',
        ['Read', 'Glob', 'Grep']
      );

      expect(summary).toContain('Name');
      expect(summary).toContain('Template');
      expect(summary).toContain('Context');
      expect(summary).toContain('Agent');
      expect(summary).toContain('License');
      expect(summary).toContain('Compatibility');
      expect(summary).toContain('Metadata');
      expect(summary).toContain('Hooks');
      expect(summary).toContain('Minimal');
      expect(summary).toContain('Description');
      expect(summary).toContain('Argument hint');
      expect(summary).toContain('Allowed tools');
    });

    it('key-value pairs are properly aligned', () => {
      const summary = formatSummary(
        'my-skill',
        {
          templateType: 'forked',
          agent: 'code-reviewer',
          license: 'MIT',
          compatibility: 'claude-code>=2.1',
          argumentHint: '<file>',
        },
        'Reviews code',
        ['Read', 'Grep']
      );

      // All value columns should start at the same position
      const lines = summary.split('\n').slice(1); // Skip header line
      const valueStarts = lines.map((line) => {
        // Find the position after the label + colon + padding + two spaces
        const match = line.match(/^ {2}\S.*?:\s+/);
        return match ? match[0].length : -1;
      });

      // All lines should have values starting at the same column
      const uniqueStarts = new Set(valueStarts.filter((s) => s > 0));
      expect(uniqueStarts.size).toBe(1);
    });
  });
});
