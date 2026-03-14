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
import { formatVersionOutput } from './formatters/version-formatter';

const program = new Command();

// Read version from package.json to ensure single source of truth
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

program
  .name('asm')
  .description(
    "AI Skills Manager (ASM) - Create, validate, and distribute Claude Code skills.\n\nSkills are markdown files that extend Claude Code's capabilities, appearing as\nslash commands in the Claude Code interface."
  )
  .option('-V, --version', 'Display version')
  .on('option:version', () => {
    const quiet = process.argv.includes('-q') || process.argv.includes('--quiet');
    const json = process.argv.includes('-j') || process.argv.includes('--json');
    console.log(formatVersionOutput(packageJson.version, packageJson.license, { quiet, json }));
    process.exit(0);
  });

registerScaffoldCommand(program);
registerValidateCommand(program);
registerPackageCommand(program);
registerInstallCommand(program);
registerUninstallCommand(program);
registerUpdateCommand(program);
registerListCommand(program);

program.parse();
