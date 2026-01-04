/**
 * Tests for error utility classes
 */

import {
  ASMError,
  ValidationError,
  FileSystemError,
  UserCancelledError,
  PackageNotFoundError,
  SkillNotFoundError,
  SecurityError,
  UpdateRollbackError,
  UpdateCriticalError,
  BackupCreationError,
  PackageMismatchError,
  OperationTimeoutError,
  PartialRemovalError,
  ValidationFailedError,
  PackageValidationError,
  InvalidPackageError,
  PathValidationError,
} from '../../../src/utils/errors';

describe('ASMError', () => {
  it('creates an error with the correct message', () => {
    const error = new ASMError('test error message');
    expect(error.message).toBe('test error message');
  });

  it('has the correct name', () => {
    const error = new ASMError('test');
    expect(error.name).toBe('ASMError');
  });

  it('is an instance of Error', () => {
    const error = new ASMError('test');
    expect(error).toBeInstanceOf(Error);
  });

  it('captures stack trace', () => {
    const error = new ASMError('test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ASMError');
  });
});

describe('ValidationError', () => {
  it('creates an error with the correct message', () => {
    const error = new ValidationError('invalid input');
    expect(error.message).toBe('invalid input');
  });

  it('has the correct name', () => {
    const error = new ValidationError('test');
    expect(error.name).toBe('ValidationError');
  });

  it('is an instance of ASMError', () => {
    const error = new ValidationError('test');
    expect(error).toBeInstanceOf(ASMError);
  });

  it('is an instance of Error', () => {
    const error = new ValidationError('test');
    expect(error).toBeInstanceOf(Error);
  });

  it('captures stack trace', () => {
    const error = new ValidationError('test');
    expect(error.stack).toBeDefined();
  });
});

describe('FileSystemError', () => {
  it('creates an error with the correct message', () => {
    const error = new FileSystemError('permission denied');
    expect(error.message).toBe('permission denied');
  });

  it('has the correct name', () => {
    const error = new FileSystemError('test');
    expect(error.name).toBe('FileSystemError');
  });

  it('is an instance of ASMError', () => {
    const error = new FileSystemError('test');
    expect(error).toBeInstanceOf(ASMError);
  });

  it('is an instance of Error', () => {
    const error = new FileSystemError('test');
    expect(error).toBeInstanceOf(Error);
  });

  it('captures stack trace', () => {
    const error = new FileSystemError('test');
    expect(error.stack).toBeDefined();
  });
});

describe('UserCancelledError', () => {
  it('has a default message when none provided', () => {
    const error = new UserCancelledError();
    expect(error.message).toBe('Operation cancelled by user');
  });

  it('accepts a custom message', () => {
    const error = new UserCancelledError('User aborted the operation');
    expect(error.message).toBe('User aborted the operation');
  });

  it('has the correct name', () => {
    const error = new UserCancelledError();
    expect(error.name).toBe('UserCancelledError');
  });

  it('is an instance of ASMError', () => {
    const error = new UserCancelledError();
    expect(error).toBeInstanceOf(ASMError);
  });

  it('is an instance of Error', () => {
    const error = new UserCancelledError();
    expect(error).toBeInstanceOf(Error);
  });

  it('captures stack trace', () => {
    const error = new UserCancelledError();
    expect(error.stack).toBeDefined();
  });
});

describe('error type checking', () => {
  it('can distinguish ValidationError from other errors', () => {
    const validationError = new ValidationError('invalid');
    const fileError = new FileSystemError('failed');
    const cancelError = new UserCancelledError();

    expect(validationError instanceof ValidationError).toBe(true);
    expect(fileError instanceof ValidationError).toBe(false);
    expect(cancelError instanceof ValidationError).toBe(false);
  });

  it('can distinguish FileSystemError from other errors', () => {
    const validationError = new ValidationError('invalid');
    const fileError = new FileSystemError('failed');
    const cancelError = new UserCancelledError();

    expect(fileError instanceof FileSystemError).toBe(true);
    expect(validationError instanceof FileSystemError).toBe(false);
    expect(cancelError instanceof FileSystemError).toBe(false);
  });

  it('can distinguish UserCancelledError from other errors', () => {
    const validationError = new ValidationError('invalid');
    const fileError = new FileSystemError('failed');
    const cancelError = new UserCancelledError();

    expect(cancelError instanceof UserCancelledError).toBe(true);
    expect(validationError instanceof UserCancelledError).toBe(false);
    expect(fileError instanceof UserCancelledError).toBe(false);
  });

  it('all custom errors are instances of ASMError', () => {
    const errors = [
      new ValidationError('test'),
      new FileSystemError('test'),
      new UserCancelledError(),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(ASMError);
    }
  });
});

