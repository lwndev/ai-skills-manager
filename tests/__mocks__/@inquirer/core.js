/**
 * Manual mock for @inquirer/core (ESM package).
 * Provides the ExitPromptError class used for Ctrl+C/EOF handling.
 */
class ExitPromptError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExitPromptError';
  }
}

module.exports = {
  ExitPromptError,
};
