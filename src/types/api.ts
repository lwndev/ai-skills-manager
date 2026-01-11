/**
 * Public API type definitions for the AI Skills Manager.
 *
 * These types define the options and results for all programmatic API functions.
 * All types are exported from the main package entry point.
 *
 * @module types/api
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Scope for skill installation operations.
 *
 * - `'project'`: Install to `.claude/skills/` in the current project
 * - `'personal'`: Install to `~/.claude/skills/` for personal use
 */
export type ApiScope = 'project' | 'personal';

/**
 * Extended scope including 'all' for list operations.
 */
export type ApiListScope = ApiScope | 'all';

/**
 * Scope for installed skills, including custom paths.
 */
export type InstalledSkillScope = ApiScope | 'custom';

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Represents a validation issue (error) found during skill validation.
 *
 * Used in `ValidateResult.errors` and `ValidationError.issues`.
 */
export interface ValidationIssue {
  /**
   * Machine-readable error code (e.g., 'MISSING_FRONTMATTER', 'INVALID_NAME').
   */
  code: string;

  /**
   * Human-readable description of the issue.
   */
  message: string;

  /**
   * Optional path to the file or JSON path where the issue was found.
   */
  path?: string;
}

/**
 * Represents a validation warning (non-blocking issue) found during skill validation.
 *
 * Warnings indicate potential problems but do not prevent the skill from being valid.
 */
export interface ValidationWarning {
  /**
   * Machine-readable warning code.
   */
  code: string;

  /**
   * Human-readable description of the warning.
   */
  message: string;

  /**
   * Optional path to the file or JSON path where the warning was found.
   */
  path?: string;
}

/**
 * Result of validating a skill.
 *
 * Always returned by `validate()` - validation failures do not throw.
 */
export interface ValidateResult {
  /**
   * Whether the skill passed all validation checks.
   */
  valid: boolean;

  /**
   * Array of validation errors (empty if valid is true).
   */
  errors: ValidationIssue[];

  /**
   * Array of validation warnings (non-blocking issues).
   */
  warnings: ValidationWarning[];
}

// ============================================================================
// Scaffold Types
// ============================================================================

/**
 * Options for scaffolding a new skill.
 */
export interface ScaffoldOptions {
  /**
   * Name of the skill to create.
   * Must be a valid skill name (lowercase, hyphens allowed).
   */
  name: string;

  /**
   * Optional description for the skill.
   */
  description?: string;

  /**
   * Output directory path.
   * Defaults to `.claude/skills/` for project scope or `~/.claude/skills/` for personal.
   */
  output?: string;

  /**
   * Scope for the scaffolded skill.
   * Defaults to `'project'`.
   */
  scope?: ApiScope;

  /**
   * List of tools the skill is allowed to use.
   * Written to the SKILL.md frontmatter.
   */
  allowedTools?: string[];

  /**
   * Force creation even if directory already exists.
   * Defaults to `false`.
   */
  force?: boolean;
}

/**
 * Result of scaffolding a new skill.
 */
export interface ScaffoldResult {
  /**
   * Absolute path to the created skill directory.
   */
  path: string;

  /**
   * List of files created within the skill directory.
   * Paths are relative to the skill directory.
   */
  files: string[];
}

// ============================================================================
// Package Types
// ============================================================================

/**
 * Options for creating a skill package.
 */
export interface PackageOptions {
  /**
   * Path to the skill directory to package.
   */
  path: string;

  /**
   * Output path for the .skill package file.
   * Defaults to `<skill-name>.skill` in the current directory.
   */
  output?: string;

  /**
   * Skip validation before packaging.
   * If false (default), throws `ValidationError` if the skill is invalid.
   */
  skipValidation?: boolean;

  /**
   * Force overwrite if package file already exists.
   * Defaults to `false`.
   */
  force?: boolean;

  /**
   * AbortSignal for cancellation support.
   * If aborted, throws `CancellationError`.
   */
  signal?: AbortSignal;
}

/**
 * Result of creating a skill package.
 */
export interface PackageResult {
  /**
   * Absolute path to the created .skill package file.
   */
  packagePath: string;

  /**
   * Size of the package file in bytes.
   */
  size: number;
}

// ============================================================================
// Install Types
// ============================================================================

/**
 * Options for installing a skill from a package.
 */
export interface InstallOptions {
  /**
   * Path to the .skill package file to install.
   */
  file: string;

  /**
   * Scope for installation.
   * Defaults to `'project'`.
   */
  scope?: ApiScope;

  /**
   * Custom installation path, overrides scope if provided.
   */
  targetPath?: string;

