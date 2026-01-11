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
import { ListOptions, InstalledSkill, InstalledSkillScope, ApiListScope } from '../types/api';
import { FileSystemError } from '../errors';
import { getProjectSkillsDir, getPersonalSkillsDir } from '../utils/scope-resolver';
import { parseFrontmatter } from '../utils/frontmatter-parser';

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
 * Lists skills in a specific directory.
 *
 * @param skillsDir - Directory to scan for skills
 * @param scope - Scope to assign to found skills
 * @returns Array of installed skills found in the directory
 * @throws FileSystemError for permission errors
 */
async function listSkillsInDirectory(
  skillsDir: string,
  scope: InstalledSkillScope
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

        skills.push({
          name: entry,
          path: entryPath,
          scope,
          version: metadata.version,
          description: metadata.description,
        });
      }
    } catch {
      // Skip entries we can't read
      continue;
    }
  }

  return skills;
}

/**
 * Checks if an error has a specific error code.
 */
function hasErrorCode(error: unknown, code: string): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === code;
}

/**
 * Lists installed skills.
 *
 * Scans skill directories and returns information about installed skills.
 * By default, searches both project and personal scopes.
 *
 * Returns an empty array if no skills are found. Only throws for
 * permission errors or other filesystem failures.
 *
 * @param options - Optional configuration for listing skills
 * @returns Array of installed skills (empty if none found)
 * @throws FileSystemError for permission errors when reading skill directories
 *
 * @example
 * ```typescript
 * import { list } from 'ai-skills-manager';
 *
 * // List all skills (project and personal)
 * const allSkills = await list();
 *
 * // List only project skills
 * const projectSkills = await list({ scope: 'project' });
 *
 * // List only personal skills
 * const personalSkills = await list({ scope: 'personal' });
 *
 * // List skills in a custom directory
 * const customSkills = await list({ targetPath: '/custom/skills/path' });
 *
 * // Print skill information
 * for (const skill of allSkills) {
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
export async function list(options: ListOptions = {}): Promise<InstalledSkill[]> {
  const { scope = 'all', targetPath } = options;

  // If a custom target path is provided, use it exclusively
  if (targetPath) {
    return listSkillsInDirectory(targetPath, 'custom');
  }

  // Determine which scopes to search
  const scopesToSearch: ApiListScope[] =
    scope === 'all' ? ['project', 'personal'] : [scope as ApiListScope];

  const allSkills: InstalledSkill[] = [];

  for (const scopeToSearch of scopesToSearch) {
    if (scopeToSearch === 'project') {
      const projectDir = getProjectSkillsDir();
      const projectSkills = await listSkillsInDirectory(projectDir, 'project');
      allSkills.push(...projectSkills);
    } else if (scopeToSearch === 'personal') {
      const personalDir = getPersonalSkillsDir();
      const personalSkills = await listSkillsInDirectory(personalDir, 'personal');
      allSkills.push(...personalSkills);
    }
  }

  return allSkills;
}
