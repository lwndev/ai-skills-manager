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
  VersionComparison,
  VersionInfo,
  DowngradeInfo,
  HardLinkCheckResult,
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
import { resolveScope, isPathWithin } from '../utils/scope-resolver';
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
import { openZipArchive, getZipEntries } from '../utils/extractor';
import { checkSymlinkSafety, detectHardLinkWarnings } from './security-checker';
import {
  compareVersions,
  extractMetadata,
  extractPackageMetadata,
  detectDowngrade,
  getInstalledVersionInfo,
  getPackageVersionInfo,
} from '../services/version-comparator';
import { enumerateSkillFiles } from './file-enumerator';
import {
  validateBackupWritability,
  createBackup,
  cleanupBackup,
  generateUniqueBackupPath,
  type BackupOptions,
} from '../services/backup-manager';
import {
  formatConfirmationPrompt,
  formatDowngradeWarning,
  formatNoBackupWarning,
  formatBackupCreated,
} from '../formatters/update-formatter';

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
 * Result of security checks phase (discriminated union)
 */
export type SecurityCheckResult =
  | { safe: true; warnings: string[] }
  | { safe: false; error: UpdateErrorType };

/**
 * Result of version analysis phase (discriminated union)
 */
export type VersionAnalysisResult =
  | {
      valid: true;
      comparison: VersionComparison;
      installedInfo: VersionInfo;
      packageInfo: VersionInfo;
      downgradeInfo: DowngradeInfo | null;
    }
  | { valid: false; error: UpdateErrorType };

/**
 * Result of lock acquisition (discriminated union)
 */
export type LockAcquisitionPhaseResult =
  | { acquired: true; lockPath: string }
  | { acquired: false; error: UpdateErrorType };

/**
 * Result of backup creation (discriminated union)
 */
export type BackupCreationPhaseResult =
  | { created: true; backupPath: string; fileCount: number; size: number }
  | { skipped: true; reason: 'no-backup-flag' }
  | { created: false; error: UpdateErrorType };

/**
 * Result of user confirmation (discriminated union)
 */
export type ConfirmationPhaseResult =
  | { confirmed: true }
  | { confirmed: false; reason: 'user-cancelled' | 'force-flag' };

/**
 * Result of the preparation phase (Phase 7)
 */
export type PreparationPhaseResult =
  | {
      success: true;
      context: UpdateContext;
    }
  | { success: false; error: UpdateErrorType }
  | { success: false; cancelled: true };

/**
 * Resource limits for update operations (NFR-8)
 */
export const RESOURCE_LIMITS = {
  /** Maximum skill size in bytes (1GB) */
  MAX_SKILL_SIZE: 1024 * 1024 * 1024,
  /** Maximum file count */
  MAX_FILE_COUNT: 10000,
  /** Overall update timeout in milliseconds (5 minutes) */
  UPDATE_TIMEOUT_MS: 5 * 60 * 1000,
  /** Backup creation timeout in milliseconds (2 minutes) */
  BACKUP_TIMEOUT_MS: 2 * 60 * 1000,
  /** Extraction timeout in milliseconds (2 minutes) */
  EXTRACTION_TIMEOUT_MS: 2 * 60 * 1000,
  /** Package validation timeout in milliseconds (5 seconds per NFR-1) */
  VALIDATION_TIMEOUT_MS: 5 * 1000,
} as const;

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

  // Phase 6 fields - security and analysis
  /** Security warnings (non-blocking) */
  securityWarnings?: string[];
  /** Hard link check result */
  hardLinkCheck?: HardLinkCheckResult;
  /** Version comparison result */
  comparison?: VersionComparison;
  /** Installed version info */
  installedInfo?: VersionInfo;
  /** New package version info */
  packageInfo?: VersionInfo;
  /** Downgrade detection info */
  downgradeInfo?: DowngradeInfo | null;

  // Phase 7 fields - preparation
  /** Path to the lock file (if acquired) */
  lockPath?: string;
  /** Path to the backup file (if created) */
  backupPath?: string;
  /** Number of files in the backup */
  backupFileCount?: number;
  /** Size of the backup in bytes */
  backupSize?: number;
  /** Whether backup was skipped (--no-backup flag) */
  backupSkipped?: boolean;
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

