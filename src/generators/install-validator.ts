/**
 * Install validator for skill package validation
 *
 * Validates package structure and content before installation:
 * 1. Package has a single root directory
 * 2. SKILL.md exists within the root directory
 * 3. Root directory name matches the skill name in SKILL.md frontmatter
 * 4. Skill content passes validation
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type AdmZip from 'adm-zip';
import {
  openZipArchive,
  getZipEntries,
  getZipRootDirectory,
  readEntryAsText,
  extractToDirectory,
  getTotalUncompressedSize,
} from '../utils/extractor';
import { parseFrontmatter } from '../utils/frontmatter-parser';
import { validateForPackaging } from './package-validator';

/**
 * Result of package structure validation
 */
export interface PackageStructureResult {
  /** Whether the structure is valid */
  valid: boolean;
  /** The root directory name (skill name from package structure) */
  rootDirectory?: string;
  /** Path to SKILL.md within the archive */
  skillMdPath?: string;
  /** Number of entries in the package */
  entryCount?: number;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Result of temporary directory extraction
 */
export interface TempExtractionResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** Path to the temporary directory */
  tempDir?: string;
  /** Path to the extracted skill directory */
  skillDir?: string;
  /** Error message if extraction failed */
  error?: string;
}

/**
 * Result of name match validation
 */
export interface NameMatchResult {
  /** Whether the names match */
  valid: boolean;
  /** The root directory name */
  directoryName?: string;
  /** The skill name from SKILL.md frontmatter */
  frontmatterName?: string;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Comprehensive result of package validation
 */
export interface PackageValidationResult {
  /** Whether the package is valid for installation */
  valid: boolean;
  /** Skill name extracted from package */
  skillName?: string;
  /** List of files in the package */
  files?: string[];
  /** Validation errors */
  errors: string[];
}

/**
 * Validate the structure of a skill package
 *
 * Ensures:
 * - Package has a single root directory
 * - SKILL.md exists within the root directory
 *
 * @param archive - The AdmZip instance for the package
 * @returns Structure validation result
 */
export function validatePackageStructure(archive: AdmZip): PackageStructureResult {
  // Get the root directory
  const rootDir = getZipRootDirectory(archive);

  if (!rootDir) {
    return {
      valid: false,
      error: 'Package must contain a single root directory with all skill files',
    };
  }

  // Get all entries
  const entries = getZipEntries(archive);
  const entryCount = entries.filter((e) => !e.isDirectory).length;

  // Check for SKILL.md within the root directory
  const skillMdPath = `${rootDir}/SKILL.md`;
  const skillMdEntry = entries.find((e) => e.entryName === skillMdPath);

  if (!skillMdEntry) {
    return {
      valid: false,
      rootDirectory: rootDir,
      entryCount,
      error: `SKILL.md not found in package root directory "${rootDir}"`,
    };
  }

  return {
    valid: true,
    rootDirectory: rootDir,
    skillMdPath,
    entryCount,
  };
}

/**
 * Extract a package to a temporary directory
 *
 * @param archive - The AdmZip instance for the package
 * @returns Extraction result with temp directory path
 */
export async function extractToTempDirectory(archive: AdmZip): Promise<TempExtractionResult> {
  // Validate structure first
  const structureResult = validatePackageStructure(archive);
  if (!structureResult.valid) {
    return {
      success: false,
      error: structureResult.error,
    };
  }

  const rootDir = structureResult.rootDirectory as string;

  try {
    // Create temp directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asm-install-'));

    // Extract to temp directory
    await extractToDirectory(archive, tempDir, true);

    // The skill directory is the root directory inside the temp directory
    const skillDir = path.join(tempDir, rootDir);

    return {
      success: true,
      tempDir,
      skillDir,
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      error: `Failed to extract package: ${err.message}`,
    };
  }
}

/**
 * Validate the content of an extracted skill
 *
 * Uses the existing validateForPackaging function to validate the skill
 *
 * @param tempDir - Path to the temporary directory containing the extracted skill
 * @param skillName - Name of the skill (root directory name)
 * @returns Validation result
 */
export async function validatePackageContent(
  tempDir: string,
  skillName: string
): Promise<{ valid: boolean; errors: string[] }> {
  const skillDir = path.join(tempDir, skillName);

  try {
    const result = await validateForPackaging(skillDir, false);

    return {
      valid: result.valid,
      errors: result.errors,
    };
  } catch (error) {
    const err = error as Error;
    return {
      valid: false,
      errors: [`Validation failed: ${err.message}`],
    };
  }
}

/**
 * Validate that the root directory name matches the skill name in SKILL.md
 *
 * @param archive - The AdmZip instance for the package
 * @returns Name match validation result
 */
export function validateNameMatch(archive: AdmZip): NameMatchResult {
  // Get the root directory
  const rootDir = getZipRootDirectory(archive);

  if (!rootDir) {
    return {
      valid: false,
      error: 'Package must contain a single root directory',
    };
  }

  // Read SKILL.md content
  const skillMdPath = `${rootDir}/SKILL.md`;
  const content = readEntryAsText(archive, skillMdPath);

  if (!content) {
    return {
      valid: false,
      directoryName: rootDir,
      error: `Could not read SKILL.md from package`,
    };
  }

  // Parse frontmatter
  const parseResult = parseFrontmatter(content);

  if (!parseResult.success) {
    return {
      valid: false,
      directoryName: rootDir,
      error: `Invalid SKILL.md frontmatter: ${parseResult.error}`,
    };
  }

  const frontmatterName = parseResult.data?.name;

  if (!frontmatterName) {
    return {
      valid: false,
      directoryName: rootDir,
      error: 'SKILL.md frontmatter is missing the "name" field',
    };
  }

  // Compare names
  if (frontmatterName !== rootDir) {
    return {
      valid: false,
      directoryName: rootDir,
      frontmatterName,
      error: `Skill name mismatch: directory is "${rootDir}" but SKILL.md declares name as "${frontmatterName}"`,
    };
  }

  return {
    valid: true,
    directoryName: rootDir,
    frontmatterName,
  };
}

/**
 * Clean up a temporary directory
 *
 * @param tempDir - Path to the temporary directory to remove
 */
export async function cleanupTempDirectory(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors - temp directories are cleaned up by the OS eventually
  }
}

