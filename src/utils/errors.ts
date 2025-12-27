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
