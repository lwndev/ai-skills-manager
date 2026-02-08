/**
 * Unit tests for the package CLI command help text (FEAT-018 Phase 3)
 */

import { Command } from 'commander';

async function createTestProgram(): Promise<Command> {
  const { registerPackageCommand } = await import('../../../src/commands/package');
  const program = new Command();
  program.exitOverride();
  registerPackageCommand(program);
  return program;
}

describe('package CLI command', () => {
  describe('FEAT-018 help text', () => {
    it('help text includes the plugin distribution note', async () => {
      const { PACKAGE_DISTRIBUTION_NOTE } = await import('../../../src/commands/package');
      const program = await createTestProgram();
      const packageCmd = program.commands.find((cmd) => cmd.name() === 'package')!;
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
});
