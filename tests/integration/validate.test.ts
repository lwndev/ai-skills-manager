/**
 * Integration tests for the validate command
 *
 * These tests run the full validate workflow to verify end-to-end functionality.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('validate command integration', () => {
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
  const fixturesPath = path.join(process.cwd(), 'tests', 'fixtures', 'skills');

  beforeAll(async () => {
    // Ensure the CLI is built
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  describe('valid skill validation', () => {
    it('validates a valid skill successfully', () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const result = execSync(`node "${cliPath}" validate "${skillPath}"`, {
        encoding: 'utf-8',
      });

      expect(result).toContain('✓ File existence');
      expect(result).toContain('✓ Frontmatter validity');
      expect(result).toContain('✓ Required fields');
      expect(result).toContain('✓ Allowed properties');
      expect(result).toContain('✓ Name format');
      expect(result).toContain('✓ Description format');
      expect(result).toContain('✓ Skill is valid!');
    });

    it('validates skill when given SKILL.md file path', () => {
      const skillPath = path.join(fixturesPath, 'valid-skill', 'SKILL.md');
      const result = execSync(`node "${cliPath}" validate "${skillPath}"`, {
        encoding: 'utf-8',
      });

      expect(result).toContain('✓ Skill is valid!');
    });

    it('returns exit code 0 for valid skill', () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const exitCode = (() => {
        try {
          execSync(`node "${cliPath}" validate "${skillPath}"`, {
            encoding: 'utf-8',
            stdio: 'pipe',
          });
          return 0;
        } catch (error) {
          const execError = error as { status?: number };
          return execError.status || 1;
        }
      })();

      expect(exitCode).toBe(0);
    });
  });

  describe('invalid skill validation', () => {
    it('detects missing name field', () => {
      const skillPath = path.join(fixturesPath, 'missing-name');

      try {
        execSync(`node "${cliPath}" validate "${skillPath}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        throw new Error('Should have thrown an error');
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        const output = execError.stdout || execError.stderr || '';
        expect(output).toContain('✗ Error: Required fields');
        expect(output).toContain('Missing required field: name');
        expect(execError.status).toBe(1);
      }
    });

    it('detects missing description field', () => {
      const skillPath = path.join(fixturesPath, 'missing-description');

      try {
        execSync(`node "${cliPath}" validate "${skillPath}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        throw new Error('Should have thrown an error');
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        const output = execError.stdout || execError.stderr || '';
        expect(output).toContain('✗ Error: Required fields');
        expect(output).toContain('Missing required field: description');
        expect(execError.status).toBe(1);
      }
    });

    it('detects invalid YAML frontmatter', () => {
      const skillPath = path.join(fixturesPath, 'invalid-yaml');

      try {
        execSync(`node "${cliPath}" validate "${skillPath}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        throw new Error('Should have thrown an error');
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        const output = execError.stdout || execError.stderr || '';
        expect(output).toContain('✗ Error: Frontmatter validity');
        expect(execError.status).toBe(1);
      }
    });

    it('detects invalid name format', () => {
      const skillPath = path.join(fixturesPath, 'invalid-name-format');

      try {
        execSync(`node "${cliPath}" validate "${skillPath}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        throw new Error('Should have thrown an error');
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        const output = execError.stdout || execError.stderr || '';
        expect(output).toContain('✗ Error: Name format');
        expect(output).toContain('lowercase');
        expect(execError.status).toBe(1);
      }
    });

    it('detects unknown properties', () => {
      const skillPath = path.join(fixturesPath, 'unknown-property');

      try {
        execSync(`node "${cliPath}" validate "${skillPath}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        throw new Error('Should have thrown an error');
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        const output = execError.stdout || execError.stderr || '';
        expect(output).toContain('✗ Error: Allowed properties');
        expect(output).toContain('unknown-field');
        expect(execError.status).toBe(1);
      }
    });

    it('returns exit code 1 for invalid skill', () => {
      const skillPath = path.join(fixturesPath, 'missing-name');
      const exitCode = (() => {
        try {
          execSync(`node "${cliPath}" validate "${skillPath}"`, {
            encoding: 'utf-8',
            stdio: 'pipe',
          });
          return 0;
        } catch (error) {
          const execError = error as { status?: number };
          return execError.status || 1;
        }
      })();

      expect(exitCode).toBe(1);
    });
  });

  describe('output formats', () => {
    it('supports --quiet flag for valid skill', () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const result = execSync(`node "${cliPath}" validate "${skillPath}" --quiet`, {
        encoding: 'utf-8',
      });

      expect(result.trim()).toBe('PASS');
    });

    it('supports --quiet flag for invalid skill', () => {
      const skillPath = path.join(fixturesPath, 'missing-name');

      try {
        execSync(`node "${cliPath}" validate "${skillPath}" --quiet`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        throw new Error('Should have thrown an error');
      } catch (error) {
        const execError = error as { stdout?: string; status?: number };
        const output = execError.stdout || '';
        expect(output.trim()).toMatch(/FAIL: \d+ error\(s\)/);
        expect(execError.status).toBe(1);
      }
    });

    it('supports --json flag for valid skill', () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const result = execSync(`node "${cliPath}" validate "${skillPath}" --json`, {
        encoding: 'utf-8',
      });

      const parsed = JSON.parse(result);
      expect(parsed.valid).toBe(true);
      expect(parsed.skillName).toBe('valid-skill');
      expect(parsed.checks.fileExists.passed).toBe(true);
      expect(parsed.checks.frontmatterValid.passed).toBe(true);
      expect(parsed.checks.requiredFields.passed).toBe(true);
      expect(parsed.checks.allowedProperties.passed).toBe(true);
      expect(parsed.checks.nameFormat.passed).toBe(true);
      expect(parsed.checks.descriptionFormat.passed).toBe(true);
      expect(parsed.errors).toEqual([]);
    });

    it('supports --json flag for invalid skill', () => {
      const skillPath = path.join(fixturesPath, 'missing-name');

      try {
        execSync(`node "${cliPath}" validate "${skillPath}" --json`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        throw new Error('Should have thrown an error');
      } catch (error) {
        const execError = error as { stdout?: string; status?: number };
        const output = execError.stdout || '';
        const parsed = JSON.parse(output);

        expect(parsed.valid).toBe(false);
        expect(parsed.checks.requiredFields.passed).toBe(false);
        expect(parsed.checks.requiredFields.error).toContain('name');
        expect(parsed.errors.length).toBeGreaterThan(0);
        expect(execError.status).toBe(1);
      }
    });

    it('supports -q shorthand for --quiet', () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const result = execSync(`node "${cliPath}" validate "${skillPath}" -q`, {
        encoding: 'utf-8',
      });

      expect(result.trim()).toBe('PASS');
    });

    it('supports -j shorthand for --json', () => {
      const skillPath = path.join(fixturesPath, 'valid-skill');
      const result = execSync(`node "${cliPath}" validate "${skillPath}" -j`, {
        encoding: 'utf-8',
      });

      const parsed = JSON.parse(result);
      expect(parsed.valid).toBe(true);
    });
  });

  describe('error handling', () => {
    it('handles non-existent path', () => {
      const nonExistentPath = '/path/that/does/not/exist';

      try {
        execSync(`node "${cliPath}" validate "${nonExistentPath}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        throw new Error('Should have thrown an error');
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        const output = execError.stdout || execError.stderr || '';
        expect(output).toContain('✗ Error: File existence');
        expect(execError.status).toBe(1);
      }
    });

    it('handles path without SKILL.md', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-validate-'));

      try {
        execSync(`node "${cliPath}" validate "${tempDir}"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        throw new Error('Should have thrown an error');
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; status?: number };
        const output = execError.stdout || execError.stderr || '';
        expect(output).toContain('✗ Error: File existence');
        expect(execError.status).toBe(1);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('handles empty SKILL.md file', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-validate-'));
      const skillMdPath = path.join(tempDir, 'SKILL.md');

      try {
        await fs.writeFile(skillMdPath, '');

        const exitCode = (() => {
          try {
            execSync(`node "${cliPath}" validate "${tempDir}"`, {
              encoding: 'utf-8',
              stdio: 'pipe',
            });
            return 0;
          } catch (error) {
            const execError = error as { status?: number };
            return execError.status || 1;
          }
        })();

        expect(exitCode).toBe(1);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('help and usage', () => {
    it('displays help with --help flag', () => {
      const result = execSync(`node "${cliPath}" validate --help`, {
        encoding: 'utf-8',
      });

      expect(result).toContain('Validate a Claude Code skill');
      expect(result).toContain('--quiet');
      expect(result).toContain('--json');
      expect(result).toContain('Examples:');
      expect(result).toContain('Validation Checks:');
      expect(result).toContain('Exit Codes:');
      expect(result).toContain('Output Formats:');
    });

    it('shows validate command in main help', () => {
      const result = execSync(`node "${cliPath}" --help`, { encoding: 'utf-8' });

      expect(result).toContain('validate');
    });
  });

  describe('real-world scenarios', () => {
    it('validates skill created by scaffold command', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));

      try {
        // Create a skill using scaffold
        execSync(
          `node "${cliPath}" scaffold test-skill --output "${tempDir}" --description "Test skill" --force`,
          { encoding: 'utf-8' }
        );

        // Validate the created skill
        const skillPath = path.join(tempDir, 'test-skill');
        const result = execSync(`node "${cliPath}" validate "${skillPath}"`, {
          encoding: 'utf-8',
        });

        expect(result).toContain('✓ Skill is valid!');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('validates skill with all optional fields', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
      const skillDir = path.join(tempDir, 'full-featured-skill');
      await fs.mkdir(skillDir);
      const skillPath = path.join(skillDir, 'SKILL.md');

      try {
        const skillContent = `---
name: full-featured-skill
description: A skill with all optional fields
license: MIT
compatibility: Claude Code 1.0+
allowed-tools:
  - Read
  - Write
metadata:
  author: Test Author
  version: 1.0.0
---

This skill has all allowed fields.
`;

        await fs.writeFile(skillPath, skillContent);

        const result = execSync(`node "${cliPath}" validate "${skillDir}"`, {
          encoding: 'utf-8',
        });

        expect(result).toContain('✓ Skill is valid!');
        expect(result).toContain('✓ Compatibility format');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('validates skill with compatibility field', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
      const skillDir = path.join(tempDir, 'compat-skill');
      await fs.mkdir(skillDir);
      const skillPath = path.join(skillDir, 'SKILL.md');

      try {
        const skillContent = `---
name: compat-skill
description: A skill with compatibility field
compatibility: ">= Claude Code 1.0"
---

Skill content.
`;

        await fs.writeFile(skillPath, skillContent);

        const result = execSync(`node "${cliPath}" validate "${skillDir}" --json`, {
          encoding: 'utf-8',
        });

        const parsed = JSON.parse(result);
        expect(parsed.valid).toBe(true);
        expect(parsed.checks.compatibilityFormat.passed).toBe(true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('detects invalid compatibility field (empty string)', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
      const skillPath = path.join(tempDir, 'SKILL.md');

      try {
        const skillContent = `---
name: compat-skill
description: A skill with empty compatibility
compatibility: ""
---

Skill content.
`;

        await fs.writeFile(skillPath, skillContent);

        try {
          execSync(`node "${cliPath}" validate "${tempDir}"`, {
            encoding: 'utf-8',
            stdio: 'pipe',
          });
          throw new Error('Should have thrown an error');
        } catch (error) {
          const execError = error as { stdout?: string; stderr?: string; status?: number };
          const output = execError.stdout || execError.stderr || '';
          expect(output).toContain('✗ Error: Compatibility format');
          expect(output).toContain('empty');
          expect(execError.status).toBe(1);
        }
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('detects compatibility field exceeding max length', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
      const skillPath = path.join(tempDir, 'SKILL.md');

      try {
        const longCompatibility = 'x'.repeat(501);
        const skillContent = `---
name: compat-skill
description: A skill with too-long compatibility
compatibility: "${longCompatibility}"
---

Skill content.
`;

        await fs.writeFile(skillPath, skillContent);

        try {
          execSync(`node "${cliPath}" validate "${tempDir}" --json`, {
            encoding: 'utf-8',
            stdio: 'pipe',
          });
          throw new Error('Should have thrown an error');
        } catch (error) {
          const execError = error as { stdout?: string; status?: number };
          const output = execError.stdout || '';
          const parsed = JSON.parse(output);

          expect(parsed.valid).toBe(false);
          expect(parsed.checks.compatibilityFormat.passed).toBe(false);
          expect(parsed.checks.compatibilityFormat.error).toContain('500 characters');
          expect(execError.status).toBe(1);
        }
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('validates skill with matching directory name', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
      const skillDir = path.join(tempDir, 'matching-skill');
      await fs.mkdir(skillDir);
      const skillPath = path.join(skillDir, 'SKILL.md');

      try {
        const skillContent = `---
name: matching-skill
description: A skill with matching directory name
---

Skill content.
`;

        await fs.writeFile(skillPath, skillContent);

        const result = execSync(`node "${cliPath}" validate "${skillDir}" --json`, {
          encoding: 'utf-8',
        });

        const parsed = JSON.parse(result);
        expect(parsed.valid).toBe(true);
        expect(parsed.checks.nameMatchesDirectory.passed).toBe(true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('detects name mismatch with directory', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
      const skillDir = path.join(tempDir, 'actual-directory');
      await fs.mkdir(skillDir);
      const skillPath = path.join(skillDir, 'SKILL.md');

      try {
        const skillContent = `---
name: different-name
description: A skill with mismatched directory name
---

Skill content.
`;

        await fs.writeFile(skillPath, skillContent);

        try {
          execSync(`node "${cliPath}" validate "${skillDir}"`, {
            encoding: 'utf-8',
            stdio: 'pipe',
          });
          throw new Error('Should have thrown an error');
        } catch (error) {
          const execError = error as { stdout?: string; stderr?: string; status?: number };
          const output = execError.stdout || execError.stderr || '';
          expect(output).toContain('✗ Error: Name matches directory');
          expect(output).toContain('different-name');
          expect(output).toContain('actual-directory');
          expect(execError.status).toBe(1);
        }
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('includes name mismatch in JSON output', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
      const skillDir = path.join(tempDir, 'dir-name');
      await fs.mkdir(skillDir);
      const skillPath = path.join(skillDir, 'SKILL.md');

      try {
        const skillContent = `---
name: skill-name
description: A skill with mismatched directory name
---

Skill content.
`;

        await fs.writeFile(skillPath, skillContent);

        try {
          execSync(`node "${cliPath}" validate "${skillDir}" --json`, {
            encoding: 'utf-8',
            stdio: 'pipe',
          });
          throw new Error('Should have thrown an error');
        } catch (error) {
          const execError = error as { stdout?: string; status?: number };
          const output = execError.stdout || '';
          const parsed = JSON.parse(output);

          expect(parsed.valid).toBe(false);
          expect(parsed.checks.nameMatchesDirectory.passed).toBe(false);
          expect(parsed.checks.nameMatchesDirectory.error).toContain('skill-name');
          expect(parsed.checks.nameMatchesDirectory.error).toContain('dir-name');
          expect(execError.status).toBe(1);
        }
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('validates skill with space-delimited allowed-tools', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
      const skillDir = path.join(tempDir, 'space-tools-skill');
      await fs.mkdir(skillDir);
      const skillPath = path.join(skillDir, 'SKILL.md');

      try {
        const skillContent = `---
name: space-tools-skill
description: A skill with space-delimited allowed-tools
allowed-tools: Read Write Bash
---

Skill content.
`;

        await fs.writeFile(skillPath, skillContent);

        const result = execSync(`node "${cliPath}" validate "${skillDir}" --json`, {
          encoding: 'utf-8',
        });

        const parsed = JSON.parse(result);
        expect(parsed.valid).toBe(true);
        // Note: The JSON output should show the normalized array format
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('shows warning for large skill body (>500 lines)', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
      const skillDir = path.join(tempDir, 'large-skill');
      await fs.mkdir(skillDir);
      const skillPath = path.join(skillDir, 'SKILL.md');

      try {
        // Create content with 501 lines
        const bodyLines = Array(501).fill('This is a line of content.');
        const skillContent = `---
name: large-skill
description: A skill with many lines
---

${bodyLines.join('\n')}
`;

        await fs.writeFile(skillPath, skillContent);

        const result = execSync(`node "${cliPath}" validate "${skillDir}"`, {
          encoding: 'utf-8',
        });

        // Should still be valid but have warnings
        expect(result).toContain('✓ Skill is valid!');
        expect(result).toContain('Warnings:');
        expect(result).toContain('lines');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('includes warnings in JSON output', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
      const skillDir = path.join(tempDir, 'large-skill');
      await fs.mkdir(skillDir);
      const skillPath = path.join(skillDir, 'SKILL.md');

      try {
        // Create content with 501 lines
        const bodyLines = Array(501).fill('Content line.');
        const skillContent = `---
name: large-skill
description: A skill with many lines
---

${bodyLines.join('\n')}
`;

        await fs.writeFile(skillPath, skillContent);

        const result = execSync(`node "${cliPath}" validate "${skillDir}" --json`, {
          encoding: 'utf-8',
        });

        const parsed = JSON.parse(result);
        expect(parsed.valid).toBe(true);
        expect(parsed.warnings).toBeDefined();
        expect(parsed.warnings.length).toBeGreaterThan(0);
        expect(parsed.warnings.some((w: string) => w.includes('lines'))).toBe(true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('returns no warnings for small skill', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-integration-'));
      const skillDir = path.join(tempDir, 'small-skill');
      await fs.mkdir(skillDir);
      const skillPath = path.join(skillDir, 'SKILL.md');

      try {
        const skillContent = `---
name: small-skill
description: A small skill
---

Just a few lines of content.
`;

        await fs.writeFile(skillPath, skillContent);

        const result = execSync(`node "${cliPath}" validate "${skillDir}" --json`, {
          encoding: 'utf-8',
        });

        const parsed = JSON.parse(result);
        expect(parsed.valid).toBe(true);
        expect(parsed.warnings).toEqual([]);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
