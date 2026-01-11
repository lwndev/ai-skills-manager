/**
 * Validate command implementation
 *
 * Validates Claude Skill structure and metadata against the official Anthropic specification.
 *
 * Note: This command uses the internal validateSkill function directly rather than the
 * public API's validate() function to maintain backward-compatible CLI output format.
 * The public API returns a simplified ValidateResult with errors/warnings arrays,
 * while the CLI output shows detailed check-by-check results which requires the
 * internal ValidationResult structure.
 */

import { Command } from 'commander';
import { validateSkill } from '../generators/validate';
import { formatValidationOutput } from '../formatters/validate-formatter';
import { AsmError, FileSystemError } from '../errors';
import * as output from '../utils/output';

/**
 * Options for the validate command
 */
export interface ValidateOptions {
  /** Quiet mode - minimal output */
  quiet?: boolean;
  /** JSON output mode */
  json?: boolean;
}

/**
 * Register the validate command with the CLI program
 */
export function registerValidateCommand(program: Command): void {
  program
    .command('validate <skill-path>')
    .description('Validate a Claude Code skill against the official specification')
    .option('-q, --quiet', 'Quiet mode - show only pass/fail result')
    .option('-j, --json', 'Output validation result as JSON')
    .addHelpText(
      'after',
      `
Examples:
  $ asm validate .claude/skills/my-skill
  $ asm validate ./my-skill/SKILL.md
  $ asm validate ~/.claude/skills/my-skill --quiet
  $ asm validate ./my-skill --json

Validation Checks:
  - File existence: Verifies SKILL.md exists
  - Frontmatter validity: Checks YAML frontmatter structure
  - Required fields: Validates name and description are present
  - Allowed properties: Ensures no unexpected frontmatter keys
  - Name format: Validates hyphen-case format, max 64 chars
  - Description format: Validates no angle brackets, max 1024 chars

Exit Codes:
  0 - Skill is valid
  1 - Skill is invalid or an error occurred

Output Formats:
  Normal (default): Detailed check-by-check validation results
  --quiet: Single line pass/fail output (suitable for scripts)
  --json: Structured JSON output (suitable for CI/CD pipelines)`
    )
    .action(async (skillPath: string, options: ValidateOptions) => {
      try {
        await handleValidate(skillPath, options);
      } catch (error) {
        handleError(error, options);
        process.exit(1);
      }
    });
}

/**
 * Handle the validate command
 */
async function handleValidate(skillPath: string, options: ValidateOptions): Promise<void> {
  // Validate that path was provided
  if (!skillPath || skillPath.trim() === '') {
    throw new FileSystemError('Skill path is required', skillPath || '');
  }

  // Run validation using internal function for detailed check-by-check output
  const result = await validateSkill(skillPath);

  // Format output
  const formattedOutput = formatValidationOutput(result, options);
  console.log(formattedOutput);

  // Exit with appropriate code
  if (!result.valid) {
    process.exit(1);
  }
}

/**
 * Handle errors from the validate command
 */
function handleError(error: unknown, options: ValidateOptions): void {
  // In JSON mode, output error as JSON
  if (options.json) {
    const errorResult = {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
    console.log(JSON.stringify(errorResult, null, 2));
    return;
  }

  // In quiet mode, just output FAIL
  if (options.quiet) {
    console.log('FAIL: Error occurred');
    return;
  }

  // In normal mode, show detailed error
  if (error instanceof FileSystemError) {
    output.displayError('File system error', error.message);
  } else if (error instanceof AsmError) {
    output.displayError(error.message);
  } else if (error instanceof Error) {
    output.displayError('Validation failed', error.message);
  } else {
    output.displayError('An unexpected error occurred', String(error));
  }
}