// ============================================================================
// Phase 6: Security & Analysis
// ============================================================================

/**
 * Check symlink safety for the installed skill directory
 *
 * Verifies that the skill directory (if a symlink) points within the scope boundary.
 *
 * @param skillPath - Full path to the skill directory
 * @param scopePath - The scope boundary path
 * @returns Security check result
 */
export async function checkSkillSymlinkSafety(
  skillPath: string,
  scopePath: string
): Promise<SecurityCheckResult> {
  const result = await checkSymlinkSafety(skillPath, scopePath);

  switch (result.type) {
    case 'safe':
      return { safe: true, warnings: [] };

    case 'escape':
      return {
        safe: false,
        error: {
          type: 'security-error',
          reason: 'symlink-escape',
          details:
            `Skill directory is a symlink that escapes the scope boundary. ` +
            `Target: ${result.targetPath}, Scope: ${result.scopeBoundary}`,
        },
      };

    case 'error':
      return {
        safe: false,
        error: {
          type: 'filesystem-error',
          operation: 'stat',
          path: skillPath,
          message: result.message,
        },
      };
  }
}

/**
 * Check for hard links in the skill directory
 *
 * Hard links can cause unexpected behavior during updates since the same inode
 * is referenced from multiple locations.
 *
 * @param skillPath - Full path to the skill directory
 * @param force - Whether to allow hard links with warning
 * @returns Hard link check result
 */
export async function checkSkillHardLinks(
  skillPath: string,
  force: boolean
): Promise<{ result: HardLinkCheckResult; error?: UpdateErrorType }> {
  const warning = await detectHardLinkWarnings(skillPath);

  if (!warning) {
    return {
      result: {
        hasHardLinks: false,
        hardLinkedFiles: [],
        requiresForce: false,
      },
    };
  }

  const hardLinkCheck: HardLinkCheckResult = {
    hasHardLinks: true,
    hardLinkedFiles: warning.files.map((f) => ({
      path: f.relativePath,
      linkCount: f.linkCount,
    })),
    requiresForce: !force,
  };

  // If hard links detected and --force not set, return error
  if (!force) {
    return {
      result: hardLinkCheck,
      error: {
        type: 'security-error',
        reason: 'hard-link-detected',
        details: warning.message,
      },
    };
  }

  // Hard links detected but --force is set, continue with warning
  return { result: hardLinkCheck };
}

/**
 * Validate ZIP entries for path traversal attacks (FR-15)
 *
 * Checks that no ZIP entries contain paths that would escape the target directory.
 *
 * @param packagePath - Path to the .skill package
 * @param rootDir - Expected root directory in the package
 * @returns Security check result
 */
export function validateZipEntrySecurity(
  packagePath: string,
  rootDir: string
): SecurityCheckResult {
  const archive = openZipArchive(packagePath);
  const entries = getZipEntries(archive);
  const warnings: string[] = [];

  for (const entry of entries) {
    const entryName = entry.entryName;

    // Check for absolute paths
    if (path.isAbsolute(entryName)) {
      return {
        safe: false,
        error: {
          type: 'security-error',
          reason: 'zip-entry-escape',
          details: `Package contains absolute path: ${entryName}`,
        },
      };
    }

    // Check for path traversal sequences
    if (entryName.includes('..')) {
      return {
        safe: false,
        error: {
          type: 'security-error',
          reason: 'zip-entry-escape',
          details: `Package contains path traversal: ${entryName}`,
        },
      };
    }

    // Check for entries outside the root directory
    if (!entryName.startsWith(`${rootDir}/`) && entryName !== `${rootDir}/`) {
      if (!entry.isDirectory || entryName !== rootDir) {
        return {
          safe: false,
          error: {
            type: 'security-error',
            reason: 'zip-entry-escape',
            details: `Package contains entry outside root directory: ${entryName}`,
          },
        };
      }
    }

    // Check for null bytes in path
    if (entryName.includes('\0')) {
      return {
        safe: false,
        error: {
          type: 'security-error',
          reason: 'path-traversal',
          details: `Package contains null byte in path: ${entryName.replace(/\0/g, '\\0')}`,
        },
      };
    }
  }

  return { safe: true, warnings };
}

