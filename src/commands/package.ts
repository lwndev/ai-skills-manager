/**
 * Package command implementation
 *
 * Packages a validated Claude Code skill into a distributable .skill file.
 */

import { Command } from 'commander';
import { createPackage } from '../api';
import { formatPackageProgress, formatPackageSuccess } from '../formatters/package-formatter';
import { confirmOverwrite } from '../utils/prompts';
import {
  AsmError,
  ValidationError,
  FileSystemError,
  PackageError,
  CancellationError,
} from '../errors';
import type { PackageResult } from '../types/api';
import * as output from '../utils/output';

/**
 * Exit codes for the package command
 * Per feature spec FEAT-003:
 * - 0: Package created successfully
 * - 1: Validation failed (unless --skip-validation)
 * - 2: File system error (path not found, permission denied, user cancelled)
 * - 3: Package creation error
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  VALIDATION_FAILED: 1,
  FILE_SYSTEM_ERROR: 2,
  PACKAGE_ERROR: 3,
} as const;

/**
 * Options for the package command
 */
export interface PackageCommandOptions {
  /** Output directory for the package file */
  output?: string;
  /** Force overwrite if package already exists */
  force?: boolean;
  /** Skip pre-package validation */
  skipValidation?: boolean;
  /** Suppress output (quiet mode) */
  quiet?: boolean;
}

/**
 * Register the package command with the CLI program
 */
export function registerPackageCommand(program: Command): void {
  program
    .command('package <skill-path>')
    .description('Package a Claude Code skill into a distributable .skill file')
    .option('-o, --output <path>', 'Output directory for the package file')
    .option('-f, --force', 'Overwrite existing package without prompting')
    .option('-s, --skip-validation', 'Skip pre-package validation')
    .option('-q, --quiet', 'Quiet mode - minimal output')
    .addHelpText(
      'after',
      `
Examples:
  $ asm package .claude/skills/my-skill
  $ asm package ./my-skill --output ./dist
  $ asm package ./my-skill --force
  $ asm package ./my-skill --skip-validation
  $ asm package ./my-skill --quiet

Packaging Process:
  1. Validates the skill (unless --skip-validation is used)
  2. Creates a ZIP archive with .skill extension
  3. Includes all skill files (SKILL.md, scripts/, etc.)
  4. Excludes common development artifacts (.git, node_modules, etc.)

Excluded Files:
  - .git/ directories
  - node_modules/ directories
  - .DS_Store files
  - *.log files
  - __pycache__/ directories
  - *.pyc files

Distribution:
  ASM packages (.skill files) are for standalone skill distribution.
  For distribution that includes hooks, MCP servers, or multiple coordinated
  components, consider the Claude Code plugin system instead.
  See: https://code.claude.com/docs/en/plugins

Exit Codes:
  0 - Package created successfully
  1 - Skill validation failed
  2 - File system error (path not found, permission denied)
  3 - Package creation error

Output Formats:
  Normal (default): Progress messages and package details
  --quiet: Only outputs the package path on success`
    )
    .action(async (skillPath: string, options: PackageCommandOptions) => {
      const exitCode = await handlePackage(skillPath, options);
      if (exitCode !== EXIT_CODES.SUCCESS) {
        process.exit(exitCode);
      }
    });
}

/**
 * Handle the package command
 *
 * @param skillPath - Path to the skill directory or SKILL.md
 * @param options - Command options
 * @returns Exit code
 */
async function handlePackage(skillPath: string, options: PackageCommandOptions): Promise<number> {
  const { output: outputPath, force, skipValidation, quiet } = options;

  try {
    // Show progress unless in quiet mode
    if (!quiet) {
      console.log(formatPackageProgress('validating'));
    }

    // First attempt - may fail if package exists
    let result: PackageResult;

    try {
      result = await createPackage({
        path: skillPath,
        output: outputPath,
        skipValidation,
        force,
      });
    } catch (error) {
      // Handle overwrite scenario - FileSystemError with "already exists" message
      if (error instanceof FileSystemError && error.message.includes('already exists') && !force) {
        if (quiet) {
          // In quiet mode, fail if overwrite needed without --force
          console.log(`FAIL: ${error.message}`);
          return EXIT_CODES.FILE_SYSTEM_ERROR;
        }

        // Prompt user for confirmation
        const confirmed = await confirmOverwrite(error.path);
        if (!confirmed) {
          output.displayError('Package creation cancelled by user');
          return EXIT_CODES.FILE_SYSTEM_ERROR;
        }

        // Retry with force
        if (!quiet) {
          console.log(formatPackageProgress('creating'));
        }
        result = await createPackage({
          path: skillPath,
          output: outputPath,
          skipValidation,
          force: true,
        });
      } else {
        throw error;
      }
    }

    // Output success
    if (quiet) {
      console.log(result.packagePath);
    } else {
      // Create a compatible result object for the formatter
      const formatterResult = {
        success: true,
        packagePath: result.packagePath,
        fileCount: result.fileCount,
        size: result.size,
        errors: [] as string[],
      };
      console.log(formatPackageSuccess(formatterResult));
    }

    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleError(error, quiet);
  }
}

/**
 * Handle errors from the package command
 *
 * @param error - Error that occurred
 * @param quiet - Whether quiet mode is enabled
 * @returns Exit code
 */
function handleError(error: unknown, quiet?: boolean): number {
  if (error instanceof CancellationError) {
    if (!quiet) {
      console.log(output.error(error.message));
    } else {
      console.log('CANCELLED');
    }
    return EXIT_CODES.FILE_SYSTEM_ERROR;
  }

  if (error instanceof ValidationError) {
    // Check if this is a path/file not found error (should be FILE_SYSTEM_ERROR)
    const isPathError = error.issues.some(
      (issue) =>
        issue.message.toLowerCase().includes('does not exist') ||
        issue.message.toLowerCase().includes('not found') ||
        issue.code === 'FILE_NOT_FOUND' ||
        issue.code === 'PATH_NOT_FOUND'
    );

    if (!quiet) {
      console.log(output.error('Skill validation failed'));
      if (error.issues.length > 0) {
        console.log('\nValidation errors:');
        for (const issue of error.issues) {
          console.log(`  • ${issue.message}`);
        }
        console.log('');
      }
    } else {
      console.log(`FAIL: ${error.message}`);
    }

    // Path errors are FILE_SYSTEM_ERROR, other validation errors are VALIDATION_FAILED
    return isPathError ? EXIT_CODES.FILE_SYSTEM_ERROR : EXIT_CODES.VALIDATION_FAILED;
  }

  if (error instanceof FileSystemError) {
    if (!quiet) {
      console.log(output.error('File system error'));
      console.log(`  ${error.message}`);
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.FILE_SYSTEM_ERROR;
  }

  if (error instanceof PackageError) {
    if (!quiet) {
      console.log(output.error('Package error'));
      console.log(`  ${error.message}`);
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.PACKAGE_ERROR;
  }

  if (error instanceof AsmError) {
    if (!quiet) {
      console.log(output.error(error.message));
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.PACKAGE_ERROR;
  }

  // Generic error handling - treat as package creation error
  if (error instanceof Error) {
    if (!quiet) {
      console.log(output.error('Package failed'));
      console.log(`  ${error.message}`);
    } else {
      console.log(`FAIL: ${error.message}`);
    }
  } else {
    if (!quiet) {
      console.log(output.error('An unexpected error occurred'));
      console.log(`  ${String(error)}`);
    } else {
      console.log(`FAIL: ${String(error)}`);
    }
  }

  return EXIT_CODES.PACKAGE_ERROR;
}
