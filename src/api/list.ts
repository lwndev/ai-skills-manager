/**
 * Public list API function.
 *
 * Lists installed skills with scope filtering support.
 * Returns an empty array if no skills are found (never throws for "not found").
 * Only throws for permission errors or other filesystem failures.
 *
 * @module api/list
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  RecursiveListOptions,
  InstalledSkill,
  InstalledSkillScope,
  ApiListScope,
  ListResult,
} from '../types/api';
import { FileSystemError } from '../errors';
import { hasErrorCode } from '../utils/error-helpers';
import { getProjectSkillsDir, getPersonalSkillsDir } from '../utils/scope-resolver';
import { parseFrontmatter } from '../utils/frontmatter-parser';
import { collectNestedSkillDirectories } from '../utils/nested-discovery';

/**
 * Skill marker filename.
 */
const SKILL_MD = 'SKILL.md';

/**
 * Checks if a directory contains a valid skill (has SKILL.md).
 */
async function isSkillDirectory(dirPath: string): Promise<boolean> {
  try {
    const skillMdPath = path.join(dirPath, SKILL_MD);
    const stats = await fs.stat(skillMdPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Reads skill metadata from SKILL.md frontmatter.
 */
async function readSkillMetadata(
  skillDir: string
): Promise<{ version?: string; description?: string }> {
  try {
    const skillMdPath = path.join(skillDir, SKILL_MD);
    const content = await fs.readFile(skillMdPath, 'utf-8');
    const parseResult = parseFrontmatter(content);

    if (parseResult.success && parseResult.data) {
      return {
        version: parseResult.data.metadata?.version as string | undefined,
        description:
          typeof parseResult.data.description === 'string'
            ? parseResult.data.description
            : undefined,
      };
    }
  } catch {
    // Ignore errors reading metadata - skill still exists
  }

  return {};
}

/**
 * Default maximum depth for recursive discovery.
 */
const DEFAULT_RECURSIVE_DEPTH = 3;

/**
 * Lists skills in a specific directory.
 *
 * @param skillsDir - Directory to scan for skills
 * @param scope - Scope to assign to found skills
 * @param location - Optional relative location path (for nested skills)
 * @returns Array of installed skills found in the directory
 * @throws FileSystemError for permission errors
 */
async function listSkillsInDirectory(
  skillsDir: string,
  scope: InstalledSkillScope,
  location?: string
): Promise<InstalledSkill[]> {
  const skills: InstalledSkill[] = [];

  // Check if directory exists
  try {
    const stats = await fs.stat(skillsDir);
    if (!stats.isDirectory()) {
      return skills; // Not a directory, return empty
    }
  } catch (error) {
    // Directory doesn't exist - not an error, just no skills
    if (hasErrorCode(error, 'ENOENT')) {
      return skills;
    }
    // Permission or other error
    if (hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM')) {
      throw new FileSystemError(
        `Permission denied reading skills directory: ${skillsDir}`,
        skillsDir
      );
    }
    // Other errors - treat as empty
    return skills;
  }

  // Read directory contents
  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch (error) {
    if (hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM')) {
      throw new FileSystemError(
        `Permission denied reading skills directory: ${skillsDir}`,
        skillsDir
      );
    }
    return skills;
  }

  // Process each entry
  for (const entry of entries) {
    const entryPath = path.join(skillsDir, entry);

    try {
      const entryStats = await fs.stat(entryPath);

      if (entryStats.isDirectory() && (await isSkillDirectory(entryPath))) {
        const metadata = await readSkillMetadata(entryPath);

        const skill: InstalledSkill = {
          name: entry,
          path: entryPath,
          scope,
          version: metadata.version,
          description: metadata.description,
        };

        // Add location field for nested skills
        if (location) {
          skill.location = path.join(location, entry);
        }

        skills.push(skill);
      }
    } catch {
      // Skip entries we can't read
      continue;
    }
  }

  return skills;
}

/**
 * Lists installed skills.
 *
 * Scans skill directories and returns information about installed skills.
 * By default, searches both project and personal scopes.
 *
 * Returns an empty result if no skills are found. Only throws for
 * permission errors or other filesystem failures.
 *
 * @param options - Optional configuration for listing skills
 * @returns Result object with skills array and metadata
 * @throws FileSystemError for permission errors when reading skill directories
 *
 * @example
 * ```typescript
 * import { list } from 'ai-skills-manager';
 *
 * // List all skills (project and personal)
 * const { skills } = await list();
 *
 * // List only project skills
 * const { skills: projectSkills } = await list({ scope: 'project' });
 *
 * // List only personal skills
 * const { skills: personalSkills } = await list({ scope: 'personal' });
 *
 * // List skills in a custom directory
 * const { skills: customSkills } = await list({ targetPath: '/custom/skills/path' });
 *
 * // List skills recursively in nested directories
 * const result = await list({ recursive: true });
 * if (result.depthLimitReached) {
 *   console.log('Some directories were not scanned due to depth limit');
 * }
 *
 * // Limit recursive search depth
 * const { skills: shallowSkills } = await list({ recursive: true, depth: 2 });
 *
 * // Print skill information
 * for (const skill of skills) {
 *   console.log(`${skill.name} (${skill.scope})`);
 *   if (skill.description) {
 *     console.log(`  ${skill.description}`);
 *   }
 *   if (skill.version) {
 *     console.log(`  Version: ${skill.version}`);
 *   }
 * }
 * ```
 */
export async function list(options: RecursiveListOptions = {}): Promise<ListResult> {
  const { scope = 'all', targetPath, recursive = false, depth = DEFAULT_RECURSIVE_DEPTH } = options;

  // If a custom target path is provided, use it exclusively
  if (targetPath) {
    const skills = await listSkillsInDirectory(targetPath, 'custom');
    return { skills };
  }

  // Determine which scopes to search
  const scopesToSearch: ApiListScope[] =
    scope === 'all' ? ['project', 'personal'] : [scope as ApiListScope];

  const allSkills: InstalledSkill[] = [];
  let depthLimitReached = false;

  for (const scopeToSearch of scopesToSearch) {
    if (scopeToSearch === 'project') {
      const projectDir = getProjectSkillsDir();
      const projectRoot = process.cwd();

      if (recursive) {
        // Recursive mode: scan nested directories
        const result = await listProjectSkillsRecursively(projectRoot, projectDir, depth);
        allSkills.push(...result.skills);
        if (result.depthLimitReached) {
          depthLimitReached = true;
        }
      } else {
        // Standard mode: only scan root project skills directory
        const projectSkills = await listSkillsInDirectory(projectDir, 'project');
        allSkills.push(...projectSkills);
      }
    } else if (scopeToSearch === 'personal') {
      // Personal scope is never recursively scanned (no nested projects in home)
      const personalDir = getPersonalSkillsDir();
      const personalSkills = await listSkillsInDirectory(personalDir, 'personal');
      allSkills.push(...personalSkills);
    }
  }

  return {
    skills: allSkills,
    depthLimitReached: recursive ? depthLimitReached : undefined,
  };
}

/**
 * Result of recursive project skill listing.
 */
interface RecursiveListResult {
  skills: InstalledSkill[];
  depthLimitReached: boolean;
}

/**
 * Lists project skills recursively, including nested `.claude/skills` directories.
 *
 * @param projectRoot - Project root directory
 * @param rootSkillsDir - Root `.claude/skills` directory
 * @param maxDepth - Maximum depth to traverse
 * @returns Result with skills array and depth limit metadata
 */
async function listProjectSkillsRecursively(
  projectRoot: string,
  rootSkillsDir: string,
  maxDepth: number
): Promise<RecursiveListResult> {
  const allSkills: InstalledSkill[] = [];

  // Find all nested skill directories with depth limit tracking
  const discoveryResult = await collectNestedSkillDirectories(projectRoot, maxDepth);

  // Process each discovered skills directory
  for (const skillsDir of discoveryResult.directories) {
    // Calculate relative location from project root
    // e.g., "/project/packages/api/.claude/skills" -> "packages/api/.claude/skills"
    const relativePath = path.relative(projectRoot, skillsDir);

    // Determine location for display
    // Root skills dir has no location prefix, nested dirs show their relative path
    const isRootSkillsDir = skillsDir === rootSkillsDir;
    const location = isRootSkillsDir ? undefined : relativePath;

    // List skills in this directory
    const skills = await listSkillsInDirectory(skillsDir, 'project', location);
    allSkills.push(...skills);
  }

  return {
    skills: allSkills,
    depthLimitReached: discoveryResult.depthLimitReached,
  };
}