/**
 * Check resource limits (NFR-8)
 *
 * Verifies that the skill doesn't exceed size or file count limits.
 *
 * @param skillPath - Full path to the skill directory
 * @param force - Whether to bypass limits
 * @returns Error if limits exceeded and --force not set
 */
export async function checkResourceLimits(
  skillPath: string,
  force: boolean
): Promise<{ withinLimits: true } | { withinLimits: false; error: UpdateErrorType }> {
  let totalSize = 0;
  let fileCount = 0;

  for await (const file of enumerateSkillFiles(skillPath)) {
    if (!file.isDirectory && !file.isSymlink) {
      fileCount++;
      totalSize += file.size;
    }
  }

  const errors: string[] = [];

  if (totalSize > RESOURCE_LIMITS.MAX_SKILL_SIZE) {
    const sizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);
    errors.push(`Skill size (${sizeGB}GB) exceeds limit (1GB)`);
  }

  if (fileCount > RESOURCE_LIMITS.MAX_FILE_COUNT) {
    errors.push(`File count (${fileCount}) exceeds limit (${RESOURCE_LIMITS.MAX_FILE_COUNT})`);
  }

  if (errors.length > 0 && !force) {
    return {
      withinLimits: false,
      error: {
        type: 'validation-error',
        field: 'packageContent',
        message: `Resource limits exceeded. ${errors.join('. ')}. Use --force to bypass.`,
        details: errors,
      },
    };
  }

  return { withinLimits: true };
}

/**
 * Verify path containment (TOCTOU protection)
 *
 * Re-verifies that a path is still within the expected scope immediately
 * before a destructive operation.
 *
 * @param targetPath - Path to verify
 * @param scopePath - Expected scope boundary
 * @returns Error if path escapes scope
 */
export async function verifyPathContainment(
  targetPath: string,
  scopePath: string
): Promise<UpdateErrorType | null> {
  try {
    // Resolve both paths (following symlinks) to handle macOS /private/var vs /var
    const realTargetPath = await fs.realpath(targetPath);
    const realScopePath = await fs.realpath(scopePath);

    // Check if real path is within scope (both resolved)
    if (!isPathWithin(realTargetPath, realScopePath)) {
      return {
        type: 'security-error',
        reason: 'containment-violation',
        details: `Path escapes scope after resolution. Real path: ${realTargetPath}, Scope: ${realScopePath}`,
      };
    }

    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      type: 'filesystem-error',
      operation: 'stat',
      path: targetPath,
      message: `Failed to verify path containment: ${message}`,
    };
  }
}

/**
 * Perform version comparison and analysis
 *
 * @param skillPath - Path to the installed skill
 * @param packagePath - Path to the new package
 * @returns Version analysis result
 */
export async function analyzeVersions(
  skillPath: string,
  packagePath: string
): Promise<VersionAnalysisResult> {
  try {
    // Get version info for both
    const installedInfo = await getInstalledVersionInfo(skillPath);
    const packageInfo = await getPackageVersionInfo(packagePath);

    // Compare versions
    const comparison = await compareVersions(skillPath, packagePath);

    // Detect potential downgrade
    const installedMetadata = await extractMetadata(skillPath);
    const packageMetadata = await extractPackageMetadata(packagePath);
    const downgradeInfo = detectDowngrade(installedMetadata, packageMetadata);

    return {
      valid: true,
      comparison,
      installedInfo,
      packageInfo,
      downgradeInfo,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      error: {
        type: 'filesystem-error',
        operation: 'read',
        path: skillPath,
        message: `Version analysis failed: ${message}`,
      },
    };
  }
}