  /**
   * Force overwrite if skill already exists.
   * Defaults to `false`.
   */
  force?: boolean;

  /**
   * Preview what would happen without making changes.
   * Defaults to `false`.
   */
  dryRun?: boolean;

  /**
   * AbortSignal for cancellation support.
   * If aborted, throws `CancellationError`.
   */
  signal?: AbortSignal;
}

/**
 * Result of installing a skill.
 */
export interface InstallResult {
  /**
   * Absolute path where the skill was installed.
   */
  installedPath: string;

  /**
   * Name of the installed skill.
   */
  skillName: string;

  /**
   * Version of the installed skill (if specified in metadata).
   */
  version?: string;

  /**
   * Whether this was a dry run (no changes made).
   */
  dryRun: boolean;
}

// ============================================================================
// Update Types
// ============================================================================

/**
 * Options for updating an installed skill.
 */
export interface UpdateOptions {
  /**
   * Name of the installed skill to update.
   */
  name: string;

  /**
   * Path to the new .skill package file.
   */
  file: string;

  /**
   * Scope where the skill is installed.
   * Defaults to `'project'`.
   */
  scope?: ApiScope;

  /**
   * Custom path where the skill is installed, overrides scope if provided.
   */
  targetPath?: string;

  /**
   * Force update even if it would result in a downgrade.
   * Defaults to `false`.
   */
  force?: boolean;

  /**
   * Preview what would happen without making changes.
   * Defaults to `false`.
   */
  dryRun?: boolean;

  /**
   * Keep the backup file after successful update.
   * Defaults to `false` (backup is deleted after success).
   */
  keepBackup?: boolean;

  /**
   * AbortSignal for cancellation support.
   * If aborted, throws `CancellationError`.
   */
  signal?: AbortSignal;
}

/**
 * Result of updating a skill.
 */
export interface UpdateResult {
  /**
   * Absolute path to the updated skill.
   */
  updatedPath: string;

  /**
   * Previous version before update (if available).
   */
  previousVersion?: string;

  /**
   * New version after update (if available).
   */
  newVersion?: string;

  /**
   * Path to backup file (if `keepBackup` was true).
   */
  backupPath?: string;

  /**
   * Whether this was a dry run (no changes made).
   */
  dryRun: boolean;
}

// ============================================================================
// Uninstall Types
// ============================================================================

/**
 * Options for uninstalling skills.
 */
export interface UninstallOptions {
  /**
   * Names of skills to uninstall.
   */
  names: string[];

  /**
   * Scope where skills are installed.
   * Defaults to `'project'`.
   */
  scope?: ApiScope;

  /**
   * Custom path where skills are installed, overrides scope if provided.
   */
  targetPath?: string;

  /**
   * Skip confirmation for destructive operation.
   * Required for programmatic use (CLI prompts for confirmation).
   * Defaults to `false`.
   */
  force?: boolean;

  /**
   * Preview what would happen without making changes.
   * Defaults to `false`.
   */
  dryRun?: boolean;

  /**
   * AbortSignal for cancellation support.
   * If aborted, throws `CancellationError`.
   */
  signal?: AbortSignal;
}

/**
 * Result of uninstalling skills.
 */
export interface UninstallResult {
  /**
   * Names of skills that were successfully removed.
   */
  removed: string[];

  /**
   * Names of skills that were not found.
   */
  notFound: string[];

  /**
   * Whether this was a dry run (no changes made).
   */
  dryRun: boolean;
}

// ============================================================================
// List Types
// ============================================================================

/**
 * Options for listing installed skills.
 */
export interface ListOptions {
  /**
   * Scope to search for skills.
   * - `'project'`: Only project-level skills
   * - `'personal'`: Only personal skills
   * - `'all'`: Both project and personal skills (default)
   */
  scope?: ApiListScope;

  /**
   * Custom path to search for skills.
   * If provided, overrides scope.
   */
  targetPath?: string;
}

/**
 * Information about an installed skill.
 */
export interface InstalledSkill {
  /**
   * Name of the skill.
   */
  name: string;

  /**
   * Absolute path to the skill directory.
   */
  path: string;

  /**
   * Scope where the skill is installed.
   * - `'project'`: Installed in project's `.claude/skills/`
   * - `'personal'`: Installed in user's `~/.claude/skills/`
   * - `'custom'`: Installed in a custom path
   */
  scope: InstalledSkillScope;

  /**
   * Version of the skill (if specified in metadata).
   */
  version?: string;

  /**
   * Description of the skill (from SKILL.md frontmatter).
   */
  description?: string;
}
