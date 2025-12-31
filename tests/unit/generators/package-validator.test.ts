import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { validateForPackaging } from '../../../src/generators/package-validator';

describe('validateForPackaging', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'package-validator-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a valid skill directory with SKILL.md
   */
  async function createValidSkill(dirName: string = 'test-skill'): Promise<string> {
    const skillDir = path.join(tempDir, dirName);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      `---
name: ${dirName}
description: A test skill for validation
---

# ${dirName}

This is a test skill.
`
    );
    return skillDir;
  }

  /**
   * Helper to create an invalid skill directory
   */
  async function createInvalidSkill(dirName: string = 'invalid-skill'): Promise<string> {
    const skillDir = path.join(tempDir, dirName);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      `---
name: Invalid Name With Spaces
description: Has <invalid> characters
unknown-field: should not exist
---

# Invalid Skill
`
    );
    return skillDir;
  }

  describe('path validation', () => {
    it('fails when path does not exist', async () => {
      const result = await validateForPackaging('/nonexistent/path');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('does not exist');
      expect(result.skillDir).toBeUndefined();
    });

    it('fails when path is empty', async () => {
      const result = await validateForPackaging('');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('cannot be empty');
    });

    it('fails when SKILL.md is missing', async () => {
      const emptyDir = path.join(tempDir, 'empty-dir');
      await fs.mkdir(emptyDir);

      const result = await validateForPackaging(emptyDir);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('SKILL.md not found');
    });

    it('returns valid path info when path is valid', async () => {
      const skillDir = await createValidSkill('path-test');

      const result = await validateForPackaging(skillDir);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBe(skillDir);
      expect(result.skillFilePath).toBe(path.join(skillDir, 'SKILL.md'));
    });
  });

  describe('with validation enabled (default)', () => {
    it('validates a valid skill successfully', async () => {
      const skillDir = await createValidSkill('valid-skill');

      const result = await validateForPackaging(skillDir);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBe(skillDir);
      expect(result.skillName).toBe('valid-skill');
      expect(result.errors).toEqual([]);
      expect(result.validationSkipped).toBe(false);
      expect(result.validationResult).toBeDefined();
    });

    it('fails when skill has validation errors', async () => {
      const skillDir = await createInvalidSkill('bad-skill');

      const result = await validateForPackaging(skillDir);

      expect(result.valid).toBe(false);
      expect(result.skillDir).toBe(skillDir);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.validationSkipped).toBe(false);
      expect(result.validationResult).toBeDefined();
      expect(result.validationResult?.valid).toBe(false);
    });

    it('includes validation errors in result', async () => {
      const skillDir = await createInvalidSkill('error-skill');

      const result = await validateForPackaging(skillDir);

      expect(result.valid).toBe(false);
      // Should have errors for name format, description format, and unknown field
      expect(result.errors.some((e) => e.includes('lowercase') || e.includes('Invalid Name'))).toBe(
        true
      );
    });

    it('extracts skill name from valid frontmatter', async () => {
      const skillDir = await createValidSkill('named-skill');

      const result = await validateForPackaging(skillDir);

      expect(result.valid).toBe(true);
      expect(result.skillName).toBe('named-skill');
    });
  });

  describe('with validation skipped (skipValidation=true)', () => {
    it('succeeds with valid path even if content would fail validation', async () => {
      const skillDir = await createInvalidSkill('skip-validation-skill');

      const result = await validateForPackaging(skillDir, true);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBe(skillDir);
      expect(result.errors).toEqual([]);
      expect(result.validationSkipped).toBe(true);
      expect(result.validationResult).toBeUndefined();
    });

    it('still fails when path is invalid', async () => {
      const result = await validateForPackaging('/nonexistent/path', true);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('does not exist');
      expect(result.validationSkipped).toBe(true);
    });

    it('returns path info without skill name', async () => {
      const skillDir = await createValidSkill('skip-skill');

      const result = await validateForPackaging(skillDir, true);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBe(skillDir);
      expect(result.skillFilePath).toBe(path.join(skillDir, 'SKILL.md'));
      // When validation is skipped, skillName is not extracted
      expect(result.skillName).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles skill with missing name field', async () => {
      const skillDir = path.join(tempDir, 'no-name-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
description: Missing name field
---

Content.
`
      );

      const result = await validateForPackaging(skillDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
    });

    it('handles skill with missing description field', async () => {
      const skillDir = path.join(tempDir, 'no-desc-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: no-desc
---

Content.
`
      );

      const result = await validateForPackaging(skillDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('description'))).toBe(true);
    });

    it('handles path pointing to SKILL.md file directly', async () => {
      const skillDir = await createValidSkill('direct-path-skill');
      const skillFilePath = path.join(skillDir, 'SKILL.md');

      const result = await validateForPackaging(skillFilePath);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBe(skillDir);
      expect(result.skillFilePath).toBe(skillFilePath);
    });

    it('handles relative path', async () => {
      const skillDir = await createValidSkill('relative-path-skill');
      const cwd = process.cwd();
      const relativePath = path.relative(cwd, skillDir);

      const result = await validateForPackaging(relativePath);

      expect(result.valid).toBe(true);
      expect(result.skillDir).toBeDefined();
      expect(path.isAbsolute(result.skillDir as string)).toBe(true);
    });

    it('handles skill with empty frontmatter', async () => {
      const skillDir = path.join(tempDir, 'empty-frontmatter');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
---

Content.
`
      );

      const result = await validateForPackaging(skillDir);

      expect(result.valid).toBe(false);
      // Should fail with frontmatter validation error
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles skill with no frontmatter', async () => {
      const skillDir = path.join(tempDir, 'no-frontmatter');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `# Just Markdown

No frontmatter here.
`
      );

      const result = await validateForPackaging(skillDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('YAML') || e.includes('frontmatter'))).toBe(true);
    });
  });

  describe('result structure', () => {
    it('returns correct structure for valid skill', async () => {
      const skillDir = await createValidSkill('structure-test');

      const result = await validateForPackaging(skillDir);

      expect(result).toMatchObject({
        valid: true,
        skillDir: skillDir,
        skillFilePath: path.join(skillDir, 'SKILL.md'),
        skillName: 'structure-test',
        errors: [],
        validationSkipped: false,
      });
      expect(result.validationResult).toBeDefined();
    });

    it('returns correct structure for invalid skill', async () => {
      const skillDir = await createInvalidSkill('invalid-structure');

      const result = await validateForPackaging(skillDir);

      expect(result.valid).toBe(false);
      expect(result.skillDir).toBe(skillDir);
      expect(result.skillFilePath).toBe(path.join(skillDir, 'SKILL.md'));
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.validationSkipped).toBe(false);
      expect(result.validationResult).toBeDefined();
    });

    it('returns correct structure when validation skipped', async () => {
      const skillDir = await createValidSkill('skipped-structure');

      const result = await validateForPackaging(skillDir, true);

      expect(result).toMatchObject({
        valid: true,
        skillDir: skillDir,
        skillFilePath: path.join(skillDir, 'SKILL.md'),
        errors: [],
        validationSkipped: true,
      });
      expect(result.skillName).toBeUndefined();
      expect(result.validationResult).toBeUndefined();
    });
  });
});
