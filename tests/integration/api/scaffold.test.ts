/**
 * Integration tests for the scaffold API function (FEAT-010 Phase 3)
 *
 * These tests verify end-to-end behavior of the scaffold() API function
 * with real filesystem operations, including:
 * - Skills created by API pass validation
 * - API behavior is consistent with CLI behavior
 * - Complex directory structures work correctly
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { scaffold } from '../../../src/api/scaffold';
import { validate } from '../../../src/api/validate';
import { list } from '../../../src/api/list';
import { FileSystemError, SecurityError } from '../../../src/errors';
import { execSync } from 'child_process';

describe('scaffold API integration', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-scaffold-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('created skills pass validation', () => {
    it('minimal scaffold passes validation', async () => {
      const scaffoldResult = await scaffold({
        name: 'minimal-skill',
        output: tempDir,
      });

      const validateResult = await validate(scaffoldResult.path);

      expect(validateResult.valid).toBe(true);
      expect(validateResult.errors).toHaveLength(0);
    });

    it('scaffold with description passes validation', async () => {
      const scaffoldResult = await scaffold({
        name: 'described-skill',
        description: 'A skill with a description',
        output: tempDir,
      });

      const validateResult = await validate(scaffoldResult.path);

      expect(validateResult.valid).toBe(true);
      expect(validateResult.errors).toHaveLength(0);
    });

    it('scaffold with allowed tools passes validation', async () => {
      const scaffoldResult = await scaffold({
        name: 'tools-skill',
        description: 'A skill with allowed tools',
        allowedTools: ['Read', 'Write', 'Bash'],
        output: tempDir,
      });

      const validateResult = await validate(scaffoldResult.path);

      expect(validateResult.valid).toBe(true);
      expect(validateResult.errors).toHaveLength(0);
    });

    it('scaffold with all options passes validation', async () => {
      const scaffoldResult = await scaffold({
        name: 'complete-skill',
        description: 'A complete skill with all options',
        allowedTools: ['Read', 'Write', 'Bash', 'Glob', 'Grep'],
        output: tempDir,
      });

      const validateResult = await validate(scaffoldResult.path);

      expect(validateResult.valid).toBe(true);
      expect(validateResult.errors).toHaveLength(0);
    });
  });

  describe('created skills are discoverable by list', () => {
    it('scaffolded skill appears in list results', async () => {
      await scaffold({
        name: 'listable-skill',
        description: 'A discoverable skill',
        output: tempDir,
      });

      const skills = await list({ targetPath: tempDir });

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('listable-skill');
      expect(skills[0].description).toBe('A discoverable skill');
    });

    it('multiple scaffolded skills all appear in list', async () => {
      await scaffold({
        name: 'skill-one',
        output: tempDir,
      });
      await scaffold({
        name: 'skill-two',
        output: tempDir,
      });
      await scaffold({
        name: 'skill-three',
        output: tempDir,
      });

      const skills = await list({ targetPath: tempDir });

      expect(skills).toHaveLength(3);
      const names = skills.map((s) => s.name);
      expect(names).toContain('skill-one');
      expect(names).toContain('skill-two');
      expect(names).toContain('skill-three');
    });
  });

  describe('consistency with CLI scaffold', () => {
    it('API scaffold creates same structure as CLI scaffold', async () => {
      const apiPath = path.join(tempDir, 'api');
      const cliOutputPath = path.join(tempDir, 'cli');
      await fs.mkdir(apiPath, { recursive: true });
      await fs.mkdir(cliOutputPath, { recursive: true });

      // Scaffold using API
      const apiResult = await scaffold({
        name: 'consistency-test',
        description: 'Test API/CLI consistency',
        output: apiPath,
      });

      // Scaffold using CLI
      execSync(
        `node "${cliPath}" scaffold consistency-test --output "${cliOutputPath}" --description "Test API/CLI consistency" --force`,
        { encoding: 'utf-8' }
      );

      // Both should create SKILL.md
      const apiSkillMd = await fs.readFile(path.join(apiResult.path, 'SKILL.md'), 'utf-8');
      const cliSkillMd = await fs.readFile(
        path.join(cliOutputPath, 'consistency-test', 'SKILL.md'),
        'utf-8'
      );

      // Content should be equivalent (may differ in whitespace)
      expect(apiSkillMd).toContain('name: consistency-test');
      expect(cliSkillMd).toContain('name: consistency-test');
      expect(apiSkillMd).toContain('description: Test API/CLI consistency');
      expect(cliSkillMd).toContain('description: Test API/CLI consistency');

      // Both should create scripts directory
      const apiScripts = await fs.stat(path.join(apiResult.path, 'scripts'));
      const cliScripts = await fs.stat(path.join(cliOutputPath, 'consistency-test', 'scripts'));
      expect(apiScripts.isDirectory()).toBe(true);
      expect(cliScripts.isDirectory()).toBe(true);

      // Both should create .gitkeep
      await expect(
        fs.access(path.join(apiResult.path, 'scripts', '.gitkeep'))
      ).resolves.not.toThrow();
      await expect(
        fs.access(path.join(cliOutputPath, 'consistency-test', 'scripts', '.gitkeep'))
      ).resolves.not.toThrow();
    });

    it('API scaffold with tools creates same structure as CLI', async () => {
      const apiPath = path.join(tempDir, 'api-tools');
      const cliOutputPath = path.join(tempDir, 'cli-tools');
      await fs.mkdir(apiPath, { recursive: true });
      await fs.mkdir(cliOutputPath, { recursive: true });

      // Scaffold using API with tools
      const apiResult = await scaffold({
        name: 'tools-test',
        allowedTools: ['Read', 'Write'],
        output: apiPath,
      });

      // Scaffold using CLI with tools
      execSync(
        `node "${cliPath}" scaffold tools-test --output "${cliOutputPath}" --allowed-tools Read,Write --force`,
        { encoding: 'utf-8' }
      );

      // Both should include allowed-tools in SKILL.md
      const apiSkillMd = await fs.readFile(path.join(apiResult.path, 'SKILL.md'), 'utf-8');
      const cliSkillMd = await fs.readFile(
        path.join(cliOutputPath, 'tools-test', 'SKILL.md'),
        'utf-8'
      );

      expect(apiSkillMd).toContain('allowed-tools:');
      expect(cliSkillMd).toContain('allowed-tools:');
      expect(apiSkillMd).toContain('- Read');
      expect(cliSkillMd).toContain('- Read');
    });
  });

  describe('directory structure', () => {
    it('creates skill directory at correct location', async () => {
      const customPath = path.join(tempDir, 'custom', 'nested', 'location');

      const result = await scaffold({
        name: 'nested-skill',
        output: customPath,
      });

      expect(result.path).toBe(path.join(customPath, 'nested-skill'));
      expect((await fs.stat(result.path)).isDirectory()).toBe(true);
    });

    it('creates parent directories when needed', async () => {
      const deepPath = path.join(tempDir, 'very', 'deep', 'path', 'structure');

      const result = await scaffold({
        name: 'deep-skill',
        output: deepPath,
      });

      expect((await fs.stat(result.path)).isDirectory()).toBe(true);
    });

    it('skill directory contains expected structure', async () => {
      const result = await scaffold({
        name: 'structure-test',
        output: tempDir,
      });

      // Verify directory structure
      const entries = await fs.readdir(result.path);
      expect(entries).toContain('SKILL.md');
      expect(entries).toContain('scripts');

      // Verify scripts directory
      const scriptsEntries = await fs.readdir(path.join(result.path, 'scripts'));
      expect(scriptsEntries).toContain('.gitkeep');
    });
  });

  describe('SKILL.md content', () => {
    it('generates valid YAML frontmatter', async () => {
      const result = await scaffold({
        name: 'yaml-test',
        description: 'Test YAML generation',
        allowedTools: ['Read', 'Write'],
        output: tempDir,
      });

      // Validate confirms YAML is valid
      const validateResult = await validate(result.path);
      expect(validateResult.valid).toBe(true);
      expect(validateResult.errors.filter((e) => e.code === 'INVALID_FRONTMATTER')).toHaveLength(0);
    });

    it('handles special characters in description', async () => {
      const result = await scaffold({
        name: 'special-desc',
        description: 'A skill with "quotes" and special: characters',
        output: tempDir,
      });

      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain('quotes');
      expect(content).toContain('special');

      // Should still be valid
      const validateResult = await validate(result.path);
      expect(validateResult.valid).toBe(true);
    });

    it('handles long description', async () => {
      const longDescription = 'A'.repeat(500);

      const result = await scaffold({
        name: 'long-desc',
        description: longDescription,
        output: tempDir,
      });

      const content = await fs.readFile(path.join(result.path, 'SKILL.md'), 'utf-8');
      expect(content).toContain(longDescription);

      const validateResult = await validate(result.path);
      expect(validateResult.valid).toBe(true);
    });
  });

  describe('error handling', () => {
    it('throws SecurityError for invalid name with meaningful message', async () => {
      try {
        await scaffold({
          name: 'Invalid-Name',
          output: tempDir,
        });
        fail('Expected SecurityError');
      } catch (error) {
        expect(error).toBeInstanceOf(SecurityError);
        expect((error as SecurityError).message).toContain('lowercase');
      }
    });

    it('throws FileSystemError when directory exists without force', async () => {
      // Create existing directory
      const skillPath = path.join(tempDir, 'existing-skill');
      await fs.mkdir(skillPath, { recursive: true });

      try {
        await scaffold({
          name: 'existing-skill',
          output: tempDir,
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).path).toContain('existing-skill');
      }
    });

    it('force option allows overwriting existing directory', async () => {
      // Create existing directory with a file
      const skillPath = path.join(tempDir, 'overwrite-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(path.join(skillPath, 'old-file.txt'), 'old content');

      // Should succeed with force
      const result = await scaffold({
        name: 'overwrite-skill',
        output: tempDir,
        force: true,
      });

      expect(result.path).toContain('overwrite-skill');
      // SKILL.md should exist
      const skillMdExists = await fs
        .access(path.join(result.path, 'SKILL.md'))
        .then(() => true)
        .catch(() => false);
      expect(skillMdExists).toBe(true);
    });
  });

  describe('workflow integration', () => {
    it('scaffold -> validate -> list workflow works end-to-end', async () => {
      // Step 1: Scaffold
      const scaffoldResult = await scaffold({
        name: 'workflow-skill',
        description: 'A skill for testing the workflow',
        allowedTools: ['Read'],
        output: tempDir,
      });

      expect(scaffoldResult.path).toBeDefined();
      expect(scaffoldResult.files.length).toBeGreaterThan(0);

      // Step 2: Validate
      const validateResult = await validate(scaffoldResult.path);
      expect(validateResult.valid).toBe(true);
      expect(validateResult.errors).toHaveLength(0);

      // Step 3: List
      const skills = await list({ targetPath: tempDir });
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('workflow-skill');
      expect(skills[0].description).toBe('A skill for testing the workflow');
    });

    it('multiple scaffolds in same directory all work', async () => {
      const names = ['skill-alpha', 'skill-beta', 'skill-gamma'];

      for (const name of names) {
        const result = await scaffold({ name, output: tempDir });
        expect(result.path).toContain(name);
      }

      // All should be valid
      for (const name of names) {
        const skillPath = path.join(tempDir, name);
        const validateResult = await validate(skillPath);
        expect(validateResult.valid).toBe(true);
      }

      // All should be listed
      const skills = await list({ targetPath: tempDir });
      expect(skills).toHaveLength(3);
    });
  });

  describe('result object', () => {
    it('path is absolute', async () => {
      const result = await scaffold({
        name: 'absolute-path-test',
        output: tempDir,
      });

      expect(path.isAbsolute(result.path)).toBe(true);
    });

    it('files array contains relative paths', async () => {
      const result = await scaffold({
        name: 'relative-files-test',
        output: tempDir,
      });

      for (const file of result.files) {
        expect(path.isAbsolute(file)).toBe(false);
      }
    });

    it('files array matches actual files', async () => {
      const result = await scaffold({
        name: 'files-match-test',
        output: tempDir,
      });

      // Each file in array should exist
      for (const file of result.files) {
        const fullPath = path.join(result.path, file);
        const exists = await fs
          .access(fullPath)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('template variants pass validation (FEAT-013 Phase 2)', () => {
    // These tests verify that skills generated with template options pass validation.
    // We manually create the SKILL.md using generateSkillMd with template options
    // since the scaffold API doesn't support template options until Phase 4.

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateSkillMd } = require('../../../src/templates/skill-md');

    /**
     * Helper to create a skill directory with generated SKILL.md
     */
    async function createSkillWithTemplate(
      skillName: string,
      baseDir: string,
      templateOptions: { templateType?: string; context?: string; userInvocable?: boolean }
    ): Promise<string> {
      const skillPath = path.join(baseDir, skillName);
      await fs.mkdir(skillPath, { recursive: true });
      await fs.mkdir(path.join(skillPath, 'scripts'), { recursive: true });
      await fs.writeFile(path.join(skillPath, 'scripts', '.gitkeep'), '');

      const content = generateSkillMd({ name: skillName }, templateOptions);
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), content, 'utf-8');

      return skillPath;
    }

    it('forked template skill passes validation', async () => {
      const skillPath = await createSkillWithTemplate('forked-test-skill', tempDir, {
        templateType: 'forked',
      });

      const validateResult = await validate(skillPath);

      expect(validateResult.valid).toBe(true);
      expect(validateResult.errors).toHaveLength(0);

      // Verify frontmatter contains expected fields
      const content = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
      expect(content).toContain('context: fork');
      expect(content).toContain('allowed-tools:');
      expect(content).toContain('- Read');
      expect(content).toContain('- Glob');
      expect(content).toContain('- Grep');
    });

    it('internal template skill passes validation', async () => {
      const skillPath = await createSkillWithTemplate('internal-test-skill', tempDir, {
        templateType: 'internal',
      });

      const validateResult = await validate(skillPath);

      expect(validateResult.valid).toBe(true);
      expect(validateResult.errors).toHaveLength(0);

      // Verify frontmatter contains expected fields
      const content = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
      expect(content).toContain('user-invocable: false');
      expect(content).toContain('allowed-tools:');
      expect(content).toContain('- Read');
      expect(content).toContain('- Grep');
    });

    it('forked template with custom tools passes validation', async () => {
      const skillPath = path.join(tempDir, 'forked-custom-tools');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.mkdir(path.join(skillPath, 'scripts'), { recursive: true });
      await fs.writeFile(path.join(skillPath, 'scripts', '.gitkeep'), '');

      const content = generateSkillMd(
        {
          name: 'forked-custom-tools',
          description: 'A forked skill with custom tools',
          allowedTools: ['Read', 'Grep', 'WebFetch'],
        },
        { templateType: 'forked' }
      );
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), content, 'utf-8');

      const validateResult = await validate(skillPath);

      expect(validateResult.valid).toBe(true);
      expect(validateResult.errors).toHaveLength(0);
    });

    it('internal template with description passes validation', async () => {
      const skillPath = path.join(tempDir, 'internal-with-desc');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.mkdir(path.join(skillPath, 'scripts'), { recursive: true });
      await fs.writeFile(path.join(skillPath, 'scripts', '.gitkeep'), '');

      const content = generateSkillMd(
        {
          name: 'internal-with-desc',
          description: 'An internal helper for validation logic',
        },
        { templateType: 'internal' }
      );
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), content, 'utf-8');

      const validateResult = await validate(skillPath);

      expect(validateResult.valid).toBe(true);
      expect(validateResult.errors).toHaveLength(0);
    });

    it('combined forked and internal flags passes validation', async () => {
      const skillPath = path.join(tempDir, 'forked-internal-combo');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.mkdir(path.join(skillPath, 'scripts'), { recursive: true });
      await fs.writeFile(path.join(skillPath, 'scripts', '.gitkeep'), '');

      // Combining forked template with explicit userInvocable: false
      const content = generateSkillMd(
        { name: 'forked-internal-combo' },
        { templateType: 'forked', userInvocable: false }
      );
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), content, 'utf-8');

      const validateResult = await validate(skillPath);

      expect(validateResult.valid).toBe(true);
      expect(validateResult.errors).toHaveLength(0);

      // Verify both fields are present
      const fileContent = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
      expect(fileContent).toContain('context: fork');
      expect(fileContent).toContain('user-invocable: false');
    });

    it('basic template with explicit context: fork passes validation', async () => {
      const skillPath = path.join(tempDir, 'basic-with-fork');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.mkdir(path.join(skillPath, 'scripts'), { recursive: true });
      await fs.writeFile(path.join(skillPath, 'scripts', '.gitkeep'), '');

      // Basic template with explicit fork context
      const content = generateSkillMd({ name: 'basic-with-fork' }, { context: 'fork' });
      await fs.writeFile(path.join(skillPath, 'SKILL.md'), content, 'utf-8');

      const validateResult = await validate(skillPath);

      expect(validateResult.valid).toBe(true);

      // Should have context: fork but NOT forked template guidance
      const fileContent = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
      expect(fileContent).toContain('context: fork');
      expect(fileContent).not.toContain('FORKED CONTEXT SKILL');
    });

    it('skills generated by templates are discoverable by list', async () => {
      // Create forked skill
      await createSkillWithTemplate('list-forked-skill', tempDir, {
        templateType: 'forked',
      });

      // Create internal skill
      await createSkillWithTemplate('list-internal-skill', tempDir, {
        templateType: 'internal',
      });

      const skills = await list({ targetPath: tempDir });

      expect(skills.length).toBeGreaterThanOrEqual(2);
      const names = skills.map((s) => s.name);
      expect(names).toContain('list-forked-skill');
      expect(names).toContain('list-internal-skill');
    });
  });
});
