/**
 * Uninstall command implementation
 *
 * Removes installed Claude Code skills from project or personal skill directories.
 * This command is security-focused due to its destructive nature:
 * - Only supports official Claude Code skill locations (project/personal)
 * - Validates skill names rigorously to prevent path traversal
 * - Implements symlink and hard link detection
 * - Provides confirmation prompts before deletion
 *
 * Note: This command uses a hybrid approach - the internal generators for detailed
 * file enumeration and confirmation prompts, with API error types for consistency.
 */

import { Command } from 'commander';
import { validateSkillName } from '../validators/uninstall-name';
import { validateUninstallScope, UninstallScope } from '../validators/uninstall-scope';
import {
  uninstallSkill,
  uninstallMultipleSkills,
  isDryRunPreview,
  getScopePath,
} from '../generators/uninstaller';
import { discoverSkill } from '../generators/skill-discovery';
import {
  collectSkillFiles,
  getSkillSummary,
  checkResourceLimits,
} from '../generators/file-enumerator';
import { resolveScope } from '../utils/scope-resolver';
import {
  setupInterruptHandler,
  resetInterruptHandler,
  isInterrupted,
} from '../utils/signal-handler';
import {
  formatDiscoveryProgress,
  formatSkillFound,
  formatConfirmationPrompt,
  formatMultiSkillConfirmation,
  formatSuccess,
  formatMultiSuccess,
  formatError,
  formatDryRun,
  formatQuietOutput,
  formatQuietError,
  formatPartialFailure,
  formatCancellation,
  formatInvalidSkillNameError,
  formatInvalidScopeError,
} from '../formatters/uninstall-formatter';
import {
  confirmUninstall,
  confirmMultiUninstall,
  confirmBulkForceUninstall,
} from '../utils/prompts';
import { UninstallExitCodes } from '../types/uninstall';
import type {
  UninstallResult,
  UninstallFailure,
  DryRunPreview,
  SkillInfo,
} from '../types/uninstall';
// API error types imported for potential future use in error handling
// Currently using internal uninstall error types for backward compatibility
import { createDebugLogger } from '../utils/debug';
import { getResolvedAsmrConfig } from '../config/asmr';
import {
  createAsmrContext,
  showBannerIfEnabled,
  withSpinner,
  showSuccess,
  AsmrOutputContext,
} from '../utils/asmr-output';

const debug = createDebugLogger('uninstall-command');

/**
 * Exit codes for the uninstall command
 * Per feature spec FEAT-005:
 * - 0: Skill(s) uninstalled successfully
 * - 1: Skill not found
 * - 2: File system error
 * - 3: User cancelled
 * - 4: Partial failure
 * - 5: Security error
 */
export const EXIT_CODES = UninstallExitCodes;

/**
 * Options for the uninstall command
 */
export interface UninstallCommandOptions {
  /** Installation scope: project or personal */
  scope?: string;
  /** Force removal without confirmation */
  force?: boolean;
  /** Show what would be removed without making changes */
  dryRun?: boolean;
  /** Suppress detailed output (quiet mode) */
  quiet?: boolean;
}

/**
 * Register the uninstall command with the CLI program
 */
export function registerUninstallCommand(program: Command): void {
  program
    .command('uninstall <skill-name...>')
    .description('Uninstall Claude Code skills from project or personal skill directories')
    .option(
      '-s, --scope <scope>',
      'Skill location: "project" (.claude/skills/) or "personal" (~/.claude/skills/)',
      'project'
    )
    .option('-f, --force', 'Remove without confirmation prompt')
    .option('-n, --dry-run', 'Preview what would be removed without making changes')
    .option('-q, --quiet', 'Quiet mode - minimal output')
    .addHelpText(
      'after',
      `
Examples:
  $ asm uninstall my-skill
  $ asm uninstall my-skill --scope personal
  $ asm uninstall my-skill --force
  $ asm uninstall my-skill --dry-run
  $ asm uninstall skill1 skill2 skill3

Scopes:
  project     Remove from .claude/skills/ in current directory (default)
  personal    Remove from ~/.claude/skills/ for all projects

Security:
  For safety, only the two official Claude Code skill locations are supported.
  Custom paths are not allowed for uninstall operations.

  Skill names are validated to prevent path traversal attacks. Names must:
  - Contain only lowercase letters, numbers, and hyphens
  - Not contain path separators (/ or \\)
  - Be 1-64 characters long

Options:
  --force       Skip confirmation prompt. When uninstalling 3+ skills,
                still requires typing "yes" for safety.
  --dry-run     Show what would be removed without making changes.
  --quiet       Show minimal output (single line per skill).

Exit Codes:
  0 - Skill(s) uninstalled successfully
  1 - Skill not found
  2 - File system error (permission denied, etc.)
  3 - User cancelled uninstallation
  4 - Partial failure (some skills removed, some failed)
  5 - Security error (invalid name, symlink escape, etc.)

Debugging:
  Set ASM_DEBUG=1 to enable debug logging for troubleshooting`
    )
    .action(async (skillNames: string[], options: UninstallCommandOptions) => {
      const exitCode = await handleUninstall(skillNames, options);
      if (exitCode !== EXIT_CODES.SUCCESS) {
        process.exit(exitCode);
      }
    });
}

