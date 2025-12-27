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
 * Generate YAML frontmatter for the skill
 */
function generateFrontmatter(params: SkillTemplateParams): string {
  const lines: string[] = ['---'];

  lines.push(`name: ${escapeYamlString(params.name)}`);

  if (params.description) {
    lines.push(`description: ${escapeYamlString(params.description)}`);
  } else {
    lines.push('description: "TODO: Add a short description of what this skill does"');
  }

  if (params.allowedTools && params.allowedTools.length > 0) {
    lines.push('allowed-tools:');
    for (const tool of params.allowedTools) {
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

  lines.push('---');
  return lines.join('\n');
}

/**
 * Generate the markdown body with guidance and TODO placeholders
 */
function generateBody(params: SkillTemplateParams): string {
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

This file defines a Claude Code skill. Skills are markdown files with YAML
frontmatter that teach Claude how to perform specific tasks.

FRONTMATTER FIELDS:
- name: (required) Unique identifier for this skill
- description: (required) Brief description shown in skill listings. This is the
  PRIMARY triggering mechanism - include all "when to use" information here.
- allowed-tools: (optional) List of tools this skill can use
- license: (optional) License for the skill (e.g., "MIT", "Apache-2.0")

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
 */
export function generateSkillMd(params: SkillTemplateParams): string {
  const frontmatter = generateFrontmatter(params);
  const body = generateBody(params);
  return frontmatter + '\n' + body;
}
