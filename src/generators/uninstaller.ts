/**
 * Core uninstall logic for skill removal
 *
 * This module orchestrates the complete uninstall workflow:
 * 1. Validate skill name and scope
 * 2. Discover skill in the specified scope
 * 3. Run pre-removal validation (informational)
 * 4. Run security checks (symlinks, hard links)
 * 5. Generate dry-run preview or execute removal
 * 6. Log to audit trail
 *
 * All file system operations use the safe-delete utilities from Phase 3
 * to ensure TOCTOU protection and containment verification.
 */

import { validateSkillName } from '../validators/uninstall-name';
import { UninstallScope } from '../validators/uninstall-scope';
import { resolveScope, getProjectSkillsDir, getPersonalSkillsDir } from '../utils/scope-resolver';
import { discoverSkill } from './skill-discovery';
import { collectSkillFiles, getSkillSummary, checkResourceLimits } from './file-enumerator';
import { validateBeforeRemoval, detectUnexpectedFiles } from './pre-removal-validator';
import { checkSymlinkSafety, detectHardLinkWarnings, getSymlinkSummary } from './security-checker';
import { safeRecursiveDelete } from '../utils/safe-delete';
import {
  logUninstallOperation,
  createSuccessEntry,
  createFailureEntry,
  createPartialEntry,
} from '../utils/audit-logger';
import { createTimeoutController, DEFAULT_UNINSTALL_TIMEOUT } from '../utils/timeout';
import type {
  UninstallOptions,
  UninstallResult,
  UninstallFailure,
  SingleUninstallResult,
  MultiUninstallResult,
  DryRunPreview,
  SkillInfo,
} from '../types/uninstall';

/**
 * Result of the uninstall validation phase
 */
export interface ValidationPhaseResult {
  type: 'success' | 'error';
  skillName?: string;
  scope?: UninstallScope;
  scopePath?: string;
  error?: UninstallFailure;
}

/**
 * Result of the discovery and security check phase
 */
export interface DiscoveryPhaseResult {
  type: 'found' | 'not-found' | 'security-error' | 'requires-force';
  skillInfo?: SkillInfo;
  warnings?: string[];
  error?: UninstallFailure;
}

/**
 * Progress update during removal
 */
export interface RemovalProgress {
  /** Current file being processed */
  currentPath: string;
  /** Relative path within skill directory */
  relativePath: string;
  /** Whether the file was successfully deleted */
  success: boolean;
  /** Error message if deletion failed */
  errorMessage?: string;
  /** Number of files processed so far */
  processedCount: number;
  /** Total files to process */
  totalCount: number;
}

/**
 * Uninstall a single skill
 *
 * Main orchestration function that validates inputs, discovers the skill,
 * runs security checks, and executes the removal. All operations are
 * logged to the audit trail.
 *
 * @param skillName - Name of the skill to uninstall
 * @param options - Uninstall options (scope, force, dryRun, quiet)
 * @returns Result of the uninstall operation, or DryRunPreview if dryRun is true
 */
