/**
 * Integration tests for skill packaging
 *
 * These tests verify the end-to-end packaging workflow, including:
 * - Creating valid .skill packages
 * - Verifying package contents can be extracted
 * - Testing scaffold → validate → package workflow
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { generatePackage } from '../../src/generators/packager';
import * as AdmZip from 'adm-zip';

describe('package integration', () => {
  const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
  let tempDir: string;

  beforeAll(async () => {
    // Ensure the CLI is built
    try {
      await fs.access(cliPath);
    } catch {
      throw new Error('CLI not built. Run "npm run build" before running integration tests.');
    }
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'package-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to create a skill using the scaffold command
   */
  async function scaffoldSkill(name: string): Promise<string> {
    execSync(
      `node "${cliPath}" scaffold "${name}" --output "${tempDir}" --description "Test skill for packaging" --force`,
      { encoding: 'utf-8' }
    );
    return path.join(tempDir, name);
  }

  /**
   * Helper to extract a .skill package and return its contents
   */
  async function extractPackage(packagePath: string): Promise<Map<string, string>> {
    const zip = new AdmZip.default(packagePath);
    const entries = zip.getEntries();
    const contents = new Map<string, string>();

    for (const entry of entries) {
      if (!entry.isDirectory) {
        contents.set(entry.entryName, entry.getData().toString('utf-8'));
      }
    }

    return contents;
  }

  describe('scaffold → validate → package workflow', () => {
    it('packages a freshly scaffolded skill', async () => {
      // Step 1: Scaffold
      const skillDir = await scaffoldSkill('workflow-skill');

      // Step 2: Validate (should pass)
      const validateResult = execSync(`node "${cliPath}" validate "${skillDir}" --quiet`, {
        encoding: 'utf-8',
      });
      expect(validateResult.trim()).toBe('PASS');

      // Step 3: Package
      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      expect(result.success).toBe(true);
      expect(result.packagePath).toBe(path.join(outputDir, 'workflow-skill.skill'));
      expect(result.fileCount).toBeGreaterThan(0);
    });

    it('packages can be extracted by standard ZIP tools', async () => {
      const skillDir = await scaffoldSkill('extractable-skill');
      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      expect(result.success).toBe(true);

      // Verify it's a valid ZIP
      const contents = await extractPackage(result.packagePath as string);

      // Should contain SKILL.md at minimum
      expect(contents.size).toBeGreaterThan(0);

      // Look for SKILL.md in the package (with skill name as root folder)
      const skillMdKey = Array.from(contents.keys()).find((k) => k.endsWith('SKILL.md'));
      expect(skillMdKey).toBeDefined();
    });

    it('package contains correct skill directory structure', async () => {
      const skillDir = await scaffoldSkill('structure-test');

      // Add some additional files to the skill
      await fs.mkdir(path.join(skillDir, 'templates'));
      await fs.writeFile(path.join(skillDir, 'templates', 'template.txt'), 'Template content');
      await fs.writeFile(path.join(skillDir, 'README.md'), '# README\n\nDocumentation.');

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      const contents = await extractPackage(result.packagePath as string);

      // Check structure - files should be under skill-name/ root
      const keys = Array.from(contents.keys());
      expect(keys.every((k) => k.startsWith('structure-test/'))).toBe(true);

      // Verify specific files exist
      expect(keys.some((k) => k.endsWith('SKILL.md'))).toBe(true);
      expect(keys.some((k) => k.endsWith('README.md'))).toBe(true);
      expect(keys.some((k) => k.endsWith('templates/template.txt'))).toBe(true);
    });

    it('package preserves SKILL.md content', async () => {
      const skillDir = await scaffoldSkill('content-test');

      // Read original SKILL.md
      const originalContent = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8');

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      const contents = await extractPackage(result.packagePath as string);

      // Find SKILL.md in package
      const skillMdKey = Array.from(contents.keys()).find((k) => k.endsWith('SKILL.md'));
      expect(skillMdKey).toBeDefined();

      const packagedContent = contents.get(skillMdKey as string);
      expect(packagedContent).toBe(originalContent);
    });
  });

  describe('file exclusion', () => {
    it('excludes .git directory from package', async () => {
      const skillDir = await scaffoldSkill('exclude-git-test');

      // Add .git directory
      await fs.mkdir(path.join(skillDir, '.git'));
      await fs.writeFile(path.join(skillDir, '.git', 'config'), 'git config content');
      await fs.writeFile(path.join(skillDir, '.git', 'HEAD'), 'ref: refs/heads/main');

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      const contents = await extractPackage(result.packagePath as string);

      // Verify .git files are not in package
      const keys = Array.from(contents.keys());
      expect(keys.some((k) => k.includes('.git/'))).toBe(false);
    });

    it('excludes node_modules from package', async () => {
      const skillDir = await scaffoldSkill('exclude-nm-test');

      // Add node_modules
      await fs.mkdir(path.join(skillDir, 'node_modules'));
      await fs.mkdir(path.join(skillDir, 'node_modules', 'some-package'));
      await fs.writeFile(
        path.join(skillDir, 'node_modules', 'some-package', 'index.js'),
        'module.exports = {};'
      );

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      const contents = await extractPackage(result.packagePath as string);

      const keys = Array.from(contents.keys());
      expect(keys.some((k) => k.includes('node_modules/'))).toBe(false);
    });

    it('excludes .DS_Store files from package', async () => {
      const skillDir = await scaffoldSkill('exclude-ds-test');

      // Add .DS_Store
      await fs.writeFile(path.join(skillDir, '.DS_Store'), 'macos metadata');
      await fs.mkdir(path.join(skillDir, 'subdir'));
      await fs.writeFile(path.join(skillDir, 'subdir', '.DS_Store'), 'more metadata');

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      const contents = await extractPackage(result.packagePath as string);

      const keys = Array.from(contents.keys());
      expect(keys.some((k) => k.includes('.DS_Store'))).toBe(false);
    });

    it('excludes log files from package', async () => {
      const skillDir = await scaffoldSkill('exclude-log-test');

      // Add log files
      await fs.writeFile(path.join(skillDir, 'debug.log'), 'debug info');
      await fs.writeFile(path.join(skillDir, 'error.log'), 'error info');
      await fs.writeFile(path.join(skillDir, 'npm-debug.log'), 'npm debug');

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      const contents = await extractPackage(result.packagePath as string);

      const keys = Array.from(contents.keys());
      expect(keys.some((k) => k.endsWith('.log'))).toBe(false);
    });

    it('excludes Python cache directories from package', async () => {
      const skillDir = await scaffoldSkill('exclude-pycache-test');

      // Add __pycache__
      await fs.mkdir(path.join(skillDir, '__pycache__'));
      await fs.writeFile(path.join(skillDir, '__pycache__', 'module.cpython-39.pyc'), 'bytecode');
      await fs.writeFile(path.join(skillDir, 'script.pyc'), 'compiled python');

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      const contents = await extractPackage(result.packagePath as string);

      const keys = Array.from(contents.keys());
      expect(keys.some((k) => k.includes('__pycache__/'))).toBe(false);
      expect(keys.some((k) => k.endsWith('.pyc'))).toBe(false);
    });

    it('includes other hidden files like .gitkeep', async () => {
      const skillDir = await scaffoldSkill('include-hidden-test');

      // Add .gitkeep (should be included)
      await fs.mkdir(path.join(skillDir, 'empty-dir'));
      await fs.writeFile(path.join(skillDir, 'empty-dir', '.gitkeep'), '');

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      const contents = await extractPackage(result.packagePath as string);

      const keys = Array.from(contents.keys());
      expect(keys.some((k) => k.endsWith('.gitkeep'))).toBe(true);
    });
  });

  describe('package options', () => {
    it('packages to custom output directory', async () => {
      const skillDir = await scaffoldSkill('custom-output-skill');
      const customOutput = path.join(tempDir, 'custom', 'nested', 'output');

      const result = await generatePackage(skillDir, { outputPath: customOutput });

      expect(result.success).toBe(true);
      expect(result.packagePath).toBe(path.join(customOutput, 'custom-output-skill.skill'));

      const stats = await fs.stat(result.packagePath as string);
      expect(stats.isFile()).toBe(true);
    });

    it('overwrites existing package with force option', async () => {
      const skillDir = await scaffoldSkill('overwrite-test');
      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      // Create initial package
      const result1 = await generatePackage(skillDir, { outputPath: outputDir });
      expect(result1.success).toBe(true);

      // Modify skill
      await fs.writeFile(path.join(skillDir, 'new-file.txt'), 'New content added');

      // Package again with force
      const result2 = await generatePackage(skillDir, { outputPath: outputDir, force: true });
      expect(result2.success).toBe(true);

      // Package should have more files
      expect(result2.fileCount).toBeGreaterThan(result1.fileCount);
    });

    it('reports requiresOverwrite when package exists and force is false', async () => {
      const skillDir = await scaffoldSkill('no-overwrite-test');
      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      // Create initial package
      const result1 = await generatePackage(skillDir, { outputPath: outputDir });
      expect(result1.success).toBe(true);

      // Try to package again without force
      const result2 = await generatePackage(skillDir, { outputPath: outputDir });
      expect(result2.success).toBe(false);
      expect(result2.requiresOverwrite).toBe(true);
      expect(result2.errors[0]).toContain('already exists');
    });

    it('skips validation when skipValidation is true', async () => {
      // Create a skill manually with invalid content
      const skillDir = path.join(tempDir, 'skip-validation-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: Invalid Name With Spaces
description: Has <invalid> characters
---

# Invalid
`
      );

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      // Should fail without skipValidation
      await expect(generatePackage(skillDir, { outputPath: outputDir })).rejects.toThrow();

      // Should succeed with skipValidation
      const result = await generatePackage(skillDir, {
        outputPath: outputDir,
        skipValidation: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('package contents verification', () => {
    it('package size matches reported size', async () => {
      const skillDir = await scaffoldSkill('size-test');
      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      const stats = await fs.stat(result.packagePath as string);
      expect(stats.size).toBe(result.size);
    });

    it('file count matches actual files in package', async () => {
      const skillDir = await scaffoldSkill('count-test');

      // Add some files (scripts dir already exists from scaffold, use a different dir)
      await fs.mkdir(path.join(skillDir, 'helpers'));
      await fs.writeFile(path.join(skillDir, 'helpers', 'setup.sh'), '#!/bin/bash');
      await fs.writeFile(path.join(skillDir, 'config.json'), '{"key": "value"}');

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      const contents = await extractPackage(result.packagePath as string);
      expect(contents.size).toBe(result.fileCount);
    });

    it('creates valid ZIP format readable by adm-zip', async () => {
      const skillDir = await scaffoldSkill('zip-format-test');
      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      // This should not throw
      const zip = new AdmZip.default(result.packagePath as string);
      const entries = zip.getEntries();
      expect(entries.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles skill with deeply nested directories', async () => {
      const skillDir = await scaffoldSkill('deep-nested');
      const deepPath = path.join(skillDir, 'a', 'b', 'c', 'd', 'e');
      await fs.mkdir(deepPath, { recursive: true });
      await fs.writeFile(path.join(deepPath, 'deep-file.txt'), 'Very nested content');

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      const contents = await extractPackage(result.packagePath as string);
      const keys = Array.from(contents.keys());
      expect(keys.some((k) => k.includes('a/b/c/d/e/deep-file.txt'))).toBe(true);
    });

    it('handles skill with binary files', async () => {
      const skillDir = await scaffoldSkill('binary-file-test');

      // Create a small binary file (PNG header)
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
      ]);
      await fs.writeFile(path.join(skillDir, 'icon.png'), pngHeader);

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      expect(result.success).toBe(true);
      expect(result.fileCount).toBeGreaterThan(1); // SKILL.md + icon.png
    });

    it('handles skill with only SKILL.md', async () => {
      // Create minimal skill
      const skillDir = path.join(tempDir, 'minimal-skill');
      await fs.mkdir(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        `---
name: minimal-skill
description: Only has SKILL.md
---

# Minimal
`
      );

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(1);

      const contents = await extractPackage(result.packagePath as string);
      expect(contents.size).toBe(1);
    });

    it('handles skill with special characters in file names', async () => {
      const skillDir = await scaffoldSkill('special-chars');
      await fs.writeFile(path.join(skillDir, 'file with spaces.txt'), 'content');
      await fs.writeFile(path.join(skillDir, 'file-with-dashes.txt'), 'content');
      await fs.writeFile(path.join(skillDir, 'file_with_underscores.txt'), 'content');

      const outputDir = path.join(tempDir, 'packages');
      await fs.mkdir(outputDir);

      const result = await generatePackage(skillDir, { outputPath: outputDir });

      expect(result.success).toBe(true);

      const contents = await extractPackage(result.packagePath as string);
      const keys = Array.from(contents.keys());
      expect(keys.some((k) => k.includes('file with spaces.txt'))).toBe(true);
      expect(keys.some((k) => k.includes('file-with-dashes.txt'))).toBe(true);
      expect(keys.some((k) => k.includes('file_with_underscores.txt'))).toBe(true);
    });
  });
});