describe('PackageNotFoundError', () => {
  it('creates an error with package path', () => {
    const error = new PackageNotFoundError('/path/to/skill.skill');
    expect(error.message).toContain('/path/to/skill.skill');
    expect(error.packagePath).toBe('/path/to/skill.skill');
    expect(error.name).toBe('PackageNotFoundError');
  });
});

describe('SkillNotFoundError', () => {
  it('creates an error with skill name and path', () => {
    const error = new SkillNotFoundError('my-skill', '/skills/my-skill');
    expect(error.message).toContain('my-skill');
    expect(error.message).toContain('/skills/my-skill');
    expect(error.skillName).toBe('my-skill');
    expect(error.searchedPath).toBe('/skills/my-skill');
    expect(error.name).toBe('SkillNotFoundError');
  });
});

describe('SecurityError', () => {
  it('creates an error with reason and details', () => {
    const error = new SecurityError('symlink-escape', 'Symlink points outside scope');
    expect(error.message).toContain('symlink-escape');
    expect(error.reason).toBe('symlink-escape');
    expect(error.details).toBe('Symlink points outside scope');
    expect(error.name).toBe('SecurityError');
  });

  it('handles all security reason types', () => {
    const reasons: Array<
      | 'path-traversal'
      | 'symlink-escape'
      | 'hard-link-detected'
      | 'containment-violation'
      | 'case-mismatch'
    > = [
      'path-traversal',
      'symlink-escape',
      'hard-link-detected',
      'containment-violation',
      'case-mismatch',
    ];
    for (const reason of reasons) {
      const error = new SecurityError(reason, 'test');
      expect(error.reason).toBe(reason);
    }
  });
});

describe('PartialRemovalError', () => {
  it('creates an error with all details', () => {
    const error = new PartialRemovalError('my-skill', '/skills/my-skill', 5, 3, 'EBUSY');
    expect(error.message).toContain('my-skill');
    expect(error.message).toContain('5');
    expect(error.message).toContain('3');
    expect(error.skillName).toBe('my-skill');
    expect(error.skillPath).toBe('/skills/my-skill');
    expect(error.filesRemoved).toBe(5);
    expect(error.filesRemaining).toBe(3);
    expect(error.lastError).toBe('EBUSY');
    expect(error.name).toBe('PartialRemovalError');
  });
});

describe('OperationTimeoutError', () => {
  it('creates an error with operation and timeout', () => {
    const error = new OperationTimeoutError('backup', 30000);
    expect(error.message).toContain('backup');
    expect(error.message).toContain('30000');
    expect(error.operationName).toBe('backup');
    expect(error.timeoutMs).toBe(30000);
    expect(error.name).toBe('OperationTimeoutError');
  });
});

describe('UpdateRollbackError', () => {
  it('creates an error without backup path', () => {
    const error = new UpdateRollbackError('my-skill', 'extraction failed');
    expect(error.message).toContain('my-skill');
    expect(error.message).toContain('extraction failed');
    expect(error.skillName).toBe('my-skill');
    expect(error.updateFailureReason).toBe('extraction failed');
    expect(error.backupPath).toBeUndefined();
    expect(error.name).toBe('UpdateRollbackError');
  });

  it('creates an error with backup path', () => {
    const error = new UpdateRollbackError(
      'my-skill',
      'extraction failed',
      '/backups/my-skill.skill'
    );
    expect(error.skillName).toBe('my-skill');
    expect(error.backupPath).toBe('/backups/my-skill.skill');
  });
});

