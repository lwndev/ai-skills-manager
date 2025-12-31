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
