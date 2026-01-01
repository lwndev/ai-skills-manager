/**
 * Tests for install formatter
 */

import {
  formatPackageWarnings,
  formatLargePackageProgress,
  formatInstallProgress,
  formatInstallSuccess,
  formatDryRunOutput,
  formatQuietOutput,
  formatSecurityWarning,
  formatNextSteps,
  formatValidationProgress,
  formatExtractionProgress,
  formatInstallError,
  formatOverwritePrompt,
  formatInstallOutput,
  ValidationCheck,
} from '../../../src/formatters/install-formatter';
import { PackageWarnings } from '../../../src/generators/install-validator';
import { InstallResult, DryRunPreview, FileComparison } from '../../../src/types/install';
import { PackageValidationError, InvalidPackageError } from '../../../src/utils/errors';

describe('Install Formatter', () => {
  describe('formatPackageWarnings', () => {
    it('returns empty string when no warnings', () => {
      const warnings: PackageWarnings = {
        nestedSkillFiles: [],
        externalUrls: [],
        windowsPaths: [],
        isLargePackage: false,
        isVeryLargePackage: false,
        totalSize: 1000,
      };

      const output = formatPackageWarnings(warnings);

      expect(output).toBe('');
    });

    it('formats very large package warning', () => {
      const warnings: PackageWarnings = {
        nestedSkillFiles: [],
        externalUrls: [],
        windowsPaths: [],
        isLargePackage: true,
        isVeryLargePackage: true,
        totalSize: 60 * 1024 * 1024, // 60MB
      };

      const output = formatPackageWarnings(warnings);

      expect(output).toContain('Large package');
      expect(output).toContain('larger than 50MB');
    });

    it('formats nested .skill files warning', () => {
      const warnings: PackageWarnings = {
        nestedSkillFiles: ['my-skill/nested.skill', 'my-skill/deps/other.skill'],
        externalUrls: [],
        windowsPaths: [],
        isLargePackage: false,
        isVeryLargePackage: false,
        totalSize: 1000,
      };

      const output = formatPackageWarnings(warnings);

      expect(output).toContain('Nested .skill files detected');
      expect(output).toContain('my-skill/nested.skill');
      expect(output).toContain('my-skill/deps/other.skill');
      expect(output).toContain('may cause confusion');
    });

    it('truncates long list of nested .skill files', () => {
      const warnings: PackageWarnings = {
        nestedSkillFiles: [
          'a.skill',
          'b.skill',
          'c.skill',
          'd.skill',
          'e.skill',
          'f.skill',
          'g.skill',
        ],
        externalUrls: [],
        windowsPaths: [],
        isLargePackage: false,
        isVeryLargePackage: false,
        totalSize: 1000,
      };

      const output = formatPackageWarnings(warnings);

      expect(output).toContain('a.skill');
      expect(output).toContain('... and 2 more');
    });

    it('formats external URLs warning', () => {
      const warnings: PackageWarnings = {
        nestedSkillFiles: [],
        externalUrls: ['https://example.com/api', 'http://external.org/endpoint'],
        windowsPaths: [],
        isLargePackage: false,
        isVeryLargePackage: false,
        totalSize: 1000,
      };

      const output = formatPackageWarnings(warnings);

      expect(output).toContain('External URLs detected');
      expect(output).toContain('https://example.com/api');
      expect(output).toContain('http://external.org/endpoint');
      expect(output).toContain('ensure they are trusted');
    });

    it('formats Windows paths warning', () => {
      const warnings: PackageWarnings = {
        nestedSkillFiles: [],
        externalUrls: [],
        windowsPaths: ['C:\\Users\\Admin\\script.py', 'scripts\\helper.bat'],
        isLargePackage: false,
        isVeryLargePackage: false,
        totalSize: 1000,
      };

      const output = formatPackageWarnings(warnings);

      expect(output).toContain('Windows-style paths detected');
      expect(output).toContain('C:\\Users\\Admin\\script.py');
      expect(output).toContain('scripts\\helper.bat');
      expect(output).toContain('not work correctly on macOS or Linux');
    });

    it('formats multiple warnings together', () => {
      const warnings: PackageWarnings = {
        nestedSkillFiles: ['nested.skill'],
        externalUrls: ['https://example.com'],
        windowsPaths: ['scripts\\run.bat'],
        isLargePackage: true,
        isVeryLargePackage: true,
        totalSize: 60 * 1024 * 1024,
      };

      const output = formatPackageWarnings(warnings);

      expect(output).toContain('Large package');
      expect(output).toContain('Nested .skill files detected');
      expect(output).toContain('External URLs detected');
      expect(output).toContain('Windows-style paths detected');
    });
  });

  describe('formatLargePackageProgress', () => {
    it('formats large package progress message', () => {
      const output = formatLargePackageProgress(10 * 1024 * 1024); // 10MB

      expect(output).toContain('Extracting large package');
      expect(output).toContain('10');
    });
  });

  describe('formatInstallProgress', () => {
    it('formats opening stage', () => {
      const output = formatInstallProgress('opening');
      expect(output).toContain('Opening package');
    });

    it('formats validating stage', () => {
      const output = formatInstallProgress('validating');
      expect(output).toContain('Validating package structure');
    });

    it('formats checking stage with detail', () => {
      const output = formatInstallProgress('checking', '/path/to/skill');
      expect(output).toContain('Checking for existing skill');
      expect(output).toContain('/path/to/skill');
    });

    it('formats checking stage without detail', () => {
      const output = formatInstallProgress('checking');
      expect(output).toContain('Checking for existing skill');
    });

    it('formats extracting stage', () => {
      const output = formatInstallProgress('extracting');
      expect(output).toContain('Extracting files');
    });

    it('formats verifying stage', () => {
      const output = formatInstallProgress('verifying');
      expect(output).toContain('Verifying installation');
    });

    it('formats complete stage', () => {
      const output = formatInstallProgress('complete');
      expect(output).toContain('Skill installed successfully');
    });

    it('handles unknown stage with default message', () => {
      // Cast to avoid TypeScript error for unknown stage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const output = formatInstallProgress('unknown' as any);
      expect(output).toContain('Processing');
    });
  });

  describe('formatInstallSuccess', () => {
    it('formats successful installation result', () => {
      const result: InstallResult = {
        type: 'install-result',
        success: true,
        skillPath: '/path/to/skill',
        skillName: 'my-skill',
        fileCount: 5,
        size: 1024,
        wasOverwritten: false,
        errors: [],
      };

      const output = formatInstallSuccess(result);

      expect(output).toContain('Skill installed successfully');
      expect(output).toContain('my-skill');
      expect(output).toContain('/path/to/skill');
      expect(output).toContain('5');
    });

    it('indicates when previous version was overwritten', () => {
      const result: InstallResult = {
        type: 'install-result',
        success: true,
        skillPath: '/path/to/skill',
        skillName: 'my-skill',
        fileCount: 5,
        size: 1024,
        wasOverwritten: true,
        errors: [],
      };

      const output = formatInstallSuccess(result);

      expect(output).toContain('Previous version was overwritten');
    });
  });

  describe('formatDryRunOutput', () => {
    it('formats dry-run preview', () => {
      const preview: DryRunPreview = {
        type: 'dry-run-preview',
        skillName: 'my-skill',
        targetPath: '/path/to/skill',
        files: [
          { path: 'SKILL.md', size: 500, isDirectory: false },
          { path: 'scripts/helper.py', size: 200, isDirectory: false },
        ],
        totalSize: 700,
        wouldOverwrite: false,
        conflicts: [],
      };

      const output = formatDryRunOutput(preview);

      expect(output).toContain('Dry run');
      expect(output).toContain('no files were modified');
      expect(output).toContain('my-skill');
      expect(output).toContain('/path/to/skill');
      expect(output).toContain('SKILL.md');
    });

    it('indicates overwrite in dry-run', () => {
      const preview: DryRunPreview = {
        type: 'dry-run-preview',
        skillName: 'my-skill',
        targetPath: '/path/to/skill',
        files: [{ path: 'SKILL.md', size: 500, isDirectory: false }],
        totalSize: 500,
        wouldOverwrite: true,
        conflicts: ['SKILL.md'],
      };

      const output = formatDryRunOutput(preview);

      expect(output).toContain('Would overwrite existing skill');
      expect(output).toContain('Conflicting files');
    });
  });

  describe('formatQuietOutput', () => {
    it('returns skill path on success', () => {
      const result: InstallResult = {
        type: 'install-result',
        success: true,
        skillPath: '/path/to/skill',
        skillName: 'my-skill',
        fileCount: 5,
        size: 1024,
        wasOverwritten: false,
        errors: [],
      };

      const output = formatQuietOutput(result);

      expect(output).toBe('/path/to/skill');
    });

    it('returns FAIL with errors on failure', () => {
      const result: InstallResult = {
        type: 'install-result',
        success: false,
        skillPath: '/path/to/skill',
        skillName: 'my-skill',
        fileCount: 0,
        size: 0,
        wasOverwritten: false,
        errors: ['Validation failed'],
      };

      const output = formatQuietOutput(result);

      expect(output).toContain('FAIL');
      expect(output).toContain('Validation failed');
    });
  });

  describe('formatSecurityWarning', () => {
    it('returns security warning message', () => {
      const output = formatSecurityWarning();

      expect(output).toContain('Security');
      expect(output).toContain('execute code');
      expect(output).toContain('trusted sources');
    });
  });

  describe('formatNextSteps', () => {
    it('returns next steps guidance', () => {
      const output = formatNextSteps();

      expect(output).toContain('Next steps');
      expect(output).toContain('Review');
      expect(output).toContain('Test');
      expect(output).toContain('Validate');
    });
  });

  describe('formatValidationProgress', () => {
    it('formats validation checks with passed status', () => {
      const checks: ValidationCheck[] = [
        { name: 'Package format', passed: true },
        { name: 'SKILL.md exists', passed: true, detail: 'found' },
      ];

      const output = formatValidationProgress(checks);

      expect(output).toContain('Package validation');
      expect(output).toContain('✓');
      expect(output).toContain('Package format');
      expect(output).toContain('SKILL.md exists');
      expect(output).toContain('(found)');
    });

    it('formats validation checks with failed status', () => {
      const checks: ValidationCheck[] = [
        { name: 'Package format', passed: false },
        { name: 'SKILL.md exists', passed: false, detail: 'missing' },
      ];

      const output = formatValidationProgress(checks);

      expect(output).toContain('✗');
      expect(output).toContain('Package format');
      expect(output).toContain('(missing)');
    });
  });

  describe('formatExtractionProgress', () => {
    it('formats file extraction progress', () => {
      const output = formatExtractionProgress('SKILL.md', 3, 10);

      expect(output).toContain('Extracting');
      expect(output).toContain('3/10');
      expect(output).toContain('SKILL.md');
    });
  });

  describe('formatInstallError', () => {
    it('formats basic error message', () => {
      const err = new Error('Something went wrong');

      const output = formatInstallError(err);

      expect(output).toContain('Something went wrong');
    });

    it('formats PackageValidationError with validation errors', () => {
      const err = new PackageValidationError('Package validation failed', [
        'Missing name field',
        'Description too long',
      ]);

      const output = formatInstallError(err);

      expect(output).toContain('Package validation failed');
      expect(output).toContain('Validation errors');
      expect(output).toContain('Missing name field');
      expect(output).toContain('Description too long');
    });

    it('formats InvalidPackageError with package hint', () => {
      const err = new InvalidPackageError('/path/to/package.skill', 'Not a valid skill package');

      const output = formatInstallError(err);

      expect(output).toContain('Not a valid skill package');
      expect(output).toContain('asm package');
    });
  });

  describe('formatOverwritePrompt', () => {
    it('formats overwrite prompt with file comparison', () => {
      const files: FileComparison[] = [
        { path: 'SKILL.md', existsInTarget: true, wouldModify: true, packageSize: 500 },
        { path: 'scripts/helper.py', existsInTarget: false, wouldModify: false, packageSize: 200 },
        { path: 'README.md', existsInTarget: true, wouldModify: false, packageSize: 100 },
      ];

      const output = formatOverwritePrompt('my-skill', '/path/to/skill', files);

      expect(output).toContain('my-skill');
      expect(output).toContain('/path/to/skill');
      expect(output).toContain('already exists');
      expect(output).toContain('Changes');
      expect(output).toContain('1 new file');
      expect(output).toContain('1 modified file');
      expect(output).toContain('1 unchanged file');
    });

    it('handles plural files correctly', () => {
      const files: FileComparison[] = [
        { path: 'a.md', existsInTarget: false, wouldModify: false, packageSize: 100 },
        { path: 'b.md', existsInTarget: false, wouldModify: false, packageSize: 100 },
        { path: 'c.md', existsInTarget: true, wouldModify: true, packageSize: 100 },
        { path: 'd.md', existsInTarget: true, wouldModify: true, packageSize: 100 },
      ];

      const output = formatOverwritePrompt('my-skill', '/path', files);

      expect(output).toContain('2 new files');
      expect(output).toContain('2 modified files');
    });
  });

  describe('formatDryRunOutput edge cases', () => {
    it('truncates long conflict list', () => {
      const preview: DryRunPreview = {
        type: 'dry-run-preview',
        skillName: 'my-skill',
        targetPath: '/path/to/skill',
        files: [{ path: 'SKILL.md', size: 500, isDirectory: false }],
        totalSize: 500,
        wouldOverwrite: true,
        conflicts: Array.from({ length: 15 }, (_, i) => `file${i}.md`),
      };

      const output = formatDryRunOutput(preview);

      expect(output).toContain('file0.md');
      expect(output).toContain('... and 5 more');
    });

    it('truncates long file list', () => {
      const files = Array.from({ length: 20 }, (_, i) => ({
        path: `file${i}.md`,
        size: 100,
        isDirectory: false,
      }));

      const preview: DryRunPreview = {
        type: 'dry-run-preview',
        skillName: 'my-skill',
        targetPath: '/path/to/skill',
        files,
        totalSize: 2000,
        wouldOverwrite: false,
        conflicts: [],
      };

      const output = formatDryRunOutput(preview);

      expect(output).toContain('file0.md');
      expect(output).toContain('... and 5 more files');
    });
  });

  describe('formatInstallOutput', () => {
    it('returns quiet output when quiet option is true', () => {
      const result: InstallResult = {
        type: 'install-result',
        success: true,
        skillPath: '/path/to/skill',
        skillName: 'my-skill',
        fileCount: 5,
        size: 1024,
        wasOverwritten: false,
        errors: [],
      };

      const output = formatInstallOutput(result, { quiet: true });

      expect(output).toBe('/path/to/skill');
    });

    it('returns full success output when quiet is false', () => {
      const result: InstallResult = {
        type: 'install-result',
        success: true,
        skillPath: '/path/to/skill',
        skillName: 'my-skill',
        fileCount: 5,
        size: 1024,
        wasOverwritten: false,
        errors: [],
      };

      const output = formatInstallOutput(result, { quiet: false });

      expect(output).toContain('Skill installed successfully');
      expect(output).toContain('my-skill');
    });
  });

  describe('formatQuietOutput edge cases', () => {
    it('returns Unknown error when errors array is empty', () => {
      const result: InstallResult = {
        type: 'install-result',
        success: false,
        skillPath: '/path/to/skill',
        skillName: 'my-skill',
        fileCount: 0,
        size: 0,
        wasOverwritten: false,
        errors: [],
      };

      const output = formatQuietOutput(result);

      expect(output).toContain('FAIL');
      expect(output).toContain('Unknown error');
    });
  });

  describe('formatPackageWarnings truncation', () => {
    it('truncates long list of external URLs', () => {
      const warnings: PackageWarnings = {
        nestedSkillFiles: [],
        externalUrls: Array.from({ length: 8 }, (_, i) => `https://example${i}.com`),
        windowsPaths: [],
        isLargePackage: false,
        isVeryLargePackage: false,
        totalSize: 1000,
      };

      const output = formatPackageWarnings(warnings);

      expect(output).toContain('https://example0.com');
      expect(output).toContain('... and 3 more');
    });

    it('truncates long list of Windows paths', () => {
      const warnings: PackageWarnings = {
        nestedSkillFiles: [],
        externalUrls: [],
        windowsPaths: Array.from({ length: 8 }, (_, i) => `C:\\path${i}\\file.bat`),
        isLargePackage: false,
        isVeryLargePackage: false,
        totalSize: 1000,
      };

      const output = formatPackageWarnings(warnings);

      expect(output).toContain('C:\\path0\\file.bat');
      expect(output).toContain('... and 3 more');
    });
  });
});
