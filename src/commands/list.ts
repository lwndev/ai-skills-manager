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

Scopes:
  all         List skills from both project and personal directories (default)
  project     List skills from .claude/skills/ in current directory
  personal    List skills from ~/.claude/skills/ for all projects

Output Formats:
  Normal (default): Table with name, scope, and description
  --json: JSON array of skill objects
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
  const { scope, json, quiet } = options;

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

    // Call the API
    const skills = await list({
      scope: scope === 'all' || !scope ? 'all' : (scope as 'project' | 'personal'),
    });

    // Output results
    if (json) {
      console.log(JSON.stringify(skills, null, 2));
    } else if (quiet) {
      for (const skill of skills) {
        console.log(skill.name);
      }
    } else {
      formatNormalOutput(skills);
    }

    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleError(error, quiet);
  }
}

/**
 * Format normal output for list command
 */
function formatNormalOutput(skills: InstalledSkill[]): void {
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

  // Group by scope
  const projectSkills = skills.filter((s) => s.scope === 'project');
  const personalSkills = skills.filter((s) => s.scope === 'personal');
  const customSkills = skills.filter((s) => s.scope === 'custom');

  if (projectSkills.length > 0) {
    console.log('Project skills (.claude/skills/):');
    for (const skill of projectSkills) {
      formatSkillEntry(skill);
    }
    console.log('');
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
