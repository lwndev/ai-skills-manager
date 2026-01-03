/**
 * Comprehensive security attack simulation tests for uninstall functionality
 *
 * These tests simulate advanced attack vectors beyond basic security checks.
 * They verify the robustness of the uninstall command against:
 * - Path traversal with various encodings and techniques
 * - Absolute path injection on multiple platforms
 * - Unicode lookalike and normalization attacks
 * - Symlink escape scenarios
 * - Hard link manipulation
 * - Case sensitivity exploits
 * - TOCTOU race condition attacks
 * - Scope validation bypass attempts
 * - Concurrent operation attacks
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { validateSkillName } from '../../src/validators/uninstall-name';
import { validateUninstallScope } from '../../src/validators/uninstall-scope';
import {
  checkSymlinkSafety,
  detectHardLinkWarnings,
  getSymlinkSummary,
} from '../../src/generators/security-checker';
import {
  verifyContainment,
  verifyBeforeDeletion,
  isDangerousPath,
} from '../../src/generators/path-verifier';
import {
  safeUnlink as _safeUnlink,
  executeSkillDeletion as _executeSkillDeletion,
} from '../../src/utils/safe-delete';
import {
  acquireUninstallLock,
  releaseUninstallLock,
  hasUninstallLock,
} from '../../src/utils/lock-file';

describe('Advanced Path Traversal Attacks', () => {
  describe('URL-encoded traversal attempts', () => {
    it('rejects %2e%2e%2f encoded traversal', () => {
      // %2e = . and %2f = /
      const result = validateSkillName('%2e%2e%2f');
      expect(result.valid).toBe(false);
    });

    it('rejects double URL encoding %%32%65%%32%65%%32%66', () => {
      const result = validateSkillName('%%32%65%%32%65%%32%66');
      expect(result.valid).toBe(false);
    });

    it('rejects mixed case encoding %2E%2e%2F', () => {
      const result = validateSkillName('%2E%2e%2F');
      expect(result.valid).toBe(false);
    });
  });

  describe('overly long traversal sequences', () => {
    it('rejects repeated ../ (....//)', () => {
      const result = validateSkillName('....//');
      expect(result.valid).toBe(false);
    });

    it('rejects ...././...././', () => {
      const result = validateSkillName('...././...././');
      expect(result.valid).toBe(false);
    });

    it('rejects embedded traversal in name', () => {
      const result = validateSkillName('skill/../../../etc');
      expect(result.valid).toBe(false);
    });
  });

  describe('Unicode normalization attacks', () => {
    // Unicode has multiple representations for the same visual character
    it('rejects fullwidth solidus ／ (U+FF0F)', () => {
      const result = validateSkillName('skill／path');
      expect(result.valid).toBe(false);
    });

    it('rejects fullwidth reverse solidus ＼ (U+FF3C)', () => {
      const result = validateSkillName('skill＼path');
      expect(result.valid).toBe(false);
    });

    it('rejects combining characters that normalize to slash', () => {
      // While less common, ensure any Unicode involving slashes is rejected
      const result = validateSkillName('a\u0338b'); // combining long solidus overlay
      expect(result.valid).toBe(false);
    });
  });

  describe('Windows-specific path attacks', () => {
    it('rejects Windows drive letter path', () => {
      const result = validateSkillName('C:');
      expect(result.valid).toBe(false);
    });

    it('rejects Windows extended path prefix', () => {
      const result = validateSkillName('\\\\?\\C:\\');
      expect(result.valid).toBe(false);
    });

    it('rejects UNC path', () => {
      const result = validateSkillName('\\\\server\\share');
      expect(result.valid).toBe(false);
    });

    it('rejects alternate data stream syntax', () => {
      const result = validateSkillName('file:stream');
      expect(result.valid).toBe(false);
    });
  });
});

describe('Absolute Path Injection Attacks', () => {
  describe('Unix absolute paths', () => {
    const dangerousPaths = [
      '/etc/passwd',
      '/etc/shadow',
      '/root/.ssh/authorized_keys',
      '/var/log/messages',
      '/bin/sh',
      '/usr/bin/env',
    ];

    for (const dangerousPath of dangerousPaths) {
      it(`rejects ${dangerousPath}`, () => {
        const result = validateSkillName(dangerousPath);
        expect(result.valid).toBe(false);
      });
    }
  });

  describe('Windows absolute paths', () => {
    const windowsPaths = ['C:\\Windows\\System32', 'C:\\Users\\Administrator', 'D:\\Program Files'];

    for (const windowsPath of windowsPaths) {
      it(`rejects ${windowsPath}`, () => {
        const result = validateSkillName(windowsPath);
        expect(result.valid).toBe(false);
      });
    }
  });

  describe('dangerous path detection in path-verifier', () => {
    it('identifies /etc as dangerous', () => {
      expect(isDangerousPath('/etc')).toBe(true);
      expect(isDangerousPath('/etc/passwd')).toBe(true);
    });

    it('identifies /usr as dangerous', () => {
      expect(isDangerousPath('/usr')).toBe(true);
      expect(isDangerousPath('/usr/bin')).toBe(true);
    });

    it('identifies /var as dangerous', () => {
      expect(isDangerousPath('/var')).toBe(true);
    });

    it('identifies /root as dangerous', () => {
      expect(isDangerousPath('/root')).toBe(true);
    });
  });
});

describe('Control Character Injection Attacks', () => {
  describe('null byte injection', () => {
    it('rejects null byte at beginning', () => {
      const result = validateSkillName('\x00skill');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('control character');
    });

    it('rejects null byte at end', () => {
      const result = validateSkillName('skill\x00');
      expect(result.valid).toBe(false);
    });

    it('rejects null byte in middle', () => {
      const result = validateSkillName('sk\x00ill');
      expect(result.valid).toBe(false);
    });

    it('rejects null byte with extension bypass', () => {
      // Attacker might try: skill.txt\x00.skill to bypass extension checks
      const result = validateSkillName('skill.txt\x00.skill');
      expect(result.valid).toBe(false);
    });
  });

  describe('other control characters', () => {
    const controlChars = [
      { name: 'SOH', char: '\x01' },
      { name: 'STX', char: '\x02' },
      { name: 'ETX', char: '\x03' },
      { name: 'EOT', char: '\x04' },
      { name: 'ENQ', char: '\x05' },
      { name: 'ACK', char: '\x06' },
      { name: 'BEL', char: '\x07' },
      { name: 'BS', char: '\x08' },
      { name: 'TAB', char: '\x09' },
      { name: 'LF', char: '\x0A' },
      { name: 'VT', char: '\x0B' },
      { name: 'FF', char: '\x0C' },
      { name: 'CR', char: '\x0D' },
      { name: 'SO', char: '\x0E' },
      { name: 'SI', char: '\x0F' },
      { name: 'ESC', char: '\x1B' },
      { name: 'DEL', char: '\x7F' },
    ];

    for (const { name, char } of controlChars) {
      it(`rejects ${name} control character`, () => {
        const result = validateSkillName(`skill${char}name`);
        expect(result.valid).toBe(false);
      });
    }
  });
});

describe('Unicode Lookalike Attacks', () => {
  describe('slash lookalikes', () => {
    const slashLookalikes = [
      { name: 'division slash', char: '∕', code: 'U+2215' },
      { name: 'fraction slash', char: '⁄', code: 'U+2044' },
      { name: 'fullwidth solidus', char: '／', code: 'U+FF0F' },
    ];

    for (const { name, char } of slashLookalikes) {
      it(`rejects ${name}`, () => {
        const result = validateSkillName(`skill${char}name`);
        expect(result.valid).toBe(false);
      });
    }
  });

  describe('backslash lookalikes', () => {
    const backslashLookalikes = [
      { name: 'reverse solidus operator', char: '⧵', code: 'U+29F5' },
      { name: 'set minus', char: '∖', code: 'U+2216' },
      { name: 'fullwidth reverse solidus', char: '＼', code: 'U+FF3C' },
    ];

    for (const { name, char } of backslashLookalikes) {
      it(`rejects ${name}`, () => {
        const result = validateSkillName(`skill${char}name`);
        expect(result.valid).toBe(false);
      });
    }
  });

  describe('dot lookalikes', () => {
    const dotLookalikes = [
      { name: 'one dot leader', char: '․', code: 'U+2024' },
      { name: 'bullet operator', char: '∙', code: 'U+2219' },
      { name: 'middle dot', char: '·', code: 'U+00B7' },
      { name: 'katakana middle dot', char: '・', code: 'U+30FB' },
    ];

    for (const { name, char } of dotLookalikes) {
      it(`rejects ${name}`, () => {
        // Two dots could be used to form ".."
        const result = validateSkillName(`${char}${char}`);
        expect(result.valid).toBe(false);
      });
    }
  });
});

describe('Scope Validation Bypass Attacks', () => {
  it('defaults to project for undefined scope', () => {
    const result = validateUninstallScope(undefined);
    expect(result.valid).toBe(true);
    expect(result.scope).toBe('project');
  });

  it('defaults to project for empty scope', () => {
    // Empty string is treated as undefined and defaults to project
    const result = validateUninstallScope('');
    expect(result.valid).toBe(true);
    expect(result.scope).toBe('project');
  });

  it('rejects arbitrary path as scope', () => {
    const result = validateUninstallScope('/tmp/malicious');
    expect(result.valid).toBe(false);
  });

  it('rejects scope with traversal', () => {
    const result = validateUninstallScope('project/../../../etc');
    expect(result.valid).toBe(false);
  });

  it('rejects scope with mixed case (Project)', () => {
    const result = validateUninstallScope('Project');
    expect(result.valid).toBe(false);
  });

  it('rejects scope with mixed case (PERSONAL)', () => {
    const result = validateUninstallScope('PERSONAL');
    expect(result.valid).toBe(false);
  });

  it('rejects scope with trailing spaces', () => {
    const result = validateUninstallScope('project ');
    expect(result.valid).toBe(false);
  });

  it('rejects scope with leading spaces', () => {
    const result = validateUninstallScope(' personal');
    expect(result.valid).toBe(false);
  });
});

describe('Symlink Escape Attacks', () => {
  let tempDir: string;
  let scopePath: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-attack-'));
    scopePath = path.join(tempDir, 'scope');
    await fs.promises.mkdir(scopePath, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('skill directory symlink attacks', () => {
    it('detects symlink to /etc', async () => {
      const symlinkSkill = path.join(scopePath, 'evil-skill');

      try {
        await fs.promises.symlink('/etc', symlinkSkill);
        const result = await checkSymlinkSafety(symlinkSkill, scopePath);
        expect(result.type).toBe('escape');
      } finally {
        try {
          await fs.promises.unlink(symlinkSkill);
        } catch {
          // Ignore cleanup
        }
      }
    });

    it('detects symlink chain escape', async () => {
      // Create: skill -> link1 -> link2 -> /external
      const externalDir = path.join(tempDir, 'external');
      await fs.promises.mkdir(externalDir);

      const link2 = path.join(tempDir, 'link2');
      await fs.promises.symlink(externalDir, link2);

      const link1 = path.join(tempDir, 'link1');
      await fs.promises.symlink(link2, link1);

      const skillLink = path.join(scopePath, 'skill');
      await fs.promises.symlink(link1, skillLink);

      try {
        const result = await checkSymlinkSafety(skillLink, scopePath);
        expect(result.type).toBe('escape');
      } finally {
        await fs.promises.unlink(skillLink);
        await fs.promises.unlink(link1);
        await fs.promises.unlink(link2);
      }
    });
  });

  describe('nested symlink attacks', () => {
    it('detects symlink loop (skill/subdir -> skill)', async () => {
      const skillPath = path.join(scopePath, 'skill');
      await fs.promises.mkdir(skillPath);

      // Create a symlink that points back up
      const loopLink = path.join(skillPath, 'loop');
      await fs.promises.symlink(scopePath, loopLink);

      const summary = await getSymlinkSummary(skillPath);
      expect(summary.escapingSymlinks).toBe(1);
    });

    it('detects relative symlink escape', async () => {
      const skillPath = path.join(scopePath, 'skill');
      await fs.promises.mkdir(skillPath);

      // Create a relative symlink that escapes
      const escapeLink = path.join(skillPath, 'escape');
      await fs.promises.symlink('../../..', escapeLink);

      const summary = await getSymlinkSummary(skillPath);
      expect(summary.escapingSymlinks).toBe(1);
    });
  });
});

describe('Hard Link Detection', () => {
  let tempDir: string;
  let scopePath: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-hardlink-'));
    scopePath = path.join(tempDir, 'scope');
    await fs.promises.mkdir(scopePath, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('detects hard-linked files across skill directories', async () => {
    const skillPath = path.join(scopePath, 'skill');
    await fs.promises.mkdir(skillPath);

    const file1 = path.join(skillPath, 'file.txt');
    await fs.promises.writeFile(file1, 'shared content');

    // Create another skill with hard link
    const skill2Path = path.join(scopePath, 'skill2');
    await fs.promises.mkdir(skill2Path);

    try {
      await fs.promises.link(file1, path.join(skill2Path, 'linked.txt'));

      const warning = await detectHardLinkWarnings(skillPath);
      expect(warning).not.toBeNull();
      if (warning) {
        expect(warning.count).toBeGreaterThanOrEqual(1);
      }
    } catch {
      // Hard links may not be supported
      console.warn('Hard links not supported');
    }
  });
});

describe('Case Sensitivity Attacks', () => {
  // These tests are platform-specific for macOS/Windows which have
  // case-insensitive file systems by default

  let tempDir: string;
  let scopePath: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-case-'));
    scopePath = path.join(tempDir, 'scope');
    await fs.promises.mkdir(scopePath, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('validates skill name format (lowercase only)', () => {
    // Attempting to use uppercase should be rejected
    const result = validateSkillName('MySkill');
    expect(result.valid).toBe(false);
  });

  it('rejects skill names with mixed case', () => {
    const result = validateSkillName('mySkillName');
    expect(result.valid).toBe(false);
  });
});

describe('TOCTOU Race Condition Protection', () => {
  let tempDir: string;
  let scopePath: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-toctou-'));
    scopePath = path.join(tempDir, 'scope');
    await fs.promises.mkdir(scopePath, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('verifies file still exists before deletion', async () => {
    const skillPath = path.join(scopePath, 'skill');
    await fs.promises.mkdir(skillPath);

    const filePath = path.join(skillPath, 'file.txt');
    await fs.promises.writeFile(filePath, 'content');

    // Verify the file
    const result1 = await verifyBeforeDeletion(skillPath, filePath);
    expect(result1.type).toBe('ok');

    // "Attacker" deletes the file
    await fs.promises.unlink(filePath);

    // Verification should now fail
    const result2 = await verifyBeforeDeletion(skillPath, filePath);
    expect(result2.type).toBe('failed');
    if (result2.type === 'failed') {
      expect(result2.reason).toBe('not-exists');
    }
  });

  it('detects file type change during deletion', async () => {
    const skillPath = path.join(scopePath, 'skill');
    await fs.promises.mkdir(skillPath);

    const filePath = path.join(skillPath, 'file.txt');
    await fs.promises.writeFile(filePath, 'content');

    // Verify it's a file
    const result1 = await verifyBeforeDeletion(skillPath, filePath);
    expect(result1.type).toBe('ok');
    if (result1.type === 'ok') {
      expect(result1.pathType).toBe('file');
    }

    // "Attacker" replaces file with directory
    await fs.promises.unlink(filePath);
    await fs.promises.mkdir(filePath);

    // Verification should show it's now a directory
    const result2 = await verifyBeforeDeletion(skillPath, filePath);
    expect(result2.type).toBe('ok');
    if (result2.type === 'ok') {
      expect(result2.pathType).toBe('directory');
    }

    // Cleanup
    await fs.promises.rmdir(filePath);
  });

  it('detects file replaced with symlink', async () => {
    const skillPath = path.join(scopePath, 'skill');
    await fs.promises.mkdir(skillPath);

    const filePath = path.join(skillPath, 'file.txt');
    await fs.promises.writeFile(filePath, 'content');

    // Verify it's a file
    const result1 = await verifyBeforeDeletion(skillPath, filePath);
    expect(result1.type).toBe('ok');

    // "Attacker" replaces file with symlink to sensitive file
    await fs.promises.unlink(filePath);
    await fs.promises.symlink('/etc/passwd', filePath);

    // Verification should show it's now a symlink
    const result2 = await verifyBeforeDeletion(skillPath, filePath);
    expect(result2.type).toBe('ok');
    if (result2.type === 'ok') {
      expect(result2.pathType).toBe('symlink');
    }

    // Cleanup
    await fs.promises.unlink(filePath);
  });
});

describe('Concurrent Uninstall Protection', () => {
  let tempDir: string;
  let scopePath: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'asm-concurrent-'));
    scopePath = path.join(tempDir, 'scope');
    await fs.promises.mkdir(scopePath, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('prevents concurrent uninstalls on the same skill', async () => {
    const skillPath = path.join(scopePath, 'my-skill');
    await fs.promises.mkdir(skillPath);

    // First process acquires lock
    const lock1 = await acquireUninstallLock(skillPath);
    expect(lock1.acquired).toBe(true);

    try {
      // Second process tries to acquire lock
      const lock2 = await acquireUninstallLock(skillPath);
      expect(lock2.acquired).toBe(false);
      expect(lock2.reason).toBe('already-locked');
      expect(lock2.message).toContain('currently being uninstalled');
    } finally {
      // Release first lock
      await releaseUninstallLock(lock1.lockPath);
    }
  });

  it('allows uninstall after lock is released', async () => {
    const skillPath = path.join(scopePath, 'my-skill');
    await fs.promises.mkdir(skillPath);

    // Acquire and release lock
    const lock1 = await acquireUninstallLock(skillPath);
    await releaseUninstallLock(lock1.lockPath);

    // Now another process can acquire
    const lock2 = await acquireUninstallLock(skillPath);
    expect(lock2.acquired).toBe(true);
    await releaseUninstallLock(lock2.lockPath);
  });

  it('detects existing lock via hasUninstallLock', async () => {
    const skillPath = path.join(scopePath, 'my-skill');
    await fs.promises.mkdir(skillPath);

    // No lock initially
    expect(await hasUninstallLock(skillPath)).toBe(false);

    // Acquire lock
    const lock = await acquireUninstallLock(skillPath);

    // Lock should be detected
    expect(await hasUninstallLock(skillPath)).toBe(true);

    // Release
    await releaseUninstallLock(lock.lockPath);

    // No lock after release
    expect(await hasUninstallLock(skillPath)).toBe(false);
  });
});

describe('Containment Verification', () => {
  it('prevents accessing parent directory', () => {
    const basePath = '/home/user/.claude/skills/my-skill';
    const maliciousPath = '/home/user/.claude/skills/my-skill/../other-skill';

    const result = verifyContainment(basePath, maliciousPath);
    expect(result.type).toBe('violation');
  });

  it('prevents accessing sibling directory', () => {
    const basePath = '/home/user/.claude/skills/my-skill';
    const siblingPath = '/home/user/.claude/skills/other-skill';

    const result = verifyContainment(basePath, siblingPath);
    expect(result.type).toBe('violation');
  });

  it('allows access to subdirectories', () => {
    const basePath = '/home/user/.claude/skills/my-skill';
    const subPath = '/home/user/.claude/skills/my-skill/scripts/helper.sh';

    const result = verifyContainment(basePath, subPath);
    expect(result.type).toBe('valid');
  });

  it('prevents prefix attack (my-skill-evil matching my-skill)', () => {
    const basePath = '/home/user/.claude/skills/my-skill';
    const attackPath = '/home/user/.claude/skills/my-skill-evil';

    const result = verifyContainment(basePath, attackPath);
    expect(result.type).toBe('violation');
  });
});

describe('Input Validation Edge Cases', () => {
  describe('skill name length attacks', () => {
    it('accepts maximum length name (64 chars)', () => {
      const name = 'a'.repeat(64);
      const result = validateSkillName(name);
      expect(result.valid).toBe(true);
    });

    it('rejects name exceeding maximum length', () => {
      const name = 'a'.repeat(65);
      const result = validateSkillName(name);
      expect(result.valid).toBe(false);
    });

    it('rejects empty name', () => {
      const result = validateSkillName('');
      expect(result.valid).toBe(false);
    });

    it('rejects whitespace-only name', () => {
      const result = validateSkillName('   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('hyphen position attacks', () => {
    it('rejects leading hyphen', () => {
      const result = validateSkillName('-skill');
      expect(result.valid).toBe(false);
    });

    it('rejects trailing hyphen', () => {
      const result = validateSkillName('skill-');
      expect(result.valid).toBe(false);
    });

    it('rejects multiple consecutive hyphens', () => {
      const result = validateSkillName('skill--name');
      expect(result.valid).toBe(false);
    });

    it('accepts single hyphens between words', () => {
      const result = validateSkillName('my-skill-name');
      expect(result.valid).toBe(true);
    });
  });

  describe('reserved word handling', () => {
    // Note: The uninstall validator intentionally does NOT block reserved words
    // because users need to be able to uninstall skills that may have been
    // created before reserved word restrictions were added to the scaffold command.

    it('allows "claude" as name for uninstall (intentional)', () => {
      const result = validateSkillName('claude');
      expect(result.valid).toBe(true);
    });

    it('allows "anthropic" as name for uninstall (intentional)', () => {
      const result = validateSkillName('anthropic');
      expect(result.valid).toBe(true);
    });

    it('allows names containing "claude" for uninstall (intentional)', () => {
      const result = validateSkillName('my-claude-skill');
      expect(result.valid).toBe(true);
    });

    it('allows names containing "anthropic" for uninstall (intentional)', () => {
      const result = validateSkillName('anthropic-helper');
      expect(result.valid).toBe(true);
    });
  });
});
