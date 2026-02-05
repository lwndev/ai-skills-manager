#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { registerScaffoldCommand } from './commands/scaffold';
import { registerValidateCommand } from './commands/validate';
import { registerPackageCommand } from './commands/package';
import { registerInstallCommand } from './commands/install';
import { registerUninstallCommand } from './commands/uninstall';
import { registerUpdateCommand } from './commands/update';
import { registerListCommand } from './commands/list';
import { resolveAsmrConfig } from './config/asmr';
import { AsmrConfigResolution } from './types/asmr';

const program = new Command();

// Read version from package.json to ensure single source of truth
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

// Global ASMR config resolved after parsing
let resolvedAsmrConfig: AsmrConfigResolution | null = null;

program
  .name('asm')
  .description('AI Skills Manager - CLI tool for managing Claude Code Agent Skills')
  .version(packageJson.version)
  .option('--asmr', 'Enable ASMR mode with calming animations')
  .option('--no-asmr', 'Disable ASMR mode')
  .hook('preAction', (thisCommand) => {
    // Resolve ASMR config before any command runs
    const opts = thisCommand.opts();
    // Commander sets opts.asmr to true for --asmr, false for --no-asmr, undefined if neither
    const cliFlag = opts.asmr as boolean | undefined;
    resolvedAsmrConfig = resolveAsmrConfig({ cliFlag });
  });

registerScaffoldCommand(program);
registerValidateCommand(program);
registerPackageCommand(program);
registerInstallCommand(program);
registerUninstallCommand(program);
registerUpdateCommand(program);
registerListCommand(program);

program.parse();

/**
 * Get the resolved ASMR configuration
 * Must be called after program.parse()
 */
export function getResolvedAsmrConfig(): AsmrConfigResolution {
  if (resolvedAsmrConfig === null) {
    // Fallback if called before parse (shouldn't happen in normal use)
    return resolveAsmrConfig();
  }
  return resolvedAsmrConfig;
}
