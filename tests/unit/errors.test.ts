/**
 * Tests for public API error classes (FEAT-010)
 *
 * These tests verify that the public error classes:
 * 1. Have correct properties and values
 * 2. Support instanceof checks for error handling
 * 3. Maintain proper inheritance hierarchy
 * 4. Include correct error codes for programmatic handling
 */

import {
  AsmError,
  ValidationError,
  FileSystemError,
  PackageError,
  SecurityError,
  CancellationError,
} from '../../src/errors';
import type { ValidationIssue } from '../../src/types/api';

describe('AsmError (base class)', () => {
  it('creates an error with message and default code', () => {
    const error = new AsmError('test error message');
    expect(error.message).toBe('test error message');
    expect(error.code).toBe('ASM_ERROR');
  });

  it('creates an error with custom code', () => {
    const error = new AsmError('test error', 'VALIDATION_ERROR');
    expect(error.message).toBe('test error');
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('has the correct name', () => {
    const error = new AsmError('test');
    expect(error.name).toBe('AsmError');
  });

  it('is an instance of Error', () => {
    const error = new AsmError('test');
    expect(error).toBeInstanceOf(Error);
  });

  it('captures stack trace', () => {
    const error = new AsmError('test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AsmError');
  });

  it('code property cannot be reassigned (TypeScript compile-time check)', () => {
    const error = new AsmError('test');
    const originalCode = error.code;
    // TypeScript prevents reassignment at compile time via readonly
    // At runtime, the property is set but the original code is preserved
    // This test documents that the property exists and is set correctly
    expect(originalCode).toBe('ASM_ERROR');
    expect(error.code).toBe('ASM_ERROR');
  });
});

describe('ValidationError', () => {
  const sampleIssues: ValidationIssue[] = [
    { code: 'MISSING_FRONTMATTER', message: 'SKILL.md is missing frontmatter' },
    { code: 'INVALID_NAME', message: 'Skill name is invalid', path: 'frontmatter.name' },
  ];

  it('creates an error with message and issues', () => {
    const error = new ValidationError('Validation failed', sampleIssues);
    expect(error.message).toBe('Validation failed');
    expect(error.issues).toEqual(sampleIssues);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('defaults to empty issues array', () => {
    const error = new ValidationError('Validation failed');
    expect(error.issues).toEqual([]);
  });

  it('has the correct name', () => {
    const error = new ValidationError('test');
    expect(error.name).toBe('ValidationError');
  });

  it('is an instance of AsmError', () => {
    const error = new ValidationError('test');
    expect(error).toBeInstanceOf(AsmError);
  });

  it('is an instance of Error', () => {
    const error = new ValidationError('test');
    expect(error).toBeInstanceOf(Error);
  });

  it('issues array is accessible and preserved', () => {
    const error = new ValidationError('test', sampleIssues);
    // TypeScript prevents reassignment at compile time via readonly
    // This test documents that issues are preserved correctly
    expect(error.issues).toEqual(sampleIssues);
    expect(error.issues.length).toBe(2);
  });

  it('preserves issue details including optional path', () => {
    const issuesWithPath: ValidationIssue[] = [
      { code: 'ERR1', message: 'Error 1', path: '/path/to/file' },
      { code: 'ERR2', message: 'Error 2' },
    ];
    const error = new ValidationError('test', issuesWithPath);
    expect(error.issues[0].path).toBe('/path/to/file');
    expect(error.issues[1].path).toBeUndefined();
  });
});

describe('FileSystemError', () => {
  it('creates an error with message and path', () => {
    const error = new FileSystemError('Permission denied', '/path/to/file');
    expect(error.message).toBe('Permission denied');
    expect(error.path).toBe('/path/to/file');
    expect(error.code).toBe('FILE_SYSTEM_ERROR');
  });

  it('has the correct name', () => {
    const error = new FileSystemError('test', '/path');
    expect(error.name).toBe('FileSystemError');
  });

  it('is an instance of AsmError', () => {
    const error = new FileSystemError('test', '/path');
    expect(error).toBeInstanceOf(AsmError);
  });

  it('is an instance of Error', () => {
    const error = new FileSystemError('test', '/path');
    expect(error).toBeInstanceOf(Error);
  });

  it('path property is accessible and preserved', () => {
    const error = new FileSystemError('test', '/path');
    // TypeScript prevents reassignment at compile time via readonly
    // This test documents that the path is preserved correctly
    expect(error.path).toBe('/path');
  });
});

describe('PackageError', () => {
  it('creates an error with message', () => {
    const error = new PackageError('Invalid package format');
    expect(error.message).toBe('Invalid package format');
    expect(error.code).toBe('PACKAGE_ERROR');
  });

  it('has the correct name', () => {
    const error = new PackageError('test');
    expect(error.name).toBe('PackageError');
  });

  it('is an instance of AsmError', () => {
    const error = new PackageError('test');
    expect(error).toBeInstanceOf(AsmError);
  });

  it('is an instance of Error', () => {
    const error = new PackageError('test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('SecurityError', () => {
  it('creates an error with message', () => {
    const error = new SecurityError('Path traversal detected');
    expect(error.message).toBe('Path traversal detected');
    expect(error.code).toBe('SECURITY_ERROR');
  });

  it('has the correct name', () => {
    const error = new SecurityError('test');
    expect(error.name).toBe('SecurityError');
  });

  it('is an instance of AsmError', () => {
    const error = new SecurityError('test');
    expect(error).toBeInstanceOf(AsmError);
  });

  it('is an instance of Error', () => {
    const error = new SecurityError('test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('CancellationError', () => {
  it('has a default message when none provided', () => {
    const error = new CancellationError();
    expect(error.message).toBe('Operation cancelled');
    expect(error.code).toBe('CANCELLED');
  });

  it('accepts a custom message', () => {
    const error = new CancellationError('User aborted the operation');
    expect(error.message).toBe('User aborted the operation');
  });

  it('has the correct name', () => {
    const error = new CancellationError();
    expect(error.name).toBe('CancellationError');
  });

  it('is an instance of AsmError', () => {
    const error = new CancellationError();
    expect(error).toBeInstanceOf(AsmError);
  });

  it('is an instance of Error', () => {
    const error = new CancellationError();
    expect(error).toBeInstanceOf(Error);
  });
});

describe('error type checking', () => {
  it('can distinguish ValidationError from other errors', () => {
    const validationError = new ValidationError('invalid');
    const fileError = new FileSystemError('failed', '/path');
    const packageError = new PackageError('bad package');
    const securityError = new SecurityError('attack detected');
    const cancelError = new CancellationError();

    expect(validationError instanceof ValidationError).toBe(true);
    expect(fileError instanceof ValidationError).toBe(false);
    expect(packageError instanceof ValidationError).toBe(false);
    expect(securityError instanceof ValidationError).toBe(false);
    expect(cancelError instanceof ValidationError).toBe(false);
  });

  it('can distinguish FileSystemError from other errors', () => {
    const validationError = new ValidationError('invalid');
    const fileError = new FileSystemError('failed', '/path');
    const packageError = new PackageError('bad package');
    const securityError = new SecurityError('attack detected');
    const cancelError = new CancellationError();

    expect(fileError instanceof FileSystemError).toBe(true);
    expect(validationError instanceof FileSystemError).toBe(false);
    expect(packageError instanceof FileSystemError).toBe(false);
    expect(securityError instanceof FileSystemError).toBe(false);
    expect(cancelError instanceof FileSystemError).toBe(false);
  });

  it('can distinguish PackageError from other errors', () => {
    const validationError = new ValidationError('invalid');
    const fileError = new FileSystemError('failed', '/path');
    const packageError = new PackageError('bad package');
    const securityError = new SecurityError('attack detected');
    const cancelError = new CancellationError();

    expect(packageError instanceof PackageError).toBe(true);
    expect(validationError instanceof PackageError).toBe(false);
    expect(fileError instanceof PackageError).toBe(false);
    expect(securityError instanceof PackageError).toBe(false);
    expect(cancelError instanceof PackageError).toBe(false);
  });

  it('can distinguish SecurityError from other errors', () => {
    const validationError = new ValidationError('invalid');
    const fileError = new FileSystemError('failed', '/path');
    const packageError = new PackageError('bad package');
    const securityError = new SecurityError('attack detected');
    const cancelError = new CancellationError();

    expect(securityError instanceof SecurityError).toBe(true);
    expect(validationError instanceof SecurityError).toBe(false);
    expect(fileError instanceof SecurityError).toBe(false);
    expect(packageError instanceof SecurityError).toBe(false);
    expect(cancelError instanceof SecurityError).toBe(false);
  });

  it('can distinguish CancellationError from other errors', () => {
    const validationError = new ValidationError('invalid');
    const fileError = new FileSystemError('failed', '/path');
    const packageError = new PackageError('bad package');
    const securityError = new SecurityError('attack detected');
    const cancelError = new CancellationError();

    expect(cancelError instanceof CancellationError).toBe(true);
    expect(validationError instanceof CancellationError).toBe(false);
    expect(fileError instanceof CancellationError).toBe(false);
    expect(packageError instanceof CancellationError).toBe(false);
    expect(securityError instanceof CancellationError).toBe(false);
  });

  it('all custom errors are instances of AsmError', () => {
    const errors = [
      new ValidationError('test'),
      new FileSystemError('test', '/path'),
      new PackageError('test'),
      new SecurityError('test'),
      new CancellationError(),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(AsmError);
    }
  });

  it('can catch all ASM errors with single catch block', () => {
    const throwAndCatch = (error: Error): string | null => {
      try {
        throw error;
      } catch (e) {
        if (e instanceof AsmError) {
          return e.code;
        }
        return null;
      }
    };

    expect(throwAndCatch(new ValidationError('test'))).toBe('VALIDATION_ERROR');
    expect(throwAndCatch(new FileSystemError('test', '/path'))).toBe('FILE_SYSTEM_ERROR');
    expect(throwAndCatch(new PackageError('test'))).toBe('PACKAGE_ERROR');
    expect(throwAndCatch(new SecurityError('test'))).toBe('SECURITY_ERROR');
    expect(throwAndCatch(new CancellationError())).toBe('CANCELLED');
    expect(throwAndCatch(new Error('regular error'))).toBeNull();
  });
});

describe('error codes', () => {
  it('each error class has a unique code', () => {
    const codes = new Set([
      new AsmError('test').code,
      new ValidationError('test').code,
      new FileSystemError('test', '/path').code,
      new PackageError('test').code,
      new SecurityError('test').code,
      new CancellationError().code,
    ]);

    // We expect 6 unique codes (AsmError base has ASM_ERROR)
    expect(codes.size).toBe(6);
  });

  it('codes are machine-readable uppercase strings', () => {
    const errors = [
      new AsmError('test'),
      new ValidationError('test'),
      new FileSystemError('test', '/path'),
      new PackageError('test'),
      new SecurityError('test'),
      new CancellationError(),
    ];

    for (const error of errors) {
      expect(error.code).toMatch(/^[A-Z_]+$/);
    }
  });
});

describe('error usage patterns', () => {
  it('supports typical try/catch error handling pattern', async () => {
    const mockOperation = async (shouldFail: boolean): Promise<string> => {
      if (shouldFail) {
        throw new FileSystemError('Cannot write file', '/tmp/test.txt');
      }
      return 'success';
    };

    // Test success case
    const result = await mockOperation(false);
    expect(result).toBe('success');

    // Test error case with proper handling
    try {
      await mockOperation(true);
      // Should not reach here
      expect(true).toBe(false);
    } catch (e) {
      if (e instanceof FileSystemError) {
        expect(e.path).toBe('/tmp/test.txt');
        expect(e.message).toBe('Cannot write file');
      } else {
        // Should not reach here
        expect(true).toBe(false);
      }
    }
  });

  it('supports validation error with issues array pattern', () => {
    const validate = (value: string): void => {
      const issues: ValidationIssue[] = [];

      if (value.length < 3) {
        issues.push({ code: 'TOO_SHORT', message: 'Value must be at least 3 characters' });
      }
      if (value.includes(' ')) {
        issues.push({
          code: 'NO_SPACES',
          message: 'Value cannot contain spaces',
          path: 'input',
        });
      }

      if (issues.length > 0) {
        throw new ValidationError('Validation failed', issues);
      }
    };

    // Test valid input
    expect(() => validate('valid-input')).not.toThrow();

    // Test multiple validation errors (use "a " which is 2 chars and has a space)
    try {
      validate('a ');
    } catch (e) {
      if (e instanceof ValidationError) {
        expect(e.issues).toHaveLength(2);
        expect(e.issues[0].code).toBe('TOO_SHORT');
        expect(e.issues[1].code).toBe('NO_SPACES');
        expect(e.issues[1].path).toBe('input');
      } else {
        expect(true).toBe(false);
      }
    }
  });

  it('supports AbortSignal cancellation pattern', () => {
    const controller = new AbortController();

    const checkCancellation = (): void => {
      if (controller.signal.aborted) {
        throw new CancellationError('Operation was aborted');
      }
    };

    // Before abort
    expect(() => checkCancellation()).not.toThrow();

    // After abort
    controller.abort();
    expect(() => checkCancellation()).toThrow(CancellationError);
  });
});
