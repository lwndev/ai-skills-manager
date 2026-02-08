/**
 * Interactive scaffold workflow for FEAT-019.
 *
 * Provides a guided prompt-driven experience for template selection
 * and configuration when `asm scaffold <name> --interactive` is used.
 */

import { select, input, confirm } from '@inquirer/prompts';
import { ExitPromptError } from '@inquirer/core';
import { scaffold } from '../api';
import type { ScaffoldTemplateType, ScaffoldTemplateOptions, ApiScope } from '../types/api';
import * as output from '../utils/output';
import type { CliScaffoldOptions } from './scaffold';

/**
 * Template-content flags that --interactive overrides.
 * These are the flags whose values are collected via prompts instead.
 * Includes userInvocable even though there is no interactive prompt for it —
 * it is implicitly determined by template type (internal → false, others → true).
 */
export const TEMPLATE_CONTENT_FLAGS: readonly string[] = [
  'template',
  'context',
  'agent',
  'userInvocable',
  'hooks',
  'minimal',
  'description',
  'allowedTools',
  'memory',
  'model',
  'argumentHint',
] as const;

/**
 * Checks whether stdin is a TTY (interactive terminal).
 */
export function isTTY(): boolean {
  return !!process.stdin.isTTY;
}

/**
 * Detects template-content flags that were set alongside --interactive.
 * Returns a list of flag names that conflict with interactive mode.
 */
export function detectConflictingFlags(options: CliScaffoldOptions): string[] {
  const conflicts: string[] = [];

  for (const flag of TEMPLATE_CONTENT_FLAGS) {
    const value = options[flag as keyof CliScaffoldOptions];

    // Special case: commander sets userInvocable to true by default (--no-user-invocable negates it)
    // Only count it as a conflict when explicitly set to false
    if (flag === 'userInvocable') {
      if (value === false) {
        conflicts.push(flag);
      }
      continue;
    }

    if (value !== undefined && value !== null) {
      conflicts.push(flag);
    }
  }

  return conflicts;
}

/** Result of the interactive prompt flow. */
export interface InteractivePromptResult {
  templateOptions: ScaffoldTemplateOptions;
  description?: string;
  allowedTools?: string[];
}

/**
 * Runs the full interactive prompt flow, collecting user choices for
 * template type, context, agent, memory, model, hooks, minimal, description,
 * argument hint, and allowed tools.
 *
 * Throws ExitPromptError on Ctrl+C or EOF (handled by caller).
 */