/**
 * Run Phase 6 of the update process: Security & Analysis
 *
 * This runs all Phase 6 steps:
 * 1. Check symlink safety
 * 2. Check for hard links
 * 3. Validate ZIP entry security
 * 4. Check resource limits
 * 5. Verify path containment
 * 6. Analyze versions and compare
 *
 * @param context - Update context from Phase 5
 * @param options - Update options
 * @returns Updated context with security/analysis info, or error
 */
export async function runSecurityAndAnalysisPhase(
  context: UpdateContext,
  options: UpdateOptions
): Promise<{ success: true; context: UpdateContext } | { success: false; error: UpdateErrorType }> {
  const warnings: string[] = [];

  // Step 1: Check symlink safety
  const symlinkResult = await checkSkillSymlinkSafety(context.skillPath, context.scopeInfo.path);
  if (!symlinkResult.safe) {
    return { success: false, error: symlinkResult.error };
  }
  warnings.push(...symlinkResult.warnings);

  // Step 2: Check for hard links
  const hardLinkResult = await checkSkillHardLinks(context.skillPath, options.force);
  if (hardLinkResult.error) {
    return { success: false, error: hardLinkResult.error };
  }

  // Step 3: Validate ZIP entry security
  const zipSecurityResult = validateZipEntrySecurity(
    context.packagePath,
    context.skillNameFromPackage
  );
  if (!zipSecurityResult.safe) {
    return { success: false, error: zipSecurityResult.error };
  }
  warnings.push(...zipSecurityResult.warnings);

  // Step 4: Check resource limits
  const resourceResult = await checkResourceLimits(context.skillPath, options.force);
  if (!resourceResult.withinLimits) {
    return { success: false, error: resourceResult.error };
  }

  // Step 5: Verify path containment (TOCTOU protection)
  const containmentError = await verifyPathContainment(context.skillPath, context.scopeInfo.path);
  if (containmentError) {
    return { success: false, error: containmentError };
  }

  // Step 6: Analyze versions
  const versionResult = await analyzeVersions(context.skillPath, context.packagePath);
  if (!versionResult.valid) {
    return { success: false, error: versionResult.error };
  }

  // Update context with Phase 6 results
  const updatedContext: UpdateContext = {
    ...context,
    securityWarnings: warnings,
    hardLinkCheck: hardLinkResult.result,
    comparison: versionResult.comparison,
    installedInfo: versionResult.installedInfo,
    packageInfo: versionResult.packageInfo,
    downgradeInfo: versionResult.downgradeInfo,
  };

  return { success: true, context: updatedContext };
}

// ============================================================================
// Phase 7: Preparation (Lock, Backup, Confirmation)
// ============================================================================

/** Lock file extension for update operations */
const UPDATE_LOCK_EXTENSION = '.asm-update.lock';

/** Maximum age of a lock file before it's considered stale (5 minutes) */
const MAX_UPDATE_LOCK_AGE_MS = 5 * 60 * 1000;

/**
 * Helper: Check if an error has a specific error code
 */
function hasErrorCode(error: unknown, code: string): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: unknown }).code === code;
  }
  return false;
}

/**
 * Acquire a lock for the update operation (FR-17)
 *
 * Creates a lock file in the skill's parent directory to prevent concurrent
 * update operations on the same skill. The lock file contains process info.
 *
 * @param skillPath - Path to the skill directory being updated
 * @param packagePath - Path to the new package
 * @returns Lock acquisition result with lock path or error
 */
