/**
 * User prompt utilities for interactive CLI operations
 *
 * Provides functions for getting user confirmations and input.
 */

import * as readline from 'readline';

/**
 * Create a readline interface for user input
 *
 * @returns Readline interface
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for confirmation with a yes/no question
 *
 * @param question - The question to ask
 * @returns Promise resolving to true for yes, false for no
 */
export async function confirm(question: string): Promise<boolean> {
  const rl = createReadlineInterface();

  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      const normalizedAnswer = answer.trim().toLowerCase();
      resolve(normalizedAnswer === 'y' || normalizedAnswer === 'yes');
    });
  });
}

/**
 * Prompt user for overwrite confirmation
 *
 * @param packagePath - Path to the existing package file
 * @returns Promise resolving to true if user confirms overwrite
 */
export async function confirmOverwrite(packagePath: string): Promise<boolean> {
  return confirm(`Package already exists at ${packagePath}. Overwrite?`);
}

/**
 * Prompt user for install overwrite confirmation
 *
 * Shows the skill name and a summary of file changes before asking
 * for confirmation.
 *
 * @param skillName - Name of the existing skill
 * @param promptMessage - Pre-formatted prompt message to display
 * @returns Promise resolving to true if user confirms install
 */
export async function confirmInstallOverwrite(
  skillName: string,
  promptMessage: string
): Promise<boolean> {
  console.log(promptMessage);
  return confirm(`Overwrite skill "${skillName}"?`);
}

/**
 * Prompt user for uninstall confirmation
 *
 * Shows the formatted confirmation prompt and asks for yes/no confirmation.
 *
 * @param skillName - Name of the skill to uninstall
 * @param promptMessage - Pre-formatted prompt message to display (from formatConfirmationPrompt)
 * @returns Promise resolving to true if user confirms uninstall
 */
export async function confirmUninstall(skillName: string, promptMessage: string): Promise<boolean> {
  console.log(promptMessage);
  return confirm(`Remove skill '${skillName}'?`);
}

/**
 * Prompt user for multi-skill uninstall confirmation
 *
 * Shows the formatted confirmation prompt and asks for yes/no confirmation.
 *
 * @param count - Number of skills to uninstall
 * @param promptMessage - Pre-formatted prompt message to display (from formatMultiSkillConfirmation)
 * @returns Promise resolving to true if user confirms uninstall
 */
export async function confirmMultiUninstall(
  count: number,
  promptMessage: string
): Promise<boolean> {
  console.log(promptMessage);
  return confirm(`Remove ${count} skills?`);
}

/**
 * Prompt user for bulk uninstall confirmation with --force
 *
 * When removing 3+ skills with --force, requires user to type "yes" exactly.
 * This is a safety measure to prevent accidental bulk deletions.
 *
 * @param count - Number of skills being removed
 * @returns Promise resolving to true only if user types "yes"
 */
export async function confirmBulkForceUninstall(count: number): Promise<boolean> {
  const rl = createReadlineInterface();

  return new Promise((resolve) => {
    rl.question(`Removing ${count} skills with --force. Type 'yes' to confirm: `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

/**
 * Prompt user for uninstall confirmation with warning
 *
 * Shows a warning message before asking for confirmation.
 * Used for cases like missing SKILL.md, unexpected files, etc.
 *
 * @param skillName - Name of the skill
 * @param warningMessage - Warning message to display before confirmation
 * @param promptMessage - Pre-formatted prompt message (file list, etc.)
 * @returns Promise resolving to true if user confirms
 */
export async function confirmUninstallWithWarning(
  skillName: string,
  warningMessage: string,
  promptMessage: string
): Promise<boolean> {
  console.log(warningMessage);
  console.log(promptMessage);
  return confirm(`Remove skill '${skillName}'?`);
}
