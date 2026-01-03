/**
 * Skill updater for FEAT-008
 *
 * Orchestrates the update process for installed skills:
 * - Phase 5: Input validation, skill discovery, case sensitivity, package validation
 * - Phase 6+: Security checks, backup, execution, rollback (future phases)
 *
 * This module follows the discriminated union pattern for result types,
 * enabling reliable type narrowing in calling code.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  UpdateOptions,
  UpdateResultUnion,
  UpdateError as UpdateErrorType,
  UpdateState,
} from '../types/update';
import type { ScopeInfo } from '../types/scope';
import {
  validateSkillName,
  type UninstallNameValidationResult,
} from '../validators/uninstall-name';
import {
  validateUninstallScope,
  type UninstallScopeValidationResult,
} from '../validators/uninstall-scope';
import { validatePackageFile, type PackageFileValidationResult } from '../validators/package-file';
import { resolveScope } from '../utils/scope-resolver';
import { discoverSkill, type SkillDiscoveryResult } from './skill-discovery';
import {
  validatePackageStructure,
  validateNameMatch,
  extractToTempDirectory,
  validatePackageContent,
  cleanupTempDirectory,
  type PackageStructureResult,
  type NameMatchResult,
  type TempExtractionResult,
} from './install-validator';
import { openZipArchive } from '../utils/extractor';

/**
 * Result of input validation phase (discriminated union)
 */
export type InputValidationResult =
  | { valid: true; scopeInfo: ScopeInfo; packagePath: string }
  | { valid: false; error: UpdateErrorType };

/**
 * Result of skill discovery phase (discriminated union)
 */
export type DiscoveryResult =
  | { valid: true; skillPath: string; hasSkillMd: boolean }
  | { valid: false; error: UpdateErrorType };

/**
 * Result of package validation phase (discriminated union)
 */
export type PackageValidationPhaseResult =
  | { valid: true; skillNameFromPackage: string; files: string[]; tempDir?: string }
  | { valid: false; error: UpdateErrorType; tempDir?: string };

/**
 * Context built up during update phases
 */
export interface UpdateContext {
  /** Validated skill name */
  skillName: string;
  /** Resolved scope info */
  scopeInfo: ScopeInfo;
  /** Validated package path */
  packagePath: string;
  /** Discovered skill path */
  skillPath: string;
  /** Whether the skill has SKILL.md */
  hasSkillMd: boolean;
  /** Skill name from the package (for mismatch detection) */
  skillNameFromPackage: string;
  /** Files in the new package */
  packageFiles: string[];
  /** Temp directory with extracted package (must be cleaned up) */
  tempDir?: string;
}

/**
 * Validate all inputs before any file system operations
 *
 * Validates:
 * - Skill name format and security (no path traversal)
 * - Scope is 'project' or 'personal'
 * - Package file exists, has .skill extension, is valid ZIP
 *
 * @param skillName - Name of the skill to update
 * @param packagePath - Path to the new .skill package
 * @param options - Update options including scope
 * @returns Validation result with resolved values or error
 */
export async function validateInputs(
  skillName: string,
  packagePath: string,
  options: UpdateOptions
): Promise<InputValidationResult> {
  // Validate skill name (security-focused, rejects path traversal)
  const nameResult: UninstallNameValidationResult = validateSkillName(skillName);
  if (!nameResult.valid) {
    return {
      valid: false,
      error: {
        type: 'validation-error',
        field: 'skillName',
        message: nameResult.error || 'Invalid skill name',
      },
    };
  }

  // Validate scope (only 'project' or 'personal' allowed)
  const scopeResult: UninstallScopeValidationResult = validateUninstallScope(options.scope);
  if (!scopeResult.valid) {
    return {
      valid: false,
      error: {
        type: 'validation-error',
        field: 'scope',
        message: scopeResult.error || 'Invalid scope',
      },
    };
  }

  // Validate package file (exists, correct extension, valid ZIP)
  const packageResult: PackageFileValidationResult = await validatePackageFile(packagePath);
  if (!packageResult.valid) {
    return {
      valid: false,
      error: {
        type: 'validation-error',
        field: 'packagePath',
        message: packageResult.error || 'Invalid package file',
      },
    };
  }

  // Resolve scope to path
  const scopeInfo = resolveScope(scopeResult.scope, options.cwd, options.homedir);

  // packagePath is guaranteed to exist when valid is true (external type limitation)
  if (!packageResult.packagePath) {
    return {
      valid: false,
      error: {
        type: 'validation-error',
        field: 'packagePath',
        message: 'Package path was not resolved',
      },
    };
  }

  return {
    valid: true,
    scopeInfo,
    packagePath: packageResult.packagePath,
  };
}

