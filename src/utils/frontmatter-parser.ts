/**
 * YAML Frontmatter Parser for SKILL.md files
 *
 * Extracts and parses YAML frontmatter from markdown content.
 * Frontmatter format: ---\n(content)\n---
 */

import * as yaml from 'js-yaml';
import { FrontmatterParseResult, ParsedFrontmatter } from '../types/validation';

const FRONTMATTER_DELIMITER = '---';

/**
 * Parse YAML frontmatter from SKILL.md content
 *
 * @param content - Full file content
 * @returns Parse result with data or error
 */
export function parseFrontmatter(content: string): FrontmatterParseResult {
  // Handle empty content
  if (!content || content.trim() === '') {
    return {
      success: false,
      error: 'SKILL.md is empty',
    };
  }

  // Check for opening delimiter
  const trimmedContent = content.trimStart();
  if (!trimmedContent.startsWith(FRONTMATTER_DELIMITER)) {
    return {
      success: false,
      error: 'Missing YAML frontmatter. File must start with "---"',
    };
  }

  // Find the closing delimiter
  // Skip the first delimiter and find the second one
  const afterOpeningDelimiter = trimmedContent.slice(FRONTMATTER_DELIMITER.length);
  const closingIndex = afterOpeningDelimiter.indexOf(`\n${FRONTMATTER_DELIMITER}`);

  if (closingIndex === -1) {
    // Check if there's just a delimiter with no newline after it
    if (afterOpeningDelimiter.trim().startsWith(FRONTMATTER_DELIMITER)) {
      return {
        success: false,
        error: 'Frontmatter cannot be empty',
      };
    }
    return {
      success: false,
      error: 'Unclosed YAML frontmatter. Missing closing "---"',
    };
  }

  // Extract the raw frontmatter content (between delimiters)
  const rawFrontmatter = afterOpeningDelimiter.slice(0, closingIndex).trim();

  // Check for empty frontmatter
  if (rawFrontmatter === '') {
    return {
      success: false,
      error: 'Frontmatter cannot be empty',
    };
  }

  // Parse the YAML
  try {
    const parsed = yaml.load(rawFrontmatter);

    // Validate that parsed result is an object
    if (parsed === null || parsed === undefined) {
      return {
        success: false,
        error: 'Frontmatter cannot be empty',
      };
    }

    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        success: false,
        error: 'Frontmatter must be a YAML object with key-value pairs',
      };
    }

    // Normalize allowed-tools: convert space-delimited string to array
    // Use parsed (unknown type) to check before casting to ParsedFrontmatter
    const rawParsed = parsed as Record<string, unknown>;
    if (typeof rawParsed['allowed-tools'] === 'string') {
      const toolsString = rawParsed['allowed-tools'].trim();
      if (toolsString === '') {
        // Empty string becomes empty array
        rawParsed['allowed-tools'] = [];
      } else {
        // Split by whitespace (one or more spaces/tabs)
        rawParsed['allowed-tools'] = toolsString.split(/\s+/);
      }
    }
    const frontmatter = rawParsed as ParsedFrontmatter;

    // Extract body content (everything after closing delimiter)
    const bodyStart = closingIndex + `\n${FRONTMATTER_DELIMITER}`.length;
    const body = afterOpeningDelimiter.slice(bodyStart).trim();

    return {
      success: true,
      data: frontmatter,
      raw: rawFrontmatter,
      body,
    };
  } catch (e) {
    const yamlError = e as yaml.YAMLException;
    return {
      success: false,
      error: `Invalid YAML frontmatter: ${yamlError.message}`,
    };
  }
}

/**
 * Extract just the frontmatter portion from content (for display purposes)
 *
 * @param content - Full file content
 * @returns The raw frontmatter string, or null if not found
 */
export function extractRawFrontmatter(content: string): string | null {
  const result = parseFrontmatter(content);
  return result.raw ?? null;
}