describe('UpdateCriticalError', () => {
  it('creates an error without backup path', () => {
    const error = new UpdateCriticalError(
      'my-skill',
      '/skills/my-skill',
      'extraction failed',
      'rollback also failed'
    );
    expect(error.message).toContain('CRITICAL');
    expect(error.message).toContain('my-skill');
    expect(error.message).toContain('extraction failed');
    expect(error.message).toContain('rollback also failed');
    expect(error.message).toContain('No backup available');
    expect(error.skillName).toBe('my-skill');
    expect(error.skillPath).toBe('/skills/my-skill');
    expect(error.updateFailureReason).toBe('extraction failed');
    expect(error.rollbackFailureReason).toBe('rollback also failed');
    expect(error.backupPath).toBeUndefined();
    expect(error.name).toBe('UpdateCriticalError');
  });

  it('creates an error with backup path', () => {
    const error = new UpdateCriticalError(
      'my-skill',
      '/skills/my-skill',
      'extraction failed',
      'rollback also failed',
      '/backups/my-skill.skill'
    );
    expect(error.message).toContain('/backups/my-skill.skill');
    expect(error.message).toContain('asm install');
    expect(error.backupPath).toBe('/backups/my-skill.skill');
  });
});

describe('BackupCreationError', () => {
  it('creates an error with path and reason', () => {
    const error = new BackupCreationError('/backups/my-skill.skill', 'disk full');
    expect(error.message).toContain('/backups/my-skill.skill');
    expect(error.message).toContain('disk full');
    expect(error.backupPath).toBe('/backups/my-skill.skill');
    expect(error.reason).toBe('disk full');
    expect(error.name).toBe('BackupCreationError');
  });
});

describe('PackageMismatchError', () => {
  it('creates an error with both skill names', () => {
    const error = new PackageMismatchError('installed-skill', 'package-skill');
    expect(error.message).toContain('installed-skill');
    expect(error.message).toContain('package-skill');
    expect(error.installedSkillName).toBe('installed-skill');
    expect(error.packageSkillName).toBe('package-skill');
    expect(error.name).toBe('PackageMismatchError');
  });
});

describe('PathValidationError', () => {
  it('creates an error with message', () => {
    const error = new PathValidationError('Path is invalid');
    expect(error.message).toBe('Path is invalid');
    expect(error.name).toBe('PathValidationError');
    expect(error).toBeInstanceOf(ASMError);
  });
});

describe('ValidationFailedError', () => {
  it('creates an error without validation errors', () => {
    const error = new ValidationFailedError('Validation failed');
    expect(error.message).toBe('Validation failed');
    expect(error.validationErrors).toEqual([]);
    expect(error.name).toBe('ValidationFailedError');
  });

  it('creates an error with validation errors', () => {
    const errors = ['Error 1', 'Error 2'];
    const error = new ValidationFailedError('Validation failed', errors);
    expect(error.message).toBe('Validation failed');
    expect(error.validationErrors).toEqual(errors);
  });
});

describe('PackageValidationError', () => {
  it('creates an error without validation errors', () => {
    const error = new PackageValidationError('Package invalid');
    expect(error.message).toBe('Package invalid');
    expect(error.validationErrors).toEqual([]);
    expect(error.name).toBe('PackageValidationError');
  });

  it('creates an error with validation errors', () => {
    const errors = ['Missing SKILL.md', 'Invalid frontmatter'];
    const error = new PackageValidationError('Package invalid', errors);
    expect(error.message).toBe('Package invalid');
    expect(error.validationErrors).toEqual(errors);
  });
});

describe('InvalidPackageError', () => {
  it('creates an error with path and reason', () => {
    const error = new InvalidPackageError('/path/to/skill.skill', 'Not a ZIP file');
    expect(error.message).toContain('Not a ZIP file');
    expect(error.packagePath).toBe('/path/to/skill.skill');
    expect(error.reason).toBe('Not a ZIP file');
    expect(error.name).toBe('InvalidPackageError');
  });
});
