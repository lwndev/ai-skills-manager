/**
 * Integration tests for the list API function (FEAT-010 Phase 2)
 *
 * These tests verify end-to-end behavior of the list() API function
 * with real filesystem operations and skill installations.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { list } from '../../../src/api/list';
import { execSync } from 'child_process';

describe('list API integration', () => {
  let tempDir: string;
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');

  beforeAll(async () => {
    // Ensure CLI is built
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-list-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a skill directory with SKILL.md
   */
  async function createSkill(
    baseDir: string,
    name: string,
    options: { description?: string; version?: string } = {}
  ): Promise<string> {
    const skillDir = path.join(baseDir, name);
    await fs.mkdir(skillDir, { recursive: true });

    const metadata = options.version ? `\nmetadata:\n  version: ${options.version}` : '';
    const content = `---
name: ${name}
description: ${options.description || `Description for ${name}`}${metadata}
---

# ${name}
`;

    await fs.writeFile(path.join(skillDir, 'SKILL.md'), content);
    return skillDir;
  }

  describe('lists scaffolded skills', () => {
    it('lists a skill created by scaffold command', async () => {
      // Scaffold a skill
      execSync(
        `node "${cliPath}" scaffold scaffolded-skill --output "${tempDir}" --description "Scaffolded skill" --force`,
        { encoding: 'utf-8' }
      );

      // List skills
      const { skills } = await list({ targetPath: tempDir });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('scaffolded-skill');
      expect(skills[0].description).toBe('Scaffolded skill');
    });

    it('lists multiple scaffolded skills', async () => {
      // Scaffold multiple skills
      execSync(
        `node "${cliPath}" scaffold skill-one --output "${tempDir}" --description "First skill" --force`,
        { encoding: 'utf-8' }
      );
      execSync(
        `node "${cliPath}" scaffold skill-two --output "${tempDir}" --description "Second skill" --force`,
        { encoding: 'utf-8' }
      );
      execSync(
        `node "${cliPath}" scaffold skill-three --output "${tempDir}" --description "Third skill" --force`,
        { encoding: 'utf-8' }
      );

      // List skills
      const { skills } = await list({ targetPath: tempDir });

      expect(skills).toHaveLength(3);
      const names = skills.map((s) => s.name);
      expect(names).toContain('skill-one');
      expect(names).toContain('skill-two');
      expect(names).toContain('skill-three');
    });
  });

  describe('extracts metadata from skills', () => {
    it('extracts description from SKILL.md', async () => {
      await createSkill(tempDir, 'described-skill', {
        description: 'A detailed description of the skill',
      });

      const { skills } = await list({ targetPath: tempDir });

      expect(skills[0].description).toBe('A detailed description of the skill');
    });

    it('extracts version from metadata', async () => {
      await createSkill(tempDir, 'versioned-skill', {
        version: '2.1.0',
      });

      const { skills } = await list({ targetPath: tempDir });

      expect(skills[0].version).toBe('2.1.0');
    });

    it('handles skills without optional metadata', async () => {
      await createSkill(tempDir, 'minimal-skill');

      const { skills } = await list({ targetPath: tempDir });

      expect(skills[0].name).toBe('minimal-skill');
      expect(skills[0].version).toBeUndefined();
    });
  });

  describe('handles mixed directory contents', () => {
    it('only returns valid skills (directories with SKILL.md)', async () => {
      // Create valid skill
      await createSkill(tempDir, 'valid-skill');

      // Create directory without SKILL.md
      await fs.mkdir(path.join(tempDir, 'not-a-skill'));
      await fs.writeFile(path.join(tempDir, 'not-a-skill', 'README.md'), '# Not a skill');

      // Create regular file
      await fs.writeFile(path.join(tempDir, 'some-file.txt'), 'content');

      // Create hidden directory
      await fs.mkdir(path.join(tempDir, '.hidden-dir'));

      const { skills } = await list({ targetPath: tempDir });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('valid-skill');
    });

    it('handles nested skill directories correctly', async () => {
      // Skills should only be found at the top level of the target path
      await createSkill(tempDir, 'top-level-skill');

      // Create nested skill (should NOT be found)
      const nestedDir = path.join(tempDir, 'parent');
      await fs.mkdir(nestedDir, { recursive: true });
      await createSkill(nestedDir, 'nested-skill');

      const { skills } = await list({ targetPath: tempDir });

      // Should only find top-level skill
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('top-level-skill');
    });
  });

  describe('handles edge cases', () => {
    it('returns empty array for empty directory', async () => {
      const { skills } = await list({ targetPath: tempDir });

      expect(skills).toEqual([]);
    });

    it('returns empty array for nonexistent directory', async () => {
      const nonexistent = path.join(tempDir, 'does-not-exist');

      const { skills } = await list({ targetPath: nonexistent });

      expect(skills).toEqual([]);
    });

    it('handles skills with malformed SKILL.md', async () => {
      // Create skill with invalid YAML
      const skillDir = path.join(tempDir, 'malformed-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), 'not valid yaml: [[[');

      const { skills } = await list({ targetPath: tempDir });

      // Skill is still found, but metadata extraction fails gracefully
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('malformed-skill');
      expect(skills[0].description).toBeUndefined();
    });

    it('handles skills with empty SKILL.md', async () => {
      const skillDir = path.join(tempDir, 'empty-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '');

      const { skills } = await list({ targetPath: tempDir });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('empty-skill');
    });

    it('handles directory names with spaces', async () => {
      const skillDir = path.join(tempDir, 'skill with spaces');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: skill-name
description: Test
---
`
      );

      const { skills } = await list({ targetPath: tempDir });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('skill with spaces');
    });

    it('handles unicode directory names', async () => {
      const skillDir = path.join(tempDir, 'skill-日本語');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: skill-unicode
description: Unicode test
---
`
      );

      const { skills } = await list({ targetPath: tempDir });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('skill-日本語');
    });
  });

  describe('scope assignment', () => {
    it('assigns custom scope when using targetPath', async () => {
      await createSkill(tempDir, 'custom-path-skill');

      const { skills } = await list({ targetPath: tempDir });

      expect(skills[0].scope).toBe('custom');
    });
  });

  describe('path property', () => {
    it('returns absolute paths', async () => {
      await createSkill(tempDir, 'path-test-skill');

      const { skills } = await list({ targetPath: tempDir });

      expect(path.isAbsolute(skills[0].path)).toBe(true);
    });

    it('returns correct path to skill directory', async () => {
      await createSkill(tempDir, 'correct-path');

      const { skills } = await list({ targetPath: tempDir });

      const expectedPath = path.join(tempDir, 'correct-path');
      expect(skills[0].path).toBe(expectedPath);
    });
  });

  describe('large skill sets', () => {
    it('handles many skills efficiently', async () => {
      // Create 20 skills
      const skillCount = 20;
      for (let i = 0; i < skillCount; i++) {
        await createSkill(tempDir, `skill-${String(i).padStart(3, '0')}`);
      }

      const startTime = Date.now();
      const { skills } = await list({ targetPath: tempDir });
      const duration = Date.now() - startTime;

      expect(skills).toHaveLength(skillCount);
      // Should complete reasonably quickly (under 5 seconds)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('complex skill structures', () => {
    it('handles skills with references directories', async () => {
      const skillDir = path.join(tempDir, 'skill-with-refs');
      const refsDir = path.join(skillDir, 'references');
      await fs.mkdir(refsDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: skill-with-refs
description: Has reference files
---
`
      );
      await fs.writeFile(path.join(refsDir, 'example.md'), '# Example');

      const { skills } = await list({ targetPath: tempDir });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('skill-with-refs');
    });

    it('handles skills with multiple subdirectories', async () => {
      const skillDir = path.join(tempDir, 'complex-skill');
      await fs.mkdir(path.join(skillDir, 'references'), { recursive: true });
      await fs.mkdir(path.join(skillDir, 'templates'), { recursive: true });
      await fs.mkdir(path.join(skillDir, 'scripts'), { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: complex-skill
description: Complex structure
---
`
      );

      const { skills } = await list({ targetPath: tempDir });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('complex-skill');
    });
  });
});
