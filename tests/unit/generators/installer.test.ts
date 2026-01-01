/**
 * Tests for the installer generator
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';

import {
  installSkill,
  checkExistingSkill,
  backupExistingSkill,
  extractSkillToTarget,
  postInstallValidation,
  rollbackInstallation,
  cleanupBackup,
  getSkillNameFromPackage,
  calculateInstallSize,
  isOverwriteRequired,
  isDryRunPreview,
  isInstallResult,
  isPathWithinTarget,
} from '../../../src/generators/installer';
import { openZipArchive } from '../../../src/utils/extractor';
import { InvalidPackageError } from '../../../src/utils/errors';

describe('Installer Generator', () => {
  let tempDir: string;
  let validSkillPath: string;
  let nameMismatchPath: string;
  let noRootPath: string;
  let installTargetDir: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-installer-test-'));

    // Create a valid skill package
    validSkillPath = path.join(tempDir, 'valid-skill.skill');
    const validZip = new AdmZip();
    validZip.addFile(
      'my-skill/SKILL.md',
      Buffer.from(
        '---\nname: my-skill\ndescription: A test skill\n---\n\n# My Skill\n\nTest content.'
      )
    );
    validZip.addFile('my-skill/scripts/helper.py', Buffer.from('def helper(): pass'));
    validZip.addFile('my-skill/README.md', Buffer.from('# My Skill\n\nReadme content.'));
    validZip.writeZip(validSkillPath);

    // Create a package with name mismatch
    nameMismatchPath = path.join(tempDir, 'name-mismatch.skill');
    const nameMismatchZip = new AdmZip();
    nameMismatchZip.addFile(
      'wrong-dir-name/SKILL.md',
      Buffer.from('---\nname: correct-name\ndescription: Test\n---\n\n# Test')
    );
    nameMismatchZip.writeZip(nameMismatchPath);

    // Create a package with files at root (no root directory)
    noRootPath = path.join(tempDir, 'no-root.skill');
    const noRootZip = new AdmZip();
    noRootZip.addFile('SKILL.md', Buffer.from('---\nname: test\n---'));
    noRootZip.addFile('README.md', Buffer.from('# Readme'));
    noRootZip.writeZip(noRootPath);

    // Create installation target directory
    installTargetDir = path.join(tempDir, 'install-target');
    await fs.promises.mkdir(installTargetDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('checkExistingSkill', () => {
    it('returns exists: false for non-existent path', async () => {
      const result = await checkExistingSkill(path.join(tempDir, 'non-existent'));
      expect(result.exists).toBe(false);
      expect(result.files).toHaveLength(0);
    });

    it('returns exists: true for existing directory', async () => {
      // Create a skill directory
      const existingSkillDir = path.join(tempDir, 'existing-skill');
      await fs.promises.mkdir(existingSkillDir, { recursive: true });
      await fs.promises.writeFile(path.join(existingSkillDir, 'SKILL.md'), 'content');
      await fs.promises.writeFile(path.join(existingSkillDir, 'README.md'), 'readme');

      const result = await checkExistingSkill(existingSkillDir);
      expect(result.exists).toBe(true);
      expect(result.files).toContain('SKILL.md');
      expect(result.files).toContain('README.md');
    });

    it('lists files recursively', async () => {
      // Create a skill directory with nested files
      const nestedSkillDir = path.join(tempDir, 'nested-skill');
      await fs.promises.mkdir(path.join(nestedSkillDir, 'scripts'), { recursive: true });
      await fs.promises.writeFile(path.join(nestedSkillDir, 'SKILL.md'), 'content');
      await fs.promises.writeFile(path.join(nestedSkillDir, 'scripts', 'helper.py'), 'code');

      const result = await checkExistingSkill(nestedSkillDir);
      expect(result.exists).toBe(true);
      expect(result.files).toContain('SKILL.md');
      expect(result.files.some((f) => f.includes('helper.py'))).toBe(true);
    });
  });

  describe('backupExistingSkill', () => {
    it('creates a backup of existing skill directory', async () => {
      // Create a skill directory
      const skillDir = path.join(tempDir, 'skill-to-backup');
      await fs.promises.mkdir(skillDir, { recursive: true });
      await fs.promises.writeFile(path.join(skillDir, 'SKILL.md'), 'original content');

      const backupPath = await backupExistingSkill(skillDir);

      // Verify backup exists and contains files
      const backupExists = await fs.promises
        .access(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);

      const backupContent = await fs.promises.readFile(path.join(backupPath, 'SKILL.md'), 'utf-8');
      expect(backupContent).toBe('original content');

      // Clean up
      await cleanupBackup(backupPath);
    });
  });

  describe('extractSkillToTarget', () => {
    it('extracts files without the root directory prefix', async () => {
      const archive = openZipArchive(validSkillPath);
      const extractDir = path.join(tempDir, 'extract-target');
      await fs.promises.mkdir(extractDir, { recursive: true });

      const result = await extractSkillToTarget(archive, 'my-skill', extractDir);

      expect(result.fileCount).toBe(3); // SKILL.md, helper.py, README.md
      expect(result.files).toContain('SKILL.md');
      expect(result.files.some((f) => f.includes('helper.py'))).toBe(true);

      // Verify files exist directly in target (not in my-skill subdirectory)
      const skillMdExists = await fs.promises
        .access(path.join(extractDir, 'SKILL.md'))
        .then(() => true)
        .catch(() => false);
      expect(skillMdExists).toBe(true);

      // Verify nested files
      const helperExists = await fs.promises
        .access(path.join(extractDir, 'scripts', 'helper.py'))
        .then(() => true)
        .catch(() => false);
      expect(helperExists).toBe(true);
    });
  });

  describe('isPathWithinTarget (path traversal prevention)', () => {
    it('returns true for path directly in target', () => {
      const target = '/home/user/skills/my-skill';
      const resolved = '/home/user/skills/my-skill/file.txt';
      expect(isPathWithinTarget(target, resolved)).toBe(true);
    });

    it('returns true for path in subdirectory', () => {
      const target = '/home/user/skills/my-skill';
      const resolved = '/home/user/skills/my-skill/sub/dir/file.txt';
      expect(isPathWithinTarget(target, resolved)).toBe(true);
    });

    it('returns true for target directory itself', () => {
      const target = '/home/user/skills/my-skill';
      expect(isPathWithinTarget(target, target)).toBe(true);
    });

    it('returns false for path escaping with ../', () => {
      const target = '/home/user/skills/my-skill';
      const resolved = '/home/user/skills/escaped.txt';
      expect(isPathWithinTarget(target, resolved)).toBe(false);
    });

    it('returns false for path completely outside', () => {
      const target = '/home/user/skills/my-skill';
      const resolved = '/etc/passwd';
      expect(isPathWithinTarget(target, resolved)).toBe(false);
    });

    it('returns false for sibling directory', () => {
      const target = '/home/user/skills/my-skill';
      const resolved = '/home/user/skills/other-skill/file.txt';
      expect(isPathWithinTarget(target, resolved)).toBe(false);
    });
  });

  describe('postInstallValidation', () => {
    it('validates a valid installed skill', async () => {
      // Create a valid skill directory
      const skillDir = path.join(tempDir, 'valid-installed-skill');
      await fs.promises.mkdir(skillDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: valid-installed-skill\ndescription: Test\n---\n\n# Test'
      );

      const result = await postInstallValidation(skillDir);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors for invalid skill', async () => {
      // Create an invalid skill directory (missing required fields)
      const invalidDir = path.join(tempDir, 'invalid-installed-skill');
      await fs.promises.mkdir(invalidDir, { recursive: true });
      await fs.promises.writeFile(path.join(invalidDir, 'SKILL.md'), 'No frontmatter');

      const result = await postInstallValidation(invalidDir);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('rollbackInstallation', () => {
    it('removes the installation directory', async () => {
      // Create a directory to rollback
      const installDir = path.join(tempDir, 'install-to-rollback');
      await fs.promises.mkdir(installDir, { recursive: true });
      await fs.promises.writeFile(path.join(installDir, 'SKILL.md'), 'content');

      await rollbackInstallation(installDir);

      const exists = await fs.promises
        .access(installDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('restores from backup when provided', async () => {
      // Create original skill
      const originalDir = path.join(tempDir, 'original-skill');
      await fs.promises.mkdir(originalDir, { recursive: true });
      await fs.promises.writeFile(path.join(originalDir, 'SKILL.md'), 'original content');

      // Create backup
      const backupPath = await backupExistingSkill(originalDir);

      // Modify the original
      await fs.promises.writeFile(path.join(originalDir, 'SKILL.md'), 'modified content');

      // Rollback
      await rollbackInstallation(originalDir, backupPath);

      // Verify restored content
      const restoredContent = await fs.promises.readFile(
        path.join(originalDir, 'SKILL.md'),
        'utf-8'
      );
      expect(restoredContent).toBe('original content');
    });
  });

  describe('cleanupBackup', () => {
    it('removes backup directory', async () => {
      const backupDir = path.join(tempDir, 'backup-to-cleanup');
      await fs.promises.mkdir(backupDir, { recursive: true });
      await fs.promises.writeFile(path.join(backupDir, 'file.txt'), 'content');

      await cleanupBackup(backupDir);

      const exists = await fs.promises
        .access(backupDir)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('handles non-existent directory gracefully', async () => {
      await expect(cleanupBackup('/non/existent/path')).resolves.not.toThrow();
    });
  });

  describe('getSkillNameFromPackage', () => {
    it('returns skill name from valid package', () => {
      const archive = openZipArchive(validSkillPath);
      const name = getSkillNameFromPackage(archive);
      expect(name).toBe('my-skill');
    });

    it('returns null for package without root directory', () => {
      const archive = openZipArchive(noRootPath);
      const name = getSkillNameFromPackage(archive);
      expect(name).toBeNull();
    });
  });

  describe('calculateInstallSize', () => {
    it('returns total uncompressed size', () => {
      const archive = openZipArchive(validSkillPath);
      const size = calculateInstallSize(archive);

      // Size should be sum of all file contents
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('installSkill', () => {
    it('installs a valid package to target directory', async () => {
      const targetDir = path.join(tempDir, 'install-test-1');

      const result = await installSkill(validSkillPath, {
        scope: targetDir,
        force: true,
      });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      expect(result.success).toBe(true);
      expect(result.skillName).toBe('my-skill');
      expect(result.fileCount).toBe(3);
      expect(result.wasOverwritten).toBe(false);

      // Verify files exist
      const skillMdExists = await fs.promises
        .access(path.join(result.skillPath, 'SKILL.md'))
        .then(() => true)
        .catch(() => false);
      expect(skillMdExists).toBe(true);
    });

    it('returns OverwriteRequired when skill exists and force is false', async () => {
      // Create existing skill
      const targetDir = path.join(tempDir, 'install-test-2', 'my-skill');
      await fs.promises.mkdir(targetDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(targetDir, 'SKILL.md'),
        '---\nname: my-skill\ndescription: Existing\n---\n\n# Existing'
      );

      const result = await installSkill(validSkillPath, {
        scope: path.join(tempDir, 'install-test-2'),
        force: false,
      });

      if (!isOverwriteRequired(result)) {
        throw new Error('Expected OverwriteRequired');
      }

      expect(result.requiresOverwrite).toBe(true);
      expect(result.skillName).toBe('my-skill');
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('overwrites existing skill when force is true', async () => {
      // Create existing skill
      const targetDir = path.join(tempDir, 'install-test-3', 'my-skill');
      await fs.promises.mkdir(targetDir, { recursive: true });
      await fs.promises.writeFile(path.join(targetDir, 'SKILL.md'), 'original');

      const result = await installSkill(validSkillPath, {
        scope: path.join(tempDir, 'install-test-3'),
        force: true,
      });

      if (!isInstallResult(result)) {
        throw new Error('Expected InstallResult');
      }

      expect(result.success).toBe(true);
      expect(result.wasOverwritten).toBe(true);

      // Verify new content
      const content = await fs.promises.readFile(path.join(targetDir, 'SKILL.md'), 'utf-8');
      expect(content).toContain('name: my-skill');
    });

    it('returns DryRunPreview when dryRun is true', async () => {
      const targetDir = path.join(tempDir, 'install-test-dry-run');

      const result = await installSkill(validSkillPath, {
        scope: targetDir,
        dryRun: true,
      });

      if (!isDryRunPreview(result)) {
        throw new Error('Expected DryRunPreview');
      }

      expect(result.skillName).toBe('my-skill');
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.totalSize).toBeGreaterThan(0);
      expect(result.wouldOverwrite).toBe(false);

      // Verify nothing was actually installed
      const targetPath = path.join(targetDir, 'my-skill');
      const exists = await fs.promises
        .access(targetPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('throws InvalidPackageError for package with name mismatch', async () => {
      const targetDir = path.join(tempDir, 'install-test-mismatch');

      await expect(
        installSkill(nameMismatchPath, {
          scope: targetDir,
          force: true,
        })
      ).rejects.toThrow(InvalidPackageError);
    });

    it('throws InvalidPackageError for package without root directory', async () => {
      const targetDir = path.join(tempDir, 'install-test-no-root');

      await expect(
        installSkill(noRootPath, {
          scope: targetDir,
          force: true,
        })
      ).rejects.toThrow(InvalidPackageError);
    });

    it('throws InvalidPackageError for non-existent package', async () => {
      await expect(
        installSkill('/non/existent/package.skill', {
          scope: tempDir,
        })
      ).rejects.toThrow(InvalidPackageError);
    });
  });

  describe('type guards with discriminant fields', () => {
    describe('isOverwriteRequired', () => {
      it('returns true for OverwriteRequired with type discriminant', () => {
        const result = {
          type: 'overwrite-required' as const,
          requiresOverwrite: true as const,
          skillName: 'test',
          existingPath: '/path',
          files: [],
        };
        expect(isOverwriteRequired(result)).toBe(true);
      });

      it('returns false for InstallResult', () => {
        const result = {
          type: 'install-result' as const,
          success: true,
          skillPath: '/path',
          skillName: 'test',
          fileCount: 1,
          size: 100,
          wasOverwritten: false,
          errors: [],
        };
        expect(isOverwriteRequired(result)).toBe(false);
      });

      it('returns false for DryRunPreview', () => {
        const result = {
          type: 'dry-run-preview' as const,
          skillName: 'test',
          targetPath: '/path',
          files: [],
          totalSize: 100,
          wouldOverwrite: false,
          conflicts: [],
        };
        expect(isOverwriteRequired(result)).toBe(false);
      });
    });

    describe('isDryRunPreview', () => {
      it('returns true for DryRunPreview with type discriminant', () => {
        const result = {
          type: 'dry-run-preview' as const,
          skillName: 'test',
          targetPath: '/path',
          files: [],
          totalSize: 100,
          wouldOverwrite: false,
          conflicts: [],
        };
        expect(isDryRunPreview(result)).toBe(true);
      });

      it('returns false for InstallResult', () => {
        const result = {
          type: 'install-result' as const,
          success: true,
          skillPath: '/path',
          skillName: 'test',
          fileCount: 1,
          size: 100,
          wasOverwritten: false,
          errors: [],
        };
        expect(isDryRunPreview(result)).toBe(false);
      });

      it('returns false for OverwriteRequired', () => {
        const result = {
          type: 'overwrite-required' as const,
          requiresOverwrite: true as const,
          skillName: 'test',
          existingPath: '/path',
          files: [],
        };
        expect(isDryRunPreview(result)).toBe(false);
      });
    });

    describe('isInstallResult', () => {
      it('returns true for InstallResult with type discriminant', () => {
        const result = {
          type: 'install-result' as const,
          success: true,
          skillPath: '/path',
          skillName: 'test',
          fileCount: 1,
          size: 100,
          wasOverwritten: false,
          errors: [],
        };
        expect(isInstallResult(result)).toBe(true);
      });

      it('returns false for DryRunPreview', () => {
        const result = {
          type: 'dry-run-preview' as const,
          skillName: 'test',
          targetPath: '/path',
          files: [],
          totalSize: 100,
          wouldOverwrite: false,
          conflicts: [],
        };
        expect(isInstallResult(result)).toBe(false);
      });

      it('returns false for OverwriteRequired', () => {
        const result = {
          type: 'overwrite-required' as const,
          requiresOverwrite: true as const,
          skillName: 'test',
          existingPath: '/path',
          files: [],
        };
        expect(isInstallResult(result)).toBe(false);
      });
    });

    describe('type narrowing flow', () => {
      it('correctly narrows types through discriminant checks', () => {
        // Simulate results from installSkill
        const results = [
          {
            type: 'install-result' as const,
            success: true,
            skillPath: '/path',
            skillName: 'test',
            fileCount: 1,
            size: 100,
            wasOverwritten: false,
            errors: [],
          },
          {
            type: 'dry-run-preview' as const,
            skillName: 'test',
            targetPath: '/path',
            files: [],
            totalSize: 100,
            wouldOverwrite: false,
            conflicts: [],
          },
          {
            type: 'overwrite-required' as const,
            requiresOverwrite: true as const,
            skillName: 'test',
            existingPath: '/path',
            files: [],
          },
        ];

        const installResults = results.filter(isInstallResult);
        const dryRunPreviews = results.filter(isDryRunPreview);
        const overwriteRequireds = results.filter(isOverwriteRequired);

        expect(installResults).toHaveLength(1);
        expect(dryRunPreviews).toHaveLength(1);
        expect(overwriteRequireds).toHaveLength(1);

        // Verify each filtered result has the correct type
        expect(installResults[0].type).toBe('install-result');
        expect(dryRunPreviews[0].type).toBe('dry-run-preview');
        expect(overwriteRequireds[0].type).toBe('overwrite-required');
      });
    });
  });
});