export async function uninstallSkill(
  skillName: string,
  options: Omit<UninstallOptions, 'skillNames'>
): Promise<SingleUninstallResult | DryRunPreview> {
  const scope = options.scope;

  // Phase 1: Validate inputs
  const nameValidation = validateSkillName(skillName);
  if (!nameValidation.valid) {
    const failure: UninstallFailure = {
      success: false,
      skillName,
      error: {
        type: 'validation-error',
        field: 'skillName',
        message: nameValidation.error || 'Invalid skill name',
      },
    };
    await logUninstallOperation(
      createFailureEntry(skillName, scope, 'FAILED', nameValidation.error || 'Invalid skill name')
    );
    return failure;
  }

  // Resolve scope path
  const scopePath =
    scope === 'personal' ? getPersonalSkillsDir(options.homedir) : getProjectSkillsDir(options.cwd);

  // Phase 2: Discover skill
  const scopeInfo = resolveScope(scope, options.cwd, options.homedir);
  const discoveryResult = await discoverSkill(skillName, scopeInfo);

  if (discoveryResult.type === 'not-found') {
    const failure: UninstallFailure = {
      success: false,
      skillName,
      error: {
        type: 'skill-not-found',
        skillName,
        searchedPath: discoveryResult.searchedPath,
      },
    };
    await logUninstallOperation(
      createFailureEntry(
        skillName,
        scope,
        'NOT_FOUND',
        `Not found at ${discoveryResult.searchedPath}`
      )
    );
    return failure;
  }

  if (discoveryResult.type === 'case-mismatch') {
    const failure: UninstallFailure = {
      success: false,
      skillName,
      error: {
        type: 'security-error',
        reason: 'case-mismatch',
        details:
          `Expected "${discoveryResult.expectedName}" but found "${discoveryResult.actualName}". ` +
          'This may indicate a security issue on case-insensitive filesystems.',
      },
    };
    await logUninstallOperation(
      createFailureEntry(
        skillName,
        scope,
        'SECURITY_BLOCKED',
        `case_mismatch:${discoveryResult.actualName}`
      )
    );
    return failure;
  }

  // Skill found - gather information
  const skillPath = discoveryResult.path;
  const files = await collectSkillFiles(skillPath);
  const summary = await getSkillSummary(skillPath);
  const totalSize = files.reduce((sum, f) => sum + (f.isDirectory ? 0 : f.size), 0);

  const skillInfo: SkillInfo = {
    name: skillName,
    path: skillPath,
    files,
    totalSize,
    hasSkillMd: discoveryResult.hasSkillMd,
    warnings: [],
  };

  // Pre-removal validation (informational only)
  const preRemovalResult = await validateBeforeRemoval(skillPath);
  skillInfo.warnings.push(...preRemovalResult.warnings);

  // Check for unexpected files (requires --force if found)
  const unexpectedResult = await detectUnexpectedFiles(skillPath);
  if (unexpectedResult.type === 'found' && !options.force) {
    skillInfo.warnings.push(...unexpectedResult.warnings);
    const failure: UninstallFailure = {
      success: false,
      skillName,
      error: {
        type: 'validation-error',
        field: 'skillName',
        message:
          'Skill contains unexpected files. Use --force to proceed anyway. ' +
          unexpectedResult.warnings.join(' '),
      },
    };
    await logUninstallOperation(
      createFailureEntry(skillName, scope, 'FAILED', 'unexpected_files_require_force')
    );
    return failure;
  }

  // Check SKILL.md presence (requires --force if missing)
  if (!skillInfo.hasSkillMd && !options.force) {
    const failure: UninstallFailure = {
      success: false,
      skillName,
      error: {
        type: 'validation-error',
        field: 'skillName',
        message:
          'SKILL.md not found. This directory may not be a valid Claude Code skill. ' +
          'Use --force to proceed anyway.',
      },
    };
    await logUninstallOperation(createFailureEntry(skillName, scope, 'FAILED', 'missing_skill_md'));
    return failure;
  }

  // Check resource limits (requires --force if exceeded)
  const resourceCheck = checkResourceLimits(summary);
  if (resourceCheck.type === 'exceeded' && !options.force) {
    skillInfo.warnings.push(...resourceCheck.warnings);
    const failure: UninstallFailure = {
      success: false,
      skillName,
      error: {
        type: 'validation-error',
        field: 'skillName',
        message:
          'Resource limits exceeded. Use --force to proceed anyway. ' +
          resourceCheck.warnings.join(' '),
      },
    };
    await logUninstallOperation(
      createFailureEntry(skillName, scope, 'FAILED', 'resource_limits_exceeded')
    );
    return failure;
  }

  // Phase 3: Security checks
  const symlinkSafety = await checkSymlinkSafety(skillPath, scopePath);
  if (symlinkSafety.type === 'escape') {
    const failure: UninstallFailure = {
      success: false,
      skillName,
      error: {
        type: 'security-error',
        reason: 'symlink-escape',
        details:
          `Skill directory is a symlink pointing outside scope: ${symlinkSafety.targetPath}. ` +
          'Refusing to proceed to prevent unintended file deletion.',
      },
    };
    await logUninstallOperation(
      createFailureEntry(
        skillName,
        scope,
        'SECURITY_BLOCKED',
        `symlink_escape=${symlinkSafety.targetPath}`
      )
    );
    return failure;
  }

  if (symlinkSafety.type === 'error') {
    const failure: UninstallFailure = {
      success: false,
      skillName,
      error: {
        type: 'filesystem-error',
        operation: 'stat',
        path: skillPath,
        message: symlinkSafety.message,
      },
    };
    await logUninstallOperation(
      createFailureEntry(skillName, scope, 'FAILED', symlinkSafety.message)
    );
    return failure;
  }

  // Check for hard links (requires --force if found)
  const hardLinkWarning = await detectHardLinkWarnings(skillPath);
  if (hardLinkWarning && !options.force) {
    skillInfo.warnings.push(hardLinkWarning.message);
    const failure: UninstallFailure = {
      success: false,
      skillName,
      error: {
        type: 'security-error',
        reason: 'hard-link-detected',
        details: hardLinkWarning.message,
      },
    };
    await logUninstallOperation(
      createFailureEntry(skillName, scope, 'FAILED', `hard_links_detected=${hardLinkWarning.count}`)
    );
    return failure;
  }

  // Get symlink summary for informational purposes
  const symlinkSummary = await getSymlinkSummary(skillPath);
  if (symlinkSummary.warning) {
    skillInfo.warnings.push(symlinkSummary.warning);
  }

  // If dry-run, return preview
  if (options.dryRun) {
    return generateDryRunPreview(skillInfo);
  }

  // Execute removal
  const removalResult = await executeRemoval(skillInfo, options);

  if (removalResult.type === 'success') {
    const result: UninstallResult = {
      success: true,
      skillName,
      path: skillPath,
      filesRemoved: removalResult.filesRemoved,
      bytesFreed: removalResult.bytesFreed,
    };
    await logUninstallOperation(
      createSuccessEntry(skillName, scope, result.filesRemoved, result.bytesFreed, skillPath)
    );
    return result;
  }

  if (removalResult.type === 'partial') {
    const failure: UninstallFailure = {
      success: false,
      skillName,
      error: {
        type: 'partial-removal',
        skillName,
        filesRemoved: removalResult.filesRemoved,
        filesRemaining: removalResult.filesRemaining,
        lastError: removalResult.lastError,
      },
    };
    await logUninstallOperation(
      createPartialEntry(
        skillName,
        scope,
        removalResult.filesRemoved,
        removalResult.filesRemaining,
        removalResult.lastError,
        skillPath
      )
    );
    return failure;
  }

  if (removalResult.type === 'timeout') {
    const failure: UninstallFailure = {
      success: false,
      skillName,
      error: {
        type: 'timeout',
        operationName: 'uninstall',
        timeoutMs: DEFAULT_UNINSTALL_TIMEOUT,
      },
    };
    await logUninstallOperation(
      createFailureEntry(
        skillName,
        scope,
        'TIMEOUT',
        `Operation timed out after ${DEFAULT_UNINSTALL_TIMEOUT}ms`,
        skillPath
      )
    );
    return failure;
  }

  // removalResult.type === 'error'
  const failure: UninstallFailure = {
    success: false,
    skillName,
    error: {
      type: 'filesystem-error',
      operation: 'delete',
      path: skillPath,
      message: removalResult.message,
    },
  };
  await logUninstallOperation(
    createFailureEntry(skillName, scope, 'FAILED', removalResult.message, skillPath)
  );
  return failure;
}

