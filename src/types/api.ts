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
 * Result of validating a skill (simple mode).
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

/**
 * Names of all validation checks performed.
 */
export type ValidationCheckName =
  | 'fileExists'
  | 'frontmatterValid'
  | 'requiredFields'
  | 'allowedProperties'
  | 'nameFormat'
  | 'descriptionFormat'
  | 'compatibilityFormat'
  | 'contextFormat'
  | 'agentFormat'
  | 'hooksFormat'
  | 'userInvocableFormat'
  | 'memoryFormat'
  | 'skillsFormat'
  | 'modelFormat'
  | 'permissionModeFormat'
  | 'disallowedToolsFormat'
  | 'argumentHintFormat'
  | 'keepCodingInstructionsFormat'
  | 'toolsFormat'
  | 'colorFormat'
  | 'disableModelInvocationFormat'
  | 'versionFormat'
  | 'allowedToolsFormat'
  | 'nameMatchesDirectory';

/**
 * Result of a single validation check.
 */
export interface ValidationCheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** Error message if check failed */
  error?: string;
}

/**
 * Detailed result of validating a skill.
 *
 * Returned by `validate()` when called with `{ detailed: true }`.
 * Contains check-by-check results for CLI output and detailed analysis.
 */
export interface DetailedValidateResult {
  /** Whether all checks passed */
  valid: boolean;
  /** Path to the skill being validated */
  skillPath: string;
  /** Name of the skill (extracted from frontmatter, if available) */
  skillName?: string;
  /** Results of each individual check, keyed by check name */
  checks: Record<ValidationCheckName, ValidationCheckResult>;
  /** Array of all error messages (for convenience) */
  errors: string[];
  /** Array of warning messages (non-blocking issues) */
  warnings?: string[];
}

/**
 * Options for the validate function.
 */
export interface ValidateOptions {
  /**
   * When true, returns detailed check-by-check results.
   * When false or omitted, returns simplified ValidateResult.
   */
  detailed?: boolean;
}

// ============================================================================
// Scaffold Types
// ============================================================================

/**
 * Template types for different skill patterns.
 * - basic: Default template with general guidance
 * - forked: Template for skills that run in forked (isolated) context
 * - with-hooks: Template demonstrating hook configuration
 * - internal: Template for non-user-invocable helper skills
 * - agent: Template for autonomous agent skills with model, memory, and tool configuration
 */
export type ScaffoldTemplateType = 'basic' | 'forked' | 'with-hooks' | 'internal' | 'agent';

/**
 * Template-specific options for scaffolding.
 */
export interface ScaffoldTemplateOptions {
  /**
   * Which template variant to generate.
   * Defaults to 'basic'.
   */
  templateType?: ScaffoldTemplateType;

  /**
   * Set context: fork in frontmatter for isolated execution.
   * Can be used independently or with a template.
   */
  context?: 'fork';

  /**
   * Set the agent field in frontmatter.
   */
  agent?: string;

  /**
   * Set user-invocable: false if false.
   * Defaults to true (omitted from frontmatter).
   */
  userInvocable?: boolean;

  /**
   * Include commented hook examples in frontmatter.
   */
  includeHooks?: boolean;

  /**
   * Generate shorter templates without educational guidance text.
   * When true, produces minimal SKILL.md with concise TODO placeholders.
   */
  minimal?: boolean;

  /**
   * Memory scope for the skill.
   * - `'user'`: Cross-project memory, stored in ~/.claude/
   * - `'project'`: Repo-specific memory, stored in .claude/
   * - `'local'`: Machine-specific, not committed to version control
   */
  memory?: 'user' | 'project' | 'local';

  /**
   * Model for agent execution.
   * Controls which model runs the agent (e.g., 'sonnet', 'opus', 'haiku').
   * If omitted, the agent inherits the model from its parent context.
   */
  model?: string;

  /**
   * Argument hint for skill invocation.
   * Displayed in the UI to suggest expected arguments (e.g., '<query> [--deep]').
   * Maximum 100 characters.
   */
  argumentHint?: string;
}

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

  /**
   * Template-specific options for customizing the generated skill.
   * These options control the structure and content of the SKILL.md file.
   */
  template?: ScaffoldTemplateOptions;
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

  /**
   * Number of files included in the package.
   */
  fileCount: number;
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

  /**
   * When true, returns detailed results with file lists and conflict info.
   * When false or omitted, returns simplified InstallResult.
   */
  detailed?: boolean;
}

/**
 * Result of installing a skill (simple mode).
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

/**
 * Information about a file in an install package.
 */
export interface InstallFileInfo {
  /** Relative path within the skill directory */
  path: string;
  /** Size of the file in bytes */
  size: number;
  /** Whether this entry is a directory */
  isDirectory: boolean;
}

/**
 * File comparison result for overwrite detection.
 */
