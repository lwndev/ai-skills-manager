/**
 * Integration tests for recursive list API (FEAT-012 Phase 3)
 *
 * Tests recursive discovery of skills in nested `.claude/skills` directories.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { list } from '../../../src/api/list';

describe('list API recursive discovery', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-list-recursive-'));
    originalCwd = process.cwd();
    // Change to temp directory to simulate project root
    process.chdir(tempDir);
  });

  afterEach(async () => {
    // Restore original cwd before cleanup
    process.chdir(originalCwd);
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

  /**
   * Helper to create .claude/skills directory with a skill
   */
  async function createSkillsDir(...pathParts: string[]): Promise<string> {
    const skillsDir = path.join(tempDir, ...pathParts, '.claude', 'skills');
    await fs.mkdir(skillsDir, { recursive: true });
    return skillsDir;
  }

  describe('non-recursive mode (default)', () => {
    it('only finds root level skills when recursive is false', async () => {
      // Create root skills
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      // Create nested skills
      const nestedSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(nestedSkillsDir, 'nested-skill');

      const { skills } = await list({ scope: 'project', recursive: false });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('root-skill');
      expect(skills[0].location).toBeUndefined();
    });

    it('default behavior (no recursive option) is non-recursive', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const nestedSkillsDir = await createSkillsDir('packages', 'web');
      await createSkill(nestedSkillsDir, 'nested-skill');

      const { skills } = await list({ scope: 'project' });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('root-skill');
    });
  });

  describe('recursive mode', () => {
    it('finds skills in nested .claude/skills directories', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const apiSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(apiSkillsDir, 'api-helpers');

      const webSkillsDir = await createSkillsDir('packages', 'web');
      await createSkill(webSkillsDir, 'component-gen');

      const { skills } = await list({ scope: 'project', recursive: true });

      expect(skills).toHaveLength(3);
      const names = skills.map((s) => s.name);
      expect(names).toContain('root-skill');
      expect(names).toContain('api-helpers');
      expect(names).toContain('component-gen');
    });

    it('populates location field for nested skills', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const nestedSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(nestedSkillsDir, 'nested-skill');

      const { skills } = await list({ scope: 'project', recursive: true });

      const rootSkill = skills.find((s) => s.name === 'root-skill');
      const nestedSkill = skills.find((s) => s.name === 'nested-skill');

      // Root skill has no location
      expect(rootSkill?.location).toBeUndefined();

      // Nested skill has location with full path including skill name
      expect(nestedSkill?.location).toBe(
        path.join('packages', 'api', '.claude', 'skills', 'nested-skill')
      );
    });

    it('handles duplicate skill names in different locations', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'shared-utils', { version: '1.0.0' });

      const apiSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(apiSkillsDir, 'shared-utils', { version: '2.0.0' });

      const webSkillsDir = await createSkillsDir('packages', 'web');
      await createSkill(webSkillsDir, 'shared-utils', { version: '3.0.0' });

      const { skills } = await list({ scope: 'project', recursive: true });

      // All three instances should be found
      const sharedUtils = skills.filter((s) => s.name === 'shared-utils');
      expect(sharedUtils).toHaveLength(3);

      // They should have different versions
      const versions = sharedUtils.map((s) => s.version).sort();
      expect(versions).toEqual(['1.0.0', '2.0.0', '3.0.0']);
    });

    it('works when root has no .claude/skills but nested do', async () => {
      // No root skills directory

      const apiSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(apiSkillsDir, 'api-skill');

      const webSkillsDir = await createSkillsDir('packages', 'web');
      await createSkill(webSkillsDir, 'web-skill');

      const { skills } = await list({ scope: 'project', recursive: true });

      expect(skills).toHaveLength(2);
      const names = skills.map((s) => s.name);
      expect(names).toContain('api-skill');
      expect(names).toContain('web-skill');
    });
  });

  describe('depth limiting', () => {
    it('respects depth limit', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'depth-0');

      const level1Dir = await createSkillsDir('level1');
      await createSkill(level1Dir, 'depth-1');

      const level2Dir = await createSkillsDir('level1', 'level2');
      await createSkill(level2Dir, 'depth-2');

      const level3Dir = await createSkillsDir('level1', 'level2', 'level3');
      await createSkill(level3Dir, 'depth-3');

      // Depth 1 should find root and level1
      const result1 = await list({ scope: 'project', recursive: true, depth: 1 });
      const names1 = result1.skills.map((s) => s.name);
      expect(names1).toContain('depth-0');
      expect(names1).toContain('depth-1');
      expect(names1).not.toContain('depth-2');

      // Depth 2 should find root, level1, and level2
      const result2 = await list({ scope: 'project', recursive: true, depth: 2 });
      const names2 = result2.skills.map((s) => s.name);
      expect(names2).toContain('depth-0');
      expect(names2).toContain('depth-1');
      expect(names2).toContain('depth-2');
      expect(names2).not.toContain('depth-3');
    });

    it('depth 0 only finds root skills', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const nestedSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(nestedSkillsDir, 'nested-skill');

      const { skills } = await list({ scope: 'project', recursive: true, depth: 0 });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('root-skill');
    });

    it('default depth is 3', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'depth-0');

      // Create skills at depths 1, 2, 3, 4
      for (let i = 1; i <= 4; i++) {
        const parts = Array.from({ length: i }, (_, j) => `level${j + 1}`);
        const dir = await createSkillsDir(...parts);
        await createSkill(dir, `depth-${i}`);
      }

      // Default should find depth 0-3 but not depth 4
      const { skills } = await list({ scope: 'project', recursive: true });
      const names = skills.map((s) => s.name);

      expect(names).toContain('depth-0');
      expect(names).toContain('depth-1');
      expect(names).toContain('depth-2');
      expect(names).toContain('depth-3');
      expect(names).not.toContain('depth-4');
    });

    it('returns depthLimitReached true when directories are skipped', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'depth-0');

      // Create skills at depths 1, 2, 3, 4
      for (let i = 1; i <= 4; i++) {
        const parts = Array.from({ length: i }, (_, j) => `level${j + 1}`);
        const dir = await createSkillsDir(...parts);
        await createSkill(dir, `depth-${i}`);
      }

      // Default depth 3 should trigger depthLimitReached
      const result = await list({ scope: 'project', recursive: true });

      expect(result.depthLimitReached).toBe(true);
    });

    it('returns depthLimitReached false when all directories are scanned', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'depth-0');

      // Create only at depth 1 - no deeper subdirectories
      const level1Dir = await createSkillsDir('level1');
      await createSkill(level1Dir, 'depth-1');

      // Depth 2 should be enough to scan everything (level1 has no subdirs)
      const result = await list({ scope: 'project', recursive: true, depth: 2 });

      expect(result.depthLimitReached).toBe(false);
    });
  });

  describe('gitignore respect', () => {
    it('does not filter directories by gitignore patterns', async () => {
      // Create .gitignore — discovery should ignore it
      await fs.writeFile(path.join(tempDir, '.gitignore'), 'ignored-pkg/\n');

      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const includedDir = await createSkillsDir('included-pkg');
      await createSkill(includedDir, 'included-skill');

      const ignoredDir = await createSkillsDir('ignored-pkg');
      await createSkill(ignoredDir, 'ignored-skill');

      const { skills } = await list({ scope: 'project', recursive: true });

      const names = skills.map((s) => s.name);
      expect(names).toContain('root-skill');
      expect(names).toContain('included-skill');
      // Skills in gitignored directories ARE now discovered (aligns with Claude Code v2.0.28+)
      expect(names).toContain('ignored-skill');
    });

    it('skips node_modules by default (hardcoded)', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      // Create skills in node_modules (should be skipped)
      const nodeModulesDir = await createSkillsDir('node_modules', 'some-package');
      await createSkill(nodeModulesDir, 'pkg-skill');

      const { skills } = await list({ scope: 'project', recursive: true });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('root-skill');
    });

    it('works without .gitignore file', async () => {
      // No .gitignore file

      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill');

      const nestedSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(nestedSkillsDir, 'nested-skill');

      const { skills } = await list({ scope: 'project', recursive: true });

      expect(skills).toHaveLength(2);
    });
  });

  describe('personal scope', () => {
    it('personal scope is never recursively scanned', async () => {
      // Create a mock personal skills directory with nested structure
      const personalDir = path.join(tempDir, 'personal-skills');
      await fs.mkdir(personalDir, { recursive: true });
      await createSkill(personalDir, 'personal-skill');

      // Nested dir in personal (should not be scanned even with recursive)
      const nestedPersonal = path.join(personalDir, 'nested', '.claude', 'skills');
      await fs.mkdir(nestedPersonal, { recursive: true });
      await createSkill(nestedPersonal, 'nested-personal');

      // Use targetPath to test personal-like behavior
      const { skills } = await list({ targetPath: personalDir });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('personal-skill');
    });
  });

  describe('scope combinations', () => {
    it('recursive only applies to project scope in all mode', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'project-root');

      const nestedSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(nestedSkillsDir, 'project-nested');

      // Note: Can't easily test personal scope in integration without mocking home dir
      // This test verifies project recursive works with scope: 'all'
      const { skills } = await list({ scope: 'all', recursive: true });

      const projectSkills = skills.filter((s) => s.scope === 'project');
      const names = projectSkills.map((s) => s.name);

      expect(names).toContain('project-root');
      expect(names).toContain('project-nested');
    });
  });

  describe('empty directories', () => {
    it('handles empty .claude/skills directories', async () => {
      await createSkillsDir(); // Empty root skills dir

      const nestedSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(nestedSkillsDir, 'nested-skill');

      const { skills } = await list({ scope: 'project', recursive: true });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('nested-skill');
    });
  });

  describe('JSON output compatibility', () => {
    it('location field is included in skill objects', async () => {
      const rootSkillsDir = await createSkillsDir();
      await createSkill(rootSkillsDir, 'root-skill', { version: '1.0.0' });

      const nestedSkillsDir = await createSkillsDir('packages', 'api');
      await createSkill(nestedSkillsDir, 'nested-skill', { version: '2.0.0' });

      const result = await list({ scope: 'project', recursive: true });

      // Verify the structure is JSON-serializable with location
      const json = JSON.stringify(result.skills);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(2);

      const rootSkill = parsed.find((s: { name: string }) => s.name === 'root-skill');
      expect(rootSkill.location).toBeUndefined();

      const nestedSkill = parsed.find((s: { name: string }) => s.name === 'nested-skill');
      expect(nestedSkill.location).toBeDefined();
    });
  });
});