export async function acquireUpdateLock(
  skillPath: string,
  packagePath: string
): Promise<LockAcquisitionPhaseResult> {
  const skillName = path.basename(skillPath);
  const parentDir = path.dirname(skillPath);
  const lockPath = path.join(parentDir, `${skillName}${UPDATE_LOCK_EXTENSION}`);

  try {
    // Check if lock already exists
    try {
      const stats = await fs.stat(lockPath);
      const age = Date.now() - stats.mtimeMs;

      // If lock is stale (older than MAX_UPDATE_LOCK_AGE_MS), remove it
      if (age > MAX_UPDATE_LOCK_AGE_MS) {
        await fs.unlink(lockPath);
      } else {
        // Lock exists and is not stale - read lock info for error message
        const lockContent = await fs.readFile(lockPath, 'utf-8');
        let lockInfo: { pid?: number; timestamp?: string } = {};
        try {
          lockInfo = JSON.parse(lockContent);
        } catch {
          // Ignore parse errors
        }

        return {
          acquired: false,
          error: {
            type: 'validation-error',
            field: 'skillName',
            message: `Skill "${skillName}" is currently being updated by another process (PID: ${lockInfo.pid ?? 'unknown'})`,
            details: [
              `Lock acquired: ${lockInfo.timestamp ?? 'unknown'}`,
              'If the previous update was interrupted, remove the lock file:',
              `  rm "${lockPath}"`,
            ],
          },
        };
      }
    } catch (error) {
      // Lock file doesn't exist, which is fine
      if (!hasErrorCode(error, 'ENOENT')) {
        throw error;
      }
    }

    // Create the lock file with update-specific content
    const lockContent = JSON.stringify({
      pid: process.pid,
      timestamp: new Date().toISOString(),
      operationType: 'update',
      skillPath,
      packagePath,
    });

    // Use exclusive flag to prevent race conditions
    await fs.writeFile(lockPath, lockContent, { flag: 'wx' });

    return {
      acquired: true,
      lockPath,
    };
  } catch (error) {
    // If the file was created by another process between our check and write
    if (hasErrorCode(error, 'EEXIST')) {
      return {
        acquired: false,
        error: {
          type: 'validation-error',
          field: 'skillName',
          message: `Skill "${skillName}" is currently being updated by another process`,
        },
      };
    }

    // Other filesystem errors
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      acquired: false,
      error: {
        type: 'filesystem-error',
        operation: 'write',
        path: lockPath,
        message: `Failed to acquire update lock: ${message}`,
      },
    };
  }
}

/**
 * Release an update lock
 *
 * Removes the lock file. This should be called after the update operation
 * completes, regardless of success or failure.
 *
 * @param lockPath - Path to the lock file to release
 */
export async function releaseUpdateLock(lockPath: string): Promise<void> {
  try {
    await fs.unlink(lockPath);
  } catch {
    // Ignore errors when releasing lock - file may have already been removed
  }
}

/**
 * Check if an update lock exists for a skill
 *
 * @param skillPath - Path to the skill directory
 * @returns True if a lock exists and is not stale
 */
export async function hasUpdateLock(skillPath: string): Promise<boolean> {
  const skillName = path.basename(skillPath);
  const parentDir = path.dirname(skillPath);
  const lockPath = path.join(parentDir, `${skillName}${UPDATE_LOCK_EXTENSION}`);

  try {
    const stats = await fs.stat(lockPath);
    const age = Date.now() - stats.mtimeMs;

    // Lock is considered active if it's not stale
    return age <= MAX_UPDATE_LOCK_AGE_MS;
  } catch {
    return false;
  }
}

/**
 * Create a backup of the skill before updating (FR-4)
 *
 * Creates a backup archive of the installed skill. The backup can be used
 * for rollback if the update fails.
 *
 * @param context - Update context with skill info
 * @param options - Update options
 * @param backupOptions - Optional backup-specific options
 * @returns Backup creation result
 */
