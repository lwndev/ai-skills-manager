import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { validateSkill } from '../../../src/generators/validate';

describe('validateSkill', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validate-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a SKILL.md file with given content
   */
  async function createSkill(content: string): Promise<string> {
    const skillPath = path.join(tempDir, 'SKILL.md');
    await fs.writeFile(skillPath, content);
    return tempDir;
  }

  describe('valid skill', () => {
    it('validates a minimal valid skill', async () => {
      const skillPath = await createSkill(`---
name: my-skill
description: A helpful skill
---

# My Skill

Content here.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.skillName).toBe('my-skill');
      expect(result.errors).toEqual([]);
      expect(result.checks.fileExists.passed).toBe(true);
      expect(result.checks.frontmatterValid.passed).toBe(true);
      expect(result.checks.requiredFields.passed).toBe(true);
      expect(result.checks.allowedProperties.passed).toBe(true);
      expect(result.checks.nameFormat.passed).toBe(true);
      expect(result.checks.descriptionFormat.passed).toBe(true);
    });

    it('validates a skill with all allowed fields', async () => {
      const skillPath = await createSkill(`---
name: complete-skill
description: A complete skill with all fields
license: MIT
allowed-tools:
  - Read
  - Write
  - Bash
metadata:
  author: Test Author
  version: 1.0.0
---

# Complete Skill

Full content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(true);
      expect(result.skillName).toBe('complete-skill');
      expect(Object.values(result.checks).every((c) => c.passed)).toBe(true);
    });
  });

  describe('file existence check', () => {
    it('fails when path does not exist', async () => {
      const result = await validateSkill('/nonexistent/path');

      expect(result.valid).toBe(false);
      expect(result.checks.fileExists.passed).toBe(false);
      expect(result.checks.fileExists.error).toContain('does not exist');
      expect(result.errors).toHaveLength(1);
    });

    it('fails when SKILL.md is missing from directory', async () => {
      // tempDir exists but has no SKILL.md
      const result = await validateSkill(tempDir);

      expect(result.valid).toBe(false);
      expect(result.checks.fileExists.passed).toBe(false);
      expect(result.checks.fileExists.error).toContain('SKILL.md not found');
    });

    it('accepts direct path to SKILL.md', async () => {
      const skillPath = await createSkill(`---
name: direct-skill
description: Direct path test
---

Content.
`);
      const filePath = path.join(skillPath, 'SKILL.md');

      const result = await validateSkill(filePath);

      expect(result.valid).toBe(true);
      expect(result.skillPath).toBe(filePath);
    });
  });

  describe('frontmatter validity check', () => {
    it('fails when frontmatter is missing', async () => {
      const skillPath = await createSkill(`# My Skill

This file has no frontmatter.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.fileExists.passed).toBe(true);
      expect(result.checks.frontmatterValid.passed).toBe(false);
      expect(result.checks.frontmatterValid.error).toContain('Missing YAML');
    });

    it('fails when frontmatter has invalid YAML', async () => {
      const skillPath = await createSkill(`---
name: test
description: [unclosed bracket
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.frontmatterValid.passed).toBe(false);
      expect(result.checks.frontmatterValid.error).toContain('Invalid YAML');
    });

    it('fails when frontmatter is empty', async () => {
      const skillPath = await createSkill(`---
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.frontmatterValid.passed).toBe(false);
      expect(result.checks.frontmatterValid.error).toContain('empty');
    });
  });

  describe('required fields check', () => {
    it('fails when name is missing', async () => {
      const skillPath = await createSkill(`---
description: Missing name field
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.requiredFields.passed).toBe(false);
      expect(result.checks.requiredFields.error).toContain('name');
    });

    it('fails when description is missing', async () => {
      const skillPath = await createSkill(`---
name: missing-description
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.requiredFields.passed).toBe(false);
      expect(result.checks.requiredFields.error).toContain('description');
    });

    it('fails when both name and description are missing', async () => {
      const skillPath = await createSkill(`---
license: MIT
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.requiredFields.passed).toBe(false);
      expect(result.checks.requiredFields.error).toContain('name');
      expect(result.checks.requiredFields.error).toContain('description');
    });
  });

  describe('allowed properties check', () => {
    it('fails when unknown property is present', async () => {
      const skillPath = await createSkill(`---
name: my-skill
description: Valid skill
unknown-field: should not be here
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.allowedProperties.passed).toBe(false);
      expect(result.checks.allowedProperties.error).toContain('unknown-field');
    });

    it('fails with multiple unknown properties', async () => {
      const skillPath = await createSkill(`---
name: my-skill
description: Valid skill
foo: bar
baz: qux
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.allowedProperties.passed).toBe(false);
      expect(result.checks.allowedProperties.error).toContain('foo');
      expect(result.checks.allowedProperties.error).toContain('baz');
    });
  });

  describe('name format check', () => {
    it('skips name format check when name is a number (non-string)', async () => {
      const skillPath = await createSkill(`---
name: 12345
description: Valid description
---

Content.
`);

      const result = await validateSkill(skillPath);

      // requiredFields passes because non-string values are considered "present"
      expect(result.checks.requiredFields.passed).toBe(true);
      // nameFormat should pass (skipped) since name is not a string
      expect(result.checks.nameFormat.passed).toBe(true);
      // skillName should be undefined when name is not a string
      expect(result.skillName).toBeUndefined();
    });

    it('skips name format check when name is an empty string', async () => {
      const skillPath = await createSkill(`---
name: ""
description: Valid description
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      // requiredFields should fail because name is empty
      expect(result.checks.requiredFields.passed).toBe(false);
      // nameFormat should pass (skipped) since name is empty
      expect(result.checks.nameFormat.passed).toBe(true);
    });

    it('fails when name has invalid format', async () => {
      const skillPath = await createSkill(`---
name: MySkill
description: Name has uppercase
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.nameFormat.passed).toBe(false);
      expect(result.checks.nameFormat.error).toContain('lowercase');
    });

    it('fails when name contains reserved word', async () => {
      const skillPath = await createSkill(`---
name: claude-helper
description: Contains reserved word
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.nameFormat.passed).toBe(false);
      expect(result.checks.nameFormat.error).toContain('reserved word');
    });

    it('skips name format check when name is missing (avoids duplicate error)', async () => {
      const skillPath = await createSkill(`---
description: No name field
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      // requiredFields should fail
      expect(result.checks.requiredFields.passed).toBe(false);
      // nameFormat should pass (skipped) to avoid duplicate error
      expect(result.checks.nameFormat.passed).toBe(true);
      // Only one error about missing name
      expect(result.errors.filter((e) => e.includes('name'))).toHaveLength(1);
    });
  });

  describe('description format check', () => {
    it('skips description format check when description is a number (non-string)', async () => {
      const skillPath = await createSkill(`---
name: valid-skill
description: 12345
---

Content.
`);

      const result = await validateSkill(skillPath);

      // requiredFields passes because non-string values are considered "present"
      expect(result.checks.requiredFields.passed).toBe(true);
      // descriptionFormat should pass (skipped) since description is not a string
      expect(result.checks.descriptionFormat.passed).toBe(true);
    });

    it('skips description format check when description is an empty string', async () => {
      const skillPath = await createSkill(`---
name: valid-skill
description: ""
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      // requiredFields should fail because description is empty
      expect(result.checks.requiredFields.passed).toBe(false);
      // descriptionFormat should pass (skipped) since description is empty
      expect(result.checks.descriptionFormat.passed).toBe(true);
    });

    it('fails when description has angle brackets', async () => {
      const skillPath = await createSkill(`---
name: my-skill
description: Contains <script> tags
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.descriptionFormat.passed).toBe(false);
      expect(result.checks.descriptionFormat.error).toContain('angle brackets');
    });

    it('fails when description exceeds max length', async () => {
      const longDescription = 'x'.repeat(1025);
      const skillPath = await createSkill(`---
name: my-skill
description: ${longDescription}
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.checks.descriptionFormat.passed).toBe(false);
      expect(result.checks.descriptionFormat.error).toContain('1024 characters');
    });

    it('skips description format check when description is missing', async () => {
      const skillPath = await createSkill(`---
name: my-skill
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      // requiredFields should fail
      expect(result.checks.requiredFields.passed).toBe(false);
      // descriptionFormat should pass (skipped)
      expect(result.checks.descriptionFormat.passed).toBe(true);
    });
  });

  describe('multiple errors', () => {
    it('collects all errors when multiple checks fail', async () => {
      const skillPath = await createSkill(`---
name: My-Invalid-Skill
description: Has <angle> brackets
unknown-field: extra
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.checks.nameFormat.passed).toBe(false);
      expect(result.checks.descriptionFormat.passed).toBe(false);
      expect(result.checks.allowedProperties.passed).toBe(false);
    });

    it('provides all error messages in errors array', async () => {
      const skillPath = await createSkill(`---
name: Invalid Name
description: <bad>
extra: field
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result.valid).toBe(false);
      // Should have errors for name format, description format, and allowed properties
      expect(result.errors.length).toBe(3);
    });
  });

  describe('result structure', () => {
    it('returns correct structure for valid skill', async () => {
      const skillPath = await createSkill(`---
name: valid-skill
description: Valid description
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(result).toMatchObject({
        valid: true,
        skillName: 'valid-skill',
        errors: [],
      });
      expect(result.skillPath).toBeDefined();
      expect(result.checks).toBeDefined();
      expect(Object.keys(result.checks)).toEqual([
        'fileExists',
        'frontmatterValid',
        'requiredFields',
        'allowedProperties',
        'nameFormat',
        'descriptionFormat',
      ]);
    });

    it('returns resolved path in skillPath', async () => {
      const skillPath = await createSkill(`---
name: path-test
description: Test path resolution
---

Content.
`);

      const result = await validateSkill(skillPath);

      expect(path.isAbsolute(result.skillPath)).toBe(true);
      expect(result.skillPath).toContain('SKILL.md');
    });
  });
});
