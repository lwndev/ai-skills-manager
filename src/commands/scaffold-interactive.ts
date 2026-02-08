/**
 * Interactive scaffold workflow for FEAT-019.
 *
 * Provides a guided prompt-driven experience for template selection
 * and configuration when `asm scaffold <name> --interactive` is used.
 */

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

/**
 * Placeholder for the interactive prompt flow (Phase 2).
 * Will be replaced with the full runInteractivePrompts() implementation.
 */
export async function runInteractiveScaffold(
  _name: string,
  _options: CliScaffoldOptions
): Promise<void> {
  // Phase 2 will implement the full prompt flow here
  throw new Error('Interactive scaffold not yet implemented');
}