/**
 * Uninstall multiple skills
 *
 * Processes skills sequentially, tracking successes and failures.
 * Continues on partial failure to remove as many skills as possible.
 * Note: dry-run mode is not supported for multiple skills - use single uninstallSkill instead.
 *
 * @param skillNames - Names of skills to uninstall
 * @param options - Uninstall options (dryRun should be false)
 * @returns Summary of all uninstall operations
 */
export async function uninstallMultipleSkills(
  skillNames: string[],
  options: Omit<UninstallOptions, 'skillNames'>
): Promise<MultiUninstallResult> {
  const succeeded: UninstallResult[] = [];
  const failed: UninstallFailure[] = [];

  for (const skillName of skillNames) {
    const result = await uninstallSkill(skillName, options);

    // Skip dry-run previews in multi-skill mode
    if (isDryRunPreview(result)) {
      continue;
    }

    if (result.success) {
      succeeded.push(result);
    } else {
      failed.push(result);
    }
  }

  return {
    succeeded,
    failed,
    totalFilesRemoved: succeeded.reduce((sum, r) => sum + r.filesRemoved, 0),
    totalBytesFreed: succeeded.reduce((sum, r) => sum + r.bytesFreed, 0),
  };
}

/**
 * Result of removal execution
 */
export type RemovalExecutionResult =
  | RemovalSuccess
  | RemovalPartial
  | RemovalTimeout
  | RemovalError;

