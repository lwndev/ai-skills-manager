/**
 * Public uninstall API function.
 *
 * Uninstalls one or more skills from the specified scope.
 * Supports batch operations with partial failure handling.
 *
 * @module api/uninstall
 */

import * as path from 'path';
import {
  UninstallOptions as ApiUninstallOptions,
  UninstallResult as ApiUninstallResult,
  DetailedUninstallResult,
  DetailedUninstallSuccess,
  DetailedUninstallNotFound,
  DetailedUninstallDryRunPreview,
  UninstallFileInfo,
} from '../types/api';
import { FileSystemError, SecurityError, CancellationError } from '../errors';
import { checkAborted } from '../utils/abort-signal';
import { hasErrorCode } from '../utils/error-helpers';
import { validateSkillName } from '../utils/skill-name-validation';
import { uninstallSkill, isDryRunPreview, getScopePath } from '../generators/uninstaller';
import type { UninstallOptions as GeneratorUninstallOptions } from '../types/uninstall';
import type { UninstallScope } from '../validators/uninstall-scope';

/**
 * Maps API scope to generator scope.
 */
function mapScope(scope: 'project' | 'personal' | undefined): UninstallScope {
  return scope === 'personal' ? 'personal' : 'project';
}

/* eslint-disable no-redeclare */
/**
 * Uninstalls one or more skills from the specified scope.
 *
 * @param options - Configuration with `detailed: true` to get detailed results
 * @returns Detailed result with per-skill file counts and bytes freed
 *
 * @example
 * ```typescript
 * import { uninstall } from 'ai-skills-manager';
 *
 * // Get detailed results for CLI output
 * const result = await uninstall({
 *   names: ['my-skill'],
 *   force: true,
 *   detailed: true
 * });
 *
 * for (const r of result.results) {
 *   if (r.type === 'success') {
 *     console.log(`Removed ${r.skillName}: ${r.filesRemoved} files, ${r.bytesFreed} bytes`);
 *   } else if (r.type === 'not-found') {
 *     console.log(`Not found: ${r.skillName}`);
 *   } else if (r.type === 'dry-run-preview') {
 *     console.log(`Would remove ${r.skillName}: ${r.files.length} files`);
 *   }
 * }
 * ```
 */
export async function uninstall(
  options: ApiUninstallOptions & { detailed: true }
): Promise<DetailedUninstallResult>;

/**
 * Uninstalls one or more skills from the specified scope.
 *
 * @param options - Configuration for the uninstall operation
 * @returns Simple result with arrays of removed and not-found skill names
 *
 * @example
 * ```typescript
 * import { uninstall } from 'ai-skills-manager';
 *
 * // Simple result (default)
 * const result = await uninstall({
 *   names: ['my-skill'],
 *   force: true
 * });
 * console.log(`Removed: ${result.removed.join(', ')}`);
 * ```
 */
export async function uninstall(
  options: ApiUninstallOptions & { detailed?: false }
): Promise<ApiUninstallResult>;

/**
 * Uninstalls one or more skills from the specified scope.
 *
 * This function:
 * 1. Validates all skill names for security
 * 2. Attempts to uninstall each skill
 * 3. Collects results, handling partial failures gracefully
 * 4. Returns a summary of removed and not-found skills
 *
 * @param options - Configuration for the uninstall operation
 * @returns Result with arrays of removed and not-found skill names
 * @throws SecurityError for invalid skill names (path traversal attempts)
 * @throws FileSystemError for permission errors
 * @throws CancellationError if the operation is cancelled via signal
 */
