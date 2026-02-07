/**
 * Tests for validate command output formatters
 */

import {
  formatNormal,
  formatQuiet,
  formatJSON,
  formatValidationOutput,
} from '../../../src/formatters/validate-formatter';
import { ValidationResult } from '../../../src/types/validation';

describe('validate formatters', () => {
  const validResult: ValidationResult = {
    valid: true,
    skillPath: '/path/to/my-skill',
    skillName: 'my-skill',
    checks: {
      fileExists: { passed: true },
      frontmatterValid: { passed: true },
      requiredFields: { passed: true },
      allowedProperties: { passed: true },
      nameFormat: { passed: true },
      descriptionFormat: { passed: true },
      compatibilityFormat: { passed: true },
      nameMatchesDirectory: { passed: true },
      contextFormat: { passed: true },
      agentFormat: { passed: true },
      hooksFormat: { passed: true },
      userInvocableFormat: { passed: true },
      memoryFormat: { passed: true },
      skillsFormat: { passed: true },
      modelFormat: { passed: true },
      permissionModeFormat: { passed: true },
      disallowedToolsFormat: { passed: true },
      argumentHintFormat: { passed: true },
      keepCodingInstructionsFormat: { passed: true },
      toolsFormat: { passed: true },
      colorFormat: { passed: true },
      disableModelInvocationFormat: { passed: true },
      versionFormat: { passed: true },
      allowedToolsFormat: { passed: true },
    },
    errors: [],
    warnings: [],
  };

  const invalidResult: ValidationResult = {
    valid: false,
    skillPath: '/path/to/invalid-skill',
    skillName: 'invalid_skill',
    checks: {
      fileExists: { passed: true },
      frontmatterValid: { passed: true },
      requiredFields: { passed: true },
      allowedProperties: { passed: false, error: 'Unknown property: invalid-prop' },
      nameFormat: {
        passed: false,
        error: 'Name must be in hyphen-case format (e.g., my-skill-name)',
      },
      descriptionFormat: { passed: true },
      compatibilityFormat: { passed: true },
      nameMatchesDirectory: { passed: true },
      contextFormat: { passed: true },
      agentFormat: { passed: true },
      hooksFormat: { passed: true },
      userInvocableFormat: { passed: true },
      memoryFormat: { passed: true },
      skillsFormat: { passed: true },
      modelFormat: { passed: true },
      permissionModeFormat: { passed: true },
      disallowedToolsFormat: { passed: true },
      argumentHintFormat: { passed: true },
      keepCodingInstructionsFormat: { passed: true },
      toolsFormat: { passed: true },
      colorFormat: { passed: true },
      disableModelInvocationFormat: { passed: true },
      versionFormat: { passed: true },
      allowedToolsFormat: { passed: true },
    },
    errors: [
      'Unknown property: invalid-prop',
      'Name must be in hyphen-case format (e.g., my-skill-name)',
    ],
    warnings: [],
  };

  const fileNotFoundResult: ValidationResult = {
    valid: false,
    skillPath: '/path/to/missing',
    checks: {
      fileExists: { passed: false, error: 'SKILL.md not found at /path/to/missing' },
      frontmatterValid: { passed: false },
      requiredFields: { passed: false },
      allowedProperties: { passed: false },
      nameFormat: { passed: false },
      descriptionFormat: { passed: false },
      compatibilityFormat: { passed: false },
      nameMatchesDirectory: { passed: false },
      contextFormat: { passed: false },
      agentFormat: { passed: false },
      hooksFormat: { passed: false },
      userInvocableFormat: { passed: false },
      memoryFormat: { passed: false },
      skillsFormat: { passed: false },
      modelFormat: { passed: false },
      permissionModeFormat: { passed: false },
      disallowedToolsFormat: { passed: false },
      argumentHintFormat: { passed: false },
      keepCodingInstructionsFormat: { passed: false },
      toolsFormat: { passed: false },
      colorFormat: { passed: false },
      disableModelInvocationFormat: { passed: false },
      versionFormat: { passed: false },
      allowedToolsFormat: { passed: false },
    },
    errors: ['SKILL.md not found at /path/to/missing'],
    warnings: [],
  };

  describe('formatNormal', () => {
    it('formats valid skill with all checks passing', () => {
      const output = formatNormal(validResult);

      expect(output).toContain('Validating skill at: /path/to/my-skill');
      expect(output).toContain('Skill name: my-skill');
      expect(output).toContain('✓ File existence');
      expect(output).toContain('✓ Frontmatter validity');
      expect(output).toContain('✓ Required fields');
      expect(output).toContain('✓ Allowed properties');
      expect(output).toContain('✓ Name format');
      expect(output).toContain('✓ Description format');
      expect(output).toContain('✓ Skill is valid!');
    });

    it('formats invalid skill with failing checks', () => {
      const output = formatNormal(invalidResult);

      expect(output).toContain('Validating skill at: /path/to/invalid-skill');
      expect(output).toContain('Skill name: invalid_skill');
      expect(output).toContain('✓ File existence');
      expect(output).toContain('✓ Frontmatter validity');
      expect(output).toContain('✓ Required fields');
      expect(output).toContain('✗ Error: Allowed properties');
      expect(output).toContain('Unknown property: invalid-prop');
      expect(output).toContain('✗ Error: Name format');
      expect(output).toContain('Name must be in hyphen-case format');
      expect(output).toContain('✗ Error: Skill validation failed with 2 error(s)');
    });

    it('formats result without skill name', () => {
      const resultWithoutName = { ...validResult, skillName: undefined };
      const output = formatNormal(resultWithoutName);

      expect(output).toContain('Validating skill at: /path/to/my-skill');
      expect(output).not.toContain('Skill name:');
    });

    it('shows file not found error first', () => {
      const output = formatNormal(fileNotFoundResult);

      expect(output).toContain('✗ Error: File existence');
      expect(output).toContain('SKILL.md not found at /path/to/missing');
      expect(output).toContain('✗ Error: Skill validation failed with 1 error(s)');
    });

    it('includes error messages for each failing check', () => {
      const result: ValidationResult = {
        valid: false,
        skillPath: '/test',
        checks: {
          fileExists: { passed: true },
          frontmatterValid: { passed: false, error: 'Invalid YAML syntax' },
          requiredFields: { passed: false, error: 'Missing required field: name' },
          allowedProperties: { passed: true },
          nameFormat: { passed: true },
          descriptionFormat: { passed: true },
          compatibilityFormat: { passed: true },
          nameMatchesDirectory: { passed: true },
          contextFormat: { passed: true },
          agentFormat: { passed: true },
          hooksFormat: { passed: true },
          userInvocableFormat: { passed: true },
          memoryFormat: { passed: true },
          skillsFormat: { passed: true },
          modelFormat: { passed: true },
          permissionModeFormat: { passed: true },
          disallowedToolsFormat: { passed: true },
          argumentHintFormat: { passed: true },
          keepCodingInstructionsFormat: { passed: true },
          toolsFormat: { passed: true },
          colorFormat: { passed: true },
          disableModelInvocationFormat: { passed: true },
          versionFormat: { passed: true },
          allowedToolsFormat: { passed: true },
        },
        errors: ['Invalid YAML syntax', 'Missing required field: name'],
        warnings: [],
      };

      const output = formatNormal(result);

      expect(output).toContain('✗ Error: Frontmatter validity');
      expect(output).toContain('Invalid YAML syntax');
      expect(output).toContain('✗ Error: Required fields');
      expect(output).toContain('Missing required field: name');
    });

    it('displays warnings when present', () => {
      const resultWithWarnings: ValidationResult = {
        valid: true,
        skillPath: '/path/to/my-skill',
        skillName: 'my-skill',
        checks: {
          fileExists: { passed: true },
          frontmatterValid: { passed: true },
          requiredFields: { passed: true },
          allowedProperties: { passed: true },
          nameFormat: { passed: true },
          descriptionFormat: { passed: true },
          compatibilityFormat: { passed: true },
          nameMatchesDirectory: { passed: true },
          contextFormat: { passed: true },
          agentFormat: { passed: true },
          hooksFormat: { passed: true },
          userInvocableFormat: { passed: true },
          memoryFormat: { passed: true },
          skillsFormat: { passed: true },
          modelFormat: { passed: true },
          permissionModeFormat: { passed: true },
          disallowedToolsFormat: { passed: true },
          argumentHintFormat: { passed: true },
          keepCodingInstructionsFormat: { passed: true },
          toolsFormat: { passed: true },
          colorFormat: { passed: true },
          disableModelInvocationFormat: { passed: true },
          versionFormat: { passed: true },
          allowedToolsFormat: { passed: true },
        },
        errors: [],
        warnings: ['Content size exceeds 50KB', 'Consider splitting into smaller files'],
      };

      const output = formatNormal(resultWithWarnings);

      expect(output).toContain('Warnings:');
      expect(output).toContain('Content size exceeds 50KB');
      expect(output).toContain('Consider splitting into smaller files');
      expect(output).toContain('✓ Skill is valid!');
    });
  });

  describe('formatQuiet', () => {
    it('returns PASS for valid skill', () => {
      const output = formatQuiet(validResult);
      expect(output).toBe('PASS');
    });

    it('returns FAIL with error count for invalid skill', () => {
      const output = formatQuiet(invalidResult);
      expect(output).toBe('FAIL: 2 error(s)');
    });

    it('returns FAIL with single error', () => {
      const output = formatQuiet(fileNotFoundResult);
      expect(output).toBe('FAIL: 1 error(s)');
    });

    it('handles multiple errors', () => {
      const multiErrorResult: ValidationResult = {
        ...invalidResult,
        errors: ['Error 1', 'Error 2', 'Error 3', 'Error 4'],
      };
      const output = formatQuiet(multiErrorResult);
      expect(output).toBe('FAIL: 4 error(s)');
    });
  });

  describe('formatJSON', () => {
    it('returns valid JSON for valid skill', () => {
      const output = formatJSON(validResult);
      const parsed = JSON.parse(output);

      expect(parsed.valid).toBe(true);
      expect(parsed.skillPath).toBe('/path/to/my-skill');
      expect(parsed.skillName).toBe('my-skill');
      expect(parsed.checks.fileExists.passed).toBe(true);
      expect(parsed.errors).toEqual([]);
    });

    it('returns valid JSON for invalid skill', () => {
      const output = formatJSON(invalidResult);
      const parsed = JSON.parse(output);

      expect(parsed.valid).toBe(false);
      expect(parsed.skillPath).toBe('/path/to/invalid-skill');
      expect(parsed.skillName).toBe('invalid_skill');
      expect(parsed.checks.allowedProperties.passed).toBe(false);
      expect(parsed.checks.allowedProperties.error).toBe('Unknown property: invalid-prop');
      expect(parsed.checks.nameFormat.passed).toBe(false);
      expect(parsed.errors).toHaveLength(2);
    });

    it('formats JSON with proper indentation', () => {
      const output = formatJSON(validResult);

      // Should be indented with 2 spaces
      expect(output).toContain('  "valid": true');
      expect(output).toContain('    "fileExists"');
    });

    it('includes all validation checks in output', () => {
      const output = formatJSON(validResult);
      const parsed = JSON.parse(output);

      expect(parsed.checks).toHaveProperty('fileExists');
      expect(parsed.checks).toHaveProperty('frontmatterValid');
      expect(parsed.checks).toHaveProperty('requiredFields');
      expect(parsed.checks).toHaveProperty('allowedProperties');
      expect(parsed.checks).toHaveProperty('nameFormat');
      expect(parsed.checks).toHaveProperty('descriptionFormat');
      expect(parsed.checks).toHaveProperty('compatibilityFormat');
      expect(parsed.checks).toHaveProperty('nameMatchesDirectory');
      expect(parsed.checks).toHaveProperty('contextFormat');
      expect(parsed.checks).toHaveProperty('agentFormat');
      expect(parsed.checks).toHaveProperty('hooksFormat');
      expect(parsed.checks).toHaveProperty('userInvocableFormat');
    });
  });

  describe('formatValidationOutput', () => {
    it('uses normal format by default', () => {
      const output = formatValidationOutput(validResult, {});

      expect(output).toContain('Validating skill at:');
      expect(output).toContain('✓ Skill is valid!');
    });

    it('uses quiet format when quiet option is true', () => {
      const output = formatValidationOutput(validResult, { quiet: true });

      expect(output).toBe('PASS');
    });

    it('uses JSON format when json option is true', () => {
      const output = formatValidationOutput(validResult, { json: true });

      const parsed = JSON.parse(output);
      expect(parsed.valid).toBe(true);
    });

    it('prefers JSON over quiet when both are true', () => {
      const output = formatValidationOutput(validResult, { quiet: true, json: true });

      // Should be valid JSON, not just "PASS"
      const parsed = JSON.parse(output);
      expect(parsed.valid).toBe(true);
    });

    it('handles invalid result in quiet mode', () => {
      const output = formatValidationOutput(invalidResult, { quiet: true });

      expect(output).toBe('FAIL: 2 error(s)');
    });

    it('handles invalid result in JSON mode', () => {
      const output = formatValidationOutput(invalidResult, { json: true });

      const parsed = JSON.parse(output);
      expect(parsed.valid).toBe(false);
      expect(parsed.errors).toHaveLength(2);
    });
  });
});
