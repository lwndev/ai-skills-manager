import { Command } from 'commander';

export function registerScaffoldCommand(program: Command): void {
  program
    .command('scaffold <name>')
    .description('Create a new Claude Code skill with the required directory structure')
    .option('-d, --description <description>', 'Short description of the skill')
    .option('-o, --output <path>', 'Output directory path (overrides --project and --personal)')
    .option('-p, --project', 'Create as a project skill in .claude/skills/')
    .option('--personal', 'Create as a personal skill in ~/.claude/skills/')
    .option('-a, --allowed-tools <tools>', 'Comma-separated list of allowed tools')
    .option('-f, --force', 'Overwrite existing directory without prompting')
    .action((name: string, options: ScaffoldOptions) => {
      handleScaffold(name, options);
    });
}

interface ScaffoldOptions {
  description?: string;
  output?: string;
  project?: boolean;
  personal?: boolean;
  allowedTools?: string;
  force?: boolean;
}

function handleScaffold(name: string, options: ScaffoldOptions): void {
  // TODO: Implement scaffold logic in Phase 3-4
  console.log(`Scaffolding skill: ${name}`);
  console.log('Options:', options);
  console.log('\nNote: Full implementation coming in Phase 3-4');
}
