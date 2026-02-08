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

  describe('forked template', () => {
    // Helper to extract frontmatter from generated output
    const getFrontmatter = (result: string): string => {
      const match = result.match(/^---\n([\s\S]*?)\n---/);
      return match ? match[1] : '';
    };

    it('automatically adds context: fork to frontmatter', () => {
      const options: TemplateOptions = { templateType: 'forked' };
      const result = generateSkillMd({ name: 'analyzer-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('context: fork');
    });

    it('sets default allowed-tools to read-only tools', () => {
      const options: TemplateOptions = { templateType: 'forked' };
      const result = generateSkillMd({ name: 'analyzer-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('allowed-tools:');
      expect(frontmatter).toContain('  - Read');
      expect(frontmatter).toContain('  - Glob');
      expect(frontmatter).toContain('  - Grep');
      // Should NOT contain write tools by default
      expect(frontmatter).not.toContain('  - Write');
      expect(frontmatter).not.toContain('  - Edit');
      expect(frontmatter).not.toContain('  - Bash');
    });

    it('allows explicit allowedTools to override defaults', () => {
      const options: TemplateOptions = { templateType: 'forked' };
      const result = generateSkillMd(
        { name: 'custom-forked', allowedTools: ['Read', 'Write'] },
        options
      );
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('  - Read');
      expect(frontmatter).toContain('  - Write');
      // Should NOT contain default Glob/Grep since overridden
      expect(frontmatter).not.toContain('  - Glob');
      expect(frontmatter).not.toContain('  - Grep');
    });

    it('includes forked context guidance in body', () => {
      const options: TemplateOptions = { templateType: 'forked' };
      const result = generateSkillMd({ name: 'forked-skill' }, options);

      expect(result).toContain('FORKED CONTEXT SKILL');
      expect(result).toContain('WHEN TO USE FORKED CONTEXTS');
      expect(result).toContain('LIMITATIONS');
      expect(result).toContain('BEST PRACTICES FOR DATA RETURN');
    });

    it('explains isolated analysis use case', () => {
      const options: TemplateOptions = { templateType: 'forked' };
      const result = generateSkillMd({ name: 'forked-skill' }, options);

      expect(result).toContain('Isolated analysis');
      expect(result).toContain('Exploratory operations');
    });

    it('documents state persistence limitations', () => {
      const options: TemplateOptions = { templateType: 'forked' };
      const result = generateSkillMd({ name: 'forked-skill' }, options);

      expect(result).toContain('No state persistence');
      expect(result).toContain("don't persist to parent");
    });

    it('includes data return best practices', () => {
      const options: TemplateOptions = { templateType: 'forked' };
      const result = generateSkillMd({ name: 'forked-skill' }, options);

      expect(result).toContain('Structure your output clearly');
      expect(result).toContain('actionable summaries');
    });

    it('still includes standard guidance sections', () => {
      const options: TemplateOptions = { templateType: 'forked' };
      const result = generateSkillMd({ name: 'forked-skill' }, options);

      // Should still have standard guidance
      expect(result).toContain('SKILL DEVELOPMENT GUIDANCE');
      expect(result).toContain('FRONTMATTER FIELDS (Open Agent Skills Spec)');
      expect(result).toContain('FRONTMATTER FIELDS (Claude Code Extensions)');
      expect(result).toContain('BEST PRACTICES');
    });
  });

  describe('internal template', () => {
    // Helper to extract frontmatter from generated output
    const getFrontmatter = (result: string): string => {
      const match = result.match(/^---\n([\s\S]*?)\n---/);
      return match ? match[1] : '';
    };

    it('automatically adds user-invocable: false to frontmatter', () => {
      const options: TemplateOptions = { templateType: 'internal' };
      const result = generateSkillMd({ name: 'helper-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('user-invocable: false');
    });

    it('sets default allowed-tools to minimal read tools', () => {
      const options: TemplateOptions = { templateType: 'internal' };
      const result = generateSkillMd({ name: 'helper-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('allowed-tools:');
      expect(frontmatter).toContain('  - Read');
      expect(frontmatter).toContain('  - Grep');
      // Should NOT contain other tools by default
      expect(frontmatter).not.toContain('  - Glob');
      expect(frontmatter).not.toContain('  - Write');
      expect(frontmatter).not.toContain('  - Edit');
      expect(frontmatter).not.toContain('  - Bash');
    });

    it('allows explicit allowedTools to override defaults', () => {
      const options: TemplateOptions = { templateType: 'internal' };
      const result = generateSkillMd(
        { name: 'custom-internal', allowedTools: ['Read', 'Glob', 'Bash'] },
        options
      );
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('  - Read');
      expect(frontmatter).toContain('  - Glob');
      expect(frontmatter).toContain('  - Bash');
      // Should NOT contain default Grep since overridden
      expect(frontmatter).not.toContain('  - Grep');
    });

    it('includes internal helper guidance in body', () => {
      const options: TemplateOptions = { templateType: 'internal' };
      const result = generateSkillMd({ name: 'internal-skill' }, options);

      expect(result).toContain('INTERNAL HELPER SKILL');
      expect(result).toContain('WHAT THIS MEANS');
      expect(result).toContain('HOW OTHER SKILLS REFERENCE THIS SKILL');
      expect(result).toContain('COMMON PATTERNS FOR HELPER SKILLS');
    });

    it('explains user-invocable: false behavior', () => {
      const options: TemplateOptions = { templateType: 'internal' };
      const result = generateSkillMd({ name: 'internal-skill' }, options);

      expect(result).toContain('Users CANNOT directly invoke this skill');
      expect(result).toContain('Other skills CAN reference');
      expect(result).toContain('hidden from user-facing skill listings');
    });

    it('documents how other skills can reference helpers', () => {
      const options: TemplateOptions = { templateType: 'internal' };
      const result = generateSkillMd({ name: 'internal-skill' }, options);

      expect(result).toContain('Skills can reference internal helpers');
    });

    it('provides common helper skill patterns', () => {
      const options: TemplateOptions = { templateType: 'internal' };
      const result = generateSkillMd({ name: 'internal-skill' }, options);

      expect(result).toContain('Shared validation logic');
      expect(result).toContain('Common output formatting');
      expect(result).toContain('Standard error handling');
    });

    it('includes example use cases', () => {
      const options: TemplateOptions = { templateType: 'internal' };
      const result = generateSkillMd({ name: 'internal-skill' }, options);

      expect(result).toContain('EXAMPLE USE CASES');
      expect(result).toContain('formatting-helper');
      expect(result).toContain('validation-helper');
    });

    it('still includes standard guidance sections', () => {
      const options: TemplateOptions = { templateType: 'internal' };
      const result = generateSkillMd({ name: 'internal-skill' }, options);

      // Should still have standard guidance
      expect(result).toContain('SKILL DEVELOPMENT GUIDANCE');
      expect(result).toContain('FRONTMATTER FIELDS (Open Agent Skills Spec)');
      expect(result).toContain('FRONTMATTER FIELDS (Claude Code Extensions)');
      expect(result).toContain('BEST PRACTICES');
    });
  });

  describe('with-hooks template', () => {
    // Helper to extract frontmatter from generated output
    const getFrontmatter = (result: string): string => {
      const match = result.match(/^---\n([\s\S]*?)\n---/);
      return match ? match[1] : '';
    };

    it('includes hooks section with PreToolUse and PostToolUse in frontmatter', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('hooks:');
      expect(frontmatter).toContain('PreToolUse:');
      expect(frontmatter).toContain('PostToolUse:');
    });

    it('includes PreToolUse hook with matcher and nested hooks array', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('PreToolUse:');
      expect(frontmatter).toContain('matcher: "*"');
      expect(frontmatter).toContain('- type: command');
      expect(frontmatter).toContain('command: echo "Starting tool execution..."');
    });

    it('includes PostToolUse hook with matcher and nested hooks array', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('PostToolUse:');
      expect(frontmatter).toContain('command: echo "Tool execution complete"');
    });

    it('includes commented Stop hook example without matcher', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('# Stop:');
      expect(frontmatter).toContain('#   - hooks:');
      expect(frontmatter).toContain('#       - type: command');
      expect(frontmatter).toContain('#         command: echo "Skill stopped"');
    });

    it('sets default allowed-tools to Bash, Read, Write', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('allowed-tools:');
      expect(frontmatter).toContain('  - Bash');
      expect(frontmatter).toContain('  - Read');
      expect(frontmatter).toContain('  - Write');
    });

    it('allows explicit allowedTools to override defaults', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd(
        { name: 'custom-hooks', allowedTools: ['Bash', 'Edit'] },
        options
      );
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('  - Bash');
      expect(frontmatter).toContain('  - Edit');
      // Should NOT contain defaults since overridden
      expect(frontmatter).not.toContain('  - Read');
      expect(frontmatter).not.toContain('  - Write');
    });

    it('includes hooks guidance in body', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);

      expect(result).toContain('SKILL WITH HOOKS');
      expect(result).toContain('SUPPORTED HOOK TYPES FOR SKILLS');
      expect(result).toContain('EXAMPLE USE CASES');
      expect(result).toContain('HOOK CONFIGURATION FORMAT');
    });

    it('documents when each hook type fires', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);

      expect(result).toContain('PreToolUse: Fires BEFORE each tool call');
      expect(result).toContain('PostToolUse: Fires AFTER each tool call');
      expect(result).toContain('Stop: Fires when Claude finishes responding');
    });

    it('documents that skills only support three hook types', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);

      expect(result).toContain('SUPPORTED HOOK TYPES FOR SKILLS');
      expect(result).toContain('Skills only support these three hook types');
    });

    it('provides example use cases for hooks', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);

      expect(result).toContain('Validation before Bash commands:');
      expect(result).toContain('Logging after file writes:');
      expect(result).toContain('Cleanup on stop:');
    });

    it('documents hook configuration format', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);

      expect(result).toContain('HOOK CONFIGURATION FORMAT');
      expect(result).toContain('matcher: "*"');
      expect(result).toContain('- type: command');
      expect(result).toContain('command: <shell command to execute>');
    });

    it('documents hook matchers for targeting specific tools', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);

      expect(result).toContain('MATCHERS:');
      expect(result).toContain('"Bash" matches only the Bash tool');
      expect(result).toContain('"Edit|Write" matches Edit OR Write tools');
    });

    it('documents the once option for skills', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);

      expect(result).toContain('SKILL-SPECIFIC OPTIONS');
      expect(result).toContain('once: true');
    });

    it('still includes standard guidance sections', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);

      // Should still have standard guidance
      expect(result).toContain('SKILL DEVELOPMENT GUIDANCE');
      expect(result).toContain('FRONTMATTER FIELDS (Open Agent Skills Spec)');
      expect(result).toContain('FRONTMATTER FIELDS (Claude Code Extensions)');
      expect(result).toContain('BEST PRACTICES');
    });

    it('uses proper YAML indentation for nested hook structures', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);
      const frontmatter = getFrontmatter(result);

      // Check proper indentation for nested structure:
      // hooks: (0 spaces)
      //   PreToolUse: (2 spaces)
      //     - matcher: "*" (4 spaces)
      //       hooks: (6 spaces)
      //         - type: command (8 spaces)
      //           command: ... (10 spaces)
      expect(frontmatter).toMatch(/^hooks:/m);
      expect(frontmatter).toMatch(/^[ ]{2}PreToolUse:/m);
      expect(frontmatter).toMatch(/^[ ]{4}- matcher:/m);
      expect(frontmatter).toMatch(/^[ ]{6}hooks:/m);
      expect(frontmatter).toMatch(/^[ ]{8}- type: command/m);
      expect(frontmatter).toMatch(/^[ ]{10}command:/m);
    });
  });

  describe('includeHooks option', () => {
    // Helper to extract frontmatter from generated output
    const getFrontmatter = (result: string): string => {
      const match = result.match(/^---\n([\s\S]*?)\n---/);
      return match ? match[1] : '';
    };

    it('adds hooks section to basic template when includeHooks is true', () => {
      const options: TemplateOptions = { templateType: 'basic', includeHooks: true };
      const result = generateSkillMd({ name: 'basic-with-hooks' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('hooks:');
      expect(frontmatter).toContain('PreToolUse:');
      expect(frontmatter).toContain('PostToolUse:');
      // Should NOT have hooks guidance (it's basic template)
      expect(result).not.toContain('SKILL WITH HOOKS');
    });

    it('adds hooks section to forked template when includeHooks is true', () => {
      const options: TemplateOptions = { templateType: 'forked', includeHooks: true };
      const result = generateSkillMd({ name: 'forked-with-hooks' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('context: fork');
      expect(frontmatter).toContain('hooks:');
      expect(frontmatter).toContain('PreToolUse:');
      // Should have forked guidance, not hooks guidance
      expect(result).toContain('FORKED CONTEXT SKILL');
      expect(result).not.toContain('SKILL WITH HOOKS');
    });

    it('adds hooks section to internal template when includeHooks is true', () => {
      const options: TemplateOptions = { templateType: 'internal', includeHooks: true };
      const result = generateSkillMd({ name: 'internal-with-hooks' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('user-invocable: false');
      expect(frontmatter).toContain('hooks:');
      expect(frontmatter).toContain('PreToolUse:');
      // Should have internal guidance, not hooks guidance
      expect(result).toContain('INTERNAL HELPER SKILL');
      expect(result).not.toContain('SKILL WITH HOOKS');
    });

    it('does not add hooks section when includeHooks is false', () => {
      const options: TemplateOptions = { templateType: 'basic', includeHooks: false };
      const result = generateSkillMd({ name: 'basic-no-hooks' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).not.toContain('hooks:');
    });

    it('does not add hooks section when includeHooks is undefined', () => {
      const options: TemplateOptions = { templateType: 'basic' };
      const result = generateSkillMd({ name: 'basic-default' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).not.toContain('hooks:');
    });

    it('does not duplicate hooks when with-hooks template also has includeHooks', () => {
      const options: TemplateOptions = { templateType: 'with-hooks', includeHooks: true };
      const result = generateSkillMd({ name: 'hooks-redundant' }, options);
      const frontmatter = getFrontmatter(result);

      // Count occurrences of 'hooks:' - should only appear once
      const hooksCount = (frontmatter.match(/^hooks:/gm) || []).length;
      expect(hooksCount).toBe(1);
    });
  });

  describe('minimal template generation', () => {
    const getFrontmatter = (result: string): string => {
      const match = result.match(/^---\n([\s\S]*?)\n---/);
      return match ? match[1] : '';
    };

    describe('basic minimal template', () => {
      it('generates frontmatter + Overview + Instructions + Examples', () => {
        const result = generateSkillMd({ name: 'test-skill' }, { minimal: true });

        expect(result).toContain('---');
        expect(result).toContain('name: test-skill');
        expect(result).toContain('## Overview');
        expect(result).toContain('## Instructions');
        expect(result).toContain('## Examples');
      });

      it('does not include HTML comment guidance block', () => {
        const result = generateSkillMd({ name: 'test-skill' }, { minimal: true });

        expect(result).not.toContain('SKILL DEVELOPMENT GUIDANCE');
        expect(result).not.toContain('FRONTMATTER FIELDS');
        expect(result).not.toContain('BEST PRACTICES');
        expect(result).not.toContain('<!--');
      });

      it('does not include Usage or Implementation Notes sections', () => {
        const result = generateSkillMd({ name: 'test-skill' }, { minimal: true });

        expect(result).not.toContain('## Usage');
        expect(result).not.toContain('## Implementation Notes');
      });

      it('does not include Example 1 subheading', () => {
        const result = generateSkillMd({ name: 'test-skill' }, { minimal: true });

        expect(result).not.toContain('### Example 1');
      });

      it('uses minimal description placeholder', () => {
        const result = generateSkillMd({ name: 'test-skill' }, { minimal: true });

        expect(result).toContain(
          'description: "TODO: Describe what this skill does and when to use it."'
        );
      });

      it('omits commented allowed-tools placeholder', () => {
        const result = generateSkillMd({ name: 'test-skill' }, { minimal: true });
        const frontmatter = getFrontmatter(result);

        expect(frontmatter).not.toContain('# allowed-tools:');
      });

      it('includes basic overview TODO', () => {
        const result = generateSkillMd({ name: 'test-skill' }, { minimal: true });

        expect(result).toContain('TODO: Brief description of what this skill does.');
      });
    });

    describe('forked minimal template', () => {
      it('includes context: fork in frontmatter', () => {
        const result = generateSkillMd(
          { name: 'forked-skill' },
          { templateType: 'forked', minimal: true }
        );
        const frontmatter = getFrontmatter(result);

        expect(frontmatter).toContain('context: fork');
      });

      it('includes default read-only tools', () => {
        const result = generateSkillMd(
          { name: 'forked-skill' },
          { templateType: 'forked', minimal: true }
        );
        const frontmatter = getFrontmatter(result);

        expect(frontmatter).toContain('- Read');
        expect(frontmatter).toContain('- Glob');
        expect(frontmatter).toContain('- Grep');
      });

      it('overview mentions forked context', () => {
        const result = generateSkillMd(
          { name: 'forked-skill' },
          { templateType: 'forked', minimal: true }
        );

        expect(result).toContain('This skill runs in a forked context.');
      });

      it('does not include forked context guidance', () => {
        const result = generateSkillMd(
          { name: 'forked-skill' },
          { templateType: 'forked', minimal: true }
        );

        expect(result).not.toContain('FORKED CONTEXT SKILL');
        expect(result).not.toContain('WHEN TO USE FORKED CONTEXTS');
        expect(result).not.toContain('LIMITATIONS');
      });
    });

    describe('with-hooks minimal template', () => {
      it('includes hooks YAML with minimal commands', () => {
        const result = generateSkillMd(
          { name: 'hooks-skill' },
          { templateType: 'with-hooks', minimal: true }
        );
        const frontmatter = getFrontmatter(result);

        expect(frontmatter).toContain('hooks:');
        expect(frontmatter).toContain('PreToolUse:');
        expect(frontmatter).toContain('PostToolUse:');
        expect(frontmatter).toContain("echo 'TODO: pre-tool hook'");
        expect(frontmatter).toContain("echo 'TODO: post-tool hook'");
      });

      it('does not include commented Stop hook example', () => {
        const result = generateSkillMd(
          { name: 'hooks-skill' },
          { templateType: 'with-hooks', minimal: true }
        );
        const frontmatter = getFrontmatter(result);

        expect(frontmatter).not.toContain('# Stop:');
      });

      it('overview mentions hooks', () => {
        const result = generateSkillMd(
          { name: 'hooks-skill' },
          { templateType: 'with-hooks', minimal: true }
        );

        expect(result).toContain('This skill uses hooks for tool lifecycle events.');
      });

      it('does not include hooks guidance', () => {
        const result = generateSkillMd(
          { name: 'hooks-skill' },
          { templateType: 'with-hooks', minimal: true }
        );

        expect(result).not.toContain('SKILL WITH HOOKS');
        expect(result).not.toContain('SUPPORTED HOOK TYPES FOR SKILLS');
      });
    });

    describe('internal minimal template', () => {
      it('includes user-invocable: false in frontmatter', () => {
        const result = generateSkillMd(
          { name: 'internal-skill' },
          { templateType: 'internal', minimal: true }
        );
        const frontmatter = getFrontmatter(result);

        expect(frontmatter).toContain('user-invocable: false');
      });

      it('overview mentions internal', () => {
        const result = generateSkillMd(
          { name: 'internal-skill' },
          { templateType: 'internal', minimal: true }
        );

        expect(result).toContain('This is an internal helper skill.');
      });

      it('uses internal-specific description placeholder', () => {
        const result = generateSkillMd(
          { name: 'internal-skill' },
          { templateType: 'internal', minimal: true }
        );

        expect(result).toContain(
          'description: "TODO: Internal helper for other skills. Not for direct user invocation."'
        );
      });

      it('does not include internal guidance', () => {
        const result = generateSkillMd(
          { name: 'internal-skill' },
          { templateType: 'internal', minimal: true }
        );

        expect(result).not.toContain('INTERNAL HELPER SKILL');
        expect(result).not.toContain('WHAT THIS MEANS');
      });
    });

    describe('minimal output size comparison', () => {
      it('minimal basic is shorter than verbose basic', () => {
        const minimal = generateSkillMd({ name: 'test' }, { minimal: true });
        const verbose = generateSkillMd({ name: 'test' });

        expect(minimal.length).toBeLessThan(verbose.length);
      });

      it('minimal forked is shorter than verbose forked', () => {
        const minimal = generateSkillMd(
          { name: 'test' },
          { templateType: 'forked', minimal: true }
        );
        const verbose = generateSkillMd({ name: 'test' }, { templateType: 'forked' });

        expect(minimal.length).toBeLessThan(verbose.length);
      });

      it('minimal with-hooks is shorter than verbose with-hooks', () => {
        const minimal = generateSkillMd(
          { name: 'test' },
          { templateType: 'with-hooks', minimal: true }
        );
        const verbose = generateSkillMd({ name: 'test' }, { templateType: 'with-hooks' });

        expect(minimal.length).toBeLessThan(verbose.length);
      });

      it('minimal internal is shorter than verbose internal', () => {
        const minimal = generateSkillMd(
          { name: 'test' },
          { templateType: 'internal', minimal: true }
        );
        const verbose = generateSkillMd({ name: 'test' }, { templateType: 'internal' });

        expect(minimal.length).toBeLessThan(verbose.length);
      });
    });

    describe('minimal with custom options', () => {
      it('custom allowedTools overrides template defaults', () => {
        const result = generateSkillMd(
          { name: 'test', allowedTools: ['Bash', 'Write'] },
          { templateType: 'forked', minimal: true }
        );
        const frontmatter = getFrontmatter(result);

        expect(frontmatter).toContain('- Bash');
        expect(frontmatter).toContain('- Write');
        expect(frontmatter).not.toContain('- Glob');
        expect(frontmatter).not.toContain('- Grep');
      });

      it('custom description replaces TODO placeholder', () => {
        const result = generateSkillMd(
          { name: 'test', description: 'My custom description' },
          { minimal: true }
        );

        expect(result).toContain('description: My custom description');
        expect(result).not.toContain('TODO: Describe what this skill does');
      });

      it('agent option adds agent field', () => {
        const result = generateSkillMd({ name: 'test' }, { minimal: true, agent: 'Explore' });
        const frontmatter = getFrontmatter(result);

        expect(frontmatter).toContain('agent: Explore');
      });

      it('includeHooks option adds hooks to minimal basic template', () => {
        const result = generateSkillMd({ name: 'test' }, { minimal: true, includeHooks: true });
        const frontmatter = getFrontmatter(result);

        expect(frontmatter).toContain('hooks:');
        expect(frontmatter).toContain("echo 'TODO: pre-tool hook'");
      });
    });

    describe('default output unchanged', () => {
      it('no minimal flag produces verbose output with guidance', () => {
        const result = generateSkillMd({ name: 'test-skill' });

        expect(result).toContain('SKILL DEVELOPMENT GUIDANCE');
        expect(result).toContain('## Usage');
        expect(result).toContain('## Implementation Notes');
        expect(result).toContain('### Example 1');
        expect(result).toContain('# allowed-tools:');
      });

      it('minimal: false produces verbose output', () => {
        const result = generateSkillMd({ name: 'test-skill' }, { minimal: false });

        expect(result).toContain('SKILL DEVELOPMENT GUIDANCE');
        expect(result).toContain('## Usage');
      });

      it('minimal: undefined produces verbose output', () => {
        const result = generateSkillMd({ name: 'test-skill' }, { templateType: 'basic' });

        expect(result).toContain('SKILL DEVELOPMENT GUIDANCE');
        expect(result).toContain('## Usage');
      });
    });
  });

  describe('agent template', () => {
    const getFrontmatter = (result: string): string => {
      const match = result.match(/^---\n([\s\S]*?)\n---/);
      return match ? match[1] : '';
    };

    it('includes model: sonnet by default in frontmatter', () => {
      const options: TemplateOptions = { templateType: 'agent' };
      const result = generateSkillMd({ name: 'my-agent' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('model: sonnet');
    });

    it('includes memory: project by default in frontmatter', () => {
      const options: TemplateOptions = { templateType: 'agent' };
      const result = generateSkillMd({ name: 'my-agent' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('memory: project');
    });

    it('includes skills: [] in frontmatter', () => {
      const options: TemplateOptions = { templateType: 'agent' };
      const result = generateSkillMd({ name: 'my-agent' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('skills: []');
    });

    it('includes disallowedTools: [] in frontmatter', () => {
      const options: TemplateOptions = { templateType: 'agent' };
      const result = generateSkillMd({ name: 'my-agent' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('disallowedTools: []');
    });

    it('sets default allowed-tools to full agent set', () => {
      const options: TemplateOptions = { templateType: 'agent' };
      const result = generateSkillMd({ name: 'my-agent' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('allowed-tools:');
      expect(frontmatter).toContain('  - Read');
      expect(frontmatter).toContain('  - Glob');
      expect(frontmatter).toContain('  - Grep');
      expect(frontmatter).toContain('  - Edit');
      expect(frontmatter).toContain('  - Write');
      expect(frontmatter).toContain('  - Bash');
    });

    it('allows explicit allowedTools to override defaults', () => {
      const options: TemplateOptions = { templateType: 'agent' };
      const result = generateSkillMd(
        { name: 'custom-agent', allowedTools: ['Read', 'Bash'] },
        options
      );
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('  - Read');
      expect(frontmatter).toContain('  - Bash');
      expect(frontmatter).not.toContain('  - Write');
      expect(frontmatter).not.toContain('  - Edit');
    });

    it('uses agent-specific description placeholder', () => {
      const options: TemplateOptions = { templateType: 'agent' };
      const result = generateSkillMd({ name: 'my-agent' }, options);

      expect(result).toContain(
        'description: "TODO: Describe what this agent does and when it should be used."'
      );
    });

    it('includes agent-specific guidance in verbose body', () => {
      const options: TemplateOptions = { templateType: 'agent' };
      const result = generateSkillMd({ name: 'my-agent' }, options);

      expect(result).toContain('AGENT SKILL');
      expect(result).toContain('HOW AGENTS DIFFER FROM REGULAR SKILLS');
      expect(result).toContain('MODEL SELECTION');
      expect(result).toContain('MEMORY SCOPES');
      expect(result).toContain('DEPENDENT SKILLS');
      expect(result).toContain('TOOL ACCESS CONTROL');
      expect(result).toContain('PERMISSION MODE');
    });

    it('still includes standard guidance sections', () => {
      const options: TemplateOptions = { templateType: 'agent' };
      const result = generateSkillMd({ name: 'my-agent' }, options);

      expect(result).toContain('SKILL DEVELOPMENT GUIDANCE');
      expect(result).toContain('FRONTMATTER FIELDS (Open Agent Skills Spec)');
      expect(result).toContain('FRONTMATTER FIELDS (Claude Code Extensions)');
      expect(result).toContain('BEST PRACTICES');
    });

    it('produces correct frontmatter field ordering', () => {
      const options: TemplateOptions = { templateType: 'agent' };
      const result = generateSkillMd({ name: 'my-agent' }, options);
      const frontmatter = getFrontmatter(result);

      // Verify field ordering: name → description → model → memory → skills → allowed-tools → disallowedTools
      const nameIdx = frontmatter.indexOf('name:');
      const descIdx = frontmatter.indexOf('description:');
      const modelIdx = frontmatter.indexOf('model:');
      const memoryIdx = frontmatter.indexOf('memory:');
      const skillsIdx = frontmatter.indexOf('skills:');
      const allowedIdx = frontmatter.indexOf('allowed-tools:');
      const disallowedIdx = frontmatter.indexOf('disallowedTools:');

      expect(nameIdx).toBeLessThan(descIdx);
      expect(descIdx).toBeLessThan(modelIdx);
      expect(modelIdx).toBeLessThan(memoryIdx);
      expect(memoryIdx).toBeLessThan(skillsIdx);
      expect(skillsIdx).toBeLessThan(allowedIdx);
      expect(allowedIdx).toBeLessThan(disallowedIdx);
    });
  });

  describe('agent minimal template', () => {
    const getFrontmatter = (result: string): string => {
      const match = result.match(/^---\n([\s\S]*?)\n---/);
      return match ? match[1] : '';
    };

    it('includes agent frontmatter fields in minimal mode', () => {
      const result = generateSkillMd(
        { name: 'minimal-agent' },
        { templateType: 'agent', minimal: true }
      );
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('model: sonnet');
      expect(frontmatter).toContain('memory: project');
      expect(frontmatter).toContain('skills: []');
      expect(frontmatter).toContain('disallowedTools: []');
      expect(frontmatter).toContain('allowed-tools:');
    });

    it('overview mentions agent', () => {
      const result = generateSkillMd(
        { name: 'minimal-agent' },
        { templateType: 'agent', minimal: true }
      );

      expect(result).toContain('This is a custom Claude Code agent.');
    });

    it('does not include agent guidance in minimal mode', () => {
      const result = generateSkillMd(
        { name: 'minimal-agent' },
        { templateType: 'agent', minimal: true }
      );

      expect(result).not.toContain('AGENT SKILL');
      expect(result).not.toContain('HOW AGENTS DIFFER FROM REGULAR SKILLS');
      expect(result).not.toContain('SKILL DEVELOPMENT GUIDANCE');
    });

    it('minimal agent is shorter than verbose agent', () => {
      const minimal = generateSkillMd({ name: 'test' }, { templateType: 'agent', minimal: true });
      const verbose = generateSkillMd({ name: 'test' }, { templateType: 'agent' });

      expect(minimal.length).toBeLessThan(verbose.length);
    });

    it('uses agent-specific description in minimal mode', () => {
      const result = generateSkillMd(
        { name: 'minimal-agent' },
        { templateType: 'agent', minimal: true }
      );

      expect(result).toContain(
        'description: "TODO: Describe what this agent does and when it should be used."'
      );
    });
  });

  describe('TemplateType agent value', () => {
    it('accepts agent template type', () => {
      const templateType: TemplateType = 'agent';
      expect(templateType).toBe('agent');
    });
  });

  describe('new flag frontmatter generation', () => {
    const getFrontmatter = (result: string): string => {
      const match = result.match(/^---\n([\s\S]*?)\n---/);
      return match ? match[1] : '';
    };

    it('--memory user adds memory: user to basic template', () => {
      const result = generateSkillMd({ name: 'test' }, { memory: 'user' });
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('memory: user');
    });

    it('--memory project adds memory: project to forked template', () => {
      const result = generateSkillMd(
        { name: 'test' },
        { templateType: 'forked', memory: 'project' }
      );
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('memory: project');
    });

    it('--memory local adds memory: local', () => {
      const result = generateSkillMd({ name: 'test' }, { memory: 'local' });
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('memory: local');
    });

    it('--model haiku adds model: haiku to any template', () => {
      const result = generateSkillMd({ name: 'test' }, { model: 'haiku' });
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('model: haiku');
    });

    it('--model adds model to forked template', () => {
      const result = generateSkillMd({ name: 'test' }, { templateType: 'forked', model: 'opus' });
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('model: opus');
    });

    it('--argument-hint adds argument-hint to frontmatter', () => {
      const result = generateSkillMd({ name: 'test' }, { argumentHint: '<query>' });
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('argument-hint: <query>');
    });

    it('--argument-hint without special chars is unquoted', () => {
      const result = generateSkillMd({ name: 'test' }, { argumentHint: 'search term' });
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('argument-hint: search term');
    });

    it('--argument-hint with special chars is escaped', () => {
      const result = generateSkillMd({ name: 'test' }, { argumentHint: 'query: with colon' });
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('argument-hint: "query: with colon"');
    });

    it('--memory user overrides agent default memory: project', () => {
      const result = generateSkillMd({ name: 'test' }, { templateType: 'agent', memory: 'user' });
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('memory: user');
      expect(frontmatter).not.toMatch(/memory: project/);
    });

    it('--model haiku overrides agent default model: sonnet', () => {
      const result = generateSkillMd({ name: 'test' }, { templateType: 'agent', model: 'haiku' });
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('model: haiku');
      expect(frontmatter).not.toMatch(/model: sonnet/);
    });

    it('no memory option on basic template does not add memory field', () => {
      const result = generateSkillMd({ name: 'test' });
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).not.toMatch(/^memory:/m);
    });

    it('no model option on basic template does not add model field', () => {
      const result = generateSkillMd({ name: 'test' });
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).not.toMatch(/^model:/m);
    });

    it('combines memory, model, and argument-hint on basic template', () => {
      const result = generateSkillMd(
        { name: 'test' },
        { memory: 'local', model: 'opus', argumentHint: 'file path' }
      );
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('memory: local');
      expect(frontmatter).toContain('model: opus');
      expect(frontmatter).toContain('argument-hint: file path');
    });
  });

  describe('hooks once:true in verbose mode', () => {
    const getFrontmatter = (result: string): string => {
      const match = result.match(/^---\n([\s\S]*?)\n---/);
      return match ? match[1] : '';
    };

    it('verbose with-hooks YAML includes once: true on PreToolUse', () => {
      const options: TemplateOptions = { templateType: 'with-hooks' };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('once: true');
      expect(frontmatter).toContain('# Only runs on first matching tool use');
    });

    it('minimal with-hooks YAML does not include once: true', () => {
      const options: TemplateOptions = { templateType: 'with-hooks', minimal: true };
      const result = generateSkillMd({ name: 'hooked-skill' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).not.toContain('once: true');
    });

    it('includeHooks on basic template in verbose mode includes once: true', () => {
      const options: TemplateOptions = { includeHooks: true };
      const result = generateSkillMd({ name: 'basic-hooks' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('once: true');
    });
  });

  describe('template field documentation', () => {
    it('basic template guidance mentions memory, model, and other new fields', () => {
      const result = generateSkillMd({ name: 'test' }, { templateType: 'basic' });

      expect(result).toContain('memory:');
      expect(result).toContain('model:');
      expect(result).toContain('skills:');
      expect(result).toContain('disallowedTools:');
      expect(result).toContain('permissionMode:');
      expect(result).toContain('argument-hint:');
    });

    it('forked template guidance includes additional frontmatter fields', () => {
      const result = generateSkillMd({ name: 'test' }, { templateType: 'forked' });

      expect(result).toContain('ADDITIONAL FRONTMATTER FIELDS');
      expect(result).toContain('memory:');
      expect(result).toContain('model:');
      expect(result).toContain('permissionMode:');
    });

    it('internal template guidance includes additional frontmatter fields', () => {
      const result = generateSkillMd({ name: 'test' }, { templateType: 'internal' });

      expect(result).toContain('ADDITIONAL FRONTMATTER FIELDS');
      expect(result).toContain('memory:');
      expect(result).toContain('model:');
    });

    it('with-hooks template guidance includes additional frontmatter fields', () => {
      const result = generateSkillMd({ name: 'test' }, { templateType: 'with-hooks' });

      expect(result).toContain('ADDITIONAL FRONTMATTER FIELDS');
      expect(result).toContain('memory:');
      expect(result).toContain('model:');
    });

    it('agent guidance explains memory scopes', () => {
      const result = generateSkillMd({ name: 'test' }, { templateType: 'agent' });

      expect(result).toContain('MEMORY SCOPES');
      expect(result).toContain('user');
      expect(result).toContain('project');
      expect(result).toContain('local');
    });

    it('agent guidance explains model selection', () => {
      const result = generateSkillMd({ name: 'test' }, { templateType: 'agent' });

      expect(result).toContain('MODEL SELECTION');
      expect(result).toContain('sonnet');
      expect(result).toContain('opus');
      expect(result).toContain('haiku');
    });

    it('shared guidance block documents new fields', () => {
      const result = generateSkillMd({ name: 'test' });

      // Check the shared SKILL DEVELOPMENT GUIDANCE block
      expect(result).toContain('memory:');
      expect(result).toContain('model:');
      expect(result).toContain('skills:');
      expect(result).toContain('disallowedTools:');
      expect(result).toContain('permissionMode:');
      expect(result).toContain('argument-hint:');
    });
  });

  describe('template type and explicit option interactions', () => {
    // Helper to extract frontmatter from generated output
    const getFrontmatter = (result: string): string => {
      const match = result.match(/^---\n([\s\S]*?)\n---/);
      return match ? match[1] : '';
    };

    it('explicit context: fork on basic template only adds context without forked guidance', () => {
      const options: TemplateOptions = { templateType: 'basic', context: 'fork' };
      const result = generateSkillMd({ name: 'basic-forked' }, options);
      const frontmatter = getFrontmatter(result);

      // Should have context: fork
      expect(frontmatter).toContain('context: fork');
      // Should NOT have forked template guidance (it's basic template)
      expect(result).not.toContain('FORKED CONTEXT SKILL');
      // Should have commented allowed-tools (basic template default)
      expect(frontmatter).toContain('# allowed-tools:');
    });

    it('explicit userInvocable: false on basic template only adds field without internal guidance', () => {
      const options: TemplateOptions = { templateType: 'basic', userInvocable: false };
      const result = generateSkillMd({ name: 'basic-internal' }, options);
      const frontmatter = getFrontmatter(result);

      // Should have user-invocable: false
      expect(frontmatter).toContain('user-invocable: false');
      // Should NOT have internal template guidance (it's basic template)
      expect(result).not.toContain('INTERNAL HELPER SKILL');
    });

    it('forked template does not add user-invocable field by default', () => {
      const options: TemplateOptions = { templateType: 'forked' };
      const result = generateSkillMd({ name: 'forked-only' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('context: fork');
      expect(frontmatter).not.toContain('user-invocable');
    });

    it('internal template does not add context: fork by default', () => {
      const options: TemplateOptions = { templateType: 'internal' };
      const result = generateSkillMd({ name: 'internal-only' }, options);
      const frontmatter = getFrontmatter(result);

      expect(frontmatter).toContain('user-invocable: false');
      expect(frontmatter).not.toContain('context: fork');
    });

    it('can combine internal template with explicit context: fork', () => {
      const options: TemplateOptions = { templateType: 'internal', context: 'fork' };
      const result = generateSkillMd({ name: 'internal-forked' }, options);
      const frontmatter = getFrontmatter(result);

      // Should have both fields
      expect(frontmatter).toContain('user-invocable: false');
      expect(frontmatter).toContain('context: fork');
      // Should have internal guidance (primary template)
      expect(result).toContain('INTERNAL HELPER SKILL');
      expect(result).not.toContain('FORKED CONTEXT SKILL');
    });

    it('can combine forked template with explicit userInvocable: false', () => {
      const options: TemplateOptions = { templateType: 'forked', userInvocable: false };
      const result = generateSkillMd({ name: 'forked-internal' }, options);
      const frontmatter = getFrontmatter(result);

      // Should have both fields
      expect(frontmatter).toContain('context: fork');
      expect(frontmatter).toContain('user-invocable: false');
      // Should have forked guidance (primary template)
      expect(result).toContain('FORKED CONTEXT SKILL');
      expect(result).not.toContain('INTERNAL HELPER SKILL');
    });
  });
});
