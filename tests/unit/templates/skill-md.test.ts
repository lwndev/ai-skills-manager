import {
  generateSkillMd,
  SkillTemplateParams,
  TemplateType,
  TemplateOptions,
} from '../../../src/templates/skill-md';

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

  describe('template options', () => {
    // Helper to extract frontmatter from generated output
    const getFrontmatter = (result: string): string => {
      const match = result.match(/^---\n([\s\S]*?)\n---/);
      return match ? match[1] : '';
    };

    it('maintains backward compatibility when no options provided', () => {
      const result = generateSkillMd({ name: 'my-skill' });
      const frontmatter = getFrontmatter(result);

      // Should produce same output as before
      expect(frontmatter).toContain('name: my-skill');
      expect(frontmatter).toContain('description: "TODO:');
      // These should not appear in frontmatter when no options provided
      expect(frontmatter).not.toMatch(/^context:/m);
      expect(frontmatter).not.toMatch(/^agent:/m);
      expect(frontmatter).not.toMatch(/^user-invocable:/m);
    });

    it('accepts templateType option', () => {
      const options: TemplateOptions = { templateType: 'basic' };
      const result = generateSkillMd({ name: 'my-skill' }, options);

      expect(result).toContain('name: my-skill');
      expect(result).toContain('SKILL DEVELOPMENT GUIDANCE');
    });

    it('adds context: fork when context option is fork', () => {
      const options: TemplateOptions = { context: 'fork' };
      const result = generateSkillMd({ name: 'forked-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('context: fork');
    });

    it('adds agent field when agent option is provided', () => {
      const options: TemplateOptions = { agent: 'Explore' };
      const result = generateSkillMd({ name: 'explorer-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('agent: Explore');
    });

    it('escapes agent field with special characters', () => {
      const options: TemplateOptions = { agent: 'My Custom: Agent' };
      const result = generateSkillMd({ name: 'custom-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('agent: "My Custom: Agent"');
    });

    it('adds user-invocable: false when userInvocable is false', () => {
      const options: TemplateOptions = { userInvocable: false };
      const result = generateSkillMd({ name: 'internal-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('user-invocable: false');
    });

    it('does not add user-invocable when userInvocable is true', () => {
      const options: TemplateOptions = { userInvocable: true };
      const result = generateSkillMd({ name: 'public-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).not.toMatch(/^user-invocable:/m);
    });

    it('does not add user-invocable when userInvocable is undefined', () => {
      const options: TemplateOptions = { templateType: 'basic' };
      const result = generateSkillMd({ name: 'default-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).not.toMatch(/^user-invocable:/m);
    });

    it('combines multiple options correctly', () => {
      const options: TemplateOptions = {
        templateType: 'basic',
        context: 'fork',
        agent: 'Plan',
        userInvocable: false,
      };
      const result = generateSkillMd({ name: 'combined-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('name: combined-skill');
      expect(frontmatter).toContain('context: fork');
      expect(frontmatter).toContain('agent: Plan');
      expect(frontmatter).toContain('user-invocable: false');
    });
  });

  describe('enhanced guidance content', () => {
    it('includes Claude Code extension fields documentation', () => {
      const result = generateSkillMd({ name: 'my-skill' });

      expect(result).toContain('FRONTMATTER FIELDS (Claude Code Extensions)');
      expect(result).toContain('context:');
      expect(result).toContain('agent:');
      expect(result).toContain('user-invocable:');
      expect(result).toContain('hooks:');
    });

    it('includes wildcard tool patterns documentation', () => {
      const result = generateSkillMd({ name: 'my-skill' });

      expect(result).toContain('WILDCARD PATTERNS');
      expect(result).toContain('Bash(git *)');
      expect(result).toContain('Bash(npm install)');
    });

    it('includes argument shorthand syntax documentation', () => {
      const result = generateSkillMd({ name: 'my-skill' });

      expect(result).toContain('ARGUMENT SHORTHAND SYNTAX');
      expect(result).toContain('$0');
      expect(result).toContain('$ARGUMENTS[0]');
      expect(result).toContain('${CLAUDE_SESSION_ID}');
    });

    it('distinguishes Open Agent Skills Spec from Claude Code Extensions', () => {
      const result = generateSkillMd({ name: 'my-skill' });

      expect(result).toContain('FRONTMATTER FIELDS (Open Agent Skills Spec)');
      expect(result).toContain('FRONTMATTER FIELDS (Claude Code Extensions)');
    });
  });

  describe('TemplateType values', () => {
    it('accepts basic template type', () => {
      const templateType: TemplateType = 'basic';
      expect(templateType).toBe('basic');
    });

    it('accepts forked template type', () => {
      const templateType: TemplateType = 'forked';
      expect(templateType).toBe('forked');
    });

    it('accepts with-hooks template type', () => {
      const templateType: TemplateType = 'with-hooks';
      expect(templateType).toBe('with-hooks');
    });

    it('accepts internal template type', () => {
      const templateType: TemplateType = 'internal';
      expect(templateType).toBe('internal');
    });
  });
});
