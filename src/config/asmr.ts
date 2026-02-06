/**
 * ASMR Mode Configuration
 *
 * Handles loading and resolving ASMR mode configuration from multiple sources
 * with proper precedence: CLI flag > environment variable > config file > default
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  AsmrConfig,
  AsmrConfigFile,
  AsmrConfigResolution,
  AsmrConfigSource,
  DEFAULT_ASMR_CONFIG,
  isAsmrTheme,
} from '../types/asmr';

/**
 * Path to the ASM config directory
 */
export const ASM_CONFIG_DIR = join(homedir(), '.asm');

/**
 * Path to the ASM config file
 */
export const ASM_CONFIG_FILE = join(ASM_CONFIG_DIR, 'config.json');

/**
 * Environment variable name for ASMR mode
 */
export const ASM_ASMR_ENV = 'ASM_ASMR';

/**
 * Load ASMR configuration from the config file
 * @returns The config file contents or null if not found/invalid
 */
export function loadConfigFile(): AsmrConfigFile | null {
  if (!existsSync(ASM_CONFIG_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(ASM_CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(content) as unknown;

    // Basic validation - ensure it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    return parsed as AsmrConfigFile;
  } catch {
    // Invalid JSON or read error - return null
    return null;
  }
}

/**
 * Parse ASMR enabled state from environment variable
 * @returns true, false, or undefined if not set
 */
export function getEnvAsmrEnabled(): boolean | undefined {
  const envValue = process.env[ASM_ASMR_ENV];
  if (envValue === undefined || envValue === '') {
    return undefined;
  }

  // Accept '1', 'true', 'yes' as enabled
  const lowerValue = envValue.toLowerCase();
  if (lowerValue === '1' || lowerValue === 'true' || lowerValue === 'yes') {
    return true;
  }

  // Accept '0', 'false', 'no' as disabled
  if (lowerValue === '0' || lowerValue === 'false' || lowerValue === 'no') {
    return false;
  }

  // Invalid value - treat as not set
  return undefined;
}

/**
 * Options for resolving ASMR configuration
 */
export interface ResolveAsmrConfigOptions {
  /** CLI flag value (--asmr or --no-asmr) */
  cliFlag?: boolean;
}

/**
 * Resolve ASMR configuration from all sources with proper precedence
 *
 * Precedence order (highest to lowest):
 * 1. CLI flag (--asmr / --no-asmr)
 * 2. Environment variable (ASM_ASMR)
 * 3. Config file (~/.asm/config.json)
 * 4. Default (disabled)
 *
 * @param options Resolution options including CLI flag
 * @returns Resolved configuration with source indicator
 */
export function resolveAsmrConfig(options: ResolveAsmrConfigOptions = {}): AsmrConfigResolution {
  // Start with default config
  let config: AsmrConfig = { ...DEFAULT_ASMR_CONFIG };
  let source: AsmrConfigSource = 'default';

  // Load config file (lowest precedence after default)
  const configFile = loadConfigFile();
  if (configFile !== null) {
    if (typeof configFile.asmr === 'boolean') {
      config.enabled = configFile.asmr;
      source = 'config';
    }
    if (typeof configFile.asmrTheme === 'string' && isAsmrTheme(configFile.asmrTheme)) {
      config.theme = configFile.asmrTheme;
    }
    if (typeof configFile.asmrSounds === 'boolean') {
      config.sounds = configFile.asmrSounds;
    }
  }

  // Check environment variable (higher precedence than config)
  const envEnabled = getEnvAsmrEnabled();
  if (envEnabled !== undefined) {
    config.enabled = envEnabled;
    source = 'env';
  }

  // Check CLI flag (highest precedence)
  if (options.cliFlag !== undefined) {
    config.enabled = options.cliFlag;
    source = 'flag';
  }

  return { config, source };
}

/**
 * Save ASMR configuration to the config file
 * Creates the config directory if needed
 *
 * @param config The configuration to save
 */
export function saveAsmrConfig(config: Partial<AsmrConfig>): void {
  // Ensure config directory exists
  if (!existsSync(ASM_CONFIG_DIR)) {
    mkdirSync(ASM_CONFIG_DIR, { recursive: true });
  }

  // Load existing config or start fresh
  let existingConfig: AsmrConfigFile = {};
  if (existsSync(ASM_CONFIG_FILE)) {
    const loaded = loadConfigFile();
    if (loaded !== null) {
      existingConfig = loaded;
    }
  }

  // Merge new config values
  if (config.enabled !== undefined) {
    existingConfig.asmr = config.enabled;
  }
  if (config.theme !== undefined) {
    existingConfig.asmrTheme = config.theme;
  }
  if (config.sounds !== undefined) {
    existingConfig.asmrSounds = config.sounds;
  }

  // Write config file
  writeFileSync(ASM_CONFIG_FILE, JSON.stringify(existingConfig, null, 2) + '\n');
}

/**
 * Get the current ASMR configuration without CLI overrides
 * Useful for checking the configured state before command execution
 */
export function getAsmrConfig(): AsmrConfig {
  return resolveAsmrConfig().config;
}

// --- Resolved config store ---
// The CLI preAction hook stores the resolved config here so commands
// can access it without importing cli.ts (which causes circular deps).

let _resolvedConfig: AsmrConfigResolution | null = null;

/**
 * Store the resolved ASMR config (called from cli.ts preAction hook)
 */
export function setResolvedAsmrConfig(config: AsmrConfigResolution): void {
  _resolvedConfig = config;
}

/**
 * Get the resolved ASMR config stored by the CLI preAction hook.
 * Falls back to resolveAsmrConfig() if called before the hook runs.
 */
export function getResolvedAsmrConfig(): AsmrConfigResolution {
  if (_resolvedConfig === null) {
    return resolveAsmrConfig();
  }
  return _resolvedConfig;
}

/**
 * Reset the stored config (for testing purposes)
 */
export function resetResolvedAsmrConfig(): void {
  _resolvedConfig = null;
}