export interface InstallFileComparison {
  /** Relative path of the file */
  path: string;
  /** Whether the file exists in the target */
  existsInTarget: boolean;
  /** Size in the package */
  packageSize: number;
  /** Size in the target (if exists) */
  targetSize?: number;
  /** Whether the file would be modified */
  wouldModify: boolean;
}

/**
 * Successful installation result (detailed mode).
 */
export interface DetailedInstallSuccess {
  /** Discriminant for type narrowing */
  type: 'install-success';
  /** Path where the skill was installed */
  skillPath: string;
  /** Name of the installed skill */
  skillName: string;
  /** Number of files installed */
  fileCount: number;
  /** Total size of installed files in bytes */
  size: number;
  /** Whether an existing skill was overwritten */
  wasOverwritten: boolean;
}

/**
 * Dry-run preview result (detailed mode).
 */
export interface DetailedInstallDryRunPreview {
  /** Discriminant for type narrowing */
  type: 'install-dry-run-preview';
  /** Name of the skill to be installed */
  skillName: string;
  /** Target installation path */
  targetPath: string;
  /** Files that would be installed */
  files: InstallFileInfo[];
  /** Total size of all files in bytes */
  totalSize: number;
  /** Whether an existing skill would be overwritten */
  wouldOverwrite: boolean;
  /** Files that would conflict with existing files */
  conflicts: string[];
}

/**
 * Overwrite required result (detailed mode).
 */
export interface DetailedInstallOverwriteRequired {
  /** Discriminant for type narrowing */
  type: 'install-overwrite-required';
  /** Name of the existing skill */
  skillName: string;
  /** Path to the existing skill */
  existingPath: string;
  /** File comparison details */
  files: InstallFileComparison[];
}

/**
 * Detailed result of installing a skill.
 *
 * Returned by `install()` when called with `{ detailed: true }`.
 * Contains discriminated union result with full file information.
 */
export type DetailedInstallResult =
  | DetailedInstallSuccess
  | DetailedInstallDryRunPreview
  | DetailedInstallOverwriteRequired;

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

  /**
   * When true, returns detailed results with version comparison info.
   * When false or omitted, returns simplified UpdateResult.
   */
  detailed?: boolean;
}

/**
 * Result of updating a skill (simple mode).
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

/**
 * Information about a file change during update.
 */
export interface UpdateFileChange {
  /** Relative path within the skill directory */
  path: string;
  /** Type of change */
  changeType: 'added' | 'removed' | 'modified';
  /** Size before update (0 for added files) */
  sizeBefore: number;
  /** Size after update (0 for removed files) */
  sizeAfter: number;
}

/**
 * Version information for update comparison.
 */
export interface UpdateVersionInfo {
  /** Path to the skill or package */
  path: string;
  /** Number of files */
  fileCount: number;
  /** Total size in bytes */
  size: number;
  /** Last modified timestamp (ISO-8601) */
  lastModified?: string;
}

/**
 * Comparison of changes between versions.
 */
export interface UpdateVersionComparison {
  /** Files added in new version */
  filesAdded: UpdateFileChange[];
  /** Files removed in new version */
  filesRemoved: UpdateFileChange[];
  /** Files modified in new version */
  filesModified: UpdateFileChange[];
  /** Net size change in bytes */
  sizeChange: number;
}

/**
 * Successful update result (detailed mode).
 */
export interface DetailedUpdateSuccess {
  /** Discriminant for type narrowing */
  type: 'update-success';
  /** Name of the updated skill */
  skillName: string;
  /** Path where the skill is installed */
  path: string;
  /** File count before update */
  previousFileCount: number;
  /** File count after update */
  currentFileCount: number;
  /** Size in bytes before update */
  previousSize: number;
  /** Size in bytes after update */
  currentSize: number;
  /** Path to backup file (if created) */
  backupPath?: string;
  /** Whether the backup will be removed */
  backupWillBeRemoved: boolean;
}

/**
 * Dry-run preview result (detailed mode).
 */
export interface DetailedUpdateDryRunPreview {
  /** Discriminant for type narrowing */
  type: 'update-dry-run-preview';
  /** Name of the skill being previewed */
  skillName: string;
  /** Path where the skill is installed */
  path: string;
  /** Current skill information */
  currentVersion: UpdateVersionInfo;
  /** New package information */
  newVersion: UpdateVersionInfo;
  /** Comparison of changes */
  comparison: UpdateVersionComparison;
  /** Path where backup would be created */
  backupPath: string;
}

/**
 * Rolled back result (detailed mode) - update failed but rollback succeeded.
 */
export interface DetailedUpdateRolledBack {
  /** Discriminant for type narrowing */
  type: 'update-rolled-back';
  /** Name of the skill that was rolled back */
  skillName: string;
  /** Path where the skill is installed */
  path: string;
  /** Reason the update failed */
  failureReason: string;
  /** Path to backup file (kept for manual recovery) */
  backupPath?: string;
}

/**
 * Rollback failed result (detailed mode) - critical error state.
 */
