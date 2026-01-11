/**
 * ESM Consumer Test
 *
 * Tests that ESM consumers can import from the package using dynamic import().
 * This validates the exports configuration works for ESM consumers.
 */

import * as path from 'path';

describe('ESM Consumer', () => {
  const distPath = path.resolve(__dirname, '../../dist/index.js');

  it('should export all API functions via dynamic import', async () => {
    const asm = await import(distPath);

    // Verify all API functions are exported
    expect(typeof asm.scaffold).toBe('function');
    expect(typeof asm.validate).toBe('function');
    expect(typeof asm.createPackage).toBe('function');
    expect(typeof asm.install).toBe('function');
    expect(typeof asm.update).toBe('function');
    expect(typeof asm.uninstall).toBe('function');
    expect(typeof asm.list).toBe('function');
  });

  it('should export all error classes via dynamic import', async () => {
    const asm = await import(distPath);

    // Verify all error classes are exported
    expect(asm.AsmError).toBeDefined();
    expect(asm.ValidationError).toBeDefined();
    expect(asm.FileSystemError).toBeDefined();
    expect(asm.PackageError).toBeDefined();
    expect(asm.SecurityError).toBeDefined();
    expect(asm.CancellationError).toBeDefined();

    // Verify error class hierarchy
    expect(asm.ValidationError.prototype).toBeInstanceOf(asm.AsmError);
    expect(asm.FileSystemError.prototype).toBeInstanceOf(asm.AsmError);
    expect(asm.PackageError.prototype).toBeInstanceOf(asm.AsmError);
    expect(asm.SecurityError.prototype).toBeInstanceOf(asm.AsmError);
    expect(asm.CancellationError.prototype).toBeInstanceOf(asm.AsmError);
  });

  it('should allow instanceof checks on error classes via dynamic import', async () => {
    const asm = await import(distPath);

    const validationError = new asm.ValidationError('test', []);
    const fileSystemError = new asm.FileSystemError('test', '/path');
    const packageError = new asm.PackageError('test');
    const securityError = new asm.SecurityError('test');
    const cancellationError = new asm.CancellationError();

    // instanceof checks should work
    expect(validationError).toBeInstanceOf(asm.AsmError);
    expect(validationError).toBeInstanceOf(asm.ValidationError);
    expect(fileSystemError).toBeInstanceOf(asm.AsmError);
    expect(fileSystemError).toBeInstanceOf(asm.FileSystemError);
    expect(packageError).toBeInstanceOf(asm.AsmError);
    expect(packageError).toBeInstanceOf(asm.PackageError);
    expect(securityError).toBeInstanceOf(asm.AsmError);
    expect(securityError).toBeInstanceOf(asm.SecurityError);
    expect(cancellationError).toBeInstanceOf(asm.AsmError);
    expect(cancellationError).toBeInstanceOf(asm.CancellationError);
  });

  it('should have correct error properties via dynamic import', async () => {
    const asm = await import(distPath);

    const validationError = new asm.ValidationError('Validation failed', [
      { code: 'TEST', message: 'Test issue' },
    ]);
    expect(validationError.code).toBe('VALIDATION_ERROR');
    expect(validationError.issues).toHaveLength(1);
    expect(validationError.issues[0].code).toBe('TEST');

    const fileSystemError = new asm.FileSystemError('File error', '/test/path');
    expect(fileSystemError.code).toBe('FILE_SYSTEM_ERROR');
    expect(fileSystemError.path).toBe('/test/path');

    const packageError = new asm.PackageError('Package error');
    expect(packageError.code).toBe('PACKAGE_ERROR');

    const securityError = new asm.SecurityError('Security error');
    expect(securityError.code).toBe('SECURITY_ERROR');

    const cancellationError = new asm.CancellationError();
    expect(cancellationError.code).toBe('CANCELLED');
    expect(cancellationError.message).toBe('Operation cancelled');
  });
});
