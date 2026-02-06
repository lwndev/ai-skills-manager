/**
 * Install command implementation
 *
 * Installs a Claude Code skill from a .skill package file.
 *
 * Note: This command uses a hybrid approach - the API for actual installation
 * but internal generators for features that need more detail (dry-run preview,
 * warning analysis, overwrite prompts) to maintain backward-compatible CLI output.
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
import { InstallOptions, DryRunPreview } from '../types/install';
import {
  formatInstallProgress,
  formatInstallSuccess,
  formatDryRunOutput,
  formatOverwritePrompt,
  formatPackageWarnings,
  formatLargePackageProgress,
} from '../formatters/install-formatter';
import { confirmInstallOverwrite } from '../utils/prompts';
import {
  AsmError,
  FileSystemError,
  PackageError,
  SecurityError,
  CancellationError,
} from '../errors';
import * as output from '../utils/output';
import { createDebugLogger } from '../utils/debug';
import { getResolvedAsmrConfig } from '../config/asmr';
import {
  createAsmrContext,
  showBannerIfEnabled,
  withSpinner,
  showSuccess,
} from '../utils/asmr-output';

const debug = createDebugLogger('install-command');

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
  /** Use content hashing for thorough file comparison */
  thorough?: boolean;
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
    .option('-t, --thorough', 'Use content hashing for accurate file comparison (slower)')
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
  $ asm install my-skill.skill --thorough

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
  --quiet: Only outputs the skill path on success

File Comparison:
  Default: Compares file sizes (fast)
  --thorough: Compares content hashes (slower but detects all changes)

Debugging:
  Set ASM_DEBUG=1 to enable debug logging for troubleshooting`
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
  const { scope, force, dryRun, quiet, thorough } = options;

  const { config: asmrConfig } = getResolvedAsmrConfig();
  const asmrCtx = createAsmrContext(quiet ? undefined : asmrConfig);

  try {
    // Validate package file first
    if (!quiet) {
      showBannerIfEnabled(asmrCtx);
      console.log(formatInstallProgress('opening'));
    }

    const packageValidation = await validatePackageFile(packagePath);
    if (!packageValidation.valid) {
      throw new FileSystemError(
        `Package not found: ${packageValidation.packagePath || packagePath}`,
        packageValidation.packagePath || packagePath
      );
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
      } catch (error) {
        // Ignore warning analysis errors - they shouldn't block installation
        debug('Warning analysis failed', error);
      }
    }

    // Handle dry-run with generator directly (needs detailed preview data)
    if (dryRun) {
      const installOptions: InstallOptions = {
        scope,
        force,
        dryRun: true,
        quiet,
        thorough,
      };
      const result = await installSkill(resolvedPath, installOptions);
      if (isDryRunPreview(result)) {
        console.log(formatDryRunOutput(result as DryRunPreview));
        return EXIT_CODES.SUCCESS;
      }
    }

    // Prepare installation options
    const installOptions: InstallOptions = {
      scope,
      force,
      dryRun: false,
      quiet,
      thorough,
    };

    // Attempt installation (generator returns detailed result)
    let result = asmrCtx.enabled
      ? await withSpinner('install', () => installSkill(resolvedPath, installOptions), asmrCtx)
      : await installSkill(resolvedPath, installOptions);

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
        output.displayError('Installation cancelled by user');
        return EXIT_CODES.USER_CANCELLED;
      }

      // Retry with force
      if (!quiet) {
        console.log(formatInstallProgress('extracting'));
      }
      result = await installSkill(resolvedPath, { ...installOptions, force: true });
    }

    // Handle installation result (using generator result for detailed output)
    if (!isInstallResult(result)) {
      // Unexpected result type
      throw new PackageError('Unexpected installation result');
    }

    if (!result.success) {
      const errorMessage = result.errors.join(', ') || 'Unknown error';
      throw new PackageError(errorMessage);
    }

    // Output success using generator result (has full details)
    if (quiet) {
      console.log(result.skillPath);
    } else {
      // Use the formatter for consistent output
      console.log(formatInstallSuccess(result));
      if (asmrCtx.enabled) {
        await showSuccess('Skill installed', asmrCtx).catch(() => {});
      }
    }

    return EXIT_CODES.SUCCESS;
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
  if (error instanceof CancellationError) {
    if (!quiet) {
      console.log(output.error(error.message));
    } else {
      console.log('CANCELLED');
    }
    return EXIT_CODES.USER_CANCELLED;
  }

  if (error instanceof SecurityError) {
    if (!quiet) {
      console.log(output.error('Security error'));
      console.log(`  ${error.message}`);
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.VALIDATION_FAILED;
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
    return EXIT_CODES.EXTRACTION_ERROR;
  }

  if (error instanceof AsmError) {
    if (!quiet) {
      console.log(output.error(error.message));
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.EXTRACTION_ERROR;
  }

  // Generic error handling
  if (error instanceof Error) {
    if (!quiet) {
      console.log(output.error('Installation failed'));
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

  return EXIT_CODES.EXTRACTION_ERROR;
}