export async function runInteractivePrompts(_name: string): Promise<InteractivePromptResult> {
  const templateOptions: ScaffoldTemplateOptions = {};
  let description: string | undefined;
  let allowedTools: string[] | undefined;

  // FR-2: Template type selection
  const templateType = await select<ScaffoldTemplateType>({
    message: 'Select a template type:',
    choices: [
      { value: 'basic', name: 'basic', description: 'Standard skill with default settings' },
      {
        value: 'forked',
        name: 'forked',
        description: 'Isolated context with read-only tools',
      },
      {
        value: 'with-hooks',
        name: 'with-hooks',
        description: 'Includes hook configuration examples',
      },
      {
        value: 'internal',
        name: 'internal',
        description: 'Non-user-invocable helper skill',
      },
      {
        value: 'agent',
        name: 'agent',
        description: 'Custom agent with model, memory, and tool control',
      },
    ],
    default: 'basic',
  });
  templateOptions.templateType = templateType;

  // FR-3: Context type selection (only for basic template)
  if (templateType === 'basic') {
    const context = await select<'inherit' | 'fork'>({
      message: 'Select context type:',
      choices: [
        { value: 'inherit', name: 'inherit', description: 'Share context with parent (default)' },
        {
          value: 'fork',
          name: 'fork',
          description: 'Isolated context with separate conversation',
        },
      ],
      default: 'inherit',
    });
    if (context === 'fork') {
      templateOptions.context = 'fork';
    }
  }

  // FR-4: Agent name input
  const agentName = await input({
    message: 'Agent name (optional, press Enter to skip):',
    validate: (value: string) => {
      if (value.trim().length === 0) return true; // allow skip
      return true;
    },
  });
  if (agentName.trim().length > 0) {
    templateOptions.agent = agentName.trim();
  }

  // FR-5: Memory scope selection
  const isAgent = templateType === 'agent';
  if (isAgent) {
    const memory = await select<'user' | 'project' | 'local'>({
      message: 'Memory scope:',
      choices: [
        { value: 'user', name: 'user', description: 'Persistent across all projects' },
        { value: 'project', name: 'project', description: 'Persistent within this project' },
        { value: 'local', name: 'local', description: 'Persistent on this machine only' },
      ],
      default: 'project',
    });
    templateOptions.memory = memory;
  } else {
    const memory = await select<'user' | 'project' | 'local' | 'skip'>({
      message: 'Memory scope (optional, press Enter to skip):',
      choices: [
        { value: 'skip', name: 'skip', description: 'No memory scope' },
        { value: 'user', name: 'user', description: 'Persistent across all projects' },
        { value: 'project', name: 'project', description: 'Persistent within this project' },
        { value: 'local', name: 'local', description: 'Persistent on this machine only' },
      ],
      default: 'skip',
    });
    if (memory !== 'skip') {
      templateOptions.memory = memory;
    }
  }

  // FR-6: Model selection
  if (isAgent) {
    const model = await select<string>({
      message: 'Model:',
      choices: [
        {
          value: 'sonnet',
          name: 'sonnet',
          description: 'Balanced performance and speed (default)',
        },
        { value: 'opus', name: 'opus', description: 'Most capable' },
        { value: 'haiku', name: 'haiku', description: 'Fastest and most efficient' },
      ],
      default: 'sonnet',
    });
    templateOptions.model = model;
  } else {
    const model = await select<string | 'skip'>({
      message: 'Model (optional, press Enter to skip):',
      choices: [
        { value: 'skip', name: 'skip', description: 'Inherit from parent context' },
        {
          value: 'sonnet',
          name: 'sonnet',
          description: 'Balanced performance and speed',
        },
        { value: 'opus', name: 'opus', description: 'Most capable' },
        { value: 'haiku', name: 'haiku', description: 'Fastest and most efficient' },
      ],
      default: 'skip',
    });
    if (model !== 'skip') {
      templateOptions.model = model;
    }
  }

  // FR-7: Hooks configuration (only for basic and forked templates)
  if (templateType === 'basic' || templateType === 'forked') {
    const includeHooks = await confirm({
      message: 'Include hook configuration examples? (y/N)',
      default: false,
    });
    if (includeHooks) {
      templateOptions.includeHooks = true;
    }
  }

  // FR-8: Minimal mode
  const minimal = await confirm({
    message: 'Use minimal template (shorter, without educational guidance)? (y/N)',
    default: false,
  });
  if (minimal) {
    templateOptions.minimal = true;
  }

  // FR-9: Description input
  const desc = await input({
    message: 'Skill description (optional, press Enter to skip):',
  });
  if (desc.trim().length > 0) {
    description = desc.trim();
  }

  // FR-10: Argument hint input
  const argHint = await input({
    message: 'Argument hint (optional, press Enter to skip):',
    validate: (value: string) => {
      if (value.length === 0) return true; // allow skip
      if (value.length > 100) {
        return 'Argument hint must be 100 characters or fewer.';
      }
      return true;
    },
  });
  if (argHint.trim().length > 0) {
    templateOptions.argumentHint = argHint.trim();
  }

  // FR-11: Allowed tools input
  const toolsInput = await input({
    message: 'Allowed tools (comma-separated, press Enter to skip):',
  });
  if (toolsInput.trim().length > 0) {
    allowedTools = toolsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (allowedTools.length === 0) {
      allowedTools = undefined;
    }
  }

  return { templateOptions, description, allowedTools };
}

