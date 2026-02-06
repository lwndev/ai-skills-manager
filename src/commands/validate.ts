/**
 * Validate command implementation
 *
 * Validates Claude Skill structure and metadata against the official Anthropic specification.
 *
 * Uses the public API's validate() function with `detailed: true` to get check-by-check
 * results for CLI output.
 */

import { Command } from 'commander';
import { validate } from '../api/validate';
import { formatValidationOutput } from '../formatters/validate-formatter';
import { AsmError, FileSystemError } from '../errors';
import * as output from '../utils/output';
import { resolveAsmrConfig } from '../config/asmr';
import {
  createAsmrContext,
  showBannerIfEnabled,
  withSpinner,
  showSuccess,
} from '../utils/asmr-output';

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
  const { quiet, json } = options;

  const { config: asmrConfig } = resolveAsmrConfig();
  const asmrCtx = createAsmrContext(quiet || json ? undefined : asmrConfig);

  // Validate that path was provided
  if (!skillPath || skillPath.trim() === '') {
    throw new FileSystemError('Skill path is required', skillPath || '');
  }

  showBannerIfEnabled(asmrCtx);

  // Run validation using public API with detailed: true for check-by-check output
  const result = asmrCtx.enabled
    ? await withSpinner('validate', () => validate(skillPath, { detailed: true }), asmrCtx)
    : await validate(skillPath, { detailed: true });

  // Format output
  const formattedOutput = formatValidationOutput(result, options);
  console.log(formattedOutput);

  // Show success animation if valid
  if (result.valid && asmrCtx.enabled) {
    await showSuccess('Validation passed', asmrCtx).catch(() => {});
  }

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
