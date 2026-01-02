/**
 * Tests for audit logger utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  formatAuditEntry,
  getAuditLogPath,
  getAsmDataDir,
  logUninstallOperation,
  readAuditLog,
  createSuccessEntry,
  createFailureEntry,
  createPartialEntry,
  setAuditBaseDir,
  AuditLogEntry,
} from '../../../src/utils/audit-logger';

describe('Audit Logger', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory to use as base
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-audit-test-'));

    // Set the base directory for testing
    setAuditBaseDir(tempDir);
  });

  afterEach(async () => {
    // Reset to default
    setAuditBaseDir(null);

    // Clean up temp directory
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getAsmDataDir', () => {
    it('returns ~/.asm path', () => {
      const dataDir = getAsmDataDir();

      expect(dataDir).toBe(path.join(tempDir, '.asm'));
    });
  });

  describe('getAuditLogPath', () => {
    it('returns ~/.asm/audit.log path', () => {
      const logPath = getAuditLogPath();

      expect(logPath).toBe(path.join(tempDir, '.asm', 'audit.log'));
    });
  });

  describe('formatAuditEntry', () => {
    it('formats a success entry correctly', () => {
      const entry: AuditLogEntry = {
        operation: 'UNINSTALL',
        skillName: 'my-skill',
        scope: 'project',
        status: 'SUCCESS',
        filesRemoved: 4,
        bytesFreed: 7800,
        skillPath: '/path/to/skill',
      };

      const formatted = formatAuditEntry(entry);

      // Check format: [timestamp] OPERATION skill-name scope STATUS key=value...
      expect(formatted).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      expect(formatted).toContain('UNINSTALL');
      expect(formatted).toContain('my-skill');
      expect(formatted).toContain('project');
      expect(formatted).toContain('SUCCESS');
      expect(formatted).toContain('removed=4');
      expect(formatted).toContain('size=7800');
      expect(formatted).toContain('path=/path/to/skill');
    });

    it('formats a failure entry with error details', () => {
      const entry: AuditLogEntry = {
        operation: 'UNINSTALL',
        skillName: 'bad-skill',
        scope: 'personal',
        status: 'SECURITY_BLOCKED',
        errorDetails: 'symlink_escape=/etc/passwd',
      };

      const formatted = formatAuditEntry(entry);

      expect(formatted).toContain('UNINSTALL');
      expect(formatted).toContain('bad-skill');
      expect(formatted).toContain('personal');
      expect(formatted).toContain('SECURITY_BLOCKED');
      expect(formatted).toContain('error=symlink_escape=/etc/passwd');
    });

    it('escapes spaces in paths', () => {
      const entry: AuditLogEntry = {
        operation: 'UNINSTALL',
        skillName: 'my-skill',
        scope: 'project',
        status: 'SUCCESS',
        skillPath: '/path with/spaces/skill',
      };

      const formatted = formatAuditEntry(entry);

      expect(formatted).toContain('path=/path\\ with/spaces/skill');
    });

    it('truncates long error details', () => {
      const longError = 'x'.repeat(300);
      const entry: AuditLogEntry = {
        operation: 'UNINSTALL',
        skillName: 'my-skill',
        scope: 'project',
        status: 'FAILED',
        errorDetails: longError,
      };

      const formatted = formatAuditEntry(entry);

      // Error should be truncated to 200 chars
      const errorMatch = formatted.match(/error=([^\s]+)/);
      expect(errorMatch).toBeDefined();
      expect(errorMatch).not.toBeNull();
      if (errorMatch) {
        expect(errorMatch[1].length).toBeLessThanOrEqual(200);
      }
    });

    it('replaces newlines in error details', () => {
      const entry: AuditLogEntry = {
        operation: 'UNINSTALL',
        skillName: 'my-skill',
        scope: 'project',
        status: 'FAILED',
        errorDetails: 'line1\nline2\nline3',
      };

      const formatted = formatAuditEntry(entry);

      expect(formatted).not.toContain('\n');
      expect(formatted).toContain('error=line1_line2_line3');
    });

    it('handles minimal entry', () => {
      const entry: AuditLogEntry = {
        operation: 'UNINSTALL',
        skillName: 'my-skill',
        scope: 'project',
        status: 'CANCELLED',
      };

      const formatted = formatAuditEntry(entry);

      expect(formatted).toContain('UNINSTALL');
      expect(formatted).toContain('my-skill');
      expect(formatted).toContain('project');
      expect(formatted).toContain('CANCELLED');
      expect(formatted).not.toContain('removed=');
      expect(formatted).not.toContain('size=');
      expect(formatted).not.toContain('path=');
      expect(formatted).not.toContain('error=');
    });
  });

  describe('logUninstallOperation', () => {
    it('creates .asm directory if not exists', async () => {
      const entry: AuditLogEntry = {
        operation: 'UNINSTALL',
        skillName: 'my-skill',
        scope: 'project',
        status: 'SUCCESS',
      };

      await logUninstallOperation(entry);

      const dataDir = getAsmDataDir();
      const stats = await fs.promises.stat(dataDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('creates audit.log file if not exists', async () => {
      const entry: AuditLogEntry = {
        operation: 'UNINSTALL',
        skillName: 'my-skill',
        scope: 'project',
        status: 'SUCCESS',
      };

      await logUninstallOperation(entry);

      const logPath = getAuditLogPath();
      const stats = await fs.promises.stat(logPath);
      expect(stats.isFile()).toBe(true);
    });

    it('appends to existing log file', async () => {
      const entry1: AuditLogEntry = {
        operation: 'UNINSTALL',
        skillName: 'skill-1',
        scope: 'project',
        status: 'SUCCESS',
      };
      const entry2: AuditLogEntry = {
        operation: 'UNINSTALL',
        skillName: 'skill-2',
        scope: 'personal',
        status: 'FAILED',
      };

      await logUninstallOperation(entry1);
      await logUninstallOperation(entry2);

      const logPath = getAuditLogPath();
      const content = await fs.promises.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('skill-1');
      expect(lines[1]).toContain('skill-2');
    });

    it('writes entries with newlines', async () => {
      const entry: AuditLogEntry = {
        operation: 'UNINSTALL',
        skillName: 'my-skill',
        scope: 'project',
        status: 'SUCCESS',
      };

      await logUninstallOperation(entry);

      const logPath = getAuditLogPath();
      const content = await fs.promises.readFile(logPath, 'utf-8');

      expect(content.endsWith('\n')).toBe(true);
    });
  });

  describe('readAuditLog', () => {
    it('returns empty array when log does not exist', async () => {
      const lines = await readAuditLog();

      expect(lines).toEqual([]);
    });

    it('returns all lines from log', async () => {
      // Create some entries
      await logUninstallOperation({
        operation: 'UNINSTALL',
        skillName: 'skill-1',
        scope: 'project',
        status: 'SUCCESS',
      });
      await logUninstallOperation({
        operation: 'UNINSTALL',
        skillName: 'skill-2',
        scope: 'personal',
        status: 'FAILED',
      });
      await logUninstallOperation({
        operation: 'UNINSTALL',
        skillName: 'skill-3',
        scope: 'project',
        status: 'CANCELLED',
      });

      const lines = await readAuditLog();

      expect(lines.length).toBe(3);
      expect(lines[0]).toContain('skill-1');
      expect(lines[1]).toContain('skill-2');
      expect(lines[2]).toContain('skill-3');
    });

    it('respects limit parameter', async () => {
      // Create multiple entries
      for (let i = 1; i <= 5; i++) {
        await logUninstallOperation({
          operation: 'UNINSTALL',
          skillName: `skill-${i}`,
          scope: 'project',
          status: 'SUCCESS',
        });
      }

      const lines = await readAuditLog(2);

      expect(lines.length).toBe(2);
      // Should return last 2 entries
      expect(lines[0]).toContain('skill-4');
      expect(lines[1]).toContain('skill-5');
    });
  });

  describe('createSuccessEntry', () => {
    it('creates a properly formatted success entry', () => {
      const entry = createSuccessEntry('my-skill', 'project', 10, 5000, '/path/to/skill');

      expect(entry.operation).toBe('UNINSTALL');
      expect(entry.skillName).toBe('my-skill');
      expect(entry.scope).toBe('project');
      expect(entry.status).toBe('SUCCESS');
      expect(entry.filesRemoved).toBe(10);
      expect(entry.bytesFreed).toBe(5000);
      expect(entry.skillPath).toBe('/path/to/skill');
    });
  });

  describe('createFailureEntry', () => {
    it('creates a properly formatted failure entry', () => {
      const entry = createFailureEntry(
        'bad-skill',
        'personal',
        'SECURITY_BLOCKED',
        'symlink escape detected',
        '/path/to/skill'
      );

      expect(entry.operation).toBe('UNINSTALL');
      expect(entry.skillName).toBe('bad-skill');
      expect(entry.scope).toBe('personal');
      expect(entry.status).toBe('SECURITY_BLOCKED');
      expect(entry.errorDetails).toBe('symlink escape detected');
      expect(entry.skillPath).toBe('/path/to/skill');
    });

    it('handles missing skill path', () => {
      const entry = createFailureEntry('bad-skill', 'project', 'NOT_FOUND', 'Skill not found');

      expect(entry.skillPath).toBeUndefined();
    });
  });

  describe('createPartialEntry', () => {
    it('creates a properly formatted partial entry', () => {
      const entry = createPartialEntry(
        'partial-skill',
        'project',
        5,
        3,
        'Permission denied',
        '/path/to/skill'
      );

      expect(entry.operation).toBe('UNINSTALL');
      expect(entry.skillName).toBe('partial-skill');
      expect(entry.scope).toBe('project');
      expect(entry.status).toBe('PARTIAL');
      expect(entry.filesRemoved).toBe(5);
      expect(entry.errorDetails).toBe('3 files remaining: Permission denied');
      expect(entry.skillPath).toBe('/path/to/skill');
    });
  });
});
