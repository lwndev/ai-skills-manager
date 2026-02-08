/**
 * Tests for model field validator
 */

import { validateModel, ModelValidationResult } from '../../../src/validators/model';

describe('validateModel', () => {
  describe('valid cases', () => {
    it('returns valid for undefined (optional field)', () => {
      const result = validateModel(undefined);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for null (optional field)', () => {
      const result = validateModel(null);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for "inherit"', () => {
      const result = validateModel('inherit');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for "sonnet"', () => {
      const result = validateModel('sonnet');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for "opus"', () => {
      const result = validateModel('opus');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });

    it('returns valid for "haiku"', () => {
      const result = validateModel('haiku');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toBeUndefined();
      }
    });
  });

  describe('warnings for unknown models', () => {
    it('returns valid with warning for unknown model string', () => {
      const result = validateModel('gpt-4');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toEqual([
          "Unknown model 'gpt-4' in model field. Known models: inherit, sonnet, opus, haiku",
        ]);
      }
    });

    it('returns valid with warning for custom model name', () => {
      const result = validateModel('claude-3-opus-20240229');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toEqual([
          "Unknown model 'claude-3-opus-20240229' in model field. Known models: inherit, sonnet, opus, haiku",
        ]);
      }
    });
  });

  describe('invalid cases', () => {
    it('returns invalid for empty string', () => {
      const result = validateModel('');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("Field 'model' must be a non-empty string if specified.");
      }
    });

    it('returns invalid for whitespace-only string', () => {
      const result = validateModel('   ');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("Field 'model' must be a non-empty string if specified.");
      }
    });

    it('returns invalid for number type', () => {
      const result = validateModel(123);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          'Field \'model\' must be a non-empty string if specified. Got type "number".'
        );
      }
    });

    it('returns invalid for boolean type', () => {
      const result = validateModel(true);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          'Field \'model\' must be a non-empty string if specified. Got type "boolean".'
        );
      }
    });

    it('returns invalid for array type', () => {
      const result = validateModel(['sonnet']);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          'Field \'model\' must be a non-empty string if specified. Got type "object".'
        );
      }
    });

    it('returns invalid for object type', () => {
      const result = validateModel({ name: 'sonnet' });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe(
          'Field \'model\' must be a non-empty string if specified. Got type "object".'
        );
      }
    });
  });

  describe('edge cases', () => {
    it('returns valid with warning for "Sonnet" (case sensitive)', () => {
      const result = validateModel('Sonnet');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toEqual([
          "Unknown model 'Sonnet' in model field. Known models: inherit, sonnet, opus, haiku",
        ]);
      }
    });

    it('returns valid with warning for "HAIKU" (case sensitive)', () => {
      const result = validateModel('HAIKU');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.warnings).toEqual([
          "Unknown model 'HAIKU' in model field. Known models: inherit, sonnet, opus, haiku",
        ]);
      }
    });
  });

  describe('type narrowing', () => {
    it('narrows to valid branch with warnings', () => {
      const result: ModelValidationResult = validateModel('custom-model');
      if (result.valid) {
        // TypeScript allows accessing warnings on valid branch
        expect(result.warnings).toBeDefined();
      }
    });

    it('narrows to invalid branch with error', () => {
      const result: ModelValidationResult = validateModel(42);
      if (!result.valid) {
        // TypeScript allows accessing error on invalid branch
        expect(result.error).toBeDefined();
      }
    });
  });
});
