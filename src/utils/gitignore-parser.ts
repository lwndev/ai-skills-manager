/**
 * Gitignore Parser Utility
 *
 * Loads and parses .gitignore files for use with nested skill directory discovery.
 * Provides graceful degradation when no .gitignore exists.
 *
 * @module utils/gitignore-parser
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import ignore, { Ignore } from 'ignore';

/**
 * Load and parse a .gitignore file from a project root directory.
 *
 * Returns an Ignore instance that can be used to test paths against
 * the gitignore patterns. Returns null if no .gitignore exists,
 * allowing graceful degradation.
 *
 * @param projectRoot - Absolute path to the project root directory
 * @returns Ignore instance or null if no .gitignore exists
 *
 * @example
 * ```typescript
 * const ig = await loadGitignore('/path/to/project');
 * if (ig) {
 *   if (ig.ignores('node_modules/')) {
 *     console.log('node_modules is ignored');
 *   }
 * }
 * ```
 */
export async function loadGitignore(projectRoot: string): Promise<Ignore | null> {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    const ig = ignore();
    ig.add(content);
    return ig;
  } catch (error) {
    // Check if it's a "file not found" error
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }
    // For other errors (permission denied, etc.), also return null
    // to allow the operation to continue without gitignore filtering
    return null;
  }
}

/**
 * Create an Ignore instance from gitignore content string.
 *
 * Useful for testing or when gitignore content is already available.
 *
 * @param content - Gitignore file content
 * @returns Configured Ignore instance
 *
 * @example
 * ```typescript
 * const ig = createIgnoreFromContent(`
 *   node_modules/
 *   dist/
 *   *.log
 * `);
 * console.log(ig.ignores('node_modules/')); // true
 * ```
 */
export function createIgnoreFromContent(content: string): Ignore {
  const ig = ignore();
  ig.add(content);
  return ig;
}

/**
 * Type guard for Node.js errors with code property.
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
