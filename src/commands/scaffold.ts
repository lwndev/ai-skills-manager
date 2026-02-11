import { Command } from 'commander';
import { scaffold } from '../api';
import { validateDescription } from '../validators';
import { AsmError, ValidationError, FileSystemError, SecurityError } from '../errors';
import type { ApiScope, ScaffoldTemplateType, ScaffoldTemplateOptions } from '../types/api';
import * as output from '../utils/output';

/** FEAT-018: Skills auto-load note for help text */
export const SCAFFOLD_AUTOLOAD_NOTE =
  'Skills auto-load from .claude/skills/ directories and appear as slash\n  commands in Claude Code.';

const VALID_TEMPLATE_TYPES: ScaffoldTemplateType[] = ['basic', 'forked', 'with-hooks', 'internal'];

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
    .option('-t, --template <type>', 'Template variant (basic, forked, with-hooks, internal)')
    .option('--context <context>', 'Set context in frontmatter (fork)')
    .option('--agent <name>', 'Set agent field in frontmatter')
    .option('--no-user-invocable', 'Set user-invocable: false in frontmatter')
    .option('--hooks', 'Include commented hook examples in frontmatter')
    .option('--minimal', 'Generate shorter templates without educational guidance text')
    .option('--argument-hint <hint>', 'Set argument hint for skill invocation')
    .option('--license <license>', 'Set license (e.g., MIT, Apache-2.0)')
    .option('--compatibility <requirements>', 'Set environment compatibility requirements')
    .option('--metadata <pairs...>', 'Set metadata key=value pairs (e.g., author=org version=1.0)')
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
  $ asm scaffold my-skill --minimal

Template options:
  $ asm scaffold my-skill --template forked
  $ asm scaffold my-skill --template with-hooks
  $ asm scaffold my-skill --template internal
  $ asm scaffold my-skill --context fork
  $ asm scaffold my-skill --agent Explore
  $ asm scaffold my-skill --no-user-invocable
  $ asm scaffold my-skill --hooks
  $ asm scaffold my-skill --template basic --context fork --hooks

Spec and field options:
  $ asm scaffold search-helper --template forked --argument-hint "<query> [--deep]"
  $ asm scaffold my-skill --license MIT
  $ asm scaffold my-skill --compatibility "Requires git, docker"
  $ asm scaffold my-skill --metadata author=my-org version=1.0

Note:
  By default, skills are created in .claude/skills/ (project scope).
  Use --personal to create in ~/.claude/skills/ (user scope).
  Use --output to specify a custom directory.
  ${SCAFFOLD_AUTOLOAD_NOTE}

Template types:
  basic       - Default template with general guidance
  forked      - For skills running in isolated (forked) context
  with-hooks  - Template demonstrating hook configuration
  internal    - For non-user-invocable helper skills

Minimal mode:
  --minimal   Generate shorter templates without educational guidance text.
              Works with all template types.

