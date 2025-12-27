/**
 * Tests for error utility classes
 */

import {
  ASMError,
  ValidationError,
  FileSystemError,
  UserCancelledError,
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