/**
 * Discover the installed skill and verify it exists
 *
 * Uses the existing skill discovery logic from uninstall,
 * which includes case sensitivity verification.
 *
 * @param skillName - Name of the skill to find
 * @param scopeInfo - Resolved scope with target directory
 * @returns Discovery result with skill path or error
 */
export async function discoverInstalledSkill(
  skillName: string,
  scopeInfo: ScopeInfo
): Promise<DiscoveryResult> {
  const discoveryResult: SkillDiscoveryResult = await discoverSkill(skillName, scopeInfo);

  switch (discoveryResult.type) {
    case 'found':
      return {
        valid: true,
        skillPath: discoveryResult.path,
        hasSkillMd: discoveryResult.hasSkillMd,
      };

    case 'not-found':
      return {
        valid: false,
        error: {
          type: 'skill-not-found',
          skillName,
          searchedPath: discoveryResult.searchedPath,
        },
      };

    case 'case-mismatch':
      // Case mismatch is a security error on case-insensitive filesystems
      return {
        valid: false,
        error: {
          type: 'security-error',
          reason: 'case-mismatch',
          details:
            `Security error: Skill name case mismatch. ` +
            `Input: '${discoveryResult.expectedName}', Actual: '${discoveryResult.actualName}'. ` +
            `Use the exact case: '${discoveryResult.actualName}'`,
        },
      };
  }
}

/**
 * Perform additional case sensitivity verification (NFR-3)
 *
 * This is a defense-in-depth measure beyond what discoverSkill provides.
 * It reads the parent directory and byte-compares the actual entry name
 * with the input skill name to prevent symlink substitution attacks.
 *
 * @param skillPath - Full path to the discovered skill
 * @param skillName - The input skill name to verify
 * @returns Security error if case mismatch detected, null otherwise
 */
export async function verifyCaseSensitivity(
  skillPath: string,
  skillName: string
): Promise<UpdateErrorType | null> {
  const parentDir = path.dirname(skillPath);

  try {
    // Read parent directory entries
    const entries = await fs.readdir(parentDir);

    // Find the entry that matches case-insensitively
    const actualName = entries.find((entry) => entry.toLowerCase() === skillName.toLowerCase());

    if (!actualName) {
      // Entry not found (shouldn't happen if skillPath exists)
      return {
        type: 'security-error',
        reason: 'case-mismatch',
        details: `Entry not found in parent directory: ${skillName}`,
      };
    }

    // Byte-for-byte comparison
    if (actualName !== skillName) {
      return {
        type: 'security-error',
        reason: 'case-mismatch',
        details:
          `Security error: Skill name case mismatch. ` +
          `Input: '${skillName}', Actual: '${actualName}'. ` +
          `Use the exact case: '${actualName}'`,
      };
    }

    return null; // Case matches exactly
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      type: 'filesystem-error',
      operation: 'readdir',
      path: parentDir,
      message: `Failed to verify case sensitivity: ${message}`,
    };
  }
}

/**
 * Validate the new package structure and content
 *
 * Validates:
 * - Package has single root directory with SKILL.md
 * - Directory name matches SKILL.md frontmatter name
 * - Package skill name matches installed skill (FR-2 edge case 15)
 * - Package content passes all validation checks
 *
 * @param packagePath - Path to the validated .skill package
 * @param installedSkillName - Name of the installed skill (for mismatch check)
 * @returns Validation result with skill info or error
 */