export async function createUpdateBackup(
  context: UpdateContext,
  options: UpdateOptions,
  backupOptions?: BackupOptions
): Promise<BackupCreationPhaseResult> {
  // Skip backup if --no-backup flag is set
  if (options.noBackup) {
    return { skipped: true, reason: 'no-backup-flag' };
  }

  // First validate backup writability (Edge case 20)
  const writabilityResult = await validateBackupWritability({
    homedir: options.homedir,
  });

  if (!writabilityResult.writable) {
    return {
      created: false,
      error: {
        type: 'backup-creation-error',
        backupPath: '~/.asm/backups/',
        reason: writabilityResult.error ?? 'Backup directory is not writable',
      },
    };
  }

  // Create the backup
  const backupResult = await createBackup(context.skillPath, context.skillName, {
    homedir: options.homedir,
    ...backupOptions,
  });

  if (!backupResult.success) {
    return {
      created: false,
      error: {
        type: 'backup-creation-error',
        backupPath: backupResult.path || '~/.asm/backups/',
        reason: backupResult.error ?? 'Backup creation failed',
      },
    };
  }

  return {
    created: true,
    backupPath: backupResult.path,
    fileCount: backupResult.fileCount,
    size: backupResult.size,
  };
}

/**
 * Show confirmation prompt for update (FR-5)
 *
 * Displays update summary and asks for user confirmation unless --force is set.
 *
 * @param context - Update context with version comparison
 * @param options - Update options
 * @param backupPath - Path where backup was created (or will be)
 * @param confirmFn - Confirmation function (for testing)
 * @returns Confirmation result
 */
export async function confirmUpdate(
  context: UpdateContext,
  options: UpdateOptions,
  backupPath: string,
  confirmFn?: (prompt: string) => Promise<boolean>
): Promise<ConfirmationPhaseResult> {
  // Skip confirmation if --force is set
  if (options.force) {
    return { confirmed: false, reason: 'force-flag' };
  }

  // Build confirmation prompt
  const currentVersion = context.installedInfo ?? {
    path: context.skillPath,
    fileCount: 0,
    size: 0,
  };

  const newVersion = context.packageInfo ?? {
    path: context.packagePath,
    fileCount: context.packageFiles.length,
    size: 0,
  };

  const comparison = context.comparison ?? {
    filesAdded: [],
    filesRemoved: [],
    filesModified: [],
    addedCount: 0,
    removedCount: 0,
    modifiedCount: 0,
    sizeChange: 0,
  };

  let promptMessage = formatConfirmationPrompt(
    context.skillName,
    currentVersion,
    newVersion,
    comparison,
    backupPath
  );

  // Add downgrade warning if applicable
  if (context.downgradeInfo?.isDowngrade) {
    promptMessage = formatDowngradeWarning(context.downgradeInfo) + promptMessage;
  }

  // Show the prompt
  console.log(promptMessage);

  // Get confirmation from user
  const confirmFunction = confirmFn ?? defaultConfirm;
  const confirmed = await confirmFunction(`Proceed with update?`);

  if (!confirmed) {
    return { confirmed: false, reason: 'user-cancelled' };
  }

  return { confirmed: true };
}

/**
 * Default confirmation function using readline
 */
async function defaultConfirm(question: string): Promise<boolean> {
  // Import readline dynamically to avoid issues in tests
  const readline = await import('readline');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      const normalizedAnswer = answer.trim().toLowerCase();
      resolve(normalizedAnswer === 'y' || normalizedAnswer === 'yes');
    });
  });
}

/**
 * Run Phase 7 of the update process: Preparation
 *
 * This runs all Phase 7 steps:
 * 1. Acquire lock to prevent concurrent updates
 * 2. Create backup (unless --no-backup)
 * 3. Show confirmation prompt (unless --force)
 *
 * @param context - Update context from Phase 6
 * @param options - Update options
 * @param confirmFn - Optional confirmation function (for testing)
 * @returns Updated context with preparation info, or error/cancellation
 */