/**
 * Perform comprehensive package validation
 *
 * Validates:
 * 1. Package structure (single root directory with SKILL.md)
 * 2. Name match (directory name matches SKILL.md name field)
 * 3. Content validation (skill passes all validation checks)
 *
 * @param packagePath - Path to the .skill package file
 * @returns Comprehensive validation result
 */
export async function validatePackage(packagePath: string): Promise<PackageValidationResult> {
  const errors: string[] = [];
  let tempDir: string | undefined;

  try {
    // Open the archive
    const archive = openZipArchive(packagePath);

    // Validate structure
    const structureResult = validatePackageStructure(archive);
    if (!structureResult.valid) {
      return {
        valid: false,
        errors: [structureResult.error || 'Invalid package structure'],
      };
    }

    const skillName = structureResult.rootDirectory as string;

    // Validate name match
    const nameResult = validateNameMatch(archive);
    if (!nameResult.valid) {
      errors.push(nameResult.error || 'Name mismatch');
    }

    // Extract to temp directory and validate content
    const extractResult = await extractToTempDirectory(archive);
    if (!extractResult.success) {
      return {
        valid: false,
        skillName,
        errors: [extractResult.error || 'Failed to extract package'],
      };
    }

    tempDir = extractResult.tempDir;

    // Validate content
    const contentResult = await validatePackageContent(tempDir as string, skillName);
    if (!contentResult.valid) {
      errors.push(...contentResult.errors);
    }

    // Get file list from package
    const entries = getZipEntries(archive);
    const files = entries
      .filter((e) => !e.isDirectory)
      .map((e) => e.entryName.replace(`${skillName}/`, ''));

    return {
      valid: errors.length === 0,
      skillName,
      files,
      errors,
    };
  } catch (error) {
    const err = error as Error;
    return {
      valid: false,
      errors: [`Package validation failed: ${err.message}`],
    };
  } finally {
    // Clean up temp directory
    if (tempDir) {
      await cleanupTempDirectory(tempDir);
    }
  }
}

/**
 * Package warnings detected during validation
 */
