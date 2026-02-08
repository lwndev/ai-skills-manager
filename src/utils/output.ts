/**
 * Output formatting utilities for the CLI
 */

/**
 * Format a success message with a checkmark
 */
export function success(message: string): string {
  return `✓ ${message}`;
}

/**
 * Format an error message
 */
export function error(message: string): string {
  return `✗ Error: ${message}`;
}

/**
 * Format a warning message
 */
export function warning(message: string): string {
  return `⚠ ${message}`;
}

/**
 * Format an info message
 */
export function info(message: string): string {
  return `ℹ ${message}`;
}

/**
 * Format a file path display
 */
export function filePath(path: string): string {
  return `  ${path}`;
}

/**
 * Display created files structure
 */
export function displayCreatedFiles(skillPath: string, filesCreated: string[]): void {
  console.log(success('Skill scaffolded successfully!'));
  console.log('\nCreated:');
  console.log(filePath(skillPath + '/'));
  for (const file of filesCreated) {
    // Show relative path from skill directory
    const relativePath = file.replace(skillPath + '/', '');
    console.log(filePath('  ' + relativePath));
  }
}

/**
 * Display next steps after successful scaffold
 */
export function displayNextSteps(skillPath: string, _skillName: string): void {
  console.log('\nNext steps:');
  console.log('  1. Edit the SKILL.md file to add your skill instructions');
  console.log('  2. Add any scripts to the scripts/ directory');
  console.log('  3. Test your skill by invoking it in Claude Code');
  console.log('\nDocumentation:');
  console.log('  https://docs.claude.com/en/docs/claude-code/skills');
  console.log('\nSkill location:');
  console.log(filePath(skillPath));
}

/**
 * Display next steps after successful minimal scaffold
 */
export function displayMinimalNextSteps(skillPath: string): void {
  console.log('\nNext steps:');
  console.log('  1. Edit the SKILL.md file to add your skill instructions');
  console.log('  2. Validate with: asm validate');
  console.log('\nSkill location:');
  console.log(filePath(skillPath));
}

/**
 * Display error with context
 */
export function displayError(message: string, context?: string): void {
  console.error(error(message));
  if (context) {
    console.error(`  ${context}`);
  }
}

/**
 * Display validation error with examples
 */
export function displayValidationError(field: string, errorMessage: string): void {
  console.error(error(`Invalid ${field}`));
  console.error(`  ${errorMessage}`);
}

/**
 * Display an info message
 */
export function displayInfo(message: string): void {
  console.log(info(message));
}

/**
 * Display a warning message
 */
export function displayWarning(message: string): void {
  console.log(warning(message));
}
