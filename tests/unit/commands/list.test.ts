/**
 * Unit tests for the list CLI command help text (FEAT-018 Phase 3)
 */

import { Command } from 'commander';

async function createTestProgram(): Promise<Command> {
  const { registerListCommand } = await import('../../../src/commands/list');
  const program = new Command();
  program.exitOverride();
  registerListCommand(program);
  return program;
}

describe('list CLI command', () => {
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
});
