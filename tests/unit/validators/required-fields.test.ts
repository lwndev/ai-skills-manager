import { validateRequiredFields } from '../../../src/validators/required-fields';
import { ParsedFrontmatter } from '../../../src/types/validation';

describe('validateRequiredFields', () => {
  describe('valid frontmatter', () => {
    it('accepts frontmatter with name and description', () => {
      const frontmatter: ParsedFrontmatter = {
        name: 'test-skill',
        description: 'A test skill',
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(true);
    });

    it('accepts frontmatter with all fields', () => {
      const frontmatter: ParsedFrontmatter = {
        name: 'test-skill',
        description: 'A test skill',
        license: 'MIT',
        'allowed-tools': ['Read', 'Write'],
        metadata: { author: 'Test' },
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(true);
    });

    it('accepts frontmatter with extra unknown fields', () => {
      const frontmatter: ParsedFrontmatter = {
        name: 'test-skill',
        description: 'A test skill',
        unknownField: 'value',
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(true);
      // Note: required-fields only checks for name/description presence
      // Unknown field validation is handled by frontmatter keys validator
    });
  });

  describe('missing name', () => {
    it('rejects frontmatter without name', () => {
      const frontmatter: ParsedFrontmatter = {
        description: 'A test skill',
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required field');
      expect(result.error).toContain('name');
      expect(result.missingFields).toEqual(['name']);
    });

    it('rejects frontmatter with empty name', () => {
      const frontmatter: ParsedFrontmatter = {
        name: '',
        description: 'A test skill',
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('name');
      expect(result.missingFields).toContain('name');
    });

    it('rejects frontmatter with whitespace-only name', () => {
      const frontmatter: ParsedFrontmatter = {
        name: '   ',
        description: 'A test skill',
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('name');
    });

    it('rejects frontmatter with null name', () => {
      const frontmatter: ParsedFrontmatter = {
        name: null as unknown as string,
        description: 'A test skill',
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('name');
    });
  });

  describe('missing description', () => {
    it('rejects frontmatter without description', () => {
      const frontmatter: ParsedFrontmatter = {
        name: 'test-skill',
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required field');
      expect(result.error).toContain('description');
      expect(result.missingFields).toEqual(['description']);
    });

    it('rejects frontmatter with empty description', () => {
      const frontmatter: ParsedFrontmatter = {
        name: 'test-skill',
        description: '',
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('description');
      expect(result.missingFields).toContain('description');
    });

    it('rejects frontmatter with whitespace-only description', () => {
      const frontmatter: ParsedFrontmatter = {
        name: 'test-skill',
        description: '   \n\t  ',
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('description');
    });
  });

  describe('missing both fields', () => {
    it('reports both missing fields', () => {
      const frontmatter: ParsedFrontmatter = {};
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required fields');
      expect(result.error).toContain('name');
      expect(result.error).toContain('description');
      expect(result.missingFields).toEqual(['name', 'description']);
    });

    it('reports both when both are empty', () => {
      const frontmatter: ParsedFrontmatter = {
        name: '',
        description: '',
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('name');
      expect(result.missingFields).toContain('description');
    });
  });

  describe('edge cases', () => {
    it('accepts numeric values for name (type validation elsewhere)', () => {
      // YAML might parse unquoted numbers as numbers
      const frontmatter: ParsedFrontmatter = {
        name: 123 as unknown as string,
        description: 'A test skill',
      };
      const result = validateRequiredFields(frontmatter);
      // Non-string values are considered "present" for this validator
      // Type validation is handled by name format validator
      expect(result.valid).toBe(true);
    });

    it('accepts boolean values (type validation elsewhere)', () => {
      const frontmatter: ParsedFrontmatter = {
        name: true as unknown as string,
        description: false as unknown as string,
      };
      const result = validateRequiredFields(frontmatter);
      // Non-string values are considered "present" for this validator
      expect(result.valid).toBe(true);
    });

    it('handles undefined name value', () => {
      const frontmatter: ParsedFrontmatter = {
        name: undefined,
        description: 'Test',
      };
      const result = validateRequiredFields(frontmatter);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('name');
    });
  });
});