export async function runPreparationPhase(
  context: UpdateContext,
  options: UpdateOptions,
  confirmFn?: (prompt: string) => Promise<boolean>
): Promise<PreparationPhaseResult> {
  // Step 1: Acquire lock
  const lockResult = await acquireUpdateLock(context.skillPath, context.packagePath);
  if (!lockResult.acquired) {
    return { success: false, error: lockResult.error };
  }

  const lockPath = lockResult.lockPath;
  let backupPath: string | undefined;
  let backupFileCount: number | undefined;
  let backupSize: number | undefined;
  let backupSkipped = false;

  try {
    // Step 2: Create backup (unless --no-backup)
    // First validate writability if not using --no-backup
    if (!options.noBackup) {
      const writabilityResult = await validateBackupWritability({
        homedir: options.homedir,
      });

      if (!writabilityResult.writable) {
        return {
          success: false,
          error: {
            type: 'backup-creation-error',
            backupPath: '~/.asm/backups/',
            reason: writabilityResult.error ?? 'Backup directory is not writable',
          },
        };
      }
    }

    const backupResult = await createUpdateBackup(context, options);

    if ('error' in backupResult) {
      // Release lock before returning error
      await releaseUpdateLock(lockPath);
      return { success: false, error: backupResult.error };
    }

    if ('skipped' in backupResult) {
      backupSkipped = true;
      // Show warning about no backup
      if (!options.quiet) {
        console.log(formatNoBackupWarning());
      }
      // Generate a backup path anyway for confirmation display
      backupPath = await generateUniqueBackupPath(context.skillName, {
        homedir: options.homedir,
      });
    } else {
      backupPath = backupResult.backupPath;
      backupFileCount = backupResult.fileCount;
      backupSize = backupResult.size;

      // Show backup created message
      if (!options.quiet) {
        console.log(formatBackupCreated(backupPath));
      }
    }

    // Step 3: Show confirmation prompt (unless --force)
    const confirmResult = await confirmUpdate(context, options, backupPath, confirmFn);

    if (!confirmResult.confirmed && confirmResult.reason === 'user-cancelled') {
      // User cancelled - clean up lock and backup
      await releaseUpdateLock(lockPath);

      // Remove backup if it was created
      if (!backupSkipped && backupPath) {
        try {
          await cleanupBackup(backupPath, { homedir: options.homedir });
        } catch {
          // Ignore cleanup errors
        }
      }

      return { success: false, cancelled: true };
    }

    // Update context with Phase 7 results
    const updatedContext: UpdateContext = {
      ...context,
      lockPath,
      backupPath: backupSkipped ? undefined : backupPath,
      backupFileCount,
      backupSize,
      backupSkipped,
    };

    return { success: true, context: updatedContext };
  } catch (error) {
    // Clean up lock on unexpected error
    await releaseUpdateLock(lockPath);

    // Clean up backup if it was created
    if (!backupSkipped && backupPath) {
      try {
        await cleanupBackup(backupPath, { homedir: options.homedir });
      } catch {
        // Ignore cleanup errors
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: {
        type: 'filesystem-error',
        operation: 'write',
        path: context.skillPath,
        message: `Preparation phase failed: ${message}`,
      },
    };
  }
}

/**
 * Wrap an operation with a timeout
 *
 * @param operation - Async operation to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Name of the operation for error messages
 * @returns Result of the operation or timeout error
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<{ success: true; result: T } | { success: false; error: UpdateErrorType }> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({
        success: false,
        error: {
          type: 'timeout',
          operationName,
          timeoutMs,
        },
      });
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve({ success: true, result });
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        const message = error instanceof Error ? error.message : 'Unknown error';
        resolve({
          success: false,
          error: {
            type: 'filesystem-error',
            operation: 'read',
            path: operationName,
            message,
          },
        });
      });
  });
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

    let context = phase5Result.context;
    state.skillPath = context.skillPath;

    // Run Phase 6: Security & Analysis
    state.phase = 'security-check';
    const phase6Result = await runSecurityAndAnalysisPhase(context, options);

    if (!phase6Result.success) {
      // Clean up temp directory
      if (context.tempDir) {
        await cleanupTempDirectory(context.tempDir);
      }
      throw new UpdateError(phase6Result.error);
    }

    context = phase6Result.context;

    // Return dry-run preview with actual version info from Phase 6
    // (dry-run skips phases 7-9)
    if (options.dryRun) {
      // Clean up temp directory
      if (context.tempDir) {
        await cleanupTempDirectory(context.tempDir);
      }

      // Generate a preview backup path
      const previewBackupPath = await generateUniqueBackupPath(context.skillName, {
        homedir: options.homedir,
      });

      return {
        type: 'update-dry-run-preview',
        skillName: context.skillName,
        path: context.skillPath,
        currentVersion: context.installedInfo ?? {
          path: context.skillPath,
          fileCount: 0,
          size: 0,
        },
        newVersion: context.packageInfo ?? {
          path: context.packagePath,
          fileCount: context.packageFiles.length,
          size: 0,
        },
        comparison: context.comparison ?? {
          filesAdded: [],
          filesRemoved: [],
          filesModified: [],
          addedCount: 0,
          removedCount: 0,
          modifiedCount: 0,
          sizeChange: 0,
        },
        backupPath: previewBackupPath,
      };
    }

    // Run Phase 7: Preparation (lock, backup, confirmation)
    state.phase = 'backup';
    const phase7Result = await runPreparationPhase(context, options);

    if (!phase7Result.success) {
      // Clean up temp directory
      if (context.tempDir) {
        await cleanupTempDirectory(context.tempDir);
      }

      // Check if user cancelled
      if ('cancelled' in phase7Result && phase7Result.cancelled) {
        // Return a special result for user cancellation
        // For now, we return a success-like result with cancelled flag
        // This will be handled properly in Phase 9
        return {
          type: 'update-success',
          skillName: context.skillName,
          path: context.skillPath,
          previousFileCount: 0,
          currentFileCount: 0,
          previousSize: 0,
          currentSize: 0,
          backupPath: undefined,
          backupWillBeRemoved: true,
        };
      }

      // Must be error case
      if ('error' in phase7Result) {
        throw new UpdateError(phase7Result.error);
      }

      // Should never reach here, but TypeScript needs this
      throw new Error('Unexpected preparation phase result');
    }

    context = phase7Result.context;
    state.lockAcquired = true;
    state.lockPath = context.lockPath;
    state.backupPath = context.backupPath;

    // TODO: Phase 8 - Execution
    state.phase = 'execution';

    // TODO: Phase 9 - Recovery paths and cleanup
    state.phase = 'cleanup';

    // Release lock after successful operation
    if (context.lockPath) {
      await releaseUpdateLock(context.lockPath);
      state.lockAcquired = false;
    }

    // Placeholder: Return success for non-dry-run
    // This will be replaced with full implementation in Phase 8
    // Clean up temp directory
    if (context.tempDir) {
      await cleanupTempDirectory(context.tempDir);
    }

    return {
      type: 'update-success',
      skillName: context.skillName,
      path: context.skillPath,
      previousFileCount: context.installedInfo?.fileCount ?? 0,
      currentFileCount: context.packageInfo?.fileCount ?? context.packageFiles.length,
      previousSize: context.installedInfo?.size ?? 0,
      currentSize: context.packageInfo?.size ?? 0,
      backupPath: context.backupPath,
      backupWillBeRemoved: !options.keepBackup && !context.backupSkipped,
    };
  } catch (error) {
    // Clean up lock if acquired
    if (state.lockAcquired && state.lockPath) {
      await releaseUpdateLock(state.lockPath);
    }

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
