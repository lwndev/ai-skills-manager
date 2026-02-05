/**
 * Types barrel export
 */

// Public API types (FEAT-010)
export type {
  ApiScope,
  ApiListScope,
  InstalledSkillScope,
  ValidationIssue,
  ValidationWarning,
  ValidateResult,
  ScaffoldOptions,
  ScaffoldResult,
  PackageOptions as ApiPackageOptions,
  PackageResult as ApiPackageResult,
  InstallOptions as ApiInstallOptions,
  InstallResult as ApiInstallResult,
  UpdateOptions as ApiUpdateOptions,
  UpdateResult as ApiUpdateResult,
  UninstallOptions as ApiUninstallOptions,
  UninstallResult as ApiUninstallResult,
  ListOptions,
  InstalledSkill,
} from './api';

// Scope types
export type { ScopeType, ScopeInfo, PathValidationResult, PathValidationError } from './scope';
export { PathErrorCode } from './scope';

// Validation types
export type {
  ValidationResult,
  ValidationCheck,
  CheckName,
  ParsedFrontmatter,
  FrontmatterParseResult,
} from './validation';

// Package types
export type { PackageOptions, PackageResult, FileEntry } from './package';
export { isExcluded, EXCLUDED_PATTERNS } from './package';

// Install types
export type {
  InstallScope,
  InstallOptions,
  InstallResult,
  ExtractedFileInfo,
  DryRunPreview as InstallDryRunPreview,
  ExistingSkillInfo,
  FileComparison,
  OverwriteRequired,
  InstallResultUnion,
  InstallResultType,
  DryRunPreviewType,
  OverwriteRequiredType,
} from './install';

// Uninstall types
export type {
  UninstallOptions,
  UninstallResult,
  UninstallFailure,
  SingleUninstallResult,
  MultiUninstallResult,
  DryRunPreview as UninstallDryRunPreview,
  FileInfo,
  SkillInfo,
  UninstallError,
  SkillNotFoundError,
  SecurityError,
  FileSystemError,
  ValidationError,
  PartialRemovalError,
  TimeoutError,
  UninstallExitCode,
} from './uninstall';
export { UninstallExitCodes } from './uninstall';

// Update types (FEAT-008)
export type {
  UpdateScope,
  UpdateOptions,
  UpdateSuccess,
  UpdateDryRunPreview,
  UpdateRolledBack,
  UpdateRollbackFailed,
  UpdateResultUnion,
  VersionInfo,
  VersionComparison,
  FileChange,
  BackupInfo,
  BackupResult,
  BackupDirValidation,
  BackupWritabilityResult,
  SkillMetadata,
  DowngradeInfo,
  ChangeSummary,
  UpdateError,
  SkillNotFoundUpdateError,
  SecurityUpdateError,
  FileSystemUpdateError,
  ValidationUpdateError,
  PackageMismatchUpdateError,
  BackupCreationUpdateError,
  RollbackUpdateError,
  CriticalUpdateError,
  TimeoutUpdateError,
  UpdateLockFile,
  LockAcquisitionResult,
  HardLinkInfo,
  HardLinkCheckResult,
  UpdatePhase,
  UpdateState,
  UpdateSuccessType,
  UpdateDryRunPreviewType,
  UpdateRolledBackType,
  UpdateRollbackFailedType,
  UpdateExitCode,
} from './update';
export { UpdateExitCodes } from './update';

// ASMR mode types (FEAT-014)
export type {
  AsmrTheme,
  AsmrConfig,
  AsmrConfigFile,
  AsmrConfigSource,
  AsmrConfigResolution,
  TerminalCapabilities,
} from './asmr';
export { DEFAULT_ASMR_CONFIG, ASMR_THEMES, isAsmrTheme } from './asmr';
