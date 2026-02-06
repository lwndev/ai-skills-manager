/**
 * Update command implementation
 *
 * Updates installed Claude Code skills from .skill package files.
 * This command:
 * - Validates both the installed skill and new package
 * - Creates backup before modification (unless --no-backup)
 * - Compares versions and shows diff
 * - Performs atomic update with rollback on failure
 * - Logs operations to audit log
 *
 * Note: This command uses a hybrid approach - the API for actual updates
 * but internal generators for features that need detailed output (dry-run preview,
 * rollback details) to maintain backward-compatible CLI output.
 */

import { Command } from 'commander';
import { update } from '../api';
import { updateSkill, UpdateError } from '../generators/updater';
import { validatePackageFile } from '../validators/package-file';
import { validateSkillName } from '../validators/uninstall-name';
import { validateUninstallScope, type UninstallScope } from '../validators/uninstall-scope';
import type { UpdateOptions, UpdateResultUnion } from '../types/update';
import { UpdateExitCodes } from '../types/update';
import {
  formatUpdateProgress,
  formatUpdateSuccess,
  formatDryRun,
  formatQuietOutput,
  formatError,
  formatCancelledUpdate,
  formatRollbackSuccess,
  formatRollbackFailed,
} from '../formatters/update-formatter';
import {
  AsmError,
  FileSystemError,
  PackageError,
  SecurityError,
  CancellationError,
  ValidationError,
} from '../errors';
import { success, warning } from '../utils/output';
import { createDebugLogger } from '../utils/debug';
import * as output from '../utils/output';
import { resolveAsmrConfig } from '../config/asmr';
import {
  createAsmrContext,
  showBannerIfEnabled,
  withSpinner,
  showSuccess,
} from '../utils/asmr-output';

const debug = createDebugLogger('update-command');

/**
 * Exit codes for the update command
 * Per feature spec FEAT-008 (FR-11):
 * - 0: Skill updated successfully
 * - 1: Skill not found
 * - 2: File system error
 * - 3: User cancelled
 * - 4: Invalid new package
 * - 5: Security error
 * - 6: Rollback performed (update failed but rollback succeeded)
 * - 7: Rollback failed (critical error)
 */
export const EXIT_CODES = UpdateExitCodes;

/**
 * Options for the update command
 */
export interface UpdateCommandOptions {
  /** Target scope: project or personal */
  scope?: string;
  /** Skip confirmation prompt */
  force?: boolean;
  /** Preview update without making changes */
  dryRun?: boolean;
  /** Suppress non-error output */
  quiet?: boolean;
  /** Skip backup creation (not recommended) */
  noBackup?: boolean;
  /** Keep backup after successful update */
  keepBackup?: boolean;
}

/**
 * Register the update command with the CLI program
 */
export function registerUpdateCommand(program: Command): void {
  program
    .command('update <skill-name> <new-skill-package>')
    .description('Update an installed Claude Code skill from a .skill package file')
    .option(
      '-s, --scope <scope>',
      'Target scope: "project" (.claude/skills/) or "personal" (~/.claude/skills/)',
      'project'
    )
    .option('-f, --force', 'Skip confirmation prompt')
    .option('-n, --dry-run', 'Preview update without making changes')
    .option('-q, --quiet', 'Suppress non-error output')
    .option('--no-backup', 'Skip backup creation (not recommended)')
    .option('--keep-backup', 'Keep backup after successful update')
    .addHelpText(
      'after',
      `
Examples:
  $ asm update my-skill ./my-skill-v2.skill
  $ asm update my-skill ./my-skill-v2.skill --scope personal
  $ asm update my-skill ./my-skill-v2.skill --dry-run
  $ asm update my-skill ./my-skill-v2.skill --force
  $ asm update my-skill ./my-skill-v2.skill --no-backup
  $ asm update my-skill ./my-skill-v2.skill --keep-backup
  $ asm update my-skill ./my-skill-v2.skill --quiet

Scopes:
  project     Update skill in .claude/skills/ in current directory (default)
  personal    Update skill in ~/.claude/skills/ for all projects

Update Process:
  1. Locates the installed skill in the specified scope
  2. Validates the new package file (structure, SKILL.md, metadata)
  3. Compares versions and shows what will change
  4. Creates a backup of the current skill (unless --no-backup)
  5. Prompts for confirmation (unless --force or --dry-run)
  6. Replaces the skill atomically
  7. Validates the updated skill
  8. Rolls back automatically if validation fails

Backup:
  Backups are saved to ~/.asm/backups/ in .skill format.
  They are automatically removed after successful update unless --keep-backup.
  Use --no-backup to skip backup (not recommended for important skills).

Security:
  - Only official scope locations (project/personal) are supported
  - Skill names are validated to prevent path traversal
  - Package contents are validated before extraction
  - Symlink escape and hard link detection are enforced

Exit Codes:
  0 - Skill updated successfully
  1 - Skill not found
  2 - File system error (permission denied, disk full, etc.)
  3 - User cancelled update
  4 - Invalid new package
  5 - Security error (path traversal, invalid name, etc.)
  6 - Rollback performed (update failed but rollback succeeded)
  7 - Rollback failed (critical error - manual intervention required)

Debugging:
  Set ASM_DEBUG=1 to enable debug logging for troubleshooting`
    )
    .action(async (skillName: string, packagePath: string, options: UpdateCommandOptions) => {
      const exitCode = await handleUpdate(skillName, packagePath, options);
      if (exitCode !== EXIT_CODES.SUCCESS) {
        process.exit(exitCode);
      }
    });
}

