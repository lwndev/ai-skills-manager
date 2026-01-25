/**
 * Nested skill directory discovery utilities.
 *
 * Provides stack-based traversal for finding `.claude/skills` directories
 * in subdirectories, supporting monorepo and multi-project workspaces.
 *
 * @module utils/nested-discovery
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Ignore } from 'ignore';

/**
 * Directories to always skip during traversal.
 * These are common build output, dependency, and VCS directories.
 */
const HARDCODED_SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  'vendor',
  'coverage',
  '__pycache__',
]);

/**
 * The target directory pattern we're searching for.
 */
const SKILLS_DIR_PATH = '.claude/skills';

/**
 * Options for nested skill directory discovery.
 */
export interface NestedDiscoveryOptions {
  /**
   * Optional gitignore instance for filtering paths.
   * When provided, paths matching gitignore patterns are skipped.
   */
  ignore?: Ignore;
}

/**
 * Entry in the directory traversal stack.
 */
interface StackEntry {
  /** Absolute path to the directory */
  dirPath: string;
  /** Current depth from root (0 = root) */
  depth: number;
}

/**
 * Creates a unique identifier for a directory using device and inode.
 * Used for detecting symlink loops.
 *
 * @param stats - File stats containing device and inode info
 * @returns Unique identifier string
 */
function getDirectoryId(stats: { dev: number; ino: number }): string {
  return `${stats.dev}:${stats.ino}`;
}

/**
 * Checks if a directory name should be skipped.
 * Skips hidden directories (starting with .) except for .claude,
 * and hardcoded ignore patterns.
 *
 * @param name - Directory name (not full path)
 * @returns True if the directory should be skipped
 */
function shouldSkipDirectory(name: string): boolean {
  // Skip hardcoded directories
  if (HARDCODED_SKIP_DIRS.has(name)) {
    return true;
  }

  // Skip hidden directories (starting with .) except .claude
  if (name.startsWith('.') && name !== '.claude') {
    return true;
  }

  return false;
}

/**
 * Finds nested `.claude/skills` directories within a root directory.
 *
 * Uses iterative stack-based traversal for efficiency and to avoid
 * stack overflow on deeply nested structures. Handles:
 * - Depth limiting via maxDepth parameter
 * - Skipping hidden directories (except `.claude`)
 * - Skipping common build/dependency directories
 * - Symlink loop detection using device+inode tracking
 * - Permission errors (continues scanning, skips inaccessible directories)
 *
 * @param rootDir - Absolute path to the root directory to search
 * @param maxDepth - Maximum depth to traverse (0 = only root level)
 * @param options - Optional discovery options including gitignore
 * @yields Absolute paths to `.claude/skills` directories found
 *
 * @example
 * ```typescript
 * // Find all nested skill directories up to 3 levels deep
 * for await (const skillsDir of findNestedSkillDirectories('/project', 3)) {
 *   console.log(skillsDir); // e.g., '/project/packages/api/.claude/skills'
 * }
 * ```
 */
export async function* findNestedSkillDirectories(
  rootDir: string,
  maxDepth: number,
  options?: NestedDiscoveryOptions
): AsyncGenerator<string> {
  // Validate inputs
  if (maxDepth < 0) {
    return;
  }

  // Track visited directories by device+inode to detect symlink loops
  const visited = new Set<string>();

  // Initialize stack with root directory
  const stack: StackEntry[] = [{ dirPath: rootDir, depth: 0 }];

  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) break;
    const { dirPath, depth } = entry;

    // Get directory stats for symlink loop detection
    let stats;
    try {
      stats = await fs.stat(dirPath);
    } catch {
      // Permission denied or other error - skip this directory
      continue;
    }

    // Check for symlink loops
    const dirId = getDirectoryId(stats);
    if (visited.has(dirId)) {
      continue;
    }
    visited.add(dirId);

    // Check if this directory contains .claude/skills
    const skillsDirPath = path.join(dirPath, SKILLS_DIR_PATH);
    try {
      const skillsStats = await fs.stat(skillsDirPath);
      if (skillsStats.isDirectory()) {
        yield skillsDirPath;
      }
    } catch {
      // .claude/skills doesn't exist in this directory - that's fine
    }

    // Don't descend further if we've hit max depth
    if (depth >= maxDepth) {
      continue;
    }

    // Read subdirectories
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      // Permission denied or other error - skip this directory
      continue;
    }

    // Process subdirectories in reverse order so they come off stack in alphabetical order
    const subdirs = entries
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .filter((entry) => !shouldSkipDirectory(entry.name))
      .sort((a, b) => b.name.localeCompare(a.name));

    for (const subdir of subdirs) {
      const subdirPath = path.join(dirPath, subdir.name);

      // Check gitignore patterns if provided
      if (options?.ignore) {
        const relativePath = path.relative(rootDir, subdirPath);
        // Add trailing slash to indicate directory for gitignore matching
        if (options.ignore.ignores(relativePath + '/')) {
          continue;
        }
      }

      // For symlinks, resolve the target to check if it's a directory
      if (subdir.isSymbolicLink()) {
        try {
          const linkStats = await fs.stat(subdirPath);
          if (!linkStats.isDirectory()) {
            continue;
          }
        } catch {
          // Broken symlink or permission error - skip
          continue;
        }
      }

      stack.push({ dirPath: subdirPath, depth: depth + 1 });
    }
  }
}

/**
 * Collects all nested skill directories into an array.
 * Convenience wrapper around the async generator.
 *
 * @param rootDir - Absolute path to the root directory to search
 * @param maxDepth - Maximum depth to traverse (0 = only root level)
 * @param options - Optional discovery options including gitignore
 * @returns Promise resolving to array of absolute paths to `.claude/skills` directories
 *
 * @example
 * ```typescript
 * const skillsDirs = await collectNestedSkillDirectories('/project', 3);
 * console.log(skillsDirs);
 * // ['/project/.claude/skills', '/project/packages/api/.claude/skills']
 * ```
 */
export async function collectNestedSkillDirectories(
  rootDir: string,
  maxDepth: number,
  options?: NestedDiscoveryOptions
): Promise<string[]> {
  const results: string[] = [];
  for await (const dir of findNestedSkillDirectories(rootDir, maxDepth, options)) {
    results.push(dir);
  }
  return results;
}
