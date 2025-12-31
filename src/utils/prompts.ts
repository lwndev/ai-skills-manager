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
