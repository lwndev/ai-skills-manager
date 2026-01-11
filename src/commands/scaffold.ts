import { Command } from 'commander';
import { scaffold } from '../api';
import { validateDescription } from '../validators';
import { AsmError, ValidationError, FileSystemError, SecurityError } from '../errors';
import type { ApiScope } from '../types/api';
import * as output from '../utils/output';

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
    .addHelpText(
      'after',
      `
Examples:
  $ asm scaffold my-skill
  $ asm scaffold my-skill --description "A helpful skill"
  $ asm scaffold my-skill --project --description "Project-specific skill"
  $ asm scaffold my-skill --personal --description "Personal skill"
  $ asm scaffold my-skill --output ./custom/path
  $ asm scaffold my-skill --allowed-tools "Read,Write,Bash"
  $ asm scaffold my-skill --force

Note:
  By default, skills are created in .claude/skills/ (project scope).
  Use --personal to create in ~/.claude/skills/ (user scope).
  Use --output to specify a custom directory.`
    )
    .action(async (name: string, options: CliScaffoldOptions) => {
      try {
        await handleScaffold(name, options);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
    });
}

interface CliScaffoldOptions {
  description?: string;
  output?: string;
  project?: boolean;
  personal?: boolean;
  allowedTools?: string;
  force?: boolean;
}

async function handleScaffold(name: string, options: CliScaffoldOptions): Promise<void> {
  // Validate description if provided
  if (options.description) {
    const descValidation = validateDescription(options.description);
    if (!descValidation.valid) {
      throw new ValidationError(descValidation.error || 'Invalid description', [
        { code: 'INVALID_DESCRIPTION', message: descValidation.error || 'Invalid description' },
      ]);
    }
  }

  // Parse allowed tools from comma-separated string
  let allowedTools: string[] | undefined;
  if (options.allowedTools) {
    allowedTools = options.allowedTools
      .split(',')
      .map((tool) => tool.trim())
      .filter((tool) => tool.length > 0);

    if (allowedTools.length === 0) {
      throw new ValidationError('Allowed tools list cannot be empty', [
        { code: 'EMPTY_TOOLS_LIST', message: 'Allowed tools list cannot be empty' },
      ]);
    }
  }

  // Map CLI options to API scope
  const scope: ApiScope | undefined = options.personal
    ? 'personal'
    : options.project
      ? 'project'
      : undefined;

  // Call the API function
  const result = await scaffold({
    name,
    description: options.description,
    allowedTools,
    output: options.output,
    scope,
    force: options.force,
  });

  // Display success message
  output.displayCreatedFiles(result.path, result.files);
  output.displayNextSteps(result.path, name);
}

function handleError(error: unknown): void {
  if (error instanceof ValidationError) {
    output.displayValidationError('input', error.message);
  } else if (error instanceof SecurityError) {
    output.displayError('Security error', error.message);
  } else if (error instanceof FileSystemError) {
    output.displayError('File system error', error.message);
  } else if (error instanceof AsmError) {
    output.displayError(error.message);
  } else if (error instanceof Error) {
    output.displayError('Unexpected error', error.message);
  } else {
    output.displayError('An unexpected error occurred', String(error));
  }
}