/**
 * Handle the uninstall command
 *
 * @param skillNames - Names of skills to uninstall
 * @param options - Command options
 * @returns Exit code
 */
async function handleUninstall(
  skillNames: string[],
  options: UninstallCommandOptions
): Promise<number> {
  const { scope, force, dryRun, quiet } = options;

  const { config: asmrConfig } = getResolvedAsmrConfig();
  const asmrCtx = createAsmrContext(quiet ? undefined : asmrConfig);

  // Set up signal handler for graceful interruption
  setupInterruptHandler(async () => {
    if (!quiet) {
      console.log('\nInterrupted. Some files may have been removed.');
    }
  });

  try {
    // Validate scope first (applies to all skills)
    const scopeValidation = validateUninstallScope(scope);
    if (!scopeValidation.valid) {
      if (!quiet) {
        console.log(formatInvalidScopeError(scope || ''));
      } else {
        console.log(`FAIL: ${scopeValidation.error}`);
      }
      return EXIT_CODES.SECURITY_ERROR;
    }

    const validatedScope: UninstallScope = scopeValidation.scope;
    const scopePath = getScopePath(validatedScope);

    showBannerIfEnabled(asmrCtx);

    debug('Uninstall request', { skillNames, scope: validatedScope, force, dryRun, quiet });

    // Validate all skill names before proceeding
    const validationErrors: { skillName: string; error: string }[] = [];
    for (const name of skillNames) {
      const validation = validateSkillName(name);
      if (!validation.valid) {
        validationErrors.push({ skillName: name, error: validation.error || 'Invalid name' });
      }
    }

    if (validationErrors.length > 0) {
      for (const err of validationErrors) {
        if (!quiet) {
          console.log(formatInvalidSkillNameError(err.skillName));
        } else {
          console.log(`FAIL: ${err.skillName}: ${err.error}`);
        }
      }
      return EXIT_CODES.SECURITY_ERROR;
    }

    // Check for bulk force uninstall (3+ skills with --force)
    if (force && skillNames.length >= 3 && !dryRun) {
      const confirmed = await confirmBulkForceUninstall(skillNames.length);
      if (!confirmed) {
        if (!quiet) {
          console.log(formatCancellation());
        }
        return EXIT_CODES.CANCELLED;
      }
    }

    // Handle single skill vs multiple skills
    if (skillNames.length === 1) {
      return await handleSingleUninstall(
        skillNames[0],
        validatedScope,
        scopePath,
        options,
        asmrCtx
      );
    } else {
      return await handleMultiUninstall(skillNames, validatedScope, scopePath, options, asmrCtx);
    }
  } catch (error) {
    debug('Unexpected error', error);
    if (!quiet) {
      console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } else {
      console.log(`FAIL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return EXIT_CODES.FILESYSTEM_ERROR;
  } finally {
    resetInterruptHandler();
  }
}

/**
 * Handle uninstallation of a single skill
 */
async function handleSingleUninstall(
  skillName: string,
  scope: UninstallScope,
  scopePath: string,
  options: UninstallCommandOptions,
  asmrCtx: AsmrOutputContext
): Promise<number> {
  const { force, dryRun, quiet } = options;

  // Show discovery progress
  if (!quiet) {
    console.log(formatDiscoveryProgress(skillName, scopePath));
  }

  // For dry-run, we can go directly to the uninstaller
  if (dryRun) {
    const result = await uninstallSkill(skillName, {
      scope,
      force: force || false,
      dryRun: true,
      quiet: quiet || false,
    });

    if (isDryRunPreview(result)) {
      console.log(formatDryRun(result as DryRunPreview, scopePath));
      return EXIT_CODES.SUCCESS;
    }

    // If not a dry-run preview, it's an error
    const failure = result as UninstallFailure;
    return handleError(failure, quiet);
  }

  // For non-dry-run, we need to gather skill info for confirmation
  const scopeInfo = resolveScope(scope);
  const discoveryResult = await discoverSkill(skillName, scopeInfo);

  if (discoveryResult.type === 'not-found') {
    if (!quiet) {
      console.log(
        formatError(
          {
            type: 'skill-not-found',
            skillName,
            searchedPath: discoveryResult.searchedPath,
          },
          skillName
        )
      );
    } else {
      console.log(`FAIL: ${skillName}: not found`);
    }
    return EXIT_CODES.NOT_FOUND;
  }

  if (discoveryResult.type === 'case-mismatch') {
    if (!quiet) {
      console.log(
        formatError(
          {
            type: 'security-error',
            reason: 'case-mismatch',
            details: `Expected "${discoveryResult.expectedName}" but found "${discoveryResult.actualName}"`,
          },
          skillName
        )
      );
    } else {
      console.log(`FAIL: ${skillName}: case mismatch security error`);
    }
    return EXIT_CODES.SECURITY_ERROR;
  }

  // Show skill found message
  if (!quiet) {
    console.log(formatSkillFound(discoveryResult.path));
  }

  // Collect skill info for confirmation
  const files = await collectSkillFiles(discoveryResult.path);
  const totalSize = files.reduce((sum, f) => (f.isDirectory ? sum : sum + f.size), 0);

  const skillInfo: SkillInfo = {
    name: skillName,
    path: discoveryResult.path,
    files,
    totalSize,
    hasSkillMd: discoveryResult.hasSkillMd,
    warnings: [],
  };

  // Check resource limits
  const summary = await getSkillSummary(discoveryResult.path);
  const resourceCheck = checkResourceLimits(summary);
  if (resourceCheck.type === 'exceeded') {
    skillInfo.warnings.push(...resourceCheck.warnings);
  }

  // Get confirmation unless --force is set
  if (!force) {
    const confirmed = await confirmUninstall(skillName, formatConfirmationPrompt(skillInfo));
    if (!confirmed) {
      if (!quiet) {
        console.log(formatCancellation());
      }
      return EXIT_CODES.CANCELLED;
    }
  }

  // Check for interrupt before proceeding
  if (isInterrupted()) {
    if (!quiet) {
      console.log('\nInterrupted. No changes made.');
    }
    return EXIT_CODES.CANCELLED;
  }

  // Execute uninstall
  const uninstallTask = () =>
    uninstallSkill(skillName, {
      scope,
      force: true, // Already confirmed
      dryRun: false,
      quiet: quiet || false,
    });

  const result = asmrCtx.enabled
    ? await withSpinner('uninstall', uninstallTask, asmrCtx)
    : await uninstallTask();

  // Handle result
  if (isDryRunPreview(result)) {
    // Shouldn't happen, but handle it
    console.log(formatDryRun(result as DryRunPreview, scopePath));
    return EXIT_CODES.SUCCESS;
  }

  if (result.success) {
    const successResult = result as UninstallResult;
    if (quiet) {
      console.log(formatQuietOutput(successResult, scope));
    } else {
      console.log(formatSuccess(successResult));
      if (asmrCtx.enabled) {
        await showSuccess('Skill uninstalled', asmrCtx).catch(() => {});
      }
    }
    return EXIT_CODES.SUCCESS;
  }

  return handleError(result as UninstallFailure, quiet);
}

/**
 * Handle uninstallation of multiple skills
 */
async function handleMultiUninstall(
  skillNames: string[],
  scope: UninstallScope,
  scopePath: string,
  options: UninstallCommandOptions,
  asmrCtx: AsmrOutputContext
): Promise<number> {
  const { force, dryRun, quiet } = options;

  // For dry-run, process each skill individually
  if (dryRun) {
    for (const skillName of skillNames) {
      const result = await uninstallSkill(skillName, {
        scope,
        force: force || false,
        dryRun: true,
        quiet: quiet || false,
      });

      if (isDryRunPreview(result)) {
        console.log(formatDryRun(result as DryRunPreview, scopePath));
      } else {
        const failure = result as UninstallFailure;
        if (quiet) {
          console.log(formatQuietError(skillName, failure.error));
        } else {
          console.log(formatError(failure.error, skillName));
        }
      }
    }
    return EXIT_CODES.SUCCESS;
  }

  // Gather info for all skills
  const scopeInfo = resolveScope(scope);
  const skillInfos: SkillInfo[] = [];
  const notFound: string[] = [];

  for (const skillName of skillNames) {
    // Check for interrupt
    if (isInterrupted()) {
      if (!quiet) {
        console.log('\nInterrupted. No changes made.');
      }
      return EXIT_CODES.CANCELLED;
    }

    if (!quiet) {
      console.log(`Checking ${skillName}...`);
    }

    const discoveryResult = await discoverSkill(skillName, scopeInfo);

    if (discoveryResult.type === 'not-found') {
      notFound.push(skillName);
      continue;
    }

    if (discoveryResult.type === 'case-mismatch') {
      if (!quiet) {
        console.log(
          formatError(
            {
              type: 'security-error',
              reason: 'case-mismatch',
              details: `Expected "${discoveryResult.expectedName}" but found "${discoveryResult.actualName}"`,
            },
            skillName
          )
        );
      }
      continue;
    }

    const files = await collectSkillFiles(discoveryResult.path);
    const totalSize = files.reduce((sum, f) => (f.isDirectory ? sum : sum + f.size), 0);

    skillInfos.push({
      name: skillName,
      path: discoveryResult.path,
      files,
      totalSize,
      hasSkillMd: discoveryResult.hasSkillMd,
      warnings: [],
    });
  }

  // Report not found skills
  if (notFound.length > 0 && !quiet) {
    for (const name of notFound) {
      console.log(
        formatError(
          {
            type: 'skill-not-found',
            skillName: name,
            searchedPath: scopePath,
          },
          name
        )
      );
    }
  }

  // If no skills found, exit
  if (skillInfos.length === 0) {
    if (!quiet) {
      console.log('No skills found to uninstall.');
    }
    return notFound.length > 0 ? EXIT_CODES.NOT_FOUND : EXIT_CODES.SUCCESS;
  }

  // Get confirmation unless --force is set
  if (!force) {
    const confirmed = await confirmMultiUninstall(
      skillInfos.length,
      formatMultiSkillConfirmation(skillInfos)
    );
    if (!confirmed) {
      if (!quiet) {
        console.log(formatCancellation());
      }
      return EXIT_CODES.CANCELLED;
    }
  }

  // Execute uninstalls
  const multiUninstallTask = () =>
    uninstallMultipleSkills(
      skillInfos.map((s) => s.name),
      {
        scope,
        force: true, // Already confirmed
        dryRun: false,
        quiet: quiet || false,
      }
    );

  const result = asmrCtx.enabled
    ? await withSpinner('uninstall', multiUninstallTask, asmrCtx)
    : await multiUninstallTask();

  // Handle results
  if (result.failed.length === 0) {
    // All succeeded
    if (quiet) {
      for (const s of result.succeeded) {
        console.log(formatQuietOutput(s, scope));
      }
    } else {
      console.log(formatMultiSuccess(result));
    }
    return EXIT_CODES.SUCCESS;
  }

  if (result.succeeded.length === 0) {
    // All failed
    if (quiet) {
      for (const f of result.failed) {
        console.log(formatQuietError(f.skillName, f.error));
      }
    } else {
      for (const f of result.failed) {
        console.log(formatError(f.error, f.skillName));
      }
    }
    return determineExitCode(result.failed[0]);
  }

  // Partial failure
  if (quiet) {
    for (const s of result.succeeded) {
      console.log(formatQuietOutput(s, scope));
    }
    for (const f of result.failed) {
      console.log(formatQuietError(f.skillName, f.error));
    }
  } else {
    console.log(formatPartialFailure(result));
  }
  return EXIT_CODES.PARTIAL_FAILURE;
}

/**
 * Handle an uninstall error and return appropriate exit code
 */
function handleError(failure: UninstallFailure, quiet?: boolean): number {
  if (quiet) {
    console.log(formatQuietError(failure.skillName, failure.error));
  } else {
    console.log(formatError(failure.error, failure.skillName));
  }
  return determineExitCode(failure);
}

/**
 * Determine the exit code based on the error type
 */
function determineExitCode(failure: UninstallFailure): number {
  switch (failure.error.type) {
    case 'skill-not-found':
      return EXIT_CODES.NOT_FOUND;
    case 'security-error':
      return EXIT_CODES.SECURITY_ERROR;
    case 'validation-error':
      // Validation errors for security issues
      if (failure.error.message.includes('path') || failure.error.message.includes('invalid')) {
        return EXIT_CODES.SECURITY_ERROR;
      }
      return EXIT_CODES.FILESYSTEM_ERROR;
    case 'filesystem-error':
      return EXIT_CODES.FILESYSTEM_ERROR;
    case 'timeout':
      return EXIT_CODES.FILESYSTEM_ERROR;
    case 'partial-removal':
      return EXIT_CODES.PARTIAL_FAILURE;
    default:
      return EXIT_CODES.FILESYSTEM_ERROR;
  }
}
