/**
 * SKILL.md template generator
 *
 * Generates the SKILL.md file content with YAML frontmatter and markdown body.
 */

export interface SkillTemplateParams {
  name: string;
  description?: string;
  allowedTools?: string[];
}

/**
 * Template types for different skill patterns.
 * - basic: Default template with general guidance
 * - forked: Template for skills that run in forked (isolated) context
 * - with-hooks: Template demonstrating hook configuration
 * - internal: Template for non-user-invocable helper skills
 */
export type TemplateType = 'basic' | 'forked' | 'with-hooks' | 'internal';

/**
 * Options for customizing generated skill templates.
 */
export interface TemplateOptions {
  /** Which template variant to generate */
  templateType?: TemplateType;
  /** Set context: fork in frontmatter for isolated execution */
  context?: 'fork';
  /** Set the agent field in frontmatter */
  agent?: string;
  /** Set user-invocable: false if false (default is true/omitted) */
  userInvocable?: boolean;
  /** Include commented hook examples in frontmatter */
  includeHooks?: boolean;
}

/**
 * Escape a string for use in YAML values.
 * Wraps in double quotes if it contains special characters.
 */
function escapeYamlString(value: string): string {
  const needsQuotes =
    value.includes(':') ||
    value.includes('#') ||
    value.includes("'") ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\\') ||
    value.startsWith(' ') ||
    value.endsWith(' ') ||
    value.startsWith('-') ||
    value.startsWith('[') ||
    value.startsWith('{') ||
    /^(true|false|null|yes|no|on|off)$/i.test(value);

  if (!needsQuotes) {
    return value;
  }

  // Use double quotes and escape internal double quotes and backslashes
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/**
 * Get default allowed-tools based on template type
 */
function getDefaultAllowedTools(templateType: TemplateType): string[] | undefined {
  switch (templateType) {
    case 'forked':
      // Read-only tools for isolated analysis
      return ['Read', 'Glob', 'Grep'];
    case 'internal':
      // Minimal tools for helper skills
      return ['Read', 'Grep'];
    default:
      // No defaults for basic and with-hooks (user specifies or commented placeholder)
      return undefined;
  }
}

/**
 * Generate YAML frontmatter for the skill
 */
function generateFrontmatter(params: SkillTemplateParams, options?: TemplateOptions): string {
  const lines: string[] = ['---'];
  const templateType = options?.templateType ?? 'basic';

  lines.push(`name: ${escapeYamlString(params.name)}`);

  if (params.description) {
    lines.push(`description: ${escapeYamlString(params.description)}`);
  } else {
    lines.push('description: "TODO: Add a short description of what this skill does"');
  }

  // Determine allowed-tools: explicit params override template defaults
  const allowedTools = params.allowedTools ?? getDefaultAllowedTools(templateType);

  if (allowedTools && allowedTools.length > 0) {
    lines.push('allowed-tools:');
    for (const tool of allowedTools) {
      lines.push(`  - ${escapeYamlString(tool.trim())}`);
    }
  } else {
    lines.push('# allowed-tools:');
    lines.push('#   - Bash');
    lines.push('#   - Read');
    lines.push('#   - Write');
    lines.push('#   - Edit');
    lines.push('#   - Glob');
    lines.push('#   - Grep');
  }

  // Add context: fork for forked template or if explicitly specified
  if (templateType === 'forked' || options?.context === 'fork') {
    lines.push('context: fork');
  }

  // Add agent field if specified
  if (options?.agent) {
    lines.push(`agent: ${escapeYamlString(options.agent)}`);
  }

  // Add user-invocable: false for internal template or if explicitly set to false
  if (templateType === 'internal' || options?.userInvocable === false) {
    lines.push('user-invocable: false');
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Generate template-specific guidance section
 */
function getTemplateGuidance(templateType: TemplateType): string {
  switch (templateType) {
    case 'forked':
      return `
FORKED CONTEXT SKILL
================================================================================

This skill runs in a FORKED (isolated) context. Key characteristics:

WHEN TO USE FORKED CONTEXTS:
- Isolated analysis that shouldn't affect the main conversation state
- Exploratory operations where you want to try things without side effects
- Parallel investigation tasks that run independently
- Read-only operations that gather information

LIMITATIONS:
- No state persistence: Changes made in the fork don't persist to parent
- Tool restrictions: Only allowed-tools listed in frontmatter are available
- Memory isolation: The fork cannot access or modify parent conversation state
- No file writes: Forked contexts typically use read-only tools

BEST PRACTICES FOR DATA RETURN:
- Structure your output clearly so results can be used by the parent context
- Return actionable summaries rather than raw data when possible
- Use consistent output formats for programmatic consumption
- Include relevant file paths, line numbers, or identifiers for follow-up

DEFAULT TOOLS:
This template defaults to read-only tools (Read, Glob, Grep). Modify
allowed-tools if you need additional capabilities.
`;

    case 'internal':
      return `
INTERNAL HELPER SKILL
================================================================================

This skill has \`user-invocable: false\`, making it an internal helper.

WHAT THIS MEANS:
- Users CANNOT directly invoke this skill with /skill-name
- Other skills CAN reference and use this skill's functionality
- The skill is loaded but hidden from user-facing skill listings
- Useful for shared utilities, common patterns, or implementation details

HOW OTHER SKILLS REFERENCE THIS SKILL:
Skills can reference internal helpers by including guidance in their body
that tells Claude to follow the patterns defined in the helper skill.

COMMON PATTERNS FOR HELPER SKILLS:
- Shared validation logic used by multiple skills
- Common output formatting templates
- Reusable analysis or processing steps
- Standard error handling patterns
- Configuration or setup procedures

EXAMPLE USE CASES:
- A "formatting-helper" that defines standard output formats
- A "validation-helper" that checks common preconditions
- A "git-patterns" helper with standard git workflow steps

DEFAULT TOOLS:
This template defaults to minimal tools (Read, Grep). Modify allowed-tools
based on what operations your helper needs to perform.
`;

    default:
      // Basic template - return empty string (uses standard guidance)
      return '';
  }
}

/**
 * Generate the markdown body with guidance and TODO placeholders
 */
function generateBody(params: SkillTemplateParams, templateType: TemplateType): string {
  const templateGuidance = getTemplateGuidance(templateType);
  const hasTemplateGuidance = templateGuidance.length > 0;

  return `
# ${params.name}

## Overview

TODO: Describe what this skill does and when Claude should use it.

## Usage

TODO: Explain how to invoke this skill and any required context.

## Examples

TODO: Provide examples of prompts that trigger this skill.

### Example 1

\`\`\`
User: [example prompt]
Claude: [expected behavior]
\`\`\`

## Implementation Notes

TODO: Add any implementation details, edge cases, or important considerations.

<!--
================================================================================
SKILL DEVELOPMENT GUIDANCE
================================================================================
${hasTemplateGuidance ? templateGuidance : ''}
This file defines a Claude Code skill. Skills are markdown files with YAML
frontmatter that teach Claude how to perform specific tasks.

FRONTMATTER FIELDS (Open Agent Skills Spec):
- name: (required) Unique identifier for this skill
- description: (required) Brief description shown in skill listings. This is the
  PRIMARY triggering mechanism - include all "when to use" information here.
- allowed-tools: (optional) List of tools this skill can use
- license: (optional) License for the skill (e.g., "MIT", "Apache-2.0")

FRONTMATTER FIELDS (Claude Code Extensions):
- context: Set to "fork" to run skill in isolated context (no state persistence)
- agent: Specify which agent type should handle this skill (e.g., "Explore", "Plan")
- user-invocable: Set to false for internal helper skills not directly invocable
- hooks: Configure lifecycle hooks (PreToolUse, PostToolUse, SessionStart, Stop)

ALLOWED TOOLS - WILDCARD PATTERNS:
You can use wildcards for more granular tool permissions:
- Bash(git *): Allow any git command
- Bash(npm install): Allow only npm install
- Bash(npm test*): Allow npm test and npm test:unit, etc.
- Read(/path/to/dir/*): Restrict reads to a specific directory

ARGUMENT SHORTHAND SYNTAX:
Access skill arguments in your template:
- $0 or $ARGUMENTS[0]: First argument passed to the skill
- $1 or $ARGUMENTS[1]: Second argument
- \${CLAUDE_SESSION_ID}: Current session identifier
- Use ARGUMENTS array for programmatic access in scripts

BEST PRACTICES:
1. Keep skills focused on a single task or related set of tasks
2. Put ALL trigger conditions in the description field, not the body
3. Provide clear examples of expected behavior
4. Include edge cases and error handling guidance
5. Keep the total skill file under 500 lines for optimal performance

DESCRIPTION PATTERNS:
Use these patterns in your description for reliable triggering:
- "Use when the user wants to..."
- "Apply this skill for..."
- "This skill should be used when..."

ALLOWED TOOLS:
Common tools you can specify in allowed-tools:
- Bash: Execute shell commands
- Read: Read file contents
- Write: Write/create files
- Edit: Edit existing files
- Glob: Find files by pattern
- Grep: Search file contents
- WebFetch: Fetch web content
- WebSearch: Search the web
- Task: Launch subagents for complex operations

If no allowed-tools are specified, the skill inherits default tool access.

SCRIPTS DIRECTORY:
The scripts/ subdirectory can contain helper scripts that your skill
references. These are executed via the Bash tool when needed.

For more information, see: https://docs.anthropic.com/en/docs/claude-code
================================================================================
-->
`;
}

/**
 * Generate the complete SKILL.md content
 * @param params - Basic skill parameters (name, description, allowedTools)
 * @param options - Optional template customization options
 */
export function generateSkillMd(params: SkillTemplateParams, options?: TemplateOptions): string {
  // Default to basic template if no options provided
  const templateType = options?.templateType ?? 'basic';
  const frontmatter = generateFrontmatter(params, options);
  const body = generateBody(params, templateType);
  return frontmatter + '\n' + body;
}
