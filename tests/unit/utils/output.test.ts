/**
 * Tests for output formatting utilities
 */

import * as output from '../../../src/utils/output';

describe('output formatting functions', () => {
  describe('success', () => {
    it('formats message with checkmark', () => {
      const result = output.success('Operation completed');
      expect(result).toBe('✓ Operation completed');
    });

    it('handles empty message', () => {
      const result = output.success('');
      expect(result).toBe('✓ ');
    });
  });

  describe('error', () => {
    it('formats message with error prefix', () => {
      const result = output.error('Something went wrong');
      expect(result).toBe('✗ Error: Something went wrong');
    });

    it('handles empty message', () => {
      const result = output.error('');
      expect(result).toBe('✗ Error: ');
    });
  });

  describe('warning', () => {
    it('formats message with warning symbol', () => {
      const result = output.warning('Proceed with caution');
      expect(result).toBe('⚠ Proceed with caution');
    });

    it('handles empty message', () => {
      const result = output.warning('');
      expect(result).toBe('⚠ ');
    });
  });

  describe('info', () => {
    it('formats message with info symbol', () => {
      const result = output.info('Additional information');
      expect(result).toBe('ℹ Additional information');
    });

    it('handles empty message', () => {
      const result = output.info('');
      expect(result).toBe('ℹ ');
    });
  });

  describe('filePath', () => {
    it('formats path with indentation', () => {
      const result = output.filePath('/path/to/file.txt');
      expect(result).toBe('  /path/to/file.txt');
    });

    it('handles empty path', () => {
      const result = output.filePath('');
      expect(result).toBe('  ');
    });
  });
});

describe('display functions', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('displayCreatedFiles', () => {
    it('displays success message and file list', () => {
      const skillPath = '/path/to/my-skill';
      const filesCreated = ['/path/to/my-skill/SKILL.md', '/path/to/my-skill/scripts/.gitkeep'];

      output.displayCreatedFiles(skillPath, filesCreated);

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Skill scaffolded successfully!');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nCreated:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  /path/to/my-skill/');
      expect(consoleLogSpy).toHaveBeenCalledWith('    SKILL.md');
      expect(consoleLogSpy).toHaveBeenCalledWith('    scripts/.gitkeep');
    });

    it('handles empty files list', () => {
      output.displayCreatedFiles('/path/to/skill', []);

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Skill scaffolded successfully!');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nCreated:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  /path/to/skill/');
    });
  });

  describe('displayNextSteps', () => {
    it('displays next steps with documentation link', () => {
      output.displayNextSteps('/path/to/my-skill', 'my-skill');

      expect(consoleLogSpy).toHaveBeenCalledWith('\nNext steps:');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Edit the SKILL.md'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('scripts/'));
      expect(consoleLogSpy).toHaveBeenCalledWith('\nDocumentation:');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://docs.claude.com')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('\nSkill location:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  /path/to/my-skill');
    });
  });

  describe('displayError', () => {
    it('displays error message', () => {
      output.displayError('Something failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Error: Something failed');
    });

    it('displays error with context', () => {
      output.displayError('Something failed', 'Check permissions');

      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Error: Something failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('  Check permissions');
    });

    it('does not display context when undefined', () => {
      output.displayError('Error only');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Error: Error only');
    });
  });

  describe('displayValidationError', () => {
    it('displays validation error with field name', () => {
      output.displayValidationError('name', 'must be lowercase');

      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Error: Invalid name');
      expect(consoleErrorSpy).toHaveBeenCalledWith('  must be lowercase');
    });

    it('handles different field names', () => {
      output.displayValidationError('description', 'too long');

      expect(consoleErrorSpy).toHaveBeenCalledWith('✗ Error: Invalid description');
      expect(consoleErrorSpy).toHaveBeenCalledWith('  too long');
    });
  });
});
