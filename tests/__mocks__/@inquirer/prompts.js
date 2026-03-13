/**
 * Manual mock for @inquirer/prompts (ESM package).
 * Provides vi.fn() stubs so tests that import scaffold-interactive
 * transitively don't need to deal with ESM parsing.
 * Tests that need to control prompt behavior should override these
 * with vi.mock('@inquirer/prompts', ...) in their test file.
 */
module.exports = {
  select: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
  checkbox: vi.fn(),
  editor: vi.fn(),
  expand: vi.fn(),
  number: vi.fn(),
  password: vi.fn(),
  rawlist: vi.fn(),
  search: vi.fn(),
  Separator: class Separator {},
};
