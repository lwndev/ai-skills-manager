import { validateFrontmatterKeys } from '../../../src/validators/frontmatter';

describe('validateFrontmatterKeys', () => {
  describe('valid frontmatter', () => {
    it('accepts minimal frontmatter with name only', () => {
      expect(validateFrontmatterKeys({ name: 'my-skill' })).toEqual({
        valid: true,
      });
    });

    it('accepts frontmatter with name and description', () => {
      expect(
        validateFrontmatterKeys({
          name: 'my-skill',
          description: 'A skill description',
        })
      ).toEqual({ valid: true });
    });

    it('accepts all allowed keys', () => {
      expect(
        validateFrontmatterKeys({
          name: 'my-skill',
          description: 'A skill description',
          license: 'MIT',
          'allowed-tools': ['Read', 'Write'],
          metadata: { author: 'test' },
        })
      ).toEqual({ valid: true });
    });

    it('accepts frontmatter with allowed-tools', () => {
      expect(
        validateFrontmatterKeys({
          name: 'my-skill',
          'allowed-tools': ['Read', 'Grep', 'Glob'],
        })
      ).toEqual({ valid: true });
    });

    it('accepts frontmatter with metadata', () => {
      expect(
        validateFrontmatterKeys({
          name: 'my-skill',
          metadata: {
            version: '1.0.0',
            author: 'test',
          },
        })
      ).toEqual({ valid: true });
    });
  });

  describe('invalid frontmatter - empty', () => {
    it('rejects empty frontmatter', () => {
      const result = validateFrontmatterKeys({});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });
  });

  describe('invalid frontmatter - unexpected keys', () => {
    it('rejects single unexpected key', () => {
      const result = validateFrontmatterKeys({
        name: 'my-skill',
        author: 'test',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unexpected frontmatter keys');
      expect(result.error).toContain('author');
    });

    it('rejects multiple unexpected keys', () => {
      const result = validateFrontmatterKeys({
        name: 'my-skill',
        author: 'test',
        version: '1.0.0',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('author');
      expect(result.error).toContain('version');
    });

    it('rejects typo in allowed key', () => {
      const result = validateFrontmatterKeys({
        name: 'my-skill',
        descriptions: 'typo in key', // should be 'description'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('descriptions');
    });

    it('rejects allowed-tool (singular) instead of allowed-tools', () => {
      const result = validateFrontmatterKeys({
        name: 'my-skill',
        'allowed-tool': ['Read'], // should be 'allowed-tools'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('allowed-tool');
    });

    it('lists all allowed keys in error message', () => {
      const result = validateFrontmatterKeys({
        name: 'my-skill',
        invalid: 'key',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('name');
      expect(result.error).toContain('description');
      expect(result.error).toContain('license');
      expect(result.error).toContain('allowed-tools');
      expect(result.error).toContain('metadata');
    });
  });
});
