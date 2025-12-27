/**
 * Scaffold generator
 *
 * Creates the directory structure and files for a new skill.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { generateSkillMd, SkillTemplateParams } from '../templates/skill-md';

export interface ScaffoldOptions {
  name: string;
  description?: string;
  allowedTools?: string[];
  output?: string;
  project?: boolean;
  personal?: boolean;
  force?: boolean;
}

export interface ScaffoldResult {
  success: boolean;
  skillPath: string;
  filesCreated: string[];
  error?: string;
}

/**
 * Resolve the output directory based on options
 */
export function resolveOutputPath(options: ScaffoldOptions): string {
  // --output takes precedence
  if (options.output) {
    return path.resolve(options.output, options.name);
  }

  // --personal uses ~/.claude/skills/
  if (options.personal) {
    return path.join(os.homedir(), '.claude', 'skills', options.name);
  }

  // --project (default) uses .claude/skills/ in current directory
  return path.join(process.cwd(), '.claude', 'skills', options.name);
}

/**
 * Check if a directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Prompt user for confirmation (used when directory exists)
 */
export async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Create the skill scaffold
 */
export async function createScaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const skillPath = resolveOutputPath(options);
  const filesCreated: string[] = [];

  // Check if directory already exists
  if (await directoryExists(skillPath)) {
    if (!options.force) {
      const confirmed = await promptConfirmation(
        `Directory "${skillPath}" already exists. Overwrite?`
      );
      if (!confirmed) {
        return {
          success: false,
          skillPath,
          filesCreated: [],
          error: 'Operation cancelled by user',
        };
      }
    }
  }

  try {
    // Create skill directory
    await fs.mkdir(skillPath, { recursive: true });

    // Create scripts directory with .gitkeep
    const scriptsPath = path.join(skillPath, 'scripts');
    await fs.mkdir(scriptsPath, { recursive: true });
    const gitkeepPath = path.join(scriptsPath, '.gitkeep');
    await fs.writeFile(gitkeepPath, '');
    filesCreated.push(gitkeepPath);

    // Generate and write SKILL.md
    const templateParams: SkillTemplateParams = {
      name: options.name,
      description: options.description,
      allowedTools: options.allowedTools,
    };
    const skillMdContent = generateSkillMd(templateParams);
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    await fs.writeFile(skillMdPath, skillMdContent, 'utf-8');
    filesCreated.push(skillMdPath);

    return {
      success: true,
      skillPath,
      filesCreated,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      skillPath,
      filesCreated,
      error: `Failed to create scaffold: ${errorMessage}`,
    };
  }
}