/**
 * Handle the update command
 *
 * @param skillName - Name of the installed skill to update
 * @param packagePath - Path to the new .skill package file
 * @param options - Command options
 * @returns Exit code
 */
async function handleUpdate(
  skillName: string,
  packagePath: string,
  options: UpdateCommandOptions
): Promise<number> {
  const { scope, force, dryRun, quiet, noBackup, keepBackup } = options;

  const { config: asmrConfig } = resolveAsmrConfig();
  const asmrCtx = createAsmrContext(quiet ? undefined : asmrConfig);

  debug('Update request', {
    skillName,
    packagePath,
    scope,
    force,
    dryRun,
    quiet,
    noBackup,
    keepBackup,
  });

  try {
    // Validate skill name first (security check)
    const nameValidation = validateSkillName(skillName);
    if (!nameValidation.valid) {
      if (!quiet) {
        output.displayError(`Invalid skill name: ${nameValidation.error}`);
      } else {
        console.log(`FAIL: ${skillName}: ${nameValidation.error}`);
      }
      return EXIT_CODES.SECURITY_ERROR;
    }

    // Validate scope
    const scopeValidation = validateUninstallScope(scope);
    if (!scopeValidation.valid) {
      if (!quiet) {
        output.displayError(`Invalid scope: ${scopeValidation.error}`);
      } else {
        console.log(`FAIL: Invalid scope: ${scope}`);
      }
      return EXIT_CODES.SECURITY_ERROR;
    }

    const validatedScope: UninstallScope = scopeValidation.scope;

    // Show progress
    if (!quiet) {
      showBannerIfEnabled(asmrCtx);
      console.log(formatUpdateProgress('validating-package'));
    }

    // Validate package file exists and is valid
    const packageValidation = await validatePackageFile(packagePath);
    if (!packageValidation.valid) {
      if (!quiet) {
        output.displayError(`Invalid package: ${packageValidation.error}`);
      } else {
        console.log(`FAIL: ${packagePath}: ${packageValidation.error}`);
      }
      return EXIT_CODES.INVALID_PACKAGE;
    }

    const resolvedPackagePath = packageValidation.packagePath as string;

    // Show locating progress
    if (!quiet) {
      console.log(formatUpdateProgress('locating'));
    }

    // For dry-run, use generator directly for detailed output
    if (dryRun) {
      const updateOptions: UpdateOptions = {
        scope: validatedScope,
        force: force || false,
        dryRun: true,
        quiet: quiet || false,
        noBackup: noBackup || false,
        keepBackup: keepBackup || false,
      };

      const result: UpdateResultUnion = await updateSkill(
        skillName,
        resolvedPackagePath,
        updateOptions
      );

      return handleResult(result, validatedScope, quiet);
    }

    // For actual updates, use the API
    const updateTask = () =>
      update({
        name: skillName,
        file: resolvedPackagePath,
        scope:
          validatedScope === 'project' || validatedScope === 'personal'
            ? validatedScope
            : undefined,
        targetPath:
          validatedScope !== 'project' && validatedScope !== 'personal'
            ? validatedScope
            : undefined,
        force: force || false,
        keepBackup: keepBackup || false,
      });

    const apiResult = asmrCtx.enabled
      ? await withSpinner('update', updateTask, asmrCtx)
      : await updateTask();

    // Output success
    if (quiet) {
      console.log(apiResult.updatedPath);
    } else {
      console.log('');
      console.log(success('Skill updated successfully!'));
      console.log('');
      console.log('Update details:');
      console.log(`  Name: ${skillName}`);
      console.log(`  Path: ${apiResult.updatedPath}`);
      if (apiResult.previousVersion) {
        console.log(`  Previous version: ${apiResult.previousVersion}`);
      }
      if (apiResult.newVersion) {
        console.log(`  New version: ${apiResult.newVersion}`);
      }
      if (apiResult.backupPath) {
        console.log(`  Backup: ${apiResult.backupPath}`);
      }
      console.log('');
      console.log(warning('Security note:'));
      console.log('  Review the updated SKILL.md to understand any changes.');
      console.log('');
      if (asmrCtx.enabled) {
        await showSuccess('Skill updated', asmrCtx).catch(() => {});
      }
    }

    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleError(error, skillName, quiet);
  }
}

/**
 * Handle update result based on discriminated union type
 */
