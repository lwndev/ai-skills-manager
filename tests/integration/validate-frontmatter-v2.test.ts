/**
 * Integration tests for FEAT-014: Frontmatter Schema v2 — New Claude Code Fields
 *
 * These tests verify end-to-end validation of new frontmatter fields
 * through the full validation pipeline (parser → validators → orchestrator → API).
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { validateSkill } from '../../src/generators/validate';
import { validate } from '../../src/api/validate';

describe('FEAT-014: Frontmatter Schema v2 Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'feat-014-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a SKILL.md file in a directory matching the skill name.
   */
  async function createSkill(content: string): Promise<string> {
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const skillName = nameMatch ? nameMatch[1].trim() : 'test-skill';
    const skillDir = path.join(tempDir, skillName);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), content);
    return skillDir;
  }

  describe('full validation with all new fields', () => {
    it('validates a skill with all FEAT-014 fields populated', async () => {
      const skillPath = await createSkill(`---
name: full-v2-skill
description: Skill with all v2 frontmatter fields
argument-hint: "Provide a file path to analyze"
keep-coding-instructions: true
tools:
  - Read
  - Write
color: green
disable-model-invocation: false
version: "2.0.0"
allowed-tools:
  - Read
  - Write
  - Glob
---

# Full V2 Skill

This skill uses all new frontmatter fields.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.checks.argumentHintFormat.passed).toBe(true);
      expect(result.checks.keepCodingInstructionsFormat.passed).toBe(true);
      expect(result.checks.toolsFormat.passed).toBe(true);
      expect(result.checks.colorFormat.passed).toBe(true);
      expect(result.checks.disableModelInvocationFormat.passed).toBe(true);
      expect(result.checks.versionFormat.passed).toBe(true);
      expect(result.checks.allowedToolsFormat.passed).toBe(true);
    });

    it('validates through the public API with all fields', async () => {
      const skillPath = await createSkill(`---
name: api-v2-skill
description: Skill validated through public API
argument-hint: "Enter search query"
keep-coding-instructions: false
tools: Read
color: cyan
disable-model-invocation: true
version: "1.0.0"
---

# API V2 Skill

Content.
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates through the detailed API with all fields', async () => {
      const skillPath = await createSkill(`---
name: detailed-v2-skill
description: Skill with detailed API validation
argument-hint: "Describe the refactoring"
keep-coding-instructions: true
tools:
  - Read
  - Grep
  - Glob
color: magenta
disable-model-invocation: false
version: "3.1.0"
allowed-tools:
  - Read
  - Grep
---

# Detailed V2 Skill

Content.
`);

      const result = await validate(skillPath, { detailed: true });

      expect(result.valid).toBe(true);
      expect(result.checks.argumentHintFormat.passed).toBe(true);
      expect(result.checks.keepCodingInstructionsFormat.passed).toBe(true);
      expect(result.checks.toolsFormat.passed).toBe(true);
      expect(result.checks.colorFormat.passed).toBe(true);
      expect(result.checks.disableModelInvocationFormat.passed).toBe(true);
      expect(result.checks.versionFormat.passed).toBe(true);
      expect(result.checks.allowedToolsFormat.passed).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('validation with subset of new fields', () => {
    it('validates skill with only argument-hint and version', async () => {
      const skillPath = await createSkill(`---
name: partial-fields-a
description: Skill with argument-hint and version only
argument-hint: "Enter a query"
version: "1.0.0"
---

# Partial Fields A

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.checks.argumentHintFormat.passed).toBe(true);
      expect(result.checks.versionFormat.passed).toBe(true);
      // Unset optional fields should still pass
      expect(result.checks.colorFormat.passed).toBe(true);
    });

    it('validates skill with only tool-related fields', async () => {
      const skillPath = await createSkill(`---
name: tool-fields-only
description: Skill with only tool-related v2 fields
tools:
  - Read
  - Write
allowed-tools:
  - Read
  - Write
  - Glob
---

# Tool Fields Only

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.checks.toolsFormat.passed).toBe(true);
      expect(result.checks.allowedToolsFormat.passed).toBe(true);
    });

    it('validates skill with only boolean fields', async () => {
      const skillPath = await createSkill(`---
name: boolean-fields-only
description: Skill with only boolean v2 fields
keep-coding-instructions: true
disable-model-invocation: false
---

# Boolean Fields Only

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.checks.keepCodingInstructionsFormat.passed).toBe(true);
      expect(result.checks.disableModelInvocationFormat.passed).toBe(true);
    });
  });

  describe('backward compatibility', () => {
    it('validates existing skill with no new fields', async () => {
      const skillPath = await createSkill(`---
name: legacy-skill
description: A skill with only original fields
license: MIT
compatibility: ">=1.0.0"
allowed-tools:
  - Read
  - Write
---

# Legacy Skill

This skill predates FEAT-014 and uses none of the new fields.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      // All new field checks should pass (fields are optional)
      expect(result.checks.argumentHintFormat.passed).toBe(true);
      expect(result.checks.keepCodingInstructionsFormat.passed).toBe(true);
      expect(result.checks.toolsFormat.passed).toBe(true);
      expect(result.checks.colorFormat.passed).toBe(true);
      expect(result.checks.disableModelInvocationFormat.passed).toBe(true);
      expect(result.checks.versionFormat.passed).toBe(true);
      expect(result.checks.allowedToolsFormat.passed).toBe(true);
    });

    it('validates minimal skill (name and description only)', async () => {
      const skillPath = await createSkill(`---
name: minimal-skill
description: Bare minimum skill
---

# Minimal Skill

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('validates existing skill with CC 2.1.x fields but no FEAT-014 fields', async () => {
      const skillPath = await createSkill(`---
name: cc-two-one-skill
description: Skill with CC 2.1.x fields only
context: fork
agent: my-agent
user-invocable: true
hooks:
  PreToolUse: validate.sh
---

# CC 2.1.x Skill

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.checks.contextFormat.passed).toBe(true);
      expect(result.checks.agentFormat.passed).toBe(true);
      expect(result.checks.userInvocableFormat.passed).toBe(true);
      expect(result.checks.hooksFormat.passed).toBe(true);
    });
  });

  describe('advanced tool patterns in allowed-tools', () => {
    it('accepts Task(AgentName) pattern', async () => {
      const skillPath = await createSkill(`---
name: task-pattern-skill
description: Skill with Task agent pattern
allowed-tools:
  - Read
  - "Task(my-research-agent)"
  - "Task(code-reviewer)"
---

# Task Pattern Skill

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.checks.allowedToolsFormat.passed).toBe(true);
    });

    it('accepts mcp__server__* pattern', async () => {
      const skillPath = await createSkill(`---
name: mcp-pattern-skill
description: Skill with MCP server patterns
allowed-tools:
  - "mcp__github__*"
  - "mcp__slack__send_message"
  - "mcp__jira__create_issue"
---

# MCP Pattern Skill

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.checks.allowedToolsFormat.passed).toBe(true);
    });

    it('accepts ${CLAUDE_PLUGIN_ROOT} pattern', async () => {
      const skillPath = await createSkill(`---
name: plugin-root-skill
description: Skill with plugin root pattern
allowed-tools:
  - Read
  - "\${CLAUDE_PLUGIN_ROOT}/scripts/build.sh"
---

# Plugin Root Skill

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.checks.allowedToolsFormat.passed).toBe(true);
    });

    it('accepts Bash(git:*) colon syntax pattern', async () => {
      const skillPath = await createSkill(`---
name: bash-colon-skill
description: Skill with Bash colon pattern
allowed-tools:
  - "Bash(git:*)"
  - "Bash(npm:*)"
  - "Bash(*)"
  - Bash
---

# Bash Colon Skill

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.checks.allowedToolsFormat.passed).toBe(true);
    });

    it('accepts mixed advanced patterns', async () => {
      const skillPath = await createSkill(`---
name: mixed-patterns-skill
description: Skill with mixed tool patterns
allowed-tools:
  - Read
  - Write
  - "Task(helper-agent)"
  - "mcp__github__*"
  - "Bash(git:*)"
  - Glob
  - Grep
---

# Mixed Patterns Skill

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.checks.allowedToolsFormat.passed).toBe(true);
    });
  });

  describe('advanced tool patterns in tools and disallowedTools', () => {
    it('accepts advanced patterns in tools field', async () => {
      const skillPath = await createSkill(`---
name: tools-patterns-skill
description: Skill with advanced patterns in tools
tools:
  - Read
  - "Task(my-agent)"
  - "mcp__server__tool"
  - "Bash(npm:*)"
---

# Tools Patterns Skill

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.checks.toolsFormat.passed).toBe(true);
    });

    it('rejects disallowedTools as an agent-only field', async () => {
      const skillPath = await createSkill(`---
name: disallowed-patterns-skill
description: Skill with disallowedTools (agent-only)
disallowedTools:
  - Bash
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.allowedProperties.passed).toBe(false);
      expect(result.checks.allowedProperties.error).toContain('disallowedTools');
    });

    it('accepts string value for tools (parser normalizes to array)', async () => {
      const skillPath = await createSkill(`---
name: tools-string-skill
description: Skill with string tools value
tools: "Read Write Bash"
---

# Tools String Skill

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.checks.toolsFormat.passed).toBe(true);
    });
  });

  describe('invalid field values produce correct failures', () => {
    it('fails for invalid color value', async () => {
      const skillPath = await createSkill(`---
name: bad-color-skill
description: Skill with invalid color
color: orange
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.colorFormat.passed).toBe(false);
      expect(result.checks.colorFormat.error).toBeDefined();
    });

    it('fails for non-boolean keep-coding-instructions', async () => {
      const skillPath = await createSkill(`---
name: bad-kci-skill
description: Skill with invalid keep-coding-instructions
keep-coding-instructions: "yes"
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.keepCodingInstructionsFormat.passed).toBe(false);
    });

    it('fails for non-boolean disable-model-invocation', async () => {
      const skillPath = await createSkill(`---
name: bad-dmi-skill
description: Skill with invalid disable-model-invocation
disable-model-invocation: 1
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.disableModelInvocationFormat.passed).toBe(false);
    });

    it('fails for version as YAML number (edge case #22)', async () => {
      // YAML parses `version: 1.0` as a float, not a string
      const skillPath = await createSkill(`---
name: numeric-version-skill
description: Skill with numeric version
version: 1.0
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.versionFormat.passed).toBe(false);
      expect(result.checks.versionFormat.error).toContain('must be a non-empty string');
    });

    it('fails for argument-hint exceeding 200 characters', async () => {
      const longHint = 'a'.repeat(201);
      const skillPath = await createSkill(`---
name: long-hint-skill
description: Skill with too-long argument hint
argument-hint: "${longHint}"
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.argumentHintFormat.passed).toBe(false);
    });

    it('maps error codes correctly through the public API', async () => {
      const skillPath = await createSkill(`---
name: api-errors-skill
description: Skill with multiple invalid fields
color: purple
---

Content.
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_COLOR_FORMAT')).toBe(true);
    });

    it('fails for multiple invalid fields simultaneously', async () => {
      const skillPath = await createSkill(`---
name: multi-error-skill
description: Skill with many invalid fields
color: orange
keep-coding-instructions: "yes"
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.colorFormat.passed).toBe(false);
      expect(result.checks.keepCodingInstructionsFormat.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('mixed old and new fields', () => {
    it('validates skill combining original, CC 2.1.x, and FEAT-014 fields', async () => {
      const skillPath = await createSkill(`---
name: full-spectrum-skill
description: Skill with fields from all eras
license: MIT
compatibility: ">=2.0.0"
context: fork
agent: specialized-agent
user-invocable: true
hooks:
  PreToolUse: validate.sh
color: blue
version: "1.2.3"
allowed-tools:
  - Read
  - Write
  - "Task(helper-a)"
  - "mcp__github__*"
---

# Full Spectrum Skill

This skill uses frontmatter fields from every generation.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      // Original fields
      expect(result.checks.nameFormat.passed).toBe(true);
      expect(result.checks.descriptionFormat.passed).toBe(true);
      expect(result.checks.compatibilityFormat.passed).toBe(true);
      expect(result.checks.allowedToolsFormat.passed).toBe(true);
      // CC 2.1.x fields
      expect(result.checks.contextFormat.passed).toBe(true);
      expect(result.checks.agentFormat.passed).toBe(true);
      expect(result.checks.userInvocableFormat.passed).toBe(true);
      expect(result.checks.hooksFormat.passed).toBe(true);
      // FEAT-014 fields
      expect(result.checks.colorFormat.passed).toBe(true);
      expect(result.checks.versionFormat.passed).toBe(true);
    });
  });
});