export interface DetailedUpdateRollbackFailed {
  /** Discriminant for type narrowing */
  type: 'update-rollback-failed';
  /** Name of the skill in broken state */
  skillName: string;
  /** Path where the skill was installed */
  path: string;
  /** Reason the update failed */
  updateFailureReason: string;
  /** Reason the rollback failed */
  rollbackFailureReason: string;
  /** Path to backup file (if available) */
  backupPath?: string;
  /** Manual recovery instructions */
  recoveryInstructions: string;
}

/**
 * Cancelled result (detailed mode).
 */
export interface DetailedUpdateCancelled {
  /** Discriminant for type narrowing */
  type: 'update-cancelled';
  /** Name of the skill that was being updated */
  skillName: string;
  /** Reason for cancellation */
  reason: 'user-cancelled' | 'interrupted';
  /** Whether any cleanup was performed */
  cleanupPerformed: boolean;
}

/**
 * Detailed result of updating a skill.
 *
 * Returned by `update()` when called with `{ detailed: true }`.
 * Contains discriminated union result with full version comparison.
 */
export type DetailedUpdateResult =
  | DetailedUpdateSuccess
  | DetailedUpdateDryRunPreview
  | DetailedUpdateRolledBack
  | DetailedUpdateRollbackFailed
  | DetailedUpdateCancelled;

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

  /**
   * When true, returns detailed results with file counts and bytes freed.
   * When false or omitted, returns simplified UninstallResult.
   */
  detailed?: boolean;
}

/**
 * Result of uninstalling skills (simple mode).
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

/**
 * Information about a file in a skill directory.
 */
export interface UninstallFileInfo {
  /** Relative path within the skill directory */
  relativePath: string;
  /** Absolute path on the file system */
  absolutePath: string;
  /** File size in bytes */
  size: number;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Whether this is a symbolic link */
  isSymlink: boolean;
}

/**
 * Result of successfully uninstalling a single skill (detailed mode).
 */
export interface DetailedUninstallSuccess {
  /** Discriminant for type narrowing */
  type: 'success';
  /** Name of the uninstalled skill */
  skillName: string;
  /** Path that was removed */
  path: string;
  /** Number of files removed */
  filesRemoved: number;
  /** Total bytes freed */
  bytesFreed: number;
}

/**
 * Result when a skill was not found (detailed mode).
 */
export interface DetailedUninstallNotFound {
  /** Discriminant for type narrowing */
  type: 'not-found';
  /** Name of the skill that was not found */
  skillName: string;
  /** Path that was searched */
  searchedPath: string;
}

/**
 * Preview of what would be removed in dry-run mode (detailed mode).
 */
export interface DetailedUninstallDryRunPreview {
  /** Discriminant for type narrowing */
  type: 'dry-run-preview';
  /** Skill name being previewed */
  skillName: string;
  /** Path that would be removed */
  path: string;
  /** List of files that would be removed */
  files: UninstallFileInfo[];
  /** Total size of all files */
  totalSize: number;
}

/**
 * Detailed result of uninstalling skills.
 *
 * Returned by `uninstall()` when called with `{ detailed: true }`.
 * Contains per-skill results with file counts and bytes freed.
 */
export interface DetailedUninstallResult {
  /** Results for each skill (success, not-found, or dry-run preview) */
  results: (
    | DetailedUninstallSuccess
    | DetailedUninstallNotFound
    | DetailedUninstallDryRunPreview
  )[];
  /** Total number of skills successfully removed */
  totalRemoved: number;
  /** Total number of skills not found */
  totalNotFound: number;
  /** Total files removed across all skills */
  totalFilesRemoved: number;
  /** Total bytes freed across all skills */
  totalBytesFreed: number;
  /** Whether this was a dry run (no changes made) */
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

  /**
   * Relative path from the project root for nested skills.
   * Only populated when discovered via recursive scanning.
   * Example: `packages/api/.claude/skills/my-skill`
   */
  location?: string;
}

/**
 * Options for listing installed skills with recursive discovery.
 * Extends ListOptions with options for nested directory scanning.
 */
export interface RecursiveListOptions extends ListOptions {
  /**
   * Enable nested directory discovery.
   * When true, scans subdirectories for `.claude/skills` directories.
   * Only applies to project scope (personal scope is never recursively scanned).
   * Defaults to `false`.
   */
  recursive?: boolean;

  /**
   * Maximum depth to traverse when scanning nested directories.
   * A depth of 0 means only scan the root `.claude/skills`.
   * A depth of 1 means scan immediate subdirectories, etc.
   * Defaults to `3`.
   */
  depth?: number;
}

/**
 * Result of listing installed skills.
 */
export interface ListResult {
  /**
   * Array of installed skills found.
   */
  skills: InstalledSkill[];

  /**
   * Whether the search was limited by the depth parameter during recursive discovery.
   * Only populated when `recursive: true` was used.
   * When true, some directories were not scanned because they exceeded the depth limit.
   */
  depthLimitReached?: boolean;
}
