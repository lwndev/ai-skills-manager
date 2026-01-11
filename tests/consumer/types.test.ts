/**
 * TypeScript Type Inference Test
 *
 * Tests that TypeScript correctly infers types from the package exports.
 * This validates type definitions are correctly exported and usable.
 */

// Import types and functions from source to test type inference
import {
  // API Functions
  scaffold,
  validate,
  createPackage,
  install,
  update,
  uninstall,
  list,
  // Error Classes
  AsmError,
  ValidationError,
  FileSystemError,
  PackageError,
  SecurityError,
  CancellationError,
  // Types (these are type-only imports, verified at compile time)
  type ApiScope,
  type ApiListScope,
  type InstalledSkillScope,
  type ValidationIssue,
  type ValidationWarning,
  type ValidateResult,
  type ScaffoldOptions,
  type ScaffoldResult,
  type CreatePackageOptions,
  type CreatePackageResult,
  type InstallOptions,
  type InstallResult,
  type UpdateOptions,
  type UpdateResult,
  type UninstallOptions,
  type UninstallResult,
  type ListOptions,
  type InstalledSkill,
  type AsmErrorCode,
} from '../../src/index';

describe('TypeScript Type Inference', () => {
  describe('API Function Types', () => {
    it('should infer scaffold function signature', () => {
      // TypeScript should infer these types correctly
      const options: ScaffoldOptions = {
        name: 'test-skill',
        description: 'Test description',
        scope: 'project',
      };

      // Function should accept ScaffoldOptions
      expect(typeof scaffold).toBe('function');

      // Verify options type structure (scope is 'project' as set above)
      const scope: ApiScope = options.scope ?? 'project';
      expect(['project', 'personal']).toContain(scope);
    });

    it('should infer validate function signature', () => {
      expect(typeof validate).toBe('function');

      // ValidateResult type should have these properties
      const mockResult: ValidateResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      expect(mockResult.valid).toBe(true);
      expect(Array.isArray(mockResult.errors)).toBe(true);
      expect(Array.isArray(mockResult.warnings)).toBe(true);
    });

    it('should infer createPackage function signature', () => {
      const options: CreatePackageOptions = {
        path: '/test/path',
        output: '/output/path',
        skipValidation: false,
        force: false,
      };

      expect(typeof createPackage).toBe('function');
      expect(options.path).toBe('/test/path');
    });

    it('should infer install function signature', () => {
      const options: InstallOptions = {
        file: '/test/package.skill',
        scope: 'personal',
        force: false,
        dryRun: false,
      };

      expect(typeof install).toBe('function');
      expect(options.file).toBe('/test/package.skill');
    });

    it('should infer update function signature', () => {
      const options: UpdateOptions = {
        name: 'test-skill',
        file: '/test/package.skill',
        scope: 'project',
        keepBackup: true,
      };

      expect(typeof update).toBe('function');
      expect(options.name).toBe('test-skill');
    });

    it('should infer uninstall function signature', () => {
      const options: UninstallOptions = {
        names: ['skill-1', 'skill-2'],
        scope: 'project',
        force: true,
      };

      expect(typeof uninstall).toBe('function');
      expect(options.names).toHaveLength(2);
    });

    it('should infer list function signature', () => {
      const options: ListOptions = {
        scope: 'all',
      };

      expect(typeof list).toBe('function');

      // ApiListScope should include 'all' (scope is 'all' as set above)
      const listScope: ApiListScope = options.scope ?? 'all';
      expect(['project', 'personal', 'all']).toContain(listScope);
    });
  });

  describe('Error Class Types', () => {
    it('should have correct AsmError type', () => {
      const error = new AsmError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AsmError);
      expect(error.name).toBe('AsmError');

      // Error code should be typed
      const code: AsmErrorCode = error.code;
      expect(code).toBe('ASM_ERROR');
    });

    it('should have correct ValidationError type with issues', () => {
      const issues: ValidationIssue[] = [
        { code: 'TEST_ERROR', message: 'Test message', path: '/test' },
      ];
      const error = new ValidationError('Validation failed', issues);

      expect(error).toBeInstanceOf(AsmError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.issues).toHaveLength(1);
      expect(error.issues[0].code).toBe('TEST_ERROR');
    });

    it('should have correct FileSystemError type with path', () => {
      const error = new FileSystemError('File not found', '/test/path');

      expect(error).toBeInstanceOf(AsmError);
      expect(error).toBeInstanceOf(FileSystemError);
      expect(error.code).toBe('FILE_SYSTEM_ERROR');
      expect(error.path).toBe('/test/path');
    });

    it('should have correct PackageError type', () => {
      const error = new PackageError('Invalid package');

      expect(error).toBeInstanceOf(AsmError);
      expect(error).toBeInstanceOf(PackageError);
      expect(error.code).toBe('PACKAGE_ERROR');
    });

    it('should have correct SecurityError type', () => {
      const error = new SecurityError('Path traversal detected');

      expect(error).toBeInstanceOf(AsmError);
      expect(error).toBeInstanceOf(SecurityError);
      expect(error.code).toBe('SECURITY_ERROR');
    });

    it('should have correct CancellationError type', () => {
      const error = new CancellationError();

      expect(error).toBeInstanceOf(AsmError);
      expect(error).toBeInstanceOf(CancellationError);
      expect(error.code).toBe('CANCELLED');
      expect(error.message).toBe('Operation cancelled');

      // Should accept custom message
      const customError = new CancellationError('User cancelled');
      expect(customError.message).toBe('User cancelled');
    });
  });

  describe('Result Types', () => {
    it('should correctly type ScaffoldResult', () => {
      const result: ScaffoldResult = {
        path: '/test/skill',
        files: ['SKILL.md', 'references/example.md'],
      };

      expect(result.path).toBe('/test/skill');
      expect(result.files).toHaveLength(2);
    });

    it('should correctly type CreatePackageResult', () => {
      const result: CreatePackageResult = {
        packagePath: '/output/skill.skill',
        size: 1024,
        fileCount: 5,
      };

      expect(result.packagePath).toBe('/output/skill.skill');
      expect(result.size).toBe(1024);
      expect(result.fileCount).toBe(5);
    });

    it('should correctly type InstallResult', () => {
      const result: InstallResult = {
        installedPath: '/skills/test-skill',
        skillName: 'test-skill',
        version: '1.0.0',
        dryRun: false,
      };

      expect(result.installedPath).toBe('/skills/test-skill');
      expect(result.skillName).toBe('test-skill');
      expect(result.version).toBe('1.0.0');
      expect(result.dryRun).toBe(false);
    });

    it('should correctly type UpdateResult', () => {
      const result: UpdateResult = {
        updatedPath: '/skills/test-skill',
        previousVersion: '1.0.0',
        newVersion: '2.0.0',
        backupPath: '/backups/test-skill.bak',
        dryRun: false,
      };

      expect(result.updatedPath).toBe('/skills/test-skill');
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.newVersion).toBe('2.0.0');
      expect(result.dryRun).toBe(false);
    });

    it('should correctly type UninstallResult', () => {
      const result: UninstallResult = {
        removed: ['skill-1', 'skill-2'],
        notFound: ['skill-3'],
        dryRun: false,
      };

      expect(result.removed).toHaveLength(2);
      expect(result.notFound).toHaveLength(1);
      expect(result.dryRun).toBe(false);
    });

    it('should correctly type InstalledSkill', () => {
      const skill: InstalledSkill = {
        name: 'test-skill',
        path: '/skills/test-skill',
        scope: 'project',
        version: '1.0.0',
        description: 'A test skill',
      };

      expect(skill.name).toBe('test-skill');
      expect(skill.scope).toBe('project');

      // Test all scope values
      const projectScope: InstalledSkillScope = 'project';
      const personalScope: InstalledSkillScope = 'personal';
      const customScope: InstalledSkillScope = 'custom';

      expect(['project', 'personal', 'custom']).toContain(projectScope);
      expect(['project', 'personal', 'custom']).toContain(personalScope);
      expect(['project', 'personal', 'custom']).toContain(customScope);
    });
  });

  describe('Validation Types', () => {
    it('should correctly type ValidationIssue', () => {
      const issue: ValidationIssue = {
        code: 'MISSING_FRONTMATTER',
        message: 'SKILL.md is missing frontmatter',
        path: '/skill/SKILL.md',
      };

      expect(issue.code).toBe('MISSING_FRONTMATTER');
      expect(issue.message).toBeDefined();
      expect(issue.path).toBe('/skill/SKILL.md');
    });

    it('should correctly type ValidationWarning', () => {
      const warning: ValidationWarning = {
        code: 'LARGE_FILE',
        message: 'File exceeds recommended size',
        path: '/skill/references/large-file.txt',
      };

      expect(warning.code).toBe('LARGE_FILE');
      expect(warning.message).toBeDefined();
      expect(warning.path).toBeDefined();
    });
  });
});
