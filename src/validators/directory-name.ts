/**
 * Directory name validation
 *
 * Validates that the skill name in frontmatter matches the parent directory name.
 * This ensures consistency between the directory structure and skill metadata.
 */

import * as path from 'path';
import { ValidationResult } from './name';

/**
 * Validate that the frontmatter name matches the parent directory name
 *
 * @param skillFilePath - Full path to the SKILL.md file
 * @param frontmatterName - Name from the frontmatter
 * @returns Validation result
 */
export function validateDirectoryName(
  skillFilePath: string,
  frontmatterName: string
): ValidationResult {
  // Get the directory containing SKILL.md
  const skillDir = path.dirname(skillFilePath);

  // Get the name of the skill directory
  const directoryName = path.basename(skillDir);

  // Handle edge case: root directory
  if (directoryName === '' || directoryName === '.' || directoryName === '/') {
    // At root or special directory, skip validation
    return { valid: true };
  }

  // Compare directory name with frontmatter name
  if (directoryName !== frontmatterName) {
    return {
      valid: false,
      error: `Skill name "${frontmatterName}" does not match directory name "${directoryName}"`,
    };
  }

  return { valid: true };
}