export interface PackageWarnings {
  /** List of nested .skill files found in the package */
  nestedSkillFiles: string[];
  /** List of external URLs found in SKILL.md */
  externalUrls: string[];
  /** List of Windows-style paths found in SKILL.md */
  windowsPaths: string[];
  /** Whether package is large (>5MB) */
  isLargePackage: boolean;
  /** Whether package is very large (>50MB) */
  isVeryLargePackage: boolean;
  /** Total uncompressed size in bytes */
  totalSize: number;
}

/** Size thresholds for package warnings (in bytes) */
export const PACKAGE_SIZE_THRESHOLDS = {
  /** Threshold for showing progress during extraction (5MB) */
  LARGE: 5 * 1024 * 1024,
  /** Threshold for warning before installation (50MB) */
  VERY_LARGE: 50 * 1024 * 1024,
};

/**
 * Detect nested .skill files in the package
 *
 * @param archive - The AdmZip instance
 * @returns Array of paths to nested .skill files
 */
export function detectNestedSkillFiles(archive: AdmZip): string[] {
  const entries = getZipEntries(archive);
  const nestedSkillFiles: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory && entry.entryName.endsWith('.skill')) {
      nestedSkillFiles.push(entry.entryName);
    }
  }

  return nestedSkillFiles;
}

/**
 * Detect external URLs in content
 *
 * Looks for http:// and https:// URLs in the given content.
 *
 * @param content - Text content to scan
 * @returns Array of detected URLs
 */
export function detectExternalUrls(content: string): string[] {
  // Match URLs starting with http:// or https://
  const urlPattern = /https?:\/\/[^\s<>[\]()'"]+/gi;
  const matches = content.match(urlPattern);

  if (!matches) {
    return [];
  }

  // Remove duplicates and clean up trailing punctuation
  const uniqueUrls = new Set<string>();
  for (const url of matches) {
    // Remove common trailing punctuation that might be captured
    const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
    uniqueUrls.add(cleanUrl);
  }

  return Array.from(uniqueUrls);
}

/**
 * Detect Windows-style paths in content
 *
 * Looks for paths with backslashes (e.g., C:\path\to\file or scripts\run.bat)
 *
 * @param content - Text content to scan
 * @returns Array of detected Windows-style paths
 */
export function detectWindowsPaths(content: string): string[] {
  // Match patterns that look like Windows paths:
  // - Drive letters (C:\, D:\, etc.)
  // - Relative paths with backslashes (scripts\file.py)
  // - UNC paths (\\server\share)
  const windowsPathPattern = /(?:[A-Za-z]:\\|\\\\[\w.-]+\\|[\w.-]+\\[\w.-]+)[^\s<>[\]()'""]*/g;
  const matches = content.match(windowsPathPattern);

  if (!matches) {
    return [];
  }

  // Remove duplicates
  return Array.from(new Set(matches));
}

/**
 * Analyze a package for warnings
 *
 * Detects potential issues that should be shown to the user but don't
 * prevent installation.
 *
 * @param archive - The AdmZip instance
 * @returns Package warnings
 */
export function analyzePackageWarnings(archive: AdmZip): PackageWarnings {
  // Check package size
  const totalSize = getTotalUncompressedSize(archive);
  const isLargePackage = totalSize > PACKAGE_SIZE_THRESHOLDS.LARGE;
  const isVeryLargePackage = totalSize > PACKAGE_SIZE_THRESHOLDS.VERY_LARGE;

  // Detect nested .skill files
  const nestedSkillFiles = detectNestedSkillFiles(archive);

  // Get SKILL.md content for content analysis
  const rootDir = getZipRootDirectory(archive);
  let externalUrls: string[] = [];
  let windowsPaths: string[] = [];

  if (rootDir) {
    const skillMdPath = `${rootDir}/SKILL.md`;
    const content = readEntryAsText(archive, skillMdPath);

    if (content) {
      externalUrls = detectExternalUrls(content);
      windowsPaths = detectWindowsPaths(content);
    }
  }

  return {
    nestedSkillFiles,
    externalUrls,
    windowsPaths,
    isLargePackage,
    isVeryLargePackage,
    totalSize,
  };
}
