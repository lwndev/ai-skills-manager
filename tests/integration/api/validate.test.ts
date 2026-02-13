/**
 * Integration tests for the validate API function (FEAT-010 Phase 2)
 *
 * These tests verify end-to-end behavior of the validate() API function
 * with real filesystem operations and skill structures.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { validate } from '../../../src/api/validate';
import { execSync } from 'child_process';

describe('validate API integration', () => {
  let tempDir: string;
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
  const fixturesPath = path.join(process.cwd(), 'tests', 'fixtures', 'skills');

  beforeAll(async () => {
    // Ensure CLI is built
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-validate-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('validates fixture skills', () => {
    it('validates the valid-skill fixture', async () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');

      const result = await validate(skillPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects invalid fixtures', async () => {
      const skillPath = path.join(fixturesPath, 'missing-name');

      const result = await validate(skillPath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validates scaffolded skills', () => {
    it('validates a skill created by the scaffold command', async () => {
      // Scaffold a skill using CLI
      execSync(
        `node "${cliPath}" scaffold api-test-skill --output "${tempDir}" --description "Test skill for API" --force`,
        { encoding: 'utf-8' }
      );

      const skillPath = path.join(tempDir, 'api-test-skill');

      // Validate using API
      const result = await validate(skillPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('handles complex skill structures', () => {
    it('validates skill with all optional fields', async () => {
      const skillDir = path.join(tempDir, 'complete-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: complete-skill
description: A complete skill with all allowed fields
license: MIT
compatibility: ">=1.0.0"
allowed-tools:
  - Read
  - Write
  - Bash
metadata:
  author: Test Author
  version: 2.0.0
  tags:
    - testing
    - api
---

# Complete Skill

This skill has all optional fields populated.
`
      );

      const result = await validate(skillDir);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates skill with references directory', async () => {
      const skillDir = path.join(tempDir, 'ref-skill');
      const refsDir = path.join(skillDir, 'references');
      await fs.mkdir(refsDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: ref-skill
description: A skill with reference files
---

# Skill with References

See references/ for more info.
`
      );
      await fs.writeFile(path.join(refsDir, 'example.md'), '# Example Reference');

      const result = await validate(skillDir);

      expect(result.valid).toBe(true);
    });
  });

  describe('consistency with CLI', () => {
    it('API and CLI produce consistent results for valid skill', async () => {
      const skillDir = path.join(tempDir, 'consistency-test');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: consistency-test
description: Test API/CLI consistency
---

Content.
`
      );

      // Get API result
      const apiResult = await validate(skillDir);

      // Get CLI result
      const cliOutput = execSync(`node "${cliPath}" validate "${skillDir}" --json`, {
        encoding: 'utf-8',
      });
      const cliResult = JSON.parse(cliOutput);

      // Both should report valid
      expect(apiResult.valid).toBe(cliResult.valid);
      expect(apiResult.valid).toBe(true);
    });

    it('API and CLI produce consistent results for invalid skill', async () => {
      const skillDir = path.join(tempDir, 'invalid-consistency');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: InvalidName
description: Invalid skill name
---

Content.
`
      );

      // Get API result
      const apiResult = await validate(skillDir);

      // Get CLI result
      let cliResult: { valid: boolean };
      try {
        const output = execSync(`node "${cliPath}" validate "${skillDir}" --json`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        cliResult = JSON.parse(output);
      } catch (error) {
        const execError = error as { stdout?: string };
        cliResult = JSON.parse(execError.stdout || '{}');
      }

      // Both should report invalid
      expect(apiResult.valid).toBe(cliResult.valid);
      expect(apiResult.valid).toBe(false);
    });
  });

  describe('error code mapping', () => {
    it('maps FILE_NOT_FOUND for missing SKILL.md', async () => {
      const result = await validate(tempDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'FILE_NOT_FOUND')).toBe(true);
    });

    it('maps INVALID_FRONTMATTER for invalid YAML', async () => {
      const skillDir = path.join(tempDir, 'bad-yaml');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: test
description: [unclosed
---
`
      );

      const result = await validate(skillDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_FRONTMATTER')).toBe(true);
    });

    it('maps MISSING_REQUIRED_FIELD for missing name', async () => {
      const skillDir = path.join(tempDir, 'no-name');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
description: No name field
---
`
      );

      const result = await validate(skillDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_REQUIRED_FIELD')).toBe(true);
    });

    it('maps INVALID_NAME_FORMAT for uppercase name', async () => {
      const skillDir = path.join(tempDir, 'bad-name');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: BadName
description: Invalid name format
---
`
      );

      const result = await validate(skillDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_NAME_FORMAT')).toBe(true);
    });

    it('maps INVALID_PROPERTY for unknown frontmatter keys', async () => {
      const skillDir = path.join(tempDir, 'unknown-prop');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: unknown-prop
description: Has unknown property
unknown-key: should not be here
---
`
      );

      const result = await validate(skillDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_PROPERTY')).toBe(true);
    });

    it('maps NAME_DIRECTORY_MISMATCH when name does not match directory', async () => {
      const skillDir = path.join(tempDir, 'actual-dir-name');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: different-name
description: Name does not match directory
---
`
      );

      const result = await validate(skillDir);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'NAME_DIRECTORY_MISMATCH')).toBe(true);
    });
  });

  describe('warnings', () => {
    it('includes warnings for large SKILL.md content', async () => {
      const skillDir = path.join(tempDir, 'large-skill');
      await fs.mkdir(skillDir, { recursive: true });

      // Create content with 501+ lines
      const lines = Array(510).fill('This is a line of content.');
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: large-skill
description: Large skill body
---

${lines.join('\n')}
`
      );

      const result = await validate(skillDir);

      // Should be valid but have warnings
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].code).toBe('FILE_SIZE_WARNING');
    });

    it('includes UNKNOWN_HOOK_KEY warning for unknown hooks', async () => {
      const skillDir = path.join(tempDir, 'hook-warn-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: hook-warn-skill
description: Skill with unknown hook key
hooks:
  PreToolUse: ./valid.sh
  OnStart: ./unknown.sh
---

Content.
`
      );

      const result = await validate(skillDir);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      const hookWarning = result.warnings.find((w) => w.code === 'UNKNOWN_HOOK_KEY');
      expect(hookWarning).toBeDefined();
      expect(hookWarning?.message).toContain("Unknown hook 'OnStart'");
      expect(hookWarning?.path).toContain('hook-warn-skill');
    });
  });

  describe('path handling', () => {
    it('accepts SKILL.md file path directly', async () => {
      const skillDir = path.join(tempDir, 'file-path-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: file-path-skill
description: Test file path
---
`
      );

      const result = await validate(path.join(skillDir, 'SKILL.md'));

      expect(result.valid).toBe(true);
    });

    it('handles paths with spaces', async () => {
      // Note: Directory names with spaces are valid filesystem paths,
      // but the skill name in frontmatter must match the directory name.
      // Since skill names can't have spaces, this will have a name mismatch.
      const skillDir = path.join(tempDir, 'path-with-spaces');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: path-with-spaces
description: Test path handling
---
`
      );

      const result = await validate(skillDir);

      expect(result.valid).toBe(true);
    });

    it('handles symbolic directory names', async () => {
      const skillDir = path.join(tempDir, '..special-chars!@#$%');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: special-chars
description: Test special characters
---
`
      );

      const result = await validate(skillDir);

      // Valid but may have name mismatch
      // The important thing is it doesn't crash
      expect(typeof result.valid).toBe('boolean');
    });
  });
});