function handleResult(result: UpdateResultUnion, scope: UninstallScope, quiet?: boolean): number {
  switch (result.type) {
    case 'update-success':
      if (quiet) {
        console.log(formatQuietOutput(result));
      } else {
        console.log(formatUpdateSuccess(result, scope));
      }
      return EXIT_CODES.SUCCESS;

    case 'update-dry-run-preview':
      // Dry-run always outputs, even in quiet mode
      console.log(formatDryRun(result));
      return EXIT_CODES.SUCCESS;

    case 'update-rolled-back':
      if (!quiet) {
        console.log(formatRollbackSuccess(result));
      } else {
        console.log(`ROLLBACK: ${result.skillName}: ${result.failureReason}`);
      }
      return EXIT_CODES.ROLLED_BACK;

    case 'update-rollback-failed':
      // Critical errors always output, even in quiet mode
      console.log(formatRollbackFailed(result));
      return EXIT_CODES.ROLLBACK_FAILED;

    case 'update-cancelled':
      if (!quiet) {
        console.log(formatCancelledUpdate(result));
      }
      return EXIT_CODES.CANCELLED;

    default: {
      // Exhaustive check - TypeScript should catch missing cases
      const exhaustiveCheck: never = result;
      throw new Error(`Unhandled result type: ${(exhaustiveCheck as { type: string }).type}`);
    }
  }
}

/**
 * Handle errors from the update command
 */
function handleError(error: unknown, skillName: string, quiet?: boolean): number {
  debug('Update error', error);

  // Handle API error classes first
  if (error instanceof CancellationError) {
    if (!quiet) {
      output.displayError('Update cancelled', error.message);
    } else {
      console.log(`CANCELLED: ${skillName}`);
    }
    return EXIT_CODES.CANCELLED;
  }

  if (error instanceof SecurityError) {
    if (!quiet) {
      output.displayError('Security error', error.message);
    } else {
      console.log(`FAIL: ${skillName}: ${error.message}`);
    }
    return EXIT_CODES.SECURITY_ERROR;
  }

  if (error instanceof ValidationError) {
    if (!quiet) {
      output.displayError('Validation error', error.message);
      if (error.issues.length > 0) {
        console.log('\nValidation issues:');
        for (const issue of error.issues) {
          console.log(`  • ${issue.message}`);
        }
      }
    } else {
      console.log(`FAIL: ${skillName}: ${error.message}`);
    }
    return EXIT_CODES.INVALID_PACKAGE;
  }

  if (error instanceof PackageError) {
    if (!quiet) {
      output.displayError('Package error', error.message);
    } else {
      console.log(`FAIL: ${skillName}: ${error.message}`);
    }
    // Check if this is a rollback scenario
    if (error.message.includes('restored to previous version')) {
      return EXIT_CODES.ROLLED_BACK;
    }
    return EXIT_CODES.INVALID_PACKAGE;
  }

  if (error instanceof FileSystemError) {
    if (!quiet) {
      output.displayError('File system error', error.message);
    } else {
      console.log(`FAIL: ${skillName}: ${error.message}`);
    }
    // Check for specific scenarios
    if (error.message.includes('not found')) {
      return EXIT_CODES.NOT_FOUND;
    }
    if (error.message.includes('Critical error')) {
      return EXIT_CODES.ROLLBACK_FAILED;
    }
    return EXIT_CODES.FILESYSTEM_ERROR;
  }

  if (error instanceof AsmError) {
    if (!quiet) {
      output.displayError(error.message);
    } else {
      console.log(`FAIL: ${skillName}: ${error.message}`);
    }
    return EXIT_CODES.FILESYSTEM_ERROR;
  }

  // Handle internal UpdateError class (for dry-run path)
  if (error instanceof UpdateError) {
    const updateError = error.updateError;

    if (!quiet) {
      console.log(formatError(updateError));
    } else {
      console.log(`FAIL: ${skillName}: ${error.message}`);
    }

    // Map error types to exit codes
    switch (updateError.type) {
      case 'skill-not-found':
        return EXIT_CODES.NOT_FOUND;
      case 'security-error':
        return EXIT_CODES.SECURITY_ERROR;
      case 'filesystem-error':
        return EXIT_CODES.FILESYSTEM_ERROR;
      case 'validation-error':
        if (updateError.field === 'packagePath' || updateError.field === 'packageContent') {
          return EXIT_CODES.INVALID_PACKAGE;
        }
        return EXIT_CODES.SECURITY_ERROR;
      case 'package-mismatch':
        return EXIT_CODES.INVALID_PACKAGE;
      case 'backup-creation-error':
        return EXIT_CODES.FILESYSTEM_ERROR;
      case 'rollback-error':
        return EXIT_CODES.ROLLED_BACK;
      case 'critical-error':
        return EXIT_CODES.ROLLBACK_FAILED;
      case 'timeout':
        return EXIT_CODES.FILESYSTEM_ERROR;
      default:
        return EXIT_CODES.FILESYSTEM_ERROR;
    }
  }

  // Handle generic errors
  if (error instanceof Error) {
    if (!quiet) {
      output.displayError('Update failed', error.message);
    } else {
      console.log(`FAIL: ${skillName}: ${error.message}`);
    }
  } else {
    if (!quiet) {
      output.displayError('An unexpected error occurred', String(error));
    } else {
      console.log(`FAIL: ${skillName}: ${String(error)}`);
    }
  }

  return EXIT_CODES.FILESYSTEM_ERROR;
}
