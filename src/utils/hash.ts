/**
 * Content hashing utilities for file comparison
 *
 * Provides MD5 hashing for accurate content-based file comparison.
 * Used when the --thorough flag is specified to detect content changes
 * even when file sizes are identical.
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';

/**
 * Hash a buffer using MD5
 *
 * @param buffer - The buffer to hash
 * @returns The MD5 hash as a hex string
 */
export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Hash a file's contents
 *
 * @param filePath - Absolute path to the file
 * @returns The MD5 hash as a hex string
 * @throws If the file cannot be read
 */
export async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return hashBuffer(content);
}

/**
 * Compare two buffers by their content hash
 *
 * @param buffer1 - First buffer
 * @param buffer2 - Second buffer
 * @returns true if the contents are identical
 */
export function buffersMatch(buffer1: Buffer, buffer2: Buffer): boolean {
  return hashBuffer(buffer1) === hashBuffer(buffer2);
}

/**
 * Compare a buffer with a file's contents
 *
 * @param buffer - The buffer to compare
 * @param filePath - Path to the file to compare against
 * @returns true if the contents are identical
 */
export async function bufferMatchesFile(buffer: Buffer, filePath: string): Promise<boolean> {
  const bufferHash = hashBuffer(buffer);
  const fileHash = await hashFile(filePath);
  return bufferHash === fileHash;
}
