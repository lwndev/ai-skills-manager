/**
 * Error types for the AI Skills Manager CLI
 */

/**
 * Base error class for ASM errors
 */
export class ASMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error - thrown when user input fails validation
 */
export class ValidationError extends ASMError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * File system error - thrown when file operations fail
 */
export class FileSystemError extends ASMError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * User cancelled error - thrown when user cancels an operation
 */
export class UserCancelledError extends ASMError {
  constructor(message: string = 'Operation cancelled by user') {
    super(message);
  }
}

/**
 * Path validation error - thrown when a skill path is invalid
 */
export class PathValidationError extends ASMError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Validation failed error - thrown when skill validation fails during packaging
 */
export class ValidationFailedError extends ASMError {
  /** Array of validation error messages */
  public readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[] = []) {
    super(message);
    this.validationErrors = validationErrors;
  }
}

/**
 * Package not found error - thrown when the .skill package file doesn't exist
 */
export class PackageNotFoundError extends ASMError {
  /** Path to the package file that was not found */
  public readonly packagePath: string;

  constructor(packagePath: string) {
    super(`Package file not found: ${packagePath}`);
    this.packagePath = packagePath;
  }
}

/**
 * Invalid package error - thrown when the file is not a valid .skill package
 * (e.g., bad ZIP format, wrong extension, or invalid structure)
 */
export class InvalidPackageError extends ASMError {
  /** Path to the invalid package file */
  public readonly packagePath: string;
  /** Specific reason why the package is invalid */
  public readonly reason: string;

  constructor(packagePath: string, reason: string) {
    super(`Invalid package: ${reason}`);
    this.packagePath = packagePath;
    this.reason = reason;
  }
}

/**
 * Package validation error - thrown when package content validation fails
 */
export class PackageValidationError extends ASMError {
  /** Array of validation error messages */
  public readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[] = []) {
    super(message);
    this.validationErrors = validationErrors;
  }
}

/**
 * Skill not found error - thrown when a skill directory doesn't exist
 */
export class SkillNotFoundError extends ASMError {
  /** Name of the skill that was not found */
  public readonly skillName: string;
  /** Path where the skill was searched */
  public readonly searchedPath: string;

  constructor(skillName: string, searchedPath: string) {
    super(`Skill "${skillName}" not found at ${searchedPath}`);
    this.skillName = skillName;
    this.searchedPath = searchedPath;
  }
}

/**
 * Security error - thrown when a security violation is detected
 * (e.g., path traversal, symlink escape, containment violation)
 */
export class SecurityError extends ASMError {
  /** Type of security violation */
  public readonly reason:
    | 'path-traversal'
    | 'symlink-escape'
    | 'hard-link-detected'
    | 'containment-violation'
    | 'case-mismatch';
  /** Additional details about the violation */
  public readonly details: string;

  constructor(
    reason:
      | 'path-traversal'
      | 'symlink-escape'
      | 'hard-link-detected'
      | 'containment-violation'
      | 'case-mismatch',
    details: string
  ) {
    super(`Security error (${reason}): ${details}`);
    this.reason = reason;
    this.details = details;
  }
}