export async function validatePackage(
  packagePath: string,
  installedSkillName: string
): Promise<PackageValidationPhaseResult> {
  let tempDir: string | undefined;

  try {
    // Open the archive
    const archive = openZipArchive(packagePath);

    // Validate structure (single root directory with SKILL.md)
    const structureResult: PackageStructureResult = validatePackageStructure(archive);
    if (!structureResult.valid) {
      return {
        valid: false,
        error: {
          type: 'validation-error',
          field: 'packageContent',
          message: structureResult.error || 'Invalid package structure',
        },
      };
    }

    const skillNameFromPackage = structureResult.rootDirectory as string;

    // Validate name match (directory name matches SKILL.md name field)
    const nameResult: NameMatchResult = validateNameMatch(archive);
    if (!nameResult.valid) {
      return {
        valid: false,
        error: {
          type: 'validation-error',
          field: 'packageContent',
          message: nameResult.error || 'Package name mismatch',
        },
      };
    }

    // FR-2 edge case 15: Verify package skill name matches installed skill
    if (skillNameFromPackage !== installedSkillName) {
      return {
        valid: false,
        error: {
          type: 'package-mismatch',
          installedSkillName,
          packageSkillName: skillNameFromPackage,
          message:
            `Package contains skill '${skillNameFromPackage}' but trying to update ` +
            `'${installedSkillName}'. The package skill name must match the installed skill.`,
        },
      };
    }

    // Extract to temp directory for content validation
    const extractResult: TempExtractionResult = await extractToTempDirectory(archive);
    if (!extractResult.success) {
      return {
        valid: false,
        error: {
          type: 'filesystem-error',
          operation: 'extract',
          path: packagePath,
          message: extractResult.error || 'Failed to extract package',
        },
      };
    }

    tempDir = extractResult.tempDir;

    // Validate package content (SKILL.md frontmatter, structure, etc.)
    const contentResult = await validatePackageContent(tempDir as string, skillNameFromPackage);
    if (!contentResult.valid) {
      return {
        valid: false,
        error: {
          type: 'validation-error',
          field: 'packageContent',
          message: 'Package content validation failed',
          details: contentResult.errors,
        },
        tempDir, // Return tempDir for cleanup
      };
    }

    // Get file list from package (for later use in comparison)
    const entries = archive.getEntries();
    const files = entries
      .filter((e) => !e.isDirectory)
      .map((e) => e.entryName.replace(`${skillNameFromPackage}/`, ''));

    return {
      valid: true,
      skillNameFromPackage,
      files,
      tempDir, // Return tempDir for later phases (will be cleaned up after update)
    };
  } catch (error) {
    // Clean up temp directory on error
    if (tempDir) {
      await cleanupTempDirectory(tempDir);
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      error: {
        type: 'validation-error',
        field: 'packageContent',
        message: `Package validation failed: ${message}`,
      },
    };
  }
}

/**
 * Run Phase 5 of the update process: Input & Discovery
 *
 * This runs all Phase 5 steps:
 * 1. Validate inputs (skill name, scope, package file)
 * 2. Discover installed skill
 * 3. Verify case sensitivity (defense-in-depth)
 * 4. Validate package structure and content
 *
 * Returns a context object with all validated information for later phases,
 * or an error if any validation fails.
 *
 * @param skillName - Name of the skill to update
 * @param packagePath - Path to the new .skill package
 * @param options - Update options
 * @returns Update context for later phases, or error
 */
export async function runInputAndDiscoveryPhase(
  skillName: string,
  packagePath: string,
  options: UpdateOptions
): Promise<{ success: true; context: UpdateContext } | { success: false; error: UpdateErrorType }> {
  // Step 1: Validate inputs
  const inputResult = await validateInputs(skillName, packagePath, options);
  if (!inputResult.valid) {
    return { success: false, error: inputResult.error };
  }

  const scopeInfo = inputResult.scopeInfo;
  const validatedPackagePath = inputResult.packagePath;

  // Step 2: Discover installed skill
  const discoveryResult = await discoverInstalledSkill(skillName, scopeInfo);
  if (!discoveryResult.valid) {
    return { success: false, error: discoveryResult.error };
  }

  const skillPath = discoveryResult.skillPath;
  const hasSkillMd = discoveryResult.hasSkillMd;

  // Step 3: Additional case sensitivity verification (NFR-3)
  const caseError = await verifyCaseSensitivity(skillPath, skillName);
  if (caseError) {
    return { success: false, error: caseError };
  }

  // Step 4: Validate package
  const packageResult = await validatePackage(validatedPackagePath, skillName);
  if (!packageResult.valid) {
    // Clean up temp directory if it was created
    if (packageResult.tempDir) {
      await cleanupTempDirectory(packageResult.tempDir);
    }
    return { success: false, error: packageResult.error };
  }

  // Build context for later phases
  const context: UpdateContext = {
    skillName,
    scopeInfo,
    packagePath: validatedPackagePath,
    skillPath,
    hasSkillMd,
    skillNameFromPackage: packageResult.skillNameFromPackage,
    packageFiles: packageResult.files,
    tempDir: packageResult.tempDir,
  };

  return { success: true, context };
}

/**
 * Main entry point for updating a skill
 *
 * Orchestrates the full update process:
 * - Phase 5: Input validation, discovery, package validation (this phase)
 * - Phase 6+: Security checks, backup, execution, rollback (future phases)
 *
 * @param skillName - Name of the skill to update
 * @param packagePath - Path to the new .skill package
 * @param options - Update options (scope, force, dryRun, etc.)
 * @returns Update result (success, dry-run preview, rollback, or rollback-failed)
 */
