/**
 * Skill name validation utilities for the API layer.
 *
 * @module utils/skill-name-validation
 */

import * as path from 'path';
import { SecurityError } from '../errors';

/**
 * Validates a skill name for security.
 *
 * Rejects names that could be used for path traversal or other security exploits.
 * This function should be called before using user-provided skill names in
 * filesystem operations.
 *
 * @param name - The skill name to validate
 * @throws SecurityError if the name is invalid or could be used for path traversal
 *
 * @example
 * ```typescript
 * import { validateSkillName } from '../utils/skill-name-validation';
 *
 * // Valid names pass through
 * validateSkillName('my-skill'); // OK
 * validateSkillName('skill_v2'); // OK
 *
 * // Invalid names throw SecurityError
 * validateSkillName('../etc'); // throws SecurityError
 * validateSkillName(''); // throws SecurityError
 * ```
 */
export function validateSkillName(name: string): void {
  // Check for empty names
  if (!name || name.trim() === '') {
    throw new SecurityError('Invalid skill name: name cannot be empty');
  }

  // Check for path traversal attempts
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw new SecurityError(`Invalid skill name "${name}": contains path traversal characters`);
  }

  // Check for absolute path indicators
  if (path.isAbsolute(name)) {
    throw new SecurityError(`Invalid skill name "${name}": appears to be an absolute path`);
  }
}