interface RemovalSuccess {
  type: 'success';
  filesRemoved: number;
  bytesFreed: number;
}

interface RemovalPartial {
  type: 'partial';
  filesRemoved: number;
  filesRemaining: number;
  lastError: string;
}

interface RemovalTimeout {
  type: 'timeout';
  filesRemoved: number;
}

interface RemovalError {
  type: 'error';
  message: string;
}

/**
 * Execute the actual file removal
 *
 * Uses safe-delete utilities with timeout protection.
 * Tracks progress and handles interruption gracefully.
 *
 * @param skillInfo - Information about the skill to remove
 * @param options - Uninstall options
 * @returns Removal result
 */
export async function executeRemoval(
  skillInfo: SkillInfo,
  _options: Omit<UninstallOptions, 'skillNames'>
): Promise<RemovalExecutionResult> {
  const timeoutController = createTimeoutController(DEFAULT_UNINSTALL_TIMEOUT);

  let filesRemoved = 0;
  let bytesFreed = 0;
  let lastError = '';
  let errors = 0;

  try {
    for await (const progress of safeRecursiveDelete(skillInfo.path)) {
      // Check timeout
      if (timeoutController.isExpired()) {
        return {
          type: 'timeout',
          filesRemoved,
        };
      }

      if (progress.result.type === 'success') {
        filesRemoved++;
        if (progress.result.pathType === 'file') {
          bytesFreed += progress.result.size;
        }
      } else if (progress.result.type === 'error') {
        errors++;
        lastError = progress.result.message;
      }
      // 'skipped' results are expected for some cases (not-empty directories during first pass)
    }

    // Check if we had any errors
    if (errors > 0) {
      const totalFiles = skillInfo.files.length + 1; // +1 for the skill directory
      return {
        type: 'partial',
        filesRemoved,
        filesRemaining: totalFiles - filesRemoved,
        lastError,
      };
    }

    return {
      type: 'success',
      filesRemoved,
      bytesFreed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      type: 'error',
      message,
    };
  }
}

/**
 * Generate a progress stream for removal (for UI updates)
 *
 * Wraps safeRecursiveDelete to provide RemovalProgress updates
 * suitable for displaying to the user.
 *
 * @param skillInfo - Information about the skill to remove
 * @yields Progress updates for each file processed
 */
export async function* streamRemovalProgress(
  skillInfo: SkillInfo
): AsyncGenerator<RemovalProgress> {
  const totalCount = skillInfo.files.length + 1; // +1 for skill directory
  let processedCount = 0;

  for await (const progress of safeRecursiveDelete(skillInfo.path)) {
    processedCount++;

    yield {
      currentPath: progress.currentPath,
      relativePath: progress.relativePath,
      success: progress.result.type === 'success',
      errorMessage: progress.result.type === 'error' ? progress.result.message : undefined,
      processedCount,
      totalCount,
    };
  }
}

/**
 * Generate a dry-run preview
 *
 * Creates a preview of what would be removed without making changes.
 * Returns a DryRunPreview that can be displayed to the user.
 *
 * @param skillInfo - Information about the skill
 * @returns Dry-run preview result
 */
export function generateDryRunPreview(skillInfo: SkillInfo): DryRunPreview {
  return {
    type: 'dry-run-preview',
    skillName: skillInfo.name,
    files: skillInfo.files,
    totalSize: skillInfo.totalSize,
  };
}

/**
 * Check if a result is a dry-run preview
 *
 * Type guard for distinguishing DryRunPreview from other results.
 *
 * @param result - Result to check
 * @returns True if result is a DryRunPreview
 */
export function isDryRunPreview(
  result: SingleUninstallResult | DryRunPreview
): result is DryRunPreview {
  return 'type' in result && result.type === 'dry-run-preview';
}

/**
 * Get scope path for a given scope
 *
 * @param scope - The scope to get path for
 * @param cwd - Optional current working directory override
 * @param homedir - Optional home directory override
 * @returns Absolute path to the scope directory
 */
export function getScopePath(scope: UninstallScope, cwd?: string, homedir?: string): string {
  return scope === 'personal' ? getPersonalSkillsDir(homedir) : getProjectSkillsDir(cwd);
}
