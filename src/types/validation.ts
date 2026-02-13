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
  | 'descriptionFormat'
  | 'compatibilityFormat'
  | 'contextFormat'
  | 'agentFormat'
  | 'hooksFormat'
  | 'userInvocableFormat'
  | 'argumentHintFormat'
  | 'keepCodingInstructionsFormat'
  | 'toolsFormat'
  | 'colorFormat'
  | 'disableModelInvocationFormat'
  | 'versionFormat'
  | 'allowedToolsFormat'
  | 'nameMatchesDirectory';

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
  /** Array of warning messages (non-blocking issues) */
  warnings?: string[];
}

/**
 * Hook configuration for skill execution events
 */
export interface HooksConfig {
  PreToolUse?: string | string[];
  PostToolUse?: string | string[];
  Stop?: string | string[];
  [key: string]: string | string[] | undefined;
}

/**
 * Parsed frontmatter data from SKILL.md
 */
export interface ParsedFrontmatter {
  name?: string;
  description?: string;
  license?: string;
  compatibility?: string;
  'allowed-tools'?: string[];
  metadata?: Record<string, unknown>;
  // Claude Code 2.1.x fields
  context?: 'fork';
  agent?: string;
  hooks?: HooksConfig;
  'user-invocable'?: boolean;
  // FEAT-014 fields
  'argument-hint'?: string;
  'keep-coding-instructions'?: boolean;
  tools?: string | string[];
  color?: string;
  'disable-model-invocation'?: boolean;
  version?: string;
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
  /** Body content after frontmatter (if successful) */
  body?: string;
}