export async function uninstall(
  options: ApiUninstallOptions
): Promise<ApiUninstallResult | DetailedUninstallResult> {
  /* eslint-enable no-redeclare */
  const {
    names,
    scope,
    targetPath,
    force = false,
    dryRun = false,
    signal,
    detailed = false,
  } = options;

  // Check for cancellation at start
  checkAborted(signal);

  // Validate all skill names for security before proceeding
  for (const name of names) {
    validateSkillName(name);
  }

  // Build generator options
  // When targetPath is provided, it takes precedence over scope.
  // We use 'project' scope with computed cwd to make the path resolution work.
  const useTargetPath = !!targetPath;
  const generatorScope = useTargetPath ? 'project' : mapScope(scope);
  const generatorOptions: Omit<GeneratorUninstallOptions, 'skillNames'> = {
    scope: generatorScope,
    force,
    dryRun,
    quiet: true, // API calls don't need console output
  };

  // If targetPath is provided, compute the cwd so that getProjectSkillsDir(cwd)
  // returns the targetPath. The generator appends '.claude/skills' to cwd,
  // so we need to compute the correct parent directory.
  if (targetPath) {
    // Check if targetPath follows the .claude/skills convention
    if (targetPath.endsWith('.claude/skills') || targetPath.endsWith('.claude/skills/')) {
      // targetPath is like /path/to/project/.claude/skills
      // cwd should be /path/to/project
      generatorOptions.cwd = path.resolve(targetPath, '../..');
    } else {
      // For custom paths that don't follow the convention, we compute cwd
      // assuming the targetPath follows the .claude/skills structure.
      // This may not work for truly arbitrary paths.
      const artificialParent = path.resolve(targetPath, '../..');
      generatorOptions.cwd = artificialParent;
    }
  }

  // Get the scope path for not-found errors
  const scopePath = getScopePath(generatorScope, generatorOptions.cwd);

  // Track results based on mode
  if (detailed) {
    return processDetailedUninstall(names, generatorOptions, dryRun, signal, scopePath);
  } else {
    return processSimpleUninstall(names, generatorOptions, dryRun, signal);
  }
}

/**
 * Process uninstall in simple mode (returns arrays of skill names).
 */
