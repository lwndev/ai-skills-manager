/**
 * Scope validation for uninstall command
 *
 * Security-focused validation that restricts scope to only
 * the two official Claude Code skill locations.
 *
 * Unlike the install command which allows custom paths, uninstall
 * only supports 'project' and 'personal' scopes to prevent
 * accidental deletion of files outside skill directories.
 */

export interface UninstallScopeValidationResult {
  valid: boolean;
  scope: 'project' | 'personal';
  error?: string;
}

/** Valid scopes for uninstall operations */
export const VALID_SCOPES = ['project', 'personal'] as const;
export type UninstallScope = (typeof VALID_SCOPES)[number];

/**
 * Validate the scope parameter for uninstall operations
 *
 * Only 'project' or 'personal' scopes are accepted (case-sensitive).
 * Defaults to 'project' if undefined.
 *
 * @param scope - The scope value to validate
 * @returns Validation result with normalized scope value
 */
export function validateUninstallScope(scope: string | undefined): UninstallScopeValidationResult {
  // Default to 'project' if not provided
  if (scope === undefined || scope === '') {
    return {
      valid: true,
      scope: 'project',
    };
  }

  // Check for valid scope (case-sensitive)
  if (scope === 'project' || scope === 'personal') {
    return {
      valid: true,
      scope,
    };
  }

  // Reject any other value
  return {
    valid: false,
    scope: 'project', // Default value for type safety
    error: `Invalid scope "${scope}". Only 'project' or 'personal' are supported.`,
  };
}