Flags can be combined with templates. Explicit flags override template defaults.`
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
  template?: string;
  context?: string;
  agent?: string;
  userInvocable?: boolean;
  hooks?: boolean;
  minimal?: boolean;
  argumentHint?: string;
  license?: string;
  compatibility?: string;
  metadata?: string[];
}

/**
 * Validates template type against allowed values.
 */
function validateTemplateType(template: string): ScaffoldTemplateType {
  if (!VALID_TEMPLATE_TYPES.includes(template as ScaffoldTemplateType)) {
    throw new ValidationError(
      `Invalid template type: "${template}". Valid types are: ${VALID_TEMPLATE_TYPES.join(', ')}`,
      [
        {
          code: 'INVALID_TEMPLATE_TYPE',
          message: `Invalid template type: "${template}". Valid types are: ${VALID_TEMPLATE_TYPES.join(', ')}`,
        },
      ]
    );
  }
  return template as ScaffoldTemplateType;
}

/**
 * Validates context value.
 */
function validateContext(context: string): 'fork' {
  if (context !== 'fork') {
    throw new ValidationError(`Invalid context value: "${context}". Only "fork" is supported.`, [
      {
        code: 'INVALID_CONTEXT',
        message: `Invalid context value: "${context}". Only "fork" is supported.`,
      },
    ]);
  }
  return 'fork';
}

/**
 * Validates agent value.
 */
function validateAgent(agent: string): string {
  const trimmed = agent.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Agent name cannot be empty', [
      { code: 'EMPTY_AGENT', message: 'Agent name cannot be empty' },
    ]);
  }
  return trimmed;
}

/**
 * Validates license string is non-empty and within length limit (1-100 characters).
 */
function validateLicense(license: string): string {
  const trimmed = license.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('License cannot be empty', [
      { code: 'EMPTY_LICENSE', message: 'License cannot be empty' },
    ]);
  }
  if (trimmed.length > 100) {
    throw new ValidationError(
      `License must be 100 characters or fewer, got ${trimmed.length} characters.`,
      [
        {
          code: 'LICENSE_TOO_LONG',
          message: `License must be 100 characters or fewer, got ${trimmed.length} characters.`,
        },
      ]
    );
  }
  return trimmed;
}

/**
 * Validates compatibility string length (1-500 characters).
 */
function validateCompatibility(compatibility: string): string {
  const trimmed = compatibility.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Compatibility string cannot be empty', [
      { code: 'EMPTY_COMPATIBILITY', message: 'Compatibility string cannot be empty' },
    ]);
  }
  if (trimmed.length > 500) {
    throw new ValidationError(
      `Compatibility must be 500 characters or fewer, got ${trimmed.length} characters.`,
      [
        {
          code: 'COMPATIBILITY_TOO_LONG',
          message: `Compatibility must be 500 characters or fewer, got ${trimmed.length} characters.`,
        },
      ]
    );
  }
  return trimmed;
}

/**
 * Parses metadata key=value pairs from CLI arguments.
 */
function parseMetadata(pairs: string[]): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      throw new ValidationError(`Invalid metadata format: "${pair}". Expected key=value format.`, [
        {
          code: 'INVALID_METADATA_FORMAT',
          message: `Invalid metadata format: "${pair}". Expected key=value format.`,
        },
      ]);
    }
    const key = pair.substring(0, eqIndex).trim();
    const value = pair.substring(eqIndex + 1).trim();
    if (key.length === 0) {
      throw new ValidationError('Metadata key cannot be empty', [
        { code: 'EMPTY_METADATA_KEY', message: 'Metadata key cannot be empty' },
      ]);
    }
    metadata[key] = value;
  }
  return metadata;
}

/**
 * Validates argument hint length.
 */
function validateArgumentHint(hint: string): string {
  if (hint.length > 100) {
    throw new ValidationError(
      `Argument hint must be 100 characters or fewer, got ${hint.length} characters.`,
      [
        {
          code: 'ARGUMENT_HINT_TOO_LONG',
          message: `Argument hint must be 100 characters or fewer, got ${hint.length} characters.`,
        },
      ]
    );
  }
  return hint;
}

/**
 * Builds template options from CLI flags.
 * Returns undefined if no template options were specified.
 */
function buildTemplateOptions(options: CliScaffoldOptions): ScaffoldTemplateOptions | undefined {
  const templateOptions: ScaffoldTemplateOptions = {};
  let hasOptions = false;

  // Validate and set template type
  if (options.template) {
    templateOptions.templateType = validateTemplateType(options.template);
    hasOptions = true;
  }

  // Validate and set context
  if (options.context) {
    templateOptions.context = validateContext(options.context);
    hasOptions = true;
  }

  // Validate and set agent (check for undefined/null, not just truthy, to allow validation of empty string)
  if (options.agent !== undefined && options.agent !== null) {
    templateOptions.agent = validateAgent(options.agent);
    hasOptions = true;
  }

  // Set userInvocable (commander uses --no-user-invocable which negates to false)
  // userInvocable defaults to true in commander when --no-user-invocable is not passed
  if (options.userInvocable === false) {
    templateOptions.userInvocable = false;
    hasOptions = true;
  }

  // Set includeHooks
  if (options.hooks) {
    templateOptions.includeHooks = true;
    hasOptions = true;
  }

  // Set minimal
  if (options.minimal) {
    templateOptions.minimal = true;
    hasOptions = true;
  }

  // Validate and set argument hint
  if (options.argumentHint !== undefined && options.argumentHint !== null) {
    templateOptions.argumentHint = validateArgumentHint(options.argumentHint);
    hasOptions = true;
  }

  // Validate and set license
  if (options.license !== undefined && options.license !== null) {
    templateOptions.license = validateLicense(options.license);
    hasOptions = true;
  }

  // Validate and set compatibility
  if (options.compatibility) {
    templateOptions.compatibility = validateCompatibility(options.compatibility);
    hasOptions = true;
  }

  // Parse and set metadata
  if (options.metadata && options.metadata.length > 0) {
    templateOptions.metadata = parseMetadata(options.metadata);
    hasOptions = true;
  }

  return hasOptions ? templateOptions : undefined;
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

  // Build template options from CLI flags (validates inputs)
  const template = buildTemplateOptions(options);

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
    template,
  });

  // Display success message with template info
  output.displayCreatedFiles(result.path, result.files);
  const templateType = template?.templateType ?? 'basic';
  if (template?.minimal) {
    output.displayInfo(`Using "${templateType} (minimal)" template`);
    output.displayMinimalNextSteps(result.path, name);
  } else {
    if (templateType !== 'basic') {
      output.displayInfo(`Using "${templateType}" template`);
    }
    output.displayNextSteps(result.path, name);
  }
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
