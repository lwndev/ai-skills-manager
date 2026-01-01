/**
 * Tests for the content hashing utility
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { hashBuffer, hashFile, buffersMatch, bufferMatchesFile } from '../../../src/utils/hash';

describe('hash utility', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-hash-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('hashBuffer', () => {
    it('returns consistent hash for same content', () => {
      const buffer = Buffer.from('test content');
      const hash1 = hashBuffer(buffer);
      const hash2 = hashBuffer(buffer);

      expect(hash1).toBe(hash2);
    });

    it('returns different hash for different content', () => {
      const buffer1 = Buffer.from('content 1');
      const buffer2 = Buffer.from('content 2');

      expect(hashBuffer(buffer1)).not.toBe(hashBuffer(buffer2));
    });

    it('returns 32-character hex string', () => {
      const buffer = Buffer.from('test');
      const hash = hashBuffer(buffer);

      expect(hash).toMatch(/^[0-9a-f]{32}$/);
    });

    it('handles empty buffer', () => {
      const buffer = Buffer.from('');
      const hash = hashBuffer(buffer);

      expect(hash).toMatch(/^[0-9a-f]{32}$/);
      // MD5 of empty string is d41d8cd98f00b204e9800998ecf8427e
      expect(hash).toBe('d41d8cd98f00b204e9800998ecf8427e');
    });

    it('handles binary content', () => {
      const buffer = Buffer.from([0x00, 0xff, 0x12, 0x34]);
      const hash = hashBuffer(buffer);

      expect(hash).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('hashFile', () => {
    it('returns hash of file contents', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      const fileHash = await hashFile(testFile);
      const bufferHash = hashBuffer(Buffer.from('test content'));

      expect(fileHash).toBe(bufferHash);
    });

    it('throws when file does not exist', async () => {
      const nonExistent = path.join(tempDir, 'does-not-exist.txt');

      await expect(hashFile(nonExistent)).rejects.toThrow();
    });

    it('handles empty file', async () => {
      const emptyFile = path.join(tempDir, 'empty.txt');
      await fs.writeFile(emptyFile, '');

      const hash = await hashFile(emptyFile);
      expect(hash).toBe('d41d8cd98f00b204e9800998ecf8427e');
    });

    it('handles binary file', async () => {
      const binFile = path.join(tempDir, 'binary.bin');
      await fs.writeFile(binFile, Buffer.from([0x00, 0xff, 0x12, 0x34]));

      const fileHash = await hashFile(binFile);
      const bufferHash = hashBuffer(Buffer.from([0x00, 0xff, 0x12, 0x34]));

      expect(fileHash).toBe(bufferHash);
    });
  });

  describe('buffersMatch', () => {
    it('returns true for identical buffers', () => {
      const buffer1 = Buffer.from('same content');
      const buffer2 = Buffer.from('same content');

      expect(buffersMatch(buffer1, buffer2)).toBe(true);
    });

    it('returns false for different buffers', () => {
      const buffer1 = Buffer.from('content 1');
      const buffer2 = Buffer.from('content 2');

      expect(buffersMatch(buffer1, buffer2)).toBe(false);
    });

    it('returns true for empty buffers', () => {
      const buffer1 = Buffer.from('');
      const buffer2 = Buffer.from('');

      expect(buffersMatch(buffer1, buffer2)).toBe(true);
    });
  });

  describe('bufferMatchesFile', () => {
    it('returns true when buffer matches file content', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      const buffer = Buffer.from('test content');
      const matches = await bufferMatchesFile(buffer, testFile);

      expect(matches).toBe(true);
    });

    it('returns false when buffer differs from file content', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'file content');

      const buffer = Buffer.from('different content');
      const matches = await bufferMatchesFile(buffer, testFile);

      expect(matches).toBe(false);
    });

    it('throws when file does not exist', async () => {
      const nonExistent = path.join(tempDir, 'does-not-exist.txt');
      const buffer = Buffer.from('test');

      await expect(bufferMatchesFile(buffer, nonExistent)).rejects.toThrow();
    });
  });
});
