#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { registerScaffoldCommand } from './commands/scaffold';
import { registerValidateCommand } from './commands/validate';
import { registerPackageCommand } from './commands/package';
import { registerInstallCommand } from './commands/install';

const program = new Command();

// Read version from package.json to ensure single source of truth
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

program
  .name('asm')
  .description('AI Skills Manager - CLI tool for managing Claude Code Agent Skills')
  .version(packageJson.version);

registerScaffoldCommand(program);
registerValidateCommand(program);
registerPackageCommand(program);
registerInstallCommand(program);

program.parse();
