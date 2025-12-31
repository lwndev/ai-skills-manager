/**
 * Package command implementation
 *
 * Packages a validated Claude Code skill into a distributable .skill file.
 */

import { Command } from 'commander';
import { generatePackage } from '../generators/packager';
import { PackageOptions, PackageResult } from '../types/package';
import {
  formatPackageProgress,
  formatPackageSuccess,
  formatPackageError,
  formatQuietOutput,
} from '../formatters/package-formatter';
import { confirmOverwrite } from '../utils/prompts';
import {
  PathValidationError,
  ValidationFailedError,
  UserCancelledError,
  FileSystemError,
} from '../utils/errors';
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

    // Generate the package
    const packageOptions: PackageOptions = {
      outputPath,
      force,
      skipValidation,
      quiet,
    };

    let result: PackageResult = await generatePackage(skillPath, packageOptions);

    // Handle overwrite scenario
    if (result.requiresOverwrite && !force) {
      if (quiet) {
        // In quiet mode, fail if overwrite needed without --force
        console.log(`FAIL: Package already exists: ${result.packagePath}`);
        return EXIT_CODES.FILE_SYSTEM_ERROR;
      }

      // Prompt user for confirmation
      const packagePathForPrompt = result.packagePath || 'existing package';
      const confirmed = await confirmOverwrite(packagePathForPrompt);
      if (!confirmed) {
        throw new UserCancelledError('Package creation cancelled by user');
      }

      // Retry with force
      if (!quiet) {
        console.log(formatPackageProgress('creating'));
      }
      result = await generatePackage(skillPath, { ...packageOptions, force: true });
    }

    // Check for success
    if (!result.success) {
      const errorMessage = result.errors.join(', ') || 'Unknown error';
      throw new FileSystemError(errorMessage);
    }

    // Output success
    if (quiet) {
      console.log(formatQuietOutput(result));
    } else {
      console.log(formatPackageSuccess(result));
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
  if (error instanceof UserCancelledError) {
    if (!quiet) {
      output.displayError(error.message);
    } else {
      console.log('CANCELLED');
    }
    // User cancellation is treated as a file system error (graceful exit)
    return EXIT_CODES.FILE_SYSTEM_ERROR;
  }

  if (error instanceof PathValidationError) {
    if (!quiet) {
      console.log(formatPackageError(error));
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.FILE_SYSTEM_ERROR;
  }

  if (error instanceof ValidationFailedError) {
    if (!quiet) {
      console.log(formatPackageError(error));
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.VALIDATION_FAILED;
  }

  if (error instanceof FileSystemError) {
    if (!quiet) {
      console.log(formatPackageError(error));
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.FILE_SYSTEM_ERROR;
  }

  // Generic error handling - treat as package creation error
  if (error instanceof Error) {
    if (!quiet) {
      output.displayError('Package failed', error.message);
    } else {
      console.log(`FAIL: ${error.message}`);
    }
  } else {
    if (!quiet) {
      output.displayError('An unexpected error occurred', String(error));
    } else {
      console.log(`FAIL: ${String(error)}`);
    }
  }

  return EXIT_CODES.PACKAGE_ERROR;
}