export async function updateSkill(
  skillName: string,
  packagePath: string,
  options: UpdateOptions
): Promise<UpdateResultUnion> {
  // Create initial state for tracking
  const state: UpdateState = {
    phase: 'validation',
    skillName,
    skillPath: '', // Will be set after discovery
    packagePath,
    lockAcquired: false,
  };

  try {
    // Run Phase 5: Input & Discovery
    state.phase = 'validation';
    const phase5Result = await runInputAndDiscoveryPhase(skillName, packagePath, options);

    if (!phase5Result.success) {
      // Clean up and return error-based result
      // For now, we convert errors to appropriate UpdateResultUnion types
      // This will be expanded in later phases
      const error = phase5Result.error;

      // Map error types to exit conditions
      // Phase 6+ will add full result type handling
      throw new UpdateError(error);
    }

    const context = phase5Result.context;
    state.skillPath = context.skillPath;

    // TODO: Phase 6 - Security checks
    state.phase = 'security-check';

    // TODO: Phase 7 - Preparation (lock, backup, confirmation)
    state.phase = 'backup';

    // TODO: Phase 8 - Execution
    state.phase = 'execution';

    // TODO: Phase 9 - Recovery paths and cleanup
    state.phase = 'cleanup';

    // Placeholder: Return dry-run preview for now
    // This will be replaced with full implementation in later phases
    if (options.dryRun) {
      // Clean up temp directory
      if (context.tempDir) {
        await cleanupTempDirectory(context.tempDir);
      }

      return {
        type: 'update-dry-run-preview',
        skillName: context.skillName,
        path: context.skillPath,
        currentVersion: {
          path: context.skillPath,
          fileCount: 0, // Will be calculated in Phase 6
          size: 0, // Will be calculated in Phase 6
        },
        newVersion: {
          path: context.packagePath,
          fileCount: context.packageFiles.length,
          size: 0, // Will be calculated in Phase 6
        },
        comparison: {
          filesAdded: [],
          filesRemoved: [],
          filesModified: [],
          addedCount: 0,
          removedCount: 0,
          modifiedCount: 0,
          sizeChange: 0,
        },
        backupPath: '~/.asm/backups/', // Placeholder
      };
    }

    // Placeholder: Return success for non-dry-run
    // This will be replaced with full implementation in later phases
    // Clean up temp directory
    if (context.tempDir) {
      await cleanupTempDirectory(context.tempDir);
    }

    return {
      type: 'update-success',
      skillName: context.skillName,
      path: context.skillPath,
      previousFileCount: 0, // Will be set in Phase 8
      currentFileCount: context.packageFiles.length,
      previousSize: 0, // Will be set in Phase 8
      currentSize: 0, // Will be set in Phase 8
      backupPath: undefined, // Will be set in Phase 7
      backupWillBeRemoved: !options.keepBackup,
    };
  } catch (error) {
    // Handle errors - will be expanded in Phase 9
    if (error instanceof UpdateError) {
      // Convert to appropriate result type based on error
      // This will be expanded in later phases
    }

    // For now, throw to surface unexpected errors
    throw error;
  }
}

/**
 * Custom error class for update operations
 *
 * Wraps UpdateError discriminated union for throwing/catching
 */
export class UpdateError extends Error {
  public readonly updateError: import('../types/update').UpdateError;

  constructor(updateError: import('../types/update').UpdateError) {
    super(getErrorMessage(updateError));
    this.name = 'UpdateError';
    this.updateError = updateError;
  }
}

/**
 * Get a human-readable message from an UpdateError
 */
function getErrorMessage(error: import('../types/update').UpdateError): string {
  switch (error.type) {
    case 'skill-not-found':
      return `Skill not found: ${error.skillName} (searched: ${error.searchedPath})`;
    case 'security-error':
      return `Security error (${error.reason}): ${error.details}`;
    case 'filesystem-error':
      return `File system error during ${error.operation}: ${error.message}`;
    case 'validation-error':
      return `Validation error for ${error.field}: ${error.message}`;
    case 'package-mismatch':
      return error.message;
    case 'backup-creation-error':
      return `Backup creation failed: ${error.reason}`;
    case 'rollback-error':
      return `Update failed but rollback succeeded: ${error.updateFailureReason}`;
    case 'critical-error':
      return `Critical error: ${error.updateFailureReason}. Rollback also failed: ${error.rollbackFailureReason}`;
    case 'timeout':
      return `Operation '${error.operationName}' timed out after ${error.timeoutMs}ms`;
    default:
      return 'Unknown update error';
  }
}
