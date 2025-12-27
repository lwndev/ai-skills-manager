import { generateSkillMd, SkillTemplateParams } from '../../../src/templates/skill-md';

describe('generateSkillMd', () => {
  describe('frontmatter generation', () => {
    it('generates valid YAML frontmatter with name only', () => {
      const result = generateSkillMd({ name: 'my-skill' });

      expect(result).toContain('---');
      expect(result).toContain('name: my-skill');
      expect(result).toContain('description: "TODO:');
    });

    it('includes description when provided', () => {
      const result = generateSkillMd({
        name: 'my-skill',
        description: 'A helpful skill',
      });

      expect(result).toContain('description: A helpful skill');
    });

    it('escapes description with special characters', () => {
      const result = generateSkillMd({
        name: 'my-skill',
        description: 'Use when: user needs help',
      });

      expect(result).toContain('description: "Use when: user needs help"');
    });

    it('includes allowed-tools when provided', () => {
      const result = generateSkillMd({
        name: 'my-skill',
        allowedTools: ['Bash', 'Read', 'Write'],
      });

      expect(result).toContain('allowed-tools:');
      expect(result).toContain('  - Bash');
      expect(result).toContain('  - Read');
      expect(result).toContain('  - Write');
    });

    it('shows commented allowed-tools when not provided', () => {
      const result = generateSkillMd({ name: 'my-skill' });

      expect(result).toContain('# allowed-tools:');
      expect(result).toContain('#   - Bash');
    });
  });

  describe('body generation', () => {
    it('includes skill name in heading', () => {
      const result = generateSkillMd({ name: 'my-awesome-skill' });

      expect(result).toContain('# my-awesome-skill');
    });

    it('includes TODO placeholders', () => {
      const result = generateSkillMd({ name: 'my-skill' });

      expect(result).toContain('TODO: Describe what this skill does');
      expect(result).toContain('TODO: Explain how to invoke');
      expect(result).toContain('TODO: Provide examples');
    });

    it('includes example section', () => {
      const result = generateSkillMd({ name: 'my-skill' });

      expect(result).toContain('## Examples');
      expect(result).toContain('### Example 1');
    });

    it('includes guidance comment', () => {
      const result = generateSkillMd({ name: 'my-skill' });

      expect(result).toContain('SKILL DEVELOPMENT GUIDANCE');
      expect(result).toContain('FRONTMATTER FIELDS');
      expect(result).toContain('BEST PRACTICES');
    });
  });

  describe('YAML escaping', () => {
    it('escapes strings starting with hyphen', () => {
      const result = generateSkillMd({
        name: 'my-skill',
        description: '-starts with hyphen',
      });

      expect(result).toContain('description: "-starts with hyphen"');
    });

    it('escapes strings with colons', () => {
      const result = generateSkillMd({
        name: 'my-skill',
        description: 'key: value format',
      });

      expect(result).toContain('description: "key: value format"');
    });

    it('escapes strings with quotes', () => {
      const result = generateSkillMd({
        name: 'my-skill',
        description: 'contains "quotes" inside',
      });

      expect(result).toContain('description: "contains \\"quotes\\" inside"');
    });

    it('escapes strings with backslashes', () => {
      const result = generateSkillMd({
        name: 'my-skill',
        description: 'path\\to\\file',
      });

      expect(result).toContain('description: "path\\\\to\\\\file"');
    });

    it('escapes YAML boolean-like values', () => {
      const result = generateSkillMd({
        name: 'my-skill',
        description: 'true',
      });

      expect(result).toContain('description: "true"');
    });

    it('does not escape simple strings', () => {
      const result = generateSkillMd({
        name: 'my-skill',
        description: 'Simple description without special chars',
      });

      expect(result).toContain('description: Simple description without special chars');
    });
  });

  describe('complete output structure', () => {
    it('produces valid structure with all parameters', () => {
      const params: SkillTemplateParams = {
        name: 'code-reviewer',
        description: 'Review code for best practices. Use when the user asks for code review.',
        allowedTools: ['Read', 'Grep', 'Glob'],
      };

      const result = generateSkillMd(params);

      // Check frontmatter structure
      const frontmatterMatch = result.match(/^---\n([\s\S]*?)\n---/);
      expect(frontmatterMatch).toBeTruthy();

      // Check it starts with frontmatter
      expect(result.startsWith('---\n')).toBe(true);

      // Check body follows frontmatter
      expect(result).toContain('---\n\n# code-reviewer');
    });
  });
});
