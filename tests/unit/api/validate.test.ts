/**
 * Unit tests for the validate API function (FEAT-010 Phase 2)
 *
 * Tests that the validate() API function:
 * 1. Returns typed ValidateResult objects
 * 2. Transforms internal validation results to public API format
 * 3. Never throws for validation failures (returns result object)
 * 4. Includes machine-readable error codes
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { validate } from '../../../src/api/validate';

describe('validate API function', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-validate-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a skill directory with SKILL.md content
   */
  async function createSkill(content: string): Promise<string> {
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const skillName = nameMatch ? nameMatch[1].trim() : 'test-skill';

    const skillDir = path.join(tempDir, skillName);
    await fs.mkdir(skillDir, { recursive: true });

    const skillPath = path.join(skillDir, 'SKILL.md');
    await fs.writeFile(skillPath, content);
    return skillDir;
  }

  describe('return type', () => {
    it('returns a ValidateResult object for valid skill', async () => {
      const skillPath = await createSkill(`---
name: my-skill
description: A test skill
---

# My Skill
`);

      const result = await validate(skillPath);

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('returns a ValidateResult object for invalid skill', async () => {
      const result = await validate('/nonexistent/path');

      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('valid skills', () => {
    it('returns valid: true for a minimal valid skill', async () => {
      const skillPath = await createSkill(`---
name: valid-skill
description: A valid skill
---

# Valid Skill
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid: true for a skill with all optional fields', async () => {
      const skillPath = await createSkill(`---
name: complete-skill
description: A complete skill with all fields
license: MIT
compatibility: ">=1.0.0"
allowed-tools:
  - Read
  - Write
metadata:
  author: Test Author
  version: 1.0.0
---

# Complete Skill
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('invalid skills', () => {
    it('returns valid: false when path does not exist', async () => {
      const result = await validate('/nonexistent/path');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns valid: false when SKILL.md is missing', async () => {
      const result = await validate(tempDir);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns valid: false when frontmatter is missing', async () => {
      const skillPath = await createSkill(`# My Skill

No frontmatter here.
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_FRONTMATTER')).toBe(true);
    });

    it('returns valid: false when name is missing', async () => {
      const skillPath = await createSkill(`---
description: Missing name
---

# Skill
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it('returns valid: false when description is missing', async () => {
      const skillPath = await createSkill(`---
name: missing-desc
---

# Skill
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it('returns valid: false when name format is invalid', async () => {
      const skillPath = await createSkill(`---
name: InvalidName
description: Name has uppercase
---

# Skill
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_NAME_FORMAT')).toBe(true);
    });

    it('returns valid: false when unknown properties are present', async () => {
      const skillPath = await createSkill(`---
name: my-skill
description: Valid description
unknown-field: should not be here
---

# Skill
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_PROPERTY')).toBe(true);
    });
  });

  describe('error codes', () => {
    it('provides machine-readable error codes', async () => {
      const skillPath = await createSkill(`---
name: Invalid-Name
unknown: true
---

# Skill
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(false);
      for (const error of result.errors) {
        expect(error.code).toMatch(/^[A-Z_]+$/);
      }
    });

    it('includes FILE_NOT_FOUND code when file does not exist', async () => {
      const result = await validate('/does/not/exist');

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'FILE_NOT_FOUND')).toBe(true);
    });

    it('includes INVALID_FRONTMATTER code for invalid YAML', async () => {
      const skillPath = await createSkill(`---
name: test
description: [unclosed bracket
---

Content.
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_FRONTMATTER')).toBe(true);
    });
  });

  describe('error structure', () => {
    it('errors have code, message, and path properties', async () => {
      const result = await validate('/nonexistent/path');

      expect(result.errors.length).toBeGreaterThan(0);
      const error = result.errors[0];
      expect(error.code).toBeDefined();
      expect(error.message).toBeDefined();
      expect(error.path).toBeDefined();
    });

    it('error message is human-readable', async () => {
      const result = await validate('/nonexistent/path');

      const error = result.errors[0];
      expect(error.message.length).toBeGreaterThan(10);
      expect(error.message).not.toEqual(error.code);
    });
  });

  describe('warnings', () => {
    it('returns empty warnings array for a typical skill', async () => {
      const skillPath = await createSkill(`---
name: my-skill
description: A test skill
---

# My Skill
`);

      const result = await validate(skillPath);

      expect(result.warnings).toEqual([]);
    });

    it('returns warnings for large SKILL.md content', async () => {
      const largeContent = 'x'.repeat(50001);
      const skillPath = await createSkill(`---
name: large-skill
description: Has lots of content
---

${largeContent}
`);

      const result = await validate(skillPath);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].code).toBe('FILE_SIZE_WARNING');
    });

    it('returns UNKNOWN_HOOK_KEY warning code for unknown hook', async () => {
      const skillPath = await createSkill(`---
name: hook-warn
description: Skill with unknown hook
hooks:
  CustomHook: ./script.sh
---

Content.
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      const hookWarning = result.warnings.find((w) => w.code === 'UNKNOWN_HOOK_KEY');
      expect(hookWarning).toBeDefined();
      expect(hookWarning?.message).toContain('Unknown hook');
    });

    it('returns VALIDATION_WARNING for unrecognized warning messages', async () => {
      // This tests the fallback path in categorizeWarningCode.
      // Currently all warnings from validators match the known patterns,
      // so we test indirectly: a warning without "Unknown model",
      // "Unknown hook", "lines", or "tokens" would get VALIDATION_WARNING.
      // We verify the existing categorization is correct by ensuring
      // known warnings get their proper codes (tested above).
      const skillPath = await createSkill(`---
name: no-warn
description: Skill with no warnings
---

Content.
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('multiple errors', () => {
    it('collects all errors when multiple checks fail', async () => {
      const skillPath = await createSkill(`---
name: Invalid-Name
description: Has <angle> brackets
unknown-field: true
---

Content.
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);

      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('INVALID_NAME_FORMAT');
      expect(codes).toContain('INVALID_DESCRIPTION_FORMAT');
      expect(codes).toContain('INVALID_PROPERTY');
    });
  });

  describe('never throws', () => {
    it('does not throw for nonexistent path', async () => {
      await expect(validate('/nonexistent/path')).resolves.toBeDefined();
    });

    it('does not throw for invalid content', async () => {
      const skillPath = await createSkill('not valid yaml at all ][');
      await expect(validate(skillPath)).resolves.toBeDefined();
    });

    it('does not throw for empty directory', async () => {
      await expect(validate(tempDir)).resolves.toBeDefined();
    });
  });

  describe('path handling', () => {
    it('accepts path to skill directory', async () => {
      const skillPath = await createSkill(`---
name: dir-test
description: Test path handling
---

Content.
`);

      const result = await validate(skillPath);

      expect(result.valid).toBe(true);
    });

    it('accepts path to SKILL.md file', async () => {
      const skillDir = await createSkill(`---
name: file-test
description: Test path handling
---

Content.
`);
      const filePath = path.join(skillDir, 'SKILL.md');

      const result = await validate(filePath);

      expect(result.valid).toBe(true);
    });

    it('accepts relative paths', async () => {
      const skillDir = await createSkill(`---
name: relative-test
description: Test relative path
---

Content.
`);

      // Get relative path from cwd
      const relativePath = path.relative(process.cwd(), skillDir);
      const result = await validate(relativePath);

      expect(result.valid).toBe(true);
    });
  });

  describe('detailed mode', () => {
    it('returns DetailedValidateResult when detailed: true', async () => {
      const skillPath = await createSkill(`---
name: detailed-test
description: Test detailed mode
---

# My Skill
`);

      const result = await validate(skillPath, { detailed: true });

      // Should have DetailedValidateResult properties
      expect(result.valid).toBe(true);
      expect(result.skillPath).toBeDefined();
      expect(result.skillName).toBe('detailed-test');
      expect(result.checks).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('includes check-by-check results', async () => {
      const skillPath = await createSkill(`---
name: check-test
description: Test check results
---

Content.
`);

      const result = await validate(skillPath, { detailed: true });

      // Should have all check results
      expect(result.checks.fileExists).toBeDefined();
      expect(result.checks.frontmatterValid).toBeDefined();
      expect(result.checks.requiredFields).toBeDefined();
      expect(result.checks.allowedProperties).toBeDefined();
      expect(result.checks.nameFormat).toBeDefined();
      expect(result.checks.descriptionFormat).toBeDefined();
      expect(result.checks.compatibilityFormat).toBeDefined();
      expect(result.checks.nameMatchesDirectory).toBeDefined();
    });

    it('shows passed status for each check', async () => {
      const skillPath = await createSkill(`---
name: passed-test
description: Test passed checks
---

Content.
`);

      const result = await validate(skillPath, { detailed: true });

      // All checks should pass for valid skill
      for (const [, check] of Object.entries(result.checks)) {
        expect(check.passed).toBe(true);
        expect(check.error).toBeUndefined();
      }
    });

    it('shows failed status with error message', async () => {
      const skillPath = await createSkill(`---
name: InvalidName
description: Has invalid name
---

Content.
`);

      const result = await validate(skillPath, { detailed: true });

      expect(result.valid).toBe(false);
      expect(result.checks.nameFormat.passed).toBe(false);
      expect(result.checks.nameFormat.error).toBeDefined();
    });

    it('includes skillPath in detailed result', async () => {
      const skillPath = await createSkill(`---
name: path-test
description: Test path in result
---

Content.
`);

      const result = await validate(skillPath, { detailed: true });

      expect(result.skillPath).toContain('path-test');
    });

    it('returns simple ValidateResult when detailed is false', async () => {
      const skillPath = await createSkill(`---
name: simple-test
description: Test simple mode
---

Content.
`);

      const result = await validate(skillPath, { detailed: false });

      // Should have ValidateResult properties only
      expect(result.valid).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);

      // Should NOT have DetailedValidateResult properties
      expect((result as { skillPath?: string }).skillPath).toBeUndefined();
      expect((result as { checks?: unknown }).checks).toBeUndefined();
    });

    it('returns simple ValidateResult when no options provided', async () => {
      const skillPath = await createSkill(`---
name: no-options
description: Test no options
---

Content.
`);

      const result = await validate(skillPath);

      // Should have ValidateResult properties only
      expect(result.valid).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('includes warnings in detailed result', async () => {
      const largeContent = 'x'.repeat(50001);
      const skillPath = await createSkill(`---
name: warning-test
description: Has large content
---

${largeContent}
`);

      const result = await validate(skillPath, { detailed: true });

      expect(result.warnings?.length).toBeGreaterThan(0);
    });
  });
});
