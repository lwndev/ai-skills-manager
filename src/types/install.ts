/**
 * Type definitions for skill installation
 */

/**
 * Installation scope types
 * - 'project': Install to .claude/skills/ in current directory
 * - 'personal': Install to ~/.claude/skills/
 * - string: Custom path for installation
 */
export type InstallScope = 'project' | 'personal' | string;

/**
 * Options for the install command
 */
export interface InstallOptions {
  /** Installation scope or custom path */
  scope?: InstallScope;
  /** Overwrite existing skill without prompting */
  force?: boolean;
  /** Show what would be installed without making changes */
  dryRun?: boolean;
  /** Suppress non-essential output */
  quiet?: boolean;
}

/**
 * Result of a skill installation operation
 */
export interface InstallResult {
  /** Whether the installation succeeded */
  success: boolean;
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
  /** Errors encountered during installation (empty if successful) */
  errors: string[];
}

/**
 * Information about an extracted file
 */
export interface ExtractedFileInfo {
  /** Relative path within the skill directory */
  path: string;
  /** Size of the file in bytes */
  size: number;
  /** Whether this entry is a directory */
  isDirectory: boolean;
}

/**
 * Preview result for dry-run mode
 */
export interface DryRunPreview {
  /** Name of the skill to be installed */
  skillName: string;
  /** Target installation path */
  targetPath: string;
  /** Files that would be installed */
  files: ExtractedFileInfo[];
  /** Total size of all files in bytes */
  totalSize: number;
  /** Whether an existing skill would be overwritten */
  wouldOverwrite: boolean;
  /** Files that would conflict with existing files */
  conflicts: string[];
}

/**
 * Result when checking for existing skill at target path
 */
export interface ExistingSkillInfo {
  /** Whether a skill exists at the target path */
  exists: boolean;
  /** Path to the existing skill */
  path: string;
  /** List of existing files in the skill directory */
  files: string[];
}

/**
 * Comparison result for a file during overwrite detection
 */
export interface FileComparison {
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
