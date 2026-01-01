/**
 * Install command implementation
 *
 * Installs a Claude Code skill from a .skill package file.
 */

import { Command } from 'commander';
import {
  installSkill,
  isOverwriteRequired,
  isDryRunPreview,
  isInstallResult,
} from '../generators/installer';
import { validatePackageFile } from '../validators/package-file';
import { analyzePackageWarnings } from '../generators/install-validator';
import { openZipArchive } from '../utils/extractor';
import { InstallOptions, InstallResult, DryRunPreview } from '../types/install';
import {
  formatInstallProgress,
  formatInstallSuccess,
  formatInstallError,
  formatQuietOutput,
  formatDryRunOutput,
  formatOverwritePrompt,
  formatPackageWarnings,
  formatLargePackageProgress,
} from '../formatters/install-formatter';
import { confirmInstallOverwrite } from '../utils/prompts';
import {
  PackageNotFoundError,
  InvalidPackageError,
  PackageValidationError,
  FileSystemError,
  UserCancelledError,
} from '../utils/errors';
import * as output from '../utils/output';

/**
 * Exit codes for the install command
 * Per feature spec FEAT-004:
 * - 0: Skill installed successfully
 * - 1: Validation failed (package or post-installation)
 * - 2: File system error (path not found, permission denied)
 * - 3: Package extraction error
 * - 4: User cancelled installation
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  VALIDATION_FAILED: 1,
  FILE_SYSTEM_ERROR: 2,
  EXTRACTION_ERROR: 3,
  USER_CANCELLED: 4,
} as const;

/**
 * Options for the install command
 */
export interface InstallCommandOptions {
  /** Installation scope: project, personal, or custom path */
  scope?: string;
  /** Force overwrite if skill already exists */
  force?: boolean;
  /** Show what would be installed without making changes */
  dryRun?: boolean;
  /** Suppress output (quiet mode) */
  quiet?: boolean;
}

/**
 * Register the install command with the CLI program
 */
export function registerInstallCommand(program: Command): void {
  program
    .command('install <skill-package>')
    .description('Install a Claude Code skill from a .skill package file')
    .option(
      '-s, --scope <scope>',
      'Installation scope: "project" (.claude/skills/), "personal" (~/.claude/skills/), or custom path'
    )
    .option('-f, --force', 'Overwrite existing skill without prompting')
    .option('-n, --dry-run', 'Show what would be installed without making changes')
    .option('-q, --quiet', 'Quiet mode - minimal output')
    .addHelpText(
      'after',
      `
Examples:
  $ asm install my-skill.skill
  $ asm install my-skill.skill --scope personal
  $ asm install my-skill.skill --scope ~/.claude/skills
  $ asm install my-skill.skill --force
  $ asm install my-skill.skill --dry-run
  $ asm install my-skill.skill --quiet

Installation Scopes:
  project     Install to .claude/skills/ in current directory (default)
  personal    Install to ~/.claude/skills/ for all projects
  <path>      Install to a custom directory

Installation Process:
  1. Validates the package file (exists, valid ZIP, correct structure)
  2. Validates package contents (SKILL.md, metadata)
  3. Checks for existing skill at target location
  4. Extracts files to target directory
  5. Validates installed skill
  6. Rolls back on validation failure

Security:
  Skills can execute code and access files. Only install packages from
  trusted sources. The SKILL.md file describes what the skill does -
  review it before using the skill.

Exit Codes:
  0 - Skill installed successfully
  1 - Validation failed (package or post-installation)
  2 - File system error (path not found, permission denied)
  3 - Package extraction error
  4 - User cancelled installation

Output Formats:
  Normal (default): Progress messages and installation details
  --dry-run: Preview of files that would be installed
  --quiet: Only outputs the skill path on success`
    )
    .action(async (skillPackage: string, options: InstallCommandOptions) => {
      const exitCode = await handleInstall(skillPackage, options);
      if (exitCode !== EXIT_CODES.SUCCESS) {
        process.exit(exitCode);
      }
    });
}