async function processSimpleUninstall(
  names: string[],
  generatorOptions: Omit<GeneratorUninstallOptions, 'skillNames'>,
  dryRun: boolean,
  signal?: AbortSignal
): Promise<ApiUninstallResult> {
  const removed: string[] = [];
  const notFound: string[] = [];

  for (const skillName of names) {
    checkAborted(signal);

    try {
      const result = await uninstallSkill(skillName, generatorOptions);
      checkAborted(signal);

      if (isDryRunPreview(result)) {
        removed.push(skillName);
        continue;
      }

      if (result.success) {
        removed.push(skillName);
        continue;
      }

      const error = result.error;

      if (error.type === 'skill-not-found') {
        notFound.push(skillName);
        continue;
      }

      if (error.type === 'security-error') {
        throw new SecurityError(`Security error for skill "${skillName}": ${error.details}`);
      }

      if (error.type === 'filesystem-error') {
        throw new FileSystemError(
          `Filesystem error for skill "${skillName}": ${error.message}`,
          error.path
        );
      }

      if (error.type === 'validation-error') {
        if (!generatorOptions.force) {
          notFound.push(skillName);
          continue;
        }
        throw new FileSystemError(
          `Validation error for skill "${skillName}": ${error.message}`,
          skillName
        );
      }

      if (error.type === 'partial-removal') {
        throw new FileSystemError(
          `Partial removal of skill "${skillName}": ${error.filesRemoved} files removed, ${error.filesRemaining} remaining. ${error.lastError}`,
          skillName
        );
      }

      if (error.type === 'timeout') {
        throw new FileSystemError(
          `Timeout while removing skill "${skillName}" after ${error.timeoutMs}ms`,
          skillName
        );
      }

      notFound.push(skillName);
    } catch (error) {
      if (
        error instanceof SecurityError ||
        error instanceof FileSystemError ||
        error instanceof CancellationError
      ) {
        throw error;
      }

      if (error instanceof Error && error.name === 'CancellationError') {
        throw new CancellationError(error.message);
      }

      if (hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM')) {
        throw new FileSystemError(`Permission denied while removing "${skillName}"`, skillName);
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new FileSystemError(`Failed to uninstall skill "${skillName}": ${message}`, skillName);
    }
  }

  return {
    removed,
    notFound,
    dryRun,
  };
}

/**
 * Process uninstall in detailed mode (returns per-skill results with file counts).
 */
async function processDetailedUninstall(
  names: string[],
  generatorOptions: Omit<GeneratorUninstallOptions, 'skillNames'>,
  dryRun: boolean,
  signal: AbortSignal | undefined,
  scopePath: string
): Promise<DetailedUninstallResult> {
  const results: (
    | DetailedUninstallSuccess
    | DetailedUninstallNotFound
    | DetailedUninstallDryRunPreview
  )[] = [];
  let totalFilesRemoved = 0;
  let totalBytesFreed = 0;

  for (const skillName of names) {
    checkAborted(signal);

    try {
      const result = await uninstallSkill(skillName, generatorOptions);
      checkAborted(signal);

      if (isDryRunPreview(result)) {
        // Map internal FileInfo to API UninstallFileInfo
        const files: UninstallFileInfo[] = result.files.map((f) => ({
          relativePath: f.relativePath,
          absolutePath: f.absolutePath,
          size: f.size,
          isDirectory: f.isDirectory,
          isSymlink: f.isSymlink,
        }));

        const preview: DetailedUninstallDryRunPreview = {
          type: 'dry-run-preview',
          skillName: result.skillName,
          path: path.join(scopePath, result.skillName),
          files,
          totalSize: result.totalSize,
        };
        results.push(preview);
        continue;
      }

      if (result.success) {
        const success: DetailedUninstallSuccess = {
          type: 'success',
          skillName: result.skillName,
          path: result.path,
          filesRemoved: result.filesRemoved,
          bytesFreed: result.bytesFreed,
        };
        results.push(success);
        totalFilesRemoved += result.filesRemoved;
        totalBytesFreed += result.bytesFreed;
        continue;
      }

      const error = result.error;

      if (error.type === 'skill-not-found') {
        const notFound: DetailedUninstallNotFound = {
          type: 'not-found',
          skillName,
          searchedPath: error.searchedPath,
        };
        results.push(notFound);
        continue;
      }

      if (error.type === 'security-error') {
        throw new SecurityError(`Security error for skill "${skillName}": ${error.details}`);
      }

      if (error.type === 'filesystem-error') {
        throw new FileSystemError(
          `Filesystem error for skill "${skillName}": ${error.message}`,
          error.path
        );
      }

      if (error.type === 'validation-error') {
        if (!generatorOptions.force) {
          const notFound: DetailedUninstallNotFound = {
            type: 'not-found',
            skillName,
            searchedPath: scopePath,
          };
          results.push(notFound);
          continue;
        }
        throw new FileSystemError(
          `Validation error for skill "${skillName}": ${error.message}`,
          skillName
        );
      }

      if (error.type === 'partial-removal') {
        throw new FileSystemError(
          `Partial removal of skill "${skillName}": ${error.filesRemoved} files removed, ${error.filesRemaining} remaining. ${error.lastError}`,
          skillName
        );
      }

      if (error.type === 'timeout') {
        throw new FileSystemError(
          `Timeout while removing skill "${skillName}" after ${error.timeoutMs}ms`,
          skillName
        );
      }

      // Unknown error type - treat as not found
      const notFound: DetailedUninstallNotFound = {
        type: 'not-found',
        skillName,
        searchedPath: scopePath,
      };
      results.push(notFound);
    } catch (error) {
      if (
        error instanceof SecurityError ||
        error instanceof FileSystemError ||
        error instanceof CancellationError
      ) {
        throw error;
      }

      if (error instanceof Error && error.name === 'CancellationError') {
        throw new CancellationError(error.message);
      }

      if (hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM')) {
        throw new FileSystemError(`Permission denied while removing "${skillName}"`, skillName);
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new FileSystemError(`Failed to uninstall skill "${skillName}": ${message}`, skillName);
    }
  }

  const totalRemoved = results.filter(
    (r) => r.type === 'success' || r.type === 'dry-run-preview'
  ).length;
  const totalNotFound = results.filter((r) => r.type === 'not-found').length;

  return {
    results,
    totalRemoved,
    totalNotFound,
    totalFilesRemoved,
    totalBytesFreed,
    dryRun,
  };
}

// Export type guards for consumers
export { isDryRunPreview };

/**
 * Type guard for DetailedUninstallSuccess.
 */
export function isUninstallSuccess(
  result: DetailedUninstallSuccess | DetailedUninstallNotFound | DetailedUninstallDryRunPreview
): result is DetailedUninstallSuccess {
  return result.type === 'success';
}

/**
 * Type guard for DetailedUninstallNotFound.
 */
export function isUninstallNotFound(
  result: DetailedUninstallSuccess | DetailedUninstallNotFound | DetailedUninstallDryRunPreview
): result is DetailedUninstallNotFound {
  return result.type === 'not-found';
}

/**
 * Type guard for DetailedUninstallDryRunPreview.
 */
export function isUninstallDryRunPreview(
  result: DetailedUninstallSuccess | DetailedUninstallNotFound | DetailedUninstallDryRunPreview
): result is DetailedUninstallDryRunPreview {
  return result.type === 'dry-run-preview';
}