/**
 * Formats a configuration summary for display before scaffold generation.
 * Only shows fields that were explicitly set; Name and Template are always shown.
 * Returns a formatted string with aligned key-value pairs.
 */
export function formatSummary(
  name: string,
  options: ScaffoldTemplateOptions,
  description?: string,
  allowedTools?: string[]
): string {
  const entries: [string, string][] = [];

  // Always show Name and Template
  entries.push(['Name', name]);
  entries.push(['Template', options.templateType ?? 'basic']);

  // Conditionally show other fields
  if (options.context === 'fork') {
    entries.push(['Context', 'fork']);
  }
  if (options.agent) {
    entries.push(['Agent', options.agent]);
  }
  if (options.memory) {
    entries.push(['Memory', options.memory]);
  }
  if (options.model) {
    entries.push(['Model', options.model]);
  }
  if (options.includeHooks) {
    entries.push(['Hooks', 'yes']);
  }
  if (options.minimal) {
    entries.push(['Minimal', 'yes']);
  }
  if (description) {
    entries.push(['Description', description]);
  }
  if (options.argumentHint) {
    entries.push(['Argument hint', options.argumentHint]);
  }
  if (allowedTools && allowedTools.length > 0) {
    entries.push(['Allowed tools', allowedTools.join(', ')]);
  }

  // Find the longest label for alignment
  const maxLabelLen = Math.max(...entries.map(([label]) => label.length));

  const lines = entries.map(([label, value]) => {
    const padding = ' '.repeat(maxLabelLen - label.length);
    return `  ${label}:${padding}  ${value}`;
  });

  return `Scaffold configuration:\n${lines.join('\n')}`;
}

/**
 * Collects interactive prompt answers, displays a summary, and asks for
 * confirmation. If the user declines, restarts from the beginning with
 * fresh defaults. Returns the confirmed result.
 *
 * Throws ExitPromptError on Ctrl+C or EOF (handled by caller).
 */
async function collectAndConfirmPrompts(name: string): Promise<InteractivePromptResult> {
  for (;;) {
    const result = await runInteractivePrompts(name);

    // FR-12: Display summary before proceeding
    const summary = formatSummary(
      name,
      result.templateOptions,
      result.description,
      result.allowedTools
    );
    console.log(`\n${summary}\n`);

    const proceed = await confirm({
      message: 'Proceed? (Y/n)',
      default: true,
    });

    if (proceed) {
      return result;
    }
    // If declined, loop restarts with fresh defaults
  }
}

/**
 * Runs the interactive scaffold workflow: prompts → summary → confirmation → scaffold.
 * Handles Ctrl+C/EOF by displaying "Scaffold cancelled." and exiting with code 0.
 */
export async function runInteractiveScaffold(
  name: string,
  options: CliScaffoldOptions
): Promise<void> {
  try {
    const result = await collectAndConfirmPrompts(name);

    // Map CLI options to API scope (output-location flags are still respected)
    const scope: ApiScope | undefined = options.personal
      ? 'personal'
      : options.project
        ? 'project'
        : undefined;

    const scaffoldResult = await scaffold({
      name,
      description: result.description,
      allowedTools: result.allowedTools,
      output: options.output,
      scope,
      force: options.force,
      template: result.templateOptions,
    });

    // Reuse existing success output display logic
    output.displayCreatedFiles(scaffoldResult.path, scaffoldResult.files);
    const templateType = result.templateOptions.templateType ?? 'basic';
    if (result.templateOptions.minimal) {
      output.displayInfo(`Using "${templateType} (minimal)" template`);
      output.displayMinimalNextSteps(scaffoldResult.path, name);
    } else {
      if (templateType !== 'basic') {
        output.displayInfo(`Using "${templateType}" template`);
      }
      output.displayNextSteps(scaffoldResult.path, name);
    }
  } catch (error) {
    if (error instanceof ExitPromptError) {
      console.log('Scaffold cancelled.');
      process.exit(0);
    }
    throw error;
  }
}
