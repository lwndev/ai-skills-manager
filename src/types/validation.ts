/**
 * Type definitions for skill validation
 */

/**
 * Names of all validation checks performed
 */
export type CheckName =
  | 'fileExists'
  | 'frontmatterValid'
  | 'requiredFields'
  | 'allowedProperties'
  | 'nameFormat'
  | 'descriptionFormat';

/**
 * Result of a single validation check
 */
export interface ValidationCheck {
  /** Name of the check */
  name: CheckName;
  /** Whether the check passed */
  passed: boolean;
  /** Error message if check failed */
  error?: string;
}

/**
 * Overall validation result containing all check results
 */
export interface ValidationResult {
  /** Whether all checks passed */
  valid: boolean;
  /** Path to the skill being validated */
  skillPath: string;
  /** Name of the skill (extracted from frontmatter, if available) */
  skillName?: string;
  /** Results of each individual check, keyed by check name */
  checks: Record<CheckName, { passed: boolean; error?: string }>;
  /** Array of all error messages (for convenience) */
  errors: string[];
}

/**
 * Parsed frontmatter data from SKILL.md
 */
export interface ParsedFrontmatter {
  name?: string;
  description?: string;
  license?: string;
  'allowed-tools'?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Result of frontmatter parsing operation
 */
export interface FrontmatterParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed frontmatter data (if successful) */
  data?: ParsedFrontmatter;
  /** Error message (if failed) */
  error?: string;
  /** Raw frontmatter string before parsing (if extracted) */
  raw?: string;
}
