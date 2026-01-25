/**
 * List command implementation
 *
 * Lists installed Claude Code skills from project and/or personal skill directories.
 */

import { Command } from 'commander';
import { list } from '../api';
import type { InstalledSkill } from '../types/api';
import { AsmError, FileSystemError } from '../errors';
import * as output from '../utils/output';

/**
 * Exit codes for the list command
 * - 0: Success (including when no skills found)
 * - 1: File system error (permission denied, etc.)
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  FILESYSTEM_ERROR: 1,
} as const;

/**
 * Options for the list command
 */
export interface ListCommandOptions {
  /** Scope filter: all, project, or personal */
  scope?: string;
  /** JSON output mode */
  json?: boolean;
  /** Quiet mode - minimal output */
  quiet?: boolean;
  /** Enable recursive discovery of nested skills */
  recursive?: boolean;
  /** Maximum depth for recursive discovery (0-10) */
  depth?: string;
}

/**
 * Register the list command with the CLI program
 */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List installed Claude Code skills')
    .option(
      '-s, --scope <scope>',
      'Scope filter: "all" (default), "project" (.claude/skills/), or "personal" (~/.claude/skills/)',
      'all'
    )
    .option('-j, --json', 'Output as JSON')
    .option('-q, --quiet', 'Quiet mode - show only skill names')
    .option('-r, --recursive', 'Discover skills in nested .claude/skills directories')
    .option('-d, --depth <number>', 'Maximum depth for recursive discovery (0-10, default: 3)', '3')
    .addHelpText(
      'after',
      `
Examples:
  $ asm list
  $ asm list --scope project
  $ asm list --scope personal
  $ asm list --json
  $ asm list --quiet
  $ asm ls
  $ asm list --recursive
  $ asm list --recursive --depth 2

Scopes:
  all         List skills from both project and personal directories (default)
  project     List skills from .claude/skills/ in current directory
  personal    List skills from ~/.claude/skills/ for all projects

Recursive Discovery:
  --recursive    Scan for skills in nested .claude/skills directories
                 (e.g., packages/api/.claude/skills/, libs/shared/.claude/skills/)
  --depth        Maximum directory depth to traverse (default: 3)
                 Depth 0 = only root, 1 = root + children, etc.
  Note: Personal scope is never recursively scanned.

Output Formats:
  Normal (default): Table with name, scope, and description
  --json: JSON array of skill objects (includes location for nested skills)
  --quiet: One skill name per line

Exit Codes:
  0 - Success (even if no skills found)
  1 - File system error (permission denied, etc.)`
    )
    .action(async (options: ListCommandOptions) => {
      const exitCode = await handleList(options);
      if (exitCode !== EXIT_CODES.SUCCESS) {
        process.exit(exitCode);
      }
    });
}

/**
 * Handle the list command
 *
 * @param options - Command options
 * @returns Exit code
 */
async function handleList(options: ListCommandOptions): Promise<number> {
  const { scope, json, quiet, recursive, depth: depthStr } = options;

  try {
    // Validate scope
    const validScopes = ['all', 'project', 'personal'];
    if (scope && !validScopes.includes(scope)) {
      if (!quiet) {
        output.displayError('Invalid scope', `Expected one of: ${validScopes.join(', ')}`);
      } else {
        console.log(`FAIL: Invalid scope: ${scope}`);
      }
      return EXIT_CODES.FILESYSTEM_ERROR;
    }

    // Parse and validate depth
    const depth = depthStr !== undefined ? parseInt(depthStr, 10) : 3;
    if (isNaN(depth) || depth < 0 || depth > 10) {
      if (!quiet) {
        output.displayError('Invalid depth', 'Depth must be a number between 0 and 10');
      } else {
        console.log('FAIL: Invalid depth: must be a number between 0 and 10');
      }
      return EXIT_CODES.FILESYSTEM_ERROR;
    }

    // Call the API
    const skills = await list({
      scope: scope === 'all' || !scope ? 'all' : (scope as 'project' | 'personal'),
      recursive,
      depth,
    });

    // Output results
    if (json) {
      console.log(JSON.stringify(skills, null, 2));
    } else if (quiet) {
      for (const skill of skills) {
        console.log(skill.name);
      }
    } else {
      formatNormalOutput(skills, recursive);
    }

    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleError(error, quiet);
  }
}

