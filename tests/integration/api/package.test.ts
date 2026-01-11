/**
 * Integration tests for the createPackage API function (FEAT-010 Phase 4)
 *
 * These tests verify end-to-end behavior of the createPackage() API function
 * with real filesystem operations, including:
 * - Packages created by API are valid ZIP archives
 * - API behavior is consistent with CLI behavior
 * - Full workflow from scaffold to package works
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import { createPackage } from '../../../src/api/package';
import { scaffold } from '../../../src/api/scaffold';
import { validate } from '../../../src/api/validate';
import { ValidationError, FileSystemError, CancellationError } from '../../../src/errors';
import { execSync } from 'child_process';

describe('createPackage API integration', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'api-package-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('created packages are valid ZIP archives', () => {
    it('package is a valid ZIP file', async () => {
      const skillResult = await scaffold({
        name: 'zip-test',
        description: 'Testing ZIP validity',
        output: tempDir,
      });

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const packageResult = await createPackage({
        path: skillResult.path,
        output: outputDir,
      });

      // Should be able to open as ZIP
      expect(() => new AdmZip(packageResult.packagePath)).not.toThrow();
    });

    it('package contains skill directory structure', async () => {
      const skillResult = await scaffold({
        name: 'structure-test',
        description: 'Testing structure',
        output: tempDir,
      });

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const packageResult = await createPackage({
        path: skillResult.path,
        output: outputDir,
      });

      const zip = new AdmZip(packageResult.packagePath);
      const entries = zip.getEntries().map((e) => e.entryName);

      // Should contain skill directory
      expect(entries.some((e) => e.includes('structure-test/'))).toBe(true);
      expect(entries.some((e) => e.includes('SKILL.md'))).toBe(true);
    });

    it('package contains SKILL.md with correct content', async () => {
      const skillResult = await scaffold({
        name: 'content-test',
        description: 'Testing content',
        allowedTools: ['Read', 'Write'],
        output: tempDir,
      });

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const packageResult = await createPackage({
        path: skillResult.path,
        output: outputDir,
      });

      const zip = new AdmZip(packageResult.packagePath);
      const skillMdEntry = zip.getEntries().find((e) => e.entryName.endsWith('SKILL.md'));

      expect(skillMdEntry).toBeDefined();
      const content = skillMdEntry!.getData().toString('utf-8');
      expect(content).toContain('name: content-test');
      expect(content).toContain('description: Testing content');
      expect(content).toContain('allowed-tools:');
    });

    it('package contains scripts directory', async () => {
      const skillResult = await scaffold({
        name: 'scripts-test',
        output: tempDir,
      });

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const packageResult = await createPackage({
        path: skillResult.path,
        output: outputDir,
      });

      const zip = new AdmZip(packageResult.packagePath);
      const entries = zip.getEntries().map((e) => e.entryName);

      expect(entries.some((e) => e.includes('scripts/'))).toBe(true);
    });
  });

  describe('consistency with CLI package', () => {
    it('API package has same structure as CLI package', async () => {
      const skillPath = path.join(tempDir, 'consistency-skill');

      // Create skill using API
      await scaffold({
        name: 'consistency-skill',
        description: 'Test consistency',
        output: tempDir,
      });

      const apiOutputDir = path.join(tempDir, 'api-output');
      const cliOutputDir = path.join(tempDir, 'cli-output');
      await fs.mkdir(apiOutputDir, { recursive: true });
      await fs.mkdir(cliOutputDir, { recursive: true });

      // Package using API
      const apiResult = await createPackage({
        path: skillPath,
        output: apiOutputDir,
      });

      // Package using CLI
      execSync(`node "${cliPath}" package "${skillPath}" --output "${cliOutputDir}" --force`, {
        encoding: 'utf-8',
      });

      const cliPackagePath = path.join(cliOutputDir, 'consistency-skill.skill');

      // Both packages should have same entries
      const apiZip = new AdmZip(apiResult.packagePath);
      const cliZip = new AdmZip(cliPackagePath);

      const apiEntries = apiZip
        .getEntries()
        .map((e) => e.entryName)
        .sort();
      const cliEntries = cliZip
        .getEntries()
        .map((e) => e.entryName)
        .sort();

      expect(apiEntries).toEqual(cliEntries);
    });
  });

  describe('scaffold -> validate -> package workflow', () => {
    it('full workflow works end-to-end', async () => {
      // Step 1: Scaffold
      const scaffoldResult = await scaffold({
        name: 'workflow-skill',
        description: 'A skill for testing the workflow',
        allowedTools: ['Read', 'Write', 'Bash'],
        output: tempDir,
      });

      expect(scaffoldResult.path).toBeDefined();

      // Step 2: Validate
      const validateResult = await validate(scaffoldResult.path);
      expect(validateResult.valid).toBe(true);

      // Step 3: Package
      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const packageResult = await createPackage({
        path: scaffoldResult.path,
        output: outputDir,
      });

      expect(packageResult.packagePath).toBeDefined();
      expect(packageResult.size).toBeGreaterThan(0);

      // Verify package exists
      const stats = await fs.stat(packageResult.packagePath);
      expect(stats.isFile()).toBe(true);
    });

    it('validates skill before packaging', async () => {
      // Create an invalid skill
      const invalidSkillPath = path.join(tempDir, 'invalid-skill');
      await fs.mkdir(invalidSkillPath, { recursive: true });
      await fs.writeFile(path.join(invalidSkillPath, 'SKILL.md'), '# Just a title\n');

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      await expect(
        createPackage({
          path: invalidSkillPath,
          output: outputDir,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('skipValidation allows packaging invalid skills', async () => {
      // Create a minimal skill (may not pass full validation)
      const minimalSkillPath = path.join(tempDir, 'minimal-skill');
      await fs.mkdir(minimalSkillPath, { recursive: true });
      await fs.writeFile(
        path.join(minimalSkillPath, 'SKILL.md'),
        '---\nname: minimal-skill\ndescription: Minimal\n---\n# Skill\n'
      );

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: minimalSkillPath,
        output: outputDir,
        skipValidation: true,
      });

      expect(result.packagePath).toBeDefined();
    });
  });

  describe('multiple skills', () => {
    it('packages multiple skills independently', async () => {
      const skills = ['skill-one', 'skill-two', 'skill-three'];

      // Scaffold all skills
      for (const name of skills) {
        await scaffold({
          name,
          description: `Skill ${name}`,
          output: tempDir,
        });
      }

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Package all skills
      const results = [];
      for (const name of skills) {
        const result = await createPackage({
          path: path.join(tempDir, name),
          output: outputDir,
        });
        results.push(result);
      }

      // All should have unique paths
      const paths = results.map((r) => r.packagePath);
      const uniquePaths = new Set(paths);
      expect(uniquePaths.size).toBe(skills.length);

      // All files should exist
      for (const result of results) {
        expect((await fs.stat(result.packagePath)).isFile()).toBe(true);
      }
    });
  });

  describe('AbortSignal cancellation', () => {
    it('respects pre-aborted signal', async () => {
      const skillResult = await scaffold({
        name: 'abort-test',
        output: tempDir,
      });

      const controller = new AbortController();
      controller.abort();

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      await expect(
        createPackage({
          path: skillResult.path,
          output: outputDir,
          signal: controller.signal,
        })
      ).rejects.toThrow(CancellationError);
    });

    it('completes successfully with non-aborted signal', async () => {
      const skillResult = await scaffold({
        name: 'no-abort-test',
        output: tempDir,
      });

      const controller = new AbortController();

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: skillResult.path,
        output: outputDir,
        signal: controller.signal,
      });

      expect(result.packagePath).toBeDefined();
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('throws ValidationError with issues for invalid skill', async () => {
      const invalidSkillPath = path.join(tempDir, 'invalid-skill');
      await fs.mkdir(invalidSkillPath, { recursive: true });
      await fs.writeFile(path.join(invalidSkillPath, 'SKILL.md'), '# No frontmatter\n');

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      try {
        await createPackage({
          path: invalidSkillPath,
          output: outputDir,
        });
        fail('Expected ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).issues.length).toBeGreaterThan(0);
        expect((error as ValidationError).code).toBe('VALIDATION_ERROR');
      }
    });

    it('throws FileSystemError when package exists without force', async () => {
      const skillResult = await scaffold({
        name: 'exists-test',
        output: tempDir,
      });

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Create first package
      await createPackage({
        path: skillResult.path,
        output: outputDir,
      });

      // Try to create again
      try {
        await createPackage({
          path: skillResult.path,
          output: outputDir,
        });
        fail('Expected FileSystemError');
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError);
        expect((error as FileSystemError).code).toBe('FILE_SYSTEM_ERROR');
        expect((error as FileSystemError).path).toContain('exists-test.skill');
      }
    });

    it('force option allows overwriting existing package', async () => {
      const skillResult = await scaffold({
        name: 'force-test',
        output: tempDir,
      });

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Create first package
      const firstResult = await createPackage({
        path: skillResult.path,
        output: outputDir,
      });

      // Create again with force
      const secondResult = await createPackage({
        path: skillResult.path,
        output: outputDir,
        force: true,
      });

      expect(secondResult.packagePath).toBe(firstResult.packagePath);
    });
  });

  describe('result object', () => {
    it('packagePath is absolute', async () => {
      const skillResult = await scaffold({
        name: 'absolute-path-test',
        output: tempDir,
      });

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: skillResult.path,
        output: outputDir,
      });

      expect(path.isAbsolute(result.packagePath)).toBe(true);
    });

    it('size matches actual file size', async () => {
      const skillResult = await scaffold({
        name: 'size-test',
        description: 'Testing size reporting',
        output: tempDir,
      });

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: skillResult.path,
        output: outputDir,
      });

      const stats = await fs.stat(result.packagePath);
      expect(result.size).toBe(stats.size);
    });

    it('packagePath ends with .skill', async () => {
      const skillResult = await scaffold({
        name: 'extension-test',
        output: tempDir,
      });

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: skillResult.path,
        output: outputDir,
      });

      expect(result.packagePath).toMatch(/\.skill$/);
    });
  });

  describe('complex skill packaging', () => {
    it('packages skill with additional files', async () => {
      const skillResult = await scaffold({
        name: 'complex-skill',
        description: 'A skill with extra files',
        output: tempDir,
      });

      // Add extra files to the skill
      const scriptsDir = path.join(skillResult.path, 'scripts');
      await fs.writeFile(path.join(scriptsDir, 'helper.sh'), '#!/bin/bash\necho "Hello"');
      await fs.writeFile(path.join(skillResult.path, 'README.md'), '# Complex Skill');

      // Add a references directory
      const refsDir = path.join(skillResult.path, 'references');
      await fs.mkdir(refsDir, { recursive: true });
      await fs.writeFile(path.join(refsDir, 'reference.md'), '# Reference Document');

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: skillResult.path,
        output: outputDir,
      });

      // Verify package contains all files
      const zip = new AdmZip(result.packagePath);
      const entries = zip.getEntries().map((e) => e.entryName);

      expect(entries.some((e) => e.includes('SKILL.md'))).toBe(true);
      expect(entries.some((e) => e.includes('scripts/'))).toBe(true);
      expect(entries.some((e) => e.includes('helper.sh'))).toBe(true);
      expect(entries.some((e) => e.includes('README.md'))).toBe(true);
      expect(entries.some((e) => e.includes('references/'))).toBe(true);
      expect(entries.some((e) => e.includes('reference.md'))).toBe(true);
    });

    it('packages skill with nested directory structure', async () => {
      const skillResult = await scaffold({
        name: 'nested-skill',
        output: tempDir,
      });

      // Create nested structure
      const nestedDir = path.join(skillResult.path, 'a', 'b', 'c');
      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(path.join(nestedDir, 'deep-file.txt'), 'Deep content');

      const outputDir = path.join(tempDir, 'output');
      await fs.mkdir(outputDir, { recursive: true });

      const result = await createPackage({
        path: skillResult.path,
        output: outputDir,
      });

      const zip = new AdmZip(result.packagePath);
      const entries = zip.getEntries().map((e) => e.entryName);

      expect(entries.some((e) => e.includes('a/b/c/deep-file.txt'))).toBe(true);
    });
  });
});
