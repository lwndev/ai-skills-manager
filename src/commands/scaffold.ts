import { Command } from 'commander';
import { validateName, validateDescription } from '../validators';
import { createScaffold } from '../generators/scaffold';
import { ValidationError, UserCancelledError, FileSystemError } from '../utils/errors';
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
    .action(async (name: string, options: ScaffoldOptions) => {
      try {
        await handleScaffold(name, options);
      } catch (error) {
        handleError(error);
        process.exit(1);
      }
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

async function handleScaffold(name: string, options: ScaffoldOptions): Promise<void> {
  // Validate skill name
  const nameValidation = validateName(name);
  if (!nameValidation.valid) {
    throw new ValidationError(nameValidation.error!);
  }

  // Validate description if provided
  if (options.description) {
    const descValidation = validateDescription(options.description);
    if (!descValidation.valid) {
      throw new ValidationError(descValidation.error!);
    }
  }

  // Parse allowed tools if provided
  let allowedTools: string[] | undefined;
  if (options.allowedTools) {
    allowedTools = options.allowedTools
      .split(',')
      .map((tool) => tool.trim())
      .filter((tool) => tool.length > 0);

    if (allowedTools.length === 0) {
      throw new ValidationError('Allowed tools list cannot be empty');
    }
  }

  // Create the scaffold
  const result = await createScaffold({
    name,
    description: options.description,
    allowedTools,
    output: options.output,
    project: options.project,
    personal: options.personal,
    force: options.force,
  });

  // Handle the result
  if (!result.success) {
    if (result.error === 'Operation cancelled by user') {
      throw new UserCancelledError();
    }
    throw new FileSystemError(result.error || 'Unknown error occurred');
  }

  // Display success message
  output.displayCreatedFiles(result.skillPath, result.filesCreated);
  output.displayNextSteps(result.skillPath, name);
}

function handleError(error: unknown): void {
  if (error instanceof ValidationError) {
    output.displayValidationError('input', error.message);
  } else if (error instanceof UserCancelledError) {
    output.displayError(error.message);
  } else if (error instanceof FileSystemError) {
    output.displayError('File system error', error.message);
  } else if (error instanceof Error) {
    output.displayError('Unexpected error', error.message);
  } else {
    output.displayError('An unexpected error occurred', String(error));
  }
}
