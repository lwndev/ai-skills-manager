/**
 * Skill name validation for uninstall command
 *
 * Security-focused validation that prevents path traversal attacks.
 * This validator is stricter than the scaffold name validator because
 * it's used in a destructive operation (file deletion).
 *
 * Rules:
 * - Reject path separators (/ and \)
 * - Reject . and .. names
 * - Reject absolute paths (starting with / or drive letters)
 * - Reject null bytes and control characters (Unicode 0x00-0x1F, 0x7F)
 * - Reject any non-ASCII characters (simplest Unicode attack defense)
 * - Pattern: ^[a-z0-9]+(-[a-z0-9]+)*$ (lowercase alphanumeric with hyphens)
 * - Length: 1-64 characters
 * - Cannot start or end with hyphen
 */

export interface UninstallNameValidationResult {
  valid: boolean;
  error?: string;
}

const MAX_LENGTH = 64;
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Check if a string contains path separators
 */
function containsPathSeparators(name: string): boolean {
  return name.includes('/') || name.includes('\\');
}

/**
 * Check if a name is a path traversal attempt
 */
function isPathTraversal(name: string): boolean {
  return name === '.' || name === '..' || name.includes('../') || name.includes('..\\');
}

/**
 * Check if a name is an absolute path
 */
function isAbsolutePath(name: string): boolean {
  // Unix absolute path
  if (name.startsWith('/')) {
    return true;
  }
  // Windows absolute path (drive letter)
  if (/^[a-zA-Z]:/.test(name)) {
    return true;
  }
  return false;
}

/**
 * Check if a string contains null bytes or control characters
 */
function containsControlCharacters(name: string): boolean {
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    // Null byte and control characters (0x00-0x1F) and DEL (0x7F)
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a string contains non-ASCII characters
 */
function containsNonAscii(name: string): boolean {
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code > 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Validate a skill name for uninstall operations
 *
 * This performs comprehensive security validation to prevent
 * path traversal and other attacks before any file system operations.
 *
 * @param name - The skill name to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validateSkillName(name: string): UninstallNameValidationResult {
  // Check for empty name
  if (!name || name.trim() === '') {
    return {
      valid: false,
      error: 'Skill name cannot be empty',
    };
  }

  // Security check: null bytes and control characters
  if (containsControlCharacters(name)) {
    return {
      valid: false,
      error: 'Skill name contains invalid control characters',
    };
  }

  // Security check: non-ASCII characters
  if (containsNonAscii(name)) {
    return {
      valid: false,
      error: 'Skill name must contain only ASCII characters',
    };
  }

  // Security check: path separators
  if (containsPathSeparators(name)) {
    return {
      valid: false,
      error: 'Skill name cannot contain path separators (/ or \\)',
    };
  }

  // Security check: path traversal
  if (isPathTraversal(name)) {
    return {
      valid: false,
      error: 'Skill name cannot be "." or ".." (path traversal not allowed)',
    };
  }

  // Security check: absolute paths
  if (isAbsolutePath(name)) {
    return {
      valid: false,
      error: 'Skill name cannot be an absolute path',
    };
  }

  // Check maximum length
  if (name.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `Skill name must be ${MAX_LENGTH} characters or less (got ${name.length})`,
    };
  }

  // Check pattern (lowercase alphanumeric with hyphens)
  if (!NAME_PATTERN.test(name)) {
    // Provide more specific error messages
    if (/[A-Z]/.test(name)) {
      return {
        valid: false,
        error: 'Skill name must be lowercase',
      };
    }
    if (name.startsWith('-')) {
      return {
        valid: false,
        error: 'Skill name cannot start with a hyphen',
      };
    }
    if (name.endsWith('-')) {
      return {
        valid: false,
        error: 'Skill name cannot end with a hyphen',
      };
    }
    if (name.includes('--')) {
      return {
        valid: false,
        error: 'Skill name cannot contain consecutive hyphens',
      };
    }
    return {
      valid: false,
      error:
        'Skill name must contain only lowercase letters, numbers, and hyphens. ' +
        `Example: "my-skill-name" (got "${name}")`,
    };
  }

  return { valid: true };
}
