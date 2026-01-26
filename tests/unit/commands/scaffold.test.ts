/**
 * Unit tests for the scaffold CLI command (FEAT-013 Phase 4)
 *
 * Tests the CLI option parsing, validation, and flag handling for:
 * - --template <type> option
 * - --context fork option
 * - --agent <name> option
 * - --no-user-invocable option
 * - --hooks option
 * - Flag combinations and override logic
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

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
  program.exitOverride(); // Prevent process.exit() during tests
  registerScaffoldCommand(program);
  return program;
}

describe('scaffold CLI command', () => {
  let tempDir: string;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;
  let consoleOutput: string[];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scaffold-cli-test-'));
    consoleOutput = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalProcessExit = process.exit;
    console.log = (...args: unknown[]) => consoleOutput.push(args.join(' '));
    console.error = (...args: unknown[]) => consoleOutput.push(args.join(' '));
    // Mock process.exit to throw an error instead
    process.exit = ((code?: number) => {
      throw new ProcessExitError(code ?? 0);
    }) as typeof process.exit;
  });

  afterEach(async () => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('--template option', () => {
    it('accepts basic template type', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'test-skill',
        '--output',
        tempDir,
        '--template',
        'basic',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'test-skill', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('name: test-skill');
      // Basic template should not have context or user-invocable
      expect(skillMd).not.toMatch(/^context:/m);
      expect(skillMd).not.toMatch(/^user-invocable:/m);
    });

    it('accepts forked template type', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'forked-skill',
        '--output',
        tempDir,
        '--template',
        'forked',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'forked-skill', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('context: fork');
      expect(skillMd).toContain('- Read');
      expect(skillMd).toContain('- Glob');
      expect(skillMd).toContain('- Grep');
    });

    it('accepts with-hooks template type', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'hooks-skill',
        '--output',
        tempDir,
        '--template',
        'with-hooks',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'hooks-skill', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('hooks:');
      expect(skillMd).toContain('PreToolUse:');
      expect(skillMd).toContain('PostToolUse:');
    });

    it('accepts internal template type', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'internal-skill',
        '--output',
        tempDir,
        '--template',
        'internal',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'internal-skill', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('user-invocable: false');
    });

    it('rejects invalid template type', async () => {
      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'scaffold',
          'test-skill',
          '--output',
          tempDir,
          '--template',
          'invalid-type',
        ])
      ).rejects.toThrow();

      expect(consoleOutput.some((line) => line.includes('Invalid template type'))).toBe(true);
    });

    it('shows template type in output for non-basic templates', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'forked-skill',
        '--output',
        tempDir,
        '--template',
        'forked',
      ]);

      expect(consoleOutput.some((line) => line.includes('"forked" template'))).toBe(true);
    });

    it('does not show template type in output for basic template', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'basic-skill',
        '--output',
        tempDir,
        '--template',
        'basic',
      ]);

      expect(consoleOutput.some((line) => line.includes('"basic" template'))).toBe(false);
    });
  });

  describe('--context option', () => {
    it('accepts fork context value', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'context-skill',
        '--output',
        tempDir,
        '--context',
        'fork',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'context-skill', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('context: fork');
    });

    it('rejects invalid context value', async () => {
      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'scaffold',
          'test-skill',
          '--output',
          tempDir,
          '--context',
          'invalid',
        ])
      ).rejects.toThrow();

      expect(consoleOutput.some((line) => line.includes('Invalid context value'))).toBe(true);
    });
  });

  describe('--agent option', () => {
    it('sets agent field in frontmatter', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'agent-skill',
        '--output',
        tempDir,
        '--agent',
        'Explore',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'agent-skill', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('agent: Explore');
    });

    it('accepts agent with special characters', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'agent-skill',
        '--output',
        tempDir,
        '--agent',
        'My Custom: Agent',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'agent-skill', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('agent: "My Custom: Agent"');
    });

    it('rejects empty agent value', async () => {
      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'scaffold',
          'test-skill',
          '--output',
          tempDir,
          '--agent',
          '',
        ])
      ).rejects.toThrow();

      expect(consoleOutput.some((line) => line.includes('Agent name cannot be empty'))).toBe(true);
    });

    it('rejects whitespace-only agent value', async () => {
      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'scaffold',
          'test-skill',
          '--output',
          tempDir,
          '--agent',
          '   ',
        ])
      ).rejects.toThrow();

      expect(consoleOutput.some((line) => line.includes('Agent name cannot be empty'))).toBe(true);
    });
  });

  describe('--no-user-invocable option', () => {
    it('sets user-invocable: false in frontmatter', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'helper-skill',
        '--output',
        tempDir,
        '--no-user-invocable',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'helper-skill', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('user-invocable: false');
    });

    it('does not set user-invocable when flag is not present', async () => {
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'scaffold', 'public-skill', '--output', tempDir]);

      const skillMd = await fs.readFile(path.join(tempDir, 'public-skill', 'SKILL.md'), 'utf-8');
      expect(skillMd).not.toMatch(/^user-invocable:/m);
    });
  });

  describe('--hooks option', () => {
    it('adds hooks section to frontmatter', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'hooks-skill',
        '--output',
        tempDir,
        '--hooks',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'hooks-skill', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('hooks:');
      expect(skillMd).toContain('PreToolUse:');
      expect(skillMd).toContain('PostToolUse:');
    });

    it('does not add hooks section when flag is not present', async () => {
      const program = await createTestProgram();
      await program.parseAsync(['node', 'asm', 'scaffold', 'no-hooks-skill', '--output', tempDir]);

      const skillMd = await fs.readFile(path.join(tempDir, 'no-hooks-skill', 'SKILL.md'), 'utf-8');
      const frontmatter = skillMd.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
      expect(frontmatter).not.toContain('hooks:');
    });
  });

  describe('flag combinations', () => {
    it('combines --template with --context override', async () => {
      const program = await createTestProgram();
      // Basic template with explicit fork context
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'basic-forked',
        '--output',
        tempDir,
        '--template',
        'basic',
        '--context',
        'fork',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'basic-forked', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('context: fork');
      // Should have commented allowed-tools (basic template default)
      expect(skillMd).toContain('# allowed-tools:');
    });

    it('combines --template with --agent', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'forked-explore',
        '--output',
        tempDir,
        '--template',
        'forked',
        '--agent',
        'Explore',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'forked-explore', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('context: fork');
      expect(skillMd).toContain('agent: Explore');
    });

    it('combines --template with --no-user-invocable', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'forked-internal',
        '--output',
        tempDir,
        '--template',
        'forked',
        '--no-user-invocable',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'forked-internal', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('context: fork');
      expect(skillMd).toContain('user-invocable: false');
    });

    it('combines --template with --hooks', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'internal-hooks',
        '--output',
        tempDir,
        '--template',
        'internal',
        '--hooks',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'internal-hooks', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('user-invocable: false');
      expect(skillMd).toContain('hooks:');
    });

    it('combines multiple flags without template', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'multi-flag',
        '--output',
        tempDir,
        '--context',
        'fork',
        '--agent',
        'Plan',
        '--no-user-invocable',
        '--hooks',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'multi-flag', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('context: fork');
      expect(skillMd).toContain('agent: Plan');
      expect(skillMd).toContain('user-invocable: false');
      expect(skillMd).toContain('hooks:');
    });

    it('combines all template options with other scaffold options', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'full-combo',
        '--output',
        tempDir,
        '--description',
        'A comprehensive skill',
        '--allowed-tools',
        'Read,Write,Bash',
        '--template',
        'forked',
        '--agent',
        'Explore',
        '--hooks',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'full-combo', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('name: full-combo');
      expect(skillMd).toContain('description: A comprehensive skill');
      // Custom allowed-tools override template defaults
      expect(skillMd).toContain('- Read');
      expect(skillMd).toContain('- Write');
      expect(skillMd).toContain('- Bash');
      expect(skillMd).toContain('context: fork');
      expect(skillMd).toContain('agent: Explore');
      expect(skillMd).toContain('hooks:');
    });
  });

  describe('backward compatibility', () => {
    it('produces same output when no template options are specified', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'backward-compat',
        '--output',
        tempDir,
        '--description',
        'A simple skill',
      ]);

      const skillMd = await fs.readFile(path.join(tempDir, 'backward-compat', 'SKILL.md'), 'utf-8');
      expect(skillMd).toContain('name: backward-compat');
      expect(skillMd).toContain('description: A simple skill');
      // Should not have any template-specific fields
      expect(skillMd).not.toMatch(/^context:/m);
      expect(skillMd).not.toMatch(/^agent:/m);
      expect(skillMd).not.toMatch(/^user-invocable:/m);
      const frontmatter = skillMd.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
      expect(frontmatter).not.toContain('hooks:');
    });

    it('still works with all original options', async () => {
      const program = await createTestProgram();
      await program.parseAsync([
        'node',
        'asm',
        'scaffold',
        'original-options',
        '--output',
        tempDir,
        '--description',
        'Test skill',
        '--allowed-tools',
        'Read,Write',
        '--force',
      ]);

      const skillMd = await fs.readFile(
        path.join(tempDir, 'original-options', 'SKILL.md'),
        'utf-8'
      );
      expect(skillMd).toContain('name: original-options');
      expect(skillMd).toContain('description: Test skill');
      expect(skillMd).toContain('- Read');
      expect(skillMd).toContain('- Write');
    });
  });

  describe('error messages', () => {
    it('shows clear error for invalid template type', async () => {
      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'scaffold',
          'test-skill',
          '--output',
          tempDir,
          '--template',
          'unknown',
        ])
      ).rejects.toThrow();

      const errorOutput = consoleOutput.join(' ');
      expect(errorOutput).toContain('Invalid template type');
      expect(errorOutput).toContain('unknown');
      expect(errorOutput).toContain('basic');
      expect(errorOutput).toContain('forked');
      expect(errorOutput).toContain('with-hooks');
      expect(errorOutput).toContain('internal');
    });

    it('shows clear error for invalid context value', async () => {
      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'scaffold',
          'test-skill',
          '--output',
          tempDir,
          '--context',
          'parallel',
        ])
      ).rejects.toThrow();

      const errorOutput = consoleOutput.join(' ');
      expect(errorOutput).toContain('Invalid context value');
      expect(errorOutput).toContain('parallel');
      expect(errorOutput).toContain('fork');
    });

    it('shows clear error for empty agent', async () => {
      const program = await createTestProgram();
      await expect(
        program.parseAsync([
          'node',
          'asm',
          'scaffold',
          'test-skill',
          '--output',
          tempDir,
          '--agent',
          '',
        ])
      ).rejects.toThrow();

      const errorOutput = consoleOutput.join(' ');
      expect(errorOutput).toContain('Agent name cannot be empty');
    });
  });
});