/**
 * Format normal output for list command
 *
 * @param skills - Array of installed skills
 * @param recursive - Whether recursive mode is enabled (affects grouping)
 */
function formatNormalOutput(skills: InstalledSkill[], recursive?: boolean): void {
  if (skills.length === 0) {
    console.log('No skills installed.');
    console.log('');
    console.log('Get started:');
    console.log('  asm scaffold my-skill    Create a new skill');
    console.log('  asm install <package>    Install a skill from a package');
    return;
  }

  console.log('');
  console.log(`Found ${skills.length} installed skill${skills.length === 1 ? '' : 's'}:`);
  console.log('');

  // Group by scope first
  const projectSkills = skills.filter((s) => s.scope === 'project');
  const personalSkills = skills.filter((s) => s.scope === 'personal');
  const customSkills = skills.filter((s) => s.scope === 'custom');

  if (projectSkills.length > 0) {
    if (recursive) {
      // Group project skills by location for recursive mode
      formatProjectSkillsGrouped(projectSkills);
    } else {
      console.log('Project skills (.claude/skills/):');
      for (const skill of projectSkills) {
        formatSkillEntry(skill);
      }
      console.log('');
    }
  }

  if (personalSkills.length > 0) {
    console.log('Personal skills (~/.claude/skills/):');
    for (const skill of personalSkills) {
      formatSkillEntry(skill);
    }
    console.log('');
  }

  if (customSkills.length > 0) {
    console.log('Custom path skills:');
    for (const skill of customSkills) {
      formatSkillEntry(skill);
    }
    console.log('');
  }
}

/**
 * Format project skills grouped by location (for recursive mode)
 *
 * @param skills - Array of project skills
 */
function formatProjectSkillsGrouped(skills: InstalledSkill[]): void {
  // Group skills by their location directory
  const groups = new Map<string, InstalledSkill[]>();

  for (const skill of skills) {
    // Extract directory from location (remove skill name at end)
    // e.g., "packages/api/.claude/skills/my-skill" -> "packages/api/.claude/skills"
    const location = skill.location;
    let groupKey: string;

    if (location) {
      // Get parent directory of the skill (the .claude/skills dir)
      const parts = location.split('/');
      parts.pop(); // Remove skill name
      groupKey = parts.join('/');
    } else {
      // Root skills have no location
      groupKey = '.claude/skills';
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(skill);
  }

  // Sort groups: root first, then alphabetically
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    // Root comes first
    if (a === '.claude/skills') return -1;
    if (b === '.claude/skills') return 1;
    return a.localeCompare(b);
  });

  // Output each group
  for (const key of sortedKeys) {
    const groupSkills = groups.get(key)!;
    console.log(`Project skills (${key}/):`.replace('//', '/'));
    for (const skill of groupSkills) {
      formatSkillEntry(skill);
    }
    console.log('');
  }
}

/**
 * Format a single skill entry
 */
function formatSkillEntry(skill: InstalledSkill): void {
  let line = `  ${skill.name}`;
  if (skill.version) {
    line += ` (v${skill.version})`;
  }
  console.log(line);
  if (skill.description) {
    // Truncate long descriptions
    const maxLen = 60;
    const desc =
      skill.description.length > maxLen
        ? skill.description.substring(0, maxLen - 3) + '...'
        : skill.description;
    console.log(`    ${desc}`);
  }
}

/**
 * Handle errors from the list command
 *
 * @param error - Error that occurred
 * @param quiet - Whether quiet mode is enabled
 * @returns Exit code
 */
function handleError(error: unknown, quiet?: boolean): number {
  if (error instanceof FileSystemError) {
    if (!quiet) {
      output.displayError('File system error', error.message);
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.FILESYSTEM_ERROR;
  }

  if (error instanceof AsmError) {
    if (!quiet) {
      output.displayError(error.message);
    } else {
      console.log(`FAIL: ${error.message}`);
    }
    return EXIT_CODES.FILESYSTEM_ERROR;
  }

  if (error instanceof Error) {
    if (!quiet) {
      output.displayError('List failed', error.message);
    } else {
      console.log(`FAIL: ${error.message}`);
    }
  } else {
    if (!quiet) {
      output.displayError('An unexpected error occurred', String(error));
    } else {
      console.log(`FAIL: ${String(error)}`);
    }
  }

  return EXIT_CODES.FILESYSTEM_ERROR;
}
