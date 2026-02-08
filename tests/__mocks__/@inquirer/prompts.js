/**
 * Manual mock for @inquirer/prompts (ESM package).
 * Provides jest.fn() stubs so tests that import scaffold-interactive
 * transitively don't need to deal with ESM parsing.
 * Tests that need to control prompt behavior should override these
 * with jest.mock('@inquirer/prompts', ...) in their test file.
 */
module.exports = {
  select: jest.fn(),
  input: jest.fn(),
  confirm: jest.fn(),
  checkbox: jest.fn(),
  editor: jest.fn(),
  expand: jest.fn(),
  number: jest.fn(),
  password: jest.fn(),
  rawlist: jest.fn(),
  search: jest.fn(),
  Separator: class Separator {},
};
