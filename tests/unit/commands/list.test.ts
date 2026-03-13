/**
 * Unit tests for the list CLI command
 *
 * Covers:
 * - handleList: scope/depth validation, API call, JSON/quiet/normal output, depthLimitReached warning
 * - formatNormalOutput: empty skills, project/personal/custom scopes, recursive grouping, skill entries
 * - formatProjectSkillsGrouped: grouping by location, root vs nested
 * - handleError: FileSystemError, AsmError, generic Error, non-Error (quiet vs non-quiet)
 * - FEAT-018 help text
 */

import { Command } from 'commander';
import { vi } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('../../../src/api', () => ({ list: vi.fn() }));
vi.mock('../../../src/utils/output', () => ({
  displayError: vi.fn(),
  displayWarning: vi.fn(),
}));

// Custom error to capture process.exit calls
class ProcessExitError extends Error {
  constructor(public code: number) {
    super(`process.exit(${code})`);
    this.name = 'ProcessExitError';
  }
}

// Helper to create a fresh commander program with list command registered
async function createTestProgram(): Promise<Command> {
  const { registerListCommand } = await import('../../../src/commands/list');
  const program = new Command();
  program.exitOverride();
  registerListCommand(program);
  return program;
}

describe('list CLI command', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;
  let consoleOutput: string[];
  let mockList: ReturnType<typeof vi.fn>;
  let mockDisplayError: ReturnType<typeof vi.fn>;
  let mockDisplayWarning: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    consoleOutput = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalProcessExit = process.exit;
    console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
    console.error = (...args: unknown[]) => consoleOutput.push(args.join(' '));
    process.exit = ((code?: number) => {
      throw new ProcessExitError(code ?? 0);
    }) as typeof process.exit;

    // Get mocked modules
    const api = await import('../../../src/api');
    const outputUtils = await import('../../../src/utils/output');
    mockList = api.list as ReturnType<typeof vi.fn>;
    mockDisplayError = outputUtils.displayError as ReturnType<typeof vi.fn>;
    mockDisplayWarning = outputUtils.displayWarning as ReturnType<typeof vi.fn>;

    // Reset mocks
    mockList.mockReset();
    mockDisplayError.mockReset();
    mockDisplayWarning.mockReset();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  // ── handleList: scope validation ──────────────────────────────────────

  describe('scope validation', () => {
    it('rejects invalid scope with displayError in normal mode', async () => {
      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'list', '--scope', 'invalid'])
      ).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith(
        'Invalid scope',
        expect.stringContaining('all, project, personal')
      );
    });

    it('rejects invalid scope with console.log in quiet mode', async () => {
      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'list', '--scope', 'invalid', '--quiet'])
      ).rejects.toThrow(ProcessExitError);

      expect(consoleOutput.some((line) => line.includes('FAIL: Invalid scope: invalid'))).toBe(
        true
      );
      expect(mockDisplayError).not.toHaveBeenCalled();
    });

    it('accepts "all" scope', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--scope', 'all']);

      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ scope: 'all' }));
    });

    it('accepts "project" scope', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--scope', 'project']);

      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ scope: 'project' }));
    });

    it('accepts "personal" scope', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--scope', 'personal']);

      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ scope: 'personal' }));
    });

    it('defaults scope to "all" when not specified', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ scope: 'all' }));
    });
  });

  // ── handleList: depth validation ──────────────────────────────────────

  describe('depth validation', () => {
    it('rejects NaN depth with displayError in normal mode', async () => {
      const program = await createTestProgram();
      await expect(program.parseAsync(['node', 'asm', 'list', '--depth', 'abc'])).rejects.toThrow(
        ProcessExitError
      );

      expect(mockDisplayError).toHaveBeenCalledWith(
        'Invalid depth',
        'Depth must be a number between 0 and 10'
      );
    });

    it('rejects negative depth', async () => {
      const program = await createTestProgram();
      await expect(program.parseAsync(['node', 'asm', 'list', '--depth', '-1'])).rejects.toThrow(
        ProcessExitError
      );

      expect(mockDisplayError).toHaveBeenCalledWith('Invalid depth', expect.any(String));
    });

    it('rejects depth > 10', async () => {
      const program = await createTestProgram();
      await expect(program.parseAsync(['node', 'asm', 'list', '--depth', '11'])).rejects.toThrow(
        ProcessExitError
      );

      expect(mockDisplayError).toHaveBeenCalledWith('Invalid depth', expect.any(String));
    });

    it('rejects invalid depth in quiet mode with console.log', async () => {
      const program = await createTestProgram();
      await expect(
        program.parseAsync(['node', 'asm', 'list', '--depth', 'xyz', '--quiet'])
      ).rejects.toThrow(ProcessExitError);

      expect(
        consoleOutput.some((line) =>
          line.includes('FAIL: Invalid depth: must be a number between 0 and 10')
        )
      ).toBe(true);
      expect(mockDisplayError).not.toHaveBeenCalled();
    });

    it('accepts depth 0', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--depth', '0']);

      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ depth: 0 }));
    });

    it('accepts depth 10', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--depth', '10']);

      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ depth: 10 }));
    });

    it('defaults depth to 3', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ depth: 3 }));
    });
  });

  // ── handleList: API call ──────────────────────────────────────────────

  describe('API call', () => {
    it('passes recursive flag to API', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--recursive']);

      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ recursive: true }));
    });

    it('passes all options through correctly', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'list',
        '--scope',
        'project',
        '--recursive',
        '--depth',
        '5',
      ]);

      expect(mockList).toHaveBeenCalledWith({
        scope: 'project',
        recursive: true,
        depth: 5,
      });
    });
  });

  // ── handleList: JSON output ───────────────────────────────────────────

  describe('JSON output mode', () => {
    it('outputs skills array as JSON when not recursive', async () => {
      const skills = [
        { name: 'skill-a', path: '/p', scope: 'project' as const },
        { name: 'skill-b', path: '/p2', scope: 'personal' as const },
      ];
      mockList.mockResolvedValue({ skills });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--json']);

      const jsonOutput = consoleOutput.join('\n');
      const parsed = JSON.parse(jsonOutput);
      expect(parsed).toEqual(skills);
    });

    it('outputs object with skills and depthLimitReached when recursive', async () => {
      const skills = [{ name: 'skill-a', path: '/p', scope: 'project' as const }];
      mockList.mockResolvedValue({ skills, depthLimitReached: true });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--json', '--recursive']);

      const jsonOutput = consoleOutput.join('\n');
      const parsed = JSON.parse(jsonOutput);
      expect(parsed).toEqual({ skills, depthLimitReached: true });
    });

    it('outputs object with depthLimitReached false when recursive', async () => {
      const skills = [{ name: 'skill-a', path: '/p', scope: 'project' as const }];
      mockList.mockResolvedValue({ skills, depthLimitReached: false });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--json', '--recursive']);

      const jsonOutput = consoleOutput.join('\n');
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.depthLimitReached).toBe(false);
    });
  });

  // ── handleList: quiet output ──────────────────────────────────────────

  describe('quiet output mode', () => {
    it('prints only skill names, one per line', async () => {
      const skills = [
        { name: 'alpha', path: '/p', scope: 'project' as const },
        { name: 'beta', path: '/p2', scope: 'personal' as const },
        { name: 'gamma', path: '/p3', scope: 'custom' as const },
      ];
      mockList.mockResolvedValue({ skills });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--quiet']);

      expect(consoleOutput).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('prints nothing when no skills found', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--quiet']);

      expect(consoleOutput).toEqual([]);
    });
  });

  // ── handleList: normal output (formatNormalOutput) ────────────────────

  describe('normal output mode', () => {
    it('shows getting started message when no skills installed', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No skills installed.');
      expect(output).toContain('Get started:');
      expect(output).toContain('asm scaffold my-skill');
      expect(output).toContain('asm install <package>');
    });

    it('shows count header for single skill', async () => {
      mockList.mockResolvedValue({
        skills: [{ name: 'one-skill', path: '/p', scope: 'project' as const }],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      expect(consoleOutput.some((line) => line.includes('Found 1 installed skill:'))).toBe(true);
    });

    it('shows count header for multiple skills', async () => {
      mockList.mockResolvedValue({
        skills: [
          { name: 'a', path: '/p', scope: 'project' as const },
          { name: 'b', path: '/p2', scope: 'personal' as const },
        ],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      expect(consoleOutput.some((line) => line.includes('Found 2 installed skills:'))).toBe(true);
    });

    it('displays project skills under correct heading', async () => {
      mockList.mockResolvedValue({
        skills: [{ name: 'proj-skill', path: '/p', scope: 'project' as const }],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Project skills (.claude/skills/):');
      expect(output).toContain('  proj-skill');
    });

    it('displays personal skills under correct heading', async () => {
      mockList.mockResolvedValue({
        skills: [{ name: 'pers-skill', path: '/p', scope: 'personal' as const }],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Personal skills (~/.claude/skills/):');
      expect(output).toContain('  pers-skill');
    });

    it('displays custom skills under correct heading', async () => {
      mockList.mockResolvedValue({
        skills: [{ name: 'cust-skill', path: '/p', scope: 'custom' as const }],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Custom path skills:');
      expect(output).toContain('  cust-skill');
    });

    it('displays all three scope sections when skills from each exist', async () => {
      mockList.mockResolvedValue({
        skills: [
          { name: 'proj', path: '/p1', scope: 'project' as const },
          { name: 'pers', path: '/p2', scope: 'personal' as const },
          { name: 'cust', path: '/p3', scope: 'custom' as const },
        ],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Project skills');
      expect(output).toContain('Personal skills');
      expect(output).toContain('Custom path skills');
    });

    it('shows version when present', async () => {
      mockList.mockResolvedValue({
        skills: [{ name: 'versioned', path: '/p', scope: 'project' as const, version: '2.1.0' }],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      expect(consoleOutput.some((line) => line.includes('versioned (v2.1.0)'))).toBe(true);
    });

    it('does not show version parentheses when version is absent', async () => {
      mockList.mockResolvedValue({
        skills: [{ name: 'no-ver', path: '/p', scope: 'project' as const }],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      const skillLine = consoleOutput.find((line) => line.includes('no-ver'));
      expect(skillLine).toBeDefined();
      expect(skillLine).not.toContain('(v');
    });

    it('shows description when present', async () => {
      mockList.mockResolvedValue({
        skills: [
          {
            name: 'described',
            path: '/p',
            scope: 'project' as const,
            description: 'A helpful skill',
          },
        ],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      expect(consoleOutput.some((line) => line.includes('A helpful skill'))).toBe(true);
    });

    it('truncates descriptions longer than 60 characters', async () => {
      const longDesc = 'A'.repeat(70);
      mockList.mockResolvedValue({
        skills: [
          {
            name: 'long-desc',
            path: '/p',
            scope: 'project' as const,
            description: longDesc,
          },
        ],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      const descLine = consoleOutput.find((line) => line.includes('AAA'));
      expect(descLine).toBeDefined();
      expect(descLine!).toContain('...');
      // Truncated to 57 chars + '...' = 60
      expect(descLine!.trim().length).toBe(60);
    });

    it('does not truncate descriptions at exactly 60 characters', async () => {
      const exactDesc = 'B'.repeat(60);
      mockList.mockResolvedValue({
        skills: [
          {
            name: 'exact-desc',
            path: '/p',
            scope: 'project' as const,
            description: exactDesc,
          },
        ],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      const descLine = consoleOutput.find((line) => line.includes('BBB'));
      expect(descLine).toBeDefined();
      expect(descLine!).not.toContain('...');
    });
  });

  // ── handleList: recursive mode with grouped project skills ────────────

  describe('recursive mode grouping', () => {
    it('groups project skills by location in recursive mode', async () => {
      mockList.mockResolvedValue({
        skills: [
          {
            name: 'root-skill',
            path: '/p1',
            scope: 'project' as const,
          },
          {
            name: 'nested-skill',
            path: '/p2',
            scope: 'project' as const,
            location: 'packages/api/.claude/skills/nested-skill',
          },
        ],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--recursive']);

      const output = consoleOutput.join('\n');
      // Root skills (no location) go to .claude/skills group
      expect(output).toContain('Project skills (.claude/skills/):');
      // Nested skills go to their location group
      expect(output).toContain('Project skills (packages/api/.claude/skills/):');
    });

    it('shows root group before nested groups', async () => {
      mockList.mockResolvedValue({
        skills: [
          {
            name: 'nested-first',
            path: '/p1',
            scope: 'project' as const,
            location: 'aaa/.claude/skills/nested-first',
          },
          {
            name: 'root-skill',
            path: '/p2',
            scope: 'project' as const,
          },
        ],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--recursive']);

      const output = consoleOutput.join('\n');
      const rootIndex = output.indexOf('Project skills (.claude/skills/):');
      const nestedIndex = output.indexOf('Project skills (aaa/.claude/skills/):');
      expect(rootIndex).toBeLessThan(nestedIndex);
    });

    it('does not use grouped format for project skills when not recursive', async () => {
      mockList.mockResolvedValue({
        skills: [{ name: 'proj-skill', path: '/p', scope: 'project' as const }],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Project skills (.claude/skills/):');
      // Should not have grouped format
    });

    it('groups multiple skills under the same nested location', async () => {
      mockList.mockResolvedValue({
        skills: [
          {
            name: 'skill-a',
            path: '/p1',
            scope: 'project' as const,
            location: 'packages/ui/.claude/skills/skill-a',
          },
          {
            name: 'skill-b',
            path: '/p2',
            scope: 'project' as const,
            location: 'packages/ui/.claude/skills/skill-b',
          },
        ],
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--recursive']);

      const output = consoleOutput.join('\n');
      // Both skills should appear under the same group
      const groupHeader = 'Project skills (packages/ui/.claude/skills/):';
      expect(output).toContain(groupHeader);
      expect(output).toContain('  skill-a');
      expect(output).toContain('  skill-b');
    });
  });

  // ── handleList: depthLimitReached warning ─────────────────────────────

  describe('depth limit warning', () => {
    it('displays warning when depthLimitReached is true in normal mode', async () => {
      mockList.mockResolvedValue({
        skills: [{ name: 's', path: '/p', scope: 'project' as const }],
        depthLimitReached: true,
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      expect(mockDisplayWarning).toHaveBeenCalledWith(expect.stringContaining('depth limit'));
      expect(consoleOutput.some((line) => line.includes('--depth 4'))).toBe(true);
    });

    it('does not display warning when depthLimitReached is false', async () => {
      mockList.mockResolvedValue({
        skills: [{ name: 's', path: '/p', scope: 'project' as const }],
        depthLimitReached: false,
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list']);

      expect(mockDisplayWarning).not.toHaveBeenCalled();
    });

    it('does not display warning in JSON mode even when depthLimitReached', async () => {
      mockList.mockResolvedValue({
        skills: [],
        depthLimitReached: true,
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--json']);

      expect(mockDisplayWarning).not.toHaveBeenCalled();
    });

    it('does not display warning in quiet mode even when depthLimitReached', async () => {
      mockList.mockResolvedValue({
        skills: [],
        depthLimitReached: true,
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--quiet']);

      expect(mockDisplayWarning).not.toHaveBeenCalled();
    });

    it('suggests correct incremented depth in warning', async () => {
      mockList.mockResolvedValue({
        skills: [{ name: 's', path: '/p', scope: 'project' as const }],
        depthLimitReached: true,
      });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'list', '--depth', '7']);

      expect(consoleOutput.some((line) => line.includes('--depth 8'))).toBe(true);
    });
  });

  // ── handleError ───────────────────────────────────────────────────────

  describe('error handling', () => {
    it('handles FileSystemError in normal mode', async () => {
      const { FileSystemError } = await import('../../../src/errors');
      mockList.mockRejectedValue(new FileSystemError('Permission denied', '/some/path'));

      const program = await createTestProgram();
      await expect(program.parseAsync(['node', 'asm', 'list'])).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('File system error', 'Permission denied');
    });

    it('handles FileSystemError in quiet mode', async () => {
      const { FileSystemError } = await import('../../../src/errors');
      mockList.mockRejectedValue(new FileSystemError('Permission denied', '/some/path'));

      const program = await createTestProgram();
      await expect(program.parseAsync(['node', 'asm', 'list', '--quiet'])).rejects.toThrow(
        ProcessExitError
      );

      expect(consoleOutput.some((line) => line.includes('FAIL: Permission denied'))).toBe(true);
      expect(mockDisplayError).not.toHaveBeenCalled();
    });

    it('handles AsmError in normal mode', async () => {
      const { AsmError } = await import('../../../src/errors');
      mockList.mockRejectedValue(new AsmError('Something went wrong'));

      const program = await createTestProgram();
      await expect(program.parseAsync(['node', 'asm', 'list'])).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('Something went wrong');
    });

    it('handles AsmError in quiet mode', async () => {
      const { AsmError } = await import('../../../src/errors');
      mockList.mockRejectedValue(new AsmError('Something went wrong'));

      const program = await createTestProgram();
      await expect(program.parseAsync(['node', 'asm', 'list', '--quiet'])).rejects.toThrow(
        ProcessExitError
      );

      expect(consoleOutput.some((line) => line.includes('FAIL: Something went wrong'))).toBe(true);
      expect(mockDisplayError).not.toHaveBeenCalled();
    });

    it('handles generic Error in normal mode', async () => {
      mockList.mockRejectedValue(new Error('Unexpected failure'));

      const program = await createTestProgram();
      await expect(program.parseAsync(['node', 'asm', 'list'])).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('List failed', 'Unexpected failure');
    });

    it('handles generic Error in quiet mode', async () => {
      mockList.mockRejectedValue(new Error('Unexpected failure'));

      const program = await createTestProgram();
      await expect(program.parseAsync(['node', 'asm', 'list', '--quiet'])).rejects.toThrow(
        ProcessExitError
      );

      expect(consoleOutput.some((line) => line.includes('FAIL: Unexpected failure'))).toBe(true);
      expect(mockDisplayError).not.toHaveBeenCalled();
    });

    it('handles non-Error thrown value in normal mode', async () => {
      mockList.mockRejectedValue('string error');

      const program = await createTestProgram();
      await expect(program.parseAsync(['node', 'asm', 'list'])).rejects.toThrow(ProcessExitError);

      expect(mockDisplayError).toHaveBeenCalledWith('An unexpected error occurred', 'string error');
    });

    it('handles non-Error thrown value in quiet mode', async () => {
      mockList.mockRejectedValue('string error');

      const program = await createTestProgram();
      await expect(program.parseAsync(['node', 'asm', 'list', '--quiet'])).rejects.toThrow(
        ProcessExitError
      );

      expect(consoleOutput.some((line) => line.includes('FAIL: string error'))).toBe(true);
      expect(mockDisplayError).not.toHaveBeenCalled();
    });
  });

  // ── FEAT-018 help text ────────────────────────────────────────────────

  describe('FEAT-018 help text', () => {
    it('help text includes the skills menu note', async () => {
      const { LIST_SKILLS_NOTE } = await import('../../../src/commands/list');
      const program = await createTestProgram();
      const listCmd = program.commands.find((cmd) => cmd.name() === 'list');
      if (!listCmd) throw new Error('list command not found');
      let helpText = '';
      listCmd.configureOutput({ writeOut: (str: string) => (helpText += str) });
      try {
        await program.parseAsync(['node', 'asm', 'list', '--help']);
      } catch {
        // commander throws on --help with exitOverride
      }

      expect(helpText).toContain(LIST_SKILLS_NOTE);
    });
  });

  // ── ls alias ──────────────────────────────────────────────────────────

  describe('ls alias', () => {
    it('works via the "ls" alias', async () => {
      mockList.mockResolvedValue({ skills: [] });
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'ls']);

      expect(mockList).toHaveBeenCalled();
    });
  });
});
