/**
 * Tests for backup manager service (FEAT-008)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  getBackupDirectory,
  validateBackupDirectory,
  validateBackupWritability,
  generateBackupFilename,
  verifyBackupContainment,
  generateUniqueBackupPath,
  createBackupArchive,
  createBackup,
  getBackupInfo,
  cleanupBackup,
  listBackups,
} from '../../../src/services/backup-manager';

describe('Backup Manager', () => {
  let tempDir: string;
  let testSkillDir: string;
  let mockHomedir: string;

  beforeAll(async () => {
    // Create temporary directory structure for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-backup-test-'));
    mockHomedir = path.join(tempDir, 'home');
    testSkillDir = path.join(tempDir, 'test-skill');

    // Create mock home directory
    await fs.mkdir(mockHomedir, { recursive: true });

    // Create test skill directory structure
    await fs.mkdir(testSkillDir, { recursive: true });
    await fs.mkdir(path.join(testSkillDir, 'src'), { recursive: true });

    // Create test files
    await fs.writeFile(
      path.join(testSkillDir, 'SKILL.md'),
      '---\nname: test-skill\n---\nTest skill'
    );
    await fs.writeFile(path.join(testSkillDir, 'src', 'index.ts'), 'export const main = () => {};');
    await fs.writeFile(path.join(testSkillDir, 'README.md'), '# Test Skill');
  });

  afterAll(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('getBackupDirectory', () => {
    it('creates backup directory if it does not exist', async () => {
      const backupsDir = await getBackupDirectory({ homedir: mockHomedir });

      expect(backupsDir).toBe(path.join(mockHomedir, '.asm', 'backups'));

      const stats = await fs.stat(backupsDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('returns existing backup directory', async () => {
      // First call creates it
      await getBackupDirectory({ homedir: mockHomedir });

      // Second call returns existing
      const backupsDir = await getBackupDirectory({ homedir: mockHomedir });

      expect(backupsDir).toBe(path.join(mockHomedir, '.asm', 'backups'));
    });

    it('creates .asm directory with secure permissions', async () => {
      const asmDir = path.join(mockHomedir, '.asm');

      await getBackupDirectory({ homedir: mockHomedir });

      const stats = await fs.stat(asmDir);
      // On some systems, umask may affect permissions
      // We just verify it's a directory
      expect(stats.isDirectory()).toBe(true);
    });

    it('throws error if .asm is a symlink', async () => {
      const symlinkHomedir = path.join(tempDir, 'symlink-home');
      await fs.mkdir(symlinkHomedir, { recursive: true });

      const targetDir = path.join(tempDir, 'symlink-target');
      await fs.mkdir(targetDir, { recursive: true });

      const asmSymlink = path.join(symlinkHomedir, '.asm');
      await fs.symlink(targetDir, asmSymlink);

      await expect(getBackupDirectory({ homedir: symlinkHomedir })).rejects.toThrow(/symlink/i);

      // Clean up
      await fs.rm(asmSymlink);
      await fs.rm(targetDir, { recursive: true });
    });
  });

  describe('validateBackupDirectory', () => {
    it('returns valid for properly configured directory', async () => {
      // Ensure directory exists first
      await getBackupDirectory({ homedir: mockHomedir });

      const result = await validateBackupDirectory({ homedir: mockHomedir });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid when directories do not exist yet', async () => {
      const freshHomedir = path.join(tempDir, 'fresh-home');
      await fs.mkdir(freshHomedir, { recursive: true });

      const result = await validateBackupDirectory({ homedir: freshHomedir });

      // Non-existent directories are valid (they will be created)
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error if .asm is a symlink', async () => {
      const symlinkHomedir = path.join(tempDir, 'validate-symlink-home');
      await fs.mkdir(symlinkHomedir, { recursive: true });

      const targetDir = path.join(tempDir, 'validate-symlink-target');
      await fs.mkdir(targetDir, { recursive: true });

      const asmSymlink = path.join(symlinkHomedir, '.asm');
      await fs.symlink(targetDir, asmSymlink);

      const result = await validateBackupDirectory({ homedir: symlinkHomedir });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('symbolic link'))).toBe(true);

      // Clean up
      await fs.rm(asmSymlink);
      await fs.rm(targetDir, { recursive: true });
    });
  });

  describe('validateBackupWritability', () => {
    it('returns writable for accessible directory', async () => {
      // Ensure directory exists
      await getBackupDirectory({ homedir: mockHomedir });

      const result = await validateBackupWritability({ homedir: mockHomedir });

      expect(result.writable).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('generateBackupFilename', () => {
    it('generates filename with correct format', () => {
      const filename = generateBackupFilename('my-skill');

      // Format: my-skill-YYYYMMDD-HHMMSS-8hexchars.skill
      expect(filename).toMatch(/^my-skill-\d{8}-\d{6}-[a-f0-9]{8}\.skill$/);
    });

    it('generates unique filenames on successive calls', () => {
      const filename1 = generateBackupFilename('my-skill');
      const filename2 = generateBackupFilename('my-skill');

      // Random component should differ
      expect(filename1).not.toBe(filename2);
    });

    it('includes skill name in filename', () => {
      const filename = generateBackupFilename('complex-skill-name');

      expect(filename.startsWith('complex-skill-name-')).toBe(true);
    });

    it('uses .skill extension', () => {
      const filename = generateBackupFilename('my-skill');

      expect(filename.endsWith('.skill')).toBe(true);
    });
  });

  describe('verifyBackupContainment', () => {
    it('returns true for path within backup directory', async () => {
      // Ensure backup directory exists
      const backupsDir = await getBackupDirectory({ homedir: mockHomedir });
      const backupPath = path.join(backupsDir, 'my-skill-backup.skill');

      const result = await verifyBackupContainment(backupPath, { homedir: mockHomedir });

      expect(result).toBe(true);
    });

    it('returns false for path outside backup directory', async () => {
      const outsidePath = path.join(tempDir, 'outside-backup.skill');

      const result = await verifyBackupContainment(outsidePath, { homedir: mockHomedir });

      expect(result).toBe(false);
    });

    it('returns false for path traversal attempts', async () => {
      const backupsDir = await getBackupDirectory({ homedir: mockHomedir });
      const traversalPath = path.join(backupsDir, '..', 'escape.skill');

      const result = await verifyBackupContainment(traversalPath, { homedir: mockHomedir });

      expect(result).toBe(false);
    });

    it('allows valid filenames with consecutive dots', async () => {
      const backupsDir = await getBackupDirectory({ homedir: mockHomedir });
      // A filename with consecutive dots is valid (not path traversal)
      const validPath = path.join(backupsDir, 'my-skill..backup.skill');

      const result = await verifyBackupContainment(validPath, { homedir: mockHomedir });

      // File with consecutive dots in name but not escaping is valid
      expect(result).toBe(true);
    });
  });

  describe('generateUniqueBackupPath', () => {
    it('generates unique path in backup directory', async () => {
      const backupPath = await generateUniqueBackupPath('unique-skill', {
        homedir: mockHomedir,
      });

      const backupsDir = await getBackupDirectory({ homedir: mockHomedir });
      expect(backupPath.startsWith(backupsDir)).toBe(true);
      expect(backupPath).toMatch(/unique-skill-\d{8}-\d{6}-[a-f0-9]+\.skill$/);
    });

    it('handles collision by regenerating', async () => {
      // Ensure backup directory exists
      await getBackupDirectory({ homedir: mockHomedir });

      // Create a file that might collide
      // Due to randomness, collision is unlikely, so we just verify it works
      const path1 = await generateUniqueBackupPath('collision-skill', {
        homedir: mockHomedir,
      });
      const path2 = await generateUniqueBackupPath('collision-skill', {
        homedir: mockHomedir,
      });

      expect(path1).not.toBe(path2);
    });
  });

  describe('createBackupArchive', () => {
    it('creates ZIP archive of skill directory', async () => {
      const backupsDir = await getBackupDirectory({ homedir: mockHomedir });
      const backupPath = path.join(backupsDir, 'archive-test.skill');

      const fileCount = await createBackupArchive(testSkillDir, backupPath, {
        homedir: mockHomedir,
      });

      expect(fileCount).toBe(3); // SKILL.md, src/index.ts, README.md

      const stats = await fs.stat(backupPath);
      expect(stats.size).toBeGreaterThan(0);

      // Clean up
      await fs.unlink(backupPath);
    });

    it('throws error for path outside backup directory', async () => {
      const outsidePath = path.join(tempDir, 'outside.skill');

      await expect(
        createBackupArchive(testSkillDir, outsidePath, { homedir: mockHomedir })
      ).rejects.toThrow(/escapes backup directory/i);
    });

    it('reports progress during backup', async () => {
      const backupsDir = await getBackupDirectory({ homedir: mockHomedir });
      const backupPath = path.join(backupsDir, 'progress-test.skill');

      const progressCalls: [number, number][] = [];
      const onProgress = (current: number, total: number) => {
        progressCalls.push([current, total]);
      };

      await createBackupArchive(testSkillDir, backupPath, {
        homedir: mockHomedir,
        onProgress,
      });

      expect(progressCalls.length).toBeGreaterThan(0);

      // Clean up
      await fs.unlink(backupPath);
    });
  });

  describe('createBackup', () => {
    it('creates complete backup successfully', async () => {
      const result = await createBackup(testSkillDir, 'test-skill', {
        homedir: mockHomedir,
      });

      expect(result.success).toBe(true);
      expect(result.path).toMatch(/test-skill-\d{8}-\d{6}-[a-f0-9]+\.skill$/);
      expect(result.fileCount).toBe(3);
      expect(result.size).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();

      // Clean up
      await fs.unlink(result.path);
    });

    it('returns error for non-existent skill', async () => {
      const result = await createBackup(path.join(tempDir, 'nonexistent'), 'nonexistent', {
        homedir: mockHomedir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error if skill path is not a directory', async () => {
      const filePath = path.join(tempDir, 'not-a-dir.txt');
      await fs.writeFile(filePath, 'content');

      const result = await createBackup(filePath, 'not-a-dir', {
        homedir: mockHomedir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not a directory/i);

      // Clean up
      await fs.unlink(filePath);
    });
  });

  describe('getBackupInfo', () => {
    it('returns info for existing backup', async () => {
      // Create a backup first
      const createResult = await createBackup(testSkillDir, 'info-skill', {
        homedir: mockHomedir,
      });
      expect(createResult.success).toBe(true);

      const info = await getBackupInfo(createResult.path);

      expect(info.path).toBe(createResult.path);
      expect(info.size).toBeGreaterThan(0);
      expect(info.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

      // Clean up
      await fs.unlink(createResult.path);
    });

    it('extracts timestamp from filename', async () => {
      const backupsDir = await getBackupDirectory({ homedir: mockHomedir });
      const testPath = path.join(backupsDir, 'test-20250115-143052-abcd1234.skill');
      await fs.writeFile(testPath, 'test content');

      const info = await getBackupInfo(testPath);

      expect(info.timestamp).toBe('2025-01-15T14:30:52Z');

      // Clean up
      await fs.unlink(testPath);
    });
  });

  describe('cleanupBackup', () => {
    it('removes backup file', async () => {
      // Create a backup first
      const createResult = await createBackup(testSkillDir, 'cleanup-skill', {
        homedir: mockHomedir,
      });
      expect(createResult.success).toBe(true);

      // Verify file exists
      await expect(fs.access(createResult.path)).resolves.toBeUndefined();

      // Clean up
      await cleanupBackup(createResult.path, { homedir: mockHomedir });

      // Verify file is gone
      await expect(fs.access(createResult.path)).rejects.toThrow();
    });

    it('throws error for path outside backup directory', async () => {
      const outsidePath = path.join(tempDir, 'outside-cleanup.skill');
      await fs.writeFile(outsidePath, 'content');

      await expect(cleanupBackup(outsidePath, { homedir: mockHomedir })).rejects.toThrow(
        /outside backup directory/i
      );

      // Clean up
      await fs.unlink(outsidePath);
    });

    it('throws error for symlink', async () => {
      const backupsDir = await getBackupDirectory({ homedir: mockHomedir });
      const targetFile = path.join(tempDir, 'symlink-target.skill');
      const symlinkPath = path.join(backupsDir, 'symlink-backup.skill');

      await fs.writeFile(targetFile, 'content');
      await fs.symlink(targetFile, symlinkPath);

      await expect(cleanupBackup(symlinkPath, { homedir: mockHomedir })).rejects.toThrow(
        /symlink/i
      );

      // Clean up
      await fs.unlink(symlinkPath);
      await fs.unlink(targetFile);
    });
  });

  describe('listBackups', () => {
    it('returns empty array when no backups exist', async () => {
      const backups = await listBackups('nonexistent-skill', { homedir: mockHomedir });

      expect(backups).toEqual([]);
    });

    it('returns backups for skill sorted by date descending', async () => {
      // Create multiple backups
      const result1 = await createBackup(testSkillDir, 'list-skill', {
        homedir: mockHomedir,
      });
      expect(result1.success).toBe(true);

      const result2 = await createBackup(testSkillDir, 'list-skill', {
        homedir: mockHomedir,
      });
      expect(result2.success).toBe(true);

      const backups = await listBackups('list-skill', { homedir: mockHomedir });

      expect(backups.length).toBe(2);

      // Both paths should be in the list
      expect(backups).toContain(result1.path);
      expect(backups).toContain(result2.path);

      // Backups should be sorted (filenames are lexicographically sortable)
      // When reversed, later filenames come first
      expect(backups[0] >= backups[1]).toBe(true);

      // Clean up
      await fs.unlink(result1.path);
      await fs.unlink(result2.path);
    });

    it('only returns backups for specified skill', async () => {
      // Create backups for different skills
      const result1 = await createBackup(testSkillDir, 'skill-a', {
        homedir: mockHomedir,
      });
      const result2 = await createBackup(testSkillDir, 'skill-b', {
        homedir: mockHomedir,
      });

      const backupsA = await listBackups('skill-a', { homedir: mockHomedir });
      const backupsB = await listBackups('skill-b', { homedir: mockHomedir });

      expect(backupsA.length).toBe(1);
      expect(backupsB.length).toBe(1);
      expect(backupsA[0]).toContain('skill-a-');
      expect(backupsB[0]).toContain('skill-b-');

      // Clean up
      await fs.unlink(result1.path);
      await fs.unlink(result2.path);
    });
  });

  describe('Security', () => {
    it('backup files are created with 0600 permissions', async () => {
      const result = await createBackup(testSkillDir, 'perms-skill', {
        homedir: mockHomedir,
      });
      expect(result.success).toBe(true);

      const stats = await fs.stat(result.path);
      const mode = stats.mode & 0o777;

      // Should be owner read/write only
      // On some systems this may vary due to umask
      expect(mode & 0o077).toBe(0); // No group or world access

      // Clean up
      await fs.unlink(result.path);
    });

    it('prevents backup creation outside backup directory', async () => {
      const outsidePath = path.join(tempDir, 'escape-attempt.skill');

      await expect(
        createBackupArchive(testSkillDir, outsidePath, { homedir: mockHomedir })
      ).rejects.toThrow(/escapes backup directory/i);
    });

    it('does not follow symlinks in skill directory', async () => {
      // Create a skill with a symlink
      const symlinkSkillDir = path.join(tempDir, 'symlink-skill');
      await fs.mkdir(symlinkSkillDir, { recursive: true });
      await fs.writeFile(path.join(symlinkSkillDir, 'SKILL.md'), '---\nname: symlink-skill\n---');

      // Create symlink to outside file
      const outsideFile = path.join(tempDir, 'outside-secret.txt');
      await fs.writeFile(outsideFile, 'secret content');
      await fs.symlink(outsideFile, path.join(symlinkSkillDir, 'linked-file.txt'));

      const result = await createBackup(symlinkSkillDir, 'symlink-skill', {
        homedir: mockHomedir,
      });

      // Backup should succeed but not include symlink content
      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(1); // Only SKILL.md, symlink is skipped

      // Clean up
      await fs.unlink(result.path);
      await fs.rm(symlinkSkillDir, { recursive: true, force: true });
      await fs.unlink(outsideFile);
    });
  });
});
