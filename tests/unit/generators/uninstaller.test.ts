/**
 * Tests for uninstaller module
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  executeRemoval,
  streamRemovalProgress,
  generateDryRunPreview,
  isDryRunPreview,
  getScopePath,
  RemovalProgress,
} from '../../../src/generators/uninstaller';
import type {
  SkillInfo,
  DryRunPreview,
  UninstallResult,
  UninstallFailure,
} from '../../../src/types/uninstall';

describe('Uninstaller', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create fresh temporary directory for each test
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-uninstaller-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Helper to create a test skill directly in temp directory
   */
  async function createTestSkillDirect(name: string): Promise<string> {
    const skillPath = path.join(tempDir, name);
    await fs.promises.mkdir(skillPath, { recursive: true });
    await fs.promises.writeFile(
      path.join(skillPath, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Test skill\n---\n\n# ${name}\n\nTest content.`
    );
    await fs.promises.writeFile(path.join(skillPath, 'README.md'), `# ${name}`);
    return skillPath;
  }

  /**
   * Helper to collect files from a directory
   */
  async function collectFiles(dirPath: string): Promise<
    {
      relativePath: string;
      absolutePath: string;
      size: number;
      isDirectory: boolean;
      isSymlink: boolean;
      linkCount: number;
    }[]
  > {
    const files: {
      relativePath: string;
      absolutePath: string;
      size: number;
      isDirectory: boolean;
      isSymlink: boolean;
      linkCount: number;
    }[] = [];

    async function walk(dir: string, relativePath: string): Promise<void> {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const absPath = path.join(dir, entry.name);
        const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
        const stats = await fs.promises.lstat(absPath);

        files.push({
          relativePath: relPath,
          absolutePath: absPath,
          size: stats.size,
          isDirectory: stats.isDirectory(),
          isSymlink: stats.isSymbolicLink(),
          linkCount: stats.nlink,
        });

        if (entry.isDirectory()) {
          await walk(absPath, relPath);
        }
      }
    }

    await walk(dirPath, '');
    return files;
  }

  describe('executeRemoval', () => {
    it('removes all files and returns success', async () => {
      const skillPath = await createTestSkillDirect('removal-test');
      const files = await collectFiles(skillPath);

      const skillInfo: SkillInfo = {
        name: 'removal-test',
        path: skillPath,
        files,
        totalSize: files.reduce((s, f) => s + f.size, 0),
        hasSkillMd: true,
        warnings: [],
      };

      const result = await executeRemoval(skillInfo, {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
      });

      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.filesRemoved).toBeGreaterThan(0);
      }

      // Verify deleted
      await expect(fs.promises.access(skillPath)).rejects.toThrow();
    });

    it('handles empty skill directory', async () => {
      const skillPath = path.join(tempDir, 'empty-skill');
      await fs.promises.mkdir(skillPath, { recursive: true });

      const skillInfo: SkillInfo = {
        name: 'empty-skill',
        path: skillPath,
        files: [],
        totalSize: 0,
        hasSkillMd: false,
        warnings: [],
      };

      const result = await executeRemoval(skillInfo, {
        scope: 'project',
        force: true,
        dryRun: false,
        quiet: false,
      });

      expect(result.type).toBe('success');

      // Verify deleted
      await expect(fs.promises.access(skillPath)).rejects.toThrow();
    });
  });

  describe('streamRemovalProgress', () => {
    it('yields progress for each file', async () => {
      const skillPath = await createTestSkillDirect('progress-test');
      const files = await collectFiles(skillPath);

      const skillInfo: SkillInfo = {
        name: 'progress-test',
        path: skillPath,
        files,
        totalSize: files.reduce((s, f) => s + f.size, 0),
        hasSkillMd: true,
        warnings: [],
      };

      const progress: RemovalProgress[] = [];
      for await (const p of streamRemovalProgress(skillInfo)) {
        progress.push(p);
      }

      expect(progress.length).toBeGreaterThan(0);
      // processedCount should increase
      expect(progress[0].processedCount).toBe(1);
      expect(progress[progress.length - 1].processedCount).toBe(progress.length);
    });

    it('tracks success/failure for each file', async () => {
      const skillPath = await createTestSkillDirect('track-test');
      const files = await collectFiles(skillPath);

      const skillInfo: SkillInfo = {
        name: 'track-test',
        path: skillPath,
        files,
        totalSize: files.reduce((s, f) => s + f.size, 0),
        hasSkillMd: true,
        warnings: [],
      };

      for await (const p of streamRemovalProgress(skillInfo)) {
        expect(typeof p.success).toBe('boolean');
        expect(typeof p.currentPath).toBe('string');
        expect(typeof p.relativePath).toBe('string');
      }
    });
  });

  describe('generateDryRunPreview', () => {
    it('generates correct preview structure', () => {
      const skillInfo: SkillInfo = {
        name: 'preview-skill',
        path: '/path/to/skill',
        files: [
          {
            relativePath: 'SKILL.md',
            absolutePath: '/path/to/skill/SKILL.md',
            size: 100,
            isDirectory: false,
            isSymlink: false,
            linkCount: 1,
          },
          {
            relativePath: 'README.md',
            absolutePath: '/path/to/skill/README.md',
            size: 50,
            isDirectory: false,
            isSymlink: false,
            linkCount: 1,
          },
        ],
        totalSize: 150,
        hasSkillMd: true,
        warnings: [],
      };

      const preview = generateDryRunPreview(skillInfo);

      expect(preview.type).toBe('dry-run-preview');
      expect(preview.skillName).toBe('preview-skill');
      expect(preview.files.length).toBe(2);
      expect(preview.totalSize).toBe(150);
    });

    it('preserves file information', () => {
      const files = [
        {
          relativePath: 'file.txt',
          absolutePath: '/path/file.txt',
          size: 42,
          isDirectory: false,
          isSymlink: false,
          linkCount: 1,
        },
      ];

      const skillInfo: SkillInfo = {
        name: 'test',
        path: '/path',
        files,
        totalSize: 42,
        hasSkillMd: true,
        warnings: [],
      };

      const preview = generateDryRunPreview(skillInfo);

      expect(preview.files).toBe(files);
    });
  });

  describe('isDryRunPreview', () => {
    it('returns true for DryRunPreview', () => {
      const preview: DryRunPreview = {
        type: 'dry-run-preview',
        skillName: 'test',
        files: [],
        totalSize: 0,
      };

      expect(isDryRunPreview(preview)).toBe(true);
    });

    it('returns false for UninstallResult', () => {
      const result: UninstallResult = {
        success: true,
        skillName: 'test',
        path: '/path',
        filesRemoved: 1,
        bytesFreed: 100,
      };

      expect(isDryRunPreview(result)).toBe(false);
    });

    it('returns false for UninstallFailure', () => {
      const failure: UninstallFailure = {
        success: false,
        skillName: 'test',
        error: {
          type: 'skill-not-found',
          skillName: 'test',
          searchedPath: '/path',
        },
      };

      expect(isDryRunPreview(failure)).toBe(false);
    });
  });

  describe('getScopePath', () => {
    it('returns path for project scope using cwd', () => {
      const scopePath = getScopePath('project', '/custom/cwd');

      expect(scopePath).toBe('/custom/cwd/.claude/skills');
    });

    it('returns path for personal scope using homedir', () => {
      const scopePath = getScopePath('personal', undefined, '/custom/home');

      expect(scopePath).toBe('/custom/home/.claude/skills');
    });

    it('uses injected paths correctly', () => {
      const projectPath = getScopePath('project', '/project/dir');
      const personalPath = getScopePath('personal', undefined, '/home/user');

      expect(projectPath).toBe('/project/dir/.claude/skills');
      expect(personalPath).toBe('/home/user/.claude/skills');
    });

    it('defaults to system paths when no overrides provided', () => {
      const projectPath = getScopePath('project');
      const personalPath = getScopePath('personal');

      // Should use process.cwd() and os.homedir() respectively
      expect(projectPath).toContain('.claude/skills');
      expect(personalPath).toContain('.claude/skills');
    });
  });
});
