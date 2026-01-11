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
} from '../types/api';
import { FileSystemError, SecurityError, CancellationError } from '../errors';
import { checkAborted } from '../utils/abort-signal';
import { uninstallSkill, isDryRunPreview } from '../generators/uninstaller';
import type { UninstallOptions as GeneratorUninstallOptions } from '../types/uninstall';
import type { UninstallScope } from '../validators/uninstall-scope';

/**
 * Validates a skill name for security.
 * Rejects names that could be used for path traversal.
 */
function validateSkillName(name: string): void {
  // Check for path traversal attempts
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new SecurityError(`Invalid skill name: "${name}" contains path traversal characters`);
  }

  // Check for absolute path indicators
  if (path.isAbsolute(name)) {
    throw new SecurityError(`Invalid skill name: "${name}" appears to be an absolute path`);
  }

  // Check for empty names
  if (!name || name.trim() === '') {
    throw new SecurityError('Invalid skill name: name cannot be empty');
  }
}

/**
 * Maps API scope to generator scope.
 */
function mapScope(scope: 'project' | 'personal' | undefined): UninstallScope {
  return scope === 'personal' ? 'personal' : 'project';
}

/**
 * Checks if an error has a specific error code.
 */
function hasErrorCode(error: unknown, code: string): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === code;
}

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
 *
 * @example
 * ```typescript
 * import { uninstall, SecurityError, FileSystemError } from 'ai-skills-manager';
 *
 * // Uninstall a single skill
 * const result = await uninstall({
 *   names: ['my-skill'],
 *   force: true
 * });
 * console.log(`Removed: ${result.removed.join(', ')}`);
 *
 * // Uninstall multiple skills
 * const result2 = await uninstall({
 *   names: ['skill-a', 'skill-b', 'skill-c'],
 *   scope: 'personal',
 *   force: true
 * });
 * console.log(`Removed: ${result2.removed.length}, Not found: ${result2.notFound.length}`);
 *
 * // Uninstall from custom path
 * const result3 = await uninstall({
 *   names: ['my-skill'],
 *   targetPath: '/custom/skills/path',
 *   force: true
 * });
 *
 * // Dry run to preview what would be removed
 * const preview = await uninstall({
 *   names: ['my-skill'],
 *   dryRun: true
 * });
 * console.log(`Would remove: ${preview.removed.join(', ')}`);
 *
 * // With cancellation support
 * const controller = new AbortController();
 * setTimeout(() => controller.abort(), 5000);
 *
 * try {
 *   await uninstall({
 *     names: ['skill-1', 'skill-2'],
 *     force: true,
 *     signal: controller.signal
 *   });
 * } catch (e) {
 *   if (e instanceof CancellationError) {
 *     console.log('Uninstall was cancelled');
 *   }
 * }
 *
 * // Handle errors
 * try {
 *   await uninstall({ names: ['../../../etc/passwd'], force: true });
 * } catch (e) {
 *   if (e instanceof SecurityError) {
 *     console.error('Security violation:', e.message);
 *   }
 * }
 * ```
 */
export async function uninstall(options: ApiUninstallOptions): Promise<ApiUninstallResult> {
  const { names, scope, targetPath, force = false, dryRun = false, signal } = options;

  // Check for cancellation at start
  checkAborted(signal);

  // Validate all skill names for security before proceeding
  for (const name of names) {
    validateSkillName(name);
  }

  // Track results
  const removed: string[] = [];
  const notFound: string[] = [];

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

  // Process each skill
  for (const skillName of names) {
    // Check for cancellation before each skill
    checkAborted(signal);

    try {
      const result = await uninstallSkill(skillName, generatorOptions);

      // Check for cancellation after each skill
      checkAborted(signal);

      // Handle dry-run preview
      if (isDryRunPreview(result)) {
        // In dry-run mode, skill exists and would be removed
        removed.push(skillName);
        continue;
      }

      // Handle success
      if (result.success) {
        removed.push(skillName);
        continue;
      }

      // Handle failure
      const error = result.error;

      // Skill not found
      if (error.type === 'skill-not-found') {
        notFound.push(skillName);
        continue;
      }

      // Security errors should be thrown
      if (error.type === 'security-error') {
        throw new SecurityError(`Security error for skill "${skillName}": ${error.details}`);
      }

      // Filesystem errors should be thrown
      if (error.type === 'filesystem-error') {
        throw new FileSystemError(
          `Filesystem error for skill "${skillName}": ${error.message}`,
          error.path
        );
      }

      // Validation errors that aren't security-related
      if (error.type === 'validation-error') {
        // If it's about unexpected files or missing SKILL.md and force isn't set,
        // treat it as not found (user can retry with force)
        if (!force) {
          notFound.push(skillName);
          continue;
        }
        // With force, this shouldn't happen, but if it does, throw
        throw new FileSystemError(
          `Validation error for skill "${skillName}": ${error.message}`,
          skillName
        );
      }

      // Partial removal errors - throw as filesystem error
      if (error.type === 'partial-removal') {
        throw new FileSystemError(
          `Partial removal of skill "${skillName}": ${error.filesRemoved} files removed, ${error.filesRemaining} remaining. ${error.lastError}`,
          skillName
        );
      }

      // Timeout errors - throw as filesystem error
      if (error.type === 'timeout') {
        throw new FileSystemError(
          `Timeout while removing skill "${skillName}" after ${error.timeoutMs}ms`,
          skillName
        );
      }

      // Unknown error type - shouldn't happen
      notFound.push(skillName);
    } catch (error) {
      // Re-throw our own errors
      if (
        error instanceof SecurityError ||
        error instanceof FileSystemError ||
        error instanceof CancellationError
      ) {
        throw error;
      }

      // Check if it's an internal CancellationError (re-throw)
      if (error instanceof Error && error.name === 'CancellationError') {
        throw new CancellationError(error.message);
      }

      // Handle filesystem errors
      if (hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM')) {
        throw new FileSystemError(`Permission denied while removing "${skillName}"`, skillName);
      }

      // Unknown errors - treat as filesystem error
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
