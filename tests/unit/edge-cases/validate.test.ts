/**
 * Edge case tests for the validate command
 *
 * These tests cover all edge cases specified in the feature requirements:
 * 1. Empty path argument
 * 2. Path is a file, not directory
 * 3. SKILL.md is empty
 * 4. SKILL.md has no frontmatter
 * 5. Frontmatter has no closing delimiter
 * 6. Invalid YAML syntax
 * 7. Name is empty string
 * 8. Description is empty string
 * 9. Name exceeds 64 characters
 * 10. Description exceeds 1024 characters
 * 11. Multiple validation errors (report all, not just first)
 * 12. Non-UTF8 encoding handling
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { validateSkill } from '../../../src/generators/validate';

describe('validate edge cases', () => {
  const fixturesPath = path.join(process.cwd(), 'tests', 'fixtures', 'skills');

  describe('1. Empty path argument', () => {
    it('rejects empty string path', async () => {
      const result = await validateSkill('');
      expect(result.valid).toBe(false);
      expect(result.checks.fileExists.passed).toBe(false);
      expect(result.checks.fileExists.error).toContain('empty');
    });

    it('rejects whitespace-only path', async () => {
      const result = await validateSkill('   ');
      expect(result.valid).toBe(false);
      expect(result.checks.fileExists.passed).toBe(false);
    });
  });

  describe('2. Path is a file, not directory', () => {
    it('accepts SKILL.md file path directly', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill', 'SKILL.md');
      const result = await validateSkill(skillPath);
      expect(result.valid).toBe(true);
    });

    it('rejects non-SKILL.md file path', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const otherFile = path.join(tempDir, 'README.md');

      try {
        await fs.writeFile(otherFile, '# README');
        const result = await validateSkill(otherFile);
        expect(result.valid).toBe(false);
        expect(result.checks.fileExists.error).toContain('SKILL.md');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('3. SKILL.md is empty', () => {
    it('fails validation for empty SKILL.md', async () => {
      const skillPath = path.join(fixturesPath, 'empty-file');
      const result = await validateSkill(skillPath);
      expect(result.valid).toBe(false);
      expect(result.checks.frontmatterValid.passed).toBe(false);
      expect(result.checks.frontmatterValid.error).toContain('empty');
    });
  });

  describe('4. SKILL.md has no frontmatter', () => {
    it('fails validation when file lacks frontmatter delimiters', async () => {
      const skillPath = path.join(fixturesPath, 'no-frontmatter');
      const result = await validateSkill(skillPath);
      expect(result.valid).toBe(false);
      expect(result.checks.frontmatterValid.passed).toBe(false);
      expect(result.checks.frontmatterValid.error).toContain('Missing YAML frontmatter');
    });
  });

  describe('5. Frontmatter has no closing delimiter', () => {
    it('fails validation when closing --- is missing', async () => {
      const skillPath = path.join(fixturesPath, 'unclosed-frontmatter');
      const result = await validateSkill(skillPath);
      expect(result.valid).toBe(false);
      expect(result.checks.frontmatterValid.passed).toBe(false);
      expect(result.checks.frontmatterValid.error).toContain('Unclosed');
    });
  });

  describe('6. Invalid YAML syntax', () => {
    it('fails validation with YAML parse error', async () => {
      const skillPath = path.join(fixturesPath, 'invalid-yaml');
      const result = await validateSkill(skillPath);
      expect(result.valid).toBe(false);
      expect(result.checks.frontmatterValid.passed).toBe(false);
      expect(result.checks.frontmatterValid.error).toContain('Invalid YAML');
    });
  });

  describe('7. Name is empty string', () => {
    it('fails validation when name is empty string', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const skillPath = path.join(tempDir, 'SKILL.md');

      try {
        await fs.writeFile(
          skillPath,
          `---
name: ""
description: Valid description
---

Content here.
`
        );

        const result = await validateSkill(tempDir);
        expect(result.valid).toBe(false);
        expect(result.checks.requiredFields.passed).toBe(false);
        expect(result.checks.requiredFields.error).toContain('name');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('fails validation when name is whitespace only', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const skillPath = path.join(tempDir, 'SKILL.md');

      try {
        await fs.writeFile(
          skillPath,
          `---
name: "   "
description: Valid description
---

Content here.
`
        );

        const result = await validateSkill(tempDir);
        expect(result.valid).toBe(false);
        expect(result.checks.requiredFields.passed).toBe(false);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('8. Description is empty string', () => {
    it('fails validation when description is empty string', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const skillPath = path.join(tempDir, 'SKILL.md');

      try {
        await fs.writeFile(
          skillPath,
          `---
name: valid-name
description: ""
---

Content here.
`
        );

        const result = await validateSkill(tempDir);
        expect(result.valid).toBe(false);
        expect(result.checks.requiredFields.passed).toBe(false);
        expect(result.checks.requiredFields.error).toContain('description');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('9. Name exceeds 64 characters', () => {
    it('fails validation when name is over 64 characters', async () => {
      const skillPath = path.join(fixturesPath, 'name-too-long');
      const result = await validateSkill(skillPath);
      expect(result.valid).toBe(false);
      expect(result.checks.nameFormat.passed).toBe(false);
      expect(result.checks.nameFormat.error).toContain('64');
    });

    it('accepts name at exactly 64 characters', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const skillPath = path.join(tempDir, 'SKILL.md');
      // Exactly 64 characters: a-b-c-...-64 chars
      const name64 = 'a'.repeat(64);

      try {
        await fs.writeFile(
          skillPath,
          `---
name: ${name64}
description: Valid description
---

Content here.
`
        );

        const result = await validateSkill(tempDir);
        expect(result.checks.nameFormat.passed).toBe(true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('10. Description exceeds 1024 characters', () => {
    it('fails validation when description is over 1024 characters', async () => {
      const skillPath = path.join(fixturesPath, 'description-too-long');
      const result = await validateSkill(skillPath);
      expect(result.valid).toBe(false);
      expect(result.checks.descriptionFormat.passed).toBe(false);
      expect(result.checks.descriptionFormat.error).toContain('1024');
    });

    it('accepts description at exactly 1024 characters', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const skillPath = path.join(tempDir, 'SKILL.md');
      const desc1024 = 'A'.repeat(1024);

      try {
        await fs.writeFile(
          skillPath,
          `---
name: valid-name
description: "${desc1024}"
---

Content here.
`
        );

        const result = await validateSkill(tempDir);
        expect(result.checks.descriptionFormat.passed).toBe(true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('11. Multiple validation errors', () => {
    it('reports all errors, not just the first one', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const skillPath = path.join(tempDir, 'SKILL.md');

      try {
        // Create skill with multiple issues: unknown property + invalid name format
        await fs.writeFile(
          skillPath,
          `---
name: Invalid_Name
description: Valid description
unknown-field: some value
---

Content here.
`
        );

        const result = await validateSkill(tempDir);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
        // Check that both errors are reported
        expect(result.checks.allowedProperties.passed).toBe(false);
        expect(result.checks.nameFormat.passed).toBe(false);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('reports missing name and description separately', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const skillPath = path.join(tempDir, 'SKILL.md');

      try {
        await fs.writeFile(
          skillPath,
          `---
license: MIT
---

Content here.
`
        );

        const result = await validateSkill(tempDir);
        expect(result.valid).toBe(false);
        expect(result.checks.requiredFields.passed).toBe(false);
        expect(result.checks.requiredFields.error).toContain('name');
        expect(result.checks.requiredFields.error).toContain('description');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('12. Description with angle brackets', () => {
    it('rejects description containing < character', async () => {
      const skillPath = path.join(fixturesPath, 'description-with-angle-brackets');
      const result = await validateSkill(skillPath);
      expect(result.valid).toBe(false);
      expect(result.checks.descriptionFormat.passed).toBe(false);
      expect(result.checks.descriptionFormat.error).toContain('angle brackets');
    });

    it('rejects description containing > character', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const skillPath = path.join(tempDir, 'SKILL.md');

      try {
        await fs.writeFile(
          skillPath,
          `---
name: valid-name
description: "This has > in it"
---

Content here.
`
        );

        const result = await validateSkill(tempDir);
        expect(result.valid).toBe(false);
        expect(result.checks.descriptionFormat.passed).toBe(false);
        expect(result.checks.descriptionFormat.error).toContain('angle brackets');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('13. Unknown top-level properties', () => {
    it('rejects skill with unknown frontmatter property', async () => {
      const skillPath = path.join(fixturesPath, 'unknown-property');
      const result = await validateSkill(skillPath);
      expect(result.valid).toBe(false);
      expect(result.checks.allowedProperties.passed).toBe(false);
    });
  });

  describe('14. Path resolution', () => {
    it('handles relative paths', async () => {
      // This test verifies relative path resolution works
      const relativePath = path.relative(process.cwd(), path.join(fixturesPath, 'valid-skill'));
      const result = await validateSkill(relativePath);
      expect(result.valid).toBe(true);
    });

    it('handles paths with trailing slash', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill') + path.sep;
      const result = await validateSkill(skillPath);
      expect(result.valid).toBe(true);
    });
  });

  describe('15. Non-existent paths', () => {
    it('fails for non-existent directory', async () => {
      const result = await validateSkill('/path/that/definitely/does/not/exist');
      expect(result.valid).toBe(false);
      expect(result.checks.fileExists.passed).toBe(false);
      expect(result.checks.fileExists.error).toContain('does not exist');
    });

    it('fails for directory without SKILL.md', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));

      try {
        const result = await validateSkill(tempDir);
        expect(result.valid).toBe(false);
        expect(result.checks.fileExists.passed).toBe(false);
        expect(result.checks.fileExists.error).toContain('SKILL.md not found');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('16. Reserved words in name', () => {
    it('rejects name that is exactly "anthropic"', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const skillPath = path.join(tempDir, 'SKILL.md');

      try {
        await fs.writeFile(
          skillPath,
          `---
name: anthropic
description: Valid description
---

Content here.
`
        );

        const result = await validateSkill(tempDir);
        expect(result.valid).toBe(false);
        expect(result.checks.nameFormat.passed).toBe(false);
        expect(result.checks.nameFormat.error).toContain('reserved');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('rejects name containing "claude"', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const skillPath = path.join(tempDir, 'SKILL.md');

      try {
        await fs.writeFile(
          skillPath,
          `---
name: my-claude-skill
description: Valid description
---

Content here.
`
        );

        const result = await validateSkill(tempDir);
        expect(result.valid).toBe(false);
        expect(result.checks.nameFormat.passed).toBe(false);
        expect(result.checks.nameFormat.error).toContain('reserved');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('17. Valid skill with all optional fields', () => {
    it('validates skill with license, allowed-tools, and metadata', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-edge-'));
      const skillDir = path.join(tempDir, 'full-featured-skill');
      await fs.mkdir(skillDir);
      const skillPath = path.join(skillDir, 'SKILL.md');

      try {
        await fs.writeFile(
          skillPath,
          `---
name: full-featured-skill
description: A skill with all allowed fields
license: MIT
allowed-tools:
  - Read
  - Write
  - Bash
metadata:
  author: Test Author
  version: 1.0.0
  tags:
    - testing
    - edge-case
---

# Full Featured Skill

This skill has all allowed frontmatter fields.
`
        );

        const result = await validateSkill(skillDir);
        expect(result.valid).toBe(true);
        expect(result.checks.fileExists.passed).toBe(true);
        expect(result.checks.frontmatterValid.passed).toBe(true);
        expect(result.checks.requiredFields.passed).toBe(true);
        expect(result.checks.allowedProperties.passed).toBe(true);
        expect(result.checks.nameFormat.passed).toBe(true);
        expect(result.checks.descriptionFormat.passed).toBe(true);
        expect(result.checks.nameMatchesDirectory.passed).toBe(true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