/**
 * Handle the install command
 *
 * @param packagePath - Path to the .skill package file
 * @param options - Command options
 * @returns Exit code
 */
async function handleInstall(packagePath: string, options: InstallCommandOptions): Promise<number> {
  const { scope, force, dryRun, quiet } = options;

  try {
    // Validate package file first
    if (!quiet) {
      console.log(formatInstallProgress('opening'));
    }

    const packageValidation = await validatePackageFile(packagePath);
    if (!packageValidation.valid) {
      throw new PackageNotFoundError(packageValidation.packagePath || packagePath);
    }

    const resolvedPath = packageValidation.packagePath as string;

    // Show validation progress
    if (!quiet) {
      console.log(formatInstallProgress('validating'));
    }

    // Analyze package for warnings
    if (!quiet) {
      try {
        const archive = openZipArchive(resolvedPath);
        const warnings = analyzePackageWarnings(archive);

        // Display warnings
        const warningsOutput = formatPackageWarnings(warnings);
        if (warningsOutput) {
          console.log(warningsOutput);
        }

        // Show large package progress if applicable
        if (warnings.isLargePackage) {
          console.log(formatLargePackageProgress(warnings.totalSize));
        }
      } catch {
        // Ignore warning analysis errors - they shouldn't block installation
      }
    }

    // Prepare installation options
    const installOptions: InstallOptions = {
      scope,
      force,
      dryRun,
      quiet,
    };

    // Attempt installation
    let result = await installSkill(resolvedPath, installOptions);

    // Handle overwrite scenario
    if (isOverwriteRequired(result)) {
      if (quiet) {
        // In quiet mode, fail if overwrite needed without --force
        console.log(`FAIL: Skill already exists: ${result.existingPath}`);
        return EXIT_CODES.FILE_SYSTEM_ERROR;
      }

      // Show overwrite prompt
      const promptMessage = formatOverwritePrompt(
        result.skillName,
        result.existingPath,
        result.files
      );
      const confirmed = await confirmInstallOverwrite(result.skillName, promptMessage);

      if (!confirmed) {
        throw new UserCancelledError('Installation cancelled by user');
      }

      // Retry with force
      if (!quiet) {
        console.log(formatInstallProgress('extracting'));
      }
      result = await installSkill(resolvedPath, { ...installOptions, force: true });
    }

    // Handle dry-run result
    if (isDryRunPreview(result)) {
      console.log(formatDryRunOutput(result as DryRunPreview));
      return EXIT_CODES.SUCCESS;
    }

    // Handle installation result
    if (isInstallResult(result)) {
      const installResult = result as InstallResult;

      if (!installResult.success) {
        const errorMessage = installResult.errors.join(', ') || 'Unknown error';
        throw new PackageValidationError(errorMessage, installResult.errors);
      }

      // Output success
      if (quiet) {
        console.log(formatQuietOutput(installResult));
      } else {
        console.log(formatInstallSuccess(installResult));
      }

      return EXIT_CODES.SUCCESS;
    }

    // Should not reach here
    throw new Error('Unexpected installation result');
  } catch (error) {
    return handleError(error, quiet);
  }
}

/**
 * Handle errors from the install command
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
    return EXIT_CODES.USER_CANCELLED;
  }

  if (error instanceof PackageNotFoundError) {
    if (!quiet) {
      console.log(formatInstallError(error));
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.FILE_SYSTEM_ERROR;
  }

  if (error instanceof InvalidPackageError) {
    if (!quiet) {
      console.log(formatInstallError(error));
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.EXTRACTION_ERROR;
  }

  if (error instanceof PackageValidationError) {
    if (!quiet) {
      console.log(formatInstallError(error));
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.VALIDATION_FAILED;
  }

  if (error instanceof FileSystemError) {
    if (!quiet) {
      console.log(formatInstallError(error));
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.FILE_SYSTEM_ERROR;
  }

  // Generic error handling
  if (error instanceof Error) {
    if (!quiet) {
      output.displayError('Installation failed', error.message);
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

  return EXIT_CODES.EXTRACTION_ERROR;
}
