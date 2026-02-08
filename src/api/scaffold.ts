/**
 * Public scaffold API function.
 *
 * Creates a new skill directory with the standard structure.
 * This function never prompts for user input - use the `force` option
 * to overwrite existing directories.
 *
 * @module api/scaffold
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ScaffoldOptions, ScaffoldResult, ApiScope } from '../types/api';
import { FileSystemError, SecurityError } from '../errors';
import { hasErrorCode } from '../utils/error-helpers';
import { validateName } from '../validators/name';
import { getProjectSkillsDir, getPersonalSkillsDir } from '../utils/scope-resolver';
import { generateSkillMd, SkillTemplateParams, TemplateOptions } from '../templates/skill-md';

/**
 * Resolves the output directory path based on options.
 *
 * Priority:
 * 1. Explicit output path
 * 2. Personal scope (~/.claude/skills/)
 * 3. Project scope (.claude/skills/) - default
 */
function resolveOutputPath(name: string, options: ScaffoldOptions): string {
  // Explicit output path takes precedence
  if (options.output) {
    const resolvedOutput = path.resolve(options.output);
    return path.join(resolvedOutput, name);
  }

  // Scope-based resolution
  const scope: ApiScope = options.scope ?? 'project';

  if (scope === 'personal') {
    return path.join(getPersonalSkillsDir(), name);
  }

  // Default to project scope
  return path.join(getProjectSkillsDir(), name);
}

/**
 * Checks if a directory exists.
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Creates a new skill directory with the standard structure.
 *
 * Creates:
 * - Skill directory at the resolved path
 * - `SKILL.md` file with frontmatter based on options
 * - `scripts/` directory with `.gitkeep`
 *
 * This function never prompts for confirmation. If the directory already
 * exists and `force` is not set, it throws a `FileSystemError`.
 *
 * @param options - Configuration for scaffolding the skill
 * @returns Result with the created path and list of files
 * @throws SecurityError for invalid skill names (security violations)
 * @throws FileSystemError for directory creation failures or existing directories
 *
 * @example
 * ```typescript
 * import { scaffold } from 'ai-skills-manager';
 *
 * // Create a skill in the project scope (default)
 * const result = await scaffold({
 *   name: 'my-new-skill',
 *   description: 'A skill that does amazing things'
 * });
 *
 * console.log(`Created skill at: ${result.path}`);
 * console.log('Files created:', result.files);
 *
 * // Create a skill in the personal scope
 * const personalResult = await scaffold({
 *   name: 'personal-skill',
 *   scope: 'personal',
 *   allowedTools: ['Bash', 'Read', 'Write']
 * });
 *
 * // Create a skill at a custom location
 * const customResult = await scaffold({
 *   name: 'custom-skill',
 *   output: '/path/to/custom/skills'
 * });
 *
 * // Force overwrite an existing skill
 * const forced = await scaffold({
 *   name: 'existing-skill',
 *   force: true
 * });
 * ```
 */
export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const { name, description, allowedTools, force = false } = options;

  // Validate the skill name (security check)
  const nameValidation = validateName(name);
  if (!nameValidation.valid) {
    throw new SecurityError(nameValidation.error || `Invalid skill name: "${name}"`);
  }

  // Resolve the output path
  const skillPath = resolveOutputPath(name, options);
  const filesCreated: string[] = [];

  // Check if directory already exists
  if (await directoryExists(skillPath)) {
    if (!force) {
      throw new FileSystemError(
        `Directory already exists: ${skillPath}. Use force: true to overwrite.`,
        skillPath
      );
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
    filesCreated.push('scripts/.gitkeep');

    // Generate and write SKILL.md
    const templateParams: SkillTemplateParams = {
      name,
      description,
      allowedTools,
    };

    // Map API template options to internal template options
    const templateOptions: TemplateOptions | undefined = options.template
      ? {
          templateType: options.template.templateType,
          context: options.template.context,
          agent: options.template.agent,
          userInvocable: options.template.userInvocable,
          includeHooks: options.template.includeHooks,
          minimal: options.template.minimal,
        }
      : undefined;

    const skillMdContent = generateSkillMd(templateParams, templateOptions);
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    await fs.writeFile(skillMdPath, skillMdContent, 'utf-8');
    filesCreated.push('SKILL.md');

    return {
      path: skillPath,
      files: filesCreated,
    };
  } catch (error) {
    // Handle filesystem errors
    if (hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM')) {
      throw new FileSystemError(`Permission denied creating skill at: "${skillPath}"`, skillPath);
    }

    if (hasErrorCode(error, 'ENOENT')) {
      throw new FileSystemError(
        `Parent directory does not exist: ${path.dirname(skillPath)}`,
        skillPath
      );
    }

    // Re-throw if it's already an AsmError
    if (error instanceof FileSystemError || error instanceof SecurityError) {
      throw error;
    }

    // Wrap other errors
    const message = error instanceof Error ? error.message : String(error);
    throw new FileSystemError(`Failed to create scaffold: ${message}`, skillPath);
  }
}
