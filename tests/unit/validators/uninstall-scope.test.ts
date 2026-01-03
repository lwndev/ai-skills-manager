import { validateUninstallScope, VALID_SCOPES } from '../../../src/validators/uninstall-scope';

describe('validateUninstallScope', () => {
  describe('valid scopes', () => {
    it('accepts "project" scope', () => {
      const result = validateUninstallScope('project');
      expect(result.valid).toBe(true);
      expect(result.scope).toBe('project');
      expect(result.error).toBeUndefined();
    });

    it('accepts "personal" scope', () => {
      const result = validateUninstallScope('personal');
      expect(result.valid).toBe(true);
      expect(result.scope).toBe('personal');
      expect(result.error).toBeUndefined();
    });
  });

  describe('default behavior', () => {
    it('defaults to "project" when undefined', () => {
      const result = validateUninstallScope(undefined);
      expect(result.valid).toBe(true);
      expect(result.scope).toBe('project');
      expect(result.error).toBeUndefined();
    });

    it('defaults to "project" when empty string', () => {
      const result = validateUninstallScope('');
      expect(result.valid).toBe(true);
      expect(result.scope).toBe('project');
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid scopes - case sensitivity', () => {
    it('rejects uppercase "PROJECT"', () => {
      const result = validateUninstallScope('PROJECT');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
      expect(result.error).toContain('PROJECT');
    });

    it('rejects uppercase "PERSONAL"', () => {
      const result = validateUninstallScope('PERSONAL');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });

    it('rejects mixed case "Project"', () => {
      const result = validateUninstallScope('Project');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });

    it('rejects mixed case "Personal"', () => {
      const result = validateUninstallScope('Personal');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });
  });

  describe('invalid scopes - custom paths not allowed', () => {
    it('rejects absolute path', () => {
      const result = validateUninstallScope('/some/custom/path');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
      expect(result.error).toContain("Only 'project' or 'personal' are supported");
    });

    it('rejects relative path', () => {
      const result = validateUninstallScope('./custom/path');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });

    it('rejects home directory path', () => {
      const result = validateUninstallScope('~/custom/path');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });

    it('rejects Windows path', () => {
      const result = validateUninstallScope('C:\\Users\\custom');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });
  });

  describe('invalid scopes - other values', () => {
    it('rejects "global"', () => {
      const result = validateUninstallScope('global');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });

    it('rejects "system"', () => {
      const result = validateUninstallScope('system');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });

    it('rejects "local"', () => {
      const result = validateUninstallScope('local');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });

    it('rejects "user"', () => {
      const result = validateUninstallScope('user');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });

    it('rejects whitespace', () => {
      const result = validateUninstallScope('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });

    it('rejects "project " with trailing space', () => {
      const result = validateUninstallScope('project ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });

    it('rejects " project" with leading space', () => {
      const result = validateUninstallScope(' project');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid scope');
    });
  });

  describe('VALID_SCOPES constant', () => {
    it('contains exactly two valid scopes', () => {
      expect(VALID_SCOPES).toHaveLength(2);
    });

    it('contains "project"', () => {
      expect(VALID_SCOPES).toContain('project');
    });

    it('contains "personal"', () => {
      expect(VALID_SCOPES).toContain('personal');
    });
  });
});
